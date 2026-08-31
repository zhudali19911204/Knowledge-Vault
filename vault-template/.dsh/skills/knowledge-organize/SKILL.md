---
name: knowledge-organize
description: 当用户输入“知识理”并希望提炼 Inbox 来源、补全检索属性、更新主题索引并安全路由知识时使用。生成可追溯的 knowledge-skill 卡片；不处理用户未指定的外部资料。
---

# 知识理

## 知识理模式确认

当用户触发 `知识理` 时，AI 必须先询问使用 `精简模式` 还是 `保真模式`，再开展拆卡、更新索引或路由等后续工作。

如果用户已在同一条指令中明确指定模式，例如 `知识理 精简` 或 `知识理 保真`，则按指定模式执行，不重复询问。

## 知识理：精简模式

精简模式用于快速把 Inbox 中最有复用价值的内容变成可检索知识，目标是“少拆卡、先可用、保留追溯”。

操作要求：

1. 排除文件名以 `_` 开头的说明文件。
2. 只提炼最核心、最稳定的 1–2 张 `knowledge-skill` 原子卡片；没有足够价值时可以只做 1 张或暂不建卡。
3. 边界不清、证据不足、价值暂不确定的细节继续留在来源笔记，或在卡片中标为“限制 / 待补充”，不为凑数量制造碎片。
4. 每张卡片仍必须填写必要的 Skill 式检索属性：`description`、`aliases`、`triggers`、`use_when`、`do_not_use_when`、`match_questions`、`parent_index`、`source_notes` 和 `related`。
5. `description` 仍使用“当用户需要……时使用。包含……；不包含……”格式，明确使用边界。
6. 如果有与卡片直接相关的图片、截图或图表，应放在对应文字说明之后，优先使用 `![[07_Attachments/...]]`，让 Markdown 打开时能直接显示。
7. 只做必要索引更新：更新所属目录 `_Index.md` 的文档路由表和本目录文档列表；不做大范围重构。
8. 原子卡片通过 `source_notes` 链接来源笔记；来源笔记的“已提炼知识”反向列出已创建卡片。
9. 高置信度卡片设置 `status: ready`、`route_to`、`route_reason`、`route_confidence`；置信度不足时设置 `status: needs-review` 并留在 Inbox。
10. 如果来源笔记已完成本轮精简提炼，将来源笔记设置为可归档路由，保留完整追溯链；不删除原文和附件。

## 知识理：保真模式

保真模式用于把来源笔记系统拆解成长期可复用知识，目标是“完整拆分、完整检索属性、完整追溯和路由”。

操作要求：

1. 排除文件名以 `_` 开头的说明文件。
2. 把来源笔记拆成 2–8 篇具有独立复用价值的原子卡片；没有足够价值时可以少于 2 篇，不为凑数量制造碎片。
3. 一张卡片应回答一个稳定问题，并包含独立结论、适用场景、方法或解释、示例以及限制；必须依赖上下文才能理解的内容继续合并保存。
4. 原子卡片使用 `05_Skills/0501_Knowledge Management/050101_Templates/知识卡片模板.md`，设置 `type: knowledge-skill`。
5. 每张卡片必须填写完整 Skill 式检索属性：`description`、`aliases`、`triggers`、`use_when`、`do_not_use_when`、`match_questions`、`parent_index`、`source_notes` 和 `related`。
6. `description` 使用“当用户需要……时使用。包含……；不包含……”格式，明确调用边界，不能只重复标题。
7. 原子卡片通过 `source_notes` 链接来源笔记；来源笔记的“已提炼知识”反向列出全部卡片。
8. 如果来源笔记或附件中有与原子卡片直接相关的图片、截图或图表，应尽量在对应文字说明之后引用图片，优先使用 Obsidian 可渲染的嵌入语法 `![[07_Attachments/...]]`，确保 Markdown 文档打开时能直接显示图片，保证图文并茂、便于用户理解；图片本体仍按附件规则保存在 `07_Attachments/`，原子卡片只嵌入或链接。
9. 为每张卡片选择 `route_to`，填写 `route_reason` 和 0–1 的 `route_confidence`。
10. 目标主题目录必须存在 `_Index.md`；新目录使用目录索引模板创建，已有目录则更新路由表。
11. 更新所属目录 `_Index.md` 的文档路由表、本目录文档列表和必要的相关知识包链接；必要时同步上级索引。
12. 置信度不低于 0.85 时设为 `status: ready`，运行路由脚本执行移动；低于 0.85 时设为 `status: needs-review`，继续留在 Inbox。
13. 原子卡片完成后，来源笔记路由到 `06_Archive` 的来源目录，保留完整追溯链，不删除原文。

