import { finalizeWork } from './work-finalization.js'
import { candidateBasis, candidateNeedsReview, generateCandidate, presentDraft } from './work-generation.js'
import { updateIllustrations } from './work-illustrations.js'
import { confirmOutline, prepareConversation } from './work-conversation.js'
import { randomUUID } from 'node:crypto'
import { workDraftStore } from '../adapters/storage/obsidian/work-drafts.js'
import { saveWorkImage } from '../adapters/storage/obsidian/work-images.js'
import { findWorkKnowledge, readWorkSource, sameSource, sourceRef, suggestWorkSources, workSourceLimit, workSources } from './work-sources.js'
import { startResearch } from './research.js'

const pending = new Map()

function invalid(message, code = 'invalid-body') {
  throw Object.assign(new Error(message), { code })
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function sectionAt(draft, id) {
  const section = draft.sections.find(section => section.id === id)
  if (!section) invalid('Choose an article section')
  return section
}

export async function workDrafts(vault, input, resolveModel, generateImage = async () => null) {
  const records = workDraftStore(vault)
  switch (input.action) {
    case 'draft-list':
      return { drafts: (await records.list()).filter(draft => !draft.published)
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .map(({ id, topic, stage, modified }) => ({ id, topic, stage, modified })) }
    case 'draft-read':
      return presentDraft(prepareConversation(await records.read(input.id)))
    case 'draft-source-read':
      return readWorkSource(vault, input.ref)
    case 'draft-source-search':
      return { items: await findWorkKnowledge(vault, text(input.query, 300)) }
    case 'draft-start': {
      const original = input.basis && await readWorkSource(vault, input.basis)
      const draft = { schema: 1, id: randomUUID(), revision: 0, stage: 'topic',
        basis: original && sourceRef(original),
        topic: { title: text(input.title, 300), audience: '', thesis: '' }, sections: [], discussions: {},
        modified: new Date().toISOString() }
      await records.write(draft)
      return draft
    }
  }
  if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)) invalid('Choose a writing draft')
  const key = vault.path + ':' + input.id
  if (input.action === 'draft-progress') return { progress: pending.get(key) ?? null }
  if (pending.has(key)) invalid('Another change to this draft is in progress', 'work-conflict')
  const progress = { action: input.action, phase: 'preparing' }
  pending.set(key, progress)
  try {
    const draft = prepareConversation(await records.read(input.id))
    if (draft.published) {
      if (input.action === 'draft-finish') return { work: draft.published }
      invalid('The draft is already saved as a work', 'work-conflict')
    }
    if (draft.finalizing && input.action !== 'draft-finish') invalid('The article is being saved', 'work-conflict')
    if (input.revision !== draft.revision && !(draft.finalizing && input.action === 'draft-finish')) invalid('The draft changed, reopen it before continuing', 'work-conflict')
    switch (input.action) {
      case 'draft-research': {
        if (draft.stage !== 'writing') invalid('Confirm an outline before researching a section')
        const section = sectionAt(draft, input.section)
        const direction = text(section.heading + ' — ' + section.point, 300)
        const study = await startResearch(vault, direction, '', [], { draftId: draft.id, sectionId: section.id })
        return { study: study.meta.id, direction }
      }
      case 'draft-ask':
        await generateCandidate(vault, draft, input, resolveModel, progress,
          draft.stage === 'writing' ? sectionAt(draft, input.section) : null)
        break
      case 'draft-source-suggest': {
        progress.phase = 'sources'
        const section = input.section ? sectionAt(draft, input.section) : null
        const found = await suggestWorkSources(vault, section ? { ...draft, sources: section.sources ?? workSources(draft),
          topic: { title: section.heading, thesis: section.point } } : draft, text(input.query, 300))
        if (section) section.sources = found
        else draft.sources = found
        draft.sourcesAdjusted = true
        break
      }
      case 'draft-source-add': {
        const picked = sourceRef(await readWorkSource(vault, input.ref))
        const section = input.section ? sectionAt(draft, input.section) : null
        const selected = section?.sources ?? workSources(draft)
        if ((!section || section.sources) && selected.some(ref => sameSource(ref, picked))) return presentDraft(draft)
        const refs = selected.filter(ref => ref.id !== picked.id)
        if (refs.length >= workSourceLimit) invalid('Choose up to five sources', 'work-source-limit')
        if (section) section.sources = [...refs, picked]
        else {
          draft.sources = [...refs, picked]
          draft.sourcesAdjusted = true
        }
        break
      }
      case 'draft-source-remove': {
        const section = input.section ? sectionAt(draft, input.section) : null
        const refs = (section?.sources ?? workSources(draft)).filter(ref => !sameSource(ref, input.ref ?? {}))
        if (section) section.sources = refs
        else draft.sources = refs
        draft.sourcesAdjusted = true
        break
      }
      case 'draft-confirm-topic':
        if (draft.stage !== 'topic' || !draft.topicCandidate?.title || !draft.topicCandidate?.thesis) invalid('Confirm a title and central idea first')
        draft.topic = draft.topicCandidate
        delete draft.topicCandidate
        if (!draft.sourcesAdjusted) {
          progress.phase = 'sources'
          draft.sources = await suggestWorkSources(vault, { ...draft, sources: undefined })
        }
        draft.stage = 'outline'
        break
      case 'draft-confirm-outline':
        if (draft.stage !== 'outline' || !confirmOutline(draft, input.allowChanges === true)) invalid('Confirm the outline and acknowledge changes to written sections')
        draft.stage = 'writing'
        break
      case 'draft-revise-outline':
        if (draft.stage !== 'writing') invalid('Confirm an outline first')
        draft.stage = 'outline'
        break
      case 'draft-visual': {
        if (draft.stage !== 'writing') invalid('Confirm the outline before planning images')
        const selected = input.section === null ? null : sectionAt(draft, input.section)
        progress.phase = 'visual'
        const result = await resolveModel().compose({
          stage: 'visual', language: input.language === 'en' ? 'en' : 'zh',
          topic: draft.topic, placement: selected ? 'section' : 'cover',
          selected: selected && { heading: selected.heading, point: selected.point, body: selected.body },
        })
        const visual = text(result?.reply, 2000)
        if (!visual) invalid('The model did not return an image suggestion', 'model-response')
        if (selected) selected.visual = visual
        else draft.coverVisual = visual
        break
      }
      case 'draft-section': {
        if (draft.stage !== 'writing') invalid('Confirm the outline before writing')
        const body = text(input.body, 12000)
        if (!body) invalid('Write something for this section')
        const section = sectionAt(draft, input.section)
        draft.sectionCandidates ??= {}
        const previous = draft.sectionCandidates[section.id]
        draft.sectionCandidates[section.id] = { body, usedSources: previous?.usedSources ?? section.usedSources ?? [],
          basis: previous?.basis ?? candidateBasis(draft, section), manual: true }
        break
      }
      case 'draft-discard-section-candidate': {
        const section = sectionAt(draft, input.section)
        if (draft.stage !== 'writing' || !draft.sectionCandidates?.[section.id]) invalid('Choose a section candidate')
        delete draft.sectionCandidates[section.id]
        break
      }
      case 'draft-confirm-section': {
        if (draft.stage !== 'writing') invalid('Confirm the outline before writing')
        const section = sectionAt(draft, input.section)
        const candidate = draft.sectionCandidates?.[section.id]
        if (!candidate) invalid('Draft the section first')
        if (candidateNeedsReview(draft, section, candidate) && input.reviewed !== true) {
          invalid('Review the candidate and its references before confirming', 'work-candidate-review')
        }
        Object.assign(section, { body: candidate.body, usedSources: candidate.usedSources, confirmed: true })
        delete draft.summary
        delete draft.summaryCandidate
        delete draft.sectionCandidates[section.id]
        break
      }
      case 'draft-image':
      case 'draft-remove-image': {
        if (draft.stage !== 'writing') invalid('Confirm the outline before adding images')
        if (input.action === 'draft-image' && input.item) {
          const item = draft.imagePlan?.find(entry => entry.id === input.item)
          const alt = text(input.alt, 240)
          if (!item || !alt) invalid('Choose a placement and give the image alt text')
          item.alt = alt
          item.caption = text(input.caption, 500)
          item.candidate = await saveWorkImage(vault, input.bytes)
          break
        }
        const target = input.section === null ? draft : sectionAt(draft, input.section)
        const field = input.section === null ? 'cover' : 'image'
        if (input.action === 'draft-remove-image') delete target[field]
        else {
          const alt = text(input.alt, 240)
          if (!alt) invalid('Describe the image for readers who cannot see it')
          target[field] = { alt, caption: text(input.caption, 500), path: await saveWorkImage(vault, input.bytes) }
        }
        break
      }
      case 'draft-plan-illustrations':
      case 'draft-plan-add':
      case 'draft-plan-remove':
      case 'draft-plan-edit':
      case 'draft-plan-skip':
      case 'draft-generate-image':
      case 'draft-image-accept':
      case 'draft-render-chart':
        progress.phase = 'visual'
        await updateIllustrations(draft, { ...input, vault }, resolveModel, generateImage)
        break
      case 'draft-summary': {
        if (draft.stage !== 'writing' || draft.sections.some(section => !section.confirmed)) invalid('Confirm each section before summarizing')
        progress.phase = 'writing'
        const result = await resolveModel().compose({ stage: 'summary', language: input.language === 'en' ? 'en' : 'zh',
          topic: draft.topic, sections: draft.sections.map(({ heading, body }) => ({ heading, body })) })
        const summary = text(result?.reply, 600)
        if (!summary) invalid('The model did not return a summary', 'model-response')
        draft.summaryCandidate = summary
        break
      }
      case 'draft-confirm-summary':
        if (!draft.summaryCandidate) invalid('Draft a summary first')
        draft.summary = draft.summaryCandidate
        delete draft.summaryCandidate
        break
      case 'draft-finish': {
        await finalizeWork(vault, records, draft, input.revision)
        break
      }
      default:
        invalid('Choose a writing action')
    }
    const expected = draft.revision
    draft.revision += 1
    draft.modified = new Date().toISOString()
    progress.phase = 'saving'
    await records.write(draft, expected)
    return draft.published ? { work: draft.published } : presentDraft(draft)
  } finally {
    pending.delete(key)
  }
}
