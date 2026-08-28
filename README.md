# Knowledge Base Template

一个可直接交给他人使用的空白 Obsidian AI 知识库。模板保留知识收集、提炼、路由、关联、检索和巡检能力，不包含创建者的业务资料、个人笔记、附件或本地工作区状态。

Obsidian 中从 [[知识库首页]] 开始浏览。

## 核心结构

```text
高保真来源笔记 -> knowledge-skill 原子卡片 -> knowledge-package 主题索引
```

- 来源笔记保留背景、原文、例外和追溯信息。
- 原子卡片独立回答一个稳定问题，并声明适用与排除边界。
- 主题索引将用户意图路由到一篇主文档和少量相关文档。

## 目录

```text
Knowledge Base Template/
|-- 01_Inbox/        # 唯一收集入口
|-- 02_Domains/      # 专业或业务领域知识
|-- 03_Areas/        # 长期责任领域
|-- 04_Resources/    # 外部资料与参考
|-- 05_Skills/       # SOP、模板、提示词与工作流
|-- 06_Archive/      # 已处理来源和历史资料
|-- 07_Attachments/  # 非 Markdown 附件
|-- .agents/         # 路由脚本
|-- .obsidian/       # 可共享 Obsidian 设置
|-- AGENTS.md        # AI 助理执行规则
|-- 知识库首页.md
`-- 知识路由索引.md
```

`02_Domains` 与 `03_Areas` 不预置任何主题。新用户根据自己的专业与责任范围创建编号子目录，避免继承不相关的分类。

## 开始使用

1. 复制整个目录，并改成自己的知识库名称。
2. 用 Obsidian 选择“打开本地仓库”，打开该目录。
3. 从 `知识库首页.md` 进入。
4. 在支持项目级指令的 AI 工具中，让工具读取根目录 `AGENTS.md`。
5. 将自己的第一份资料放入 Inbox，或在 AI 对话中使用 `知识收 精简` / `知识收 保真`。

Obsidian 的模板目录、附件目录和新建笔记目录已经配置好。`.obsidian/workspace*.json` 被忽略，每个使用者会保留自己的界面布局。

## 四个 AI 指令

| 指令 | 作用 | 产物 |
|---|---|---|
| `知识收 [模式] [路径]` | 收集当前对话或指定资料 | `01_Inbox` 来源笔记 |
| `知识理 [模式] [文件]` | 提炼、分类并路由知识 | 原子卡片和归档来源 |
| `知识联` | 修正检索边界、补链接、更新索引 | 可检索的知识关系 |
| `知识巡` | 只读检查知识库健康度 | 巡检报告与建议 |

未指定模式时，AI 必须先询问：

- `精简模式`：快速入库，只保留核心且稳定的内容。
- `保真模式`：完整保留上下文、表格、图文、规则和追溯信息。

表格、制度、主数据和需要审计追溯的资料默认使用保真模式。

## 第一次自定义

创建第一个主题目录时遵守编号规则：

```text
02_Domains/0201_你的专业主题
03_Areas/0301_你的长期领域
05_Skills/0502_你的可复用技能
```

每个主题目录创建 `_Index.md`，可从 `05_Skills/0501_Knowledge Management/050101_Templates/目录索引模板.md` 开始。随后将该索引加入根目录 `知识路由索引.md`。

不要预先创建大量空分类。稳定主题实际出现后再建目录，更容易保持路由清晰。

## 笔记模型

正式知识卡片使用 YAML Frontmatter 描述调用边界：

```yaml
---
title: 笔记标题
created: YYYY-MM-DD HH:mm
updated: YYYY-MM-DD HH:mm
source: ai-dialogue
type: knowledge-skill
status: processed
description: >
  当用户需要……时使用。包含……；不包含……。
aliases: []
triggers: []
use_when: []
do_not_use_when: []
match_questions: []
domain: []
project:
maturity: growing
retrieval_priority: normal
parent_index:
source_notes: []
route_to:
route_confidence:
route_reason:
review_after:
tags: []
related: []
---
```

完整模板位于：

- `05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板.md`
- `05_Skills/0501_Knowledge Management/050101_Templates/知识卡片模板.md`
- `05_Skills/0501_Knowledge Management/050101_Templates/目录索引模板.md`

## 路由脚本

脚本仅使用 Python 标准库，建议 Python 3.10 或更高版本。它不负责理解内容；AI 先写入路由元数据，脚本再验证并移动文件。

```powershell
# 预览，不移动文件
python ".agents/scripts/knowledge_router.py"

# 移动验证通过且置信度达标的笔记
python ".agents/scripts/knowledge_router.py" --apply

# 只读巡检
python ".agents/scripts/knowledge_router.py" --audit
```

默认自动路由阈值为 `0.85`。目标只允许进入 `02_Domains`、`03_Areas`、`04_Resources`、`05_Skills` 或 `06_Archive`；同名文件不会被覆盖。

## 共享与版本控制

模板包含 MIT License，可以复制、修改和分发。建议首次使用时初始化自己的 Git 仓库：

```powershell
git init
git add .
git commit -m "Initialize knowledge base"
```

提交前检查附件与笔记是否含敏感信息。不要把密码、令牌、账号、证件号或未经授权的业务数据提交到远程仓库。

## 系统要求

- Obsidian：用于笔记、Properties、Bases 和双向链接。
- Python 3.10+：仅在使用路由与巡检脚本时需要。
- 支持项目级指令的 AI 工具：用于执行 `AGENTS.md` 约定的自动工作流；没有 AI 工具时也可手工使用模板。

详细规则见 `05_Skills/0501_Knowledge Management/知识路由规则.md`。
