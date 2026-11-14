import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../src/vault.js'
import { propose, preview } from '../src/proposals.js'
import { backupVault, restoreVault } from '../src/adapters/storage/obsidian/backup.js'

test('backup and restore preserve old versions, evidence and hidden drafts', async t => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'grove-backup-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const vault = new Vault(directory)
  const { meta } = await vault.create({ type: 'inspiration', body: '初版' })
  await vault.update(meta.id, 1, { body: '新版' })
  const evidence = await vault.create({ type: 'evidence', body: '摘录', source: '旧资料', locator: '第 2 页' })
  const draft = await propose(vault, { type: 'claim', body: '待审核' })
  const source = await vault.folder()
  await writeFile(join(source, 'unrecognized.md'), '保留未知文件')
  const backup = join(directory, 'backup')
  const destination = join(directory, 'restored')

  await assert.rejects(backupVault(directory, join(source, 'recursive')), /outside/)
  await backupVault(directory, backup)
  await restoreVault(backup, destination)
  const restored = new Vault(destination)
  assert.equal((await restored.get(meta.id, 1)).body, '初版')
  assert.equal((await restored.get(meta.id)).body, '新版')
  assert.deepEqual(await restored.get(evidence.meta.id), evidence)
  assert.equal((await preview(restored, draft)).body, '待审核')
  for (const name of [`${meta.id}.v1.md`, `${meta.id}.v2.md`, `.${draft}.proposal.json`, 'unrecognized.md']) {
    assert.deepEqual(await readFile(join(await restored.folder(), name)), await readFile(join(source, name)))
  }
  await assert.rejects(restoreVault(backup, destination), { code: 'EEXIST' })
  await writeFile(join(backup, 'Grove', 'unrecognized.md'), 'corrupt')
  await assert.rejects(restoreVault(backup, join(directory, 'invalid')), /verification failed/)
  await symlink(join(source, 'unrecognized.md'), join(source, 'link.md'))
  await assert.rejects(backupVault(directory, join(directory, 'linked')), /Unsupported snapshot entry/)
})
