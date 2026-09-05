# Agent 规则：Knowledge Vault Harness 产品工程

默认使用中文。项目根目录是应用程序工程，不再作为 Obsidian Vault；可初始化的 Vault 模板位于 `vault-template/`。

处理知识库内容、路由、检索或知识管理规则前，必须读取并遵守 `vault-template/AGENTS.md`。该文件定义初始化后 Vault 的完整目录、元数据、触发指令与安全规则。

## 工程边界

- `vault-template/`：用户知识库的唯一模板源。
- `.dsh/plugins/` 与 `.dsh/cordis.patch.template.yml`：Harness 产品插件和启动装配配置。
- 根目录 PowerShell/CMD、`package.json` 与锁文件：安装、初始化、启动、测试和构建入口。
- 不把模型密钥、会话、用户运行数据、`node_modules`、`.pnpm-store` 或构建产物复制进 `vault-template/`。
- 初始化时将 `vault-template/` 的内容展开到用户选择的 Vault 根目录；不要在用户 Vault 中额外保留一层 `vault-template`。
- 外部 Vault 和外部资料默认只读，除非用户明确要求初始化或修改该目标。

修改目录布局时，同步检查初始化、启动、自检、构建脚本和 README；未经用户要求不生成发布包。

## 对话临时文件

- Agent 在对话中临时创建的辅助脚本、调试文件和中间产物，统一放在当前工作区的 `.agents/tmp/<本次任务唯一标识>/` 下，并记录本次创建的路径。
- 使用 `try/finally` 等方式保证异常时也清理；任务结束、发送最终回复前，必须删除本次临时内容并核验不存在。对话中断后恢复时，先核对并清理本次遗留内容。
- 删除前核实解析后的绝对路径属于本次临时目录；保留 `.agents` 中的正式脚本、配置及其他任务的文件。临时内容不提交、不进入初始化副本或发布包。
