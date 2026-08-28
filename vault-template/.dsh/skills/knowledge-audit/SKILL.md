---
name: knowledge-audit
description: 当用户输入“知识巡”并希望只读检查 Obsidian Vault 的 Inbox、路由置信度、孤立笔记、复习日期、元数据、附件引用和索引一致性时使用。只生成报告和建议，不执行修复或批量改写。
whenToUse: 用户说“知识巡”，或要求审计、巡检、检查知识库健康度时。
user-invocable: true
---

# 知识巡

这是只读流程。遵守根目录 `AGENTS.md` 与 `05_Skills/0501_Knowledge Management/知识路由规则.md` 的巡检标准。

1. 先从 Vault 根目录运行：

   ```text
   python ".agents/scripts/knowledge_router.py" --audit
   ```

2. 在脚本结果基础上检查：

   - Inbox 待处理或 `needs-review` 笔记；
   - 低置信度或不一致的 `route_to`；
   - 孤立笔记、缺失双向追溯和未完成任务；
   - 已到 `review_after` 的笔记；
   - `knowledge-skill` 检索属性完整性；
   - 知识主题目录缺失 `_Index.md`；
   - 根路由索引与实际目录或主题索引不一致；
   - 图片、PDF、图表和最近新增附件是否有有效引用；
   - 表格与需要追溯的资料是否遵守保真模式要求。

3. 报告按严重程度区分错误、待确认和建议，给出具体文件路径与建议动作。
4. 不移动、删除、合并、重命名或批量改写任何文件；发现问题也只报告，等待用户另行确认修复。
