import { searchVault } from './modules/vault-search.js'
/** Same-origin routes and vault operations for the Grove panel. */
import { constants } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { captureInspiration, findInspirations, readInspiration } from './modules/inspirations.js'
import { inspirationHistory, discoverInspirations } from './modules/inspiration-discovery.js'
import { startResearch, listResearch, saveResearch } from './modules/research.js'
import { importSource, parseSource, saveEvidence, openSource } from './modules/evidence.js'
import { listReports, confirmReport, readReport, draftFromFinding } from './modules/reports.js'
import { parseModelSettings, readModelSettings, selectModel, testModel, verifyModelSettings } from './modules/model-settings.js'
import { runResearchModel } from './modules/model-research.js'
import { listKnowledge, readKnowledge, knowledgeDetail, saveKnowledge, keepReportAsKnowledge } from './modules/knowledge.js'
import { browseKnowledge, scheduleKnowledge } from './modules/knowledge-index.js'
import { workDrafts } from './modules/work-drafts.js'
import { readWorkImage, workImageLimit } from './adapters/storage/obsidian/work-images.js'
import { listWorks, readWork, saveWork } from './modules/works.js'
import { stagedResearch } from './modules/deep-research.js'
import { researchRuns, isUnsupportedDraft } from './modules/research-runs.js'
import { researchRunStore } from './adapters/storage/obsidian/research-runs.js'
import { Vault } from './vault.js'

export const routes = {
  status: '/api/grove/status',
  config: '/api/grove/config',
  connection: '/api/grove/connection',
  capture: '/api/grove/capture',
  model: '/api/grove/model',
  modelUpdate: '/api/grove/model/settings',
  findings: '/api/grove/findings',
  knowledge: '/api/grove/knowledge',
  works: '/api/grove/works',
  workImage: '/api/grove/work-image',
  reports: '/api/grove/reports',
  parsers: '/api/grove/parsers',
  parsersUpdate: '/api/grove/parsers/settings',
  sources: '/api/grove/sources',
  research: '/api/grove/research',
  researchUpdate: '/api/grove/research/save',
  deepResearch: '/api/grove/deep-research',
  inspirations: '/api/grove/inspirations',
}

/** Largest body the panel may post, matching the proposal limit. */
const maxBody = 128 * 1024
// Includes Base64 source uploads and JSON escaping overhead.
const maxJsonBytes = 1024 * 1024

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
    case 'model-settings':
    case 'model-endpoint':
    case 'invalid-body':
      return 400
    case 'not-found':
    case 'ENOENT':
      return 404
    case 'model-dsh-auth':
    case 'model-dsh-route':
      return 409
    case 'model-timeout':
      return 504
    case 'model-auth':
    case 'model-not-found':
    case 'model-rate-limit':
    case 'research-no-evidence':
    case 'research-attachment':
    case 'research-search-links-unreadable':
    case 'research-search':
    case 'model-network':
    case 'model-rejected':
    case 'model-unavailable':
    case 'model-response':
      return 502
    case 'research-search-links-unavailable':
    case 'research-search-disabled':
    case 'research-search-key':
    case 'research-running':
    case 'model-research-key':
    case 'model-key':
    case 'model-disabled':
    case 'work-conflict':
    case 'not-configured':
      return 409
    case 'unsupported-media':
      return 415
    case 'request-too-large':
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

