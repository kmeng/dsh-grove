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
