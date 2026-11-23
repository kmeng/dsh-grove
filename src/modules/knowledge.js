import { createHash } from 'node:crypto'
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
    if (report.meta.type !== 'report' || report.meta.review === 'draft') throw new Error('Choose a research report')
    links.push({ kind: 'derived', id: report.meta.id, version: report.meta.version })
  }
  return store.create({ type: input.type, title: input.title, body: input.body, links })
}

export async function readKnowledge(store, id, version) {
  const note = await store.get(id, exactVersion(version))
  if (!knowledgeTypes.has(note.meta.type)) throw new Error('Choose a knowledge entry')
  return { ...note, versions: await store.versions(id) }
}

export async function knowledgeDetail(store, id, version) {
  const note = await readKnowledge(store, id, version)
  const source = note.meta.links?.find(link => link.kind === 'derived')
  if (!source) return note
  const report = await store.get(source.id, source.version).catch(error => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  if (report?.meta.type === 'output') return { ...note, work: report }
  if (report?.meta.type !== 'report') return { ...note, reportMissing: true }
  const study = report.meta.links?.find(link => link.kind === 'related')
  return { ...note, report, studyId: study?.id }
}

export function isKnowledgeType(type) { return knowledgeTypes.has(type) }

export function isKnowledge({ meta }) {
  return isKnowledgeType(meta.type) && meta.status !== 'archived'
}

export async function listKnowledge(store, query) {
  return (await store.list(query)).filter(isKnowledge)
}

export async function keepReportAsKnowledge(store, ref) {
  const report = await store.get(ref?.id, exactVersion(ref?.version))
  if (report.meta.type !== 'report' || report.meta.review === 'draft') throw new Error('Choose a confirmed research report')
  // Generated reports have a stable structure. Keep the conclusion and its
  // evidence qualifications together, with the exact full report as the source.
  const sections = report.body.split(/\n(?=## )/)
  const retained = sections.filter(section => /^## (摘要|研究分析|证据局限|结论|发现与证据|Overview|Analysis|Limitations|Conclusion|Findings and evidence)\s*$/m.test(section))
  const body = retained.length ? retained.join('\n\n').trim() : report.body
  const key = createHash('sha256').update('grove:report-knowledge:' + report.meta.id).digest('hex').slice(0, 32)
  const id = key.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
  const links = [{ kind: 'derived', id: report.meta.id, version: report.meta.version }]
  try {
    return await store.create({ type: 'concept', title: report.meta.title, body, links }, id)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const revisions = await store.versions(id)
    const latest = await readKnowledge(store, id, Math.max(...revisions))
    const basis = latest.meta.links?.find(link => link.kind === 'derived' && link.id === report.meta.id)
    if (!basis) throw error
    if (basis.version === report.meta.version) return latest
    if (basis.version > report.meta.version) {
      for (const version of revisions) {
        const previous = await readKnowledge(store, id, version)
        if (previous.meta.links?.some(link => link.kind === 'derived' && link.id === report.meta.id && link.version === report.meta.version)) return previous
      }
      throw new Error('A newer version of this report has already been collected')
    }
    try {
      return await store.update(id, latest.meta.version, {
        body, links, revisionReason: 'Collected report v' + report.meta.version,
      })
    } catch (conflict) {
      if (!conflict.message.startsWith('Version conflict;')) throw conflict
      return keepReportAsKnowledge(store, ref)
    }
  }
}


export async function keepWorkAsKnowledge(store, ref) {
  const work = await store.get(ref?.id, exactVersion(ref?.version))
  if (work.meta.type !== 'output') throw Object.assign(new Error('Choose a saved work'), { code: 'invalid-body' })
  const key = createHash('sha256').update('grove:work-knowledge:' + work.meta.id + ':' + work.meta.version).digest('hex').slice(0, 32)
  const id = key.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
  try {
    return await store.create({ type: 'concept', title: work.meta.title, body: work.body,
      links: [{ kind: 'derived', id: work.meta.id, version: work.meta.version }] }, id)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const note = await readKnowledge(store, id, 1)
    if (!note.meta.links?.some(link => link.kind === 'derived' && link.id === work.meta.id && link.version === work.meta.version)) throw error
    return note
  }
}
