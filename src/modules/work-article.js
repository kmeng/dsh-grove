import { sameSource } from './work-sources.js'

export function articleSources(draft) {
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

export function articleBody(draft) {
  return [
    draft.cover && imageMarkdown(draft.cover),
    ...(draft.illustrations ?? []).filter(image => image.section === null).map(imageMarkdown),
    draft.summary && ('## ' + (draft.language === 'en' ? 'Summary' : '摘要') + '\n\n' + draft.summary),
    ...draft.sections.flatMap(section => [
      '## ' + section.heading.replace(/[\r\n]+/g, ' '),
      section.body,
      section.image && imageMarkdown(section.image),
      ...(draft.illustrations ?? []).filter(image => image.section === section.id).map(imageMarkdown),
    ]),
  ].filter(Boolean).join('\n\n')
}
