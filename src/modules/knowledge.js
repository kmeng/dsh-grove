import { exactVersion } from './version-reference.js'

const knowledgeTypes = new Set(['concept', 'theory', 'claim', 'method'])

export async function saveKnowledge(store, input) {
  if (input.id) {
    const current = await readKnowledge(store, input.id, input.version)
    if (typeof input.reason !== 'string' || !input.reason.trim()) throw new Error('Describe what changed your understanding')
    return store.update(current.meta.id, current.meta.version, { body: input.body, revisionReason: input.reason.trim() })
  }
  if (!knowledgeTypes.has(input.type)) throw new Error('Choose a knowledge type')
  const links = []
  if (input.report) {
    const report = await store.get(input.report.id, exactVersion(input.report.version))
    if (report.meta.type !== 'report') throw new Error('Choose a research report')
    links.push({ kind: 'derived', id: report.meta.id, version: report.meta.version })
  }
  return store.create({ type: input.type, title: input.title, body: input.body, links })
}

export async function readKnowledge(store, id, version) {
  const note = await store.get(id, exactVersion(version))
  if (!knowledgeTypes.has(note.meta.type)) throw new Error('Choose a knowledge entry')
  return { ...note, versions: await store.versions(id) }
}

export async function listKnowledge(store, query) {
  return (await store.list(query)).filter(({ meta }) => knowledgeTypes.has(meta.type) && meta.status !== 'archived')
}
