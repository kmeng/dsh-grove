# 开发理念

这套规则回答一个问题：**换一个 AI 工具、换一次会话，怎么保证质量不塌。**

## 两条来源

| 来源 | 贡献了什么 |
| --- | --- |
| Maestro（`CLAUDE.md`、`docs/governance.md`） | 会话协议：开工前先读状态、实现前先对齐验收、一个 PR 一个任务、硬规则、Bug 测试先行、AI 署名 |
| 案随（`guard-template/principles/`） | 原则层：Epic→Story→DEV/BUG 的分层、DoD、评审清单、两层强制模型、决策日志 |

Grove 只搬了**可迁移**的部分：与团队人数、模型价格、内部系统相关的规则没有带过来。

## 两层强制模型

| 判断类型 | 谁来执行 | 载体 |
| --- | --- | --- |
| 可机检（测试是否绿、包清单对不对、兼容性判定、链接是否可达） | 脚本与测试 | `npm test`、`scripts/check-compat.mjs`、CI |
| 要人判断（闭环是否完整、验收是否真的过、根因是否正确） | 人 + 评审 | [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md)、[`REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) |

> 守卫只能证明"评论里有证据词"，证明不了"功能真的验收过"。
> 证据是代理指标，关闭仍是人的判断——所以本仓库先把规则写成可读契约，再谈机检。

## 文档地图

| 文件 | 回答的问题 |
| --- | --- |
| [`../../AGENTS.md`](../../AGENTS.md) | 开工要做什么、硬规则是什么 |
| [`ISSUE_HIERARCHY.md`](ISSUE_HIERARCHY.md) | 任务怎么分层、怎么拆才是一个闭环 |
| [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) | 什么算做完 |
| [`REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) | 评审时逐条看什么 |
| [`DECISIONS.md`](DECISIONS.md) | 已经定下的决定和理由 |
| [`HANDOFF.md`](HANDOFF.md) | 会话之间怎么交接 |

## 怎么用

- **Claude Code** 自动读 `CLAUDE.md` → 指向 `AGENTS.md`。
- **Codex / DSH / Aider / Zed / Cursor（新版）** 原生读 `AGENTS.md`。
- **Cursor（旧版）** 读 `.cursor/rules/project.mdc`。
- **GitHub Copilot** 读 `.github/copilot-instructions.md`。

四个入口都只是指针，规则只有一份——改规则只改 `AGENTS.md` 与 `docs/development/`。
