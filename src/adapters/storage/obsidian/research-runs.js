import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const file = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/

export function researchRunStore(vault) {
  async function folder(create = false) {
    const path = join(await vault.folder(create), '.research-runs')
    if (create) await mkdir(path, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
    if (!(await lstat(path)).isDirectory() || await realpath(path) !== path) throw new Error('Invalid research run directory')
    return path
  }

  async function read(id) {
    if (typeof id !== 'string' || !file.test(id + '.json')) throw new Error('Invalid research run ID')
    const handle = await open(join(await folder(), id + '.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const info = await handle.stat()
      if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Invalid research run file')
      const run = JSON.parse(await handle.readFile('utf8'))
      if (run.id !== id || run.schema !== 1) throw new Error('Invalid research run format')
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
    async write(run) {
      if (!file.test(run.id + '.json')) throw new Error('Invalid research run ID')
      const path = await folder(true)
      const temporary = join(path, '.' + randomUUID() + '.tmp')
      const handle = await open(temporary, 'wx', 0o600)
      try {
        try {
          await handle.writeFile(JSON.stringify(run))
          await handle.sync()
        } finally {
          await handle.close()
        }
        await rename(temporary, join(path, run.id + '.json'))
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
      }
    },
  }
}
