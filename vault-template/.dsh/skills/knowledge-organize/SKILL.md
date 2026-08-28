---
name: knowledge-organize
description: 当用户输入“知识理”并希望提炼 Inbox 来源、补全检索属性、更新主题索引并安全路由知识时使用。生成可追溯的 knowledge-skill 卡片；不处理用户未指定的外部资料。
whenToUse: 用户说“知识理”“知识理 精简”“知识理 保真”，或明确要求按本 Vault 的整理与路由流程处理 Inbox 时。
user-invocable: true
---

# 知识理

执行前先完整遵守：

- 根目录 `AGENTS.md` 中“触发指令：知识理”、分类顺序与安全规则。
- `05_Skills/0501_Knowledge Management/知识路由规则.md` 中对应模式的完整 SOP 和完成前自检。

工作流：

1. 如果用户没有明确写出 `精简` 或 `保真`，先询问模式；在得到选择前不拆卡、改写索引或路由。
2. 无文件参数时，只处理 `01_Inbox/` 中 `status: inbox` 或 `needs-review` 且文件名不以 `_` 开头的笔记；有文件参数时只处理指定笔记。
3. 精简模式只创建最核心、稳定的 1–2 张卡片；保真模式按内容价值创建 2–8 张，不能为凑数量制造碎片。
4. 每张卡片独立回答一个稳定问题，并完整填写 `description`、`aliases`、`triggers`、`use_when`、`do_not_use_when`、`match_questions`、`parent_index`、`source_notes`、`related`。
5. 建立双向追溯：卡片链接来源笔记，来源笔记反向列出已提炼知识。直接相关的图片、PDF 或图表要在对应文字后引用。
6. 按根规则选择唯一主目录；新文件夹严格编号，并同步目标 `_Index.md` 与必要的根路由索引。
7. 路由前核对 `route_to`、`route_reason`、`route_confidence`。低于 `0.85` 或边界不清的内容保留在 Inbox 并设为 `needs-review`。
8. 自动移动前先运行预览：

   ```text
   python ".agents/scripts/knowledge_router.py"
   ```

9. 只有预览无异常且内容达到阈值时，才运行：

   ```text
   python ".agents/scripts/knowledge_router.py" --apply
   ```

10. 执行后检查 Inbox、目标文件、索引、来源追溯和附件引用。不要删除来源原文或附件。
