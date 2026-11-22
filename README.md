# Grove（知林）

![Grove 知林。从灵感出发，用证据形成判断，带着反思进入下一轮探索。](https://raw.githubusercontent.com/kmeng/dsh-grove/main/brand/exports/readme-header-1600x480.zh.png)

[简体中文](README.md) · [English](README.en.md)

[![MIT 许可](https://img.shields.io/badge/license-MIT-2F7D5B?style=flat-square)](LICENSE)
[![DeepSeek Harness >=0.2.2-rc.1 <0.3.0](https://img.shields.io/badge/dsh-%3E%3D0.2.2--rc.1_%3C0.3.0-1B3A2E?style=flat-square)](package.json)
[![Node.js >=22.13.0](https://img.shields.io/badge/Node.js-22.13%2B-2F7D5B?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)

## 让灵感长成自己的知识

知林把 DeepSeek Harness 和你的 Obsidian vault 连起来，帮你把一句灵感变成能用自己的话解释、用证据检验、在实践中修正的判断。灵感、资料、报告和作品都能以 Markdown 留在手边，方便以后回看当时的依据。

**输出让知识从笔记走进脑子。** 收藏一份报告，留住的是别人或当时的自己怎样理解它。试着写给别人看、讲给人听，或把方法用在另一个问题上，你才会发现哪些地方自己能解释，哪些地方还需要证据。输出可以只是一段写给自己的话。用自己的话说清楚，再带着暴露出来的问题回去研究，才是内化的过程。

这个过程来自 PKGS（Personal Knowledge & Growth System），把探索、研究、创作和反思连起来。AI 可以帮助追问、比较解释和起草，证据够不够、判断能不能成立，仍由你决定。 [PKGS 方法指南](docs/PKGS.zh.md)

## 同一条街，为什么两边走起来差这么多？

1. **记下灵感。** 散步时发现，一侧总想多走一会儿，另一侧只想快点通过。打开知林，点「叮」记下这个反差。下次再走到这里，可以用一句话找回当时的观察。
2. **把观察变成可核查的问题。** 从这条灵感发起研究，问「是树荫、人行道宽度，还是过街等待时间在起作用？」把不同时段的观察、公开道路资料或有文本层的 PDF 加进来，给摘录保留来源和页码。通过追问比较几种解释，再确认报告，把有证据的判断和仍待验证的猜测分别写清楚。
3. **把判断沉淀为可回查的知识。** 点「提炼为知识」。以后在知识库展开条目，就能读到当时收藏的完整报告和参考资料。知林运行时每天在本地整理标签和相关知识。用标签筛选，可以找回一组笔记，也可以顺着关联回看之前的研究。
4. **输出，再回到现场。** 点「写成作品」，试着写一段给邻居看的解释，并做一张下次散步可用的观察清单。写到「树荫让这边更好走」时，如果发现比较集中在同一个时段，就点「继续研究」回到原课题，补做其他时段的观察。再修正解释、拿到另一条街试一遍，才知道自己掌握了什么。

笔记及历史版本保存在 vault 的 `Grove/` 目录。CLI 可校验备份，并恢复到独立目录。功能随发布版本更新。 [npm 包](https://www.npmjs.com/package/dsh-grove)

## 安装与使用

准备一个 Obsidian vault。Node.js 与 DeepSeek Harness 的兼容要求见 [package.json 的 `engines`](package.json)。

- **从 npm 安装**。运行 `dsh plugin --profile <profile> add dsh-grove`。
- **在 Desktop 更新**。打开「插件 → Grove（知林）」，点「重新检查」，有新版本时按提示更新。
- **在 Desktop 试用源码**。在 **Plugins → Add plugin** 选择本仓库目录。修改源码后重启宿主。Desktop 使用自己管理的 profile。
- **用独立 profile 试用源码**。在仓库根目录执行以下命令。

```sh
dsh plugin --profile grove-trial add "$PWD"
dsh --profile grove-trial
```

装好后，从左侧打开中文界面的 **知林** 或英文界面的 **Grove**，选择 vault，写下一句并点「💡叮～」。想研究一个问题时，打开「研究」，保存问题和观察，再按需上传资料、保存摘录与确认报告。知林默认跟随 dsh 当前 profile 的默认模型。把公开网页链接粘贴到「给个方向」即可读取网页并发起深度研究。「设置」可选择专用研究模型、按需开启 Tavily 自动搜索（需要 `GROVE_TAVILY_KEY`），并设置资料解析。使用自定义 HTTPS 接口时，才需要在宿主配置 `GROVE_MODEL_KEY`。

也可以单独安装终端命令。在仓库根目录执行 `npm install --global .` 可安装源码中的 CLI。执行 `npm install --global dsh-grove` 可安装 npm 已发布的 CLI。

```sh
export GROVE_VAULT="/absolute/path/to/Obsidian vault"
grove capture --body '同一条街，为什么两边走起来差这么多？'
grove list
grove show ASSET_ID --version 1
```

在 Harness 会话中，可用 `grove_role` 选协作角色，用 `grove_propose` 起草。回到终端用 `grove preview DRAFT_ID` 查看，再用 `grove accept DRAFT_ID` 确认或用 `grove discard DRAFT_ID` 丢弃。向模型开放指定资产时，按插件详情配置读取白名单。 [工具与权限说明](docs/DETAIL.zh.md)

升级前暂停对库的写入，用 `grove backup /absolute/path/to/snapshot` 校验备份。需要恢复时运行 `grove restore /absolute/path/to/snapshot --destination /absolute/path/to/new-vault`，检查后在面板切换到恢复目录。卸载可用 `dsh plugin --profile <profile> remove dsh-grove`，vault 数据保留。

## 贡献代码

1. 先看开放 issue。修 bug 时写清复现步骤、预期结果和实际结果。提功能时说明用户场景和可验证的验收条件。 [Issues](https://github.com/kmeng/dsh-grove/issues)
2. 阅读开发契约，从分支提交一个可独立验收的 PR。用临时 vault 验证，附上实际测试结果和未覆盖的情况。 [开发契约](AGENTS.md) · [开发指南](docs/development/README.md)
3. 本地运行下列检查。只改文档或品牌素材时跑前两项。宿主验证用已安装的 dsh 和临时 profile。

```sh
npm ci && npm test
npm pack --dry-run --json
bash scripts/check-compat.sh
bash scripts/verify-install.sh
```

项目交接与发布记录见 [journal](docs/journal/)。标志和视觉规范见 [品牌资产](brand/README.md)。
