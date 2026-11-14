export function captureInspiration(store, input) {
  return store.create({ ...input, type: 'inspiration' })
}

export async function findInspirations(store, query) {
  const notes = await store.list(query)
  return notes.map(({ meta }) => meta)
    .filter(meta => meta.type === 'inspiration' && meta.status !== 'archived')
    .sort((a, b) => String(b.modified ?? b.created).localeCompare(String(a.modified ?? a.created)))
}

export async function readInspiration(store, id, version) {
  const note = await store.get(id, version)
  if (note.meta.type !== 'inspiration' || note.meta.status === 'archived') {
    throw Object.assign(new Error('Inspiration not found'), { code: 'not-found' })
  }
  return { ...note, versions: await store.versions(id) }
}
