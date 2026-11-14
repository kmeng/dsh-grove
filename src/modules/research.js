export async function startResearch(store, question, body, origin) {
  const entry = await store.create({ type: 'question', body: question })
  return store.create({ type: 'research', title: entry.meta.title, body, question: entry.meta.id, links: origin ? [{ kind: 'derived', id: origin.id, version: origin.version }] : [] })
}

export async function listResearch(store) {
  return (await store.list()).filter(({ meta }) => meta.type === 'research' && meta.status !== 'archived')
    .sort((a, b) => String(b.meta.modified ?? b.meta.created).localeCompare(String(a.meta.modified ?? a.meta.created)))
}

export async function saveResearch(store, id, version, body) {
  const current = await store.get(id, version)
  if (current.meta.type !== 'research' || current.meta.status === 'archived') {
    throw Object.assign(new Error('Research not found'), { code: 'not-found' })
  }
  return store.update(id, version, { body })
}
