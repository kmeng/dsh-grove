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
  assert.deepEqual([...registered.keys()].sort(), [routes.capture, routes.config, routes.connection, routes.findings, routes.inspirations, routes.knowledge, routes.model, routes.parsers, routes.reports, routes.research, routes.sources, routes.status, routes.works].sort())

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

test('a candidate vault is checked before switching and the previous library stays intact', async t => {
  const first = await fixture(t)
  const second = await fixture(t)
  const invalid = await fixture(t)
  await symlink(join(first, 'Grove'), join(invalid, 'Grove'))
  let current = first
  const { ctx, registered } = host({ edit: async (_entry, next) => { current = next({}).vault } })
  registerRoutes(ctx, { current: () => ({ path: current, source: 'config' }), saveDelay: 1 })
  const call = (path, body) => registered.get(path).fetch(request(path, body))
  const firstIdea = await (await call(routes.capture, { body: 'First library' })).json()
  assert.equal((await call(routes.connection, { path: invalid })).status, 400)
  assert.equal((await call(routes.config, { path: invalid })).status, 400)
  assert.equal(current, first)
  assert.equal((await call(routes.connection, { path: second })).status, 200)
  assert.equal(current, first)
  await call(routes.config, { path: second })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(current, second)
  assert.deepEqual((await (await call(routes.inspirations, {})).json()).notes, [])
  await call(routes.config, { path: first })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal((await (await call(routes.inspirations, { id: firstIdea.id })).json()).body, 'First library')
})

test('independent research can be created, edited and reopened', async t => {
  const path = await fixture(t)
  const { ctx, registered } = host(undefined)
  registerRoutes(ctx, { current: () => ({ path, source: 'config' }) })
  const call = body => registered.get(routes.research).fetch(request(routes.research, body))
  const created = await (await call({ question: 'Where is the shade?', body: 'Compare on both sides' })).json()
  assert.equal(created.meta.type, 'research')
  const question = await new Vault(path).get(created.meta.question, created.meta.questionVersion)
  assert.equal(question.body, 'Where is the shade?')
  const revised = await (await call({ id: created.meta.id, version: 1, body: 'Repeat at noon' })).json()
  assert.equal(revised.meta.version, 2)
  const listing = await (await call()).json()
  assert.equal(listing.studies[0].body, 'Repeat at noon')
  assert.equal((await new Vault(path).get(created.meta.id, 1)).body, 'Compare on both sides')
})

test('parser settings persist without changing the active vault', async () => {
  let config = { vault: '/existing', parsers: { other: true } }
  const { ctx, registered } = host({ edit: async (_entry, change) => { config = change(config) } })
  registerRoutes(ctx, { current: () => ({ path: config.vault }), saveDelay: 1 })
  const route = registered.get(routes.parsers)
  assert.deepEqual(await (await route.fetch(request(routes.parsers))).json(), { pdf: true })
  assert.equal((await route.fetch(request(routes.parsers, { pdf: 'false' }))).status, 400)
  assert.deepEqual(await (await route.fetch(request(routes.parsers, { pdf: false }))).json(), { pending: true })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(config, { vault: '/existing', parsers: { other: true, pdf: false } })
})

test('a question alone creates a research project with optional notes', async t => {
  const path = await fixture(t)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path }) })
  const call = body => registered.get(routes.research).fetch(request(routes.research, body))
  const response = await call({ question: 'Where does the shade fall?' })
  assert.equal(response.status, 200)
  const { meta, body } = await response.json()
  assert.equal(body, '')
  const revised = await call({ id: meta.id, version: 1, body: 'Observe at noon' })
  assert.equal(revised.status, 200)
  assert.equal((await new Vault(path).get(meta.id, 1)).body, '')
})

test('inspiration discovery is opt-in and research preserves exact origin through reports', async t => {
  const path = await fixture(t)
  const store = new Vault(path)
  const first = await store.create({ type: 'inspiration', body: 'Shade and wind changed how it felt.' })
  const other = await store.create({ type: 'inspiration', body: 'The breezy side felt cooler.' })
  const updated = await store.update(first.meta.id, 1, { body: 'New observations.' })
  const { ctx, registered } = host()
  const modelConfig = { enabled: true }
  let calls = 0
  registerRoutes(ctx, { current: () => ({ path }), modelConfig, model: () => ({
    discover: async ({ inspiration, candidates }) => {
      calls++
      assert.equal(inspiration, first.body)
      assert.deepEqual(candidates, [{ number: 1, text: other.body }])
      return { matches: [
        { number: 9, reason: 'Invented source' },
        { number: 1, reason: 'Wind is another explanation.', question: 'How can we separate wind from shade?' },
        { number: 1, reason: 'Duplicate' },
      ] }
    },
  }) })
  const call = async (route, data) => {
    const response = await registered.get(route).fetch(request(route, data))
    const value = await response.json()
    assert.equal(response.status, 200, JSON.stringify(value))
    return value
  }
  const ref = { id: first.meta.id, version: 1 }
  const discover = { ...ref, action: 'discover' }
  assert.deepEqual(await call(routes.inspirations, discover), { enabled: false, matches: [] })
  assert.equal(calls, 0)
  modelConfig.inspirationLinks = true
  const { matches } = await call(routes.inspirations, discover)
  assert.deepEqual(matches.map(({ id, version }) => ({ id, version })), [{ id: other.meta.id, version: 1 }])
  const study = await call(routes.research, { question: matches[0].question, inspirations: [{ ...ref, excerpt: 'Shade and wind' }, matches[0]] })
  assert.deepEqual(study.meta.links[0], { kind: 'derived', ...ref, excerpt: 'Shade and wind' })
  const report = await call(routes.reports, { action: 'confirm', research: study.meta.id, body: 'Compare the two conditions separately.' })
  const knowledge = await call(routes.knowledge, { action: 'save', title: 'Compare separately', type: 'method', body: 'Control the wind.',
    report: { id: report.meta.id, version: report.meta.version } })
  const work = await call(routes.works, { action: 'save', title: 'Field guide', body: 'Measure both.', basis: { id: knowledge.meta.id, version: 1 } })
  const detail = await call(routes.inspirations, { ...ref, version: updated.meta.version, action: 'detail' })
  assert.equal(detail.studies[0].id, study.meta.id)
  assert.equal(detail.studies[0].reports[0].summary, report.body)
  assert.equal(detail.studies[0].knowledge[0].id, knowledge.meta.id)
  assert.equal(detail.studies[0].works[0].id, work.meta.id)
  assert.equal((await call(routes.inspirations, { id: other.meta.id, action: 'detail' })).studies[0].id, study.meta.id)
  assert.deepEqual((await call(routes.research, { question: 'Independent topic' })).meta.links, [])
})
