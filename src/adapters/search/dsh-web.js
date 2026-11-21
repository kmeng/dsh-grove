import { htmlText } from './public-pages.js'

function webUrl(value) {
  const url = typeof value === 'string' && value.length <= 2048 && URL.parse(value)
  if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
  url.hash = ''
  return url
}

export function createDshWeb(ctx, readPublicPage) {
  const runtime = () => ctx.get?.('web')

  async function searchAvailable() {
    const web = runtime()
    if (!web?.search || !web.searchReady) return false
    try {
      // Readiness can return true when provider selection itself fails.
      web.selectSearchProvider?.()
      return await web.searchReady()
    } catch {
      return false
    }
  }

  async function readPage(link) {
    const url = webUrl(link)
    if (!url) return null
    const web = runtime()
    let remoteStatus
    try {
      // The built-in HTTP provider can access the host's intranet. Research
      // URLs derived from search results must use the remote fetcher or the
      // dedicated public-only reader with address pinning.
      if (web?.selectFetchProvider?.().id === 'deepseek-fetch-api' && await web.fetchReady?.()) {
        const result = await web.fetch({ url: url.href }, AbortSignal.timeout(12_000))
        remoteStatus = result?.statusCode
        const finalUrl = webUrl(result?.url)
        if (finalUrl && result.statusCode >= 200 && result.statusCode < 300 && typeof result.body?.content === 'string') {
          const content = result.body.content.slice(0, 60_000)
          const text = result.body.kind === 'html' ? htmlText(content) : content.trim()
          if (text) return { url: finalUrl.href, text }
        }
      }
    } catch { /* Fall back to public-only retrieval. */ }
    try {
      const page = await readPublicPage(url.href)
      if (page) return page
    } catch (error) {
      if ([401, 403, 404, 410].includes(error.statusCode)) throw error
      if (![401, 403, 404, 410].includes(remoteStatus)) throw error
    }
    if ([401, 403, 404, 410].includes(remoteStatus)) {
      throw Object.assign(new Error('The public source could not be opened'), { statusCode: remoteStatus })
    }
    return null
  }

  async function search(query) {
    const limit = 128
    const shorten = (text, length) => Array.from(text).slice(0, length).join('').trim()
    async function readResults(text) {
      const result = await runtime().search({ query: text, maxResults: 6 }, AbortSignal.timeout(25_000))
      return (await Promise.all((result.sources ?? []).slice(0, 6).map(async source => {
        const url = webUrl(source.url)
        if (!url) return null
        const title = source.title || url.hostname
        const snippet = typeof source.snippet === 'string' ? source.snippet.trim().slice(0, 1600) : ''
        let page
        try { page = await readPage(url.href) }
        catch (error) {
          if ([401, 403, 404, 410].includes(error.statusCode)) return { url: url.href, title, unavailable: error.statusCode }
        }
        // A readable page certifies the URL. If a transient error prevents
        // opening it, a search excerpt can still guide discovery, not citation.
        if (!page?.text) return { url: url.href, title, unavailable: true }
        return { url: page.url ?? url.href, title, text: [snippet, page.text].filter(Boolean).join('\n\n'),
          publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt.slice(0, 80) : undefined }
      }))).filter(Boolean)
    }
    const first = await readResults(shorten(query, limit))
    const blocked = first.filter(source => source.unavailable === 403)
    if (!blocked.length || first.filter(source => !source.unavailable).length >= 2) return first
    const domains = [...new Set(blocked.map(source => new URL(source.url).hostname))]
    const exclusions = domains.map(domain => ' -site:' + domain).join('')
    if (exclusions.length >= limit - 16) return first
    const alternatives = await readResults(shorten(query, limit - exclusions.length) + exclusions).catch(() => [])
    return first.concat(alternatives)
  }

  return { searchAvailable, search, readPage }
}
