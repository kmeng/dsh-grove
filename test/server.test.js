import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { capture, inspectVault, registerRoutes, routes, saveVault, vaultStatus } from '../src/server.js'
import { organizeKnowledge } from '../src/modules/knowledge-index.js'
import { Vault } from '../src/vault.js'
import { researchRunStore } from '../src/adapters/storage/obsidian/research-runs.js'

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
  assert.deepEqual([...registered.keys()].sort(), [routes.capture, routes.config, routes.connection, routes.deepResearch, routes.findings, routes.inspirations, routes.knowledge, routes.model, routes.modelUpdate, routes.parsers, routes.parsersUpdate, routes.reports, routes.research, routes.researchUpdate, routes.sources, routes.status, routes.workImage, routes.works].sort())

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
  const call = body => {
    const route = body === undefined ? routes.research : routes.researchUpdate
    return registered.get(route).fetch(request(route, body))
  }
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
  const route = registered.get(routes.parsersUpdate)
  assert.deepEqual(await (await registered.get(routes.parsers).fetch(request(routes.parsers))).json(), { pdf: true })
  assert.equal((await route.fetch(request(routes.parsersUpdate, { pdf: 'false' }))).status, 400)
  assert.deepEqual(await (await route.fetch(request(routes.parsersUpdate, { pdf: false }))).json(), { pending: true })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(config, { vault: '/existing', parsers: { other: true, pdf: false } })
})

test('a question alone creates a research project with optional notes', async t => {
  const path = await fixture(t)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path }) })
  const call = body => {
    const route = body === undefined ? routes.research : routes.researchUpdate
    return registered.get(route).fetch(request(route, body))
  }
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
  const study = await call(routes.researchUpdate, { question: matches[0].question, inspirations: [{ ...ref, excerpt: 'Shade and wind' }, matches[0]] })
  assert.deepEqual(study.meta.links[0], { kind: 'derived', ...ref, excerpt: 'Shade and wind' })
  const report = await call(routes.reports, { action: 'confirm', research: study.meta.id, body: 'Compare the two conditions separately.' })
  const knowledge = await call(routes.knowledge, { action: 'save', title: 'Compare separately', type: 'method', body: 'Control the wind.',
    report: { id: report.meta.id, version: report.meta.version } })
  const work = await call(routes.works, { action: 'save', title: 'Field guide', body: 'Measure both.', basis: { id: knowledge.meta.id, version: 1 } })
  const detail = await call(routes.inspirations, { ...ref, version: updated.meta.version, action: 'detail' })
  assert.equal(detail.studies[0].id, study.meta.id)
  assert.equal(detail.studies[0].activity, study.meta.modified ?? study.meta.created)
  assert.equal(detail.studies[0].reports[0].summary, report.body)
  assert.equal(detail.studies[0].knowledge[0].id, knowledge.meta.id)
  assert.equal(detail.studies[0].works[0].id, work.meta.id)
  assert.equal((await call(routes.inspirations, { id: other.meta.id, action: 'detail' })).studies[0].id, study.meta.id)
  assert.deepEqual((await call(routes.researchUpdate, { question: 'Independent topic' })).meta.links, [])
})

