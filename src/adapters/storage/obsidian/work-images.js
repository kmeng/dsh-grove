import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { link, lstat, mkdir, open, realpath, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const workImageLimit = 4 * 1024 * 1024
const filePattern = /^[a-f0-9]{64}\.(png|jpg|webp|svg)$/
const formats = {
  png: { mime: 'image/png', match: b => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  jpg: { mime: 'image/jpeg', match: b => b.subarray(0, 3).toString('hex') === 'ffd8ff' },
  svg: { mime: 'image/svg+xml', match: b => b.toString('utf8', 0, 64).startsWith('<svg xmlns=') },
  webp: { mime: 'image/webp', match: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
}

async function folder(vault, create = false) {
  const path = join(await vault.folder(create), 'work-media')
  if (create) await mkdir(path, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
  if (!(await lstat(path)).isDirectory() || await realpath(path) !== path) throw new Error('Invalid work image directory')
  return path
}

export async function readWorkImage(vault, name) {
  const extension = filePattern.exec(name)?.[1]
  if (!extension) throw Object.assign(new Error('Image not found'), { code: 'not-found' })
  const handle = await open(join(await folder(vault), name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > workImageLimit) throw new Error('Invalid work image')
    const bytes = await handle.readFile()
    if (!formats[extension].match(bytes)) throw new Error('Invalid work image')
    return { bytes, mime: formats[extension].mime }
  } finally {
    await handle.close()
  }
}

export async function saveWorkImage(vault, encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw Object.assign(new Error('Choose an image file'), { code: 'invalid-body' })
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length > workImageLimit) throw Object.assign(new Error('The image is too large'), { code: 'too-large' })
  const extension = ['png', 'jpg', 'webp'].find(key => formats[key].match(bytes))
  if (!extension) throw Object.assign(new Error('Choose a PNG, JPEG or WebP image'), { code: 'unsupported-media' })
  return publishImage(vault, bytes, extension)
}

async function publishImage(vault, bytes, extension) {
  const name = createHash('sha256').update(bytes).digest('hex') + '.' + extension
  const directory = await folder(vault, true)
  const temporary = join(directory, '.' + randomUUID() + '.tmp')
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600, flush: true })
    try {
      await link(temporary, join(directory, name))
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const existing = await readWorkImage(vault, name)
      if (!existing.bytes.equals(bytes)) throw new Error('Invalid work image contents')
    }
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
  return 'work-media/' + name
}

export function saveWorkChart(vault, { rows, unit, citation }) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  const max = Math.max(...rows.map(row => row.value))
  const height = 82 + rows.length * 36
  const bars = rows.map((row, index) => {
    const y = 32 + index * 36
    const width = Math.floor(row.value / max * 440)
    return `<text x="16" y="${y + 16}" fill="#1b3a2e">${escape(row.label)}</text><rect x="260" y="${y}" width="${width}" height="24" rx="4" fill="#2f7d5b"/><text x="${268 + width}" y="${y + 16}" fill="#1b3a2e">${escape(row.value)}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="${height}" viewBox="0 0 860 ${height}"><rect width="860" height="${height}" fill="#f7f4ec"/><g font-family="sans-serif" font-size="14"><text x="16" y="21" fill="#1b3a2e">${escape(unit)}</text>${bars}<text x="16" y="${height - 16}" fill="#40514a">${escape(citation)}</text></g></svg>`
  return publishImage(vault, Buffer.from(svg), 'svg')
}
