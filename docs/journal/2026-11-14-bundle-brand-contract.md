# 2026-11-14 · bundle 修通、品牌落地、开发契约迁移

## 做完

- **#5 → PR #6**：`engines.dsh` 从精确 `0.2.2-rc.1` 改成 `>=0.2.2-rc.1 <0.3.0`；宿主包 `@deepseek-ai/dsh-tools` 改为范围并同时声明在 peer 与 dev。补齐 `exports`/`icon`/`locale`/`docs`，新增 `test/manifest.test.js`。
- **#7 → PR #8**：新标志（两片叶 + 收窄的茎 + 琥珀基线）、三种锁定组合、`tokens.css/json`、`VI.md`，以及 180 瓦片 / 512 / 1024 头像 / 社交预览 / README 头图。
- **#9 → PR #11**：头图与社交预览补齐中英双版本，新增中文优先锁定组合 `logo-zh-primary`、`VI.en.md`、`brand/README.en.md`。
- **#10 → 本 PR**：把 Maestro 的会话协议与案随的原则层迁移成 `AGENTS.md` + `docs/development/`，并提供 Claude / Cursor / Copilot 三个适配入口。

## 卡住

- npm 发布需要用户账号登录（`npm whoami` 报 `ENEEDAUTH`），`dsh-grove` 在 registry 上仍是 404。
- 仓库 Social preview 只能在 GitHub 设置里手动上传，API 不支持。

## 下一步

1. 用户 `npm login` 后执行 `npm publish`，核对 registry 与 tarball。
2. 往 `awesome-dsh-plugin` 提 `data/plugins/kmeng__dsh-grove.yml`，瓦片用 `brand/exports/icon-180.png`。

## 判断依据

- `evaluatePluginCompatibility` 对 0.2.2-rc.3 返回 compatible。
- 临时 profile 里 `--dump-config` 出现 `- id: grove`，`--dump-config-schema` 退出码 0。
- `npm test` 17 项全绿；变异测试确认断言会失败。
