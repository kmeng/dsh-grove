# 2026-11-21 · npm 发布工作流的 Node.js 版本

## 做完

- `build` 和 `publish-npm` 都改用 Node.js 22.x，符合 Grove 和 PDF.js 的 Node.js 版本要求。修复已合并到 main（`a5453d2`）。 [Issue #210](https://github.com/kmeng/dsh-grove/issues/210) · [PR #211](https://github.com/kmeng/dsh-grove/pull/211)

## 卡住

- v0.6.4 的发布运行在 `build` 阶段失败，`publish-npm` 未运行。合并后尚未用新 Release 验证实际发布。 [失败运行 #7](https://github.com/kmeng/dsh-grove/actions/runs/44302661850)

## 下一步

- 下一次发布时，从包含修复的提交创建 Release，检查 `build`、`publish-npm` 和 npm registry 上的版本。

## 判断依据

- 本地用 Node.js 20.20.0 运行原有 PDF 页码测试，复现 `Promise.withResolvers is not a function`。Node.js 22.13.0 下运行 `npm ci && npm test`，72 项通过。
- 打包预检包含 39 个文件，图标、语言文件、文档、源码和补丁齐全，排除 `test/` 和 `brand/`。
- DeepSeek Harness 0.2.2-rc.5 兼容性检查通过。临时 profile 安装后，composition 出现 Grove，脚本已清理该 profile。
