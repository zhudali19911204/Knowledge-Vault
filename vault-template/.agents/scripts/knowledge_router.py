#!/usr/bin/env python3
"""Safely route processed Obsidian notes out of 01_Inbox.

The script does not classify or summarize content. An AI agent writes the
route metadata; this script validates that metadata before moving files.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path, PurePosixPath, PureWindowsPath


ALLOWED_ROOTS = (
    "02_Domains",
    "03_Areas",
    "04_Resources",
    "05_Skills",
    "06_Archive",
)
KNOWLEDGE_ROOTS = ALLOWED_ROOTS[:4]
FRONTMATTER_PATTERN = re.compile(
    r"\A---\r?\n(?P<yaml>.*?)\r?\n---", re.DOTALL
)
WIKI_LINK_PATTERN = re.compile(r"\[\[[^\]]+\]\]")
OPEN_TASK_PATTERN = re.compile(r"^\s*- \[ \] ", re.MULTILINE)
NUMBERED_COMPONENT_PATTERN = re.compile(
    r"^(?P<code>\d{4,})_(?P<label>.+)$"
)
SKILL_REQUIRED_KEYS = (
    "description",
    "aliases",
    "triggers",
    "use_when",
    "do_not_use_when",
    "match_questions",
    "parent_index",
    "source_notes",
    "related",
)
PACKAGE_REQUIRED_KEYS = (
    "description",
    "triggers",
    "use_when",
    "do_not_use_when",
    "match_questions",
)
ORPHAN_EXEMPT_NOTES = {"AGENTS.md", "README.md"}


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Safely route Obsidian notes from 01_Inbox."
    )
    parser.add_argument(
        "--vault-root",
        type=Path,
        default=default_root,
        help=f"Vault root (default: {default_root})",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Move validated notes. Without this flag, only preview changes.",
    )
    mode.add_argument(
        "--audit",
        action="store_true",
        help="Report Inbox, review, link, and task counts without moving files.",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.85,
        help="Minimum route_confidence required for moving a note (default: 0.85).",
    )
    parser.add_argument(
        "--notes-file",
        type=Path,
        help=(
            "Optional JSON file containing Vault-relative Inbox note paths. "
            "When provided, only those notes are previewed or moved."
        ),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a non-zero exit code when any selected note cannot be routed.",
    )
    args = parser.parse_args()
    if not 0 <= args.confidence_threshold <= 1:
        parser.error("--confidence-threshold must be between 0 and 1")
    return args


def read_note(path: Path) -> str:
    with path.open("r", encoding="utf-8-sig") as handle:
        return handle.read()


def write_note(path: Path, content: str) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(content)


def get_frontmatter_value(content: str, key: str) -> str | None:
    frontmatter = FRONTMATTER_PATTERN.match(content)
    if frontmatter is None:
        return None

    property_pattern = re.compile(
        rf"^{re.escape(key)}:[ \t]*(?P<value>[^\r\n]*)$", re.MULTILINE
    )
    property_match = property_pattern.search(frontmatter.group("yaml"))
    if property_match is None:
        return None

    value = property_match.group("value").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    return value


def get_frontmatter_values(content: str, key: str) -> list[str]:
    """Read a scalar, inline JSON list, or ordinary YAML block list."""

    frontmatter = FRONTMATTER_PATTERN.match(content)
    if frontmatter is None:
        return []
    yaml_text = frontmatter.group("yaml")
    property_pattern = re.compile(
        rf"^{re.escape(key)}:[ \t]*(?P<value>[^\r\n]*)$", re.MULTILINE
    )
    property_match = property_pattern.search(yaml_text)
    if property_match is None:
        return []

    inline = property_match.group("value").strip()
    if inline in {">", "|", ">-", "|-", ">+", "|+"}:
        lines = []
        for line in yaml_text[property_match.end():].splitlines():
            if line.strip() and not line.startswith((" ", "\t")):
                break
            if line.strip():
                lines.append(line.strip())
        return [" ".join(lines)] if lines else []
    if inline:
        if inline == "[]":
            return []
        if inline.startswith("[") and inline.endswith("]"):
            try:
                parsed = json.loads(inline)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return [str(value).strip() for value in parsed if str(value).strip()]
            return [value.strip().strip("\"'") for value in next(csv.reader([inline[1:-1]], skipinitialspace=True)) if value.strip()]
        return [inline.strip("\"'").strip()]

    values: list[str] = []
    tail = yaml_text[property_match.end():]
    for line in tail.splitlines():
        if not line.strip():
            continue
        if not line.startswith((" ", "\t")):
            break
        item = re.match(r"^[ \t]*-[ \t]*(?P<value>.+?)[ \t]*$", line)
        if item is not None:
            value = item.group("value").strip().strip("\"'").strip()
            if value:
                values.append(value)
    return values


def has_frontmatter_key(content: str, key: str) -> bool:
    frontmatter = FRONTMATTER_PATTERN.match(content)
    if frontmatter is None:
        return False
    return re.search(
        rf"^{re.escape(key)}:[ \t]*[^\r\n]*$",
        frontmatter.group("yaml"),
        re.MULTILINE,
    ) is not None


def set_frontmatter_value(content: str, key: str, value: str) -> str:
    frontmatter = FRONTMATTER_PATTERN.match(content)
    if frontmatter is None:
        raise ValueError("The note does not contain valid YAML frontmatter.")

    yaml_text = frontmatter.group("yaml")
    property_pattern = re.compile(
        rf"^{re.escape(key)}:[ \t]*[^\r\n]*$", re.MULTILINE
    )
    replacement = f"{key}: {value}"
    if property_pattern.search(yaml_text):
        yaml_text = property_pattern.sub(replacement, yaml_text, count=1)
    else:
        newline = "\r\n" if "\r\n" in content else "\n"
        yaml_text = yaml_text.rstrip() + newline + replacement

    start, end = frontmatter.span("yaml")
    return content[:start] + yaml_text + content[end:]


def routable_notes(inbox: Path, selected: list[Path] | None = None) -> list[Path]:
    if not inbox.is_dir():
        return []
    if selected is not None:
        return sorted(selected)
    return sorted(
        path
        for path in inbox.rglob("*.md")
        if path.is_file() and not path.stem.startswith("_")
    )


def selected_notes(vault: Path, inbox: Path, notes_file: Path) -> list[Path]:
    """Load an explicit, safe set of Inbox notes from a JSON file."""

    try:
        payload = json.loads(notes_file.expanduser().read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read --notes-file: {error}") from error

    raw_notes = payload.get("notes") if isinstance(payload, dict) else payload
    if not isinstance(raw_notes, list) or not raw_notes:
        raise ValueError("--notes-file must contain a non-empty JSON list or a 'notes' list")

    inbox_resolved = inbox.resolve()
    selected: list[Path] = []
    seen: set[str] = set()
    for raw_note in raw_notes:
        if not isinstance(raw_note, str) or not raw_note.strip():
            raise ValueError("--notes-file contains an invalid note path")
        candidate = (vault / Path(raw_note.replace("/", os.sep))).resolve()
        try:
            candidate.relative_to(inbox_resolved)
        except ValueError as error:
            raise ValueError(f"selected note is outside 01_Inbox: {raw_note}") from error
        if candidate.suffix.lower() != ".md" or candidate.stem.startswith("_"):
            raise ValueError(f"selected note is not a routable Markdown note: {raw_note}")
        if not candidate.is_file():
            raise ValueError(f"selected note does not exist: {raw_note}")
        key = os.path.normcase(str(candidate))
        if key not in seen:
            seen.add(key)
            selected.append(candidate)
    return selected


def is_directory_link(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def valid_numbered_directories(root: Path, number_seed: str):
    if not root.is_dir():
        return
    pattern = re.compile(
        rf"^(?P<code>{re.escape(number_seed)}\d{{2}})_(?P<label>.+)$"
    )
    children = list(root.iterdir())
    codes = [match.group("code") for child in children
             if child.is_dir() and (match := pattern.fullmatch(child.name))]
    for child in sorted(
        (path for path in children if path.is_dir()),
        key=lambda path: path.name.casefold(),
    ):
        match = pattern.fullmatch(child.name)
        if (match is None or match.group("code").endswith("00")
                or codes.count(match.group("code")) != 1
                or is_directory_link(child) or not child.resolve().is_relative_to(root.resolve())):
            continue
        yield child, match.group("label")
        yield from valid_numbered_directories(child, match.group("code"))


def directory_catalog(vault: Path) -> list[dict]:
    """Describe existing folders to the model; never classify by title alone."""
    entries = []
    for root_name in KNOWLEDGE_ROOTS:
        root = vault / root_name
        if is_directory_link(root) or not root.resolve().is_relative_to(vault.resolve()):
            continue
        root_code = root_name.split("_", maxsplit=1)[0]
        for directory, label in valid_numbered_directories(root, root_code):
            entry = {"path": directory.relative_to(vault).as_posix(), "title": label}
            index = directory / "_Index.md"
            content = ""
            if index.is_file() and not index.is_symlink() and index.resolve().is_relative_to(vault.resolve()):
                try:
                    content = read_note(index)
                except OSError:
                    pass
            for key in ("title", "description", "status", "aliases", "triggers", "use_when", "do_not_use_when", "match_questions"):
                values = get_frontmatter_values(content, key)
                if values:
                    entry[key] = values[0] if key in {"title", "description", "status"} else values
            entry["limited_context"] = not (entry.get("description") and entry.get("use_when")) or entry.get("status") == "needs-review"
            if entry["limited_context"]:
                entry["sample_titles"] = [p.stem for p in sorted(directory.glob("*.md"))
                                          if p.is_file() and not p.stem.startswith("_")][:5]
            entries.append(entry)
    return entries


def resolve_numbered_parts(vault: Path, raw_parts: list[str], reservations: set[Path] | None = None) -> list[str]:
    """Resolve only valid numbered folders and allocate the next sequence.

    Every level extends its parent's numeric code by exactly two digits. New
    folders always use max(existing sequence) + 1; retired numbers are never
    reused and callers cannot create gaps with a guessed explicit number.
    """

    resolved = [raw_parts[0]]
    parent = vault / raw_parts[0]
    number_seed = raw_parts[0].split("_", maxsplit=1)[0]

    for requested in raw_parts[1:]:
        children = sorted(
            set(parent.iterdir() if parent.is_dir() else ())
            | {child for child in (reservations or ()) if child.parent == parent},
            key=lambda child: child.name.casefold(),
        )
        codes = [match.group("code") for child in children
                 if (match := NUMBERED_COMPONENT_PATTERN.fullmatch(child.name))]
        if len(codes) != len(set(codes)):
            raise ValueError(f"duplicate folder numbers under '{parent}'")

        exact = next(
            (child for child in children if child.name.casefold() == requested.casefold()),
            None,
        )
        if exact is not None:
            component = exact.name
            if exact.exists() and not exact.is_dir():
                raise ValueError(f"destination component '{component}' is not a directory")
            if is_directory_link(exact) or not exact.resolve().is_relative_to(parent.resolve()):
                raise ValueError(f"unsafe directory link: {exact}")
            match = NUMBERED_COMPONENT_PATTERN.fullmatch(component)
            if match is None:
                raise ValueError(
                    f"existing folder '{component}' violates the required numbered format "
                    f"'{number_seed}NN_label'"
                )
            existing_code = match.group("code")
            if not existing_code.startswith(number_seed) or len(existing_code) != len(number_seed) + 2 or existing_code.endswith("00"):
                raise ValueError(
                    f"folder number '{existing_code}' does not extend parent number "
                    f"'{number_seed}' by two digits"
                )
            number_seed = existing_code
            resolved.append(component)
            parent /= component
            continue

        expected_pattern = re.compile(
            rf"^(?P<code>{re.escape(number_seed)}(?P<sequence>\d{{2}}))_"
            r"(?P<label>.+)$"
        )
        numbered_children: list[tuple[int, str, str]] = []
        for child in children:
            match = expected_pattern.fullmatch(child.name)
            if match is not None and (child.is_dir() or child in (reservations or ())):
                numbered_children.append(
                    (
                        int(match.group("sequence")),
                        match.group("label"),
                        child.name,
                    )
                )

        label_matches = [
                (sequence, name)
                for sequence, label, name in numbered_children
                if label.casefold() == requested.casefold()
        ]
        if len(label_matches) > 1:
            raise ValueError(f"ambiguous folder label '{requested}'; use an exact existing path")
        if label_matches:
            sequence, component = label_matches[0]
            child = parent / component
            if sequence == 0 or is_directory_link(child) or not child.resolve().is_relative_to(parent.resolve()):
                raise ValueError(f"unsafe or invalid numbered folder: {child}")
            number_seed = component.split("_", maxsplit=1)[0]
            resolved.append(component)
            parent /= component
            continue

        next_sequence = max(
            (sequence for sequence, _, _ in numbered_children),
            default=0,
        ) + 1
        if next_sequence > 99:
            raise ValueError(f"folder sequence under '{parent}' exceeds 99")
        next_code = f"{number_seed}{next_sequence:02d}"

        requested_number = NUMBERED_COMPONENT_PATTERN.fullmatch(requested)
        if requested_number is not None:
            expected_code = requested_number.group("code")
            if not expected_code.startswith(number_seed) or len(expected_code) != len(number_seed) + 2:
                raise ValueError(
                    f"folder number '{expected_code}' does not extend parent number "
                    f"'{number_seed}' by two digits"
                )
            if any(
                name.split("_", maxsplit=1)[0] == expected_code
                for _, _, name in numbered_children
            ):
                raise ValueError(f"folder number '{expected_code}' is already in use")
            if expected_code != next_code:
                raise ValueError(
                    f"new folder number must be the next sequential code '{next_code}', "
                    f"not '{expected_code}'"
                )
            component = requested
            number_seed = expected_code
        else:
            number_seed = next_code
            component = f"{number_seed}_{requested}"

        resolved.append(component)
        parent /= component
        if reservations is not None:
            reservations.add(parent)

    return resolved


def safe_destination(
    vault: Path,
    route: str,
    *,
    note_name: str = "",
    note_title: str = "",
    reservations: set[Path] | None = None,
) -> tuple[Path, str, bool]:
    route = route.strip()
    if PureWindowsPath(route).is_absolute() or PurePosixPath(route).is_absolute():
        raise ValueError("route_to must be a relative path")

    raw_parts = re.split(r"[\\/]+", route)
    if not raw_parts or any(part in {"", ".", ".."} or re.search(r'[<>:"|?*\x00-\x1f]', part) or part.endswith((" ", ".")) for part in raw_parts):
        raise ValueError("route_to contains an unsafe path segment")
    if raw_parts[0] not in ALLOWED_ROOTS:
        raise ValueError(f"route root '{raw_parts[0]}' is not allowed")

    root = vault / raw_parts[0]
    if is_directory_link(root) or not root.resolve().is_relative_to(vault.resolve()):
        raise ValueError("route root must not be a directory link or outside the vault")
    resolved_parts = resolve_numbered_parts(vault, raw_parts, reservations)
    destination = vault.joinpath(*resolved_parts).resolve(strict=False)
    vault_key = os.path.normcase(str(vault))
    destination_key = os.path.normcase(str(destination))
    if os.path.commonpath((vault_key, destination_key)) != vault_key:
        raise ValueError("destination is outside the vault")

    # Keep the return shape for existing callers; titles never override a route.
    return destination, "/".join(resolved_parts), False


def unique_destination(directory: Path, file_name: str) -> Path:
    candidate = directory / file_name
    if not candidate.exists():
        return candidate

    source = Path(file_name)
    counter = 2
    while True:
        candidate = directory / f"{source.stem} ({counter}){source.suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def ensure_package_index(vault: Path, directory: Path, note: Path) -> Path | None:
    """Create a review-required package index for a new knowledge directory."""

    relative = directory.relative_to(vault)
    if not relative.parts or relative.parts[0] not in {
        "02_Domains",
        "03_Areas",
        "04_Resources",
        "05_Skills",
    }:
        return None

    index_path = directory / "_Index.md"
    if index_path.exists():
        return None

    folder_name = directory.name
    title = folder_name.split("_", maxsplit=1)[-1]
    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    quoted_title = json.dumps(title, ensure_ascii=False)
    quoted_trigger = json.dumps(title, ensure_ascii=False)
    note_relative = note.relative_to(vault)
    note_link = (note_relative.with_suffix("") if note_relative.parts[0] in KNOWLEDGE_ROOTS
                 else relative / note.stem).as_posix().replace("]", "")
    content = f"""---
