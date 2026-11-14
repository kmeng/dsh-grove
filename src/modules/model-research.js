export async function runResearchModel(store, model, input) {
  const study = await store.get(input.id, input.version)
  if (study.meta.type !== 'research') throw new Error('Choose a research project')
  const refs = new Map()
  for (const reference of input.materials) {
    if (!Number.isSafeInteger(reference.version) || reference.version < 1) throw new Error('Choose an exact evidence version')
    const item = await store.get(reference.id, reference.version)
    const link = item.meta.links?.find(link => link.kind === 'derived')
    if (item.meta.type !== 'evidence' || !link) throw new Error('Choose evidence from this research')
    const document = await store.get(link.id, link.version)
    if (!document.meta.links?.some(link => link.kind === 'related' && link.id === study.meta.id)) {
      throw new Error('Choose evidence from this research')
    }
    refs.set(item.meta.id, { id: item.meta.id, version: item.meta.version, text: item.body })
  }
  const result = await model.investigate({ question: input.question, materials: [...refs.values()], history: input.history })
  if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > 20000 ||
    !Array.isArray(result.citations) || result.citations.some(id => !refs.has(id))) {
    throw Object.assign(new Error('Model returned invalid or unapproved citations'), { code: 'model-response' })
  }
  const links = [{ kind: 'related', id: study.meta.id, version: study.meta.version }]
  for (const id of new Set(result.citations)) {
    const ref = refs.get(id)
    links.push({ kind: 'derived', id, version: ref.version })
  }
  return store.create({ type: 'finding', title: input.question, body: result.text, links })
}
