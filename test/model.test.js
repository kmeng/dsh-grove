import assert from 'node:assert/strict'
import { test } from 'node:test'
import { httpModel } from '../src/adapters/models/http.js'

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
