# Grove（知林）

Grove 是 DeepSeek Harness 的个人知识成长插件。用 Obsidian vault 保存灵感、问题、知识资产和研究证据。探索是常态，研究是选择，成果自然生长。

## 安装 v0.1.0

需要 Node.js 22 或更高版本、一个已有的 Obsidian vault，以及 DeepSeek Harness 0.2.2-rc.1。以下是 macOS/Linux 终端示例。将两处绝对路径换成实际路径。

```sh
export GROVE_VAULT="/absolute/path/to/Obsidian vault"
grove_package="/absolute/path/to/dsh-grove-0.1.0.tgz"
npm install --global "$grove_package"
npx --yes @deepseek-ai/dsh@0.2.2-rc.1 --profile grove --from-default-profile web --dump-config
npx --yes @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile grove add "$grove_package"
npx --yes @deepseek-ai/dsh@0.2.2-rc.1 --profile grove
```

初始化配置只运行一次。已有 `grove` 配置时直接安装或启动。用独立配置试用，确保宿主的 Bash、文件编辑、通用自动化和其他扩展无法访问 vault 或代你运行本地确认命令。Grove 自身的模型工具只有角色提示、草稿和白名单查询。普通 Harness 会话仍遵循宿主的模型路由、权限和历史保留设置。

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

用 `npx --yes @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile grove remove dsh-grove` 卸载宿主插件。数据留在 vault，终端命令可通过 `npm uninstall --global dsh-grove` 单独卸载。

## 从源代码验证

```sh
npm ci
npm test
npm pack
```
