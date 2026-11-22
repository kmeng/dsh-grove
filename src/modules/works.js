import { exactVersion } from './version-reference.js'
import { readWorkSource, sameSource, sourceRef } from './work-sources.js'

export async function saveWork(store, input, newId) {
  if (input.id) {
    const entry = await readWork(store, input.id, input.version)
    return store.update(entry.meta.id, entry.meta.version, { body: input.body })
  }
  const references = input.sources ?? (input.basis ? [input.basis] : [])
  if (!Array.isArray(references) || references.length > 41) throw new Error('Choose valid work sources')
  const links = []
  for (const ref of references) {
    const basis = sourceRef(await readWorkSource(store, ref))
    if (!links.some(link => sameSource(link, basis))) links.push({ kind: 'derived', id: basis.id, version: basis.version })
  }
  return store.create({ type: 'output', title: input.title, body: input.body, links }, newId)
}

export async function readWork(store, id, version) {
  const note = await store.get(id, exactVersion(version))
  if (note.meta.type !== 'output') throw new Error('Choose a work')
  const references = (note.meta.links ?? []).filter(link => link.kind === 'derived')
  const sources = await Promise.all(references.map(ref =>
    readWorkSource(store, ref).then(sourceRef, () => ({ id: ref.id, version: ref.version, missing: true }))))
  return { ...note, versions: await store.versions(id), sources }
}

export async function listWorks(store, query) {
  return (await store.list(query)).filter(({ meta }) => meta.type === 'output' && meta.status !== 'archived')
}
