import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDshModels } from '../src/adapters/models/dsh.js'
import { parseModelSettings, readModelSettings, selectModel, verifyModelSettings } from '../src/modules/model-settings.js'
import { httpModel } from '../src/adapters/models/http.js'
import { readPublicPage } from '../src/adapters/search/public-pages.js'
import { tavilySearch } from '../src/adapters/search/tavily.js'

const settings = { endpoint: 'https://example.invalid/v1/chat/completions', name: 'fixture', credential: 'fixture' }
const input = { question: 'What happened?', materials: [], history: [] }

test('the model adapter reports HTTP status without exposing provider data', async () => {
  const model = httpModel(settings, async () => new Response('upstream private response', { status: 503 }))
  await assert.rejects(model.investigate(input), { code: 'model-unavailable', message: 'HTTP 503' })
})

test('the model adapter distinguishes timeouts, network failures, and malformed replies', async () => {
  const slow = httpModel(settings, async () => { throw new DOMException('timed out', 'TimeoutError') })
  const offline = httpModel(settings, async () => { throw new TypeError('request failed') })
  const malformed = httpModel(settings, async () => Response.json({ choices: [] }))
  await assert.rejects(slow.investigate(input), { code: 'model-timeout' })
  await assert.rejects(offline.investigate(input), { code: 'model-network' })
  await assert.rejects(malformed.investigate(input), { code: 'model-response' })
})

test('the web search adapter returns fetched page text and drops snippets-only results', async () => {
  const search = tavilySearch('fixture', async (_url, options) => {
    const input = JSON.parse(options.body)
    assert.equal(input.include_raw_content, 'markdown')
    assert.equal(input.query, 'shaded walking routes')
    return Response.json({ results: [
      { title: 'Walking study', url: 'https://example.org/study#one', raw_content: 'Source passage' },
      { title: 'Search preview', url: 'https://example.org/preview', content: 'Only a search snippet' },
      { title: 'Rejected URL', url: 'file:///tmp/file', raw_content: 'local file' },
    ] })
  })
  assert.deepEqual(await search('shaded walking routes'), [
    { title: 'Walking study', url: 'https://example.org/study', text: 'Source passage' },
  ])
})

