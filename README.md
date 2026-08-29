# Knowledge Vault Harness

一个可直接封装和分发的 Obsidian AI 知识库客户端：DeepSeek Harness 是运行底座，Agent 只围绕用户选定的 Vault 工作，`AGENTS.md` 与 `.dsh/skills/` 共同提供知识收集、提炼、路由、关联、检索和巡检能力。

发布包不包含创建者的模型密钥、会话记录、`node_modules` 或本地工作区状态。每个用户的 Harness 数据独立保存在自己的 `%LOCALAPPDATA%\KnowledgeVaultHarness`。

应用工程与 Vault 内容已经分离：`vault-template/` 是唯一初始化模板，根目录只保存安装、启动、测试和 Harness 集成文件。初始化后的知识库从 `知识库首页.md` 开始浏览。

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
|-- vault-template/  # 用户知识库的唯一模板源
|   |-- 01_Inbox/        # 唯一收集入口
|   |-- 02_Domains/      # 专业或业务领域知识
|   |-- 03_Areas/        # 长期责任领域
|   |-- 04_Resources/    # 外部资料与参考
|   |-- 05_Skills/       # SOP、模板、提示词与工作流
|   |-- 06_Archive/      # 已处理来源和历史资料
|   |-- 07_Attachments/  # 非 Markdown 附件
|   |-- .dsh/skills/     # Vault Agent 技能
|   |-- .agents/         # 路由脚本
|   |-- .obsidian/       # 可共享 Obsidian 设置
|   |-- AGENTS.md        # Vault AI 助理执行规则
|   |-- 知识库首页.md
|   `-- 知识路由索引.md
|-- .dsh/            # Harness 产品插件与启动补丁
|-- AGENTS.md        # 应用工程维护规则
|-- Install-KnowledgeBase.cmd
|-- Initialize-KnowledgeBase.cmd
|-- Start-KnowledgeBase.cmd
|-- Test-KnowledgeBase.cmd
|-- Build-Distribution.ps1
|-- package.json
|-- pnpm-lock.yaml
`-- pnpm-workspace.yaml
```

`02_Domains` 与 `03_Areas` 不预置任何主题。新用户根据自己的专业与责任范围创建编号子目录，避免继承不相关的分类。

## 开始使用

1. 解压整个应用目录；目录可以改名，也可以放在包含空格的路径中。
2. 双击 `Install-KnowledgeBase.cmd`，安装锁定版本的 DeepSeek Harness。
3. 双击 `Start-KnowledgeBase.cmd`。首次启动会先显示模板预览知识库。
4. 点击左侧“新会话”下方的“初始化知识库”，在系统文件夹选择器中指定一个空目录。Harness 会复制模板、记住该位置、切换工作区并直接打开新会话。
5. 需要使用另一个已有知识库时，点击“选择知识库”并选择其 Vault 根目录；右侧工作栏会立即切换目录，并预览 Markdown、文本和代码文件。
6. 在会话顶部切换到“图谱”，浏览当前 Vault 的显式知识关系；单击节点会在右侧工作栏只读预览对应笔记。
7. 在 Harness 的“设置 → 模型”中配置自己的 API 密钥。密钥只保存在当前 Windows 用户的数据目录中，不要写入 Vault。
8. 用 Obsidian 选择“打开本地仓库”，打开第 4 步选择的目录，并从 `知识库首页.md` 进入。
9. 将第一份资料放入 Inbox，或在 AI 对话中使用 `知识收 精简` / `知识收 保真`。

界面内初始化只接受空目录或已经初始化的 Knowledge Vault，不会覆盖普通非空目录；“选择知识库”只接受包含 `AGENTS.md` 和 `01_Inbox/` 的已初始化 Vault，不会向其中复制或修改知识内容。`Initialize-KnowledgeBase.cmd` 继续保留为无法打开 Web UI 时的备用入口。应用程序仍留在解压目录，知识正文位于用户选择的位置；用户配置只记录在 `%LOCALAPPDATA%\KnowledgeVaultHarness\product.json`。

`Start-KnowledgeBase.cmd` 在尚未安装运行时时也会自动调用安装器。安装需要联网；此后的日常启动使用项目内的固定版本，不会静默升级。尚未初始化时，启动器使用 `vault-template/` 作为预览知识库，不再把应用根目录暴露给目录浏览器。

Obsidian 的模板目录、附件目录和新建笔记目录已经配置好。`.obsidian/workspace*.json` 被忽略，每个使用者会保留自己的界面布局。

### 知识图谱（第一阶段）

“图谱”页签只读扫描当前知识库中的 Markdown 笔记。节点代表笔记，连线只来自可核验的显式关系：Obsidian `[[双向链接]]`、Markdown `.md` 链接，以及 frontmatter 的 `related`、`source_notes`、`parent_index`。第一阶段不会根据关键词或模型推断关系，也不会写回、移动或修改 Vault 文件。

图谱支持标题/路径搜索、一级目录、知识类型、状态、标签和关系类型筛选，可隐藏孤立节点，或在选中节点后查看两跳局部图。拖拽画布可平移、滚轮可缩放；点击“刷新”会重新读取磁盘上的 Markdown。未解析链接只计入状态统计，便于后续修正，不会虚构目标节点。

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

## DeepSeek Harness 底座

本项目通过锁文件固定 `@deepseek-ai/dsh@0.1.1-rc.2`，并使用 DSH 的 patch/plugin 机制完成自动装配：

- `vault-template/AGENTS.md` 是初始化后 Vault 的工作区级强约束，定义目录、路由、检索与安全规则。
- `vault-template/.dsh/skills/` 提供 `vault-retrieve`、`knowledge-capture`、`knowledge-organize`、`knowledge-link` 和 `knowledge-audit` 五个按需技能。
- `.dsh/plugins/knowledge-vault-bootstrap/` 在每次启动时注册用户选定的 Vault，并提供界面内初始化、知识库选择、只读目录/文件接口、右侧知识库浏览器和 Canvas 知识图谱。
- `.dsh/plugins/knowledge-vault-bootstrap/assets/bkcs-logo.png` 是欢迎页使用的 BKCS Logo；按 258×82 CSS 像素等比显示，不替换左侧 Knowledge Vault 品牌。
- `.dsh/plugins/knowledge-vault-bootstrap/assets/knowledge-vault-favicon.png` 是由灰橙 Z Logo 制作的透明图标，用于浏览器 favicon 和左侧栏 24×24 品牌标记；页面加载后标签标题固定为 `Knowledge Vault`。
- 初始化后的 `05_Skills/` 仍是 Obsidian 内的可复用知识；`.dsh/skills/` 是 Agent 运行时说明，两者不混用。
- `vault-template/.agents/scripts/knowledge_router.py` 是模板中的路由器，初始化后位于用户 Vault 的 `.agents/scripts/`。
- 模型设置、API 密钥、会话和生成的 DSH patch 保存在 `%LOCALAPPDATA%\KnowledgeVaultHarness`，不进入发布包或 Vault。

Windows 快速启动：

```powershell
./Start-KnowledgeBase.cmd
```

开发或排障时可直接调用 PowerShell 启动器：

```powershell
./Start-DeepSeekHarness.ps1 -NoOpen
./Start-DeepSeekHarness.ps1 -Port 3081
./Start-DeepSeekHarness.ps1 -DataRoot "D:\MyHarnessData"
./Start-DeepSeekHarness.ps1 -VaultRoot "D:\MyKnowledgeVault"
```

`-VaultRoot` 可临时覆盖已保存的知识库位置；`-DataRoot` 必须位于 Vault 之外，启动器会拒绝把凭据、会话或用户配置写进知识库目录。

运行时安装：

```powershell
./Install-KnowledgeBase.ps1
./Install-KnowledgeBase.ps1 -Force
```

一键自检：

```powershell
./Test-KnowledgeBase.cmd
```

自检会先通过脚本初始化临时 Vault，再通过界面 API 初始化第二个 Vault并在两者之间切换，验证固定 DSH 版本、Web UI、工作区自动注册、右侧文件浏览接口、显式关系图谱、图谱缓存切换、新建会话和 5 个项目技能；不调用模型，也不需要 API 密钥，结束后自动关闭服务并清理临时数据。

依赖构建脚本采用 pnpm 11 的逐包白名单，仅放行当前锁文件中 DSH 所需的 5 个包；没有启用全局的 `dangerouslyAllowAllBuilds`。升级 DSH 时应同步更新 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 并重跑集成测试。

DeepSeek Harness 目前仍是开发者预览版。本项目用固定版本和自有启动层降低上游变化的影响，但升级前仍需验证插件树、工作区 API 和技能发现。

## 第一次自定义

创建第一个主题目录时遵守编号规则：

```text
02_Domains/0201_你的专业主题
03_Areas/0301_你的长期领域
05_Skills/0502_你的可复用技能
```

每个主题目录创建 `_Index.md`。应用模板源位于 `vault-template/05_Skills/0501_Knowledge Management/050101_Templates/目录索引模板.md`；初始化后仍使用 Vault 内的 `05_Skills/...` 路径。随后将该索引加入 Vault 根目录 `知识路由索引.md`。

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

- `vault-template/05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板.md`
- `vault-template/05_Skills/0501_Knowledge Management/050101_Templates/知识卡片模板.md`
- `vault-template/05_Skills/0501_Knowledge Management/050101_Templates/目录索引模板.md`

## 路由脚本

脚本仅使用 Python 标准库，建议 Python 3.10 或更高版本。它不负责理解内容；AI 先写入路由元数据，脚本再验证并移动文件。

```powershell
# 预览，不移动文件
python "vault-template/.agents/scripts/knowledge_router.py"

