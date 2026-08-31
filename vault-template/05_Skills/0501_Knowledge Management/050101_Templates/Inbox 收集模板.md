---
title: "{{title}}"
created: "{{date}} {{time}}"
updated: "{{date}} {{time}}"
source: file-conversion
source_file: "{{source_file}}"
source_path: "{{source_path}}"
source_format: "{{source_format}}"
source_bytes: {{source_bytes}}
source_modified: "{{source_modified}}"
source_sha256: "{{source_sha256}}"
conversion_mode: "{{text|attachments|ocr}}"
type: source
status: inbox
description: >
  由原始文件转换生成的来源文档；保留原始结构并记录不可转换项。
aliases: []
domain: []
project:
maturity: seed
retrieval_priority: low
route_to:
tags:
  - inbox
  - file-conversion
related: []
---

# {{title}}

> [!info] 转换来源
> `{{source_file}}` · {{source_bytes}} bytes · `{{conversion_mode}}`

{{按源文件顺序转换的正文、表格、列表、分页/幻灯片和图片或 OCR 内容}}

<!-- 仅在存在无法转换、识别失败或版式偏差时添加“## 转换说明”。 -->
