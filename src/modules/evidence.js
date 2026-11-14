export async function importSource(store, parsers, input) {
  const research = await store.get(input.research)
  if (research.meta.type !== 'research') throw new Error('Choose a research project')
  const extension = input.name.split('.').at(-1).toLowerCase()
  const parser = parsers.get(extension)
  if (!parser) throw new Error('No enabled parser for this format')
  const blocks = await parser.parse(input.bytes)
  if (!blocks.length) throw new Error('No text found. Scans require OCR.')
  const document = { original: input.original, blocks, parser: parser.id, parserVersion: parser.version }
  const previous = (await store.list()).find(({ meta }) => meta.type === 'source' && meta.title === input.name &&
    meta.links?.some(link => link.kind === 'related' && link.id === research.meta.id))
  const { meta } = previous ? await store.update(previous.meta.id, previous.meta.version, { body: JSON.stringify(document) }) : await store.create({
    type: 'source', title: input.name, body: JSON.stringify(document),
    links: [{ kind: 'related', id: research.meta.id, version: research.meta.version }],
  })
  return { meta, blocks }
}

export async function saveEvidence(store, reference, index) {
  if (!Number.isSafeInteger(reference.version) || reference.version < 1 || !Number.isSafeInteger(index) || index < 0) {
    throw new Error('Choose an exact source version and passage')
  }
  const note = await store.get(reference.id, reference.version)
  if (note.meta.type !== 'source') throw new Error('Choose a source document')
  const block = JSON.parse(note.body).blocks[index]
  if (!block) throw new Error('Choose a valid source passage')
  return store.create({
    type: 'evidence', body: block.text, source: note.meta.title, locator: block.locator,
    links: [{ kind: 'derived', id: note.meta.id, version: note.meta.version }],
  })
}

export async function openSource(store, id, version) {
  const note = await store.get(id, version)
  if (note.meta.type !== 'source') throw new Error('Source document not found')
  const { blocks, original } = JSON.parse(note.body)
  return { meta: note.meta, blocks, original }
}
