import { articleBody, articleSources } from './work-article.js'
import { readWork, saveWork } from './works.js'

export async function finalizeWork(vault, records, draft, expected) {
  if (draft.stage !== 'writing' || !draft.sections.length || draft.sections.some(section => !section.confirmed || !section.body) || Object.keys(draft.sectionCandidates ?? {}).length) {
    throw Object.assign(new Error('Finish each section before saving the article'), { code: 'invalid-body' })
  }
  if (draft.summaryCandidate || draft.imagePlan?.some(item => !item.accepted && !item.skipped)) {
    throw Object.assign(new Error('Confirm the summary and open image choices before saving'), { code: 'invalid-body' })
  }
  const body = articleBody(draft)
  if (!draft.finalizing) {
    draft.finalizing = true
    draft.revision += 1
    await records.write(draft, expected)
  }
  const entry = await saveWork(vault, { title: draft.topic.title, body, sources: articleSources(draft) }, draft.id)
    .catch(async error => {
      if (error.code !== 'EEXIST') throw error
      const existing = await readWork(vault, draft.id, 1)
      if (existing.meta.title !== draft.topic.title || existing.body !== body) throw error
      return existing
    })
  draft.published = { id: entry.meta.id, version: entry.meta.version }
  delete draft.finalizing
}
