---
name: knowledge-organize
description: 当用户输入“知识理”并希望按自定义方案或 AI 推荐方案批量拆分一篇 Inbox 来源、生成可追溯 knowledge-skill 卡片并安全路由时使用。不处理未指定资料，不逐卡重复读取来源。
---

# 知识理

## 入口

- 未指定文件时只列出 `01_Inbox` 中非 `_` 开头的 Markdown 文件，不读正文；一次只处理一篇。
- 用户未选方案时只询问：`custom`（用户给出数量与标题/核心内容）或 `recommend`（AI 决定并直接执行）。已选择时不重复询问。
- `custom` 的数量必须与卡片条目一致；`recommend` 仅在来源为空、重复、已处理或没有可复用知识时生成 0 张卡并说明原因。

## 正常路径：严格三次工具调用

除非第 3 步返回错误，不得扫描 Vault、读取模板/索引/本 Skill 的其他文件，也不得运行 `validate` 或 `verify`。

1. **准备并读取一次来源**：

   ```powershell
   python ".dsh/skills/knowledge-organize/scripts/organize_batch.py" prepare "<Inbox 来源.md>" --vault-root "." --mode <custom|recommend>
   ```

   命令会一次返回 `manifest`、尚不存在的 `cards_file` 路径、最小 JSON 契约和带 `Sxxx` 证据标记的完整正文。不得再读取来源。

2. **直接新建一次 `cards_file`**：按命令返回的紧凑契约，一次性写入全部卡片。该路径由 `prepare` 保证尚不存在，不得先读；必须使用现成的 Workspace Write 直接创建该 JSON。禁止创建或执行 Python、PowerShell、builder、转换器或其他临时辅助文件。若工具声称文件已存在，说明沿用了旧运行结果；重新执行第 1 步一次，不读取或覆盖旧文件。

3. **一次应用并清理**：

   ```powershell
   python ".dsh/skills/knowledge-organize/scripts/organize_batch.py" apply "<manifest>" --cards "<cards_file>" --vault-root "." --cleanup
   ```

   此命令已经包含 manifest 校验、卡片渲染、定向路由、反链/索引更新和最终核验。成功后直接报告结果，不再打开生成文件复检；失败时只根据 `errors` 修正 `cards_file` 并重试本步，最多两次。

## 语义底线

- 第 2 步写入前静默检查一次，不输出检查过程：每张卡只回答一个稳定问题；卡间结论和边界不重复；结论与正文均由 `evidence` 支持。YAML 中 `triggers` 是触发词，`use/avoid` 是应使用/不应使用本卡的检索场景，`questions` 是用户可能提出的问题，`includes/excludes` 是正文包含/不包含的内容范围；操作步骤、禁令和警告只能进入 `body/limits`，不得冒充检索边界。不合格时先在内存中修正，再一次性写入。
- SOP 不按步骤拆散,每一步有图片必须放对应的图片；紧凑契约中的 `kind` 使用 `procedure`，`body` 完整保留前置条件、输入、步骤、参数、验证、异常、注意事项和实际存在的 `![[07_Attachments/...]]`。
- 不为凑数创建空卡或重复卡。同批卡存在流程与异常、概念与应用、前置与结果等直接关系时，必须用卡片顺序 ID 写 `related`（如 C001 写 `related:["C002"]`）；脚本自动补成双向 Wiki 链接，只写一侧即可。仅关键词相同不关联；没有真实关系时省略。`aliases` 没有内容时省略，跨批和全库关系交给“知识联”。
- 脚本把 `confidence` 写为 `route_confidence`；值不低于 `0.85` 才自动路由。低置信卡及其来源留在 Inbox，只有全部卡片成功路由才归档来源。

完成时只报告来源、方案、卡片数、已路由/待审数量和来源是否归档，不重复卡片正文。
