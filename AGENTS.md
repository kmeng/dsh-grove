# Grove · 开发契约

> 任何 AI 工具先读这一份。`CLAUDE.md`、`.cursor/rules/project.mdc`、`.github/copilot-instructions.md` 都只是指向它的适配器，内容不复制。
> 这套规则迁移自 Maestro 的会话协议与案随 `guard-template` 的原则层，去掉了与团队规模、模型价格、内部链接相关的部分。

## 这个仓库是什么

- 一个 DeepSeek Harness（dsh）插件，也是 dsh 的一个 **bundle**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，往宿主 composition 里插一行 `grove`。
- Host-only，没有 Web 界面；对外能力是三个模型工具（`grove_role` / `grove_propose` / `grove_read`）加一个终端 CLI。
- 用户数据在**用户的** Obsidian vault 里，仓库不保存任何用户内容。写测试只用临时目录。
- 支持范围由 `engines.dsh` 声明：`>=0.2.2-rc.1 <0.3.0`。

## 开工协议（每个新会话先做）

1. 读 `docs/journal/` 里最新的一篇，知道上一次停在哪。
2. `gh issue list --state open` 看还在跑什么。
3. `git status` 与 `git branch --show-current`，确认工作区干净、分支是预期的。
4. 用三句话复述：项目现在在哪、开着什么、我理解你要做什么。
5. 等确认再动手。只读问题（"这个字段什么意思"）可以把 4 压成一句话直接答。

在 PR 合并、issue 关闭、重大决定之后，主动提议补一篇 `docs/journal/`，不要自己判定会话结束。

## 改动流程

### 1. 先分析

把需求复述成可检查的验收标准：做什么、不做什么、怎么证明。写下"完成"的判定条件，再往下走。

### 2. 再设计

非平凡改动先给方案：动哪些文件、接口/数据形状变不变、失败模式是什么。有长期后果的决定（依赖、宿主契约、存储格式）写进 [`docs/development/DECISIONS.md`](docs/development/DECISIONS.md)。

### 3. 拆成闭环

一个 PR = 一个闭环 = 一个可验证的结果。禁止"只加接口没有调用方"的半成品。拆解方式见 [`docs/development/ISSUE_HIERARCHY.md`](docs/development/ISSUE_HIERARCHY.md)。

### 4. 实现

- 分支：`fix/<issue>-<slug>`、`feat/<issue>-<slug>`、`docs/<issue>-<slug>`。
- 提交：Conventional Commits（`fix:` / `feat:` / `docs:` / `test:` / `chore:`），正文说**为什么**。
- 一个 PR 尽量只有一个主题；顺手改的格式放在独立提交里说明。

### 5. 验证（本仓库的最小证据）

四条都要跑，少一条就是没做完：

```sh
npm ci && npm test                 # 单测 + manifest/资产契约
npm pack --dry-run --json          # 必须含 icon/locale/docs/src/patch，不能含 test/ brand/
bash scripts/check-compat.sh       # 用运行中的 dsh 判定 engines.dsh 是否真的兼容
bash scripts/verify-install.sh     # 临时 profile 里真装一次，确认 grove 行出现后自动清理
```

改动了 bundle 加载行为（`cordis.patch.yml`、`engines`、入口文件）时，四条都要跑；只改文档或品牌素材时，前两条足够。

改了图标或 locale 时，用宿主的 `readPluginMeta` 确认 title/description/icon 都读得到，而不是"看起来没问题"。

### 6. 交付

PR 描述按 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)：改了什么、关键文件、实测命令与真实输出、风险与未覆盖、`Closes #n`。没跑过的不要写成跑过。

## 硬规则

| 编号 | 规则 |
| --- | --- |
| H1 | **不提交密钥**。提交前扫 `sk-`、`Bearer `、`password`、`token`、`api_key`；`.env`、`*.key` 永远在 `.gitignore`。 |
| H2 | **不直推 `main`**。所有改动走分支 + PR；`main` 靠约定保护。 |
| H3 | **破坏性操作先说明再执行**。`rm -rf`、`git reset --hard`、`push -f`、覆盖文件、删远端分支：先说清楚目标和影响，再做。 |
| H4 | **不编造内容**。没读过的文件不说读过，没跑过的命令不说通过；用户说"等我贴"就停下等。 |
| H5 | **不确定就说不确定**，并说明缺什么信息才能确认。 |
| H6 | **先给计划再动手**，一次改动不要打包多个猜测性步骤。 |
| H7 | **保护文档**：`AGENTS.md`、`README.md`、`brand/VI*.md`、`docs/development/*` 的修改要单独一个 issue/PR，不能夹带在功能改动里。 |

## Bug 协议

失败测试先行，顺序不能反：

1. 复现 → 写一个会失败的测试；
2. 提交这个测试（说明它为什么失败）；
3. 修复 → 测试转绿；
4. 提交修复；
5. PR 里两个提交按这个顺序排列。

修的是根因而非症状；根因写进 issue。确实无法自动化的，写进 `docs/development/DECISIONS.md` 的"已知限制"，并在代码里留注释指向它。

## Definition of Done

完整清单见 [`docs/development/DEFINITION_OF_DONE.md`](docs/development/DEFINITION_OF_DONE.md)。摘要：验收标准逐条有证据、测试全绿、真实安装验证过、文档同步、没有密钥与调试残留、`main` 合并后仍然可装可用。

## 沟通

- 先给结论和计划，不要用安慰性废话填充。
- 不确定的事直说"我不确定"，不要用自信的语气掩盖猜测。
- 任务含糊时问一个关键问题，不要连问五个。
- 报错按"什么失败 / 为什么 / 下一步"三句话。

## AI 署名

AI 产出实质代码时在提交信息末尾标注实际模型：

```
Co-authored-by: deepseek-flash <noreply@deepseek.com>
Co-authored-by: claude-opus <noreply@anthropic.com>
```

多个模型参与就写多行；不确定模型名就留空，不要编。

## 文档地图

| 文件 | 作用 |
| --- | --- |
| [`docs/development/README.md`](docs/development/README.md) | 理念总览与来源 |
| [`docs/development/ISSUE_HIERARCHY.md`](docs/development/ISSUE_HIERARCHY.md) | 任务分层与拆分方式 |
| [`docs/development/DEFINITION_OF_DONE.md`](docs/development/DEFINITION_OF_DONE.md) | 各类任务的关闭条件 |
| [`docs/development/REVIEW_CHECKLIST.md`](docs/development/REVIEW_CHECKLIST.md) | 评审清单 |
| [`docs/development/DECISIONS.md`](docs/development/DECISIONS.md) | 决策日志与既有决定 |
| [`docs/development/HANDOFF.md`](docs/development/HANDOFF.md) | 跨会话交接与 journal 约定 |
| [`brand/VI.md`](brand/VI.md) | 视觉规范（中文） |
| [`docs/DETAIL.zh.md`](docs/DETAIL.zh.md) | 插件详情页文案 |

英文版本：[`AGENTS.en.md`](AGENTS.en.md)
