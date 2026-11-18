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
    try {
      // The built-in HTTP provider can access the host's intranet. Research
      // URLs derived from search results must use the remote fetcher or the
      // dedicated public-only reader with address pinning.
      if (web?.selectFetchProvider?.().id === 'deepseek-fetch-api' && await web.fetchReady?.()) {
        const result = await web.fetch({ url: url.href }, AbortSignal.timeout(12_000))
        const finalUrl = webUrl(result?.url)
        if (finalUrl && result.statusCode >= 200 && result.statusCode < 300 && typeof result.body?.content === 'string') {
          const content = result.body.content.slice(0, 60_000)
          const text = result.body.kind === 'html' ? htmlText(content) : content.trim()
          if (text) return { url: finalUrl.href, text }
        }
      }
    } catch { /* Fall back to public-only retrieval. */ }
    return readPublicPage(url.href)
  }

  async function search(query) {
    const result = await runtime().search({ query, maxResults: 4 }, AbortSignal.timeout(25_000))
    return (await Promise.all((result.sources ?? []).slice(0, 4).map(async (source, index) => {
      const url = webUrl(source.url)
      if (!url) return null
      const snippet = typeof source.snippet === 'string' ? source.snippet.trim().slice(0, 1600) : ''
      const page = index < 2 ? await readPage(url.href).catch(() => null) : null
      const text = [snippet, page?.text].filter(Boolean).join('\n\n')
      if (!text) return null
      return { url: page?.url ?? url.href, title: source.title || page?.title || url.hostname, text,
        publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt.slice(0, 80) : undefined }
    }))).filter(Boolean)
  }

  return { searchAvailable, search, readPage }
}
