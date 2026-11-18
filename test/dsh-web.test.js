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

test('dsh search replaces a forbidden result with a readable result and keeps the failure for disclosure', async () => {
  const queries = []
  const first = 'https://blocked.example.org/report'
  const second = 'https://public.example.org/report'
  const adapter = createDshWeb({ get: () => ({
    async search({ query }) {
      queries.push(query)
      return { sources: [{ url: queries.length === 1 ? first : second, title: 'Official figures', snippet: 'The total was 42.' }] }
    },
  }) }, async url => {
    if (url === first) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    return { url, text: 'The original release confirms the total was 42.' }
  })
  const candidates = await adapter.search('official figures for 2026-11-18')
  assert.deepEqual(candidates.map(({ url, unavailable }) => [url, unavailable]), [[first, 403], [second, undefined]])
  assert.equal(candidates[0].text, undefined)
  assert.match(candidates[1].text, /original release confirms/)
  assert.deepEqual(queries, ['official figures for 2026-11-18', 'official figures for 2026-11-18 -site:blocked.example.org'])
})
