import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import semver from 'semver'
import { parse } from 'yaml'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const rel = path => path.replace(/^\.\//, '')

async function isFile(path) {
  return stat(join(root, path)).then(entry => entry.isFile(), () => false)
}

// 包内路径的 glob 匹配：`*` 只跨一层，`**` 跨任意层。
function globToRegExp(pattern) {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .split('**')
    .map(part => part.split('*').join('[^/]*'))
    .join('.*')
  return new RegExp(`^${body}$`)
}

function coveredByFiles(path) {
  return (manifest.files ?? []).some(pattern => {
    if (!pattern.includes('*')) {
      const entry = rel(pattern).replace(/\/$/, '')
      return path === entry || path.startsWith(`${entry}/`)
    }
    return globToRegExp(pattern).test(path)
  })
}

test('engines.dsh is a range that still admits the current 0.2.2 line', () => {
  const range = manifest.engines?.dsh
  assert.equal(typeof range, 'string', 'engines.dsh must be declared')
  // dsh 只在声明了 engines.dsh 时按它判定，精确版本会让其它 0.2.x 整包被跳过。
  assert.equal(semver.valid(range), null, `engines.dsh must not be an exact version: ${range}`)
  assert.ok(semver.validRange(range), `engines.dsh must be a valid range: ${range}`)
  assert.ok(semver.satisfies('0.2.2-rc.1', range), `${range} must admit 0.2.2-rc.1`)
  assert.ok(semver.satisfies('0.2.2-rc.3', range), `${range} must admit 0.2.2-rc.3`)
})

test('no dependency pins a dsh package to one exact version', () => {
  const all = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies }
  for (const [name, range] of Object.entries(all)) {
    if (!name.startsWith('@deepseek-ai/')) continue
    assert.equal(semver.valid(String(range).trim()), null, `${name} must not pin an exact version: ${range}`)
  }
})

test('dsh packages the plugin imports are declared as peer and dev', async () => {
  const imported = new Set()
  for (const file of ['plugin.js', 'cli.js', 'vault.js', 'proposals.js']) {
    const source = await readFile(join(root, 'src', file), 'utf8')
    for (const match of source.matchAll(/from ['"](@deepseek-ai\/[^'"]+)['"]/g)) imported.add(match[1])
  }
  // 宿主包两边都要声明：link: 安装靠 peer 走安装侧的拦截，dev 供本仓库测试。
  for (const name of imported) {
    assert.ok(manifest.peerDependencies?.[name], `${name} must be in peerDependencies`)
    assert.ok(manifest.devDependencies?.[name], `${name} must be in devDependencies`)
    assert.equal(semver.valid(String(manifest.peerDependencies[name]).trim()), null, `${name} peer must be a range`)
  }
})

test('bin paths do not start with ./ so npm keeps them', async () => {
  // npm 11.13 在发布时会把以 ./ 开头的 bin 判为无效并丢弃，装出来的包就没有 grove 命令。
  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    assert.doesNotMatch(target, /^\.\//, `bin[${name}] must not start with ./`)
    assert.ok(await isFile(target), `bin[${name}] points at a missing file`)
  }
})

test('bundle patch loads and inserts this package', async () => {
  const patchPath = manifest.dsh?.bundle?.patch
  assert.equal(typeof patchPath, 'string')
  const patch = parse(await readFile(join(root, rel(patchPath)), 'utf8'))
  assert.ok(Array.isArray(patch), 'patch must be a list')
  const entries = patch.flatMap(layer => layer?.insert ?? [])
  assert.ok(
    entries.some(entry => entry.name === manifest.name),
    `patch must insert ${manifest.name}`,
  )
})

test('files covers everything the bundle needs at runtime and display', async () => {
  const details = []
  for (const locale of ['en', 'zh']) {
    const data = JSON.parse(await readFile(join(root, 'locale', `${locale}.json`), 'utf8'))
    details.push(rel(data.meta.detail))
  }
  const required = [
    rel(manifest.main),
    rel(manifest.bin.grove),
    rel(manifest.icon),
    rel(manifest.dsh.bundle.patch),
    ...Object.entries(manifest.exports ?? {})
      // package.json 总会被 npm 打包，不参与 files 覆盖检查。
      .filter(([subpath, target]) => !subpath.includes('*') && !target.includes('*') && rel(target) !== 'package.json')
      .map(([, target]) => rel(target)),
    ...details,
  ]
  const uncovered = required.filter(path => !coveredByFiles(path))
  assert.deepEqual(uncovered, [], `files does not ship: ${uncovered.join(', ')}`)
  for (const path of required) assert.ok(await isFile(path), `${path} is missing`)
})