test('deep research checkpoints progress, verifies citations, and reopens its Markdown report by topic', async t => {
  const root = await fixture(t)
  const vault = new Vault(root)
  const idea = await vault.create({ type: 'inspiration', body: '树荫会改变步行路线吗？' })
  let planCalls = 0
  let failWrite = true
  const queries = []
  const provider = {
    async plan(input) {
      planCalls++
      assert.equal(input.inspiration, idea.body)
      return { topic: '树荫与步行', questions: ['步行路线', '如何衡量'] }
    },
    async review({ sources, prior }) {
      return {
        claims: [{ text: '两份资料提到避开日晒', status: 'supported', sources: sources.map(source => source.id), quotes: sources.map(source => ({ id: source.id, text: source.text })), explanation: '两份资料描述了路线选择。' }],
        followups: prior ? [] : ['冲突研究'],
      }
    },
    async write() {
      assert.fail('The research model must not write when a report model is selected')
    },
  }
  const writer = {
    async write({ claims, sources, history }) {
      assert.equal(history, undefined)
      assert.deepEqual(claims[0].sources, [1, 2])
      assert.ok(sources.every(source => source.excerpts.length && source.excerpts.every(excerpt => excerpt.length <= 350)))
      if (failWrite) throw Object.assign(new Error('test timeout'), { code: 'model-timeout' })
      return { summary: '不同资料有共同发现。', sections: [{ heading: '日晒与路线选择', paragraphs: [{ text: '两份资料均描述了避开日晒的路线选择，尚无法区分季节的影响。', claims: [claims[0].id] }] }], limitations: '缺少跨季节比较。', conclusion: '现有材料显示路线选择与日晒有关。', nextSteps: ['检查季节影响'] }
    },
  }
  function mount() {
    const { ctx, registered } = host()
    registerRoutes(ctx, {
      current: () => ({ path: root }),
      modelConfig: { enabled: true, reportWriting: { name: 'writer', endpoint: 'https://writer.example/api' } },
      model: (_settings, role) => role === 'report' ? writer : provider,
      researchSearch: () => async query => {
        queries.push(query)
        const domain = query === '冲突研究' ? 'study.example' : 'city.example'
        return [{ title: 'Tree coverage study', url: `https://${domain}/study`, text: 'Participants chose shaded paths.' }]
      },
    })
    return (path, data) => registered.get(path).fetch(request(path, data))
  }
  let call = mount()
  const ideaRef = { id: idea.meta.id, version: 1 }
  const start = await call(routes.deepResearch, { action: 'start', idea: ideaRef })
  assert.equal(start.status, 202)
  const { id, topic } = await start.json()
  await waitFor(async () => {
    const { runs } = await (await call(routes.deepResearch, { action: 'list', idea: ideaRef })).json()
    return runs[0]?.status === 'failed'
  })
  const { runs } = await (await call(routes.deepResearch, { action: 'list', idea: ideaRef })).json()
  assert.equal(runs[0].error.code, 'model-timeout')
  assert.equal(runs[0].verified[0].status, 'supported')
  assert.deepEqual(queries, ['步行路线', '如何衡量', '冲突研究'])
  assert.equal(planCalls, 1)

  call = mount()
  failWrite = false
  assert.equal((await call(routes.deepResearch, { action: 'retry', id })).status, 202)
  await waitFor(async () => {
    const { runs } = await (await call(routes.deepResearch, { action: 'list', topic })).json()
    return runs[0]?.status === 'complete'
  })
  assert.equal(planCalls, 1)
  assert.equal(queries.length, 3)
  const { reports } = await (await call(routes.reports, { action: 'list', research: topic })).json()
  assert.equal(reports.length, 1)
  assert.equal(reports[0].meta.id, id)
  assert.equal(reports[0].meta.review, 'draft')
  assert.match(reports[0].body, /## 摘要/)
  assert.match(reports[0].body, /## 研究分析[\s\S]+尚无法区分季节的影响。 \[1\] \[2\]/)
  assert.match(reports[0].body, /## 结论[\s\S]+## 参考资料/)
  assert.doesNotMatch(reports[0].body, /证据不足|证据局限|开放问题与下一步|发现与证据/)
  assert.match(reports[0].body, /https:\/\/study\.example\/study/)
  assert.equal((await vault.get(topic)).meta.links[0].version, 1)
  const updated = await call(routes.reports, { action: 'confirm', research: topic, id, version: 1, body: reports[0].body })
  assert.equal((await updated.json()).meta.review, 'confirmed')
  const reopened = await (await call(routes.deepResearch, { action: 'list', topic })).json()
  assert.equal(reopened.runs[0].report.version, 2)
  assert.deepEqual(reopened.runs[0].suggestions, [])
  assert.equal(reopened.runs[0].round, 2)
  const detail = await (await call(routes.inspirations, { ...ideaRef, action: 'detail' })).json()
  assert.equal(detail.studies[0].activity, reopened.runs[0].created)
  assert.equal(detail.studies[0].reports[0].review, 'confirmed')
})

test('deep research reuses exact imported versions when web search yields no sources', async t => {
  const root = await fixture(t)
  const vault = new Vault(root)
  const question = await vault.create({ type: 'question', body: 'How much sunlight reaches the street?' })
  const study = await vault.create({ type: 'research', title: 'Sunlight on the street', body: '', question: question.meta.id })
  const document = await vault.create({
    type: 'source', title: 'observations.md', body: JSON.stringify({ blocks: [{ locator: 'line 1', text: 'Sunlight reaches the street at noon.' }] }),
    links: [{ kind: 'related', id: study.meta.id, version: study.meta.version }],
  })
  const { ctx, registered } = host()
  registerRoutes(ctx, {
    current: () => ({ path: root }),
    modelConfig: { enabled: true },
    researchSearch: () => async () => [],
    model: () => ({
      plan: async () => ({ topic: 'Sunlight', questions: ['Sunlight on the street?'] }),
      review: async ({ sources }) => ({
        claims: [{ text: 'Sunlight at noon', status: 'supported', explanation: 'One document records it.', sources: sources.map(source => source.id) }],
        followups: [],
      }),
      write: async () => ({ summary: 'A single document records sunlight at noon.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'A single document records sunlight at noon.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'A single document records sunlight at noon.', nextSteps: [] }),
    }),
  })
  const call = (path, data) => registered.get(path).fetch(request(path, data))
  const started = await call(routes.deepResearch, { action: 'start', topic: study.meta.id, language: 'en' })
  assert.equal(started.status, 202)
  const { id } = await started.json()
  await waitFor(async () => {
    const { runs } = await (await call(routes.deepResearch, { action: 'list', topic: study.meta.id })).json()
    return runs[0]?.status === 'complete'
  })
  const report = await (await call(routes.reports, { action: 'read', id, version: 1 })).json()
  assert.match(report.body, /## References[\s\S]+observations\.md/)
  assert.doesNotMatch(report.body, /Insufficient evidence/)
  assert.equal(report.evidence[0].original.id, document.meta.id)
  assert.equal(report.evidence[0].original.version, 1)
})

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail('Timed out waiting for the research stage')
}

test('deep research needs a model and web search, and cannot finish after retrieval fails', async t => {
  const root = await fixture(t)
  const vault = new Vault(root)
  let webAvailable = false
  let plans = 0
  let writes = 0
  let queries = 0
  const provider = {
    async plan() { plans++; return { topic: 'Walking in the shade', questions: ['What was measured?'] } },
    async review() {
      return { claims: [{ text: 'More observations are needed', status: 'insufficient', sources: [], explanation: 'Limited data.' }], followups: [] }
    },
    async write() { writes++; return { summary: 'More observations are needed.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'More observations are needed.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'More observations are needed.', nextSteps: [] } },
  }
  function mount(options) {
    const { ctx, registered } = host()
    registerRoutes(ctx, { current: () => ({ path: root }), ...options })
    return input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  }
  const start = { action: 'start', direction: 'Does sunlight affect walking?' }
  const absentModel = await mount({})(start)
  assert.equal(absentModel.status, 409)
  assert.equal((await absentModel.json()).error.code, 'model-disabled')

  const model = { modelConfig: { enabled: true }, model: () => provider }
  const absentSearch = await mount(model)(start)
  assert.equal(absentSearch.status, 409)
  assert.equal((await absentSearch.json()).error.code, 'research-search-disabled')
  assert.deepEqual(await vault.list(), [])
  assert.equal(plans, 0)

  const call = mount({ ...model, researchSearch: () => async () => {
    queries++
    if (!webAvailable) throw Object.assign(new Error('Network offline'), { code: 'research-search' })
    return []
  } })
  const launched = await call(start)
  assert.equal(launched.status, 202)
  const { id, topic } = await launched.json()
  const latest = async () => (await (await call({ action: 'list', topic })).json()).runs[0]
  await waitFor(async () => (await latest())?.status === 'failed')
  assert.equal((await latest()).error.code, 'research-search')
  assert.equal((await latest()).report, undefined)
  assert.equal(writes, 0)
  assert.equal((await vault.list()).some(note => note.meta.type === 'report'), false)

  const jobs = researchRunStore(vault)
  const legacy = await jobs.read(id)
  await jobs.write({ ...legacy, web: false, collected: [],
    review: { claims: [], followups: [] }, verified: { claims: [], sources: [] },
    written: { summary: 'Old local-only draft', nextSteps: [] } })
  webAvailable = true
  assert.equal((await call({ action: 'retry', id })).status, 202)
  await waitFor(async () => (await latest())?.status === 'complete')
  assert.equal(plans, 1)
  assert.equal(queries, 2)
  assert.equal(writes, 1)
  assert.doesNotMatch((await vault.get(id)).body, /Old local-only draft/)
})

test('legacy settings become the default and a verified research override routes only deep research', async t => {
  const root = await fixture(t)
  let profile = { model: { enabled: true, name: 'legacy', endpoint: 'https://model.example/v1', inspirationLinks: true, webSearch: true } }
  const invoked = []
  function mount() {
    const { ctx, registered } = host({
      async edit(_entry, change) { profile = change(profile) },
    })
    registerRoutes(ctx, {
      current: () => ({ path: root }), modelConfig: profile.model, saveDelay: 1, researchSearch: () => async () => [],
      model: (settings, role) => ({
        async investigate() {
          invoked.push(['test', role, settings.name])
          if (settings.name === 'unreachable') throw Object.assign(new Error('HTTP 401'), { code: 'model-auth' })
          return { text: 'OK', citations: [] }
        },
        async plan() {
          invoked.push(['plan', role, settings.name])
          return { topic: 'Test topic', questions: ['What happened?'] }
        },
        async review() {
          return { claims: [{ text: 'Unknown', explanation: 'Limited data.', status: 'insufficient', sources: [] }], followups: [] }
        },
        async write() { return { summary: 'Limited data.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'Limited data.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'Limited data.', nextSteps: [] } },
      }),
    })
    return (route, data) => registered.get(route).fetch(request(route, data))
  }

  let call = mount()
  const legacy = await (await call(routes.model)).json()
  assert.equal(legacy.name, 'legacy')
  assert.equal(legacy.deepResearch, null)
  assert.equal(legacy.connection.status, 'unverified')
  assert.equal(legacy.researchConnection.status, 'unverified')

  async function start(direction) {
    const response = await call(routes.deepResearch, { action: 'start', direction })
    assert.equal(response.status, 202)
    const { topic } = await response.json()
    await waitFor(async () => {
      const data = await (await call(routes.deepResearch, { action: 'list', topic })).json()
      return data.runs[0]?.status === 'complete'
    })
  }

  async function save(overrides) {
    const response = await call(routes.modelUpdate, { ...legacy, ...overrides, verify: true })
    assert.equal(response.status, 200)
    const { changeId } = await response.json()
    await waitFor(async () => profile.model.changeId === changeId)
    call = mount()
    return (await call(routes.model)).json()
  }

  await start('Inheritance')
  const configured = await save({ deepResearch: { name: 'dedicated', endpoint: 'https://research.example/v1' } })
  assert.equal(configured.connection.status, 'connected')
  assert.equal(configured.researchConnection.status, 'connected')
  assert.equal(configured.inspirationLinks, true)
  assert.equal(configured.webSearch, true)
  await start('Override')
  const failing = await save({ deepResearch: { name: 'unreachable', endpoint: 'https://research.example/v1' } })
  assert.equal(failing.connection.status, 'connected')
  assert.equal(failing.researchConnection.status, 'failed')
  assert.equal(failing.researchConnection.code, 'model-auth')
  assert.equal((await save({ deepResearch: null })).researchConnection.status, 'connected')
  assert.deepEqual(invoked.filter(row => row[0] === 'plan'), [
    ['plan', 'research', 'legacy'], ['plan', 'research', 'dedicated'],
  ])
})

test('deep research resolves the current dsh model unless the profile chooses another host model', async t => {
  const root = await fixture(t)
  const config = { source: 'dsh', enabled: true, webSearch: true }
  const calls = []
  let hostDefault = 'default-a'
  const { ctx, registered } = host()
  const dshModels = {
    defaultSelection: () => ({ provider: 'dsh-route', model: hostDefault }),
    connection: () => undefined,
    model: selection => ({
      async plan() {
        calls.push(selection.model)
        return { topic: 'Test topic', questions: ['What is known?'] }
      },
      async review() {
        return { claims: [{ text: 'Limited data', explanation: 'No sources.', status: 'insufficient', sources: [] }], followups: [] }
      },
      async write() { return { summary: 'Limited data.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'Limited data.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'Limited data.', nextSteps: [] } },
    }),
  }
  registerRoutes(ctx, { current: () => ({ path: root }), modelConfig: config, dshModels, researchSearch: () => async () => [] })
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  for (const model of ['default-a', 'default-b', 'specialist']) {
    if (model === 'specialist') config.deepResearch = { source: 'dsh', provider: 'dsh-route', model }
    else hostDefault = model
    const response = await call({ action: 'start', direction: 'Test ' + model })
    assert.equal(response.status, 202)
    const { topic } = await response.json()
    await waitFor(async () => {
      const state = await (await call({ action: 'list', topic })).json()
      return state.runs[0]?.status === 'complete'
    })
  }
  assert.deepEqual(calls, ['default-a', 'default-b', 'specialist'])
})

test('API JSON rejects oversized streams and non-JSON bodies before creating a note', async t => {
  const root = await fixture(t)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const route = registered.get(routes.capture)
  const url = 'http://localhost' + routes.capture
  const plain = await route.fetch(new Request(url, {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"body":"should never be stored"}',
  }))
  assert.equal(plain.status, 415)
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.from('{"body":"tiny","padding":"'))
      for (let i = 0; i < 18; i++) controller.enqueue(Buffer.alloc(65536, 0x78))
      controller.enqueue(Buffer.from('"}'))
      controller.close()
    },
  })
  assert.equal(route.requestBody, 'streaming')
  const oversized = await route.fetch(new Request(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
  }))
  assert.equal(oversized.status, 413)
  assert.deepEqual(await new Vault(root).list(), [])
})

