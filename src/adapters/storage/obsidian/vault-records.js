import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { link, lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const file = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/

export function vaultRecordStore(vault, directory, { revisions: versionedRecords = false } = {}) {
  async function folder(create = false) {
    const path = join(await vault.folder(create), directory)
    if (create) await mkdir(path, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
    if (!(await lstat(path)).isDirectory() || await realpath(path) !== path) throw new Error('Invalid vault record directory')
    return path
  }

  async function read(id) {
    if (typeof id !== 'string' || !file.test(id + '.json')) throw new Error('Invalid vault record ID')
    const path = await folder()
    const revisions = versionedRecords ? (await readdir(path))
      .filter(name => name.startsWith(id + '.r') && /^\d+\.json$/.test(name.slice(id.length + 2)))
      .sort((a, b) => Number(b.slice(id.length + 2, -5)) - Number(a.slice(id.length + 2, -5))) : []
    const handle = await open(join(path, revisions[0] ?? id + '.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const info = await handle.stat()
      if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Invalid vault record file')
      const run = JSON.parse(await handle.readFile('utf8'))
      if (run.id !== id || run.schema !== 1) throw new Error('Invalid vault record format')
      return run
    } finally {
      await handle.close()
    }
  }

  return {
    read,
    async list() {
      const path = await folder().catch(error => {
        if (error.code !== 'ENOENT') throw error
      })
      if (!path) return []
      return Promise.all((await readdir(path)).filter(name => file.test(name)).map(name => read(name.slice(0, -5))))
    },
    async write(run, expected) {
      if (!file.test(run.id + '.json')) throw new Error('Invalid vault record ID')
      const path = await folder(true)
      const versioned = versionedRecords && expected !== undefined
      if (versioned && (await read(run.id)).revision !== expected) throw Object.assign(new Error('Draft changed'), { code: 'work-conflict' })
      const temporary = join(path, '.' + randomUUID() + '.tmp')
      const handle = await open(temporary, 'wx', 0o600)
      try {
        try {
          const bytes = JSON.stringify(run)
          if (versioned && Buffer.byteLength(bytes) > 2 * 1024 * 1024) throw Object.assign(new Error('Draft storage limit reached'), { code: 'too-large' })
          await handle.writeFile(bytes)
          await handle.sync()
        } finally {
          await handle.close()
        }
        if (versioned) {
          await link(temporary, join(path, run.id + '.r' + run.revision + '.json')).catch(error => {
            if (error.code === 'EEXIST') throw Object.assign(new Error('Draft changed'), { code: 'work-conflict' })
            throw error
          })
        } else await rename(temporary, join(path, run.id + '.json'))
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
      }
    },
  }
}
