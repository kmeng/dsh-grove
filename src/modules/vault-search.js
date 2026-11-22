import { isKnowledge } from './knowledge.js'

const searchable = new Set(['inspiration', 'report', 'concept', 'theory', 'claim', 'method'])
const stopWords = new Set(['帮我', '搜索', '查找', '找一下', '关于', '相关', '哪些', '什么', '一下', '我的', '记录', '笔记', '灵感', '知识', '报告',
  'find', 'show', 'search', 'about', 'please', 'what', 'which', 'the', 'for', 'with', 'from', 'ideas', 'notes', 'reports'])

function keywords(text) {
  return (text.normalize('NFKC').toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9][a-z0-9_-]*/gu) ?? [])
    .flatMap(word => {
      const chars = Array.from(word)
      if (!/\p{Script=Han}/u.test(word) || chars.length < 3) return [word]
      return chars.slice(0, -1).map((char, i) => char + chars[i + 1])
    })
    .filter(word => word.length >= 2 && !stopWords.has(word))
}

export async function searchVault(store, query, { knowledgeOnly = false, relatedOnly = false, includeReports = false } = {}) {
  const terms = [...new Set(keywords(query.slice(0, 300)))].slice(0, 48)
  if (!terms.length) return []
  return (await store.list())
    .filter(note => knowledgeOnly ? isKnowledge(note) || (includeReports && note.meta.type === 'report' && note.meta.review !== 'draft') :
      searchable.has(note.meta.type) && note.meta.status !== 'archived' && note.meta.review !== 'draft')
    .map(({ meta, body }) => {
      const title = meta.title.normalize('NFKC').toLowerCase()
      const text = body.normalize('NFKC').toLowerCase()
      const weights = terms.map(term => title.includes(term) ? 3 : text.includes(term) ? 1 : 0)
      const score = weights.reduce((sum, weight) => sum + weight, 0)
      const hits = weights.filter(Boolean).length
      return { meta, score, hits }
    })
    .filter(({ score, hits }) => relatedOnly ? score >= 3 && hits >= Math.min(2, terms.length) : score > 0)
    .sort((a, b) => b.score - a.score || String(b.meta.modified ?? b.meta.created).localeCompare(String(a.meta.modified ?? a.meta.created)))
    .slice(0, 12)
    .map(({ meta }) => ({ id: meta.id, version: meta.version, title: meta.title, type: meta.type,
      studyId: meta.type === 'report' ? meta.links?.find(link => link.kind === 'related')?.id : undefined }))
}
