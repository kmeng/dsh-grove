import { randomUUID } from 'node:crypto'
import { saveWorkChart, saveWorkImage } from '../adapters/storage/obsidian/work-images.js'

const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
function invalid(message) { throw Object.assign(new Error(message), { code: 'invalid-body' }) }

export async function updateIllustrations(draft, input, model, generateImage) {
  if (draft.stage !== 'writing') invalid('Confirm the outline before planning illustrations')
  if (input.action === 'draft-plan-illustrations') {
    const result = await model().compose({ stage: 'illustrations', topic: draft.topic, language: input.language === 'en' ? 'en' : 'zh',
      sections: draft.sections.map(({ id, heading, point, body }) => ({ id, heading, point, excerpt: body.slice(0, 900) })) })
    if (!Array.isArray(result?.images) || result.images.length > 6) invalid('The image plan must contain at most six placements')
    draft.imagePlan = result.images.map(item => {
      const section = item.section === null ? null : draft.sections.find(part => part.id === item.section)?.id
      const prompt = clean(item.prompt, 2000)
      const alt = clean(item.alt, 240)
      if (section === undefined || !prompt || !alt || !['chart', 'illustration'].includes(item.kind)) invalid('Invalid image placement')
      return { id: randomUUID(), section, kind: item.kind, prompt, alt, caption: clean(item.caption, 500) }
    })
    return
  }
  const item = draft.imagePlan?.find(entry => entry.id === input.item)
  if (input.action === 'draft-plan-add') {
    const section = input.section === null ? null : draft.sections.find(entry => entry.id === input.section)?.id
    if (section === undefined || (draft.imagePlan?.length ?? 0) >= 6) invalid('Choose a valid placement, up to six images')
    draft.imagePlan = [...(draft.imagePlan ?? []), { id: randomUUID(), section, kind: input.kind === 'chart' ? 'chart' : 'illustration',
      prompt: clean(input.prompt, 2000), alt: clean(input.alt, 240), caption: clean(input.caption, 500) }]
    return
  }
  if (!item) invalid('Choose an image plan item')
  if (input.action === 'draft-plan-remove') {
    draft.imagePlan = draft.imagePlan.filter(entry => entry !== item)
    draft.illustrations = (draft.illustrations ?? []).filter(entry => entry.id !== item.id)
  }
  else if (input.action === 'draft-plan-skip') item.skipped = true
  else if (input.action === 'draft-plan-edit') {
    const section = input.section === null ? null : draft.sections.find(entry => entry.id === input.section)?.id
    if (section === undefined) invalid('Choose a valid image placement')
    item.section = section
    const accepted = draft.illustrations?.find(entry => entry.id === item.id)
    if (accepted) accepted.section = section
  } else if (input.action === 'draft-image-accept') {
    if (!item.candidate) invalid('Generate or upload the image first')
    draft.illustrations = [...(draft.illustrations ?? []).filter(entry => entry.id !== item.id),
      { id: item.id, section: item.section, path: item.candidate, alt: item.alt, caption: item.caption }]
    delete item.candidate
    item.accepted = true
    delete item.skipped
  } else if (input.action === 'draft-render-chart') {
    if (item.kind !== 'chart') invalid('Choose a chart placement')
    const unit = clean(input.unit, 40)
    const citation = clean(input.citation, 240)
    if (!unit || !citation || !Array.isArray(input.rows) || input.rows.length < 2 || input.rows.length > 12) {
      invalid('Enter 2–12 measurements, a unit, and a source')
    }
    const rows = input.rows.map(row => ({ label: clean(row.label, 40), value: row.value }))
    if (rows.some(row => !row.label || !Number.isFinite(row.value) || row.value < 0) || !rows.some(row => row.value > 0)) {
      invalid('Use nonnegative finite chart values with at least one positive value')
    }
    item.candidate = await saveWorkChart(input.vault, { rows, unit, citation })
    item.caption = citation
  } else {
    if (item.kind !== 'illustration' || !item.prompt) invalid('Choose an illustration and enter its prompt')
    const encoded = await generateImage(item.prompt)
    if (encoded) item.candidate = await saveWorkImage(input.vault, encoded)
  }
}
