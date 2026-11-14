/** Same-origin routes and vault operations for the Grove panel. */
import { constants } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { Vault } from './vault.js'

export const routes = {
  status: '/api/grove/status',
  config: '/api/grove/config',
  capture: '/api/grove/capture',
}

/** Largest body the panel may post, matching the proposal limit. */
const maxBody = 128 * 1024

function coded(code, message) {
  return Object.assign(new Error(message), { code })
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function statusOf(error) {
  switch (error.code) {
    case 'invalid-path':
    case 'not-directory':
    case 'symlink':
    case 'invalid-body':
      return 400
    case 'not-configured':
      return 409
    case 'too-large':
      return 413
    default:
      return 500
  }
}

function failure(error) {
  const code = typeof error?.code === 'string' ? error.code : 'internal'
  return json({ error: { code, message: error instanceof Error ? error.message : String(error) } }, statusOf({ code }))
}

/** Validate a folder a person chose for the vault. Rejects relative paths and symlinked directories. */
export async function inspectVault(value) {
  if (typeof value !== 'string' || value.trim() === '') throw coded('invalid-path', 'Choose a folder')
  if (!isAbsolute(value.trim())) throw coded('invalid-path', 'The vault path must be absolute')
  const path = resolve(value.trim())
  const info = await stat(path).catch(() => null)
  if (info === null || !info.isDirectory()) throw coded('not-directory', 'The vault path is not a directory')
  if (await realpath(path) !== path) throw coded('symlink', 'The vault path must be a real directory, not a symlink')
  const looksLikeVault = await stat(join(path, '.obsidian')).then(entry => entry.isDirectory(), () => false)
  return { path, looksLikeVault }
}

/** Metadata the panel needs to choose between the cold-start and overview states. Never returns note bodies. */
export async function vaultStatus(path, source) {
  const empty = {
    configured: false, source: null, vault: null, usable: false, writable: false,
    looksLikeVault: false, counts: { total: 0 }, recent: [],
  }
  if (!path) return empty
  let usable = false
  try {
    usable = (await stat(path)).isDirectory() && await realpath(path) === path
  } catch {
    usable = false
  }
  if (!usable) return { ...empty, configured: true, source, vault: path }
  const writable = await access(path, constants.W_OK).then(() => true, () => false)
  const looksLikeVault = await stat(join(path, '.obsidian')).then(entry => entry.isDirectory(), () => false)
  const vault = new Vault(path)
  const inventory = await vault.inventory().catch(() => new Map())
  const latest = [...inventory].map(([id, versions]) => [id, Math.max(...versions)])
  const notes = []
  for (const [id, version] of latest.slice(0, 300)) {
    try {
      notes.push((await vault.get(id, version)).meta)
    } catch {
      // A note that no longer parses is skipped; the overview still opens.
    }
  }
  const counts = { total: latest.length }
  for (const meta of notes) counts[meta.type] = (counts[meta.type] ?? 0) + 1
  const recent = notes
    .sort((a, b) => String(b.modified ?? b.created ?? '').localeCompare(String(a.modified ?? a.created ?? '')))
    .slice(0, 6)
    .map(({ id, title, type, version, status, modified, created }) => ({
      id, title, type, version, ...(status === undefined ? {} : { status }), at: modified ?? created ?? null,
    }))
  return {
    configured: true, source, vault: path, usable, writable, looksLikeVault,
    counts, recent, sampled: latest.length > notes.length,
  }
}

/** Create the first note from the panel. Only inspirations: research and evidence stay in the terminal. */
export async function capture(vaultPath, input) {
  if (!vaultPath) throw coded('not-configured', 'Grove has no vault yet')
  const body = input?.body
  if (typeof body !== 'string' || body.trim() === '') throw coded('invalid-body', 'Write something first')
  if (Buffer.byteLength(body) > maxBody) throw coded('too-large', 'The note is too large')
  const vault = new Vault(vaultPath)
  const note = await vault.create({ type: 'inspiration', body, title: input?.title })
  const folder = await vault.folder()
  return {
    id: note.meta.id, type: note.meta.type, title: note.meta.title, version: 1,
    path: join(folder, `${note.meta.id}.v1.md`),
  }
}

/** Persist the chosen vault into this plugin row's configuration. */
export function saveVault(ctx, path) {
  const entry = ctx.fiber?.entry
  const editor = ctx.get?.('configEditor')
  if (!entry || !editor || typeof editor.edit !== 'function') {
    return Promise.reject(coded('save-unavailable', 'This profile cannot save plugin configuration'))
  }
  return editor.edit(entry, current => ({ ...current, vault: path }))
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw coded('invalid-body', 'Expected a JSON body')
  }
}

/**
 * Register the panel's same-origin routes. They stay available before a vault is configured,
 * so the page can run its cold start.
 * @param ctx - the plugin context.
 * @param options - current vault path/source getter.
 */
export function registerRoutes(ctx, options) {
  const delay = Number.isFinite(options.saveDelay) ? options.saveDelay : 100
  ctx.inject(['connection'], (scoped) => {
    const connection = scoped.get('connection')
    if (!connection?.fetch || typeof connection.fetch.register !== 'function') return
    const route = (path, methods, fetch) => {
      scoped.effect(
        () => connection.fetch.register({ path, methods, requestBody: 'buffered', fetch }),
        `grove: ${path}`,
      )
    }
    route(routes.status, ['GET'], async () => {
      const { path, source } = options.current()
      return json(await vaultStatus(path, source))
    })
    route(routes.capture, ['POST'], async request => {
      try {
        const body = await readJson(request)
        return json(await capture(options.current().path, body))
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.config, ['POST'], async request => {
      let path
      try {
        path = (await inspectVault((await readJson(request))?.path)).path
      } catch (error) {
        return failure(error)
      }
      // Answer before the configuration reload replaces this plugin instance, otherwise the
      // response can be cut halfway. The page polls status until the new vault is live.
      setTimeout(() => {
        saveVault(ctx, path).catch(error => {
          console.warn(`[grove] could not save the vault path: ${error.message}`)
        })
      }, delay)
      return json({ ok: true, pending: true, vault: path })
    })
  })
}
