import { exactVersion } from './version-reference.js'

const basisTypes = new Set(['concept', 'theory', 'claim', 'method', 'report'])

export async function saveWork(store, input) {
  if (input.id) {
    const entry = await readWork(store, input.id, input.version)
    return store.update(entry.meta.id, entry.meta.version, { body: input.body })
  }
  const links = []
  if (input.basis) {
    const basis = await store.get(input.basis.id, exactVersion(input.basis.version))
    if (!basisTypes.has(basis.meta.type)) throw new Error('Choose a report or knowledge entry')
    links.push({ kind: 'derived', id: basis.meta.id, version: basis.meta.version })
  }
  return store.create({ type: 'output', title: input.title, body: input.body, links })
}

export async function readWork(store, id, version) {
  const note = await store.get(id, exactVersion(version))
  if (note.meta.type !== 'output') throw new Error('Choose a work')
  return { ...note, versions: await store.versions(id) }
}

export async function listWorks(store, query) {
  return (await store.list(query)).filter(({ meta }) => meta.type === 'output' && meta.status !== 'archived')
}
