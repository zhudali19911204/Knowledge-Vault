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
- 新建知识目录必须严格编号。一级知识目录在根目录编号后追加两位连续序号，例如 `02_Domains/0201_主题`、`02_Domains/0202_主题`；下一层继续追加两位，例如 `0201_主题/020101_子主题`。每个父目录从 `01` 开始，按现有最大序号递增，不填补已删除编号、不跳号、不复用编号。第 2 步的 `route` 只写根目录和语义名称（如 `02_Domains/Transfer Price`），不得猜测编号；路由脚本负责匹配已有合规目录或分配下一个编号。已有无编号、编号层级错误或显式跳号的目录一律拒绝使用，不得继续向其中写入。
- 路由时先跨 `02_Domains` 至 `05_Skills` 检查所有现有合规目录，再采用卡片的语义 `route`，最后才新建目录。目录语义名与文件名或 YAML `title` 的精确/完整包含匹配优先级最高；目录 `_Index.md` 的 `title`、`aliases`、`triggers` 作为跨语言和同义词的强匹配依据。仅存在唯一高相关候选时覆盖 `route`；没有强匹配或最高分并列时保留 AI 语义判断。若强匹配目录是语义路由的祖先，仍保留更具体的语义子目录。归档来源的 `06_Archive` 路由不参与覆盖。
- 成功路由的新知识包直接登记到根路由索引的对应分类表和该分类的知识包表；自动创建且尚未复核的 `_Index.md` 在表格中标记“待完善”，不另建“自动登记的知识包”区域。
- 原子卡片 YAML 的 `source_notes`、`parent_index`、`related` 及正文“来源与关联”必须使用同一组 `[[Vault相对路径|显示名]]`；禁止只写普通标题。脚本在卡片路由和来源归档完成后按最终路径统一回写，使 Harness 聊天区和阅读器都能直接点击跳转。

## 旧卡片链接维护

仅在修复历史卡片时运行；默认预览，确认后加 `--apply`。命令会把可唯一解析的关系链接补成完整 Vault 相对路径，并让正文“来源与关联”重新与 YAML 对齐，不会臆造缺失文件。

```powershell
python ".dsh/skills/knowledge-organize/scripts/organize_batch.py" repair-links --vault-root "."
python ".dsh/skills/knowledge-organize/scripts/organize_batch.py" repair-links --vault-root "." --apply
```

完成时只报告来源、方案、卡片数、已路由/待审数量和来源是否归档，不重复卡片正文。
