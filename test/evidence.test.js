import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../src/vault.js'
import { documentParsers } from '../src/adapters/parsers/documents.js'
import { importSource, saveEvidence, openSource } from '../src/modules/evidence.js'
import { startResearch } from '../src/modules/research.js'

test('an excerpt keeps its original document version after another import', async t => {
  const vaultPath = await mkdtemp(join(await realpath(tmpdir()), 'grove-evidence-'))
  t.after(() => rm(vaultPath, { recursive: true, force: true }))
  const store = new Vault(vaultPath)
  const research = await startResearch(store, 'Shade', 'Field notes')
  const parsers = documentParsers({ pdf: false })
  assert.equal(parsers.has('pdf'), false)
  async function importMarkdown(text) {
    const bytes = Buffer.from(text)
    return importSource(store, parsers, {
      bytes, original: bytes.toString('base64'), name: 'walk.md', research: research.meta.id,
    })
  }
  const old = await importMarkdown('Context\n\nOld passage')
  const excerpt = await saveEvidence(store, old.meta, 1)
  const updated = await importMarkdown('New passage')
  assert.equal(updated.meta.id, old.meta.id)
  assert.equal(updated.meta.version, 2)
  const ref = excerpt.meta.links[0]
  const source = await openSource(store, ref.id, ref.version)
  assert.equal(excerpt.meta.locator, 'Paragraph 2')
  assert.equal(excerpt.body, 'Old passage')
  assert.equal(Buffer.from(source.original, 'base64').toString(), 'Context\n\nOld passage')
})

test('the PDF parser captures text at its original page', async () => {
  const stream = 'BT /F1 12 Tf 10 40 Td (Shade) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((obj, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += 'xref\n0 6\n0000000000 65535 f \n'
  for (const offset of offsets) pdf += String(offset).padStart(10, '0') + ' 00000 n \n'
  pdf += `trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`
  assert.deepEqual(await documentParsers().get('pdf').parse(Buffer.from(pdf)), [{ locator: 'Page 1', text: 'Shade' }])
})
