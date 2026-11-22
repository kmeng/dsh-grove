import { readKnowledgeIndex, writeKnowledgeIndex } from '../adapters/storage/obsidian/knowledge-index.js'
import { isKnowledge } from './knowledge.js'
import { Vault } from '../vault.js'

const segmenter = new Intl.Segmenter('zh', { granularity: 'word' })
const dayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
const stopWords = new Set(`about after also among analysis and are based been before being between could data does each evidence findings first from have here into its may more most other over report research results section should some than that their them then there these they this through under use used using very was were what when where which while will with would you your http https
分析 报告 研究 证据 结论 局限 发现 结果 以及 可以 进行 通过 这些 这个 已经 需要 一个 认为 摘要 主要 相关 资料 内容 参考 参考资料`.split(/\s+/))
const running = new Map()

function terms(text) {
  const clean = text.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+/g, '')
  return Array.from(segmenter.segment(clean), ({ segment, isWordLike }) =>
    isWordLike && /\p{L}/u.test(segment) && segment.length >= (/\p{Script=Han}/u.test(segment) ? 2 : 3)
      && segment.length <= 32 && !stopWords.has(segment) ? segment : null).filter(Boolean)
}

function rank(note) {
  const counts = new Map()
  for (const term of terms(note.body.slice(0, 24000))) counts.set(term, (counts.get(term) ?? 0) + 1)
  const title = new Set(terms(note.meta.title))
  for (const term of title) counts.set(term, Math.min(counts.get(term) ?? 0, 6) + 10)
  return [...counts].filter(([, count]) => count > 1)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'zh')).map(([term]) => term)
}

function buildIndex(notes, day) {
  const reports = new Map(notes.filter(note => note.meta.type === 'report').map(({ meta }) =>
    [meta.id, meta.links?.find(link => link.kind === 'related')?.id ?? meta.id]))
  const entries = {}
  const groups = new Map()
  const keysById = new Map()
  for (const note of notes.filter(isKnowledge)) {
    const { id, version, links } = note.meta
    const tags = rank(note).slice(0, 5)
    const report = links?.find(link => link.kind === 'derived')?.id
    const keys = tags.map(tag => 'tag:' + tag)
    if (report) keys.push('source:' + (reports.get(report) ?? report))
    entries[id] = { version, tags, related: [] }
    keysById.set(id, keys)
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(id)
    }
  }
  for (const [id, entry] of Object.entries(entries)) {
    const matches = new Map()
    for (const key of keysById.get(id)) {
      const weight = key.startsWith('source:') ? 3 : 1
      for (const other of groups.get(key)) {
        if (other !== id) matches.set(other, (matches.get(other) ?? 0) + weight)
      }
    }
    entry.related = [...matches].filter(([, score]) => score >= 2)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, 5).map(([other]) => other)
  }
  return { schema: 1, day, entries }
}

export function organizeKnowledge(vault, date = new Date()) {
  const existing = running.get(vault.path)
  if (existing) return existing
  const day = dayFormat.format(date)
  const task = (async () => {
    if ((await readKnowledgeIndex(vault))?.day === day) return false
    const notes = await vault.list()
    if (!notes.some(isKnowledge)) return false
    await writeKnowledgeIndex(vault, buildIndex(notes, day))
    return true
  })().finally(() => running.delete(vault.path))
  running.set(vault.path, task)
  return task
}

export function scheduleKnowledge(current) {
  function tick() {
    const { path } = current()
    if (!path) return
    Promise.resolve().then(() => organizeKnowledge(new Vault(path))).catch(error => {
      console.warn('[grove] Knowledge organization failed:', error.code ?? error.name)
    })
  }

  tick()
  const interval = setInterval(tick, 60_000)
  interval.unref()
  return () => clearInterval(interval)
}

export async function browseKnowledge(vault, notes) {
  const index = await readKnowledgeIndex(vault).catch(() => null)
  const byId = new Map(notes.map(note => [note.meta.id, note.meta]))
  return notes.map(({ meta, body }) => {
    const indexed = index?.entries[meta.id]
    const current = indexed?.version === meta.version
    const paragraph = body.split('\n').map(line => line.trim())
      .find(line => line && !line.startsWith('#') && !line.startsWith('<!--'))
    return { meta, summary: paragraph?.slice(0, 200) ?? '',
      tags: current && Array.isArray(indexed.tags) ? indexed.tags : [],
      related: current && Array.isArray(indexed.related) ? indexed.related.map(id => byId.get(id)).filter(Boolean) : [],
    }
  }).sort((a, b) => b.meta.created.localeCompare(a.meta.created) || a.meta.id.localeCompare(b.meta.id))
}