test('dsh model sources follow the profile, record host outcomes and preserve custom settings', async () => {
  let current = { provider: 'host-provider', model: 'main-a' }
  const calls = []
  const llm = {
    listProviders: () => [{ id: 'host-provider', name: 'Host' }],
    listModels: async () => [{ id: 'main-a', name: 'First model' }, { id: 'main-b', name: 'Second model' }],
    async *stream(options) {
      calls.push([options.provider, options.model])
      if (options.model === 'broken-model') {
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH' } } }
      } else {
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '{"text":"OK","citations":[]}' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    },
  }
  const services = { llm, agentDefaultModel: { currentSelection: () => current } }
  const dsh = createDshModels({ get: name => services[name] })
  const modelFor = model => dsh.model(model)
  const model = () => selectModel(undefined, 'default', dsh)
  const config = () => readModelSettings(undefined, modelFor, dsh)
  assert.equal(config().source, 'dsh')
  const initial = parseModelSettings({ source: 'dsh', enabled: true }, undefined, dsh)
  assert.deepEqual(JSON.parse(JSON.stringify(initial)), initial)
  assert.equal(config().connection.status, 'unverified')
  assert.deepEqual(await dsh.catalog(), [
    { provider: 'host-provider', providerName: 'Host', model: 'main-a', label: 'First model' },
    { provider: 'host-provider', providerName: 'Host', model: 'main-b', label: 'Second model' },
  ])
  await modelFor(model()).investigate(input)
  assert.equal(config().connection.status, 'connected')
  current = { ...current, model: 'broken-model' }
  assert.equal(config().connection.status, 'unverified')
  await assert.rejects(modelFor(model()).investigate(input), { code: 'model-dsh-auth' })
  assert.equal(config().connection.status, 'failed')
  assert.deepEqual(calls, [['host-provider', 'main-a'], ['host-provider', 'broken-model']])

  const previous = { enabled: true, name: 'old default', endpoint: 'https://old.example/v1',
    deepResearch: { name: 'old research', endpoint: 'https://research.example/v1' } }
  const next = parseModelSettings({ enabled: true, source: 'dsh',
    deepResearch: { source: 'dsh', provider: 'host-provider', model: 'main-b' } }, previous, dsh)
  assert.equal(next.name, previous.name)
  assert.equal(next.endpoint, previous.endpoint)
  assert.deepEqual(next.customResearch, previous.deepResearch)
  assert.equal(selectModel(next, 'research', dsh).model, 'main-b')
  const checked = await verifyModelSettings(next, previous, true, modelFor, dsh)
  const state = readModelSettings(checked, modelFor, dsh)
  assert.equal(state.connection.status, 'failed')
  assert.equal(state.researchConnection.status, 'connected')
})

test('the anonymous page reader rejects local IP variants, credentials, and nonstandard ports', async () => {
  for (const link of ['http://127.1/', 'http://169.254.169.254/', 'http://168.63.129.16/', 'http://[::ffff:127.0.0.1]/', 'http://10.0.0.3/']) {
    await assert.rejects(readPublicPage(link), /public IPv4 address/)
  }
  await assert.rejects(readPublicPage('https://user:pass@example.com/'), /public HTTP or HTTPS/)
  await assert.rejects(readPublicPage('https://example.com:8443/'), /public HTTP or HTTPS/)
})

test('report writing adapts depth in the requested language', async () => {
  const { modelTasks } = await import('../src/adapters/models/tasks.js')
  const prompts = []
  const model = modelTasks('writer', async system => { prompts.push(system) })
  await model.write({ language: 'zh' })
  await model.write({ language: 'en' })
  assert.match(prompts[0], /^撰写/)
  assert.match(prompts[0], /约五千字/)
  assert.doesNotMatch(prompts[0], /650–1000/)
  assert.match(prompts[1], /^Write/)
  assert.doesNotMatch(prompts[1], /400–550/)
})

test('Ollama research calls get a longer deadline than hosted calls', async t => {
  const { createDshModels } = await import('../src/adapters/models/dsh.js')
  const timeout = t.mock.method(AbortSignal, 'timeout', () => new AbortController().signal)
  const runtime = {
    listProviders: () => [{ id: 'ollama' }, { id: 'hosted' }],
    async *stream() {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: '{}' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  const models = createDshModels({ get: key => key === 'llm' ? runtime : undefined })
  await models.model({ provider: 'ollama', model: 'qwen3.8-27b-mlx-32k:latest' }).plan({})
  await models.model({ provider: 'hosted', model: 'cloud' }).plan({})
  assert.deepEqual(timeout.mock.calls.map(call => call.arguments[0]), [600_000, 60_000])
})

test('the image adapter accepts base64 from a configured HTTPS provider', async () => {
  const { generateWorkImage } = await import('../src/adapters/models/work-image-model.js')
  const result = await generateWorkImage({ endpoint: 'https://images.example.test/generations', name: 'illustrator' }, 'fixture', 'A shaded street',
    async (endpoint, options) => {
      assert.equal(endpoint.hostname, 'images.example.test')
      assert.equal(options.redirect, 'error')
      assert.equal(JSON.parse(options.body).prompt, 'A shaded street')
      return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }))
    })
  assert.equal(result, 'aW1hZ2U=')
  assert.equal(await generateWorkImage(null, undefined, 'A shaded street'), null)
})

test('article writing can choose a local DSH model without changing the research model', async () => {
  const { parseModelSettings, selectModel } = await import('../src/modules/model-settings.js')
  const dsh = { defaultSelection: () => ({ provider: 'host', model: 'default' }) }
  const config = parseModelSettings({
    source: 'dsh', workWriting: { source: 'dsh', provider: 'ollama', model: 'qwen3.8-27b-mlx-32k:latest' },
    imageWriting: { endpoint: 'https://images.example.test/generations', name: 'illustrator' },
  }, undefined, dsh)
  assert.equal(selectModel(config, 'work', dsh).model, 'qwen3.8-27b-mlx-32k:latest')
  assert.equal(selectModel(config, 'research', dsh).model, 'default')
  assert.equal(config.imageWriting.name, 'illustrator')
})