title: {quoted_title}
created: {timestamp}
updated: {timestamp}
type: knowledge-package
status: needs-review
description: >
  当用户的问题直接涉及 {title} 时使用。此索引由路由器自动创建，需执行“知识联”补充准确边界和文档路由。
aliases: []
triggers:
  - {quoted_trigger}
use_when:
  - 问题与 {title} 直接相关
do_not_use_when:
  - 当前索引尚未完成人工或 AI 复核
match_questions: []
domain:
  - {quoted_title}
retrieval_priority: low
related:
  - "[[知识路由索引]]"
---

# {title}

> [!warning] 待完善
> 本索引由路由器自动创建。执行“知识联”后补充准确的使用边界、匹配问题和相关文档。

## 文档路由

| 用户需求 | 首选文档 | 相关文档 |
|---|---|---|
| 与 {title} 直接相关的当前知识 | [[{note_link}]] | 暂无 |

## 本目录文档

- [[{note_link}]]

## 相关知识包

- [[知识路由索引]]
"""
    write_note(index_path, content)
    return index_path


def markdown_notes(vault: Path) -> list[Path]:
    notes: list[Path] = []
    for path in vault.rglob("*.md"):
        relative_parts = path.relative_to(vault).parts
        if any(
            runtime_directory in relative_parts
            for runtime_directory in (
                ".agents",
                ".codex",
                ".dsh",
                ".git",
                ".obsidian",
                ".pnpm-store",
                ".venv",
                "dist",
                "node_modules",
            )
        ):
            continue
        if any(
            part == "Templates" or part.endswith("_Templates")
            for part in relative_parts
        ):
            continue
        notes.append(path)
    return sorted(notes)


def audit(vault: Path, inbox: Path) -> None:
    notes = markdown_notes(vault)
    needs_review = 0
    ready = 0
    orphan_candidates = 0
    open_tasks = 0
    skill_notes = 0
    package_notes = 0
    missing_skill_metadata: list[Path] = []
    missing_package_metadata: list[Path] = []

    for note in notes:
        content = read_note(note)
        status = get_frontmatter_value(content, "status")
        note_type = get_frontmatter_value(content, "type")
        needs_review += status == "needs-review"
        ready += status == "ready"
        if (
            note.name not in ORPHAN_EXEMPT_NOTES
            and not note.stem.startswith("_")
            and WIKI_LINK_PATTERN.search(content) is None
        ):
            orphan_candidates += 1
        open_tasks += len(OPEN_TASK_PATTERN.findall(content))
        if note_type == "knowledge-skill":
            skill_notes += 1
            if any(not has_frontmatter_key(content, key) for key in SKILL_REQUIRED_KEYS):
                missing_skill_metadata.append(note)
        if note_type == "knowledge-package":
            package_notes += 1
            if any(not has_frontmatter_key(content, key) for key in PACKAGE_REQUIRED_KEYS):
                missing_package_metadata.append(note)

    missing_indexes: list[Path] = []
    for root_name in ("02_Domains", "03_Areas", "04_Resources", "05_Skills"):
        knowledge_root = vault / root_name
        if not knowledge_root.is_dir():
            continue
        for directory in sorted(path for path in knowledge_root.iterdir() if path.is_dir()):
            if not (directory / "_Index.md").is_file():
                missing_indexes.append(directory)

    print("Knowledge vault audit")
    print(f"  Total Markdown notes : {len(notes)}")
    print(f"  Inbox notes          : {len(routable_notes(inbox))}")
    print(f"  Needs review         : {needs_review}")
    print(f"  Ready to route       : {ready}")
    print(f"  No-link candidates   : {orphan_candidates}")
    print(f"  Open tasks           : {open_tasks}")
    print(f"  Knowledge-skill notes: {skill_notes}")
    print(f"  Missing skill metadata: {len(missing_skill_metadata)}")
    print(f"  Knowledge packages  : {package_notes}")
    print(f"  Missing package metadata: {len(missing_package_metadata)}")
    print(f"  Folders missing _Index: {len(missing_indexes)}")

    for path in missing_skill_metadata:
        print(f"    [SKILL] {path.relative_to(vault).as_posix()}")
    for path in missing_package_metadata:
        print(f"    [PACKAGE] {path.relative_to(vault).as_posix()}")
    for path in missing_indexes:
        print(f"    [INDEX] {path.relative_to(vault).as_posix()}")


def route_notes(
    vault: Path,
    inbox: Path,
    *,
    apply_changes: bool,
    confidence_threshold: float,
    notes: list[Path] | None = None,
) -> dict[str, int]:
    moved = 0
    pending = 0
    skipped = 0

    candidates = sorted(((note, read_note(note)) for note in routable_notes(inbox, notes)),
                        key=lambda item: (get_frontmatter_value(item[1], "route_to") or "", item[0].name))
    planned = 0
    reservations: set[Path] = set()
    plans = []
    for note, content in candidates:
        status = get_frontmatter_value(content, "status")
        route = get_frontmatter_value(content, "route_to")
        confidence_text = get_frontmatter_value(content, "route_confidence")

        if status != "ready":
            pending += 1
            print(f"[PENDING] {note.name} - status is '{status}'")
            continue
        if not route:
            skipped += 1
            print(f"[SKIPPED] {note.name} - route_to is empty", file=sys.stderr)
            continue

        try:
            confidence = float(confidence_text or "")
        except ValueError:
            confidence = 0.0

        if not math.isfinite(confidence) or confidence < confidence_threshold or confidence > 1:
            pending += 1
            shown_confidence = confidence_text if confidence_text else "missing"
            print(
                f"[REVIEW] {note.name} - confidence {shown_confidence} "
                f"is below {confidence_threshold:g}"
            )
            continue

        try:
            destination_directory, relative_route, _ = safe_destination(
                vault,
                route,
                note_name=note.stem,
                note_title=get_frontmatter_value(content, "title") or "",
                reservations=reservations,
            )
        except ValueError as error:
            skipped += 1
            print(f"[SKIPPED] {note.name} - {error}", file=sys.stderr)
            continue

        plans.append((note, content, destination_directory, relative_route))

    # Resolve the whole selection before creating directories or moving notes.
    # Reservations make sibling allocations identical in preview and apply.
    if skipped:
        pending += len(plans)
        plans = []
        print("[BLOCKED] Invalid routes in this selection; no notes moved.", file=sys.stderr)
    for note, content, destination_directory, relative_route in plans:
        planned += 1
        if not apply_changes:
            print(f"[DRY-RUN] {note.name} -> {relative_route}")
            continue

        destination_directory.mkdir(parents=True, exist_ok=True)
        destination = unique_destination(destination_directory, note.name)
        relative_parts = destination_directory.relative_to(vault).parts
        for depth in range(2, len(relative_parts) + 1):
            directory = vault.joinpath(*relative_parts[:depth])
            created_index = ensure_package_index(vault, directory, destination)
            if created_index is not None:
                print(f"[INDEX] {created_index.relative_to(vault).as_posix()}")
        content = set_frontmatter_value(content, "status", "processed")
        content = set_frontmatter_value(content, "route_to", relative_route)
        routed_at = datetime.now().astimezone().isoformat(timespec="seconds")
        content = set_frontmatter_value(content, "routed_at", routed_at)
        write_note(note, content)

        shutil.move(str(note), str(destination))
        moved += 1
        print(f"[MOVED] {destination.relative_to(vault).as_posix()}")

    mode = "apply" if apply_changes else "dry-run"
    print(
        f"Summary: selected={len(candidates)}, planned={planned}, moved={moved}, "
        f"pending={pending}, skipped={skipped}, mode={mode}"
    )
    return {
        "selected": len(candidates),
        "planned": planned,
        "moved": moved,
        "pending": pending,
        "skipped": skipped,
    }


def main() -> int:
    args = parse_args()
    vault = args.vault_root.expanduser().resolve()
    if not vault.is_dir():
        print(f"Vault root does not exist: {vault}", file=sys.stderr)
        return 2

    inbox = vault / "01_Inbox"
    if args.audit:
        audit(vault, inbox)
    else:
        selected = None
        if args.notes_file is not None:
            try:
                selected = selected_notes(vault, inbox, args.notes_file)
            except ValueError as error:
                print(f"Invalid --notes-file: {error}", file=sys.stderr)
                return 2
        summary = route_notes(
            vault,
            inbox,
            apply_changes=args.apply,
            confidence_threshold=args.confidence_threshold,
            notes=selected,
        )
        if args.strict and (summary["pending"] or summary["skipped"]):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
