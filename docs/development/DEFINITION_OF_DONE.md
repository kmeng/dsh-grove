# Definition of Done

关闭条件分两半：**可机检**的交给脚本，**要人判断**的交给评审。

## Story

- [ ] 完整闭环跑通：从入口到可验证产出，中途不需要人补位
- [ ] 验收标准逐条通过，PR 里有对照表
- [ ] 真实环境验证：不是只看单测
- [ ] `npm test` 全绿
- [ ] 改动涉及时：兼容性判定、`npm pack` 清单、真实安装至少各验一次
- [ ] 文档同步（README / `docs/DETAIL.*` / `brand/VI*` 按需）
- [ ] 没有密钥、调试输出、注释掉的代码块

## BUG

- [ ] 根因写进 issue，不是绕过症状
- [ ] 回归测试覆盖复现路径，且在修复前先失败过
- [ ] 修复后原路径复验通过

## 文档 / 素材

- [ ] 中英两版同步（若该文件有双语版本）
- [ ] 相对链接可达（测试会检查 `AGENTS.md` 与 `brand/` 的链接）
- [ ] 由脚本生成的产物已重新生成并提交

## 发布

- [ ] 版本号按语义化升位，`package.json` 与 `package-lock.json` 一致
- [ ] `npm pack --dry-run` 清单符合预期（含 `icon.svg`、`locale/*`、`docs/DETAIL.*`、`src/*`、`cordis.patch.yml`；不含 `test/`、`brand/`）
- [ ] 在临时 profile 里装一次、看到 `grove` 行、再删掉
- [ ] 发布后核对 registry 上的版本与 tarball 内容

## 两层强制

| 判断类型 | 谁执行 | 载体 |
| --- | --- | --- |
| 可机检 | 脚本/测试 | `npm test`、`scripts/check-compat.sh`、`npm pack --dry-run` |
| 要人判断 | 人 + 评审 | 本文件 + [`REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) |

> 测试变绿不等于验收通过；证据词不等于功能可用。后者只能靠人看。
