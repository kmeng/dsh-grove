import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { Vault, stages } from '../src/vault.js'
import { accept, discard, preview, propose } from '../src/proposals.js'
import { apply } from '../src/plugin.js'

async function fixture(t) {
  const path = await mkdtemp(join(tmpdir(), 'grove-test-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return new Vault(path)
}

test('captures Chinese Markdown and migrates a versioned vault without a database', async t => {
  const from = await fixture(t)
  const to = await fixture(t)
  const { meta } = await from.create({ type: 'inspiration', body: '为什么组织会变复杂？' })
  await from.update(meta.id, 1, { body: '组织复杂性的边界' })
  const path = join(await from.folder(), `${meta.id}.v2.md`)
  await writeFile(path, (await readFile(path, 'utf8')).replace('组织复杂性的边界', '组织复杂性的边界与假设'))
  await cp(await from.folder(), join(to.path, 'Grove'), { recursive: true })
  assert.equal((await to.list('假设'))[0].meta.id, meta.id)
  assert.equal((await to.get(meta.id, 1)).body, '为什么组织会变复杂？')
})

test('rejects traversal and symlinks and prevents parallel edits from overwriting', async t => {
  const vault = await fixture(t)
  await assert.rejects(vault.get('../secrets'), /Invalid Grove ID/)
  const { meta } = await vault.create({ type: 'concept', body: 'original' })
  const results = await Promise.allSettled([
    vault.update(meta.id, 1, { body: 'first' }),
    vault.update(meta.id, 1, { body: 'second' }),
  ])
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1)
  assert.equal((await vault.get(meta.id)).meta.version, 2)
  const files = await readdir(await vault.folder())
  assert.equal(files.length, 2)
  await symlink(join(await vault.folder(), files[0]), join(await vault.folder(), `${meta.id}.v3.md`))
  await assert.rejects(vault.get(meta.id), /ELOOP/)
  const other = await fixture(t)
  await symlink(await vault.folder(), join(other.path, 'Grove'))
  await assert.rejects(other.create({ type: 'inspiration', body: 'outside' }), /real directory/)
})

test('drafts can be previewed, discarded, edited and saved only once', async t => {
  const vault = await fixture(t)
  const abandoned = await propose(vault, { type: 'inspiration', body: 'discard' })
  await discard(vault, abandoned)
  await assert.rejects(preview(vault, abandoned), /ENOENT/)
  const id = await propose(vault, { type: 'exploration', body: 'draft', origin: 'session:test · messages 3–5' })
  assert.deepEqual(await vault.list(), [])
  const piped = spawnSync(process.execPath, ['src/cli.js', 'accept', id], {
    env: { ...process.env, GROVE_VAULT: vault.path }, input: 'SAVE\n', encoding: 'utf8',
  })
  assert.equal(piped.status, 1)
  assert.match(piped.stderr, /interactive terminal/)
  const proposal = { ...await preview(vault, id), body: 'edited' }
  const outcomes = await Promise.allSettled([accept(vault, id, proposal), accept(vault, id, proposal)])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
  assert.equal((await vault.get(id)).body, 'edited')
  assert.match((await vault.get(id)).meta.origin, /messages 3–5/)
  await assert.rejects(preview(vault, id), /ENOENT/)
})

test('GRC supports pause, re-entry and completion without a deliverable', async t => {
  const vault = await fixture(t)
  const question = await vault.create({ type: 'question', body: 'What changes coordination?' })
  const research = await vault.create({ type: 'research', body: 'Scope', question: question.meta.id })
  const id = research.meta.id
  assert.equal(stages.length, 8)
  assert.equal(research.meta.stage, 'question')
  await vault.update(id, 1, { stage: 'validation' })
  await vault.update(id, 2, { stage: 'analysis', status: 'paused' })
  await vault.update(id, 3, { status: 'open' })
  await vault.update(id, 4, { stage: 'review', status: 'closed' })
  assert.equal((await vault.get(id)).meta.status, 'closed')
  assert.equal((await vault.list()).some(note => note.meta.type === 'output'), false)
})

test('evidence stays linked to its recorded version and retains a source locator', async t => {
  const vault = await fixture(t)
  const claim = await vault.create({ type: 'claim', body: 'My tentative claim' })
  const evidence = await vault.create({ type: 'evidence', body: 'Excerpt', source: 'https://example.org/report', locator: 'p. 12, paragraph 2' })
  await vault.update(claim.meta.id, 1, { link: { kind: 'refutes', id: evidence.meta.id } })
  await vault.update(evidence.meta.id, 1, { body: 'Revised excerpt' })
  await vault.update(claim.meta.id, 2, { body: 'My revised claim' })
  const prior = await vault.get(claim.meta.id, 2)
  const edge = prior.meta.links[0]
  assert.equal(edge.kind, 'refutes')
  assert.deepEqual((await vault.get(claim.meta.id)).meta.links, [])
  const cited = await vault.get(edge.id, edge.version)
  assert.equal(cited.body, 'Excerpt')
  assert.equal(cited.meta.source, 'https://example.org/report')
  assert.equal(cited.meta.locator, 'p. 12, paragraph 2')
  assert.match(await readFile(join(await vault.folder(), `${claim.meta.id}.v2.md`), 'utf8'), /refutes \[\[/)
})

test('the plugin exposes a role, drafts, and allowlisted read access only', async t => {
  const vault = await fixture(t)
  const allowed = await vault.create({ type: 'concept', body: 'Allowed text' })
  const privateNote = await vault.create({ type: 'concept', body: 'Private text' })
  const tools = new Map()
  apply({ tools: { register: tool => tools.set(tool.name, tool) } }, { vault: vault.path, readableIds: [allowed.meta.id] })
  assert.deepEqual([...tools.keys()].sort(), ['grove_propose', 'grove_read', 'grove_role'])
  const call = (name, args) => tools.get(name).execute(args, {})
  assert.match(await call('grove_role', { role: 'critical' }), /counterexamples/)
  assert.match(await call('grove_read', { id: allowed.meta.id }), /Allowed text/)
  assert.match(await call('grove_read', { id: privateNote.meta.id }), /outside/)
  await call('grove_propose', { type: 'question', body: 'An open question' })
  assert.equal((await vault.list()).length, 2)
})