test('follow-up web queries cannot carry phrases obtained from an imported private document', async t => {
  const root = await fixture(t)
  const vault = new Vault(root)
  const question = await vault.create({ type: 'question', body: 'Sunlight and walking' })
  const topic = await vault.create({ type: 'research', title: 'Sunlight and walking', body: '', question: question.meta.id })
  await vault.create({
    type: 'source', title: 'notes.md',
    body: JSON.stringify({ blocks: [{ locator: 'Paragraph 1', text: 'Sunlight private meadow code phrase' }] }),
    links: [{ kind: 'related', id: topic.meta.id, version: 1 }],
  })
  const queries = []
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }), modelConfig: { enabled: true },
    researchSearch: () => async query => { queries.push(query); return [] },
    model: () => ({
      async plan() { return { topic: 'Sunlight and walking', questions: ['Sunlight walking'] } },
      async review({ sources }) {
        const phrase = sources.some(source => source.text.includes('private meadow code phrase'))
          ? 'private meadow code phrase' : 'outdoor walk in summer'
        return { claims: [{ text: 'Insufficient', explanation: 'No public sources.', status: 'insufficient', sources: [] }], followups: [phrase] }
      },
      async write() { return { summary: 'No public sources.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'No public sources.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'No public sources.', nextSteps: [] } },
    }),
  })
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  assert.equal((await call({ action: 'start', topic: topic.meta.id })).status, 202)
  await waitFor(async () => (await (await call({ action: 'list', topic: topic.meta.id })).json()).runs[0]?.status === 'complete')
  assert.deepEqual(queries, ['Sunlight walking', 'outdoor walk in summer'])
})