# 移动验证通过且置信度达标的笔记
python "vault-template/.agents/scripts/knowledge_router.py" --apply

# 只读巡检
python "vault-template/.agents/scripts/knowledge_router.py" --audit
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

生成给其他用户的 ZIP：

```powershell
./Build-Distribution.ps1
```

默认产物为 `dist/Knowledge-Vault-Harness-1.1.0.zip` 和对应的 `.sha256` 文件。构建前会自动运行完整自检；仅在已经单独验证过时才使用 `-SkipValidation`。构建器还会检查 ZIP 必需入口，排除 Git 历史、`node_modules`、缓存、Obsidian 私有布局和本机运行状态，并在发现常见凭据文件名时拒绝打包。发布前仍应人工检查知识正文和附件是否适合共享。

## 系统要求

- Obsidian：用于笔记、Properties、Bases 和双向链接。
- Python 3.10+：仅在使用路由与巡检脚本时需要。
- Node.js 22.19+ 或 24+，并启用 Corepack：用于安装和启动本地固定版本的 DeepSeek Harness。
- Windows PowerShell 5.1+：用于一键安装、启动和构建发布包。
- DeepSeek API 密钥：由每位用户在 Harness 设置中单独配置；不随项目分发。

模板源的详细规则见 `vault-template/05_Skills/0501_Knowledge Management/知识路由规则.md`；初始化后对应 Vault 内的 `05_Skills/0501_Knowledge Management/知识路由规则.md`。
