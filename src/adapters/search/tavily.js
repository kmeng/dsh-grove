export function tavilySearch(credential, request = fetch) {
  if (!credential) return null
  return async function search(query) {
    try {
      const response = await request('https://api.tavily.com/search', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential },
        body: JSON.stringify({ query, max_results: 4, search_depth: 'advanced', include_raw_content: 'markdown' }),
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const { results } = await response.json()
      return results.slice(0, 4).flatMap(item => {
        const url = typeof item.url === 'string' && URL.parse(item.url)
        if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          typeof item.raw_content !== 'string' || !item.raw_content.trim()) return []
        url.hash = ''
        return [{ url: url.href, text: item.raw_content, title: typeof item.title === 'string' ? item.title : url.hostname }]
      })
    } catch (cause) {
      throw Object.assign(new Error('Web search could not read source pages', { cause }), { code: 'research-search' })
    }
  }
}
