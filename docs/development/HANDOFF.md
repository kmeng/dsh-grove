# 跨会话交接

AI 每次都从零开始。交接不是礼貌，是让下一次会话能直接接上的唯一手段。

## journal

- 目录：`docs/journal/`
- 文件名：`YYYY-MM-DD-<slug>.md`，同一天多篇加序号。
- 写入时机：PR 合并、issue 关闭、重大决定之后；或用户说"今天就到这"。
- 内容四段：**做完了什么 / 卡在哪 / 下一步 / 判断依据**。
- 只记**状态与理由**，不复述代码；链接到 issue、PR、提交。

## 一篇 entry 的骨架

```md
# 2026-11-14 · 品牌与开发契约

## 做完
- #5 → PR #6：engines.dsh 改范围；宿主包 peer+dev（决定见 D-001/D-002）

## 卡住
- npm 发布需要账号登录，未完成

## 下一步
- 登录后 `npm publish`，再提 awesome-dsh-plugin

## 判断依据
- `evaluatePluginCompatibility` 返回 compatible
- 临时 profile 里 `--dump-config` 出现 grove 行
```

## 接手的动作

新会话第一件事：读最新一篇，把"下一步"和当前 `gh issue list` 对一遍；对不上就以 issue 为准，并在回复里指出这个差异。

## 交接的底线

- 不写"已完成"但没有证据的条目。
- 不把计划写成事实。
- 不确定的地方写"未验证"，让人接手时知道要补什么。
