import { createHash, randomUUID } from 'node:crypto'
import { renderResearchReport } from './deep-research.js'
import { saveEvidence, saveSource } from './evidence.js'
import { readKnowledge } from './knowledge.js'

function problem(code, message) {
  return Object.assign(new Error(message), { code })
}

async function createOnce(store, id, input) {
  try {
    return await store.create(input, id)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const existing = await store.get(id)
    if (existing.meta.type !== input.type) throw error
    return existing
  }
}

function passageId(ref) {
  const hex = createHash('sha256').update(JSON.stringify(ref)).digest('hex').slice(0, 32)
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

function searchTerms(queries) {
  const text = queries.join(' ').toLowerCase()
  const latin = text.match(/[\p{Script=Latin}\p{N}]{3,}/gu) ?? []
  const han = [...text.matchAll(/(?=(\p{Script=Han}{2}))/gu)].map(match => match[1])
  return [...new Set(latin.concat(han))]
}

async function localSources(store, topic, queries, attachment) {
  const notes = await store.list()
  const documents = notes.filter(note => note.meta.type === 'source' &&
    note.meta.links?.some(ref => ref.kind === 'related' && ref.id === topic))
  const terms = searchTerms(queries)
  const passages = documents.flatMap(({ meta, body }) => JSON.parse(body).blocks.map((block, index) => {
    const content = (meta.title + ' ' + block.text).toLowerCase()
    const score = terms.filter(term => content.includes(term)).length + (meta.id === attachment?.id ? 1 : 0)
    return { meta, block, index, score }
  })).filter(item => item.score).sort((a, b) => b.score - a.score)

  return Promise.all(passages.slice(0, 8).map(async ({ meta, block, index }) => {
    const ref = { id: meta.id, version: meta.version, index }
    const id = passageId(ref)
    let entry
    try {
      entry = await saveEvidence(store, ref, index, id)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      entry = await store.get(id, 1)
    }
    return { id, title: meta.title + ' · ' + block.locator, text: block.text.slice(0, 4000),
      origin: meta.id, reference: { id, version: entry.meta.version } }
  }))
}

function currentDay(timeZone) {
  try {
    return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeZone: typeof timeZone === 'string' ? timeZone : 'UTC' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function publicLinks(...texts) {
  const links = new Set()
  for (const text of texts) {
    if (typeof text !== 'string') continue
    for (const match of text.slice(0, 16_000).matchAll(/https?:\/\/[^\s<>"`，。；？！、]+/gi)) {
      const value = match[0].replace(/[.,;!?)}\]]+$/, '')
      const url = value.length <= 2048 && URL.parse(value)
      if (!url || url.username || url.password) continue
      url.hash = ''
      links.add(url.href)
      if (links.size >= 4) return [...links]
    }
  }
  return [...links]
}

async function readPages(links, readPage) {
  const results = await Promise.allSettled(links.map(url => readPage(url)))
  const usable = results.flatMap(result => result.status === 'fulfilled' && result.value?.text?.trim() ? [result.value] : [])
  if (!usable.length) throw problem('research-search-links-unreadable', 'Could not read the supplied public pages')
  return usable
}

async function collect(store, run, queries, providers, scope) {
  const web = scope === 'local' || run.localOnly ? [] : run.links?.length
    ? await readPages(run.links, providers.readPage) : await Promise.all(queries.map(async query => providers.search(query))).catch(error => {
    if (error?.code === 'research-search') throw error
    throw problem('research-search', 'Could not retrieve web sources')
  })
  const local = scope === 'web' ? [] : await localSources(store, run.topic, queries, run.attachment)
  const found = new Map(local.map(source => [source.id, source]))
  for (const candidate of web.flat()) {
    if (found.size >= 16) break
    const url = typeof candidate.url === 'string' && URL.parse(candidate.url)
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      typeof candidate.text !== 'string' || !candidate.text.trim()) continue
    url.hash = ''
    if (found.has(url.href)) continue
    found.set(url.href, { id: url.href, url: url.href, origin: url.hostname.replace(/^www\./, ''),
      title: String(candidate.title || url.hostname).slice(0, 200), text: candidate.text.slice(0, 5000),
      ...(candidate.publishedAt ? { publishedAt: String(candidate.publishedAt).slice(0, 80) } : {}) })
  }
  return [...found.values()]
}

export function hasCitableEvidence(verified) {
  const available = new Set(verified?.sources?.map(source => source.id))
  return verified?.claims?.some(claim => claim.sources?.some(id => available.has(id))) ?? false
}

export function isUnsupportedDraft(run, report) {
  return run?.requireEvidence === undefined && !!run?.verified && report?.meta.review === 'draft' && run.report?.id === report.meta.id &&
    !hasCitableEvidence(run.verified)
}

function progress(run, running = false) {
  const { id, scope, topic, direction, status, created, report, error, plan, collected, review, verified, written } = run
  return { id, scope, topic, direction, created, report, error, attachment: run.attachment,
    status: status === 'running' && !running ? 'interrupted' : status,
    plan,
    collected: collected?.map(({ title }) => title),
    sourceLinks: collected?.map(source => source.url ?? null),
    review: review && { followups: review.followups },
    verified: verified?.claims.map(({ text, status }) => ({ text, status })),
    written: !!written,
    summary: typeof written?.summary === 'string' ? written.summary : undefined,
  }
}

const active = new Map()
const starting = new Set()

export function researchRuns({ context, workflow, parseAttachment }) {
  async function providers(links, allowLocal = false) {
    const available = await context({ links })
    if (links?.length) {
      if (typeof available.readPage !== 'function') throw problem('research-search-links-unavailable', 'Public page reading is unavailable')
    } else if (!allowLocal && typeof available.search !== 'function') {
      throw problem('research-search-disabled', 'Supply a public link or enable web search')
    }
    return available
  }

  function key(store, scope) {
    return store.path + ':' + scope
  }

  async function perform(store, jobs, run, available) {
    try {
      const state = await workflow.run({
        model: available.model, initial: run,
        retrieve: (queries, scope) => collect(store, run, queries, available, scope),
        async checkpoint(step, value) {
          if (step === 'plan' && run.question) {
            await createOnce(store, run.question, { type: 'question', body: value.topic, title: value.topic })
            await createOnce(store, run.topic, { type: 'research', title: value.topic, body: '', question: run.question,
              links: run.origin ? [{ kind: 'derived', ...run.origin }] : [] })
          }
          await jobs.write({ ...run, [step]: value })
          run[step] = value
          if (step === 'verified' && run.requireEvidence && !hasCitableEvidence(value)) {
            throw problem('research-no-evidence', 'No citable evidence was found')
          }
        },
      })
      if (run.requireEvidence && !hasCitableEvidence(state.verified)) {
        throw problem('research-no-evidence', 'No citable evidence was found')
      }
      const topic = await store.get(run.topic, run.topicVersion)
      const used = new Set(state.verified.claims.flatMap(claim => claim.sources))
      const links = state.verified.sources.filter(source => used.has(source.id) && source.reference)
        .map(source => ({ kind: 'derived', ...source.reference }))
      const report = await createOnce(store, run.id, {
        type: 'report', title: state.plan.topic, body: renderResearchReport(state), review: 'draft',
        links: [{ kind: 'related', id: topic.meta.id, version: topic.meta.version }, ...links],
      })
      run.report = { id: report.meta.id, version: report.meta.version }
      run.status = 'complete'
      await jobs.write(run)
    } catch (error) {
      run.status = 'failed'
      run.error = typeof error.code === 'string' && /^(model-|research-search|research-no-evidence)/.test(error.code)
        ? { code: error.code, message: error.message } : { code: 'research-storage' }
      await jobs.write(run)
    }
  }

  function launch(store, jobs, run, available) {
    const runKey = key(store, run.id)
    active.set(runKey, perform(store, jobs, run, available)
      .catch(error => console.warn('[grove] unable to save research progress:', error.code || 'internal'))
      .finally(() => active.delete(runKey)))
    return progress(run, true)
  }

  return {
    async list(store, jobs, input) {
      const reference = input.idea ?? input.knowledge
      const runs = (await jobs.list()).filter(run => reference ? run.origin?.id === reference.id && run.origin?.version === reference.version
        : input.topic ? run.topic === input.topic : !run.origin && !!run.question)
      const inventory = runs.some(run => run.report) ? await store.inventory() : new Map()
      return Promise.all(runs.sort((a, b) => b.created.localeCompare(a.created)).map(async run => {
        const versions = inventory.get(run.report?.id)
        if (versions?.length) {
          run.report.version = Math.max(...versions)
          if (run.status === 'complete' && run.requireEvidence === undefined && run.verified && !hasCitableEvidence(run.verified)) {
            const report = await store.get(run.report.id, run.report.version)
            if (isUnsupportedDraft(run, report)) {
              return progress({ ...run, status: 'failed', error: { code: 'research-no-evidence' } })
            }
          }
        }
        return progress(run, active.has(key(store, run.id)))
      }))
    },
    async start(store, jobs, input) {
      const direction = typeof input.direction === 'string' ? input.direction.trim().slice(0, 1200) : ''
      const inspiration = input.idea && await store.get(input.idea.id, input.idea.version)
      if (inspiration && inspiration.meta.type !== 'inspiration') throw problem('invalid-body', 'Choose an inspiration')
      const knowledge = input.knowledge && await readKnowledge(store, input.knowledge.id, input.knowledge.version)
      const origin = inspiration || knowledge
      const existing = input.topic && await store.get(input.topic)
      if (existing && (existing.meta.type !== 'research' || existing.meta.status === 'archived')) {
        throw problem('invalid-body', 'Choose an active research topic')
      }
      if (existing && origin) throw problem('invalid-body', 'Choose a topic or an inspiration')
      if ((input.conversation === true || (!origin && !existing)) && !direction) throw problem('invalid-body', 'Enter a research question')
      const scope = origin ? `${origin.meta.id}.v${origin.meta.version}` : existing?.meta.id ?? 'independent'
      const lock = key(store, scope)
      if (starting.has(lock)) throw problem('research-running', 'Research is already starting')
      starting.add(lock)
      try {
        const running = (await jobs.list()).find(run => (run.scope === scope || (existing && run.topic === existing.meta.id)) && run.status === 'running' && active.has(key(store, run.id)))
        if (running) return progress(running, true)
        const prepared = input.attachment === undefined ? null : await parseAttachment(input.attachment)
        const links = publicLinks(input.direction, origin?.body, existing?.meta.title)
        const available = await providers(links, input.conversation === true)
        const localOnly = !links.length && typeof available.search !== 'function'
        const history = existing ? (await jobs.list())
          .filter(item => item.topic === existing.meta.id && item.status === 'complete')
          .sort((a, b) => a.created.localeCompare(b.created)).slice(-4)
          .map(item => ({ question: item.direction, summary: item.written?.summary })) : []
        const linked = origin && { id: origin.meta.id, version: origin.meta.version,
          ...(inspiration ? { excerpt: inspiration.body.slice(0, 1600) } : {}) }
        const ancestor = existing?.meta.links?.find(link => link.kind === 'derived' && link.excerpt)
        const run = {
          schema: 1, id: randomUUID(), topic: existing?.meta.id ?? randomUUID(), question: existing ? undefined : randomUUID(),
          scope, ...(available.hostSearch ? { hostSearch: true } : {}), requireEvidence: input.conversation === true || !!prepared, ...(links.length ? { links } : {}), ...(localOnly ? { localOnly } : {}), history, topicVersion: existing?.meta.version ?? 1, direction, origin: linked, status: 'running', created: new Date().toISOString(), web: true,
          input: { language: input.language === 'en' ? 'en' : 'zh', direction, today: currentDay(input.timeZone),
            inspiration: linked?.excerpt ?? ancestor?.excerpt, question: existing?.meta.title ?? knowledge?.meta.title,
            background: knowledge?.body.slice(0, 1600) },
        }
        if (input.conversation === true || prepared) {
          let topic = existing
          if (!topic) {
            const title = (direction || origin?.meta.title).slice(0, 160)
            await createOnce(store, run.question, { type: 'question', title, body: title })
            topic = await createOnce(store, run.topic, { type: 'research', title, body: '', question: run.question,
              links: linked ? [{ kind: 'derived', ...linked }] : [] })
          }
          if (prepared) {
            const { meta } = await saveSource(store, topic, prepared, { separate: true })
            run.attachment = { id: meta.id, version: meta.version, name: meta.title }
          }
        }
        await jobs.write(run)
        return launch(store, jobs, run, available)
      } finally {
        starting.delete(lock)
      }
    },
    async retry(store, jobs, id) {
      const run = await jobs.read(id)
      const lock = key(store, run.id)
      if (active.has(lock) || run.status === 'complete') return progress(run, active.has(lock))
      const scopeLock = key(store, run.topic)
      if (starting.has(scopeLock) || starting.has(lock)) throw problem('research-running', 'Research is already starting')
      starting.add(scopeLock)
      starting.add(lock)
      try {
        const running = (await jobs.list()).some(item => item.topic === run.topic && active.has(key(store, item.id)))
        if (running) throw problem('research-running', 'Research is already running in this topic')
        if (!run.web && (await store.versions(run.id)).length) {
          // A legacy report may have been saved before its final progress checkpoint.
          const report = await store.get(run.id)
          run.status = 'complete'
          run.report = { id: report.meta.id, version: report.meta.version }
          delete run.error
          await jobs.write(run)
          return progress(run)
        }
        const available = await providers(run.links, run.localOnly === true)
        const changedToHostSearch = available.hostSearch && !run.localOnly && !run.hostSearch
        if (changedToHostSearch) {
          run.hostSearch = true
          delete run.plan
        }
        if (changedToHostSearch || !run.web || run.error?.code === 'research-no-evidence') {
          // Earlier runs could reach the writing stage using local materials alone.
          delete run.collected
          delete run.review
          delete run.verified
          delete run.written
          run.web = true
        }
        run.status = 'running'
        delete run.error
        await jobs.write(run)
        return launch(store, jobs, run, available)
      } finally {
        starting.delete(lock)
        starting.delete(scopeLock)
      }
    },
  }
}
