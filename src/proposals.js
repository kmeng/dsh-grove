import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { types } from './vault.js'

export const roles = {
  thinking: 'Clarify the question, expose assumptions, and offer alternative explanations.',
  knowledge: 'Explain concepts, compare examples, and distinguish the user’s understanding from references.',
  research: 'Identify research questions, methods, evidence gaps, and traceable sources.',
  critical: 'Seek counterexamples and alternative explanations. Separate evidence from speculation.',
  creation: 'Help structure the user’s argument and preserve source references. Produce a draft only on request.',
}

async function draftFile(vault, id, write = false) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw new Error('Invalid proposal ID')
  const directory = await vault.folder(write)
  const flags = write ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
    : constants.O_RDONLY | constants.O_NONBLOCK
  return open(join(directory, `.${id}.proposal.json`), flags | constants.O_NOFOLLOW, 0o600)
}

export async function propose(vault, input) {
  const { type, title, body, origin } = input
  if (!types.includes(type) || ['research', 'evidence', 'source', 'report', 'finding'].includes(type)) throw new Error('Unsupported proposal type')
  if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 128 * 1024) throw new Error('Invalid proposal body')
  if (title && (typeof title !== 'string' || title.length > 300)) throw new Error('Invalid proposal title')
  if (origin && (typeof origin !== 'string' || origin.length > 2000)) throw new Error('Invalid proposal origin')
  const id = randomUUID()
  const handle = await draftFile(vault, id, true)
  try {
    await handle.writeFile(JSON.stringify({ type, title, body, origin }))
  } finally {
    await handle.close()
  }
  return id
}

export async function preview(vault, id) {
  const handle = await draftFile(vault, id)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Invalid proposal file')
    return JSON.parse(await handle.readFile('utf8'))
  } finally {
    await handle.close()
  }
}

export async function accept(vault, id, proposal) {
  const note = await vault.create({ ...proposal, origin: proposal.origin ? `AI draft confirmed by user · ${proposal.origin}` : 'AI draft confirmed by user' }, id)
  await discard(vault, id).catch(error => { if (error.code !== 'ENOENT') throw error })
  return note
}

export async function discard(vault, id) {
  await preview(vault, id)
  await unlink(join(await vault.folder(), `.${id}.proposal.json`))
}