test('exports subpaths resolve inside the package', async () => {
  const specifiers = [manifest.name, `${manifest.name}/package.json`, `${manifest.name}/icon`, `${manifest.name}/locale/en.json`]
  for (const specifier of specifiers) {
    const resolved = fileURLToPath(import.meta.resolve(specifier))
    assert.ok(resolved.startsWith(root + sep), `${specifier} resolves outside the package: ${resolved}`)
    assert.ok(await isFile(resolved.slice(root.length + 1)), `${specifier} points at a missing file`)
  }
})

test('locale carries the display metadata dsh reads without activating', async () => {
  for (const locale of ['en', 'zh']) {
    const data = JSON.parse(await readFile(join(root, 'locale', `${locale}.json`), 'utf8'))
    for (const field of ['title', 'description', 'detail']) {
      assert.equal(typeof data.meta?.[field], 'string', `${locale}: meta.${field}`)
      assert.ok(data.meta[field].trim(), `${locale}: meta.${field} must not be empty`)
    }
    assert.ok(await isFile(data.meta.detail), `${locale}: meta.detail ${data.meta.detail} is missing`)
    if (locale === 'en') assert.match(data.meta.detail, /\.en\.md$/, 'en must not point at the Chinese document')
    if (locale === 'zh') assert.match(data.meta.detail, /\.zh\.md$/, 'zh must point at the Chinese document')
  }
})

test('icon is well-formed, self-contained and within the size limit', async () => {
  const svg = await readFile(join(root, rel(manifest.icon)), 'utf8')
  assert.match(svg, /^<svg[^>]+viewBox="0 0 36 36"/)
  for (const forbidden of ['<script', '<style', '<image', 'foreignObject', '<animate']) {
    assert.ok(!svg.includes(forbidden), `icon must not contain ${forbidden}`)
  }
  const stack = []
  for (const [, closing, name, , selfClosing] of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)((?:'[^']*'|"[^"]*"|[^>"'])*?)(\/?)>/g)) {
    if (closing) assert.equal(stack.pop(), name, `unbalanced </${name}>`)
    else if (!selfClosing) stack.push(name)
  }
  assert.deepEqual(stack, [], 'icon has unclosed elements')
  assert.ok(Buffer.byteLength(svg) < 256 * 1024)
})