test('deep research can use a supplied public page without invoking paid search', async t => {
  const root = await fixture(t)
  const vault = new Vault(root)
  const idea = await vault.create({ type: 'inspiration', body: 'Read [evidence](https://example.org/article).' })
  const requested = []
  const { ctx, registered } = host()
  registerRoutes(ctx, {
    current: () => ({ path: root }), modelConfig: { enabled: true },
    researchSearch: () => { assert.fail('The paid search provider should not be used for link-based research') },
    readResearchPage: async url => {
      requested.push(url)
      return { url, title: 'Evidence', text: 'An actual public passage about the subject.' }
    },
    model: () => ({
      async plan() { return { topic: 'Evidence', questions: ['What is the evidence?'] } },
      async review({ sources }) {
        return { claims: [{ text: 'A passage exists', explanation: 'Only one source.', status: 'insufficient', sources: sources.map(source => source.id) }],
          followups: ['Look for more'] }
      },
      async write() { return { summary: 'One public source.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'One public source.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'One public source.', nextSteps: [] } },
    }),
  })
  const ideaRef = { id: idea.meta.id, version: 1 }
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  const start = await call({ action: 'start', idea: ideaRef })
  assert.equal(start.status, 202)
  const { id, topic } = await start.json()
  await waitFor(async () => (await (await call({ action: 'list', topic })).json()).runs[0]?.status === 'complete')
  assert.deepEqual(requested, ['https://example.org/article'])
  assert.match((await vault.get(id)).body, /https:\/\/example\.org\/article/)
})

test('a confirmed report can be kept once in knowledge and found by a natural-language query', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const draft = await store.create({ type: 'report', title: '智能体 UX 设计', body: '保留可接管的操作', review: 'draft' })
  const keep = version => registered.get(routes.knowledge).fetch(request(routes.knowledge, {
    action: 'keep-report', report: { id: draft.meta.id, version },
  }))
  assert.notEqual((await keep(1)).status, 200)
  await store.update(draft.meta.id, 1, { review: 'confirmed' })
  const results = await Promise.all([keep(2), keep(2)])
  assert.deepEqual(results.map(result => result.status), [200, 200])
  const [first, second] = await Promise.all(results.map(result => result.json()))
  assert.equal(first.meta.id, second.meta.id)
  assert.deepEqual(first.meta.links, [{ kind: 'derived', id: draft.meta.id, version: 2 }])
  await store.update(draft.meta.id, 2, { body: '更正后的结论', review: 'confirmed' })
  const updated = await Promise.all([keep(3), keep(3)])
  assert.deepEqual(updated.map(result => result.status), [200, 200])
  for (const response of updated) {
    const note = await response.json()
    assert.equal(note.meta.id, first.meta.id)
    assert.equal(note.meta.version, 2)
    assert.equal(note.meta.links[0].version, 3)
  }
  assert.equal((await (await keep(2)).json()).meta.version, 1)
  assert.equal((await store.get(first.meta.id, 1)).meta.links[0].version, 2)
  const result = await registered.get(routes.inspirations).fetch(request(routes.inspirations, {
    action: 'search', query: '帮我找一下关于智能体 UX 设计的笔记',
  }))
  assert.deepEqual(new Set((await result.json()).notes.map(note => note.id)), new Set([first.meta.id, draft.meta.id]))
})

test('knowledge detail shows the saved report version and links to its original study', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const question = await store.create({ type: 'question', body: 'How is battery storage sized?' })
  const study = await store.create({ type: 'research', question: question.meta.id, title: question.meta.title, body: '' })
  const report = await store.create({ type: 'report', body: '## Conclusion\nBattery storage.\n\n## References\nDetailed evidence.',
    links: [{ kind: 'related', id: study.meta.id, version: 1 }] })
  const call = async input => {
    const response = await registered.get(routes.knowledge).fetch(request(routes.knowledge, input))
    assert.equal(response.status, 200)
    return response.json()
  }
  const note = await call({ action: 'keep-report', report: report.meta })
  await store.update(report.meta.id, 1, { body: 'Later version.' })
  const detail = await call({ action: 'detail', ...note.meta })
  assert.equal(detail.report.meta.version, 1)
  assert.match(detail.report.body, /Detailed evidence/)
  assert.doesNotMatch(detail.body, /Detailed evidence/)
  assert.equal(detail.studyId, study.meta.id)
  const legacy = await store.create({ type: 'concept', body: 'Legacy knowledge.' })
  assert.equal((await call({ action: 'detail', ...legacy.meta })).body, 'Legacy knowledge.')
  await rm(join(await store.folder(), report.meta.id + '.v1.md'))
  const missing = await call({ action: 'detail', ...note.meta })
  assert.equal(missing.reportMissing, true)
  assert.equal(missing.body, note.body)
})