async function checkConnection(value) {
  const candidate = await inspectVault(value)
  const grove = await new Vault(candidate.path).folder().catch(error => {
    if (error.code === 'ENOENT') return candidate.path
    throw coded('invalid-path', 'The Grove directory is not usable')
  })
  await access(grove, constants.R_OK | constants.W_OK | constants.X_OK).catch(() => {
    throw coded('invalid-path', 'The Grove directory must be readable and writable')
  })
  return candidate
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
  const note = await captureInspiration(vault, { body, title: input?.title })
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

async function readJson(request, limit = maxJsonBytes) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  const jsonType = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/.test(contentType)
  if (Number(request.headers.get('content-length')) > limit) {
    throw coded('request-too-large', 'The request is too large')
  }
  if (!request.body) throw coded('invalid-body', 'Expected a JSON body')
  const reader = request.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) throw coded('request-too-large', 'The request is too large')
      if (jsonType) chunks.push(chunk.value)
    }
    if (!jsonType) throw coded('unsupported-media', 'Expected application/json')
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } catch (error) {
    if (error.code === 'request-too-large' || error.code === 'unsupported-media') throw error
    throw coded('invalid-body', 'Expected a JSON body')
  } finally {
    reader.releaseLock()
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
  const dsh = options.dshModels
  const modelFor = (settings, role, config) => settings.source === 'dsh' ? dsh?.model(settings) : options.model?.(settings, role, config)
  const runs = researchRuns({
    workflow: options.researchWorkflow ?? stagedResearch,
    parseAttachment: async attachment => {
      const { name, original } = attachment ?? {}
      if (typeof name !== 'string' || !name.trim() || name.length > 256 || typeof original !== 'string' ||
          original.length > 670000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(original)) {
        throw coded('invalid-body', 'Choose a Markdown or PDF file')
      }
      try {
        return await parseSource(options.parsers ?? new Map(), { name, original, bytes: Buffer.from(original, 'base64') })
      } catch (error) {
        throw coded('research-attachment', error.message)
      }
    },
    async context({ links } = {}) {
      const settings = selectModel(options.modelConfig, 'research', dsh)
      if (!settings) throw coded('model-disabled', 'Configure and enable a research model')
      const model = modelFor(settings, 'research', options.modelConfig)
      if (!model) throw coded('model-key', 'Set GROVE_MODEL_KEY for the host')
      if (!['plan', 'review'].every(step => typeof model[step] === 'function')) {
        throw coded('model-disabled', 'The configured model adapter does not support deep research')
      }
      const config = options.modelConfig
      const reportSettings = config?.reportWriting && selectModel(config, 'report', dsh)
      const web = options.dshWeb
      const hostSearch = !links?.length && await web?.searchAvailable()
      return { model, hostSearch, writerName: reportSettings?.model ?? reportSettings?.name ?? model.name,
        write(input, options) {
          const writer = reportSettings ? modelFor(reportSettings, 'report', config) : model
          if (typeof writer?.write !== 'function') throw coded('model-disabled', 'The report writing model is unavailable')
          return writer.write(input, options)
        },
        search: links?.length ? null : hostSearch ? web.search : options.researchSearch?.(),
        readPage: web?.readPage ?? options.readResearchPage }
    },
  })
  ctx.inject(['connection'], (scoped) => {
    const connection = scoped.get('connection')
    if (!connection?.fetch || typeof connection.fetch.register !== 'function') return
    if (options.organizeKnowledge) scoped.effect(() => scheduleKnowledge(options.current), 'grove: daily knowledge organization')
    const route = (path, methods, fetch) => {
      scoped.effect(
        () => connection.fetch.register({ path, methods, requestBody: methods.includes('POST') ? 'streaming' : 'buffered', fetch }),
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
    route(routes.inspirations, ['POST'], async request => {
      try {
        const input = await readJson(request)
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const vault = new Vault(path)
        if (input?.id !== undefined) {
          if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id) ||
            (input.version !== undefined && (!Number.isSafeInteger(input.version) || input.version < 1))) {
            throw coded('invalid-body', 'Invalid inspiration reference')
          }
          const note = await readInspiration(vault, input.id, input.version)
          if (input.action === 'discover') {
            const settings = selectModel(options.modelConfig, 'default', dsh)
            if (!settings || options.modelConfig?.inspirationLinks !== true) return json({ enabled: false, matches: [] })
            const provider = modelFor(settings, 'default', options.modelConfig)
            if (!provider) throw coded('model-key', 'Set GROVE_MODEL_KEY for the host')
            return json({ enabled: true, matches: await discoverInspirations(vault, provider, note) })
          }
          if (input.action === 'detail') return json({ ...note, studies: await inspirationHistory(vault, note.meta.id) })
          return json(note)
        }
        const query = typeof input?.query === 'string' ? input.query.trim() : ''
        if (input?.action === 'search') return json({ notes: await searchVault(vault, query) })
        return json({ notes: (await findInspirations(vault, query)).slice(0, 50) })
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.workImage, ['GET'], async request => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const name = new URL(request.url).searchParams.get('file')
        const image = await readWorkImage(new Vault(path), name)
        return new Response(image.bytes, { headers: {
          'content-type': image.mime, 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store',
        } })
      } catch (error) {
        return failure(error)
      }
    })
    for (const [assetRoute, list, read, save] of [
      [routes.knowledge, listKnowledge, readKnowledge, saveKnowledge],
      [routes.works, listWorks, readWork, saveWork],
    ]) {
      route(assetRoute, ['POST'], async request => {
        try {
          const { path } = options.current()
          if (!path) throw coded('not-configured', 'Grove has no vault yet')
          const store = new Vault(path)
          const input = await readJson(request, assetRoute === routes.works ? Math.ceil(workImageLimit * 4 / 3) + 4096 : maxJsonBytes)
          if (assetRoute === routes.works && typeof input?.action === 'string' && input.action.startsWith('draft-')) {
            return json(await workDrafts(store, input, () => {
              const config = options.modelConfig
              const settings = selectModel(config, 'default', dsh)
              if (!settings) throw coded('model-disabled', 'Configure and enable a writing model')
              const model = modelFor(settings, 'default', config)
              if (typeof model?.compose !== 'function') throw coded('model-disabled', 'The selected model cannot draft articles')
              return model
            }))
          }
          if (assetRoute === routes.knowledge && input?.action === 'keep-report') return json(await keepReportAsKnowledge(store, input.report))
          if (assetRoute === routes.knowledge && input?.action === 'detail') return json(await knowledgeDetail(store, input.id, input.version))
          if (assetRoute === routes.knowledge && input?.action === 'browse') {
            return json({ items: await browseKnowledge(store, await list(store)) })
          }
          if (input?.action === 'list') return json({ items: await list(store, typeof input.query === 'string' ? input.query : '') })
          if (input?.action === 'read') return json(await read(store, input.id, input.version))
          if (input?.action === 'save' && typeof input.body === 'string' && input.body.trim()) return json(await save(store, input))
          throw coded('invalid-body', 'Choose an action and supply a body when saving')
        } catch (error) {
          return failure(error)
        }
      })
    }
    route(routes.model, ['GET'], async request => {
      const config = readModelSettings(options.modelConfig, modelFor, dsh)
      config.hostSearch = await options.dshWeb?.searchAvailable() ?? false
      if (new URL(request.url).searchParams.has('catalog')) config.catalog = await dsh?.catalog() ?? []
      return json(config)
    })
    route(routes.modelUpdate, ['POST'], async request => {
      try {
        const input = await readJson(request)
        const config = parseModelSettings(input, options.modelConfig, dsh)
        if (input?.test === true) {
          await testModel(config, ['research', 'report'].includes(input.role) ? input.role : 'default', modelFor, dsh)
          return json({ ok: true })
        }
        const model = await verifyModelSettings(config, options.modelConfig, input?.verify === true, modelFor, dsh)
        const editor = ctx.get?.('configEditor')
        const entry = ctx.fiber?.entry
        if (!entry || typeof editor?.edit !== 'function') throw coded('save-unavailable', 'This profile cannot save model settings')
        setTimeout(() => {
          editor.edit(entry, current => ({ ...current, model }))
            .catch(error => console.warn(`[grove] could not save model settings: ${error.message}`))
        }, delay)
        return json({ pending: true, changeId: model.changeId })
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.deepResearch, ['POST'], async request => {
      try {
        const input = await readJson(request)
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const store = new Vault(path)
        const jobs = researchRunStore(store)
        const isId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
        const refs = [input?.idea, input?.knowledge].filter(ref => ref !== undefined)
        if (refs.length + Number(input?.topic !== undefined) > 1 ||
          refs.some(ref => !isId(ref?.id) || !Number.isSafeInteger(ref.version) || ref.version < 1) ||
          (input?.topic !== undefined && !isId(input.topic))) {
          throw coded('invalid-body', 'Invalid research scope')
        }
        if (input?.action === 'list') return json({ runs: await runs.list(store, jobs, input) })
        if (input?.action === 'start') return json(await runs.start(store, jobs, input), 202)
        if (input?.action === 'retry' && isId(input.id)) return json(await runs.retry(store, jobs, input.id), 202)
        throw coded('invalid-body', 'Choose a research action')
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.findings, ['POST'], async request => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const store = new Vault(path)
        const input = await readJson(request)
        const findings = (await store.list()).filter(({ meta }) => meta.type === 'finding' &&
          meta.links?.some(link => link.kind === 'related' && link.id === input?.id))
        if (input?.action === 'list') return json({ findings })
        const question = typeof input?.question === 'string' ? input.question.trim() : ''
        if (!question || question.length > 1000 || !Array.isArray(input.materials) || input.materials.length > 20 ||
          !Number.isSafeInteger(input.version) || input.version < 1) throw coded('invalid-body', 'Enter a research question and select evidence')
        const settings = selectModel(options.modelConfig, 'default', dsh)
        if (!settings) throw coded('model-disabled', 'Configure and enable a model first')
        const provider = modelFor(settings, 'default', options.modelConfig)
        if (!provider) throw coded('model-key', 'Set GROVE_MODEL_KEY for the host')
        return json(await runResearchModel(store, provider, { ...input, question, history: input.includeHistory === true ? findings.map(({ meta, body }) => ({ question: meta.title, text: body })).slice(-8) : [] }))
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.parsers, ['GET'], async () => json({ pdf: options.pdfEnabled !== false }))
    route(routes.parsersUpdate, ['POST'], async request => {
      try {
        const input = await readJson(request)
        if (typeof input?.pdf !== 'boolean') throw coded('invalid-body', 'Choose whether PDF parsing is enabled')
        const editor = ctx.get?.('configEditor')
        const entry = ctx.fiber?.entry
        if (!entry || typeof editor?.edit !== 'function') throw coded('save-unavailable', 'This profile cannot save parser settings')
        setTimeout(() => {
          editor.edit(entry, current => ({ ...current, parsers: { ...current.parsers, pdf: input.pdf } }))
            .catch(error => console.warn(`[grove] could not save parser settings: ${error.message}`))
        }, delay)
        return json({ pending: true })
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.reports, ['POST'], async request => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const store = new Vault(path)
        const input = await readJson(request)
        if (input?.action === 'catalog') {
          return json({ reports: (await listReports(store, input.research)).map(({ meta }) => meta) })
        }
        if (input?.action === 'list') {
          const notes = await store.list()
          const sources = new Set(notes.filter(({ meta }) => meta.type === 'source' &&
            meta.links?.some(link => link.kind === 'related' && link.id === input.research)).map(({ meta }) => meta.id))
          const evidence = notes.filter(({ meta }) => meta.type === 'evidence' &&
            meta.links?.some(link => link.kind === 'derived' && sources.has(link.id))).map(({ meta }) => meta)
          return json({ reports: await listReports(store, input.research), evidence })
        }
        if (input?.action === 'draft' && Number.isSafeInteger(input.version) && input.version > 0) {
          return json(await draftFromFinding(store, input.research, input.id, input.version))
        }
        if (input?.action === 'read') return json(await readReport(store, input.id, input.version))
        if (input?.action === 'confirm' && typeof input.body === 'string' && input.body.trim() &&
          (input.evidence === undefined || Array.isArray(input.evidence))) {
          if (input.id) {
            const job = await researchRunStore(store).read(input.id)
              .catch(error => { if (error.code !== 'ENOENT') throw error })
            if (job?.verified && isUnsupportedDraft(job, await store.get(input.id, input.version))) {
              throw coded('research-no-evidence', 'No citable evidence was found')
            }
          }
          return json(await confirmReport(store, input))
        }
        throw coded('invalid-body', 'Choose a report action and nonempty report body')
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.sources, ['POST'], async request => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const vault = new Vault(path)
        const input = await readJson(request)
        if (input?.action === 'import') {
          const name = input.name
          const original = input.original
          if (typeof name !== 'string' || !name.trim() || name.length > 256 ||
            typeof original !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(original)) {
            throw coded('invalid-body', 'Choose a Markdown or PDF file')
          }
          if (original.length > 700000) throw coded('too-large', 'File exceeds the import limit')
          return json(await importSource(vault, options.parsers ?? new Map(), {
            name, original, research: input.research, bytes: Buffer.from(original, 'base64'),
          }))
        }
        if (input?.action === 'excerpt') {
          return json(await saveEvidence(vault, { id: input.id, version: input.version }, input.index))
        }
        if (input?.action === 'open' && Number.isSafeInteger(input.version) && input.version > 0) {
          return json(await openSource(vault, input.id, input.version))
        }
        if (input?.action === 'list') {
          const notes = await vault.list()
          return json({ sources: notes.filter(({ meta }) => meta.type === 'source' &&
            meta.links?.some(link => link.kind === 'related' && link.id === input.research)).map(({ meta }) => meta) })
        }
        throw coded('invalid-body', 'Choose a source action')
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.research, ['GET'], async () => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const store = new Vault(path)
        const studies = await listResearch(store)
        const activity = new Map()
        for (const run of await researchRunStore(store).list()) {
          if (run.topic && run.created > (activity.get(run.topic) ?? '')) activity.set(run.topic, run.created)
        }
        const lastActivity = ({ meta }) => [meta.modified ?? meta.created, activity.get(meta.id) ?? ''].sort().at(-1)
        return json({ studies: studies.map(study => ({ ...study, activity: lastActivity(study) }))
          .sort((a, b) => b.activity.localeCompare(a.activity)) })
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.researchUpdate, ['POST'], async request => {
      try {
        const { path } = options.current()
        if (!path) throw coded('not-configured', 'Grove has no vault yet')
        const vault = new Vault(path)
        const input = await readJson(request)
        if (!input || (input.body !== undefined && typeof input.body !== 'string')) {
          throw coded('invalid-body', 'Research notes must be text')
        }
        const body = input.body?.trim() ?? ''
        if (input.id !== undefined) {
          if (typeof input.body !== 'string' || typeof input.id !== 'string' || !Number.isSafeInteger(input.version) || input.version < 1) {
            throw coded('invalid-body', 'Invalid research version')
          }
          return json(await saveResearch(vault, input.id, input.version, body))
        }
        const question = typeof input.question === 'string' ? input.question.trim() : ''
        if (!question || question.length > 300) throw coded('invalid-body', 'Enter a research question up to 300 characters')
        const origins = []
        if (input.origin) {
          const { meta } = await readKnowledge(vault, input.origin.id, input.origin.version)
          origins.push({ id: meta.id, version: meta.version })
        }
        if (input.inspirations !== undefined) {
          if (!Array.isArray(input.inspirations) || input.inspirations.length > 4) {
            throw coded('invalid-body', 'Choose up to four inspirations')
          }
          for (const ref of input.inspirations) {
            if (typeof ref?.id !== 'string' || !/^[a-f0-9-]{36}$/.test(ref.id) || !Number.isSafeInteger(ref.version) || ref.version < 1 ||
              (ref.excerpt !== undefined && (typeof ref.excerpt !== 'string' || !ref.excerpt.trim()))) {
              throw coded('invalid-body', 'Choose an exact inspiration version')
            }
            const note = await readInspiration(vault, ref.id, ref.version)
            if (ref.excerpt !== undefined && !note.body.includes(ref.excerpt)) {
              throw coded('invalid-body', 'Choose an excerpt from the referenced inspiration')
            }
            if (origins.some(origin => origin.id === ref.id)) continue
            origins.push({ id: note.meta.id, version: note.meta.version, excerpt: ref.excerpt ?? note.body.slice(0, 1600) })
          }
        }
        return json(await startResearch(vault, question, body, origins))
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.connection, ['POST'], async request => {
      try {
        return json(await checkConnection((await readJson(request))?.path))
      } catch (error) {
        return failure(error)
      }
    })
    route(routes.config, ['POST'], async request => {
      let path
      try {
        path = (await checkConnection((await readJson(request))?.path)).path
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
