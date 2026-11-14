#!/usr/bin/env node
// 用运行中的 dsh 判定本包的 engines.dsh 是否真的兼容。
// 需要 DSH_INSTALL_DIR 指向正在使用的 dsh 安装目录（DSH 会话里已自动设置）。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const require = createRequire(import.meta.url)

const anchors = [process.env.DSH_INSTALL_DIR, root].filter(Boolean)
let entry
try {
  entry = require.resolve('@deepseek-ai/dsh-app-boot', { paths: anchors })
} catch {
  console.error('找不到 @deepseek-ai/dsh-app-boot。请把 DSH_INSTALL_DIR 指向运行中的 dsh 安装目录后重试。')
  if (String(process.env.DSH_INSTALL_DIR ?? '').includes('.asar')) {
    console.error('Desktop 的 dsh 装在 app.asar 里，普通 node 读不到：')
    console.error('  ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" scripts/check-compat.mjs')
    console.error('或者直接跑：bash scripts/check-compat.sh')
  }
  process.exit(2)
}

const boot = await import(pathToFileURL(entry).href)
const runtime = boot.getDshRuntimeVersion()
const issue = boot.evaluatePluginCompatibility(manifest, {}, runtime)

if (issue) {
  console.error(`不兼容：${issue.name}@${issue.version} 与 dsh ${runtime}`)
  console.error(`未满足：${JSON.stringify(issue.requirements)}`)
  console.error('请把 engines.dsh 改成覆盖运行版本的范围，而不是某一个精确版本。')
  process.exit(1)
}

console.log(`compatible：${manifest.name}@${manifest.version} vs dsh ${runtime}（engines.dsh ${manifest.engines.dsh}）`)
