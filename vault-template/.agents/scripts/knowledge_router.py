#!/usr/bin/env python3
"""Safely route processed Obsidian notes out of 01_Inbox.

The script does not classify or summarize content. An AI agent writes the
route metadata; this script validates that metadata before moving files.
"""

from __future__ import annotations

import argparse
import json
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


def normalized_name(value: str) -> str:
    return re.sub(r"[\W_]+", "", value, flags=re.UNICODE).casefold()


def meaningful_folder_label(value: str) -> bool:
    cjk_count = len(re.findall(r"[\u3400-\u9fff]", value))
    return cjk_count >= 2 or len(value) >= 3


def valid_numbered_directories(root: Path, number_seed: str):
    if not root.is_dir():
        return
    pattern = re.compile(
        rf"^(?P<code>{re.escape(number_seed)}\d{{2}})_(?P<label>.+)$"
    )
    for child in sorted(
        (path for path in root.iterdir() if path.is_dir()),
        key=lambda path: path.name.casefold(),
    ):
        match = pattern.fullmatch(child.name)
        if match is None:
            continue
        yield child, match.group("label")
        yield from valid_numbered_directories(child, match.group("code"))


def term_match_strength(names: list[str], term: str) -> int:
    normalized_term = normalized_name(term)
    if not meaningful_folder_label(normalized_term):
        return 0
    if any(normalized_name(name) == normalized_term for name in names):
        return 2

    contains_cjk = re.search(r"[\u3400-\u9fff]", term) is not None
    if contains_cjk:
        return int(any(normalized_term in normalized_name(name) for name in names))

    term_words = re.sub(r"[\W_]+", " ", term, flags=re.UNICODE).casefold().strip()
    if not term_words:
        return 0
    pattern = re.compile(rf"(?<!\w){re.escape(term_words)}(?!\w)")
    return int(
        any(
            pattern.search(
                re.sub(r"[\W_]+", " ", name, flags=re.UNICODE).casefold().strip()
            )
            is not None
            for name in names
        )
    )


def directory_terms(directory: Path, label: str) -> list[tuple[str, int]]:
    """Return match terms with directory names ranked above index metadata."""

    terms = [(label, 2)]
    index_path = directory / "_Index.md"
    if not index_path.is_file():
        return terms
    try:
        content = read_note(index_path)
    except OSError:
        return terms

    title = get_frontmatter_value(content, "title")
    if title:
        terms.append((title, 2))
    for key in ("aliases", "triggers"):
        terms.extend((value, 1) for value in get_frontmatter_values(content, key))
    return terms


def filename_related_directory(vault: Path, names: list[str]) -> Path | None:
    """Find one high-confidence existing directory across active knowledge roots."""

    names = [value for value in names if normalized_name(value)]
    if not names:
        return None

    candidates: dict[Path, tuple[int, int, int, int]] = {}
    for root_name in KNOWLEDGE_ROOTS:
        root = vault / root_name
        root_code = root_name.split("_", maxsplit=1)[0]
        for directory, label in valid_numbered_directories(root, root_code):
            depth = len(directory.relative_to(root).parts)
            for term, term_priority in directory_terms(directory, label):
                strength = term_match_strength(names, term)
                if strength == 0:
                    continue
                score = (strength, term_priority, len(normalized_name(term)), depth)
                if score > candidates.get(directory, (0, 0, 0, 0)):
                    candidates[directory] = score

    if not candidates:
        return None
    best_score = max(candidates.values())
    best_paths = [path for path, score in candidates.items() if score == best_score]
    return best_paths[0] if len(best_paths) == 1 else None


def resolve_numbered_parts(vault: Path, raw_parts: list[str]) -> list[str]:
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
            (child for child in parent.iterdir() if child.is_dir()),
            key=lambda child: child.name.casefold(),
        ) if parent.is_dir() else []

        exact = next(
            (child for child in children if child.name.casefold() == requested.casefold()),
            None,
        )
        if exact is not None:
            component = exact.name
            match = NUMBERED_COMPONENT_PATTERN.fullmatch(component)
            if match is None:
                raise ValueError(
                    f"existing folder '{component}' violates the required numbered format "
                    f"'{number_seed}NN_label'"
                )
            existing_code = match.group("code")
            if not existing_code.startswith(number_seed) or len(existing_code) != len(number_seed) + 2:
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
            if match is not None:
                numbered_children.append(
                    (
                        int(match.group("sequence")),
                        match.group("label"),
                        child.name,
                    )
                )

        matching_label = next(
            (
                (sequence, name)
                for sequence, label, name in numbered_children
                if label.casefold() == requested.casefold()
            ),
            None,
        )
        if matching_label is not None:
            _, component = matching_label
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

    return resolved


