import { readKnowledgeIndex } from '../adapters/storage/obsidian/knowledge-index.js'
import { isKnowledge, isKnowledgeType, listKnowledge } from './knowledge.js'
import { searchVault } from './vault-search.js'
import { exactVersion } from './version-reference.js'

export const workSourceLimit = 5

export function sourceRef({ meta }) {
  return { id: meta.id, version: meta.version, title: meta.title, type: meta.type }
}

export function sameSource(a, b) {
  return a.id === b.id && a.version === b.version
}

export function workSources(draft) {
  return draft.sources ?? (draft.basis ? [draft.basis] : [])
}

export async function readWorkSource(vault, ref) {
  const note = await vault.get(ref?.id, exactVersion(ref?.version))
  if (!(isKnowledgeType(note.meta.type) || (note.meta.type === 'report' && note.meta.review !== 'draft'))) {
    throw Object.assign(new Error('Choose a confirmed report or knowledge entry'), { code: 'invalid-body' })
  }
  return note
}

export async function findWorkKnowledge(vault, query) {
  if (query) return searchVault(vault, query, { knowledgeOnly: true })
  return (await listKnowledge(vault)).sort((a, b) =>
    (b.meta.modified ?? b.meta.created).localeCompare(a.meta.modified ?? a.meta.created))
    .slice(0, 12).map(sourceRef)
}

export async function suggestWorkSources(vault, draft, direction = '') {
  const selected = workSources(draft)
  const query = [draft.topic.title, draft.topic.thesis, direction].filter(Boolean).join(' ')
  if (selected.length >= workSourceLimit) return selected
  const pinned = selected[0]
  const index = pinned && await readKnowledgeIndex(vault).catch(() => null)
  const relatedIds = index?.entries[pinned?.id]?.version === pinned?.version
    ? index?.entries[pinned?.id]?.related ?? [] : []
  const related = await Promise.all(relatedIds.map(async id => {
    const note = await vault.get(id).catch(() => null)
    return note && isKnowledge(note) ? sourceRef(note) : null
  }))
  const matches = await searchVault(vault, query, { knowledgeOnly: true, relatedOnly: true })
  const result = [...selected]
  for (const ref of [...related, ...matches]) {
    if (result.length === workSourceLimit) break
    if (ref && !result.some(existing => existing.id === ref.id)) result.push(ref)
  }
  return result
}
