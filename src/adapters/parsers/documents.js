export function markdown(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  return text.split(/\r?\n\s*\r?\n/).flatMap((block, index) =>
    block.trim() ? [{ locator: `Paragraph ${index + 1}`, text: block.trim() }] : [])
}

export async function textPdf(bytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true })
  try {
    const document = await task.promise
    if (document.numPages > 100) throw new Error('PDF must have at most 100 pages')
    const blocks = []
    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent()
      const text = content.items.map(item => item.str ?? '').join(' ').trim()
      if (text) blocks.push({ locator: `Page ${page}`, text })
    }
    return blocks
  } finally {
    await task.destroy()
  }
}

export function documentParsers(config = {}) {
  return new Map([
    ['md', { id: 'markdown', version: 1, parse: markdown }],
    ['markdown', { id: 'markdown', version: 1, parse: markdown }],
    ...(config.pdf === false ? [] : [['pdf', { id: 'pdfjs', version: '6.5.438', parse: textPdf }]]),
  ])
}
