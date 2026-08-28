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

1. 在 AI 对话中输入“知识收”。
2. 输入“知识收 文件路径”，只读收集指定资料。
3. 使用 [[05_Skills/0501_Knowledge Management/050101_Templates/Inbox 收集模板|Inbox 收集模板]] 手工记录。

## 状态

- `inbox`：尚未分析。
- `needs-review`：分类或内容需要人工确认。
- `ready`：已完成分析，可以由路由脚本移动。

“知识收”只创建来源笔记；“知识理”再创建原子卡片并路由。高置信度卡片进入 `02_Domains` 至 `05_Skills`，处理后的来源进入 `06_Archive`，附件统一放入 `07_Attachments`。
