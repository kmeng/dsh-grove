import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, realpath, mkdir, open, link, unlink, readdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { parse, stringify } from 'yaml'

export const types = ['inspiration', 'question', 'concept', 'theory', 'claim', 'evidence', 'method', 'output', 'exploration', 'research']
export const stages = ['question', 'framework', 'evidence', 'analysis', 'judgment', 'validation', 'expression', 'review']
const relations = ['related', 'derived', 'supports', 'refutes', 'qualifies']
const validId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const filename = /^([a-f0-9-]{36})\.v([1-9][0-9]*)\.md$/
const maxBytes = 1024 * 1024

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

async function directory(path, create) {
  if (create) await mkdir(path).catch(error => { if (error.code !== 'EEXIST') throw error })
  const stat = await lstat(path)
  if (!stat.isDirectory() || await realpath(path) !== path) throw new Error('Grove requires a real directory')
  return path
}

function encode(meta, body) {
  const links = [
    ...(meta.question ? [`[[${meta.question}.v${meta.questionVersion ?? 1}]]`] : []),
    ...(meta.links ?? []).map(item => `${item.kind} [[${item.id}.v${item.version}]]`),
  ]
  return `---\n${stringify(meta, { lineWidth: 0 })}---\n\n${body}\n${links.length ? `\n<!-- grove-links -->\n${links.join('\n')}\n` : ''}`
}

async function readNote(path, id, version) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('Invalid Grove note file')
    const raw = await handle.readFile('utf8')
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
    if (!match) throw new Error('Invalid Grove Markdown frontmatter')
    const meta = parse(match[1], { maxAliasCount: 0 })
    if (!meta || meta.id !== id || meta.version !== version || !types.includes(meta.type)) {
      throw new Error('Grove note metadata does not match its filename')
    }
    return { meta, body: match[2].split('\n<!-- grove-links -->\n')[0].trim() }
  } finally {
    await handle.close()
  }
}

async function publish(path, target, content) {
  if (Buffer.byteLength(content) > maxBytes) throw new Error('Grove note exceeds the size limit')
  const temp = join(path, `.${randomUUID()}.tmp`)
  const handle = await open(temp, 'wx', 0o600)
  try {
    try {
      await handle.writeFile(content)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await link(temp, target)
  } finally {
    await unlink(temp)
  }
}

export class Vault {
  constructor(path) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Set GROVE_VAULT to an absolute vault path')
    this.path = path
  }

  async folder(create = false) {
    return directory(join(await realpath(this.path), 'Grove'), create)
  }

  async inventory() {
    const path = await this.folder().catch(error => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    const entries = new Map()
    for (const name of path ? await readdir(path) : []) {
      const match = filename.exec(name)
      if (!match || !validId.test(match[1])) continue
      const version = Number(match[2])
      if (!Number.isSafeInteger(version)) continue
      const versions = entries.get(match[1]) ?? []
      versions.push(version)
      entries.set(match[1], versions)
    }
    return entries
  }

  async get(id, version) {
    if (typeof id !== 'string' || !validId.test(id)) throw new Error('Invalid Grove ID')
    const selected = version ?? Math.max(...((await this.inventory()).get(id) ?? []))
    if (!Number.isSafeInteger(selected) || selected < 1) throw new Error('Grove note not found')
    return readNote(join(await this.folder(), `${id}.v${selected}.md`), id, selected)
  }

  async list(query = '') {
    const entries = await this.inventory()
    const notes = await Promise.all([...entries].map(([id, versions]) => this.get(id, Math.max(...versions))))
    const needle = query.toLowerCase()
    return notes.filter(({meta, body}) => `${meta.title}\n${meta.type}\n${body}`.toLowerCase().includes(needle))
  }

  async create(input, id = randomUUID()) {
    if (!validId.test(id)) throw new Error('Invalid Grove ID')
    const type = input.type
    if (!types.includes(type)) throw new Error('Unknown asset type')
    const body = required(input.body, 'body')
    const meta = { grove: 1, id, version: 1, type, title: input.title?.trim() || body.split('\n')[0].slice(0, 100), created: new Date().toISOString() }
    if (input.origin) meta.origin = required(input.origin, 'origin')
    if (type === 'question' || type === 'research') meta.status = 'open'
    if (type === 'research') {
      const question = await this.get(input.question)
      if (question.meta.type !== 'question') throw new Error('Research requires a question')
      meta.question = question.meta.id
      meta.questionVersion = question.meta.version
      meta.stage = stages[0]
    }
    if (type === 'evidence') {
      meta.source = required(input.source, 'source')
      meta.locator = required(input.locator, 'locator')
    }
    const path = await this.folder(true)
    await publish(path, join(path, `${id}.v1.md`), encode(meta, body))
    return { meta, body }
  }

  async update(id, expected, change) {
    const note = await this.get(id)
    if (note.meta.version !== expected) throw new Error('Version conflict; read the latest note and retry')
    const { meta } = note
    let body = note.body
    if (change.body !== undefined) {
      body = required(change.body, 'body')
      if (meta.type === 'claim' && body !== note.body) {
        meta.links = (meta.links ?? []).filter(edge => !['supports', 'refutes', 'qualifies'].includes(edge.kind))
      }
    }
    if (change.status !== undefined) {
      const allowed = meta.type === 'question' || meta.type === 'research'
        ? ['open', 'paused', 'closed', 'archived'] : ['active', 'archived']
      if (!allowed.includes(change.status)) throw new Error('Invalid status for this asset')
      meta.status = change.status
    }
    if (change.stage !== undefined) {
      if (meta.type !== 'research' || !stages.includes(change.stage)) throw new Error('Invalid research stage')
      meta.stage = change.stage
    }
    if (change.link) {
      const { kind, id: targetId, version } = change.link
      if (!relations.includes(kind)) throw new Error('Invalid relationship')
      const target = await this.get(targetId, version)
      if (targetId === id) throw new Error('An asset cannot link to itself')
      if (['supports', 'refutes', 'qualifies'].includes(kind) && (meta.type !== 'claim' || target.meta.type !== 'evidence')) {
        throw new Error('Evidence relations must run from a claim to evidence')
      }
      const edge = { kind, id: targetId, version: target.meta.version }
      if (!(meta.links ?? []).some(link => link.kind === kind && link.id === targetId && link.version === edge.version)) {
        meta.links = [...(meta.links ?? []), edge]
      }
    }
    meta.version++
    meta.modified = new Date().toISOString()
    const path = await this.folder()
    try {
      await publish(path, join(path, `${id}.v${meta.version}.md`), encode(meta, body))
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error('Version conflict; read the latest note and retry')
      throw error
    }
    return { meta, body }
  }
}