## 知识理：共同安全底线

1. 无论精简还是保真，创建的 `knowledge-skill` 卡片都必须具备必要的 Skill 式检索属性。
2. 不编造来源、结论、链接或用户决策。
3. 图片、截图或图表本体仍保存在 `07_Attachments/`；卡片只嵌入或链接。
4. 低置信度内容宁可留在 Inbox，不强行路由。
5. 路由前应确认 `route_to`、`route_reason` 和 `route_confidence` 与卡片内容一致。

## 知识理：完成前自检清单

在报告 `知识理` 完成前，必须逐项自检：

1. 原子卡片是否回答一个稳定问题，且没有把多个无关主题硬塞进同一卡片。
2. 每张 `knowledge-skill` 是否具备必要 Skill 式检索属性：`description`、`aliases`、`triggers`、`use_when`、`do_not_use_when`、`match_questions`、`parent_index`、`source_notes`、`related`。
3. `description` 是否使用“当用户需要……时使用。包含……；不包含……”格式，并明确适用和排除边界。
4. `source_notes` 是否能回到来源笔记；来源笔记的“已提炼知识”是否反向列出本次创建的卡片。
5. 有关图片、截图、PDF 或图表的卡片，是否在对应文字说明后嵌入或链接附件，且附件路径存在。
6. 卡片中的关键结论、数字、代码、名称和示例是否能在来源笔记或附件中找到依据；不确定内容是否已标为限制、风险或待补充。
7. 所属目录 `_Index.md` 是否已更新文档路由表和本目录文档列表；必要时是否更新上级索引。
8. `route_to`、`route_reason`、`route_confidence` 是否与内容一致；低于 0.85 或边界不清的卡片是否留在 Inbox。
9. 执行路由前是否先预览；执行后是否确认 Inbox、目标文件、附件引用和路由脚本输出无异常。
10. 是否避免删除、覆盖、合并或移动用户未确认的来源资料和附件。

## Skill 式描述标准

正式知识卡片必须包含：

```yaml
type: knowledge-skill
description: >
  当用户需要……时使用。包含……；不包含……。
aliases: []
triggers: []
use_when: []
do_not_use_when: []
match_questions: []
parent_index:
source_notes: []
related: []
```

`description` 和 `use_when` 用于判断语义需求，`match_questions` 用于匹配真实提问，`triggers` 只辅助召回，`do_not_use_when` 用于排除相似但不适合的文档。

## 路由边界

| 目录 | 进入条件 | 不应进入的内容 |
|---|---|---|
| `01_Inbox` | 尚未提炼或需要人工确认 | 已完成处理的稳定笔记 |
| `02_Domains` | 可跨项目复用的专业或业务领域知识 | 单纯外部摘录 |
| `03_Areas` | 长期维护的领域知识 | 有明确结束时间的临时材料 |
| `04_Resources` | 外部参考与资料索引 | 已内化的方法或结论 |
| `05_Skills` | SOP、模板、清单、提示词 | 只说明“是什么”的概念笔记 |
| `06_Archive` | 已结束、过时或仅供追溯 | 仍需频繁使用的活跃知识 |
| `07_Attachments` | 非 Markdown 文件 | 知识正文 |

## 自动移动条件

自动移动必须同时满足：

```yaml
status: ready
route_to: 03_Areas/Research
route_confidence: 0.90
```

其中 `route_confidence` 必须不低于 `0.85`。脚本默认只预览，增加 `--apply` 后才执行移动。

## 文件夹编号

路由创建新文件夹时必须自动编号：

```text
05_Skills/0502_主题
05_Skills/0503_主题
06_Archive/0601_主题
05_Skills/0502_主题/050201_子主题
```

规则：

- 同级第一个新目录从 `01` 开始，之后取现有最大编号加一。
- 已存在的同名旧目录可以直接复用，不重复创建。
- 已存在但未编号的旧目录不会被脚本擅自重命名。
- 如果 `route_to` 使用无编号的新目录名称，脚本会生成编号并把最终路径回写到笔记属性。
- 手工创建目录或由 AI 直接创建目录时，也必须使用相同规则。

```powershell
# 预览
python ".agents/scripts/knowledge_router.py"

# 执行
python ".agents/scripts/knowledge_router.py" --apply

# 巡检
python ".agents/scripts/knowledge_router.py" --audit
```