test('daily knowledge organization catches up, deduplicates and retains the last successful index', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const note = await store.create({ type: 'concept', title: 'Battery storage', body: 'Battery storage balances supply.' })
  const match = await store.create({ type: 'method', title: 'Battery storage sizing', body: 'Battery storage depends on demand.' })
  const chinese = await store.create({ type: 'concept', title: '电池储能与负荷', body: '电池储能用于平衡负荷。' })
  const day = new Date(2026, 10, 21, 12)
  const results = await Promise.all([organizeKnowledge(store, day), organizeKnowledge(new Vault(root), day)])
  assert.deepEqual(results, [true, true])
  assert.equal(await organizeKnowledge(new Vault(root), day), false)
  const browse = async () => {
    const result = await registered.get(routes.knowledge).fetch(request(routes.knowledge, { action: 'browse' }))
    assert.equal(result.status, 200)
    const { items } = await result.json()
    return new Map(items.map(item => [item.meta.id, item]))
  }
  const items = await browse()
  assert.deepEqual(items.get(note.meta.id).tags, ['battery', 'storage'])
  assert.equal(items.get(note.meta.id).summary, note.body)
  assert.deepEqual(items.get(note.meta.id).related.map(meta => meta.id), [match.meta.id])
  assert.ok(items.get(chinese.meta.id).tags.includes('电池'))
  const folder = await store.folder()
  const index = join(folder, '.knowledge-index.json')
  const previous = await readFile(index, 'utf8')
  const invalid = join(folder, note.meta.id + '.v2.md')
  await writeFile(invalid, 'invalid Markdown')
  const next = new Date(2026, 10, 23, 12)
  await assert.rejects(organizeKnowledge(store, next), /frontmatter/)
  assert.equal(await readFile(index, 'utf8'), previous)
  await rm(invalid)
  assert.deepEqual((await browse()).get(note.meta.id).tags, ['battery', 'storage'])
  assert.equal(await organizeKnowledge(store, next), true)
  assert.notEqual(await readFile(index, 'utf8'), previous)
  assert.equal((await store.get(note.meta.id)).meta.version, 1)
})

test('research conversation keeps follow-up history and origin when using local evidence only', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const idea = await store.create({ type: 'inspiration', body: '研究如何让用户人工接管。' })
  const { ctx, registered } = host()
  const plans = []
  registerRoutes(ctx, {
    current: () => ({ path: root }), modelConfig: { enabled: true },
    parsers: new Map([['md', { id: 'markdown', version: 1, async parse() {
      return [{ text: '人工接管需要界面提供暂停入口。', locator: '第 1 段' }]
    } }]]),
    model: () => ({
      async plan(input) { plans.push(input); return { topic: '人工接管', questions: ['如何接管？'] } },
      async review({ sources }) { return { claims: [{ text: '需要承接上下文', explanation: '已回查资料', status: 'insufficient', sources: sources.map(source => source.id) }], followups: [] } },
      async write() { return { summary: '当前材料不足以验证交互方案。', sections: [{ heading: 'Analysis', paragraphs: [{ text: '当前材料不足以验证交互方案。', claims: [1] }] }], limitations: 'Limited evidence', conclusion: '当前材料不足以验证交互方案。', nextSteps: [] } },
    }),
  })
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  const first = await (await call({ action: 'start', conversation: true, idea: { id: idea.meta.id, version: 1 }, direction: '怎么做？', attachment: { name: '接管.md', original: Buffer.from('人工接管').toString('base64') } })).json()
  await waitFor(async () => (await (await call({ action: 'list', topic: first.topic })).json()).runs[0]?.status === 'complete')
  const next = await (await call({ action: 'start', conversation: true, topic: first.topic, direction: '三秒内呢？' })).json()
  await waitFor(async () => (await (await call({ action: 'list', topic: first.topic })).json()).runs[0]?.id === next.id &&
    (await (await call({ action: 'list', topic: first.topic })).json()).runs[0]?.status === 'complete')
  assert.equal(next.topic, first.topic)
  assert.equal(first.attachment.name, '接管.md')
  assert.equal((await store.get(first.attachment.id)).meta.links[0].id, first.topic)
  assert.equal((await store.get(first.topic)).meta.links[0].id, idea.meta.id)
  assert.deepEqual(plans[1].history, [{ question: '怎么做？', summary: '当前材料不足以验证交互方案。' }])
})

test('research without citable evidence retains its failed turn and creates no report', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const { ctx, registered } = host()
  registerRoutes(ctx, {
    current: () => ({ path: root }), modelConfig: { enabled: true },
    model: () => ({
      async plan() { return { topic: '人工接管', questions: ['如何接管？'] } },
      async review() { return { claims: [{ text: '缺乏证据', explanation: '没有资料', status: 'insufficient', sources: [] }], followups: [] } },
      async write() { return { summary: '没有资料', sections: [{ heading: 'Analysis', paragraphs: [{ text: '没有资料', claims: [1] }] }], limitations: 'Limited evidence', conclusion: '没有资料', nextSteps: [] } },
    }),
  })
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  const started = await (await call({ action: 'start', conversation: true, direction: '如何接管？' })).json()
  const read = async () => (await (await call({ action: 'list', topic: started.topic })).json()).runs[0]
  await waitFor(async () => ['failed', 'complete'].includes((await read())?.status))
  const turn = await read()
  assert.equal(turn.status, 'failed')
  assert.equal(turn.error.code, 'research-no-evidence')
  assert.equal(turn.report, undefined)
  assert.equal((await store.get(started.topic)).meta.type, 'research')
  assert.ok(!(await store.list()).some(note => note.meta.type === 'report'))
})

test('an old generated draft without citable evidence cannot be confirmed', async t => {
  const root = await fixture(t)
  const { ctx, registered } = host()
  const store = new Vault(root)
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const question = await store.create({ type: 'question', body: '缺资料的问题' })
  const topic = await store.create({ type: 'research', question: question.meta.id, title: '缺资料', body: '' })
  const report = await store.create({ type: 'report', review: 'draft', body: '没有可引用的资料。', links: [
    { kind: 'related', id: topic.meta.id, version: 1 },
  ] })
  await researchRunStore(store).write({ schema: 1, id: report.meta.id, topic: topic.meta.id, status: 'complete',
    created: report.meta.created, report: { id: report.meta.id, version: 1 }, verified: { sources: [], claims: [] } })
  const turns = await (await registered.get(routes.deepResearch).fetch(request(routes.deepResearch, {
    action: 'list', topic: topic.meta.id,
  }))).json()
  assert.equal(turns.runs[0].status, 'failed')
  assert.equal(turns.runs[0].error.code, 'research-no-evidence')
  const result = await registered.get(routes.reports).fetch(request(routes.reports, {
    action: 'confirm', id: report.meta.id, version: 1, research: topic.meta.id, body: report.body,
  }))
  assert.notEqual(result.status, 200)
  assert.deepEqual(await store.versions(report.meta.id), [1])
})

