# Grove（知林）

![Grove 知林，积累可回看、可修正的知识](brand/exports/readme-header-1600x480.zh.png)

Grove 是一个连接 DeepSeek Harness 与 Obsidian 的个人知识成长插件。它让你从一个念头或问题开始，与 AI 自由讨论，把值得留下的内容存进自己的 Obsidian vault，并在需要时追踪研究证据。

## 愿景与设计原则

**帮助人积累可回看、可修正的知识，在长期探索中形成自己的判断。** 今天记下的疑问，几个月后可能和一篇新读到的论文连起来。以前的判断也可以随新证据修订，并保留当时的依据。Grove 源于个人知识与认知成长系统（PKGS）的构想。当前插件从自由探索、自主保存和基础研究做起，让过去的思考能成为下一次探索的起点。

- **探索是常态，研究是选择，成果自然生长。** 可以从模糊的念头聊起，随时停下。值得保留的内容可以记成灵感或开放问题，由你决定何时深究、是否形成成果。
- **让判断有据可查，也有修正的余地。** 记录证据的出处和定位，并把支持、反驳或限定的证据连到具体版本。新的证据可以改变判断，旧版本仍可回看。
- **AI 是思考伙伴，判断和知识由人掌握。** AI 可以追问、提出不同解释、帮你起草。你决定采纳什么、保存什么、分享什么。知识以 Markdown 保存在自己的 Obsidian vault 中，可以阅读、编辑和迁移。

## 安装 v0.1.1

需要 Node.js 22 或更高版本、一个已有的 Obsidian vault，以及 DeepSeek Harness `>=0.2.2-rc.1 <0.3.0`。兼容范围由 `engines.dsh` 声明：它必须是范围而不是某一个精确版本，否则 dsh 会把整个 bundle 判为不兼容并跳过加载。

### 装进现有的 Harness

| 入口 | 做法 |
| --- | --- |
| Desktop | **Plugins → Add plugin**，选择本仓库目录；按目录安装会装成 `link:`，改完代码重启宿主即生效 |
| 会话里 | 让 agent 调用 `plugin_manager` 的 `install_bundle`，`target` 传目录绝对路径 |
| CLI | `dsh plugin --profile <profile> add <目录或 tgz>`。Desktop 的 profile 由 App 管理，命令行装进 `profiles/web` 不会出现在 Desktop |

装完在 **Plugins** 页确认 Grove 这一条出现，并在新会话里让模型调用 `grove_role`——工具真的注册上才算装好。

### 独立 profile 试用（不碰日常配置）

```sh
export GROVE_VAULT="/absolute/path/to/Obsidian vault"
npx --yes @deepseek-ai/dsh@0.2.2-rc.3 plugin --profile grove add "$PWD"
npx --yes @deepseek-ai/dsh@0.2.2-rc.3 --profile grove
```

独立配置只初始化一次；已有 `grove` 配置时直接安装或启动。用独立配置试用，确保宿主的 Bash、文件编辑、通用自动化和其他扩展无法访问 vault 或代你运行本地确认命令。Grove 自身的模型工具只有角色提示、草稿和白名单查询。普通 Harness 会话仍遵循宿主的模型路由、权限和历史保留设置。

### 命令行工具

`grove` 命令来自包里的 `bin`，要全局安装才有；把插件装进某个 profile **不会**把它加进 PATH：

```sh
npm pack --pack-destination /tmp
npm install --global /tmp/dsh-grove-0.1.1.tgz
```

## 日常使用

1. 终端执行 `grove capture --body '为什么组织扩大后协调成本会上升？'`。在 Obsidian 中打开 vault 的 `Grove` 文件夹可看到 Markdown 笔记。
2. 在 Harness 中自由对话。可要求使用 `grove_role` 作为思想伙伴、知识助手、研究助手、批判性审查者或创造助手。想保留一段讨论时，请求 `grove_propose` 起草，并提供你愿意保存的会话引用。探索可以直接结束。
3. 在自己的终端执行 `grove preview 草稿ID`。用 `grove accept 草稿ID` 查看并输入 `SAVE`，或执行 `grove discard 草稿ID`。确认时也可用 `--file` 提供你编辑过的正文。
4. 用 `grove list` 查询资产，用 `grove show 资产ID --version 1` 回看具体版本。默认 Grove 不向模型提供资产正文。若希望分享指定笔记，启动宿主前将 `GROVE_READABLE_IDS` 设为逗号分隔的资产 ID。取消分享后重新启动宿主。已进入宿主会话的内容仍受宿主历史设置约束。

## 基础研究

```sh
grove add question --body '团队规模如何影响决策效率？'
grove add research --question QUESTION_ID --body '比较决策权限和协调成本'
grove add evidence --body '粘贴可核对的摘录' --source 'https://example.org/report' --locator '第12页第2段'
grove add claim --body '我目前的判断'
grove update CLAIM_ID --version 1 --link EVIDENCE_ID --relation supports
grove update RESEARCH_ID --version 1 --link CLAIM_ID --relation related
grove update RESEARCH_ID --version 2 --stage analysis
grove update RESEARCH_ID --version 3 --stage review --status closed
```

把示例 ID 替换成上一步返回的 ID。阶段可回退，问题和项目可暂停、重开或归档。证据关系可表达支持、反驳和限定，双链指向具体版本。重写观点正文时，旧证据关系留在原版本，用户可以为新版本重新采用证据。结束研究时，成果可选。

## 数据和卸载

`Grove/` 内的版本文件使用 YAML 属性、Markdown 正文和 Obsidian 双链。Grove 不读 vault 中其他笔记。复制整个 `Grove/` 文件夹即可备份或迁移，点号开头的草稿文件也会随整目录迁移。可在 Obsidian 阅读及编辑正文，保留文件名和 Grove 元数据。要保留更改前的版本，使用 `grove update`。本版证据使用用户填写的来源标识与定位，附件管理、自动会话定位和专用插件界面留待后续版本。

用 `npx --yes @deepseek-ai/dsh@0.2.2-rc.3 plugin --profile grove remove dsh-grove` 卸载宿主插件。数据留在 vault，终端命令可通过 `npm uninstall --global dsh-grove` 单独卸载。

## 品牌资产

标志、锁定组合、色板、字体与导出图都在 [`brand/`](brand/README.md)，规范见 [`brand/VI.md`](brand/VI.md)（中文）与 [`brand/VI.en.md`](brand/VI.en.md)（English）。根目录的 `icon.svg` 与 `brand/mark.svg` 保持字节一致，由测试保证。

## 参与开发

规则只有一份：[`AGENTS.md`](AGENTS.md)（[English](AGENTS.en.md)）。Claude Code、Cursor、GitHub Copilot 分别读 `CLAUDE.md`、`.cursor/rules/project.mdc`、`.github/copilot-instructions.md`，三者都只指向 `AGENTS.md`。

理念、任务分层、DoD 与评审清单在 [`docs/development/`](docs/development/README.md)；会话交接在 [`docs/journal/`](docs/journal/)。改动前先跑 `npm test` 与 `bash scripts/check-compat.sh`。

## 从源代码验证

```sh
npm ci
npm test
npm pack
```