def safe_destination(
    vault: Path,
    route: str,
    *,
    note_name: str = "",
    note_title: str = "",
) -> tuple[Path, str, bool]:
    route = route.strip()
    if PureWindowsPath(route).is_absolute() or PurePosixPath(route).is_absolute():
        raise ValueError("route_to must be a relative path")

    raw_parts = re.split(r"[\\/]+", route)
    if not raw_parts or any(part in {"", ".", ".."} for part in raw_parts):
        raise ValueError("route_to contains an unsafe path segment")
    if raw_parts[0] not in ALLOWED_ROOTS:
        raise ValueError(f"route root '{raw_parts[0]}' is not allowed")

    filename_match = (
        filename_related_directory(vault, [note_name, note_title])
        if raw_parts[0] in KNOWLEDGE_ROOTS
        else None
    )
    matched_by_filename = False
    try:
        resolved_parts = resolve_numbered_parts(vault, raw_parts)
        destination = vault.joinpath(*resolved_parts).resolve(strict=False)
    except ValueError:
        if filename_match is None:
            raise
        destination = filename_match.resolve()
        resolved_parts = list(destination.relative_to(vault).parts)
        matched_by_filename = True

    if filename_match is not None and not matched_by_filename:
        try:
            destination.relative_to(filename_match)
        except ValueError:
            destination = filename_match.resolve()
            resolved_parts = list(destination.relative_to(vault).parts)
            matched_by_filename = True
    vault_key = os.path.normcase(str(vault))
    destination_key = os.path.normcase(str(destination))
    if os.path.commonpath((vault_key, destination_key)) != vault_key:
        raise ValueError("destination is outside the vault")

    return destination, "/".join(resolved_parts), matched_by_filename


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
    note_link = (relative / note.stem).as_posix().replace("]", "")
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

    candidates = routable_notes(inbox, notes)
    planned = 0
    for note in candidates:
        content = read_note(note)
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

        if confidence < confidence_threshold:
            pending += 1
            shown_confidence = confidence_text if confidence_text else "missing"
            print(
                f"[REVIEW] {note.name} - confidence {shown_confidence} "
                f"is below {confidence_threshold:g}"
            )
            continue

        try:
            destination_directory, relative_route, matched_by_filename = safe_destination(
                vault,
                route,
                note_name=note.stem,
                note_title=get_frontmatter_value(content, "title") or "",
            )
        except ValueError as error:
            skipped += 1
            print(f"[SKIPPED] {note.name} - {error}", file=sys.stderr)
            continue

        if not apply_changes:
            planned += 1
            match_label = " [filename-match]" if matched_by_filename else ""
            print(f"[DRY-RUN] {note.name} -> {relative_route}{match_label}")
            continue

        destination_directory.mkdir(parents=True, exist_ok=True)
        created_index = ensure_package_index(vault, destination_directory, note)
        if created_index is not None:
            print(f"[INDEX] {created_index.relative_to(vault).as_posix()}")
        content = set_frontmatter_value(content, "status", "processed")
        content = set_frontmatter_value(content, "route_to", relative_route)
        if matched_by_filename:
            existing_reason = get_frontmatter_value(content, "route_reason") or ""
            match_reason = f"文件名或标题优先匹配现有目录名称/索引别名：{relative_route}"
            route_reason = f"{existing_reason}；{match_reason}" if existing_reason else match_reason
            content = set_frontmatter_value(content, "route_reason", route_reason)
        routed_at = datetime.now().astimezone().isoformat(timespec="seconds")
        content = set_frontmatter_value(content, "routed_at", routed_at)
        write_note(note, content)

        destination = unique_destination(destination_directory, note.name)
        shutil.move(str(note), str(destination))
        moved += 1
        match_label = " [filename-match]" if matched_by_filename else ""
        print(f"[MOVED] {destination.relative_to(vault).as_posix()}{match_label}")

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
