import { createHash, randomUUID } from 'node:crypto'
import { renderResearchReport } from './deep-research.js'
import { saveEvidence } from './evidence.js'
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

async function localSources(store, topic, queries) {
  const notes = await store.list()
  const documents = notes.filter(note => note.meta.type === 'source' &&
    note.meta.links?.some(ref => ref.kind === 'related' && ref.id === topic))
  const terms = searchTerms(queries)
  const passages = documents.flatMap(({ meta, body }) => JSON.parse(body).blocks.map((block, index) => {
    const content = (meta.title + ' ' + block.text).toLowerCase()
    const score = terms.filter(term => content.includes(term)).length
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

async function collect(store, topic, queries, search) {
  const results = await Promise.all([
    localSources(store, topic, queries),
    search ? Promise.all(queries.map(query => search(query))) : [],
  ])
  const found = new Map(results[0].map(source => [source.id, source]))
  for (const candidate of results[1].flat()) {
    if (found.size >= 16) break
    const url = typeof candidate.url === 'string' && URL.parse(candidate.url)
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      typeof candidate.text !== 'string' || !candidate.text.trim()) continue
    url.hash = ''
    if (found.has(url.href)) continue
    found.set(url.href, { id: url.href, url: url.href, origin: url.hostname.replace(/^www\./, ''),
      title: String(candidate.title || url.hostname).slice(0, 200), text: candidate.text.slice(0, 5000) })
  }
  return [...found.values()]
}

function progress(run, running = false) {
  const { id, scope, topic, direction, status, created, report, error, web, plan, collected, review, verified, written } = run
  return { id, scope, topic, direction, created, report, web, error,
    status: status === 'running' && !running ? 'interrupted' : status,
    plan,
    collected: collected?.map(({ title }) => title),
    review: review && { followups: review.followups },
    verified: verified?.claims.map(({ text, status }) => ({ text, status })),
    written: !!written,
  }
}

const active = new Map()
const starting = new Set()

export function researchRuns({ context, workflow }) {

  function key(store, scope) {
    return store.path + ':' + scope
  }

  async function perform(store, jobs, run, model, search) {
    try {
      const state = await workflow.run({
        model, initial: run,
        retrieve: queries => collect(store, run.topic, queries, search),
        async checkpoint(step, value) {
          if (step === 'plan' && run.question) {
            await createOnce(store, run.question, { type: 'question', body: value.topic, title: value.topic })
            await createOnce(store, run.topic, { type: 'research', title: value.topic, body: '', question: run.question,
              links: run.origin ? [{ kind: 'derived', ...run.origin }] : [] })
          }
          await jobs.write({ ...run, [step]: value })
          run[step] = value
        },
      })
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
      run.error = typeof error.code === 'string' && /^(model-|research-search)/.test(error.code)
        ? { code: error.code, message: error.message } : { code: 'research-storage' }
      await jobs.write(run)
    }
  }

  function launch(store, jobs, run, model, search) {
    const runKey = key(store, run.id)
    active.set(runKey, perform(store, jobs, run, model, search)
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
      return runs.sort((a, b) => b.created.localeCompare(a.created)).map(run => {
        const versions = inventory.get(run.report?.id)
        if (versions?.length) run.report.version = Math.max(...versions)
        return progress(run, active.has(key(store, run.id)))
      })
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
      if (!origin && !existing && !direction) throw problem('invalid-body', 'Enter a research question')
      const scope = origin ? `${origin.meta.id}.v${origin.meta.version}` : existing?.meta.id ?? 'independent'
      const lock = key(store, scope)
      if (starting.has(lock)) throw problem('research-running', 'Research is already starting')
      starting.add(lock)
      try {
        const running = (await jobs.list()).find(run => (run.scope === scope || (existing && run.topic === existing.meta.id)) && run.status === 'running' && active.has(key(store, run.id)))
        if (running) return progress(running, true)
        const { model, search } = context()
        const linked = origin && { id: origin.meta.id, version: origin.meta.version,
          ...(inspiration ? { excerpt: inspiration.body.slice(0, 1600) } : {}) }
        const ancestor = existing?.meta.links?.find(link => link.kind === 'derived' && link.excerpt)
        const run = {
          schema: 1, id: randomUUID(), topic: existing?.meta.id ?? randomUUID(), question: existing ? undefined : randomUUID(),
          scope, topicVersion: existing?.meta.version ?? 1, direction, origin: linked, status: 'running', created: new Date().toISOString(), web: !!search,
          input: { language: input.language === 'en' ? 'en' : 'zh', direction,
            inspiration: linked?.excerpt ?? ancestor?.excerpt, question: existing?.meta.title ?? knowledge?.meta.title,
            background: knowledge?.body.slice(0, 1600) },
        }
        await jobs.write(run)
        return launch(store, jobs, run, model, search)
      } finally {
        starting.delete(lock)
      }
    },
    async retry(store, jobs, id) {
      const run = await jobs.read(id)
      const lock = key(store, run.id)
      if (active.has(lock) || run.status === 'complete') return progress(run, active.has(lock))
      if (starting.has(lock)) throw problem('research-running', 'Research is already starting')
      starting.add(lock)
      try {
        const { model, search } = context()
        if (run.web && !search) throw problem('research-search', 'Restore web search to continue this run')
        run.status = 'running'
        delete run.error
        await jobs.write(run)
        return launch(store, jobs, run, model, run.web ? search : null)
      } finally {
        starting.delete(lock)
      }
    },
  }
}
