# 2026-11-14 · Grove Web 面板、冷启动与 0.2.0

## 做完

- [#25](https://github.com/kmeng/dsh-grove/issues/25) → [PR #26](https://github.com/kmeng/dsh-grove/pull/26)：新增 Web 客户端（左侧入口 + 未连接 / 首条灵感 / 概览三态）与同源路由 `status` / `config` / `capture`；vault 路径经 `configEditor` 写入 profile；介绍文案重写，详情页收敛为一张 640×300 预览图。测试 21 → 34。
- [#27](https://github.com/kmeng/dsh-grove/issues/27) → [PR #28](https://github.com/kmeng/dsh-grove/pull/28)：README / AGENTS 中英同步，去掉「Host-only、没有 Web 界面」，安装步骤补左侧入口，版本与 npm 命令更新到 0.2.0。
- [#29](https://github.com/kmeng/dsh-grove/issues/29) → [PR #30](https://github.com/kmeng/dsh-grove/pull/30)：中文界面菜单显示「知林」，英文仍是 `Grove`；面板标题保持 `Grove`。
- 0.2.0 发布：npm latest 0.2.0，tarball 17 文件；宿主 `readPluginMeta` 读发布包，中英标题、介绍、图标齐全。
- desktop profile 从 npm 0.1.2 切为 `link:` 0.2.0；用户确认左侧菜单显示「知林」。
- 决策 D-005（需要长期保留的 Web 客户端与路由形态）写进 [DECISIONS.md](../development/DECISIONS.md)。

## 卡住

- 「插件页没有介绍」在干净 profile（0.1.2 与 0.2.0）都无法复现；desktop 上是否随 0.2.0 恢复仍待确认，[#31](https://github.com/kmeng/dsh-grove/issues/31) 保持打开。
- 原生目录选择器没有在无头环境实测；手动路径、无效路径与符号链接分支已验。
- 英文界面与深色主题只做了字典与 token 检查，没有截图验证。

## 下一步

- 确认 desktop 插件页介绍，然后关闭 #31；决定是否从 `link:` 切回 npm 安装。
- `awesome-dsh-plugin` 收录仍未提交。
- 若继续迭代：概览的「最近」还不可打开；需要新增只读路由后再做版本查看。

## 判断依据

- `npm test` 34 项全绿；变异测试把侧栏 id 改坏后客户端断言确实变红。
- `npm pack` 17 文件；registry tarball 清单一致，`bin`、`dsh.client`、`exports["./client"]` 正确。
- `check-compat`：0.2.0 对 dsh 0.2.2-rc.3 compatible；`verify-install` 临时 profile 出现 `grove` 行并清理。
- 无头 Chrome 实测：左侧入口、连接 vault（profile patch 出现 `vault`）、页面写入 `<vault>/Grove/<id>.v1.md`、概览更新、vault 移动后报错、500px 无溢出。
- 流程教训：前两个 issue 是 PR 前补建的；#29 起改为先建 issue 再实现。
