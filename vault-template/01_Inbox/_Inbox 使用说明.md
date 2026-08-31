---
title: Inbox 使用说明
created: 2026-08-28 00:00
updated: 2026-08-28 00:00
type: moc
status: evergreen
tags:
  - inbox
  - knowledge-management
---

# Inbox 使用说明

`01_Inbox` 是唯一收集入口，只存放尚未完成提炼或仍需人工确认的来源笔记。

## 进入方式

1. 输入“知识收 文件路径”，把 Excel、CSV、PDF、Word 或 PowerPoint 只读转换为 Markdown。
2. PDF、Word、PowerPoint 含图文混排时，选择保留原图附件或 OCR 图片文字。
3. 使用 [[05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板|Inbox 收集模板]] 手工记录转换来源。

## 状态

- `inbox`：尚未分析。
- `needs-review`：分类或内容需要人工确认。
- `ready`：已完成分析，可以由路由脚本移动。

“知识收”只转换文件并创建尽量完整的来源笔记，不选择精简/保真模式；“知识理”再按所选模式创建原子卡片并路由。高置信度卡片进入 `02_Domains` 至 `05_Skills`，处理后的来源进入 `06_Archive`，原图模式的图片统一放入 `07_Attachments`。