test('desktop research uses the host search without a Tavily configuration', async t => {
  const root = await fixture(t)
  const { ctx, registered } = host()
  let query
  let modelInput
  registerRoutes(ctx, {
    current: () => ({ path: root }), modelConfig: { enabled: true },
    dshWeb: {
      async searchAvailable() { return true },
      async search(text) {
        query = text
        return [{ url: 'https://example.org/release', title: 'Daily update', text: 'The data was published today.', publishedAt: '2026-11-18' }]
      },
    },
    model: () => ({
      async plan(input) { modelInput = input; return { topic: 'Recent data', questions: ['Daily update 2026-11-17 to 2026-11-18'] } },
      async review({ sources }) {
        return { claims: [{ text: 'The data was published today.', explanation: 'One source.', status: 'insufficient', sources: sources.map(s => s.id) }], followups: [] }
      },
      async write() { return { summary: 'One source provides a dated update.', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'One source provides a dated update.', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'One source provides a dated update.', nextSteps: [] } },
    }),
  })
  const call = input => registered.get(routes.deepResearch).fetch(request(routes.deepResearch, input))
  const start = await (await call({ action: 'start', direction: 'Find data from the last two days', conversation: true, timeZone: 'Asia/Shanghai' })).json()
  const read = async () => (await (await call({ action: 'list', topic: start.topic })).json()).runs[0]
  await waitFor(async () => ['failed', 'complete'].includes((await read())?.status))
  const turn = await read()
  assert.equal(turn.status, 'complete')
  assert.match(query, /2026-11-17/)
  assert.match(modelInput.today, /^\d{4}-\d{2}-\d{2}$/)
  assert.match((await new Vault(root).get(turn.report.id)).body, /<https:\/\/example\.org\/release>/)
})

test('the UCD report retains concept and acronym tags and rebuilds a same-day legacy index', async t => {
  const root = await fixture(t)
  const store = new Vault(root)
  const { ctx, registered } = host()
  registerRoutes(ctx, { current: () => ({ path: root }) })
  const title = '2023–2026 年 AI 时代以用户为中心的设计：原则、方法、评估与治理维度的可验证新发展'
  const body = '在 2023 年初至 2026 年 11 月的窗口内，以用户为中心的设计（UCD）在生成式 AI 语境下出现了若干可辨识的新发展，但证据基础尚不成熟。主要发现包括：第一，LLM 模拟用户与模拟对话已被提出为 UX 研究的前置方法。'
  const note = await store.create({ type: 'concept', title, body })
  const acronymOnly = await store.create({ type: 'method', title: 'UCD', body: '方法。' })
  const explicit = await store.create({ type: 'theory', title: '以证据为基础的分析', body: '以证据为基础的分析（EBA）明确证据与判断的关系。' })
  const legacy = { schema: 1, day: '2026-11-22', entries: {
    [note.meta.id]: { version: 1, tags: ['问题', '合成', '模拟', '发展', '方法'], related: [acronymOnly.meta.id] },
  } }
  const path = join(await store.folder(), '.knowledge-index.json')
  await writeFile(path, JSON.stringify(legacy))

  const today = new Date(2026, 10, 22, 12)
  assert.equal(await organizeKnowledge(store, today), true)
  assert.equal(await organizeKnowledge(store, today), false)
  const response = await registered.get(routes.knowledge).fetch(request(routes.knowledge, { action: 'browse' }))
  assert.equal(response.status, 200)
  const { items } = await response.json()
  const updated = items.find(item => item.meta.id === note.meta.id)
  assert.deepEqual(updated.tags.slice(0, 2), ['以用户为中心的设计', 'UCD'])
  assert.ok(updated.tags.length <= 5)
  assert.ok(updated.tags.includes('生成式 AI'))
  assert.ok(updated.tags.includes('UX 研究'))
  assert.ok(!updated.tags.some(tag => legacy.entries[note.meta.id].tags.includes(tag)))
  assert.ok(!updated.related.some(meta => meta.id === acronymOnly.meta.id), 'two spellings of one concept count once')
  const abbreviation = items.find(item => item.meta.id === acronymOnly.meta.id)
  assert.deepEqual(abbreviation.tags, ['以用户为中心的设计', 'UCD'])
  assert.deepEqual(items.find(item => item.meta.id === explicit.meta.id).tags.slice(0, 2), ['以证据为基础的分析', 'EBA'])
})

