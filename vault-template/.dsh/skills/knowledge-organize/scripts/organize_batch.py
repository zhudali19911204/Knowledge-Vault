#!/usr/bin/env python3
"""Batch-render and route knowledge cards from one model-produced manifest.

The model decides semantic card content once. This script owns deterministic
validation, Markdown rendering, backlinks, index registration, and routing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path


SCHEMA_VERSION = 1
CONFIDENCE_THRESHOLD = 0.85
CARD_ROUTE_ROOTS = {"02_Domains", "03_Areas", "04_Resources", "05_Skills"}
CATEGORY_INDEX_CONFIG = {
    "02_Domains": ("_专业领域索引.md", "专业领域"),
    "03_Areas": ("_长期领域索引.md", "长期领域"),
    "04_Resources": ("_资源索引.md", "资源"),
    "05_Skills": ("_技能索引.md", "技能与工作流"),
}
IGNORED_DIRECTORIES = {
    ".agents",
    ".codex",
    ".dsh",
    ".git",
    ".obsidian",
    ".pnpm-store",
    ".venv",
    "dist",
    "node_modules",
}
ORGANIZER_SOURCE_KEYS = {
    "updated",
    "status",
    "route_to",
    "route_confidence",
    "route_reason",
    "routed_at",
    "organized_source_sha256",
    "organizer_schema_version",
    "organized_run_id",
    "organized_cards",
}
FRONTMATTER_PATTERN = re.compile(r"\A---\r?\n(?P<yaml>.*?)\r?\n---(?P<body>.*)\Z", re.DOTALL)
TOP_LEVEL_KEY_PATTERN = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_-]*):")
HEADING_PATTERN = re.compile(r"^(?P<marks>#{1,6})\s+(?P<title>.+?)\s*$")
WIKI_ATTACHMENT_PATTERN = re.compile(r"!\[\[(?P<path>07_Attachments/[^\]|#]+)")
CARD_REFERENCE_PATTERN = re.compile(r"^C(?P<number>[0-9]+)$", re.IGNORECASE)
OPERATIONAL_BOUNDARY_PATTERN = re.compile(
    r"^\s*(?:不要|不得|禁止|严禁|切勿|务必|先|然后|再|接着|最后|点击|输入|打开|选择|保存后|执行后|"
    r"do\s+not\b|don't\b|never\b|must\b|first\b|then\b|next\b)",
    re.IGNORECASE,
)


class OrganizeError(RuntimeError):
    pass


def yaml_quote(value: object) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temporary, path)


def ensure_inside(path: Path, root: Path, label: str) -> Path:
    resolved = path.expanduser().resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as error:
        raise OrganizeError(f"{label}超出允许范围：{resolved}") from error
    return resolved


def vault_relative(path: Path, vault: Path) -> str:
    return path.resolve().relative_to(vault.resolve()).as_posix()


def split_frontmatter(content: str) -> tuple[str, str]:
    match = FRONTMATTER_PATTERN.match(content)
    if match is None:
        raise OrganizeError("Markdown 缺少有效 YAML frontmatter。")
    return match.group("yaml"), match.group("body").lstrip("\r\n")


def frontmatter_blocks(yaml_text: str) -> list[tuple[str | None, list[str]]]:
    blocks: list[tuple[str | None, list[str]]] = []
    current_key: str | None = None
    current_lines: list[str] = []
    for line in yaml_text.splitlines():
        match = TOP_LEVEL_KEY_PATTERN.match(line)
        if match:
            if current_lines:
                blocks.append((current_key, current_lines))
            current_key = match.group("key")
            current_lines = [line]
        else:
            current_lines.append(line)
    if current_lines:
        blocks.append((current_key, current_lines))
    return blocks


def scalar_value(content: str, key: str) -> str | None:
    try:
        yaml_text, _ = split_frontmatter(content)
    except OrganizeError:
        return None
    for block_key, lines in frontmatter_blocks(yaml_text):
        if block_key != key or not lines:
            continue
        value = lines[0].split(":", 1)[1].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            try:
                return json.loads(value) if value[0] == '"' else value[1:-1]
            except json.JSONDecodeError:
                return value[1:-1]
        return value
    return None


def frontmatter_values(content: str, key: str) -> list[str]:
    try:
        yaml_text, _ = split_frontmatter(content)
    except OrganizeError:
        return []
    for block_key, lines in frontmatter_blocks(yaml_text):
        if block_key != key or not lines:
            continue
        inline = lines[0].split(":", 1)[1].strip()
        if inline:
            if inline == "[]":
                return []
            if inline.startswith("[") and inline.endswith("]"):
                try:
                    parsed = json.loads(inline)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass
            value = inline
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                try:
                    value = json.loads(value) if value[0] == '"' else value[1:-1]
                except json.JSONDecodeError:
                    value = value[1:-1]
            return [str(value).strip()] if str(value).strip() else []
        values: list[str] = []
        for line in lines[1:]:
            match = re.match(r"^\s*-\s+(.+?)\s*$", line)
            if match is None:
                continue
            value = match.group(1)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                try:
                    value = json.loads(value) if value[0] == '"' else value[1:-1]
                except json.JSONDecodeError:
                    value = value[1:-1]
            if str(value).strip():
                values.append(str(value).strip())
        return values
    return []


def render_yaml_field(key: str, value: object) -> list[str]:
    if isinstance(value, list):
        if not value:
            return [f"{key}: []"]
        return [f"{key}:", *[f"  - {yaml_quote(item)}" for item in value]]
    if value is None or value == "":
        return [f"{key}:"]
    if isinstance(value, bool):
        return [f"{key}: {'true' if value else 'false'}"]
    if isinstance(value, (int, float)):
        return [f"{key}: {value}"]
    return [f"{key}: {yaml_quote(value)}"]


def set_frontmatter_fields(content: str, fields: dict[str, object]) -> str:
    yaml_text, body = split_frontmatter(content)
    remaining = dict(fields)
    emitted: set[str] = set()
    lines: list[str] = []
    for key, block in frontmatter_blocks(yaml_text):
        if key not in fields:
            lines.extend(block)
        elif key not in emitted:
            lines.extend(render_yaml_field(key, fields[key]))
            emitted.add(key)
            remaining.pop(key, None)
    for key, value in remaining.items():
        lines.extend(render_yaml_field(key, value))
    return "---\n" + "\n".join(lines).rstrip() + "\n---\n\n" + body.rstrip() + "\n"


def remove_level_two_section(body: str, heading: str) -> str:
    pattern = re.compile(
        rf"(?ms)^##\s+{re.escape(heading)}\s*$.*?(?=^##\s+|\Z)"
    )
    return pattern.sub("", body).rstrip()


def replace_level_two_section(content: str, heading: str, lines: list[str]) -> str:
    yaml_text, body = split_frontmatter(content)
    body = remove_level_two_section(body, heading)
    section = f"## {heading}\n\n" + "\n".join(lines).rstrip()
    body = body.rstrip() + "\n\n" + section + "\n"
    return f"---\n{yaml_text.rstrip()}\n---\n\n{body}"


def semantic_source_hash(content: str) -> str:
    yaml_text, body = split_frontmatter(content)
    stable_yaml: list[str] = []
    for key, block in frontmatter_blocks(yaml_text):
        if key not in ORGANIZER_SOURCE_KEYS:
            stable_yaml.extend(block)
    stable_body = remove_level_two_section(body, "已提炼知识")
    normalized = "\n".join(stable_yaml).strip() + "\n---\n" + stable_body.strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def source_sections(content: str) -> list[dict[str, object]]:
    _, body = split_frontmatter(content)
    lines = body.splitlines()
    starts: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        match = HEADING_PATTERN.match(line)
        if match:
            starts.append((index, len(match.group("marks")), match.group("title")))
    if not starts or starts[0][0] > 0:
        starts.insert(0, (0, 0, "正文开头"))

    sections: list[dict[str, object]] = []
    for position, (start, level, title) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        text = "\n".join(lines[start:end]).strip()
        if not text:
            continue
        sections.append(
            {
                "id": f"S{len(sections) + 1:03d}",
                "heading": title,
                "level": level,
                "line_start": start + 1,
                "line_end": end,
                "characters": len(text),
                "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            }
        )
    return sections


def annotated_source(content: str, sections: list[dict[str, object]]) -> str:
    """Render the source body once with stable evidence markers."""

    _, body = split_frontmatter(content)
    lines = body.splitlines()
    rendered: list[str] = []
    for section in sections:
        start = int(section["line_start"]) - 1
        end = int(section["line_end"])
        rendered.extend(
            [
                f"<<<{section['id']} | {section['heading']}>>>",
                "\n".join(lines[start:end]).strip(),
                f"<<<END {section['id']}>>>",
                "",
            ]
        )
    return "\n".join(rendered).rstrip()


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def comparison_key(value: object) -> str:
    """Normalize wording for conservative exact-meaning duplicate checks."""

    return re.sub(r"[\W_]+", "", str(value), flags=re.UNICODE).casefold()


def compact_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_card(card: dict) -> dict:
    """Accept the compact agent contract and preserve legacy manifests."""

    normalized = dict(card)
    title = str(card.get("title") or "").strip()
    kind = str(card.get("kind") or card.get("knowledge_kind") or "concept").strip()
    uses = string_list(card.get("use", card.get("use_when")))
    avoids = string_list(card.get("avoid", card.get("do_not_use_when")))
    questions = string_list(card.get("questions", card.get("match_questions")))
    related_links: list[str] = []
    related_ids = string_list(card.get("related_ids"))
    for item in string_list(card.get("related")):
        if CARD_REFERENCE_PATTERN.fullmatch(item):
            related_ids.append(item.upper())
        else:
            related_links.append(item)

    normalized["title"] = title
    normalized["knowledge_kind"] = kind
    normalized["aliases"] = string_list(card.get("aliases"))
    normalized["triggers"] = string_list(card.get("triggers"))
    normalized["use_when"] = uses
    normalized["do_not_use_when"] = avoids
    normalized["match_questions"] = questions
    normalized["includes"] = string_list(card.get("includes"))
    normalized["excludes"] = string_list(card.get("excludes"))
    normalized["related"] = list(dict.fromkeys(related_links))
    normalized["related_ids"] = list(dict.fromkeys(related_ids))
    normalized["route_to"] = card.get("route", card.get("route_to"))
    normalized["route_confidence"] = card.get("confidence", card.get("route_confidence"))
    normalized["route_reason"] = card.get("reason", card.get("route_reason"))
    normalized["evidence"] = string_list(card.get("evidence"))

    existing_content = card.get("content")
    if isinstance(existing_content, dict):
        normalized["content"] = existing_content
    else:
        details = str(card.get("body", existing_content) or "").strip()
        conclusion = str(card.get("conclusion") or "").strip()
        limitations = str(card.get("limits", card.get("limitations")) or "").strip()
        normalized["content"] = {
            "conclusion": conclusion,
            "problem": "；".join(uses),
            "explanation": details if kind != "procedure" else "",
            "conditions": "",
            "method": details if kind == "procedure" else "",
            "example": "",
            "limitations": limitations,
        }
    return normalized


def normalize_manifest(manifest: dict) -> dict:
    normalized = dict(manifest)
    cards = manifest.get("cards")
    if isinstance(cards, list):
        normalized_cards = [normalize_card(card) if isinstance(card, dict) else card for card in cards]
        for index, card in enumerate(normalized_cards):
            if not isinstance(card, dict):
                continue
            reciprocal_id = f"C{index + 1:03d}"
            for reference in list(card.get("related_ids", [])):
                match = CARD_REFERENCE_PATTERN.fullmatch(reference)
                if match is None or reference != f"C{int(match.group('number')):03d}":
                    continue
                target_index = int(match.group("number")) - 1
                if target_index == index or not 0 <= target_index < len(normalized_cards):
                    continue
                target = normalized_cards[target_index]
                if not isinstance(target, dict):
                    continue
                target_ids = string_list(target.get("related_ids"))
                if reciprocal_id not in target_ids:
                    target_ids.append(reciprocal_id)
                target["related_ids"] = target_ids
        normalized["cards"] = normalized_cards
    return normalized


def merge_cards_payload(manifest: dict, payload: object) -> dict:
    """Merge only model-owned card fields into a prepared manifest."""

    if isinstance(payload, list):
        cards = payload
        settings: dict = {}
    elif isinstance(payload, dict):
        cards = payload.get("cards")
        settings = payload
    else:
        raise OrganizeError("cards 文件必须是 JSON 数组或包含 cards 数组的对象。")
    if not isinstance(cards, list):
        raise OrganizeError("cards 文件缺少 cards 数组。")

    merged = dict(manifest)
    merged["cards"] = cards
    if "expected" in settings:
        merged["expected_card_count"] = settings["expected"]
    elif "expected_card_count" in settings:
        merged["expected_card_count"] = settings["expected_card_count"]
    if "skip_reason" in settings:
        merged["skip_reason"] = settings["skip_reason"]
    return normalize_manifest(merged)


def markdown_notes(vault: Path):
    for path in vault.rglob("*.md"):
        parts = path.relative_to(vault).parts
        if any(part in IGNORED_DIRECTORIES for part in parts):
            continue
        yield path


def find_run_notes(vault: Path, run_id: str) -> tuple[Path | None, dict[str, Path]]:
    source: Path | None = None
    cards: dict[str, Path] = {}
    for path in markdown_notes(vault):
        content = read_text(path)
        if scalar_value(content, "organized_run_id") != run_id:
            continue
        card_id = scalar_value(content, "organized_card_id")
        if scalar_value(content, "type") == "source":
            source = path
        elif card_id:
            cards[card_id] = path
    return source, cards


def unique_markdown_path(directory: Path, title: str) -> Path:
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", title).strip(" .")[:100] or "知识卡片"
    candidate = directory / f"{safe}.md"
    counter = 2
    while candidate.exists():
        candidate = directory / f"{safe} ({counter}).md"
        counter += 1
    return candidate


def wiki_link(path: Path, vault: Path, label: str | None = None) -> str:
    relative = path.relative_to(vault).with_suffix("").as_posix().replace("]", "")
    safe_label = str(label or path.stem).replace("]", "").replace("|", "-")
    return f"[[{relative}|{safe_label}]]"


def relationship_link_resolver(vault: Path):
    exact: dict[str, Path] = {}
    stems: dict[str, list[Path]] = {}
    for path in markdown_notes(vault):
        relative = path.relative_to(vault).as_posix()
        exact[relative.casefold()] = path
        exact[Path(relative).with_suffix("").as_posix().casefold()] = path
        stems.setdefault(path.stem.casefold(), []).append(path)

    def resolve(current_path: Path, value: str) -> str:
        match = re.fullmatch(r"\[\[(?P<target>[^\]|]+)(?:\|(?P<label>[^\]]+))?\]\]", value.strip())
        if match is None:
            return value
        target = match.group("target").split("#", 1)[0].strip().replace("\\", "/")
        label = (match.group("label") or "").strip()
        candidates = [target.lstrip("/")]
        if not target.startswith("/"):
            current_relative = current_path.parent.relative_to(vault).as_posix()
            candidates.insert(0, f"{current_relative}/{target}".lstrip("./"))
        resolved: Path | None = None
        for candidate in candidates:
            normalized = Path(candidate).as_posix()
            resolved = exact.get(normalized.casefold()) or exact.get(
                Path(normalized).with_suffix("").as_posix().casefold()
            )
            if resolved is not None:
                break
        if resolved is None:
            matches = stems.get(Path(target).stem.casefold(), [])
            if len(matches) == 1:
                resolved = matches[0]
        return wiki_link(resolved, vault, label or resolved.stem) if resolved else value

    return resolve


def validate_route(route: object) -> str | None:
    if not isinstance(route, str) or not route.strip():
        return "route_to 不能为空"
    parts = re.split(r"[\\/]+", route.strip())
    if parts[0] not in CARD_ROUTE_ROOTS:
        return "route_to 只能进入 02_Domains 至 05_Skills"
    if any(part in {"", ".", ".."} for part in parts):
        return "route_to 含不安全路径片段"
    return None


def validate_manifest(manifest: dict, vault: Path) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version 必须为 {SCHEMA_VERSION}")
    run_id = manifest.get("run_id")
    try:
        uuid.UUID(str(run_id))
    except (ValueError, TypeError, AttributeError):
        errors.append("run_id 不是有效 UUID")

    source = manifest.get("source")
    source_path: Path | None = None
    if not isinstance(source, dict) or not isinstance(source.get("path"), str):
        errors.append("source.path 缺失")
    else:
        try:
            source_path = ensure_inside(vault / source["path"], vault / "01_Inbox", "来源笔记")
            if not source_path.is_file():
                routed_source, _ = find_run_notes(vault, str(run_id))
                source_path = routed_source
            if source_path is None or not source_path.is_file():
                errors.append("来源笔记不存在")
            elif semantic_source_hash(read_text(source_path)) != source.get("sha256"):
                errors.append("来源内容在 prepare 后发生变化")
        except OrganizeError as error:
            errors.append(str(error))

    mode = manifest.get("mode")
    if mode not in {"custom", "recommend"}:
        errors.append("mode 必须是 custom 或 recommend")
    cards = manifest.get("cards")
    if not isinstance(cards, list):
        errors.append("cards 必须是数组")
        return errors
    if mode == "custom" and manifest.get("expected_card_count") != len(cards):
        errors.append("custom 的 expected_card_count 与 cards 数量不一致")
    if not cards and mode == "recommend" and not str(manifest.get("skip_reason") or "").strip():
        errors.append("recommend 生成 0 张卡时必须填写 skip_reason")

    section_ids = {
        item.get("id") for item in manifest.get("sections", []) if isinstance(item, dict)
    }
    titles: set[str] = set()
    conclusions: dict[str, int] = {}
    questions: dict[str, int] = {}
    for index, card in enumerate(cards, 1):
        prefix = f"cards[{index - 1}]"
        if not isinstance(card, dict):
            errors.append(f"{prefix} 必须是对象")
            continue
        title = str(card.get("title") or "").strip()
        title_key = comparison_key(title)
        if not title:
            errors.append(f"{prefix}.title 不能为空")
        elif title_key in titles:
            errors.append(f"{prefix}.title 与其他卡片重复或仅标点不同")
        else:
            titles.add(title_key)
        kind = str(card.get("knowledge_kind") or "").strip()
        if kind not in {"concept", "procedure"}:
            errors.append(f"{prefix}.knowledge_kind 必须是 concept 或 procedure")
        for key in ("triggers", "use_when", "do_not_use_when", "match_questions", "includes", "excludes"):
            value = card.get(key)
            if not isinstance(value, list) or not any(str(item).strip() for item in value):
                errors.append(f"{prefix}.{key} 必须包含至少一项")
                continue
            items = string_list(value)
            item_keys = [comparison_key(item) for item in items]
            if len(item_keys) != len(set(item_keys)):
                errors.append(f"{prefix}.{key} 含重复或仅标点不同的条目")
            if any("\n" in item or "\r" in item for item in items):
                errors.append(f"{prefix}.{key} 每一项必须是单行短语")
        for key in ("use_when", "do_not_use_when"):
            if any(OPERATIONAL_BOUNDARY_PATTERN.search(item) for item in string_list(card.get(key))):
                errors.append(f"{prefix}.{key} 只能描述检索场景，不能写操作步骤、命令或警告")
        aliases = string_list(card.get("aliases"))
        alias_keys = [comparison_key(item) for item in aliases]
        if len(alias_keys) != len(set(alias_keys)):
            errors.append(f"{prefix}.aliases 含重复别名")
        if title_key and title_key in alias_keys:
            errors.append(f"{prefix}.aliases 不应重复 title")
        use_keys = {comparison_key(item) for item in string_list(card.get("use_when"))}
        avoid_keys = {comparison_key(item) for item in string_list(card.get("do_not_use_when"))}
        if (use_keys & avoid_keys) - {""}:
            errors.append(f"{prefix}.use_when 与 do_not_use_when 不能包含相同条件")
        include_keys = {comparison_key(item) for item in string_list(card.get("includes"))}
        exclude_keys = {comparison_key(item) for item in string_list(card.get("excludes"))}
        if (include_keys & exclude_keys) - {""}:
            errors.append(f"{prefix}.includes 与 excludes 不能包含相同范围")
        for question in string_list(card.get("match_questions")):
            question_key = comparison_key(question)
            if not question_key:
                continue
            owner = questions.get(question_key)
            if owner is not None:
                errors.append(f"{prefix}.match_questions 与 cards[{owner}] 重复，可能不是独立原子卡")
            else:
                questions[question_key] = index - 1
        for reference in string_list(card.get("related_ids")):
            match = CARD_REFERENCE_PATTERN.fullmatch(reference)
            if match is None:
                errors.append(f"{prefix}.related 必须使用同批卡片 ID，如 C002")
                continue
            target_number = int(match.group("number"))
            canonical = f"C{target_number:03d}"
            if reference != canonical:
                errors.append(f"{prefix}.related 卡片 ID 必须写成 {canonical}")
            elif target_number == index:
                errors.append(f"{prefix}.related 不能引用自身")
            elif not 1 <= target_number <= len(cards):
                errors.append(f"{prefix}.related 引用了不存在的同批卡片：{reference}")
        for key in ("route_reason",):
            if not str(card.get(key) or "").strip():
                errors.append(f"{prefix}.{key} 不能为空")
        route_error = validate_route(card.get("route_to"))
        if route_error:
            errors.append(f"{prefix}.{route_error}")
        try:
            confidence = float(card.get("route_confidence"))
            if not 0 <= confidence <= 1:
                raise ValueError
        except (TypeError, ValueError):
            errors.append(f"{prefix}.route_confidence 必须在 0 到 1 之间")
        evidence = card.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{prefix}.evidence 必须引用至少一个来源片段")
        else:
            unknown = [item for item in evidence if item not in section_ids]
            if unknown:
                errors.append(f"{prefix}.evidence 含未知片段：{', '.join(map(str, unknown))}")
        content = card.get("content")
        if not isinstance(content, dict):
            errors.append(f"{prefix}.content 必须是对象")
        else:
            conclusion = str(content.get("conclusion") or "").strip()
            explanation = str(content.get("explanation") or "").strip()
            method = str(content.get("method") or "").strip()
            if not conclusion:
                errors.append(f"{prefix}.content.conclusion 不能为空")
            else:
                conclusion_key = comparison_key(conclusion)
                owner = conclusions.get(conclusion_key)
                if owner is not None:
                    errors.append(f"{prefix}.content.conclusion 与 cards[{owner}] 重复，应合并或明确不同边界")
                else:
                    conclusions[conclusion_key] = index - 1
            if not explanation and not method:
                errors.append(f"{prefix}.content 至少填写 explanation 或 method")
            elif kind == "concept" and not explanation:
                errors.append(f"{prefix}.content.explanation 是 concept 的必填正文")
            elif kind == "procedure" and not method:
                errors.append(f"{prefix}.content.method 是 procedure 的必填完整流程")
            serialized = json.dumps(content, ensure_ascii=False)
            for attachment in WIKI_ATTACHMENT_PATTERN.findall(serialized):
                candidate = ensure_inside(vault / attachment, vault / "07_Attachments", "附件")
                if not candidate.is_file():
                    errors.append(f"{prefix} 引用了不存在的附件：{attachment}")
    return errors


def description_for(card: dict) -> str:
    use = "；".join(compact_text(item) for item in card["use_when"] if compact_text(item))
    includes = "、".join(compact_text(item) for item in card["includes"] if compact_text(item))
    excludes = "、".join(compact_text(item) for item in card["excludes"] if compact_text(item))
    return f"当用户需要{use}时使用。包含{includes}；不包含{excludes}。"


def resolved_related(card: dict, manifest: dict) -> list[str]:
    related = string_list(card.get("related"))
    cards = manifest.get("cards", [])
    for reference in string_list(card.get("related_ids")):
        match = CARD_REFERENCE_PATTERN.fullmatch(reference)
        if match is None:
            continue
        target_index = int(match.group("number")) - 1
        if not 0 <= target_index < len(cards) or not isinstance(cards[target_index], dict):
            continue
        title = str(cards[target_index].get("title") or "").replace("]", "").replace("|", "-").strip()
        if title:
            related.append(f"[[{title}]]")
    return list(dict.fromkeys(related))


def manifest_source_link(manifest: dict) -> str:
    source = manifest.get("source") or {}
    source_path = Path(str(source.get("path") or "来源笔记.md")).with_suffix("").as_posix()
    source_title = str(source.get("title") or Path(source_path).name)
    safe_title = source_title.replace("]", "").replace("|", "-").strip()
    return f"[[{source_path.replace(']', '')}|{safe_title}]]"


def synchronize_relationship_section(content: str) -> str:
    source_notes = frontmatter_values(content, "source_notes")
    parent_values = frontmatter_values(content, "parent_index")
    parent_index = parent_values[0] if parent_values else ""
    related = [item for item in frontmatter_values(content, "related") if item != parent_index]
    _, body = split_frontmatter(content)
    bounds = level_two_section(body, "来源与关联")
    preserved: list[str] = []
    if bounds is not None:
        section = body[bounds[0]:bounds[1]]
        for line in section.splitlines()[1:]:
            stripped = line.strip()
            if not stripped:
                continue
            if any(
                stripped.startswith(prefix)
                for prefix in ("- 来源笔记：", "- 所属索引：", "- 相关知识：")
            ):
                continue
            preserved.append(line.rstrip())

    lines: list[str] = []
    if source_notes:
        lines.append(f"- 来源笔记：{'、'.join(source_notes)}")
    lines.extend(preserved)
    if parent_index:
        lines.append(f"- 所属索引：{parent_index}")
    if related:
        lines.append(f"- 相关知识：{'、'.join(related)}")
    if not lines:
        return content
    return replace_level_two_section(content, "来源与关联", lines)


def render_card(card: dict, manifest: dict, card_id: str) -> str:
    now = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    confidence = float(card["route_confidence"])
    status = "ready" if confidence >= CONFIDENCE_THRESHOLD else "needs-review"
    route = str(card["route_to"]).replace("\\", "/").rstrip("/")
    package_title = route.split("/")[-1].split("_", 1)[-1]
    source_link = manifest_source_link(manifest)
    related = resolved_related(card, manifest)
    fields: list[str] = [
        "---",
        f"title: {yaml_quote(card['title'])}",
        f"created: {yaml_quote(now)}",
        f"updated: {yaml_quote(now)}",
        "source: ai-extraction",
        "type: knowledge-skill",
        f"knowledge_kind: {yaml_quote(card.get('knowledge_kind') or 'concept')}",
        f"status: {status}",
        "description: >",
        f"  {description_for(card)}",
    ]
    for key in ("aliases", "triggers", "use_when", "do_not_use_when", "match_questions"):
        fields.extend(render_yaml_field(key, card.get(key, [])))
    fields.extend(
        [
            "domain: []",
            "project:",
            "maturity: growing",
            "retrieval_priority: normal",
            f"parent_index: {yaml_quote(f'[[{route}/_Index|{package_title}]]')}",
        ]
    )
    fields.extend(render_yaml_field("source_notes", [source_link]))
    fields.extend(
        [
            f"route_to: {yaml_quote(route)}",
            f"route_confidence: {confidence:g}",
            f"route_reason: {yaml_quote(card['route_reason'])}",
            "review_after:",
            "tags: []",
        ]
    )
    fields.extend(render_yaml_field("related", related))
    fields.extend(
        [
            f"organized_run_id: {yaml_quote(manifest['run_id'])}",
            f"organized_card_id: {yaml_quote(card_id)}",
        ]
    )
    fields.extend(render_yaml_field("source_evidence", card["evidence"]))
    fields.append("---")

    content = card["content"]
    section_map = (
        ("一句话结论", "conclusion"),
        ("解决什么问题", "problem"),
        ("原理与解释", "explanation"),
        ("适用条件", "conditions"),
        ("实施方法", "method"),
        ("示例", "example"),
        ("限制与风险", "limitations"),
    )
    body = [f"# {card['title']}"]
    for heading, key in section_map:
        value = str(content.get(key) or "").strip()
        if value:
            body.extend(["", f"## {heading}", "", value])
    evidence = "、".join(card["evidence"])
    body.extend(
        [
            "",
            "## 来源与关联",
            "",
            f"- 来源笔记：{source_link}",
            f"- 来源片段：{evidence}",
            f"- 所属索引：[[{route}/_Index|{package_title}]]",
        ]
    )
    if related:
        body.append(f"- 相关知识：{'、'.join(related)}")
    rendered = "\n".join(fields + [""] + body).rstrip() + "\n"
    return synchronize_relationship_section(rendered)


def update_card_source_link(card_path: Path, source_path: Path, vault: Path, source_title: str) -> bool:
    content = read_text(card_path)
    safe_title = source_title.replace("]", "").replace("|", "-")
    source_link = wiki_link(source_path, vault, safe_title)
    updated = set_frontmatter_fields(content, {"source_notes": [source_link]})
    updated = synchronize_relationship_section(updated)
    if updated == content:
        return False
    write_atomic(card_path, updated)
    return True


def update_card_related_links(
    card_path: Path,
    card: dict,
    manifest: dict,
    card_paths: list[Path],
    vault: Path,
) -> bool:
    related = string_list(card.get("related"))
    cards = manifest.get("cards", [])
    for reference in string_list(card.get("related_ids")):
        match = CARD_REFERENCE_PATTERN.fullmatch(reference)
        if match is None:
            continue
        target_index = int(match.group("number")) - 1
        if not 0 <= target_index < len(card_paths):
            continue
        target_card = cards[target_index] if target_index < len(cards) else {}
        title = str(target_card.get("title") or card_paths[target_index].stem)
        related.append(wiki_link(card_paths[target_index], vault, title))
    related = list(dict.fromkeys(related))
    content = read_text(card_path)
    updated = set_frontmatter_fields(content, {"related": related})
    updated = synchronize_relationship_section(updated)
    if updated == content:
        return False
    write_atomic(card_path, updated)
    return True


def run_router(vault: Path, notes: list[Path], manifest_path: Path, apply_changes: bool) -> dict:
    if not notes:
        return {"status": "skipped", "stdout": ""}
    router = vault / ".agents" / "scripts" / "knowledge_router.py"
    if not router.is_file():
        raise OrganizeError(f"找不到路由脚本：{router}")
    notes_path = manifest_path.with_name(
        f"{manifest_path.stem}-{'apply' if apply_changes else 'preview'}-notes.json"
    )
    notes_path.write_text(
        json.dumps({"notes": [vault_relative(path, vault) for path in notes]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    command = [
        sys.executable,
        str(router),
        "--vault-root",
        str(vault),
        "--notes-file",
        str(notes_path),
        "--strict",
    ]
    if apply_changes:
        command.append("--apply")
    child_environment = os.environ.copy()
    child_environment["PYTHONIOENCODING"] = "utf-8"
    child_environment["PYTHONUTF8"] = "1"
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=child_environment,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "无路由器输出").strip()
        raise OrganizeError(f"定向路由失败：{detail}")
    return {"status": "ok", "stdout": result.stdout.strip()}


def ensure_bullet_section(path: Path, heading: str, bullets: list[str]) -> None:
    if not path.is_file():
        return
    content = read_text(path)
    missing = [bullet for bullet in bullets if bullet not in content]
    if not missing:
        return
    yaml_text, body = split_frontmatter(content)
    pattern = re.compile(rf"(?m)^##\s+{re.escape(heading)}\s*$")
    match = pattern.search(body)
    addition = "\n".join(f"- {item}" for item in missing)
    if match:
        next_heading = re.search(r"(?m)^##\s+", body[match.end():])
        end = match.end() + (next_heading.start() if next_heading else len(body[match.end():]))
        section = body[match.start():end].rstrip() + "\n" + addition + "\n\n"
        body = body[:match.start()] + section + body[end:].lstrip("\r\n")
    else:
        body = body.rstrip() + f"\n\n## {heading}\n\n{addition}\n"
    updated = f"---\n{yaml_text.rstrip()}\n---\n\n{body.rstrip()}\n"
    updated = set_frontmatter_fields(
        updated,
        {"updated": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")},
    )
    write_atomic(path, updated)


def level_two_section(body: str, heading: str) -> tuple[int, int] | None:
    pattern = re.compile(rf"(?m)^##\s+{re.escape(heading)}\s*$")
    match = pattern.search(body)
    if match is None:
        return None
    next_heading = re.search(r"(?m)^##\s+", body[match.end():])
    end = match.end() + (next_heading.start() if next_heading else len(body[match.end():]))
    return match.start(), end


def wiki_target(link: str) -> str | None:
    match = re.fullmatch(r"\[\[(?P<target>[^\]|]+)(?:\|[^\]]+)?\]\]", link.strip())
    return match.group("target") if match else None


def automatic_registrations(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    _, body = split_frontmatter(read_text(path))
    bounds = level_two_section(body, "自动登记的知识包")
    if bounds is None:
        return []
    section = body[bounds[0]:bounds[1]]
    registrations: list[dict[str, str]] = []
    pattern = re.compile(
        r"(?m)^-\s+(?P<link>\[\[(?P<target>[^\]|]+)(?:\|[^\]]+)?\]\])"
        r"(?:：(?P<description>.*))?\s*$"
    )
    for match in pattern.finditer(section):
        registrations.append(
            {
                "link": match.group("link"),
                "target": match.group("target"),
                "description": compact_text(match.group("description") or ""),
            }
        )
    return registrations


def remove_automatic_registration(path: Path) -> None:
    if not path.is_file():
        return
    content = read_text(path)
    yaml_text, body = split_frontmatter(content)
    cleaned = remove_level_two_section(body, "自动登记的知识包")
    if cleaned == body.rstrip():
        return
    updated = f"---\n{yaml_text.rstrip()}\n---\n\n{cleaned.rstrip()}\n"
    updated = set_frontmatter_fields(
        updated,
        {"updated": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")},
    )
    write_atomic(path, updated)


def remove_empty_catalog_copy(body: str, *, root_index: bool) -> str:
    if root_index:
        cleaned = re.sub(
            r"(?m)^此模板尚无用户知识。创建主题 `_Index\.md` 后，在对应表格中增加一行。"
            r"AI 应先匹配“什么时候使用”，再检查“不适用场景”，不能只依赖关键词。\s*",
            "",
            body,
            count=1,
        )
    else:
        cleaned = re.sub(
            r"(?ms)^当前为空。[^\r\n]*\r?\n\s*```text\s*\r?\n.*?\r?\n```\s*\r?\n\s*"
            r"创建后将知识包加入本页和根目录 \[\[知识路由索引\]\]。\s*",
            "",
            body,
            count=1,
        )
        cleaned = re.sub(r"(?m)^当前没有资源知识包。\s*$", "", cleaned, count=1)
    return re.sub(r"\n{3,}", "\n\n", cleaned).lstrip("\r\n")


def ensure_package_table_row(
    path: Path,
    heading: str,
    link: str,
    description: str,
    *,
    root_index: bool = False,
) -> None:
    if not path.is_file():
        return
    content = read_text(path)
    yaml_text, body = split_frontmatter(content)
    body = remove_empty_catalog_copy(body, root_index=root_index)
    bounds = level_two_section(body, heading)
    row = f"| {link} | {compact_text(description).replace('|', '\\|')} |"
    target = wiki_target(link)

    if bounds is None:
        table = "\n".join(
            [
                f"## {heading}",
                "",
                "| 知识包 | 什么时候使用 |",
                "|---|---|",
                row,
            ]
        )
        body = body.rstrip() + "\n\n" + table + "\n"
    else:
        start, end = bounds
        section = body[start:end]
        target_pattern = re.compile(
            rf"(?m)^\|\s*\[\[{re.escape(target or '')}(?:\|[^\]]+)?\]\]\s*\|"
        )
        if target is None or target_pattern.search(section) is None:
            lines = section.rstrip().splitlines()
            lines = [line for line in lines if not re.match(r"^\|\s*暂无\s*\|", line)]
            header_index = next(
                (index for index, line in enumerate(lines) if re.match(r"^\|\s*知识包\s*\|", line)),
                None,
            )
            if header_index is None:
                lines.extend(["", "| 知识包 | 什么时候使用 |", "|---|---|", row])
            else:
                insert_at = header_index + 1
                while insert_at < len(lines) and lines[insert_at].lstrip().startswith("|"):
                    insert_at += 1
                lines.insert(insert_at, row)
            section = "\n".join(lines).rstrip() + "\n\n"
            body = body[:start] + section + body[end:].lstrip("\r\n")

    body = re.sub(r"(?m)^(#{1,6}\s+.+)\n(?=\S)", r"\1\n\n", body)
    body = re.sub(r"(?m)^(\|.*\|)\n(?=##\s+)", r"\1\n\n", body)
    updated = f"---\n{yaml_text.rstrip()}\n---\n\n{body.rstrip()}\n"
    updated = set_frontmatter_fields(
        updated,
        {"updated": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")},
    )
    if updated != content:
        write_atomic(path, updated)


def register_indexes(vault: Path, card_paths: list[Path], manifest: dict) -> None:
    by_directory: dict[Path, list[Path]] = {}
    for path in card_paths:
        relative = path.relative_to(vault)
        if relative.parts[0] not in CARD_ROUTE_ROOTS:
            continue
        by_directory.setdefault(path.parent, []).append(path)

    for directory, paths in by_directory.items():
        index = directory / "_Index.md"
        bullets = [wiki_link(path, vault, path.stem) for path in sorted(paths)]
        ensure_bullet_section(index, "本目录文档", bullets)

        relative_dir = directory.relative_to(vault)
        if len(relative_dir.parts) > 2:
            parent_package = vault.joinpath(*relative_dir.parts[:2]) / "_Index.md"
            ensure_bullet_section(
                parent_package,
                "相关知识包",
                [wiki_link(index, vault, directory.name.split("_", 1)[-1])],
            )

    root_index = vault / "知识路由索引.md"
    registrations: dict[str, dict[str, str]] = {}
    for item in automatic_registrations(root_index):
        registrations[item["target"]] = item
    for root_name, (index_name, _) in CATEGORY_INDEX_CONFIG.items():
        for item in automatic_registrations(vault / root_name / index_name):
            registrations.setdefault(item["target"], item)

    first_level: dict[Path, dict] = {}
    for card, path in zip(manifest.get("cards", []), card_paths):
        relative = path.relative_to(vault)
        if relative.parts[0] not in CARD_ROUTE_ROOTS or len(relative.parts) < 2:
            continue
        directory = vault / relative.parts[0] / relative.parts[1]
        first_level.setdefault(directory, card)

    for directory, card in first_level.items():
        index = directory / "_Index.md"
        label = directory.name.split("_", 1)[-1]
        link = wiki_link(index, vault, label)
        use_when = str((card.get("use_when") or [label])[0])
        target = wiki_target(link)
        if target:
            registrations[target] = {
                "link": link,
                "target": target,
                "description": compact_text(use_when),
            }

    for registration in registrations.values():
        target = registration["target"]
        root_name = target.split("/", 1)[0]
        config = CATEGORY_INDEX_CONFIG.get(root_name)
        if config is None:
            continue
        index_name, root_heading = config
        package_index = vault / f"{target}.md"
        description = registration["description"] or f"浏览 {package_index.parent.name.split('_', 1)[-1]} 知识时"
        if package_index.is_file() and scalar_value(read_text(package_index), "status") == "needs-review":
            if not description.startswith("待完善："):
                description = f"待完善：{description}"
        ensure_package_table_row(
            vault / root_name / index_name,
            "知识包",
            registration["link"],
            description,
        )
        ensure_package_table_row(
            root_index,
            root_heading,
            registration["link"],
            description,
            root_index=True,
        )

    remove_automatic_registration(root_index)
    for root_name, (index_name, _) in CATEGORY_INDEX_CONFIG.items():
        remove_automatic_registration(vault / root_name / index_name)


def update_source(
    source_path: Path,
    manifest: dict,
    vault: Path,
    card_paths: list[Path],
    all_routed: bool,
) -> Path:
    content = read_text(source_path)
    links = [wiki_link(path, vault, path.stem) for path in card_paths]
    section_lines = [f"- {link}" for link in links]
    if not links:
        section_lines = [f"- 未生成卡片：{manifest.get('skip_reason', '无可复用知识')}"]
    content = replace_level_two_section(content, "已提炼知识", section_lines)
    fields: dict[str, object] = {
        "updated": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M"),
        "organized_source_sha256": manifest["source"]["sha256"],
        "organizer_schema_version": SCHEMA_VERSION,
        "organized_run_id": manifest["run_id"],
        "organized_cards": links,
    }
    if all_routed:
        fields.update(
            {
                "status": "ready",
                "route_to": manifest.get("source_archive_route") or "06_Archive/来源资料",
                "route_confidence": 1.0,
                "route_reason": "本轮原子卡片已全部生成、验证并完成路由",
            }
        )
    else:
        fields.update(
            {
                "status": "inbox",
                "route_to": "",
                "route_confidence": "",
                "route_reason": "存在 needs-review 卡片，来源继续留在 Inbox",
            }
        )
    content = set_frontmatter_fields(content, fields)
    write_atomic(source_path, content)
    return source_path


def verify_run(manifest: dict, vault: Path) -> dict:
    source, found_cards = find_run_notes(vault, str(manifest["run_id"]))
    expected = {f"C{index:03d}" for index in range(1, len(manifest.get("cards", [])) + 1)}
    errors: list[str] = []
    if set(found_cards) != expected:
        errors.append(
            f"卡片集合不一致：expected={sorted(expected)}, actual={sorted(found_cards)}"
        )
    ordered_paths: list[Path] = []
    for index, card in enumerate(manifest.get("cards", []), 1):
        card_id = f"C{index:03d}"
        path = found_cards.get(card_id)
        if path is None:
            continue
        ordered_paths.append(path)
        content = read_text(path)
        confidence = float(card["route_confidence"])
        relative = path.relative_to(vault)
        if confidence >= CONFIDENCE_THRESHOLD:
            if relative.parts[0] not in CARD_ROUTE_ROOTS or scalar_value(content, "status") != "processed":
                errors.append(f"高置信卡未完成路由：{relative.as_posix()}")
        elif relative.parts[0] != "01_Inbox" or scalar_value(content, "status") != "needs-review":
            errors.append(f"低置信卡未留在 Inbox：{relative.as_posix()}")
        for attachment in WIKI_ATTACHMENT_PATTERN.findall(content):
            if not (vault / attachment).is_file():
                errors.append(f"卡片附件不存在：{attachment}")

    all_high = all(
        float(card["route_confidence"]) >= CONFIDENCE_THRESHOLD
        for card in manifest.get("cards", [])
    )
    if source is None:
        errors.append("找不到带 organized_run_id 的来源笔记")
    else:
        relative_source = source.relative_to(vault)
        if all_high and relative_source.parts[0] != "06_Archive":
            errors.append("全部卡片成功后来源未归档")
        if not all_high and relative_source.parts[0] != "01_Inbox":
            errors.append("存在待审卡时来源不应归档")
        source_content = read_text(source)
        for path in ordered_paths:
            if path.stem not in source_content:
                errors.append(f"来源缺少卡片反链：{path.stem}")
    return {
        "status": "ok" if not errors else "error",
        "run_id": manifest["run_id"],
        "source": vault_relative(source, vault) if source else None,
        "cards": [vault_relative(path, vault) for path in ordered_paths],
        "errors": errors,
    }


def prepare_manifest(args: argparse.Namespace) -> int:
    vault = Path(args.vault_root).expanduser().resolve()
    source_input = Path(args.source).expanduser()
    if not source_input.is_absolute():
        source_input = vault / source_input
    source = ensure_inside(source_input, vault / "01_Inbox", "来源笔记")
    if not source.is_file() or source.suffix.lower() != ".md" or source.stem.startswith("_"):
        raise OrganizeError("来源必须是 01_Inbox 中非下划线开头的 Markdown 文件。")
    content = read_text(source)
    source_hash = semantic_source_hash(content)
    existing_hash = scalar_value(content, "organized_source_sha256")
    existing_cards = scalar_value(content, "organized_cards")
    if existing_hash == source_hash:
        print(json.dumps({
            "status": "already-organized",
            "source": vault_relative(source, vault),
            "organized_cards": existing_cards,
        }, ensure_ascii=False))
        return 0
    title = scalar_value(content, "title") or source.stem
    run_id = str(uuid.uuid4())
    output = Path(args.output).expanduser() if args.output else Path(
        tempfile.mkdtemp(prefix="knowledge-organize-")
    ) / "manifest.json"
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "mode": args.mode,
        "expected_card_count": None,
        "skip_reason": "",
        "source_archive_route": "06_Archive/来源资料",
        "source": {
            "path": vault_relative(source, vault),
            "title": title,
            "sha256": source_hash,
        },
        "sections": source_sections(content),
        "cards": [],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    cards_path = output.with_name("cards.json")
    print(json.dumps({
        "status": "prepared",
        "manifest": str(output.resolve()),
        "cards_file": str(cards_path.resolve()),
        "source": manifest["source"],
        "section_count": len(manifest["sections"]),
    }, ensure_ascii=False))
    print("CARD CONTRACT: cards_file does not exist; create it once with compact JSON. Do not read cards_file; do not create a builder or read references.")
    print('For custom add "expected": N; for a zero-card recommendation add "skip_reason". Otherwise write:')
    print('{"cards":[{')
    print('"title":"...","kind":"concept|procedure","evidence":["S001"],')
    print('"route":"05_Skills/...","confidence":0.9,"reason":"...",')
    print('"triggers":["..."],"use":["..."],"avoid":["..."],"questions":["..."],')
    print('"includes":["content in scope"],"excludes":["content outside scope"],')
    print('"conclusion":"...","body":"Markdown details","limits":"..."}]}' )
    print("YAML SEMANTICS: use/avoid are positive/negative retrieval situations, never workflow steps or warnings; includes/excludes are content scope.")
    print("ROUTE PRIORITY: write semantic folder labels without guessed numeric prefixes. Before applying that judgment, the router searches every valid existing folder under 02_Domains through 05_Skills; one strong filename/title match against the folder name or its _Index title/aliases/triggers wins across roots. If no unique high-confidence match exists, follow the semantic route and only then allocate the next strict two-digit sequence. Never override 06_Archive source archival.")
    print("QUALITY GATE: silently verify one stable question per card, evidence-supported claims, distinct boundaries, complete retrieval fields, no duplicates, and direct same-run relationships.")
    print('For a direct sibling relation (workflow-exception, concept-application, prerequisite-result), add "related":["C002"]; one direction is enough and apply makes it reciprocal. Do not link merely because cards share keywords.')
    print("Optional per card: aliases. For SOP, kind=procedure; keep one complete workflow, its inputs, ordered steps, parameters, verification, exceptions, and each real image with its step.")
    print("=== SOURCE WITH EVIDENCE IDS ===")
    print(annotated_source(content, manifest["sections"]))
    print("=== END SOURCE ===")
    return 0


def load_manifest(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise OrganizeError(f"无法读取 manifest：{error}") from error
    if not isinstance(payload, dict):
        raise OrganizeError("manifest 顶层必须是 JSON 对象。")
    return payload


def load_json_value(path: Path, label: str) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise OrganizeError(f"无法读取 {label}：{error}") from error


def cleanup_artifacts(manifest_path: Path, cards_path: Path | None = None) -> None:
    for path in manifest_path.parent.glob(f"{manifest_path.stem}*-notes.json"):
        path.unlink(missing_ok=True)
    if cards_path is not None:
        cards_path.unlink(missing_ok=True)
    manifest_path.unlink(missing_ok=True)
    try:
        manifest_path.parent.rmdir()
    except OSError:
        pass


def validate_command(args: argparse.Namespace) -> int:
    vault = Path(args.vault_root).expanduser().resolve()
    manifest = normalize_manifest(load_manifest(Path(args.manifest)))
    errors = validate_manifest(manifest, vault)
    print(json.dumps({"status": "ok" if not errors else "error", "errors": errors}, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def apply_manifest(args: argparse.Namespace) -> int:
    vault = Path(args.vault_root).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()
    manifest = normalize_manifest(load_manifest(manifest_path))
    cards_path: Path | None = None
    if args.cards:
        cards_path = Path(args.cards).expanduser().resolve()
        manifest = merge_cards_payload(manifest, load_json_value(cards_path, "cards 文件"))
    errors = validate_manifest(manifest, vault)
    if errors:
        print(json.dumps({"status": "error", "errors": errors}, ensure_ascii=False, indent=2))
        return 1
    write_atomic(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    run_id = str(manifest.get("run_id"))
    existing_source, existing_cards = find_run_notes(vault, run_id)
    if existing_source is not None:
        if existing_source.parent == vault / "01_Inbox" and scalar_value(read_text(existing_source), "status") == "ready":
            run_router(vault, [existing_source], manifest_path, False)
            run_router(vault, [existing_source], manifest_path, True)
        current_source, current_cards = find_run_notes(vault, run_id)
        ordered_existing = [
            current_cards[f"C{index:03d}"]
            for index in range(1, len(manifest.get("cards", [])) + 1)
            if f"C{index:03d}" in current_cards
        ]
        if len(ordered_existing) == len(manifest.get("cards", [])):
            for path, card in zip(ordered_existing, manifest.get("cards", [])):
                update_card_related_links(path, card, manifest, ordered_existing, vault)
            if current_source is not None:
                source_title = scalar_value(read_text(current_source), "title") or str(manifest["source"]["title"])
                for path in ordered_existing:
                    update_card_source_link(path, current_source, vault, source_title)
        result = verify_run(manifest, vault)
        result["apply_status"] = "no-op" if result["status"] == "ok" else "resume-required"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.cleanup and result["status"] == "ok":
            cleanup_artifacts(manifest_path, cards_path)
        return 0 if result["status"] == "ok" else 1
    source_path = vault / manifest["source"]["path"]
    created_or_found: dict[str, Path] = dict(existing_cards)
    for index, card in enumerate(manifest.get("cards", []), 1):
        card_id = f"C{index:03d}"
        if card_id in created_or_found:
            continue
        path = unique_markdown_path(vault / "01_Inbox", str(card["title"]))
        write_atomic(path, render_card(card, manifest, card_id))
        created_or_found[card_id] = path

    ordered = [created_or_found[f"C{index:03d}"] for index in range(1, len(manifest.get("cards", [])) + 1)]
    high_confidence = [
        path
        for path, card in zip(ordered, manifest.get("cards", []))
        if float(card["route_confidence"]) >= CONFIDENCE_THRESHOLD
        and path.parent == vault / "01_Inbox"
    ]
    if high_confidence:
        run_router(vault, high_confidence, manifest_path, False)
        run_router(vault, high_confidence, manifest_path, True)

    _, routed_cards = find_run_notes(vault, run_id)
    final_paths = [routed_cards[f"C{index:03d}"] for index in range(1, len(ordered) + 1)]
    for path, card in zip(final_paths, manifest.get("cards", [])):
        update_card_related_links(path, card, manifest, final_paths, vault)
    register_indexes(vault, final_paths, manifest)
    all_routed = all(
        float(card["route_confidence"]) >= CONFIDENCE_THRESHOLD
        and path.relative_to(vault).parts[0] in CARD_ROUTE_ROOTS
        and scalar_value(read_text(path), "status") == "processed"
        for path, card in zip(final_paths, manifest.get("cards", []))
    )
    source_path = update_source(source_path, manifest, vault, final_paths, all_routed)
    if all_routed:
        run_router(vault, [source_path], manifest_path, False)
        run_router(vault, [source_path], manifest_path, True)

    final_source, final_cards = find_run_notes(vault, run_id)
    if final_source is not None:
        source_title = scalar_value(read_text(final_source), "title") or str(manifest["source"]["title"])
        for path in final_cards.values():
            update_card_source_link(path, final_source, vault, source_title)

    result = verify_run(manifest, vault)
    result["apply_status"] = "applied"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.cleanup and result["status"] == "ok":
        cleanup_artifacts(manifest_path, cards_path)
    return 0 if result["status"] == "ok" else 1


def verify_command(args: argparse.Namespace) -> int:
    vault = Path(args.vault_root).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()
    manifest = normalize_manifest(load_manifest(manifest_path))
    result = verify_run(manifest, vault)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.cleanup and result["status"] == "ok":
        cleanup_artifacts(manifest_path)
    return 0 if result["status"] == "ok" else 1


def repair_relationship_links(args: argparse.Namespace) -> int:
    vault = Path(args.vault_root).expanduser().resolve()
    resolve_link = relationship_link_resolver(vault)
    notes = list(markdown_notes(vault))
    sources_by_run: dict[str, Path] = {}
    for path in notes:
        content = read_text(path)
        run_id = scalar_value(content, "organized_run_id")
        if run_id and scalar_value(content, "type") == "source":
            sources_by_run[run_id] = path

    planned: list[str] = []
    missing_source_runs: set[str] = set()
    for path in notes:
        content = read_text(path)
        if scalar_value(content, "type") != "knowledge-skill":
            continue
        relative = path.relative_to(vault)
        if any("template" in part.casefold() for part in relative.parts):
            continue
        fields: dict[str, object] = {}
        run_id = scalar_value(content, "organized_run_id")
        source_notes = frontmatter_values(content, "source_notes")
        source = sources_by_run.get(run_id or "")
        if source is not None:
            source_title = scalar_value(read_text(source), "title") or source.stem
            fields["source_notes"] = [wiki_link(source, vault, source_title)]
        elif source_notes:
            fields["source_notes"] = [resolve_link(path, item) for item in source_notes]
            if run_id:
                missing_source_runs.add(run_id)

        parent_values = frontmatter_values(content, "parent_index")
        if parent_values:
            fields["parent_index"] = resolve_link(path, parent_values[0])
        related = frontmatter_values(content, "related")
        if related or "related:" in split_frontmatter(content)[0]:
            fields["related"] = [resolve_link(path, item) for item in related]

        updated = set_frontmatter_fields(content, fields) if fields else content
        updated = synchronize_relationship_section(updated)
        if updated == content:
            continue
        planned.append(vault_relative(path, vault))
        if args.apply:
            write_atomic(path, updated)

    print(json.dumps({
        "status": "applied" if args.apply else "preview",
        "planned": len(planned),
        "updated": len(planned) if args.apply else 0,
        "files": planned,
        "missing_source_runs": sorted(missing_source_runs),
    }, ensure_ascii=False, indent=2))
    return 0


def parse_args() -> argparse.Namespace:
    default_vault = Path(__file__).resolve().parents[4]
    parser = argparse.ArgumentParser(description="Batch-organize one Inbox source note.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser("prepare", help="Create a compact temporary manifest skeleton.")
    prepare.add_argument("source")
    prepare.add_argument("--vault-root", default=str(default_vault))
    prepare.add_argument("--mode", choices=("custom", "recommend"), required=True)
    prepare.add_argument("--output")
    prepare.set_defaults(handler=prepare_manifest)

    for name, handler in (("validate", validate_command), ("apply", apply_manifest), ("verify", verify_command)):
        command = subparsers.add_parser(name)
        command.add_argument("manifest")
        command.add_argument("--vault-root", default=str(default_vault))
        if name == "apply":
            command.add_argument("--cards", help="Compact model-produced cards JSON from prepare.")
            command.add_argument("--cleanup", action="store_true", help="Delete temporary inputs after a verified success.")
        if name == "verify":
            command.add_argument("--cleanup", action="store_true")
        command.set_defaults(handler=handler)
    repair = subparsers.add_parser(
        "repair-links",
        help="Normalize source/index/related links and mirror them into 来源与关联.",
    )
    repair.add_argument("--vault-root", default=str(default_vault))
    repair.add_argument("--apply", action="store_true")
    repair.set_defaults(handler=repair_relationship_links)
    return parser.parse_args()


def configure_standard_streams() -> None:
    """Emit deterministic UTF-8 even when Windows inherited a GBK code page."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="backslashreplace")


def main() -> int:
    configure_standard_streams()
    args = parse_args()
    try:
        return args.handler(args)
    except OrganizeError as error:
        print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    except Exception as error:  # pragma: no cover - final safety boundary for agent use
        print(json.dumps({"status": "error", "error": f"知识整理批处理失败：{error}"}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
