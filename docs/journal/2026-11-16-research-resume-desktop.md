# 2026-11-16 · 桌面版续研复验

## 做完

- 在 DeepSeek Harness Desktop 0.2.2-rc.3 中加载合并后的 Grove（`1e464de`），用隔离 profile 和临时 vault 复验续研流程。[Issue #162](https://github.com/kmeng/dsh-grove/issues/162) · [PR #163](https://github.com/kmeng/dsh-grove/pull/163)

- 在同一隔离环境中，从已有课题点击「开始深挖」，使用桌面版的默认模型和 IANA 公开网页跑完一次研究。界面显示「报告草稿已保存」，Markdown 草稿写入临时 vault。

- Grove 0.5.9 已发布到 npm，设为 `latest`，并创建 GitHub Release。版本包含续研入口、表单重复修复，以及通过公开链接发起研究的改动。[npm 0.5.9](https://www.npmjs.com/package/dsh-grove/v/0.5.9) · [GitHub Release](https://github.com/kmeng/dsh-grove/releases/tag/v0.5.9) · [PR #167](https://github.com/kmeng/dsh-grove/pull/167)

## 卡住

- 续研、完整研究和正式包安装复验均通过。完整研究验证止于报告草稿保存，正式包复验覆盖安装和续研界面。

## 下一步

- 本轮发布与安装验证已完成。

## 判断依据

- Grove 首页只有「独立发起研究」这一个研究入口。
- 点击后，研究首页显示「接着上次深挖 · 桌面复验：如何整理研究证据」。继续后，课题页显示同名课题。
- 点击续研后观察 20 秒。在第 1、5、10、15、20 秒，桌面渲染器中均只有一个「来点深度」区域。期间监听到的 DOM 更新中，该区域数量也没有超过一个。
- 从点击「开始深挖」到观察结束共 65 秒。通过 DOM 变更监听和定时采样，运行中记录 141 次，完成后记录 24 次（含报告出现后 20 秒）。两个阶段的「来点深度」区域数量始终为 1。
- 从 npm 官方 registry 下载 `dsh-grove-0.5.9.tgz`，按 registry 元数据核对 SHA-512 完整性，在隔离的 dsh 0.2.2-rc.3 profile 中安装。配置中出现 `dsh-grove`，安装后的 manifest 版本为 `0.5.9`。
- 用安装后的正式包启动桌面版并连接临时 vault。首页唯一的研究入口是「独立发起研究」，研究首页显示「接着上次深挖 · 正式包复验课题」。点击后打开对应课题，只显示一份「来点深度」。
