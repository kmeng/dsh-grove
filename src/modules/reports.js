export async function listReports(store, researchId) {
  return (await store.list()).filter(({ meta }) => meta.type === 'report' &&
    meta.links?.some(link => link.kind === 'related' && link.id === researchId))
}

export async function confirmReport(store, input) {
  const research = await store.get(input.research)
  if (research.meta.type !== 'research') throw new Error('Choose a research project')
  const links = [{ kind: 'related', id: research.meta.id, version: research.meta.version }]
  for (const ref of input.evidence ?? []) {
    if (!Number.isSafeInteger(ref.version) || ref.version < 1) throw new Error('Choose an exact evidence version')
    const evidence = await store.get(ref.id, ref.version)
    if (evidence.meta.type !== 'evidence') throw new Error('Choose evidence for the report')
    const source = evidence.meta.links?.find(link => link.kind === 'derived')
    if (source) {
      const document = await store.get(source.id, source.version)
      if (!document.meta.links?.some(link => link.kind === 'related' && link.id === research.meta.id)) {
        throw new Error('Evidence belongs to another research project')
      }
    }
    links.push({ kind: 'derived', id: ref.id, version: ref.version })
  }
  if (input.id !== undefined) {
    if (!Number.isSafeInteger(input.version) || input.version < 1) throw new Error('Choose the current report version')
    const previous = await store.get(input.id, input.version)
    if (previous.meta.type !== 'report' || !previous.meta.links?.some(link => link.kind === 'related' && link.id === research.meta.id)) {
      throw new Error('Report does not belong to this research')
    }
    return store.update(input.id, input.version, { body: input.body, links })
  }
  return store.create({ type: 'report', title: research.meta.title, body: input.body, links })
}

export async function readReport(store, id, version) {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Choose an exact report version')
  const note = await store.get(id, version)
  if (note.meta.type !== 'report') throw new Error('Report not found')
  const evidence = await Promise.all((note.meta.links ?? []).filter(link => link.kind === 'derived').map(async link => {
    try {
      const entry = await store.get(link.id, link.version)
      return { ...entry, original: entry.meta.links?.find(ref => ref.kind === 'derived') }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return { missing: true, reference: link }
    }
  }))
  return { ...note, evidence, versions: await store.versions(id) }
}
