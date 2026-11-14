import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { capture, inspectVault, registerRoutes, routes, saveVault, vaultStatus } from '../src/server.js'
import { Vault } from '../src/vault.js'

async function fixture(t) {
  // macOS resolves /var to /private/var; vault paths must be real directories.
  const path = await realpath(await mkdtemp(join(tmpdir(), 'grove-panel-')))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

function request(path, body) {
  return new Request(`http://localhost${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

function host(editor) {
  const registered = new Map()
  const ctx = {
    fiber: { entry: {} },
    get(name) {
      if (name === 'configEditor') return editor
      return undefined
    },
    inject(_names, callback) {
      callback({
        get: () => ({ fetch: { register: route => { registered.set(route.path, route); return () => {} } } }),
        effect: fn => { fn(); return () => {} },
      })
    },
  }
  return { ctx, registered }
}

test('a vault path must be absolute, real and a directory', async t => {
  const root = await fixture(t)
  await assert.rejects(inspectVault('relative/path'), /absolute/)
  await assert.rejects(inspectVault(''), /Choose a folder/)
  await assert.rejects(inspectVault(join(root, 'missing')), /not a directory/)

  const real = join(root, 'Vault')
  await mkdir(real)
  assert.deepEqual(await inspectVault(real), { path: real, looksLikeVault: false })
  await mkdir(join(real, '.obsidian'))
  assert.equal((await inspectVault(real)).looksLikeVault, true)

  const link = join(root, 'link')
  await symlink(real, link)
  await assert.rejects(inspectVault(link), /symlink/)
})

test('status reports the cold-start state, counts, and recent titles without bodies', async t => {
  const root = await fixture(t)
  const empty = await vaultStatus(undefined, null)
  assert.equal(empty.configured, false)
  assert.equal(empty.counts.total, 0)

  const before = await vaultStatus(root, 'config')
  assert.equal(before.configured, true)
  assert.equal(before.usable, true)
  assert.equal(before.writable, true)
  assert.equal(before.counts.total, 0)
  assert.deepEqual(before.recent, [])

  const vault = new Vault(root)
  await vault.create({ type: 'question', body: 'Why does coordination cost rise?' })
  const after = await vaultStatus(root, 'config')
  assert.equal(after.counts.total, 1)
  assert.equal(after.counts.question, 1)
  assert.equal(after.recent.length, 1)
  assert.equal(after.recent[0].type, 'question')
  assert.equal('body' in after.recent[0], false)
  assert.match(after.recent[0].title, /coordination/)
})

test('a moved or symlinked vault is reported as configured but unusable', async t => {
  const root = await fixture(t)
  const link = join(root, 'vault-link')
  await symlink(root, link)
  const status = await vaultStatus(link, 'env')
  assert.equal(status.configured, true)
  assert.equal(status.usable, false)
})

test('the panel can capture a first inspiration and nothing else', async t => {
  const root = await fixture(t)
  await assert.rejects(capture(undefined, { body: 'x' }), /no vault/)
  await assert.rejects(capture(root, { body: '   ' }), /Write something first/)
  await assert.rejects(capture(root, { body: 'x'.repeat(129 * 1024) }), /too large/)

  const note = await capture(root, { body: 'A first thought' })
  assert.equal(note.type, 'inspiration')
  assert.equal(note.version, 1)
  assert.equal(await readFile(note.path, 'utf8').then(text => text.includes('A first thought')), true)
  assert.equal((await vaultStatus(root, 'config')).counts.total, 1)
})

test('saving the vault writes the row config through the config editor', async () => {
  let change
  const editor = { edit: (_entry, next) => { change = next({ readableIds: [] }, {}); return Promise.resolve() } }
  await saveVault(host(editor).ctx, '/vault')
  assert.deepEqual(change, { readableIds: [], vault: '/vault' })
  await assert.rejects(saveVault({ get: () => undefined }, '/vault'), /cannot save/)
})

test('routes answer status, validate paths, and save after responding', async t => {
  const root = await fixture(t)
  let saved
  const editor = { edit: (_entry, change) => { saved = change({}, {}); return Promise.resolve() } }
  const { ctx, registered } = host(editor)
  registerRoutes(ctx, { current: () => ({ path: root, source: 'config' }), saveDelay: 1 })
  assert.deepEqual([...registered.keys()].sort(), [routes.capture, routes.config, routes.inspirations, routes.status].sort())

  const status = await registered.get(routes.status).fetch(request(routes.status))
  assert.equal(status.status, 200)
  assert.equal((await status.json()).configured, true)

  const captured = await registered.get(routes.capture).fetch(request(routes.capture, { body: 'From the page' }))
  assert.equal(captured.status, 200)
  const { id, type } = await captured.json()
  assert.equal(type, 'inspiration')
  const vault = new Vault(root)
  assert.equal((await vault.get(id)).body, 'From the page')
  await vault.update(id, 1, { body: 'Revised idea' })
  const inspirations = registered.get(routes.inspirations)
  const matching = await inspirations.fetch(request(routes.inspirations, { query: 'Revised' }))
  assert.deepEqual((await matching.json()).notes.map(note => note.id), [id])
  const historical = await inspirations.fetch(request(routes.inspirations, { id, version: 1 }))
  const savedIdea = await historical.json()
  assert.equal(savedIdea.body, 'From the page')
  assert.deepEqual(savedIdea.versions, [2, 1])

  const empty = await registered.get(routes.capture).fetch(request(routes.capture, { body: '' }))
  assert.equal(empty.status, 400)
  assert.equal((await empty.json()).error.code, 'invalid-body')

  const relative = await registered.get(routes.config).fetch(request(routes.config, { path: 'relative' }))
  assert.equal(relative.status, 400)
  assert.equal((await relative.json()).error.code, 'invalid-path')

  const accepted = await registered.get(routes.config).fetch(request(routes.config, { path: root }))
  assert.equal(accepted.status, 200)
  assert.equal((await accepted.json()).pending, true)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(saved.vault, root)
})

test('status stays available before a vault is configured', async t => {
  const { ctx, registered } = host(undefined)
  registerRoutes(ctx, { current: () => ({ path: undefined, source: null }), saveDelay: 1 })
  const response = await registered.get(routes.status).fetch(request(routes.status))
  const body = await response.json()
  assert.equal(body.configured, false)
  assert.deepEqual(body.counts, { total: 0 })
})
