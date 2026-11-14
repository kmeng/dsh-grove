const byRecent = (a, b) => String(b.meta.modified ?? b.meta.created).localeCompare(String(a.meta.modified ?? a.meta.created))
const derivesFrom = (note, ids) => note.meta.links?.some(link => link.kind === 'derived' && ids.has(link.id))
const relatesTo = (note, id) => note.meta.links?.some(link => link.kind === 'related' && link.id === id)

function preview({ meta, body }) {
  return {
    id: meta.id, title: meta.title, version: meta.version, status: meta.status,
    summary: body.length > 180 ? body.slice(0, 180) + '…' : body,
  }
}

export async function inspirationHistory(store, id) {
  const notes = (await store.list()).filter(note => note.meta.status !== 'archived').sort(byRecent)
  const origins = new Set([id])
  return notes.filter(note => note.meta.type === 'research' && derivesFrom(note, origins)).map(study => {
    const reports = notes.filter(note => note.meta.type === 'report' && relatesTo(note, study.meta.id))
    const reportIds = new Set(reports.map(note => note.meta.id))
    const knowledge = notes.filter(note => ['concept', 'claim', 'theory', 'method'].includes(note.meta.type) && derivesFrom(note, reportIds))
    const basisIds = new Set([...reportIds, ...knowledge.map(note => note.meta.id)])
    const works = notes.filter(note => note.meta.type === 'output' && derivesFrom(note, basisIds))
    const finding = notes.find(note => note.meta.type === 'finding' && relatesTo(note, study.meta.id))
    return { ...preview(study), latest: finding ? preview(finding).summary : undefined,
      reports: reports.map(preview), knowledge: knowledge.map(preview), works: works.map(preview) }
  })
}

export async function discoverInspirations(store, model, note) {
  const candidates = (await store.list()).filter(candidate => candidate.meta.type === 'inspiration' &&
    candidate.meta.status !== 'archived' && candidate.meta.id !== note.meta.id).sort(byRecent).slice(0, 24)
  if (!candidates.length) return []
  const result = await model.discover({
    inspiration: note.body.slice(0, 1600),
    candidates: candidates.map((candidate, index) => ({ number: index + 1, text: candidate.body.slice(0, 360) })),
  })
  if (!Array.isArray(result?.matches)) {
    throw Object.assign(new Error('Expected inspiration matches'), { code: 'model-response' })
  }
  const matches = new Map()
  for (const match of result.matches) {
    const candidate = Number.isInteger(match?.number) && candidates[match.number - 1]
    if (!candidate || matches.has(match.number) || typeof match.reason !== 'string' || !match.reason.trim()) continue
    const { id, title, version } = candidate.meta
    matches.set(match.number, {
      id, title, version, excerpt: candidate.body.slice(0, 360), reason: match.reason.trim().slice(0, 360),
      question: typeof match.question === 'string' ? match.question.trim().slice(0, 300) : '',
    })
    if (matches.size === 3) break
  }
  return [...matches.values()]
}
