import assert from 'node:assert/strict'
import { test } from 'node:test'
import { httpModel } from '../src/adapters/models/http.js'
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
