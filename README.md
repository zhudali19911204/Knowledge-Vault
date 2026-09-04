# Knowledge Vault Harness

面向 Windows 的本地 AI 知识库客户端。它以 DeepSeek Harness 为运行底座，让 Agent 只围绕用户选定的 Obsidian Vault 工作，完成知识收集、提炼、分类、关联、检索和巡检。

你可以直接在聊天窗口处理知识，也可以用 Obsidian 手工维护 Markdown。知识正文始终保存在你选择的 Vault 中；模型密钥、会话和 Harness 设置不会写入 Vault。

快速入口：[5 分钟上手](#5-分钟快速上手) · [配置模型](#第四步配置模型) · [界面说明](#界面速览) · [常见问题](#常见问题) · [AI 指令](#四个-ai-指令)

## 使用前准备

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows 10 或 Windows 11 |
| Node.js | 安装版和免安装版已内置，不需要用户另行安装 |
| Python | 聊天和浏览不需要；执行知识路由或巡检脚本时建议安装 3.10+ |
| 网络 | 调用在线模型时需要；应用本身只监听本机地址 |
| 模型 | 用户自己的模型 API 密钥和对应的模型配置 |
| Obsidian | 推荐安装；只使用聊天和右侧文件浏览器时可以暂不安装 |

只有从源码运行、二次开发或执行 Python 路由脚本时，才需要检查本机开发环境：

```powershell
node --version
corepack --version
python --version
```

### 在另一台电脑继续开发

仓库包含桌面端、Harness 插件、Vault 模板、锁文件和构建脚本；不需要复制当前电脑的 `node_modules` 或 `.pnpm-store`。克隆仓库后执行：

```powershell
git clone https://github.com/zhudali19911204/Personal-Knowledge-Base.git
cd Personal-Knowledge-Base
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm desktop:start
```

如果公司网络在下载 Electron 时提示证书错误，可先让 Node.js 使用 Windows 系统证书，再重新安装依赖：

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
corepack pnpm install --frozen-lockfile
```

模型密钥、会话、Harness 用户配置、构建产物和外部实际 Vault 不进入 Git，需要在新电脑单独配置或同步。仓库内的 `vault-template/` 是初始化知识库的唯一模板源。

## 5 分钟快速上手

### 第一步：选择安装方式

发布目录提供两种 Windows x64 版本，功能和数据位置相同：

| 版本 | 文件 | 使用方式 |
|---|---|---|
| 安装版（推荐） | `Knowledge-Vault-Setup-1.1.2-win-x64.exe` | 双击安装，可选择安装目录；安装后从桌面或开始菜单启动 |
| 免安装版 | `Knowledge-Vault-Harness-Portable-1.1.2-win-x64.zip` | 完整解压 ZIP，再双击其中的 `Knowledge Vault.exe` |

不要直接在 ZIP 压缩包里运行程序。应用和知识库建议放在两个不同位置，例如：

```text
D:\Apps\Knowledge-Vault-Harness       # 应用程序
D:\Knowledge\My-Vault                 # 你的知识库
```

安装版和免安装版均已内置固定版本的 Node.js 与 DeepSeek Harness，不会在日常启动时静默升级，也不会修改系统 Node.js。

当前构建尚未使用商业代码签名证书。Windows SmartScreen 首次运行时可能显示风险提示；请先核对随包提供的 `.sha256` 文件，再从“更多信息”中确认运行。

### 第二步：启动应用

- 安装版：双击桌面或开始菜单中的 **Knowledge Vault**。
- 免安装版：双击解压目录中的 `Knowledge Vault.exe`。

应用会在自己的桌面窗口中打开，不需要外部浏览器，也不需要保留黑色命令行窗口。关闭桌面窗口后，本地 Harness 服务会一并停止。

首次启动显示的是模板预览，还不是你的正式知识库。

### 第三步：初始化自己的知识库

1. 点击左侧“新会话”下方的“初始化知识库”。
2. 选择一个空文件夹，或新建一个空文件夹。
3. 等待模板复制完成，Harness 会自动记住该位置并切换到新知识库。

初始化不会覆盖普通非空文件夹。一个有效的 Knowledge Vault 根目录至少包含 `AGENTS.md` 和 `01_Inbox/`。

如果桌面窗口无法使用文件夹选择器，可使用源码包中的 `Initialize-KnowledgeBase.cmd` 作为备用入口。

### 第四步：配置模型

1. 打开左下角“设置”。
2. 进入“模型”。
3. 选择现有提供方，或添加自定义提供方。
4. 填入自己的 API 密钥、API 地址、协议和模型 ID。
5. 保存后回到新会话，发送“你好”进行连接测试。

API 地址、协议和模型 ID 必须与模型服务商文档一致；配置不匹配通常会显示 `Connection error`。不要把 API 密钥写进 Markdown、脚本、截图或 Git 仓库。

### 第五步：开始使用

可以先尝试以下指令：

```text
知识收 D:\资料\项目数据.xlsx
```

`知识收` 用于把明确指定的 Excel、PDF、Word 或 PowerPoint 文件转换成尽量完整的 Inbox Markdown。PDF、Word、PowerPoint 含图文混排时，可直接指定原图附件模式：

```text
知识收 attachments D:\资料\项目说明.docx
```

也可以指定 `multimodal`，由当前支持图片输入的大模型识别图片中的文字、表格、图表和示意关系；未指定时，Agent 检测到图文混排后会询问一次。外部资料默认只读；Agent 只处理你明确指定的文件。完整指令说明见[四个 AI 指令](#四个-ai-指令)。

## 界面速览

| 位置 | 功能 |
|---|---|
| 新会话 | 开始一次新的知识问答或知识处理任务 |
| 初始化知识库 | 在指定的空目录创建自己的 Knowledge Vault |
| 选择知识库 | 在多个已经初始化的 Vault 之间切换 |
| 右侧工作栏 | 浏览目录，预览 Markdown、文本和代码文件 |
| 对话 | 与知识库 Agent 交流和执行知识指令 |
| 轨迹 | 查看 Agent 的执行过程和工具调用 |
| 图谱 | 浏览笔记之间可核验的显式关系 |
| 统计 | 查看知识规模、分布、健康提醒和最近更新 |
| 阅读 | 在主区域阅读从目录、图谱、统计或聊天依据链接打开的 Markdown 文档 |
| 设置 | 配置模型、API 密钥、插件和 Agent 预设 |

在“图谱”“统计”或问题清单中点击文件，会在右侧工作栏打开只读预览。聊天回答中的 `[[Vault相对路径|标题]]` 依据链接可以直接点击，应用会阻止网页跳转、在右侧定位文件，并自动切换到内置“阅读”页；外部网页链接仍按原方式打开。新版也兼容旧版标准 Markdown 链接，以及历史回答中因路径空格而显示成纯文本的 `[标题](路径.md)`，并自动恢复为可点击链接。

## 文件保存在哪里

| 数据 | 默认位置 | 说明 |
|---|---|---|
| 应用程序 | 安装时选择的目录，或免安装版解压目录 | 桌面壳、内置 Node.js、固定版 Harness 和产品插件；不要在这里存放正式知识 |
| 知识正文 | 初始化时选择的 Vault | Markdown、附件、索引、模板和 Obsidian 设置 |
| Harness 用户数据 | `%LOCALAPPDATA%\KnowledgeVaultHarness` | 模型设置、API 密钥、会话和生成的运行配置 |
| 知识收 Python 环境 | `%LOCALAPPDATA%\KnowledgeVaultHarness\dsh\runtimes\knowledge-capture` | 经用户同意后按需创建的隔离转换依赖；不写入系统 Python 或 Vault |

备份知识时主要备份自己的 Vault。复制应用目录不会自动备份模型设置和会话，删除应用目录也不会删除外部 Vault。

## Vault 的目录含义

```text
My-Vault/
|-- 01_Inbox/        # 新资料、AI 对话和待处理内容的唯一入口
|-- 02_Domains/      # 可跨项目复用的专业或业务知识
|-- 03_Areas/        # 需要长期维护的责任领域
|-- 04_Resources/    # 外部资料、文章、课程和工具参考
|-- 05_Skills/       # SOP、模板、提示词和工作流
|-- 06_Archive/      # 已处理、过时或仅用于追溯的材料
|-- 07_Attachments/  # 图片、PDF、音频、视频等附件
|-- .dsh/skills/     # Agent 运行时技能
|-- .agents/         # 路由与巡检脚本
|-- .obsidian/       # Obsidian 公共设置
|-- AGENTS.md        # 当前 Vault 的 Agent 规则
|-- 知识库首页.md
`-- 知识路由索引.md
```

`02_Domains` 和 `03_Areas` 不预置用户主题。等真实主题出现后再建立分类，可以避免产生大量空目录。

## 知识如何流转

```text
高保真来源笔记 -> knowledge-skill 原子卡片 -> knowledge-package 主题索引
```

- 来源笔记保留背景、原文、例外和追溯信息。
- 原子卡片独立回答一个稳定问题，并声明适用与排除边界。
- 主题索引将用户意图路由到一篇主文档和少量相关文档。

推荐的最短工作流是：

```text
知识收 -> 知识理 -> 知识联 -> 知识巡
```

## 常见问题

### 双击后桌面窗口打不开

- 确认免安装版已经完整解压，不能在 ZIP 预览窗口中直接运行。
- 查看 `%LOCALAPPDATA%\KnowledgeVaultHarness\logs\desktop.log`，其中会记录桌面壳和本地 Harness 的启动错误。
- 安装包当前未做商业代码签名；如果 SmartScreen 阻止启动，请先核对 `.sha256`，再从“更多信息”中确认运行。
- 如果桌面版仍无法启动，可进入源码发布包运行浏览器备用模式：

```powershell
./Start-DeepSeekHarness.ps1 -Port 3081
```

### 模型保存了但无法对话

依次检查 API 密钥、API 地址、协议、模型 ID、网络代理和服务商账户额度。提供方显示绿色只代表配置已经保存，不代表模型请求一定成功。

### 无法初始化知识库

请选择空文件夹；普通非空文件夹不会被覆盖。如果目录已经是 Knowledge Vault，应使用“选择知识库”，并确认根目录含有 `AGENTS.md` 和 `01_Inbox/`。

初始化器会让模板目录继承所选 Vault 根目录的 Windows ACL，使沙箱对 Vault 根目录取得的写权限能够继续传递到 Inbox、知识目录和附件目录。不要单独关闭这些目录的权限继承，否则知识收、知识理和知识联可能出现 `[WinError 5] 拒绝访问`。

### 知识收无法安装 PyMuPDF 等依赖

`pip` 已经下载包、随后在 `%APPDATA%\Python` 或系统 Python 目录报 `[WinError 5]` 时，根因通常是 Harness 的 `workspace-write` 沙箱拒绝写入 Vault 外目录，不是镜像下载失败。不要改用 `pip install --user`、Vault 内 `.venv`、临时目录或 `PYTHONPATH` 绕过。

在对话中同意安装后，Agent 会调用知识收启动器，并单独请求一次写入 Harness 用户数据目录的权限；依赖安装在产品专用隔离环境。也可以在所选 Vault 根目录手动运行：

```powershell
python ".dsh/skills/knowledge-capture/scripts/capture.py" --install-dependencies
```

只有默认 Python 包索引确实出现网络或证书错误时，再显式选择可信镜像：

```powershell
python ".dsh/skills/knowledge-capture/scripts/capture.py" `
  --install-dependencies `
  --index-url "https://pypi.tuna.tsinghua.edu.cn/simple"
```

安装后可用 `python ".dsh/skills/knowledge-capture/scripts/capture.py" --runtime-info` 检查隔离环境。图片识别由当前会话的多模态模型完成，不安装也不调用 Tesseract；当前模型不支持图片输入时，需要先切换模型。

### 卸载重装后，原知识库已经被删除

卸载程序会保留 `%LOCALAPPDATA%\KnowledgeVaultHarness` 中的模型设置、会话和上次选择的知识库路径。重新安装后，如果该知识库已被移动、删除或不再包含 `AGENTS.md` 与 `01_Inbox/`，应用会自动回退到安装包内的只读模板并正常打开，同时清理已失效的 Harness 工作区注册。请点击左侧“初始化知识库”创建新库，或使用“选择知识库”绑定已有库；这个恢复过程不会删除模型配置和会话日志。

### 右侧目录、图谱或统计没有更新

先点击对应页面的“刷新”。切换 Vault 后仍显示旧数据时，关闭并重新打开 Knowledge Vault。

### Windows 阻止运行下载的程序或脚本

右键 ZIP 或脚本文件，打开“属性”，勾选“解除锁定”后重新解压。也可以在 PowerShell 中进入应用目录，运行：

```powershell
./Install-KnowledgeBase.ps1
./Start-DeepSeekHarness.ps1
```

### 如何切换或备份知识库

点击左侧“选择知识库”切换。备份时复制整个 Vault 目录；不要只复制 `01_Inbox`。如果使用 Git，提交前检查附件和笔记是否含敏感信息。

## 功能说明

### 知识图谱（第一阶段）

“图谱”页签只读扫描当前知识库中的 Markdown 笔记。节点代表笔记，连线只来自可核验的显式关系：Obsidian `[[双向链接]]`、Markdown `.md` 链接，以及 frontmatter 的 `related`、`source_notes`、`parent_index`。第一阶段不会根据关键词或模型推断关系，也不会写回、移动或修改 Vault 文件。

图谱支持标题/路径搜索、一级目录、知识类型、状态、标签和关系类型筛选，可隐藏孤立节点，或在选中节点后查看两跳局部图。节点通过链接弹簧、局部排斥和目录弱聚类进行动态布局并自然稳定；拖动节点可调整关系布局，悬停节点会聚焦其直接邻居，拖动空白处可平移，滚轮可缩放，也可暂停或继续运动。点击“刷新”会重新读取磁盘上的 Markdown。未解析链接只计入状态统计，便于后续修正，不会虚构目标节点。

“图谱设置”可调整节点斥力、链接距离、目录聚类、中心引力、节点大小、连线粗细和标签数量；参数保存在本机 Harness 产品数据目录，可跨启动端口和应用重启继续使用，也可恢复默认或重置节点位置。可见节点达到 700 个时，布局自动交给 Web Worker 后台计算；超过 3000 个时默认暂停运动并限制标签数量，提示先通过目录、类型或“两跳局部图”缩小范围，用户仍可手动继续。Worker 无法启动时会自动回退到主线程，不影响只读浏览和筛选。

### Markdown 阅读器

右侧知识库浏览器会将 `.md` 文件渲染为 Markdown，而不是直接显示源文本；标题、列表、表格、任务清单、引用和代码块使用 Harness 的原生 Markdown 样式，YAML frontmatter 收纳在可展开的“文档属性”中，其中 `related`、`source_notes`、`parent_index` 里的 Obsidian 双链都可以直接点击跳转。原子卡片正文和聊天回答的“来源与关联”统一使用 `[[Vault相对路径|显示名]]`，并显示为醒目的可点击链接。阅读器也兼容 Obsidian 图片嵌入 `![[07_Attachments/...]]` 及标准 Markdown 相对图片和文档链接；图片通过限制在当前 Vault 内、仅允许图片格式的只读接口加载。点击预览标题栏的“放大阅读”，或点击聊天回答、来源笔记、所属索引和相关知识中的 Vault 文档链接，会切换到“统计”右侧的“阅读”页签并在主区域显示文档。阅读器正文中的相对 `.md` 链接也会基于当前文档目录继续在内置阅读器中打开；外部 URL、非 Markdown 文件和越出 Vault 根目录的路径不会被接管。阅读页支持刷新磁盘上的当前文件。非 Markdown 文本仍使用等宽纯文本预览，附件和超过预览大小限制的文件保持只读占位提示。

### 知识统计（第一版）

“统计”页签在本机只读扫描当前 Vault，不调用模型也不会修改知识内容。总览显示 Markdown 笔记、可检索知识、Inbox 待处理、附件、显式关系和知识库体积；内容分布按一级目录、`type`、`status` 和热门标签展示。

健康提醒包含 Inbox 待处理、`needs-review`、未解析的笔记链接、02–05 主目录中的孤立知识、`knowledge-skill` 必要元数据缺失以及到期复习。点击有问题的文件或最近更新文件，会在右侧知识库浏览器中打开只读预览。“刷新”会重新读取磁盘；初始化或选择其他 Vault 时会同时清空图谱和统计缓存。统计默认忽略 `.git`、`.dsh`、`.agents`、`.obsidian`、`.pnpm-store` 和 `node_modules` 等运行目录。

## 四个 AI 指令

| 指令 | 作用 | 产物 |
|---|---|---|
| `知识收 [路径]` | 将 Excel、CSV、PDF、Word、PowerPoint 转换为 Markdown | `01_Inbox` 来源笔记与必要图片附件 |
| `知识理 [方案] [文件]` | 按自定义或 AI 推荐方案提炼、分类并路由知识 | 原子卡片和归档来源 |
| `知识联` | 修正检索边界、补链接、更新索引 | 可检索的知识关系 |
| `知识巡` | 只读检查知识库健康度 | 巡检报告与建议 |

`知识收` 不再选择精简/保真；PDF、Word、PowerPoint 检测到图文混排时，只询问保留原图附件还是由多模态大模型识别图片。多模态模式通过 Harness 的 `read_image` 把临时图片作为原生图片输入交给当前模型，识别结果全部通过校验后才写入 Inbox；不使用 Tesseract 或其他 OCR 引擎。`知识理` 同样不再询问精简/保真，只提供两个选择：

- `用户自定义（custom）`：用户填写每篇来源要创建的卡片数量，以及每张卡片的标题或核心内容。
- `AI 推荐（recommend）`：大模型根据来源内容确定卡片数量与内容并直接执行。

两种方案使用相同的知识完整性、检索元数据、图片引用、索引更新和安全路由约束。文件转换阶段以最大程度保留源信息为目标；表格不静默抽样，无法还原的版式或对象写入转换说明。

`知识理` 按来源逐篇批处理，正常路径固定为三次工具调用：`prepare` 一次返回带证据标记的完整来源和紧凑契约，模型直接写一次 `cards.json`，随后 `apply --cleanup` 一次完成校验、渲染、反链、索引、定向路由和终检。流程禁止临时 builder 和重复打开来源或产物。存在 `needs-review` 卡片或路由失败时，来源继续留在 Inbox；全部卡片成功路由后才归档来源。

## DeepSeek Harness 底座

本项目通过锁文件固定 `@deepseek-ai/dsh@0.1.1-rc.2`，并使用 DSH 的 patch/plugin 机制完成自动装配：

- `vault-template/AGENTS.md` 是初始化后 Vault 的精简入口，只保留角色边界、全局安全规则和五个 Skill 的触发路由。
- `vault-template/.dsh/skills/` 提供 `vault-retrieve`、`knowledge-capture`、`knowledge-organize`、`knowledge-link` 和 `knowledge-audit` 五个按需技能。
- `.dsh/plugins/knowledge-vault-bootstrap/` 在每次启动时注册用户选定的 Vault，并提供界面内初始化、知识库选择、只读目录/文件接口、右侧知识库浏览器、Canvas 知识图谱和知识统计页；`graph-worker.js` 负责大图谱的后台物理布局。
- `.dsh/plugins/knowledge-vault-bootstrap/assets/bkcs-logo.png` 是欢迎页使用的 BKCS Logo；按 258×82 CSS 像素等比显示，不替换左侧 Knowledge Vault 品牌。
- `.dsh/plugins/knowledge-vault-bootstrap/assets/knowledge-vault-favicon.png` 是由灰橙 Z Logo 制作的透明图标，用于浏览器 favicon 和左侧栏 24×24 品牌标记；页面加载后标签标题固定为 `Knowledge Vault`。
- 初始化后的 `05_Skills/` 仍是 Obsidian 内的可复用知识；`.dsh/skills/` 是 Agent 运行时说明，两者不混用。
- `vault-template/.agents/scripts/knowledge_router.py` 是模板中的路由器，初始化后位于用户 Vault 的 `.agents/scripts/`。
- `vault-template/.dsh/skills/knowledge-organize/scripts/organize_batch.py` 将单篇来源的紧凑卡片 JSON 批量落盘，并把新知识包直接登记到对应分类表；未复核包显示“待完善”，不再另建“自动登记的知识包”区域。
- `vault-template/.dsh/skills/knowledge-capture/scripts/capture.py` 在 Harness 用户数据目录管理文档转换专用虚拟环境，统一调用转换器，避免运行时把依赖写入系统 Python 或 Vault。
- 模型设置、API 密钥、会话和生成的 DSH patch 保存在 `%LOCALAPPDATA%\KnowledgeVaultHarness`，不进入发布包或 Vault。

安装版和免安装版由 Electron 桌面壳承载页面；桌面壳会自动选择空闲的本机端口、启动固定版 Harness，并在退出时关闭该服务。普通用户不需要直接操作 Node.js 或浏览器。

从源码运行或排障时，可使用浏览器备用模式：

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

自检会先验证主线程动态图谱行为，并对 25、500、2000 个节点执行 Worker 布局基准；随后通过脚本初始化临时 Vault，再通过界面 API 初始化第二个 Vault并在两者之间切换，验证目录 ACL 继承、固定 DSH 版本、Web UI、工作区自动注册、右侧文件浏览接口、显式关系图谱、知识统计与缓存切换、Worker 静态资源、新建会话和 5 个项目技能。不调用模型，也不需要 API 密钥，结束后自动关闭服务并清理临时数据。

依赖构建脚本采用 pnpm 11 的逐包白名单，只放行当前锁文件中 DSH 和桌面构建所需的安装脚本；没有启用全局的 `dangerouslyAllowAllBuilds`。升级 DSH、Electron 或构建器时，应同步更新 `package.json`、`desktop/package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 并重跑集成测试。

DeepSeek Harness 目前仍是开发者预览版。本项目用固定版本和自有启动层降低上游变化的影响，但升级前仍需验证插件树、工作区 API 和技能发现。

## 第一次自定义

创建第一个主题目录时遵守编号规则：

```text
02_Domains/0201_你的专业主题
03_Areas/0301_你的长期领域
05_Skills/0502_你的可复用技能
```

编号是强制的层级编码：每一级在父编号后追加两位，从 `01` 开始按现有最大编号顺序递增。例如 `02_Domains` 下依次为 `0201_xxx`、`0202_xxx`，`0201_xxx` 的子目录依次为 `020101_xxx`、`020102_xxx`。路由时只填写语义名称，由脚本分配编号；不得跳号、重用已删除编号，或继续使用无编号及编号层级错误的目录。

路由器先跨 `02_Domains` 至 `05_Skills` 检查所有现有合规目录，再采用 AI 给出的语义分类。目录语义名与文件名或 YAML `title` 的精确或完整包含匹配优先级最高；目录 `_Index.md` 的 `title`、`aliases`、`triggers` 也用于识别跨语言和同义词，例如中文“工资”可命中 `0205_Salary` 的别名。仅存在唯一高相关候选时覆盖语义路由；找不到强匹配或候选并列时回退到 AI 判断。`06_Archive` 来源归档不会被该规则覆盖。

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

# 仅预览 JSON 清单中明确列出的 Inbox 笔记
python "vault-template/.agents/scripts/knowledge_router.py" --notes-file "notes.json" --strict
```

默认自动路由阈值为 `0.85`。目标只允许进入 `02_Domains`、`03_Areas`、`04_Resources`、`05_Skills` 或 `06_Archive`；同名文件不会被覆盖。`--notes-file` 接受 JSON 路径数组或 `{ "notes": [...] }`，路径必须指向当前 Vault 的 `01_Inbox`；配合 `--strict` 时，任一选定笔记无法路由都会返回非零状态。

## 共享与版本控制

模板包含 MIT License，可以复制、修改和分发。建议首次使用时初始化自己的 Git 仓库：

```powershell
git init
git add .
git commit -m "Initialize knowledge base"
```

提交前检查附件与笔记是否含敏感信息。不要把密码、令牌、账号、证件号或未经授权的业务数据提交到远程仓库。

生成 Windows x64 安装版和免安装版：

```powershell
./Build-DesktopDistribution.ps1
```

构建成功后会生成：

- `dist/Knowledge-Vault-Setup-1.1.2-win-x64.exe`
- `dist/Knowledge-Vault-Harness-Portable-1.1.2-win-x64.zip`
- 两个产物各自对应的 `.sha256` 文件

桌面构建会先执行完整自检，再生成独立生产依赖、内置当前 x64 Node.js、构建 NSIS 安装器、启动打包后的 EXE 做隔离冒烟测试，最后校验 ZIP 结构和哈希。若已经单独执行过完整自检，可使用 `-SkipValidation`；若锁定依赖已经安装，可额外使用 `-SkipDependencyInstall`。

生成包含脚本和源码的传统发布 ZIP：

```powershell
./Build-Distribution.ps1
```

默认产物为 `dist/Knowledge-Vault-Harness-1.1.2.zip` 和对应的 `.sha256` 文件。构建器会检查 ZIP 必需入口，排除 Git 历史、`node_modules`、缓存、Obsidian 私有布局和本机运行状态，并在发现常见凭据文件名时拒绝打包。发布前仍应人工检查知识正文和附件是否适合共享。

## 系统要求

- Windows 10/11 x64；桌面安装版和免安装版已内置 Node.js 与固定版本的 DeepSeek Harness。
- 从源码运行或构建时需要 Windows PowerShell 5.1+、Node.js 22.19+ 或 24+，并启用 Corepack。
- Python 3.10+ 用于知识收文档转换、知识路由、巡检和开发自检；普通聊天、目录浏览、图谱和统计不依赖 Python。知识收的第三方 Python 包按需安装在 Harness 用户数据目录的隔离环境中。
- 一个可用的模型 API 密钥及对应的 API 地址、协议和模型 ID；由每位用户单独配置，不随项目分发。
- Obsidian 为推荐工具，用于手工维护笔记、Properties、Bases 和双向链接；不是启动聊天界面的必要条件。

模板源的详细 Agent 规则已分别保存到 `vault-template/.dsh/skills/` 下的五个 `SKILL.md`；初始化后由 Vault 根目录的 `AGENTS.md` 按请求触发对应 Skill。
