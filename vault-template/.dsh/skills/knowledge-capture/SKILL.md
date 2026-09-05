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
python ".dsh/skills/knowledge-capture/scripts/capture.py" --inspect "<源文件>"
```

Windows 中文路径必须作为独立参数传给 `capture.py`；排错也先用 `--inspect`，不要临时拼接 `python -c` 或把含路径的 Python 代码通过管道执行来绕过预检。错误日志里的 `�` 可能来自输出解码，不能仅凭乱码认定实际路径已损坏。

预检返回 `source_not_found` 时核对完整路径；`source_unreadable` 表示还没开始解析，应先检查文件占用，再检查读取权限及 OneDrive 本地可用状态；`invalid_document_package` 表示文件可读但文档包无效，需核对真实格式、加密或损坏情况。文件被占用时请用户关闭对应 Office/WPS 或预览窗口，释放后只重试原来的 `--inspect`，不通过换解析库或安装依赖处理文件锁。

仅当 PDF、Word 或 PowerPoint 含图片、图表、扫描页等图文混排内容时，且用户尚未指定处理方式，询问一次：

1. **原图图文模式（attachments）**：把图片按原出现位置复制到 `07_Attachments/`，在 Markdown 对应位置嵌入，保留图文关系。
2. **多模态识别模式（multimodal）**：把临时图片作为原生图片输入提交给当前会话的模型服务商，由支持图片输入的大模型读取，并在原位置插入忠实的文字、表格、图表或示意关系识别结果；默认不在正文重复嵌入原图。

检测不到图片时直接转换，不提问。Excel/CSV/TSV 默认完整转换单元格；Excel 只把单元格实际值写入 Markdown，不写入公式表达式，也不重算工作簿。Excel 中确有嵌入图片时按原图附件处理，不触发上述二选一。用户已明确 `attachments` 或 `multimodal` 时不得重复询问。

## 快速执行

用户完成必要选择后，优先一次运行统一脚本，不手工逐页重写：

```powershell
python ".dsh/skills/knowledge-capture/scripts/capture.py" `
  "<源文件>" `
  --vault-root "." `
  --mode attachments
```

无图片时使用 `--mode text`。脚本会：

- 计算 SHA-256，记录源文件大小和修改时间；
- 按源文档顺序提取正文、表格、页/幻灯片结构和图片锚点；
- 创建不覆盖同名文件的 `01_Inbox/YYYY-MM-DD HHmm - 标题.md`；
- 原图模式下创建合规编号的 `07_Attachments/07xx_标题/`；
- 输出 JSON 清单，供完成前一次性核验。

PowerPoint 中个别图片未内嵌、引用失效或无法读取时，脚本继续转换其余内容，并在原位置及“转换说明”中标明幻灯片、对象和原因。必须向用户报告这些缺失，不得宣称图片已全部提取；不读取外链目标，也不生成无效附件引用。附件或笔记写入失败仍按转换失败处理。

### 多模态识别

多模态模式不调用任何本地或外部 OCR 引擎，也不安装 Tesseract。固定执行以下流程：

