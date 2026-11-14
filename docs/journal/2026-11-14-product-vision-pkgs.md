# 2026-11-14 · 项目愿景、双语 README 与 PKGS 指南

## 做完

- [#15](https://github.com/kmeng/dsh-grove/issues/15) → [PR #16](https://github.com/kmeng/dsh-grove/pull/16)（`b99e858`）。明确 Grove 的愿景与三项原则。自由探索、按需研究，保留证据和修订历史，由用户决定采纳、保存与分享。更新 README、中英文插件详情、安装界面简介、品牌规范及双语头图和预览图。GitHub About 已更新，用户确认已上传 Social Preview。
- [#17](https://github.com/kmeng/dsh-grove/issues/17) → [PR #18](https://github.com/kmeng/dsh-grove/pull/18)（`d4a4703`）。完整中英文 README 增加语言切换和许可、宿主兼容、Node.js 徽章。双语 PKGS 指南覆盖定位、理论依据、核心活动、知识与证据、人机协作和实践示例，读者可用纸笔或 Markdown 实践。
- 用户确认后续流程。设计方案由用户确认，AI 按确认方案完成并通过验证后直接合并 PR。约定已写入中英文开发契约。

## 卡住

- 这两轮文档改动已合并。之前交接中记录的 npm 发布与插件目录收录，本轮未核验。

## 下一步

- 后续改动按中英文开发契约执行。从远端 `main` 和当前开放 issue 确认状态，再提交设计方案供用户确认。

## 判断依据

- 两轮各有 20 项测试通过，npm 打包清单分别核对了 13 项和 14 项文件。第二轮新增英文 README。
- 第一轮用 DeepSeek Harness `0.2.2-rc.3` 验证兼容性，并用 `readPluginMeta` 读到中英文标题、简介和图标。
- 第二轮检查四份文档的相对链接和双语章节，三个徽章均返回正确的 SVG 标签。
- 两个 issue 已关闭。PR #18 合并后，本地 `main` 同步到 `d4a4703`。
