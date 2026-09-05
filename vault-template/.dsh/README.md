# Knowledge Vault Agent Skills

本目录随 Vault 模板初始化到用户知识库根目录。

- `skills/` 保存知识检索、收集、整理、关联和巡检的 Agent 工作流。
- `skills/knowledge-capture/scripts/capture.py` 从 Vault 外的 Harness 用户数据目录加载隔离文档转换依赖；不得在 Vault 内创建虚拟环境。
- `skills/knowledge-organize/scripts/organize_batch.py` 通过“prepare 返回来源与目录上下文、判断主主题及目录、写一次 cards JSON、apply 一次完成”的路径执行单篇整理；有歧义时写入前集中询问，用户确认的主题归属由脚本保存在 `.agents/routing-preferences.json`。
- Vault 的完整执行规则位于根目录 `AGENTS.md`。
- 模型密钥、会话和 Harness 用户配置不得保存在本目录。
