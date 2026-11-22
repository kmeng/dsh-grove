import { readKnowledgeIndex, writeKnowledgeIndex } from '../adapters/storage/obsidian/knowledge-index.js'
import { isKnowledge } from './knowledge.js'
import { Vault } from '../vault.js'

const segmenter = new Intl.Segmenter('zh', { granularity: 'word' })
const dayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
const stopWords = new Set(`about after also among analysis and are based been before being between could data does each evidence findings first from have here into its may more most other over report research results section should some than that their them then there these they this through under use used using very was were what when where which while will with would you your http https
分析 报告 研究 证据 结论 局限 发现 结果 以及 可以 进行 通过 这些 这个 已经 需要 一个 认为 摘要 主要 相关 资料 内容 参考 参考资料 问题 发展 方法 模拟 合成 原则 维度 可验证 时代 评估`.split(/\s+/))
const running = new Map()
const indexSchema = 2
const concepts = [
  { labels: ['以用户为中心的设计', 'UCD'], pattern: /以用户为中心的设计|\b(?:user[- ]cent(?:ered|red) design|ucd)\b/iu },
  { labels: ['生成式 AI'], pattern: /生成式(?:\s*AI\b|人工智能)|\bgenerative AI\b/iu },
  { labels: ['UX 研究'], pattern: /\bUX\s*研究|\bUX research\b/iu },
  { labels: ['产品设计方法论'], pattern: /产品设计方法论/u },
  { labels: ['产品设计'], pattern: /产品设计/u },
]
const chinesePhrase = /以[\p{Script=Han}]{2,10}?为[\p{Script=Han}]{1,8}?的(?:设计|方法论|方法|分析|评估|开发|实践|治理|策略|模型|框架|体系)/gu
const explicitAcronym = /^\s*\(([A-Z][A-Z0-9]{1,9})\)/u

function terms(text) {
  return Array.from(segmenter.segment(text), ({ segment, isWordLike }) => {
    const word = segment.toLowerCase()
    const acronym = /^[A-Z][A-Z0-9]{1,9}$/u.test(segment)
    if (!isWordLike || !/\p{L}/u.test(segment) || segment.length > 32 || stopWords.has(word)) return null
    if (acronym) return segment
    return segment.length >= (/\p{Script=Han}/u.test(segment) ? 2 : 3) ? word : null
  }).filter(Boolean)
}

function normalize(text) {
  return text.normalize('NFKC').replace(/https?:\/\/\S+/g, '')
}

function rank(note) {
  const title = normalize(note.meta.title)
  const body = normalize(note.body.slice(0, 24000))
  const text = title + '\n' + body
  const candidates = new Map()
  const components = new Set()
  function addConcept(labels, inTitle) {
    const key = labels[0].toLowerCase()
    const previous = candidates.get(key)
    const score = Math.max(previous?.score ?? 0, inTitle ? 40 : 28)
    const merged = [...new Set([...(previous?.labels ?? []), ...labels])]
    candidates.set(key, { key, labels: merged, score })
    for (const label of merged) for (const word of terms(label)) components.add(word.toLowerCase())
  }

  for (const { labels, pattern } of concepts) {
    if (pattern.test(text)) addConcept(labels, pattern.test(title))
  }
  for (const match of text.matchAll(chinesePhrase)) {
    const phrase = match[0]
    const acronym = explicitAcronym.exec(text.slice(match.index + phrase.length))?.[1]
    addConcept(acronym ? [phrase, acronym] : [phrase], match.index < title.length)
  }

  const counts = new Map()
  for (const term of terms(body)) counts.set(term, (counts.get(term) ?? 0) + 1)
  for (const term of new Set(terms(title))) counts.set(term, Math.min(counts.get(term) ?? 0, 6) + 10)
  for (const [term, count] of counts) {
    const key = term.toLowerCase()
    if (count < 2 || components.has(key)) continue
    const previous = candidates.get(key)
    if (!previous || count > previous.score || (count === previous.score && term !== key)) {
      candidates.set(key, { key, labels: [term], score: Math.min(count, 20) })
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key, 'zh'))
}

function selectTags(note) {
  const tags = []
  const keys = []
  for (const { key, labels } of rank(note)) {
    const fresh = labels.filter(label => !tags.includes(label))
    if (!fresh.length || tags.length + fresh.length > 5) continue
    tags.push(...fresh)
    keys.push('tag:' + key)
  }
  return { tags, keys }
}

function buildIndex(notes, day) {
  const reports = new Map(notes.filter(note => note.meta.type === 'report').map(({ meta }) =>
    [meta.id, meta.links?.find(link => link.kind === 'related')?.id ?? meta.id]))
  const entries = {}
  const groups = new Map()
  const keysById = new Map()
  for (const note of notes.filter(isKnowledge)) {
    const { id, version, links } = note.meta
    const { tags, keys } = selectTags(note)
    const report = links?.find(link => link.kind === 'derived')?.id
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
  return { schema: indexSchema, day, entries }
}

export function organizeKnowledge(vault, date = new Date()) {
  const existing = running.get(vault.path)
  if (existing) return existing
  const day = dayFormat.format(date)
  const task = (async () => {
    const index = await readKnowledgeIndex(vault)
    if (index?.schema === indexSchema && index.day === day) return false
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
