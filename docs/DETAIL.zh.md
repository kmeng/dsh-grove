# Grove（知林）

Grove 是连接 DeepSeek Harness 与 Obsidian 的个人知识成长插件，帮助你积累可回看、可修正的知识，在长期探索中形成自己的判断。当前版本支持自由探索、自主保存和基础研究。

- **自由探索，按需研究。** 从一个念头开始，随时停下。你可以留下开放问题，等值得深究时再开展研究，成果由你决定。
- **保留依据和修订过程。** 记录证据出处，把支持、反驳或限定的证据连到具体版本，以便重查和修正判断。
- **AI 协助思考，你掌握判断和知识。** AI 可以追问、提出不同解释和起草。你决定采纳、保存和分享什么，留下的知识以 Markdown 保存在自己的 Obsidian vault 中。

## 提供什么

三个模型工具，注册在宿主内：

| 工具 | 作用 | 边界 |
| --- | --- | --- |
| `grove_role` | 返回你明确点名的协作角色指引（`thinking` / `knowledge` / `research` / `critical` / `creation`） | 只读文本，不碰 vault |
| `grove_propose` | 按你的要求起草一条草稿，写成 `.proposal.json` | 不创建资产；要你在终端执行 `grove accept` 才落盘 |
| `grove_read` | 读取一条你显式分享的资产 | 只认 `GROVE_READABLE_IDS` 白名单里的 ID |

资产类型共十种：灵感、问题、概念、理论、判断、证据、方法、成果、探索、研究。研究与证据走终端命令，模型只能起草其余类型。

## 怎么用

1. 配置 vault：插件配置里的 `vault`，或环境变量 `GROVE_VAULT`。必须是**绝对路径的真实目录**；路径里的 symlink 会被拒绝。
2. 在会话里对话，需要时让模型调用 `grove_role` 切换协作方式。
3. 想留下讨论时，让模型调用 `grove_propose` 起草，并把你要保存的会话引用作为 `origin` 传入。
4. 在终端 `grove preview <草稿ID>` 看内容，`grove accept <草稿ID>` 并输入 `SAVE` 落盘，或用 `grove discard` 丢弃。
5. `grove list` / `grove show <资产ID> --version <N>` 回看；`grove update` 写入新版本，旧版本的证据关系留在旧版本上。

## 数据放在哪

全在 `<vault>/Grove/`：一条资产一个文件 `<id>.v<版本>.md`，YAML frontmatter + Markdown 正文 + Obsidian 双链；点号开头的 `.proposal.json` 是同目录的草稿。没有数据库，复制整个 `Grove/` 就是备份和迁移。

## 已知限制

- 证据只记录你填写的来源标识与定位（`--source` / `--locator`），没有附件管理，也不自动定位会话。
- 没有专用 Web 界面：交互面是会话里的工具加终端 CLI。
- 保存必须在交互式终端完成（`grove accept` 要手输 `SAVE`），模型不能代你落盘。
- 默认不把资产正文交给模型；分享要预先设置 `GROVE_READABLE_IDS`，取消分享后需重启宿主。
- 单条笔记上限 1 MiB，草稿正文上限 128 KiB；`grove_read` 拒绝白名单外和已归档的资产。
- `grove` 命令来自 npm 全局安装的 `bin`；把插件装进某个 profile 不会把它加进 PATH。
- 兼容 dsh `>=0.2.2-rc.1 <0.3.0`。