test('a work resumes after closing and saves a versioned illustrated article from an exact source', async t => {
  const path = await fixture(t)
  const vault = new Vault(path)
  const basis = await vault.create({ type: 'concept', title: '树荫与步行', body: '早晨的树荫与步行体验观察。' })
  await vault.update(basis.meta.id, 1, { body: '另一版素材。' })
  const { ctx, registered } = host()
  let failModel = false
  const stages = []
  const topicEntered = Promise.withResolvers()
  const releaseTopic = Promise.withResolvers()
  registerRoutes(ctx, {
    current: () => ({ path }), modelConfig: { enabled: true },
    model: () => ({ async compose(input) {
      assert.equal(input.language, 'zh')
      stages.push(input.stage)
      if (input.stage === 'visual') {
        assert.equal(input.placement, 'section')
        return { reply: '平视照片，把有树荫和无遮阴的人行道并列。' }
      }
      assert.equal(input.sources[0].body, basis.body)
      if (failModel) throw Object.assign(new Error('Offline'), { code: 'model-network' })
      if (input.stage === 'topic') {
        topicEntered.resolve()
        await releaseTopic.promise
        return { reply: '建议从现场观察入手。', title: '同一条街，两种走法', audience: '街坊', thesis: '对照时段再判断树荫的影响。' }
      }
      if (input.stage === 'outline') return { reply: '先写观察，再解释原因。', sections: [
        { heading: '走过同一条街', point: '描述两侧的区别', visual: '用街景照片对照' },
        { heading: '比较不同时段', point: '补做两次走访' },
      ] }
      return { reply: '这一节已经整理。', body: '逐节正文：' + input.selected.heading, sourceNumbers: [1] }
    } }),
  })
  const post = (action, data = {}) => registered.get(routes.works).fetch(request(routes.works, { action, ...data }))
  let draft = await (await post('draft-start', { basis: { id: basis.meta.id, version: 1 }, title: basis.meta.title })).json()
  const change = async (action, extra, status = 200) => {
    const response = await post('draft-' + action, { id: draft.id, revision: draft.revision, ...extra })
    assert.equal(response.status, status)
    const result = await response.json()
    if (status === 200 && result.id) draft = result
    return result
  }
  await change('confirm-topic', {}, 400)
  const topic = change('ask', { message: '写给街坊，讲讲树荫', language: 'zh' })
  try {
    await topicEntered.promise
    const response = await post('draft-progress', { id: draft.id })
    assert.deepEqual(await response.json(), { progress: { action: 'draft-ask', phase: 'topic' } })
  } finally {
    releaseTopic.resolve()
  }
  await topic
  assert.deepEqual(await (await post('draft-progress', { id: draft.id })).json(), { progress: null })
  await change('confirm-topic')
  await change('ask', { message: '先写观察，再谈解释', language: 'zh' })
  await change('confirm-outline')
  await change('finish', {}, 400)
  await change('ask', { message: '写第一节', section: draft.sections[0].id, language: 'zh' })
  assert.equal(draft.sections[0].body, '')
  await change('confirm-section', { section: draft.sections[0].id })
  const original = draft.sections[0].body
  failModel = true
  await change('ask', { message: '写第二节', section: draft.sections[1].id, language: 'zh' }, 502)
  const restored = await (await post('draft-read', { id: draft.id })).json()
  assert.equal(restored.revision, draft.revision)
  assert.equal(restored.sections[0].body, original)
  assert.equal(restored.sections[1].body, '')
  assert.equal(Object.values(restored.discussions).flat().length, 6)
  failModel = false
  await change('section', { section: draft.sections[1].id, body: '自己写的第二节，下午再走一次。' })
  await change('confirm-section', { section: draft.sections[1].id })
  assert.equal(draft.sections[0].body, original)
  await change('visual', { section: draft.sections[0].id, language: 'zh' })
  assert.match(draft.sections[0].visual, /平视照片/)
  assert.equal(draft.sections[0].body, original)
  await change('section', { section: draft.sections[0].id, body: '过期修改', revision: draft.revision - 1 }, 409)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD5sAAAAASUVORK5CYII='
  await change('image', { section: draft.sections[0].id, bytes: png, alt: '有树荫的人行道', caption: '图一，早晨的现场' })
  const uri = draft.sections[0].image.path
  const photo = await registered.get(routes.workImage).fetch(request(routes.workImage + '?file=' + uri.split('/')[1]))
  assert.equal(photo.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from(png, 'base64'))
  const rejected = await registered.get(routes.workImage).fetch(request(routes.workImage + '?file=..%2Fsecret.png'))
  assert.equal(rejected.status, 404)
  await change('plan-add', { section: draft.sections[1].id, kind: 'chart', alt: '两次记录对比' })
  const chartId = draft.imagePlan[0].id
  await change('render-chart', { item: chartId, rows: [{ label: '<上午>', value: 30 }, { label: '下午', value: 55 }],
    unit: '秒', citation: '测试中的步行记录' })
  const chart = await registered.get(routes.workImage).fetch(request(routes.workImage + '?file=' + draft.imagePlan[0].candidate.split('/')[1]))
  assert.equal(chart.headers.get('content-type'), 'image/svg+xml')
  assert.match(await chart.text(), /&lt;上午&gt;/)
  await change('finish', {}, 400)
  await change('image-accept', { item: chartId })
  const saved = await change('finish')
  assert.deepEqual(await change('finish'), saved)
  const work = await (await post('read', saved.work)).json()
  assert.match(work.body, /自己写的第二节/)
  assert.ok(work.body.includes('![有树荫的人行道](' + uri + ')\n图一，早晨的现场'))
  assert.deepEqual(work.meta.links, [{ kind: 'derived', id: basis.meta.id, version: 1 }])
  assert.deepEqual((await (await post('draft-list')).json()).drafts, [])
  assert.equal((await (await post('list')).json()).items[0].meta.id, work.meta.id)
  const keep = async () => {
    const response = await registered.get(routes.knowledge).fetch(request(routes.knowledge, { action: 'keep-work', work: saved.work }))
    assert.equal(response.status, 200)
    return response.json()
  }
  const kept = await keep()
  assert.equal((await keep()).meta.id, kept.meta.id)
  const detail = await (await registered.get(routes.knowledge).fetch(request(routes.knowledge, {
    action: 'detail', id: kept.meta.id, version: 1,
  }))).json()
  assert.deepEqual({ id: detail.work.meta.id, version: detail.work.meta.version }, saved.work)
  assert.deepEqual(stages, ['topic', 'outline', 'writing', 'writing', 'visual'])
})

