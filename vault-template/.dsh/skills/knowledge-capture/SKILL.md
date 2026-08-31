---
name: knowledge-capture
description: 当用户输入“知识收”并希望把明确提供的 Excel、CSV、PDF、Word 或 PowerPoint 文件转换为 Obsidian Markdown 时使用。生成结构清晰、尽量完整、可追溯的 Inbox 来源笔记，并按用户选择处理图文混排；不用于知识拆卡、路由或归档。
---

# 知识收：文档转 Markdown

## 目标与边界

`知识收` 的主要产物是 `01_Inbox/` 中可直接阅读的 Markdown 来源文档。整理标题、段落、列表、表格、图片位置、页码和备注，但最大程度保留源文件信息，不用摘要替代正文，不提炼原子卡片，不直接归档或路由。

- 不再询问“精简模式 / 保真模式”，也不接受这两个模式作为 Capture 的分支。
- 没有文件或路径时，请用户提供要转换的文件；不要把普通对话自动写入 Inbox。
- 只读处理源文件。不得移动、覆盖、重算或另存回源文件。
- 支持 `.xlsx`、`.xlsm`、`.csv`、`.tsv`、`.pdf`、`.docx`、`.pptx`。旧格式 `.xls`、`.doc`、`.ppt` 必须先用兼容软件转换为新版格式，不能只改扩展名。

## 唯一需要询问的模式

先运行检测命令：

```powershell
python ".dsh/skills/knowledge-capture/scripts/document_to_markdown.py" --inspect "<源文件>"
```

仅当 PDF、Word 或 PowerPoint 含图片、图表、扫描页等图文混排内容时，且用户尚未指定处理方式，询问一次：

1. **原图图文模式（attachments）**：把图片按原出现位置复制到 `07_Attachments/`，在 Markdown 对应位置嵌入，保留图文关系。
2. **OCR 文本模式（ocr）**：识别图片文字并插入原位置，与其他正文共同形成 Markdown；默认不在正文重复嵌入原图。

检测不到图片时直接转换，不提问。Excel/CSV/TSV 默认完整转换单元格；Excel 中确有嵌入图片时按原图附件处理，不触发上述二选一。用户已明确 `attachments` 或 `ocr` 时不得重复询问。

## 快速执行

用户完成必要选择后，优先一次运行统一脚本，不手工逐页重写：

```powershell
python ".dsh/skills/knowledge-capture/scripts/document_to_markdown.py" `
  "<源文件>" `
  --vault-root "." `
  --mode attachments
```

无图片时使用 `--mode text`；OCR 模式使用 `--mode ocr`。脚本会：

- 计算 SHA-256，记录源文件大小和修改时间；
- 按源文档顺序提取正文、表格、页/幻灯片结构和图片锚点；
- 创建不覆盖同名文件的 `01_Inbox/YYYY-MM-DD HHmm - 标题.md`；
- 原图模式下创建合规编号的 `07_Attachments/07xx_标题/`；
- 输出 JSON 清单，供完成前一次性核验。

如果脚本报告缺少依赖，先查看 `scripts/requirements.txt`。安装 Python 包或 OCR 引擎会改变用户环境，必须在执行安装前取得用户许可；不得反复尝试不同转换工具。OCR 引擎不可用且用户不允许安装时，说明阻塞，不得把未识别图片声称为完整文本。

## 输出要求

使用 `05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板.md` 的精简结构：

1. 保留 YAML frontmatter，至少包含标题、时间、来源文件、哈希、格式、转换方式、`type: source`、`status: inbox` 和 `retrieval_priority: low`。
2. 正文只使用还原结构所需的标题、段落、列表、表格、代码块、引用、分页/幻灯片标识和图片/OCR 块。
3. 可以修复断行、空白、明显的阅读顺序和标题层级；不得静默删除、总结、改写事实或合并含义不同的重复内容。
4. 不能可靠转换的公式、图表、批注、动画、宏、复杂版式或受保护内容，写入简短的“转换说明”，不得伪造。
5. 不生成“30 秒摘要”“完整知识清单”“建议提炼卡片”等与文件转换无关的固定章节。

各格式的完整性规则和可接受偏差见 [references/conversion-rules.md](references/conversion-rules.md)。只有实际处理相应格式时才读取该参考。

## 完成前核验

1. 源文件大小、修改时间和 SHA-256 与转换前一致。
2. Markdown 文件实际存在，YAML 可解析，正文不是空文档。
3. 表格未被静默抽样；页、幻灯片、工作表顺序与源文件一致。
4. 原图模式下，每个图片引用都能解析到 `07_Attachments/` 中的实际文件，位置说明与源文档一致。
5. OCR 模式下，识别失败或低置信内容有明确标记，没有把猜测写成原文。
6. 报告 Markdown 路径、附件目录、转换方式及所有保真偏差。

## 安全底线

- 不写入密码、令牌和登录凭据。
- 银行账号及其他敏感业务或个人信息默认不入库；只有用户对指定文件和范围明确授权时才保留，并记录授权边界。
- 来源在 Vault 外时默认只读；临时文件放入系统临时目录并在完成后清理。
- 不覆盖已有 Inbox 文档或附件；同名时使用递增编号。
