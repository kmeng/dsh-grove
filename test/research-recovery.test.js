import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stagedResearch, renderResearchReport } from '../src/modules/deep-research.js'

const valid = { id: 'open', url: 'https://example.org/open', origin: 'example.org', title: 'Official data', text: 'A'.repeat(4800) }
const blocked = { id: 'blocked', url: 'https://example.net/blocked', origin: 'example.net', title: 'Blocked report', unavailable: 403 }

test('a timeout retries the same research review once with less input and lower effort', async () => {
  const calls = []
  const state = await stagedResearch.run({
    initial: { input: { language: 'en' }, plan: { topic: 'Data', questions: ['What changed?'] } },
    retrieve: async () => [valid],
    checkpoint: async () => {},
    model: {
      async review(input, options) {
        calls.push({ input, options })
        if (calls.length === 1) throw Object.assign(new Error('timed out'), { code: 'model-timeout' })
        return { claims: [{ text: 'A change', explanation: 'Official data', status: 'insufficient', sources: ['open'] }], followups: [] }
      },
      async write() { return { summary: 'A change', sections: [{ heading: 'Analysis', paragraphs: [{ text: 'A change', claims: [1] }] }], limitations: 'Limited evidence', conclusion: 'A change', nextSteps: [] } },
    },
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.lowerEffort, true)
  assert.ok(calls[1].input.sources[0].text.length < calls[0].input.sources[0].text.length)
  assert.deepEqual(state.verified.claims[0].sources, ['open'])
})

test('blocked sources stay out of references and evidence ratings stay out of the report', async () => {
  const state = await stagedResearch.run({
    initial: { input: { language: 'en' }, plan: { topic: 'Data', questions: ['What changed?'] } },
    retrieve: async () => [blocked, valid],
    checkpoint: async () => {},
    model: {
      async review({ sources }) {
        assert.deepEqual(sources.map(s => s.id), ['open'])
        return { claims: [
          { text: 'A change', explanation: 'Available data', status: 'insufficient', sources: ['open'] },
          { text: 'Another change', explanation: 'Missing evidence', status: 'insufficient', sources: [] },
        ], followups: [] }
      },
      async write({ claims }) {
        assert.deepEqual(claims, [{ id: 1, text: 'A change', sources: [1] }])
        return { summary: 'One change recorded by an available source', sections: [
          { heading: 'Analysis', paragraphs: [{ text: 'A change was recorded. (claim 1)', claims: [1] }] },
        ], conclusion: 'The official data records a change.' }
      },
    },
  })
  const report = renderResearchReport(state)
  assert.match(report, /<https:\/\/example\.org\/open>/)
  assert.doesNotMatch(report, /https:\/\/example\.net\/blocked/)
  assert.match(report, /A change was recorded\. \[1\]/)
  assert.doesNotMatch(report, /claim 1/)
  assert.match(report, /## References/)
  assert.doesNotMatch(report, /could not be independently verified|insufficient evidence|next steps/i)
})

test('dsh research retry lowers only the outgoing route for that call', async () => {
  const { createDshModels } = await import('../src/adapters/models/dsh.js')
  const selection = { provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'high' }
  const routes = []
  const llm = {
    listProviders: () => [{ id: selection.provider }],
    async prepareCall(route) {
      routes.push(route)
      return { config: route, async *stream() {
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '{"claims":[],"followups":[]}' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      } }
    },
  }
  const adapter = createDshModels({ get: name => name === 'llm' ? llm : undefined })
  const model = adapter.model(selection)
  await model.review({}, { lowerEffort: true })
  await model.review({})
  await model.write({})
  const defaultModel = adapter.model({ provider: selection.provider, model: selection.model })
  await defaultModel.review({})
  await defaultModel.write({})
  assert.deepEqual(routes.map(route => route.reasoningEffort), ['low', 'high', 'high', undefined, 'low'])
  assert.equal(selection.reasoningEffort, 'high')
})

test('successive retrieval rounds add distinct material and resume without re-searching', async () => {
  const initial = { input: { language: 'en' }, plan: { topic: 'Planning', questions: ['initial search'] } }
  const searches = []
  const retrieve = async ([query]) => {
    searches.push(query)
    return [{ ...valid, id: query, title: query, url: 'https://example.org/' + query.replaceAll(' ', '-') }]
  }
  const model = {
    async review({ sources }) {
      const followups = [['second search'], ['third search'], ['future question']][sources.length - 1]
      return { followups, claims: sources.map(source => ({
        text: source.title, explanation: source.title, status: 'insufficient', sources: [source.id],
      })) }
    },
    async write() {
      return { summary: 'Three sources', sections: [{ heading: 'Results',
        paragraphs: [{ text: 'New material', claims: [3] }] }], conclusion: 'Use all three rounds' }
    },
  }
  await assert.rejects(stagedResearch.run({
    initial, retrieve, model, checkpoint: async (key, value) => {
      initial[key] = value
      if (key === 'rounds' && value.length === 2 && !value[1].review) throw Error('interrupted')
    },
  }), /interrupted/)
  const state = await stagedResearch.run({ initial, model, retrieve, checkpoint: async () => {} })
  assert.deepEqual(searches, ['initial search', 'second search', 'third search'])
  assert.equal(state.verified.sources.length, 3)
  assert.match(renderResearchReport(state), /https:\/\/example\.org\/third-search/)
})

test('repairs a local report in place and exposes the writing diagnosis', async () => {
  const initial = {
    input: { language: 'zh' }, plan: { topic: '研究报告', questions: ['问题'] },
    collected: [valid], review: { followups: [] },
    verified: { sources: [valid], claims: [{ text: '事实', explanation: '原文', sources: ['open'] }] },
  }
  const diagnostic = []
  let writes = 0
  const state = await stagedResearch.run({
    initial, model: {}, writerName: 'qwen3.8-27b-mlx-32k:latest',
    write: async () => {
      writes++
      return { rawReport: `{
        "summary": "研究摘要",
        "sections": [{
          "heading": "分析",
          "paragraphs": [{
            "text": "已经写好的正文引用了 "seed draft" 和 "design justice"。",
            "claims": ["1"],
          }],
        }],
        "conclusion": "结论"
      }` }
    },
    retrieve: () => assert.fail('verified material must be reused'),
    checkpoint: async (key, value) => { if (key === 'writing') diagnostic.push(value) },
  })
  assert.equal(writes, 1)
  assert.match(renderResearchReport(state), /已经写好的正文引用了 "seed draft" 和 "design justice"。 \[1\]/)
  assert.equal(diagnostic[0].model, 'qwen3.8-27b-mlx-32k:latest')
  assert.equal(diagnostic.at(-1).phase, 'complete')
  assert.equal(diagnostic.at(-1).reason, 'json')
  assert.ok(diagnostic.at(-1).endedAt >= diagnostic[0].startedAt)
})

test('an empty local report stops at writing and keeps the specific failure', async () => {
  const initial = {
    input: { language: 'zh' }, plan: { topic: '报告', questions: ['问题'] },
    collected: [valid], review: { followups: [] },
    verified: { sources: [valid], claims: [{ text: '事实', explanation: '原文', sources: ['open'] }] },
  }
  let writes = 0
  const saved = []
  await assert.rejects(stagedResearch.run({
    initial, model: {}, writerName: 'qwen', write: async () => {
      writes++
      return { rawReport: '', finish: 'stop' }
    },
    retrieve: () => assert.fail('already verified'),
    checkpoint: async (key, value) => { if (key === 'writing') saved.push(value) },
  }), { code: 'model-response', detail: 'empty' })
  assert.equal(writes, 1)
  assert.equal(saved.at(-1).phase, 'failed')
  assert.equal(saved.at(-1).reason, 'empty')
})

test('persists structural JSON diagnostics without persisting report text', async () => {
  const rawReport = '{"summary":"PRIVATE_WORD", : "value"}'
  let writing
  await assert.rejects(stagedResearch.run({
    initial: {
      input: { language: 'zh' }, plan: { topic: '报告', questions: ['问题'] },
      collected: [valid], review: { followups: [] },
      verified: { sources: [valid], claims: [{ text: '事实', explanation: '原文', sources: ['open'] }] },
    },
    model: {}, write: async () => ({ rawReport, finish: 'stop' }),
    retrieve: () => assert.fail('already verified'),
    checkpoint: async (key, value) => { if (key === 'writing') writing = value },
  }), { code: 'model-response', detail: 'json' })
  assert.equal(writing.diagnostic.characters, rawReport.length)
  assert.equal(writing.diagnostic.finish, 'stop')
  assert.equal(writing.diagnostic.parse.offset, 27)
  assert.equal(writing.diagnostic.repair.offset, 27)
  assert.match(writing.diagnostic.parse.shape, /│:/)
  assert.doesNotMatch(JSON.stringify(writing), /PRIVATE_WORD|summary|value/)
})
