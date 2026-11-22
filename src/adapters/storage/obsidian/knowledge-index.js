import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { open, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const filename = '.knowledge-index.json'

export async function readKnowledgeIndex(vault) {
  try {
    const path = join(await vault.folder(), filename)
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      if (!(await handle.stat()).isFile()) throw new Error('Invalid knowledge index file')
      const index = JSON.parse(await handle.readFile('utf8'))
      return (index.schema === 1 || index.schema === 2) && typeof index.day === 'string' && index.entries ? index : null
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    return null
  }
}

export async function writeKnowledgeIndex(vault, index) {
  const folder = await vault.folder(true)
  const temporary = join(folder, '.' + randomUUID() + '.tmp')
  const handle = await open(temporary, 'wx', 0o600)
  try {
    try {
      await handle.writeFile(JSON.stringify(index))
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, join(folder, filename))
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
}