1. **准备一次**：

   ```powershell
   python ".dsh/skills/knowledge-capture/scripts/capture.py" `
     "<源文件>" `
     --vault-root "." `
     --mode multimodal
   ```

   返回 `status: needs_multimodal` 时，记录 `manifest`、尚不存在的 `results_file` 及图片清单。此时尚未写入 Inbox；图片只存在于系统临时任务目录。

   没有可提取图片时，脚本直接返回 `status: ok` 并写入文本及转换说明；此时不执行后续读图和应用步骤，仍需报告 `warnings` 中的缺图信息。

2. **逐图读取、一次写结果**：仅对清单中 `model_readable: true` 的每个 `path` 调用 `read_image`，按原顺序识别全部可见信息。文字要忠实转写；表格要保留行列；图表要记录标题、轴、图例、数值和可直接观察的关系；流程图或示意图要保留节点与连接。不得补全看不清的文字、数值或关系。识别完成后按 `results_contract` 一次创建 `results_file`，每项写入对应 `id`、`markdown`、`confidence` 和实际存在的 `uncertainties`，不得先读或覆盖该文件。

   如果 `read_image` 报告当前模型不支持图片输入，立即停止并请用户切换到支持图片的多模态模型；不得退回 OCR、Tesseract、其他识别程序或网页服务。模型读取失败或低置信时，在结果中明确写 `[多模态模型未能可靠识别]` 或具体不确定项，不得猜测。

3. **一次应用并清理**：

   ```powershell
   python ".dsh/skills/knowledge-capture/scripts/capture.py" `
     --apply-multimodal "<manifest>" `
     --results "<results_file>" `
     --vault-root "." `
     --cleanup
   ```

   脚本会校验来源哈希、临时图片、结果 ID、置信度和占位符，验证通过后才原子写入 Inbox 并删除临时任务目录。校验失败时只修正 `results_file` 后重试应用，最多两次；不得直接编辑草稿或跳过未识别图片。

如果脚本报告缺少依赖，先查看 `scripts/requirements.txt`，并明确告知用户需要下载的包和用途。安装 Python 包会改变用户环境，必须在执行安装前取得用户许可；不得反复尝试不同转换工具。

用户同意安装 Python 依赖后，只使用启动器创建 Harness 专用隔离环境，不得直接执行系统级或 `--user` 级 `pip install`，也不得把包安装到 Vault、临时目录后再拼接 `PYTHONPATH`：

```powershell
python ".dsh/skills/knowledge-capture/scripts/capture.py" --install-dependencies
```

该命令把环境写入 `DSH_HOME/runtimes/knowledge-capture/`（默认位于 `%LOCALAPPDATA%/KnowledgeVaultHarness/dsh/runtimes/`），不进入 Vault。Windows 的 `workspace-write` 沙箱首次会拒绝这个 Vault 外写入；看到 `[WinError 5]`、`Access is denied` 或 sandbox denial 后，应在同一轮仅对完全相同的安装命令请求 `sandbox_permissions: danger-full-access`，用一句话说明需要在 Harness 用户数据目录创建隔离依赖环境。用户拒绝权限升级后立即停止，不得改用其他目录规避沙箱。安装耗时较长时使用后台任务并收集最终退出状态，不要让前台 300 秒超时被误判为安装失败。

只有默认包索引确实发生网络或证书错误时，才允许在用户知情后把同一启动器命令改为可信镜像；例如：

```powershell
python ".dsh/skills/knowledge-capture/scripts/capture.py" `
  --install-dependencies `
  --index-url "https://pypi.tuna.tsinghua.edu.cn/simple"
```

镜像命令如需写入 Vault 外目录，仍按上一段处理一次性权限升级。安装成功后重新运行原来的 `--inspect`，不要继续安装无关包。图片理解只使用当前会话的多模态模型，不属于 Python 依赖安装范围。

## 输出要求

使用 `05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板.md` 的精简结构：

1. 保留 YAML frontmatter，至少包含标题、时间、来源文件、哈希、格式、转换方式、`type: source`、`status: inbox` 和 `retrieval_priority: low`。
2. 正文只使用还原结构所需的标题、段落、列表、表格、代码块、引用、分页/幻灯片标识、原图或多模态识别块。
3. 可以修复断行、空白、明显的阅读顺序和标题层级；不得静默删除、总结、改写事实或合并含义不同的重复内容。
4. Excel 公式单元格只输出源文件中已缓存的实际值，不输出公式表达式；没有缓存值时留空并在“转换说明”列出对应单元格，不调用 Excel、LibreOffice 或其他工具重算。其他不能可靠转换的公式、图表、批注、动画、宏、复杂版式或受保护内容，也写入简短的“转换说明”，不得伪造。
5. 不生成“30 秒摘要”“完整知识清单”“建议提炼卡片”等与文件转换无关的固定章节。

各格式的完整性规则和可接受偏差见 [references/conversion-rules.md](references/conversion-rules.md)。只有实际处理相应格式时才读取该参考。

## 完成前核验

1. 源文件大小、修改时间和 SHA-256 与转换前一致。
2. Markdown 文件实际存在，YAML 可解析，正文不是空文档。
3. 表格未被静默抽样；页、幻灯片、工作表顺序与源文件一致。
4. 原图模式下，每个图片引用都能解析到 `07_Attachments/` 中的实际文件，位置说明与源文档一致。
5. 多模态模式下，所有可读图片都有对应结果；识别失败、不可读格式或低置信内容有明确标记，没有把猜测写成原文。
6. 报告 Markdown 路径、附件目录、转换方式及所有保真偏差。

## 安全底线

- 不写入密码、令牌和登录凭据。
- 银行账号及其他敏感业务或个人信息默认不入库；只有用户对指定文件和范围明确授权时才保留，并记录授权边界。
- 来源在 Vault 外时默认只读；临时文件放入系统临时目录并在完成后清理。
- 不覆盖已有 Inbox 文档或附件；同名时使用递增编号。