test('brand assets stay out of the npm package, and icon.svg mirrors the master', async () => {
  assert.equal(
    await readFile(join(root, 'icon.svg'), 'utf8'),
    await readFile(join(root, 'brand', 'mark.svg'), 'utf8'),
    'icon.svg must be byte-identical to brand/mark.svg',
  )
  assert.ok(!(manifest.files ?? []).some(pattern => pattern.startsWith('brand')), 'brand/ must not be shipped')

  const expected = {
    'brand/exports/icon-180.png': [180, 180],
    'brand/exports/icon-180-tile.png': [180, 180],
    'brand/exports/icon-512.png': [512, 512],
    'brand/exports/icon-1024.png': [1024, 1024],
    'brand/exports/logo-light.png': [528, 160],
    'brand/exports/logo-dark.png': [528, 160],
    'brand/exports/logo-zh.png': [608, 160],
    'brand/exports/logo-zh-primary.png': [632, 160],
    'brand/exports/social-preview-1280x640.zh.png': [1280, 640],
    'brand/exports/social-preview-1280x640.en.png': [1280, 640],
    'brand/exports/readme-header-1600x480.zh.png': [1600, 480],
    'brand/exports/readme-header-1600x480.en.png': [1600, 480],
    'brand/exports/overview.png': [1600, 1180],
  }
  for (const [path, [width, height]] of Object.entries(expected)) {
    const png = await readFile(join(root, path))
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${path} is not a PNG`)
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height], `${path} size`)
  }

  for (const file of ['mark.svg', 'mark-on-dark.svg', 'mark-mono.svg', 'logo-light.svg', 'logo-dark.svg', 'logo-zh.svg', 'logo-zh-primary.svg']) {
    const svg = await readFile(join(root, 'brand', file), 'utf8')
    assert.match(svg, /^<svg\b[^>]*>/, `${file} must be an svg element`)
    assert.match(svg.trim(), /<\/svg>$/, `${file} must be closed`)
  }
})

test('each layout ships in both languages, and the english one carries no CJK copy', async () => {
  for (const base of ['social-preview', 'readme-header']) {
    const en = await readFile(join(root, 'brand', 'src', `${base}.en.html`), 'utf8')
    const zh = await readFile(join(root, 'brand', 'src', `${base}.zh.html`), 'utf8')
    // 品牌名「知林」可以出现，其余中文不行
    assert.doesNotMatch(en.replaceAll('知 林', '').replaceAll('知林', ''), /[\u4e00-\u9fff]/, `${base}.en.html must not contain Chinese copy`)
    assert.match(zh, /[\u4e00-\u9fff]/, `${base}.zh.html must carry Chinese copy`)
  }
})

test('the english VI is a full translation, not a stub', async () => {
  const zh = await readFile(join(root, 'brand', 'VI.md'), 'utf8')
  const en = await readFile(join(root, 'brand', 'VI.en.md'), 'utf8')
  for (const token of ['#1B3A2E', '#2F7D5B', '#5FA37E', '#C98A3B', '#B87A2C', '#8F5F1D', '#F7F4EC', '#C3D3C9']) {
    assert.ok(zh.includes(token), `VI.md is missing ${token}`)
    assert.ok(en.includes(token), `VI.en.md is missing ${token}`)
  }
  assert.ok(en.length > zh.length * 0.6, 'VI.en.md looks truncated')
})

test('documentation links resolve', async () => {
  const docs = [
    'AGENTS.md',
    'docs/development/README.md',
    'docs/development/ISSUE_HIERARCHY.md',
    'docs/development/DEFINITION_OF_DONE.md',
    'docs/development/REVIEW_CHECKLIST.md',
    'docs/development/DECISIONS.md',
    'docs/development/HANDOFF.md',
    'README.md',
    'docs/journal/README.md',
    'brand/README.md',
    'brand/README.en.md',
  ]
  const missing = []
  for (const file of docs) {
    const text = await readFile(join(root, file), 'utf8')
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1]
      if (/^(https?:|mailto:|#)/.test(target)) continue
      const path = resolve(dirname(join(root, file)), target.split('#')[0])
      const exists = await stat(path).then(entry => entry.isFile() || entry.isDirectory(), () => false)
      if (!exists) missing.push(`${file} -> ${target}`)
    }
  }
  assert.deepEqual(missing, [])
})

test('tool adapters stay pointers to AGENTS.md', async () => {
  for (const file of ['CLAUDE.md', '.cursor/rules/project.mdc', '.github/copilot-instructions.md']) {
    const text = await readFile(join(root, file), 'utf8')
    assert.match(text, /AGENTS\.md/, `${file} must point at AGENTS.md`)
    assert.ok(text.split('\n').length <= 20, `${file} should stay a short pointer`)
  }
})

test('the english contract mirrors the chinese one', async () => {
  const zh = await readFile(join(root, 'AGENTS.md'), 'utf8')
  const en = await readFile(join(root, 'AGENTS.en.md'), 'utf8')

  const countOf = (text, marker) => (text.match(new RegExp(`^${marker} `, 'gm')) ?? []).length
  assert.equal(countOf(en, '##'), countOf(zh, '##'), 'level-2 section count must match')
  assert.equal(countOf(en, '###'), countOf(zh, '###'), 'level-3 section count must match')

  // 两份文档互相指向，读者不会只看一半
  assert.match(zh, /AGENTS\.en\.md/, 'AGENTS.md must link to the English version')
  assert.match(en, /AGENTS\.md/, 'AGENTS.en.md must link back to the Chinese version')

  for (const id of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']) {
    assert.ok(zh.includes(`| ${id} |`), `AGENTS.md is missing ${id}`)
    assert.ok(en.includes(`| ${id} |`), `AGENTS.en.md is missing ${id}`)
  }

  const commands = ['npm ci && npm test', 'npm pack --dry-run --json', 'bash scripts/check-compat.sh', 'bash scripts/verify-install.sh']
  for (const command of commands) {
    assert.ok(zh.includes(command), `AGENTS.md is missing: ${command}`)
    assert.ok(en.includes(command), `AGENTS.en.md is missing: ${command}`)
  }

  const docLinks = text => [...new Set([...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]))]
    .filter(target => /^(docs\/development\/|\.github\/)/.test(target))
    .sort()
  assert.deepEqual(docLinks(en), docLinks(zh), 'relative document links must match')

  assert.ok(en.length > zh.length * 0.8, 'AGENTS.en.md looks truncated')
})
