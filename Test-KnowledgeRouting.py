"""Routing regression tests in disposable Vaults; no model or network required."""

import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch


PRODUCT = Path(__file__).resolve().parent
TEMPLATE = PRODUCT / "vault-template"


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


organize = module_at("organize", TEMPLATE / ".dsh/skills/knowledge-organize/scripts/organize_batch.py")
router = module_at("router", TEMPLATE / ".agents/scripts/knowledge_router.py")


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="knowledge-routing-test-")
        self.root = Path(self.temp.name).resolve()
        # Cleanup is restricted to the task-specific directory from mkdtemp.
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith("knowledge-routing-test-"))
        self.addCleanup(self.temp.cleanup)
        self.vault = self.root / "vault"
        shutil.copytree(TEMPLATE, self.vault, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        self.number = 0

    def write(self, relative, text):
        path = self.vault / relative
        self.assertTrue(path.resolve().is_relative_to(self.vault))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def folder(self, relative, metadata=""):
        path = self.vault / relative
        path.mkdir(parents=True, exist_ok=True)
        if metadata:
            self.write(relative + "/_Index.md", "---\n" + metadata + "\n---\n# Index\n")
        return path

    def snapshot(self):
        return {p.relative_to(self.vault).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in self.vault.rglob("*") if p.is_file() and "__pycache__" not in p.parts}

    def prepare(self):
        self.number += 1
        source = self.write(f"01_Inbox/source-{self.number}.md",
                            f"---\ntitle: LLM article {self.number}\ntype: source\nstatus: inbox\n---\n"
                            "# Agent and ReAct\n\nReAct alternates reasoning and action. An agent reads tool feedback.\n"
                            "\n# React UI\n\nReact UI components are a separate frontend topic.\n")
        output = self.root / f"batch-{self.number}" / "manifest.json"
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            code = organize.prepare_manifest(argparse.Namespace(source=str(source), vault_root=str(self.vault),
                                                                 mode="recommend", output=str(output)))
        self.assertEqual(code, 0)
        prepared = json.loads(stream.getvalue().splitlines()[0])
        self.manifest_path = Path(prepared["manifest"])
        self.cards_path = Path(prepared["cards_file"])
        self.manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        return stream.getvalue()

    def card(self, title="Agent 的 ReAct 方法", route="03_Areas/LLM/Agent", confidence=0.95, kind="concept"):
        return dict(title=title, kind=kind, topic_path=["LLM", "Agent"], route=route, confidence=confidence,
                    reason="正文解决 Agent 如何交替推理和行动的问题，属于 LLM 下的 Agent 子主题。",
                    evidence=[self.manifest["sections"][0]["id"]], triggers=[title],
                    use=[f"理解{title}的使用场景"], avoid=["前端 React 组件渲染问题"],
                    questions=[f"{title}如何工作？"], includes=[title], excludes=["前端组件"],
                    conclusion=f"{title}依赖推理和行动的交替。", body=f"{title}利用工具反馈决定后续行动。",
                    limits="来源未提供效果评估数据。")

    def apply(self, cards, **settings):
        self.cards_path.write_text(json.dumps(dict(cards=cards, **settings), ensure_ascii=False), encoding="utf-8")
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            code = organize.apply_manifest(argparse.Namespace(manifest=str(self.manifest_path),
                                                               cards=str(self.cards_path), vault_root=str(self.vault),
                                                               cleanup=False))
        return code, json.loads(stream.getvalue())

    def test_prepare_supplies_scopes_aliases_and_limited_samples_without_note_bodies(self):
        self.folder("03_Areas/0301_LLM/030101_Agent", 'title: Agent\nstatus: evergreen\n'
                    'description: >\n  推理与行动\n  的智能体方法\naliases: [智能体, agent]\n'
                    'triggers:\n  - ReAct\nuse_when:\n  - 智能体工具反馈\ndo_not_use_when:\n  - 前端组件')
        self.write("03_Areas/0301_LLM/背景.md", "DO_NOT_READ_NEIGHBOUR_BODY")
        self.folder("02_Domains/Legacy")
        self.folder("06_Archive/0601_History")
        text = self.prepare()
        entries = {item["path"]: item for item in self.manifest["routing_context"]["directories"]}
        agent = entries["03_Areas/0301_LLM/030101_Agent"]
        self.assertEqual(agent["description"], "推理与行动 的智能体方法")
        self.assertEqual(agent["aliases"], ["智能体", "agent"])
        self.assertEqual(agent["do_not_use_when"], ["前端组件"])
        self.assertFalse(agent["limited_context"])
        self.assertEqual(entries["03_Areas/0301_LLM"]["sample_titles"], ["背景"])
        self.assertNotIn("DO_NOT_READ_NEIGHBOUR_BODY", text)
        self.assertNotIn("02_Domains/Legacy", entries)
        self.assertNotIn("06_Archive/0601_History", entries)
        self.assertIn("topic_path", text)
        self.assertIn("BEFORE writing cards_file", text)
        self.assertFalse(self.cards_path.exists())

    def test_llm_title_does_not_override_existing_agent_or_split_procedure(self):
        self.folder("02_Domains/0201_LLM", 'title: LLM\naliases: [Agent, ReAct]')
        agent = self.folder("03_Areas/0301_LLM/030101_Agent")
        self.prepare()
        cards = [self.card("LLM", "03_Areas/0301_LLM/030101_Agent"),
                 self.card("Agent 操作", "03_Areas/0301_LLM/030101_Agent", kind="procedure")]
        cards[0]["related"] = ["C002"]
        code, result = self.apply(cards)
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "ok", result)
        for relative in result["cards"]:
            path = self.vault / relative
            self.assertEqual(path.parent, agent)
            content = path.read_text(encoding="utf-8")
            self.assertIn("03_Areas/0301_LLM/030101_Agent/_Index", content)
            self.assertIn(result["source"].removesuffix(".md"), content)
        self.assertEqual(list((self.vault / "02_Domains/0201_LLM").glob("*.md")),
                         [self.vault / "02_Domains/0201_LLM/_Index.md"])
        self.assertEqual(len(result["routing"]), 2)
        before = self.snapshot()
        code, retry = self.apply(cards)
        self.assertEqual(retry["apply_status"], "no-op", retry)
        self.assertEqual(before, self.snapshot())

    def test_existing_parent_gets_numbered_agent_and_linked_indexes(self):
        self.folder("03_Areas/0301_LLM")
        self.prepare()
        code, result = self.apply([self.card(route="03_Areas/0301_LLM/Agent")])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["cards"][0].startswith("03_Areas/0301_LLM/030101_Agent/"))
        parent = (self.vault / "03_Areas/0301_LLM/_Index.md").read_text(encoding="utf-8")
        self.assertIn("03_Areas/0301_LLM/030101_Agent/_Index", parent)
        self.assertIn(result["cards"][0].removesuffix(".md"), parent)
        self.assertTrue(result["routing"][0]["created_directory"])

    def test_confirmed_new_topic_creates_hierarchy_and_is_remembered(self):
        self.prepare()
        code, result = self.apply([self.card()], route_preferences=[
            dict(topic="LLM", route="03_Areas/LLM", aliases=["大语言模型"], confirmed=True)])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["cards"][0].startswith("03_Areas/0301_LLM/030101_Agent/"))
        self.prepare()
        preferences = self.manifest["routing_context"]["preferences"]
        self.assertEqual(preferences[0]["route"], "03_Areas/0301_LLM")
        before = self.snapshot()
        card = self.card("另一张 Agent 卡", "02_Domains/LLM/Agent")
        card["topic_path"] = ["大语言模型", "Agent"]
        code, result = self.apply([card])
        self.assertEqual(code, 1, result)
        self.assertIn("已确认主题归属冲突", result["errors"][0])
        self.assertEqual(before, self.snapshot())
        card["route"] = "03_Areas/0301_LLM/030101_Agent"
        code, result = self.apply([card])
        self.assertEqual(code, 0, result)
        self.assertFalse((self.vault / "02_Domains/0201_LLM").exists())

    def test_preferences_require_explicit_confirmation(self):
        self.prepare()
        before = self.snapshot()
        code, result = self.apply([self.card()], route_preferences=[dict(topic="LLM", route="03_Areas/LLM")])
        self.assertEqual(code, 1, result)
        self.assertEqual(before, self.snapshot())

    def test_new_contract_requires_main_topic_and_legacy_manifest_still_works(self):
        self.prepare()
        card = self.card()
        del card["topic_path"]
        before = self.snapshot()
        code, result = self.apply([card])
        self.assertEqual(code, 1, result)
        self.assertTrue(any("topic_path" in error for error in result["errors"]))
        self.assertEqual(before, self.snapshot())
        del self.manifest["routing_context"]
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        code, result = self.apply([card])
        self.assertEqual(code, 0, result)

    def test_final_verification_detects_changed_route_metadata(self):
        self.prepare()
        code, result = self.apply([self.card()])
        self.assertEqual(code, 0, result)
        path = self.vault / result["cards"][0]
        content = path.read_text(encoding="utf-8")
        content = organize.set_frontmatter_fields(content, {"route_to": "02_Domains/LLM"})
        path.write_text(content, encoding="utf-8")
        manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        verification = organize.verify_run(manifest, self.vault)
        self.assertEqual(verification["status"], "error")
        self.assertTrue(any("实际目录" in error for error in verification["errors"]))

    def test_router_import_does_not_write_bytecode_during_preflight(self):
        import sys
        with patch.object(sys, "dont_write_bytecode", False):
            self.prepare()
        self.assertFalse(list((self.vault / ".agents").rglob("*.pyc")))

    def test_ambiguous_candidates_block_entire_batch_even_with_high_confidence(self):
        self.prepare()
        ambiguous = self.card()
        ambiguous["route_candidates"] = ["02_Domains/LLM/Agent", "03_Areas/LLM/Agent"]
        ambiguous["route"] = ""
        before = self.snapshot()
        code, result = self.apply([self.card("明确卡片"), ambiguous])
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "needs-route-review")
        self.assertEqual(before, self.snapshot())
        self.assertTrue(self.cards_path.exists())
        del ambiguous["route_candidates"]
        ambiguous["route"] = "03_Areas/LLM/Agent"
        code, result = self.apply([self.card("明确卡片"), ambiguous])
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "ok")

    def test_batch_reserves_sibling_numbers_and_reuses_same_new_directory(self):
        self.prepare()
        cards = [self.card("Z", "03_Areas/Topic B"), self.card("A", "03_Areas/Topic A"),
                 self.card("B", "03_Areas/Topic B")]
        code, result = self.apply(cards)
        self.assertEqual(code, 0, result)
        routes = {item["title"]: item["route"] for item in result["routing"]}
        self.assertEqual(routes, {"Z": "03_Areas/0302_Topic B", "A": "03_Areas/0301_Topic A", "B": "03_Areas/0302_Topic B"})

    def test_preflight_rejects_missing_selected_folder_without_creating_cards(self):
        directory = self.folder("03_Areas/0301_LLM/030101_Agent")
        self.prepare()
        directory.rmdir()  # Empty fixture directory only.
        before = self.snapshot()
        code, result = self.apply([self.card(route="03_Areas/0301_LLM/030101_Agent")])
        self.assertEqual(code, 1, result)
        self.assertIn("已消失", result["errors"][0])
        self.assertIn("routing_context", result)
        self.assertEqual(before, self.snapshot())

    def test_invalid_archive_blocks_before_card_writes(self):
        self.prepare()
        self.manifest["source_archive_route"] = "02_Domains/Archive"
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        before = self.snapshot()
        code, result = self.apply([self.card()])
        self.assertEqual(code, 1, result)
        self.assertEqual(before, self.snapshot())

    def test_low_confidence_stays_in_inbox_then_can_resume(self):
        self.prepare()
        card = self.card(confidence=0.6)
        code, result = self.apply([card])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["source"].startswith("01_Inbox/"))
        self.assertTrue(result["cards"][0].startswith("01_Inbox/"))
        card["confidence"] = 0.95
        code, result = self.apply([card])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["source"].startswith("06_Archive/"))
        self.assertEqual(len(result["cards"]), 1)

    def test_retry_after_archive_failure_finishes_without_duplicate_cards(self):
        self.prepare()
        card = self.card()
        original = organize.run_router

        def fail_archive(vault, notes, manifest_path, apply_changes):
            if apply_changes and notes[0].name.startswith("source-"):
                raise organize.OrganizeError("simulated archival failure")
            return original(vault, notes, manifest_path, apply_changes)

        with patch.object(organize, "run_router", side_effect=fail_archive):
            with self.assertRaises(organize.OrganizeError):
                self.apply([card])
        code, result = self.apply([card])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["source"].startswith("06_Archive/"))
        self.assertEqual(len(list(self.vault.rglob(card["title"] + "*.md"))), 1)

    def test_same_name_file_is_preserved_and_links_use_suffixed_card(self):
        self.folder("03_Areas/0301_LLM/030101_Agent")
        self.write("03_Areas/0301_LLM/030101_Agent/Agent 的 ReAct 方法.md", "EXISTING CARD")
        self.prepare()
        code, result = self.apply([self.card()])
        self.assertEqual(code, 0, result)
        self.assertTrue(result["cards"][0].endswith(" (2).md"))
        source = (self.vault / result["source"]).read_text(encoding="utf-8")
        self.assertIn(result["cards"][0].removesuffix(".md"), source)
        self.assertEqual((self.vault / "03_Areas/0301_LLM/030101_Agent/Agent 的 ReAct 方法.md").read_text(encoding="utf-8"), "EXISTING CARD")

    def test_router_preview_matches_apply_and_invalid_selection_is_atomic(self):
        notes = []
        for name, route in [("Z", "03_Areas/B"), ("A", "03_Areas/A")]:
            notes.append(self.write(f"01_Inbox/{name}.md", f"---\ntitle: {name}\nstatus: ready\nroute_to: {route}\nroute_confidence: 0.95\n---\n"))
        before = self.snapshot()
        preview = io.StringIO()
        with contextlib.redirect_stdout(preview):
            router.route_notes(self.vault, self.vault / "01_Inbox", apply_changes=False, confidence_threshold=0.85, notes=notes)
        self.assertEqual(before, self.snapshot())
        self.assertIn("Z.md -> 03_Areas/0302_B", preview.getvalue())
        self.assertIn("A.md -> 03_Areas/0301_A", preview.getvalue())
        bad = self.write("01_Inbox/Bad.md", "---\nstatus: ready\nroute_to: 03_Areas/../Outside\nroute_confidence: 0.95\n---\n")
        before = self.snapshot()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            summary = router.route_notes(self.vault, self.vault / "01_Inbox", apply_changes=True, confidence_threshold=0.85, notes=notes + [bad])
        self.assertEqual(summary["moved"], 0)
        self.assertEqual(before, self.snapshot())
        with contextlib.redirect_stdout(io.StringIO()):
            router.route_notes(self.vault, self.vault / "01_Inbox", apply_changes=True, confidence_threshold=0.85, notes=notes)
        self.assertTrue((self.vault / "03_Areas/0302_B/Z.md").is_file())

    def test_duplicate_codes_and_unsafe_paths_are_rejected(self):
        self.folder("03_Areas/0301_A")
        self.folder("03_Areas/0301_B")
        self.assertFalse(any(item["path"].startswith("03_Areas/") for item in router.directory_catalog(self.vault)))
        for route in ["03_Areas/A", "03_Areas/0301_A", "02_Domains/../escape", "02_Domains/a:stream"]:
            with self.subTest(route=route), self.assertRaises(ValueError):
                router.safe_destination(self.vault, route)

    def test_directory_names_do_not_override_react_frontend_route(self):
        self.folder("03_Areas/0301_LLM/030101_ReAct")
        expected = self.folder("02_Domains/0201_Frontend/020101_React")
        destination, _, matched = router.safe_destination(self.vault, "02_Domains/0201_Frontend/020101_React",
                                                          note_name="ReAct", note_title="LLM")
        self.assertEqual(destination, expected)
        self.assertFalse(matched)


if __name__ == "__main__":
    unittest.main(verbosity=2)
