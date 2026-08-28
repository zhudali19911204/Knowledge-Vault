# DeepSeek Harness 项目配置

本目录只保存 DeepSeek Harness（`dsh`）的应用集成、启动补丁模板和工作区引导插件，不保存模型密钥、会话记录或知识正文。可初始化的 Vault 配置集中在 `../vault-template/`。

## 加载关系

- Vault 规则：模板源为 `../vault-template/AGENTS.md`，初始化后位于用户 Vault 根目录并由 workspace instructions 机制加载。
- 按需技能：模板源为 `../vault-template/.dsh/skills/<skill-name>/SKILL.md`，初始化后由 filesystem skill provider 发现。
- 自动绑定：`plugins/knowledge-vault-bootstrap/index.js` 通过 `workspaceRegistry` 注册启动器传入的 Vault 根目录，并提供只读的目录与文件预览接口。
- 客户端界面：`plugins/knowledge-vault-bootstrap/client.js` 替换产品品牌，并将知识库目录树和文本预览固定在右侧工作栏。
- 启动补丁：`cordis.patch.template.yml` 由启动器复制到用户数据目录；启动器同时将三个产品插件文件同步到所选 DSH profile 的本地包目录，供主进程和前端按包名加载。
- 知识正文：模板源保存在 `../vault-template/01_Inbox/` 至 `07_Attachments/`，初始化后展开到用户 Vault 根目录。
- 知识路由：模板源为 `../vault-template/.agents/scripts/knowledge_router.py`，初始化后从用户 Vault 内执行。

## Vault 技能

| 技能 | 触发场景 |
|---|---|
| `vault-retrieve` | 回答可能与本 Vault 有关的问题 |
| `knowledge-capture` | `知识收` |
| `knowledge-organize` | `知识理` |
| `knowledge-link` | `知识联` |
| `knowledge-audit` | `知识巡` |

这些技能是随模板安装的 Agent 工作流说明，不属于 Obsidian 的 `05_Skills/` 知识内容，两者不要互相路由。

## 安全

DeepSeek API 密钥只在 dsh 的“设置 → 模型”中配置。默认 DSH HOME 为 `%LOCALAPPDATA%\KnowledgeVaultHarness\dsh`，生成的补丁位于相邻的 `generated/` 目录。不要把这些用户数据、密钥或会话复制回本目录或放入发布包。
