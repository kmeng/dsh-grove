import { createHash } from 'node:crypto'

export function prepareConversation(draft) {
  if (draft.discussions) return draft
  draft.discussions = {}
  draft.legacyTurns = draft.turns ?? []
  delete draft.turns
  for (const [index, section] of draft.sections.entries()) {
    section.id ??= createHash('sha256').update(draft.id + ':' + index).digest('hex').slice(0, 32)
    section.confirmed ??= !!section.body
  }
  if (draft.stage === 'topic' && draft.topic.thesis) draft.topicCandidate = { ...draft.topic }
  if (draft.stage === 'outline' && draft.sections.length) draft.outlineCandidate = draft.sections.map(({ id, heading, point, visual, plannedSources }) =>
    ({ id, heading, point, visual, plannedSources }))
  return draft
}

export function activeScope(draft, section) {
  return draft.stage === 'writing' ? section.id : draft.stage
}

export function conversation(draft, scope) {
  return draft.discussions[scope] ??= []
}

export function confirmOutline(draft, allowChanges) {
  const candidate = draft.outlineCandidate
  if (!candidate?.length) return false
  const affected = draft.sections.filter(section => section.body && !candidate.some(part =>
    part.id === section.id && part.point === section.point))
  if (affected.length && !allowChanges) return false
  draft.sections = candidate.map(part => {
    const existing = draft.sections.find(section => section.id === part.id)
    return { body: '', confirmed: false, ...existing, ...part,
      confirmed: !!existing?.confirmed && existing.point === part.point }
  })
  draft.sectionCandidates = Object.fromEntries(Object.entries(draft.sectionCandidates ?? {}).filter(([id]) =>
    !affected.some(section => section.id === id) && draft.sections.some(section => section.id === id)))
  delete draft.outlineCandidate
  return true
}