test('work drafts find related knowledge, allow changes, and trace the exact used sources after saving', async t => {
  const path = await fixture(t)
  const store = new Vault(path)
  const morning = await store.create({ type: 'concept', title: '树荫步行早晨观察', body: '一号素材：上午有遮阴。' })
  const evening = await store.create({ type: 'method', title: '树荫步行傍晚观察', body: '二号素材：傍晚现场记录。' })
  const extra = await store.create({ type: 'concept', title: '红灯等待时间', body: '补充素材：比较不同路口。' })
  await store.create({ type: 'concept', title: '果树修剪', body: '示例：园艺剪刀。' })
  await store.create({ type: 'report', title: '树荫步行报告', body: '报告搜索时不进入知识推荐。' })

  const { ctx, registered } = host()
  const prompts = []
  registerRoutes(ctx, {
    current: () => ({ path }), modelConfig: { enabled: true },
    model: () => ({ async compose(input) {
      prompts.push(input)
      if (input.stage === 'topic') return { reply: '讨论树荫步行。', title: '树荫步行', thesis: '对照早晚的记录。' }
      if (input.stage === 'outline') return { reply: '比较两条记录。', sections: [
        { heading: '早晚记录', point: '先比较两个时段', sourceNumbers: [1, 2, 999] },
        { heading: '补充观察', point: '记录其他因素' },
      ] }
      return { reply: '已补充。', body: '这是一段写好的正文。', sourceNumbers: [1, 2, 999] }
    } }),
  })
  const post = (action, extra = {}) => registered.get(routes.works).fetch(request(routes.works, { action, ...extra }))
  let draft = await (await post('draft-start')).json()
  async function change(action, extra = {}) {
    const response = await post('draft-' + action, { id: draft.id, revision: draft.revision, ...extra })
    assert.equal(response.status, 200)
    const result = await response.json()
    if (result.id) draft = result
    return result
  }
  await change('ask', { message: '树荫步行', language: 'zh' })
  assert.deepEqual(new Set(draft.sources.map(ref => ref.id)), new Set([morning.meta.id, evening.meta.id]))
  assert.deepEqual(new Set(prompts[0].sources.map(s => s.body)), new Set([morning.body, evening.body]))
  await change('confirm-topic')
  await change('ask', { message: '拟一个提纲', language: 'zh' })
  assert.equal(draft.outlineCandidate[0].plannedSources.length, 2)
  await change('confirm-outline')
  await change('ask', { message: '写第一节', language: 'zh', section: draft.sections[0].id })
  await change('confirm-section', { section: draft.sections[0].id })
  const written = draft.sections[0].body
  const selectedVersions = draft.sources
  await store.update(morning.meta.id, 1, { body: '更新后的素材，不能替换已引用的版本。' })
  await change('source-remove', { ref: selectedVersions.find(ref => ref.id === morning.meta.id) })
  const found = await (await post('draft-source-search', { query: '红灯等待时间' })).json()
  assert.deepEqual(found.items.map(ref => ref.id), [extra.meta.id])
  const preview = await (await post('draft-source-read', { ref: found.items[0] })).json()
  assert.equal(preview.body, extra.body)
  await change('source-add', { ref: found.items[0] })
  assert.equal(draft.sections[0].body, written)
  assert.ok(!draft.sources.some(ref => ref.id === morning.meta.id))
  await change('ask', { message: '写第二节', language: 'zh', section: draft.sections[1].id })
  assert.ok(!prompts.at(-1).sources.some(note => note.title === morning.meta.title))
  await change('confirm-section', { section: draft.sections[1].id })
  await change('section', { section: draft.sections[1].id, body: '补写后的第二节。' })
  await change('confirm-section', { section: draft.sections[1].id })
  const result = await change('finish')
  const exported = await (await post('read', result.work)).json()
  assert.equal(exported.sources.find(ref => ref.id === morning.meta.id).version, 1)
  assert.deepEqual(new Set(exported.sources.map(ref => ref.id)), new Set([morning.meta.id, evening.meta.id, extra.meta.id]))

  // Simulate a v0.7.3 draft that has body text but no selected-sources field.
  const legacy = await (await post('draft-start', { title: '树荫步行' })).json()
  const directory = join(await store.folder(), '.work-drafts')
  await writeFile(join(directory, legacy.id + '.json'), JSON.stringify({ ...legacy, discussions: undefined, stage: 'writing', sections: [
    { heading: '存量章节', point: '保留手写内容', body: '已写好的小节。' },
  ] }))
  draft = await (await post('draft-read', { id: legacy.id })).json()
  assert.equal(draft.sources, undefined)
  await change('source-suggest')
  assert.equal(draft.sources.length, 2)
  assert.equal(draft.sections[0].body, '已写好的小节。')
})

test('a confirmed report returns to its persisted work section and adds only its exact version', async t => {
  const path = await fixture(t)
  const { workDraftStore } = await import('../src/adapters/storage/obsidian/research-runs.js')
  const { randomUUID } = await import('node:crypto')
  const vault = new Vault(path)
  const records = workDraftStore(vault)
  const id = randomUUID()
  const sectionId = randomUUID()
  const original = { schema: 1, id, revision: 0, stage: 'writing', topic: { title: '街道观察', thesis: '对比早晚' },
    sections: [
      { id: randomUUID(), heading: '第一节', point: '上午', body: '保留我的第一节', confirmed: true, usedSources: [] },
      { id: sectionId, heading: '第二节', point: '傍晚', body: '保留我的第二节', confirmed: true, usedSources: [] },
    ], discussions: {}, modified: new Date().toISOString() }
  await records.write(original)
  function service() {
    const { ctx, registered } = host()
    registerRoutes(ctx, { current: () => ({ path }) })
    return (route, input) => registered.get(route).fetch(request(route, input))
  }
  let call = service()
  const json = async (route, input, status = 200) => {
    const response = await call(route, input)
    assert.equal(response.status, status)
    return response.json()
  }
  const start = await json(routes.works, { action: 'draft-research', id, section: sectionId, revision: 0 })
  assert.deepEqual(await records.read(id), original)
  const study = await vault.get(start.study)
  assert.deepEqual(study.meta.workOrigin, { draftId: id, sectionId })
  const report = await vault.create({ type: 'report', body: '待确认', review: 'draft',
    links: [{ kind: 'related', id: study.meta.id, version: study.meta.version }] })
  await json(routes.reports, { action: 'adopt-work', id: report.meta.id, version: 1 }, 400)
  const second = await json(routes.reports, { action: 'confirm', research: start.study, id: report.meta.id, version: 1, body: '核查材料 B' })
  const third = await json(routes.reports, { action: 'confirm', research: start.study, id: report.meta.id, version: 2, body: '后续修订 C' })
  assert.equal(third.meta.version, 3)
  call = service()
  const detail = await json(routes.reports, { action: 'read', id: report.meta.id, version: 2 })
  assert.deepEqual(detail.workOrigin, { draftId: id, sectionId })
  const adopt = { action: 'adopt-work', id: report.meta.id, version: second.meta.version }
  assert.deepEqual(await json(routes.reports, adopt), { draftId: id, sectionId })
  const adopted = await json(routes.works, { action: 'draft-read', id })
  assert.equal(adopted.sections[1].sources[0].version, 2)
  assert.equal(adopted.sections[1].sources[0].id, report.meta.id)
  assert.deepEqual({ ...adopted, modified: original.modified, revision: 0,
    sections: [adopted.sections[0], { ...adopted.sections[1], sources: undefined }] },
  { ...original, sections: [original.sections[0], { ...original.sections[1], sources: undefined }] })
  await json(routes.reports, adopt)
  assert.deepEqual(await records.read(id), adopted)
})
