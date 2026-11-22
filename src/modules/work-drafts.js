import { randomUUID } from 'node:crypto'
import { workDraftStore } from '../adapters/storage/obsidian/research-runs.js'
import { saveWorkImage } from '../adapters/storage/obsidian/work-images.js'
import { findWorkKnowledge, readWorkSource, sameSource, sourceRef, suggestWorkSources, workSourceLimit, workSources } from './work-sources.js'
import { readWork, saveWork } from './works.js'

const pending = new Map()

function invalid(message, code = 'invalid-body') {
  throw Object.assign(new Error(message), { code })
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function sectionAt(draft, index) {
  const section = Number.isInteger(index) && draft.sections[index]
  if (!section) invalid('Choose an article section')
  return section
}

function sourceNumbers(value, references) {
  if (!Array.isArray(value)) return []
  return [...new Set(value)].filter(n => Number.isInteger(n) && n >= 1 && n <= references.length)
    .map(n => references[n - 1])
}

function articleSources(draft) {
  const refs = []
  for (const section of draft.sections) {
    const used = section.usedSources ?? (draft.basis ? [draft.basis] : [])
    for (const ref of used) if (!refs.some(existing => sameSource(existing, ref))) refs.push(ref)
  }
  return refs
}

function imageMarkdown(image) {
  const alt = image.alt.replace(/[\[\]\\\r\n]/g, ' ')
  const caption = image.caption.replace(/[\r\n]+/g, ' ')
  return '![' + alt + '](' + image.path + ')' + (caption ? '\n' + caption : '')
}

function articleBody(draft) {
  return [
    draft.cover && imageMarkdown(draft.cover),
    ...draft.sections.flatMap(section => [
      '## ' + section.heading.replace(/[\r\n]+/g, ' '),
      section.body,
      section.image && imageMarkdown(section.image),
    ]),
  ].filter(Boolean).join('\n\n')
}

async function ask(vault, draft, input, resolveModel, progress) {
  const direction = text(input.message, 6000)
  if (!direction) invalid('Enter a writing direction')
  const selected = draft.stage === 'writing' ? sectionAt(draft, input.section) : null
  if (draft.sources === undefined) {
    progress.phase = 'sources'
    draft.sources = await suggestWorkSources(vault, draft, direction)
  }
  const ordered = [...workSources(draft)].sort((a, b) => {
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
    topic: draft.topic, selected: selected && { heading: selected.heading, point: selected.point, body: selected.body },
    sections: draft.sections.map(({ heading, point, visual, body }) => ({ heading, point, visual, excerpt: body.slice(0, 600) })),
    sources,
    history: draft.turns.slice(-8),
  })
  const reply = text(result?.reply, 4000)
  if (!reply) invalid('The model did not return a usable reply', 'model-response')
  if (draft.stage === 'topic') {
    for (const [field, limit] of Object.entries({ title: 300, audience: 1000, thesis: 2000 })) {
      draft.topic[field] = text(result[field], limit) || draft.topic[field]
    }
  } else if (draft.stage === 'outline') {
    if (!Array.isArray(result.sections) || !result.sections.length || result.sections.length > 8) {
      invalid('The model did not return a usable outline', 'model-response')
    }
    draft.sections = result.sections.map(part => {
      const heading = text(part?.heading, 300)
      const point = text(part?.point, 2000)
      if (!heading || !point) invalid('Each section needs a heading and a central point', 'model-response')
      const prior = draft.sections.find(section => section.heading === heading && section.point === point)
      return { ...prior, heading, point, visual: text(part.visual, 500), body: prior?.body ?? '',
        plannedSources: sourceNumbers(part.sourceNumbers, ordered) }
    })
    if (new Set(draft.sections.map(section => section.heading)).size !== draft.sections.length) {
      invalid('Outline headings must be distinct', 'model-response')
    }
  } else {
    const body = text(result.body, 12000)
    if (!body) invalid('The model did not return a usable section', 'model-response')
    selected.body = body
    selected.usedSources = sourceNumbers(result.sourceNumbers, ordered)
  }
  draft.turns = [...draft.turns, { role: 'user', body: direction }, { role: 'assistant', body: reply }].slice(-60)
}

export async function workDrafts(vault, input, resolveModel) {
  const records = workDraftStore(vault)
  switch (input.action) {
    case 'draft-list':
      return { drafts: (await records.list()).filter(draft => !draft.published)
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .map(({ id, topic, stage, modified }) => ({ id, topic, stage, modified })) }
    case 'draft-read':
      return records.read(input.id)
    case 'draft-source-read':
      return readWorkSource(vault, input.ref)
    case 'draft-source-search':
      return { items: await findWorkKnowledge(vault, text(input.query, 300)) }
    case 'draft-start': {
      const original = input.basis && await readWorkSource(vault, input.basis)
      const draft = { schema: 1, id: randomUUID(), revision: 0, stage: 'topic',
        basis: original && sourceRef(original),
        topic: { title: text(input.title, 300), audience: '', thesis: '' }, sections: [], turns: [],
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
    const draft = await records.read(input.id)
    if (draft.published) {
      if (input.action === 'draft-finish') return { work: draft.published }
      invalid('The draft is already saved as a work', 'work-conflict')
    }
    if (input.revision !== draft.revision) invalid('The draft changed, reopen it before continuing', 'work-conflict')
    switch (input.action) {
      case 'draft-ask':
        await ask(vault, draft, input, resolveModel, progress)
        break
      case 'draft-source-suggest':
        progress.phase = 'sources'
        draft.sources = await suggestWorkSources(vault, draft, text(input.query, 300))
        draft.sourcesAdjusted = true
        break
      case 'draft-source-add': {
        const picked = sourceRef(await readWorkSource(vault, input.ref))
        const refs = workSources(draft).filter(ref => ref.id !== picked.id)
        if (refs.length >= workSourceLimit) invalid('Choose up to five sources')
        draft.sources = [...refs, picked]
        draft.sourcesAdjusted = true
        break
      }
      case 'draft-source-remove':
        draft.sources = workSources(draft).filter(ref => !sameSource(ref, input.ref ?? {}))
        draft.sourcesAdjusted = true
        break
      case 'draft-confirm-topic':
        if (draft.stage !== 'topic' || !draft.topic.title || !draft.topic.thesis) invalid('Confirm a title and central idea first')
        if (!draft.sourcesAdjusted) {
          progress.phase = 'sources'
          draft.sources = await suggestWorkSources(vault, { ...draft, sources: undefined })
        }
        draft.stage = 'outline'
        break
      case 'draft-confirm-outline':
        if (draft.stage !== 'outline' || !draft.sections.length) invalid('Discuss an outline first')
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
        if (!section.body) section.usedSources = []
        section.body = body
        break
      }
      case 'draft-image':
      case 'draft-remove-image': {
        if (draft.stage !== 'writing') invalid('Confirm the outline before adding images')
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
      case 'draft-finish': {
        if (draft.stage !== 'writing' || !draft.sections.length || draft.sections.some(section => !section.body)) {
          invalid('Finish each section before saving the article')
        }
        const body = articleBody(draft)
        const entry = await saveWork(vault, { title: draft.topic.title, body, sources: articleSources(draft) }, draft.id)
          .catch(async error => {
            if (error.code !== 'EEXIST') throw error
            const existing = await readWork(vault, draft.id, 1)
            if (existing.meta.title !== draft.topic.title || existing.body !== body) throw error
            return existing
          })
        draft.published = { id: entry.meta.id, version: entry.meta.version }
        break
      }
      default:
        invalid('Choose a writing action')
    }
    draft.revision += 1
    draft.modified = new Date().toISOString()
    progress.phase = 'saving'
    await records.write(draft)
    return draft.published ? { work: draft.published } : draft
  } finally {
    pending.delete(key)
  }
}
