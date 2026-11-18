import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDshWeb } from '../src/adapters/search/dsh-web.js'

test('dsh search uses the selected remote reader, and falls back to public-only retrieval for local HTTP', async () => {
  let provider = 'deepseek-fetch-api'
  const calls = []
  const web = {
    selectSearchProvider: () => ({ id: 'deepseek-search-api' }),
    searchReady: async () => true,
    selectFetchProvider: () => ({ id: provider }),
    fetchReady: async () => true,
    async search(input) {
      calls.push(input.query)
      return { sources: [{ url: 'https://example.org/update', title: 'Release', snippet: 'Dated result', publishedAt: '2026-11-18' }] }
    },
    async fetch({ url }) {
      calls.push('host-fetch')
      return { url, statusCode: 200, body: { kind: 'html', content: '<p>Original release</p>' } }
    },
  }
  const adapter = createDshWeb({ get: name => name === 'web' ? web : undefined }, async url => {
    calls.push('public-fetch')
    return { url, text: 'Pinned public page' }
  })
  assert.equal(await adapter.searchAvailable(), true)
  assert.equal((await adapter.search('recent release'))[0].text, 'Dated result\n\nOriginal release')
  provider = 'http'
  assert.equal((await adapter.search('recent release'))[0].text, 'Dated result\n\nPinned public page')
  assert.deepEqual(calls, ['recent release', 'host-fetch', 'recent release', 'public-fetch'])
})

test('missing host search provider does not advertise search availability', async () => {
  const adapter = createDshWeb({ get: () => ({
    selectSearchProvider() { throw Error('not configured') },
    search() {},
    async searchReady() { return true },
  }) }, async () => null)
  assert.equal(await adapter.searchAvailable(), false)
})
