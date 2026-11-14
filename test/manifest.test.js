import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
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
