import { randomUUID } from 'node:crypto'
import { activeScope, conversation } from './work-conversation.js'
import { readWorkSource, sameSource, suggestWorkSources, workSources } from './work-sources.js'

function invalid(message, code = 'invalid-body') {
  throw Object.assign(new Error(message), { code })
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function candidateBasis(draft, section, model = '') {
  return { heading: section.heading, point: section.point, model,
    materials: (section.sources ?? workSources(draft)).map(({ id, version, title }) => ({ id, version, title })) }
}

export function candidateNeedsReview(draft, section, candidate) {
  if (!candidate.basis || candidate.manual && candidate.usedSources.length) return true
  const current = candidateBasis(draft, section, candidate.basis.model)
  return current.heading !== candidate.basis.heading || current.point !== candidate.basis.point ||
    current.materials.length !== candidate.basis.materials.length ||
    current.materials.some((ref, index) => !sameSource(ref, candidate.basis.materials[index]))
}

export function presentDraft(draft) {
  const sectionCandidates = Object.fromEntries(Object.entries(draft.sectionCandidates ?? {}).map(([id, candidate]) => {
    const section = draft.sections.find(part => part.id === id)
    return [id, { ...candidate, needsReview: !section || candidateNeedsReview(draft, section, candidate) }]
  }))
  return draft.sectionCandidates ? { ...draft, sectionCandidates } : draft
}

function sourceNumbers(value, references) {
  if (!Array.isArray(value)) return []
  return [...new Set(value)].filter(n => Number.isInteger(n) && n >= 1 && n <= references.length)
    .map(n => references[n - 1])
}

export async function generateCandidate(vault, draft, input, resolveModel, progress, selected) {
  const direction = text(input.message, 6000)
  if (!direction) invalid('Enter a writing direction')
  const scope = activeScope(draft, selected)
  const turns = conversation(draft, scope)
  if (draft.sources === undefined) {
    progress.phase = 'sources'
    draft.sources = await suggestWorkSources(vault, draft, direction)
  }
  const ordered = [...(selected?.sources ?? workSources(draft))].sort((a, b) => {
    const planned = selected?.plannedSources ?? []
    return Number(planned.some(ref => sameSource(ref, b))) - Number(planned.some(ref => sameSource(ref, a)))
  })
  const sources = await Promise.all(ordered.map(async (ref, index) => {
    const note = await readWorkSource(vault, ref)
    return { number: index + 1, title: note.meta.title, body: note.body.slice(0, 8000) }
  }))
  const model = resolveModel()
  progress.phase = draft.stage
  const result = await model.compose({
    stage: draft.stage, language: input.language === 'en' ? 'en' : 'zh', direction,
    topic: draft.stage === 'topic' ? draft.topicCandidate ?? draft.topic : draft.topic, selected: selected && { heading: selected.heading, point: selected.point, body: draft.sectionCandidates?.[selected.id]?.body ?? selected.body },
    sections: draft.stage === 'outline'
      ? (draft.outlineCandidate ?? draft.sections).map(({ id, heading, point }) => ({ id, heading, point }))
      : draft.stage === 'writing' ? draft.sections.filter(part => part.id !== selected.id).map(({ heading, point }) => ({ heading, point })) : [],
    sources,
    history: turns.slice(-8),
  })
  const reply = text(result?.reply, 4000)
  if (!reply) invalid('The model did not return a usable reply', 'model-response')
  if (draft.stage === 'topic') {
    const proposal = { ...draft.topic, ...draft.topicCandidate }
    for (const [field, limit] of Object.entries({ title: 300, audience: 1000, thesis: 2000 })) {
      proposal[field] = text(result[field], limit) || proposal[field]
    }
    draft.topicCandidate = proposal
  } else if (draft.stage === 'outline') {
    if (!Array.isArray(result.sections) || !result.sections.length || result.sections.length > 8) {
      invalid('The model did not return a usable outline', 'model-response')
    }
    const current = draft.outlineCandidate ?? draft.sections
    const candidate = result.sections.map(part => {
      const heading = text(part?.heading, 300)
      const point = text(part?.point, 2000)
      if (!heading || !point) invalid('Each section needs a heading and a central point', 'model-response')
      const prior = current.find(section => section.id === part.id) ?? current.find(section => section.heading === heading)
      return { id: prior?.id ?? randomUUID(), heading, point, visual: text(part.visual, 500),
        plannedSources: sourceNumbers(part.sourceNumbers, ordered) }
    })
    if (new Set(candidate.map(section => section.heading)).size !== candidate.length || new Set(candidate.map(section => section.id)).size !== candidate.length) {
      invalid('Outline headings must be distinct', 'model-response')
    }
    draft.outlineCandidate = candidate
  } else {
    const body = text(result.body, 12000)
    if (!body) invalid('The model did not return a usable section', 'model-response')
    draft.sectionCandidates ??= {}
    draft.sectionCandidates[selected.id] = { body, usedSources: sourceNumbers(result.sourceNumbers, ordered), basis: candidateBasis(draft, selected, model.name ?? ''), manual: false }
  }
  draft.language = input.language === 'en' ? 'en' : 'zh'
  turns.push({ role: 'user', body: direction }, { role: 'assistant', body: reply, model: model.name ?? '' })
}
