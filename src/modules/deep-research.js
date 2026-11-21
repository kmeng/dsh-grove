import { jsonrepair } from 'jsonrepair'

const invalid = () => Object.assign(new Error('Invalid deep research response'), { code: 'model-response' })

function line(value, length) {
  if (typeof value !== 'string' || !value.trim()) throw invalid()
  return value.trim().replace(/\s+/g, ' ').slice(0, length)
}

function reportError(detail) {
  return Object.assign(invalid(), { detail })
}

function escapeReportQuotes(text) {
  // A report writer can insert a straight quote inside a prose field without JSON escaping.
  return text.replace(/^([ \t]*"(?:title|summary|heading|text|conclusion)"[ \t]*:[ \t]*)"(.*)"([ \t]*,?[ \t]*)$/gm,
    (_, prefix, value, suffix) => prefix + '"' + value.replace(/\\[\s\S]|"/g,
      part => part === '"' ? '\\"' : part) + '"' + suffix)
}

function parserDiagnostic(error, text) {
  const message = error.message ?? ''
  const category = /end of (?:JSON )?(?:input|string)|unexpected end/i.test(message) ? 'unexpected-end'
    : /unterminated string/i.test(message) ? 'unterminated-string'
      : /property name|object key/i.test(message) ? 'object-key'
        : /colon expected|expected ':'/i.test(message) ? 'missing-colon'
          : /expected ','/i.test(message) ? 'missing-separator'
            : /unexpected (?:character|token)/i.test(message) ? 'unexpected-character' : 'invalid-syntax'
  const offset = error.position ?? Number(/(?:at )?position (\d+)(?:\s|$)/i.exec(message)?.[1])
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return { category }
  // Preserve only JSON delimiters, never the parser message or the underlying prose.
  const mask = value => value.replace(/[^{}\[\]:,"\\]/gu, '·')
  return { category, offset, shape: mask(text.slice(Math.max(0, offset - 24), offset)) +
    '│' + mask(text.slice(offset, offset + 24)) }
}

function readReportOutput(output) {
  if (typeof output?.rawReport !== 'string') return { result: output }
  const raw = output.rawReport.trim()
  if (!raw) throw reportError(output.finish === 'stop' ? 'empty' : 'incomplete')
  const fenced = /```(?:json)?\s*(\{[\s\S]*?)\s*```/i.exec(raw)
  const text = fenced?.[1] ?? raw
  const reason = output.finish && output.finish !== 'stop' ? 'incomplete' : undefined
  try {
    return { result: JSON.parse(text), reason: reason ?? (fenced && fenced[0] !== raw ? 'json' : undefined) }
  } catch (parseError) {
    let repairInput = escapeReportQuotes(text)
    try {
      repairInput = jsonrepair(repairInput)
      return { result: JSON.parse(repairInput), reason: reason ?? 'json' }
    } catch (repairError) {
      const finish = ['stop', 'length', 'error', 'aborted', 'tool-calls'].includes(output.finish) ? output.finish : 'unknown'
      throw Object.assign(reportError(reason ?? 'json'), {
        diagnostic: {
          finish, characters: output.rawReport.length,
          parse: parserDiagnostic(parseError, text),
          repair: parserDiagnostic(repairError, repairInput),
        },
      })
    }
  }
}

function validateReport(output, allowedClaims) {
  const { result, reason } = readReportOutput(output)
  const local = typeof output?.rawReport === 'string'
  if (!Array.isArray(result?.sections) || !result.sections.length || result.sections.length > 6) throw reportError('schema')
  let normalized = false
  const sections = result.sections.map(section => {
    if (!Array.isArray(section?.paragraphs) || !section.paragraphs.length || section.paragraphs.length > 6) throw reportError('schema')
    const paragraphs = section.paragraphs.map(paragraph => {
      const rawClaims = paragraph?.claims
      const claims = local && Array.isArray(rawClaims)
        ? rawClaims.map(id => typeof id === 'string' && /^\d+$/.test(id.trim()) ? Number(id) : id)
        : rawClaims
      if (!Array.isArray(claims) || !claims.length || claims.some(id => !allowedClaims.has(id))) throw reportError('citations')
      if (claims.some((id, index) => id !== rawClaims[index])) normalized = true
      return { text: line(paragraph.text, 3200), claims: [...new Set(claims)] }
    })
    return { heading: line(section.heading, 120), paragraphs }
  })
  return { title: result.title === undefined ? undefined : line(result.title, 100),
    summary: line(result.summary, 3000), sections, conclusion: line(result.conclusion, 3000),
    reason: reason ?? (normalized ? 'citations' : undefined) }
}

function questions(value, max) {
  if (!Array.isArray(value)) throw invalid()
  return [...new Set(value.map(item => line(item, 240)))].slice(0, max)
}

function assessment(value, sources) {
  if (!Array.isArray(value?.claims) || !value.claims.length) throw invalid()
  const available = new Set(sources.map(source => source.id))
  return value.claims.slice(0, 10).map(claim => {
    if (!Array.isArray(claim?.sources) || claim.sources.some(id => !available.has(id))) throw invalid()
    const supporting = [...new Set(claim.sources)]
    const text = line(claim.text, 1200)
    const explanation = line(claim.explanation, 1400)
    if (!['supported', 'disputed', 'insufficient'].includes(claim.status)) throw invalid()
    const quotes = []
    for (const source of sources) {
      if (!supporting.includes(source.id)) continue
      const availableText = source.text.replace(/\s+/g, ' ')
      const quote = (Array.isArray(claim.quotes) ? claim.quotes : [])
        .filter(item => item?.id === source.id && typeof item.text === 'string')
        .map(item => item.text.trim().replace(/\s+/g, ' '))
        .find(text => text.length >= 8 && text.length <= 350 && availableText.includes(text))
      if (quote) quotes.push({ id: source.id, text: quote })
    }
    const matched = new Set(quotes.map(quote => quote.id))
    const distinct = new Set(sources.filter(source => matched.has(source.id)).map(source => source.origin))
    const status = distinct.size < 2 ? 'insufficient' : claim.status
    return { text, explanation, status, sources: supporting, quotes }
  })
}

async function collectFollowups(state, model, retrieve) {
  const { followups } = state.review
  if (state.links?.length || state.localOnly) return retrieve(followups, 'local')
  if (!state.collected.some(source => source.reference)) return retrieve(followups)

  // Private passages can inform local retrieval. Only the original plan and
  // public results are visible to the call that generates more web queries.
  const publicSources = state.collected.filter(source => !source.reference && !source.unavailable)
  const publicReview = await model.review({ plan: state.plan, today: state.input.today, sources: publicSources })
  const webQueries = questions(publicReview?.followups, 2)
  const online = webQueries.length ? await retrieve(webQueries, 'web') : []
  const local = await retrieve(followups, 'local')
  return local.concat(online)
}

export const stagedResearch = {
  async run({ model, write = model.write?.bind(model), writerName = model.name, retrieve, checkpoint, initial }) {
    const state = { ...initial }
    async function step(key, action) {
      if (state[key] !== undefined) return
      state[key] = await action()
      await checkpoint(key, state[key])
    }

    async function modelCall(method, input) {
      const withBudget = size => method !== 'write' && input.sources ? { ...input, sources: input.sources.map(source => ({
        ...source, text: source.text.slice(0, Math.min(size, Math.floor(42_000 / input.sources.length))),
      })) } : input
      const call = method === 'write' ? write : model[method].bind(model)
      try {
        return await call(withBudget(2200))
      } catch (error) {
        if (error.code !== 'model-timeout' && !(method === 'write' && error.code === 'model-response' && !error.noRewrite)) throw error
        const retries = (state.automaticRetries ?? 0) + 1
        state.automaticRetries = retries
        await checkpoint('automaticRetries', retries)
        await checkpoint('retrying', true)
        try { return await call(withBudget(800), { lowerEffort: true }) }
        finally { await checkpoint('retrying', false) }
      }
    }
    const readable = sources => sources.filter(source => !source.unavailable)

    await step('plan', async () => {
      const { language, direction, today } = state.input
      const plan = await modelCall('plan', state.hostSearch ? { language, direction, today } :
        state.localOnly ? { ...state.input, history: state.history } : state.input)
      const items = questions(plan?.questions, 4)
      if (!items.length) throw invalid()
      return { topic: line(plan.topic, 160), questions: items }
    })
    await step('collected', () => retrieve(state.plan.questions))
    await step('review', async () => {
      const sources = readable(state.collected)
      const reviewed = await modelCall('review', { plan: state.plan, today: state.input.today, sources })
      return { claims: assessment(reviewed, sources), followups: questions(reviewed.followups, 2) }
    })
    await step('verified', async () => {
      const all = new Map(state.collected.map(source => [source.id, source]))
      const queried = new Map(state.plan.questions.map(query => [query.trim().toLowerCase(), new Set(['all'])]))
      const rounds = [...(state.rounds ?? [])]
      let review = state.review
      for (let index = 0; index < 2 && review.followups.length; index++) {
        let round = rounds[index]
        if (!round) {
          await checkpoint('searchRound', index + 2)
          const requests = []
          const extra = await collectFollowups({ ...state, collected: [...all.values()], review },
            { review: input => modelCall('review', input) }, (queries, scope = 'all') => {
              const fresh = queries.filter(query => {
                const scopes = queried.get(query.trim().toLowerCase())
                return !scopes?.has('all') && !scopes?.has(scope)
              })
              requests.push({ queries: fresh, scope })
              return fresh.length ? retrieve(fresh, scope === 'all' ? undefined : scope) : []
            })
          const additions = new Map()
          for (const source of extra) {
            const previous = additions.get(source.id) ?? all.get(source.id)
            if (!previous || (previous.unavailable && !source.unavailable)) additions.set(source.id, source)
          }
          round = { requests, additions: [...additions.values()] }
          rounds[index] = round
          await checkpoint('rounds', rounds.slice())
        }
        for (const { queries, scope } of round.requests) {
          for (const query of queries) {
            const key = query.trim().toLowerCase()
            if (!queried.has(key)) queried.set(key, new Set())
            queried.get(key).add(scope)
          }
        }
        for (const source of round.additions) all.set(source.id, source)
        if (!round.additions.some(source => !source.unavailable)) break
        if (!round.review) {
          const sources = readable([...all.values()]).slice(0, 48)
          const prior = review.claims.map(({ text, explanation, status, sources }) => ({ text, explanation, status, sources }))
          const reviewed = await modelCall('review', { plan: state.plan, today: state.input.today, sources, prior })
          round = { ...round, review: { claims: assessment(reviewed, sources), followups: questions(reviewed.followups, 2) } }
          rounds[index] = round
          await checkpoint('rounds', rounds.slice())
        }
        review = round.review
      }
      const candidates = [...all.values()]
      return { claims: review.claims, sources: readable(candidates).slice(0, 48), followups: review.followups,
        unavailable: candidates.filter(source => source.unavailable).slice(0, 16).map(({ title }) => title) }
    })
    await step('written', async () => {
      const { claims, sources } = state.verified
      const cited = new Set(claims.flatMap(claim => claim.sources))
      const references = sources.filter(source => cited.has(source.id))
      const numbers = new Map(references.map((source, index) => [source.id, index + 1]))
      const writingClaims = claims.map((claim, index) => ({
        id: index + 1, text: claim.text, sources: claim.sources.map(id => numbers.get(id)),
        ...(claim.status === 'disputed' && { context: claim.explanation.slice(0, 180) }),
      })).filter(claim => !references.length || claim.sources.length)
      const allowedClaims = new Set(writingClaims.map(claim => claim.id))
      const progress = { model: writerName, startedAt: Date.now() }
      await checkpoint('writing', { ...progress, phase: 'writing' })
      try {
        const output = await modelCall('write', {
          topic: state.plan.topic, questions: state.plan.questions, language: state.input.language, today: state.input.today,
          claims: writingClaims,
          sources: references.map(source => {
            const excerpts = [...new Set(claims.flatMap(claim => (claim.quotes ?? [])
              .filter(quote => quote.id === source.id).map(quote => quote.text)))].slice(0, 3)
            return { id: numbers.get(source.id), title: source.title, publishedAt: source.publishedAt,
              excerpts: excerpts.length ? excerpts : [source.text.trim().slice(0, 320)] }
          }),
        })
        const { reason, ...report } = validateReport(output, allowedClaims)
        await checkpoint('writing', { ...progress, phase: 'complete', reason, endedAt: Date.now() })
        return report
      } catch (error) {
        const reason = error.detail ?? (error.code === 'model-response' ? 'schema' : undefined)
        await checkpoint('writing', { ...progress, phase: 'failed', reason, diagnostic: error.diagnostic, endedAt: Date.now() })
        throw error
      }
    })
    return state
  },
}

function markdownText(value) {
  return value.replace(/[\\`*_\[\]<>]/g, '\\$&')
}

function reportProse(value) {
  return markdownText(value.replace(/\s*[(（]\s*(?:claims?|论断)\s*#?\d+(?:\s*[,，、]\s*\d+)*\s*[)）]/gi, ''))
}

export function reportSources(state) {
  const { claims, sources } = state.verified
  const indexes = state.written.sections?.flatMap(section => section.paragraphs.flatMap(paragraph => paragraph.claims))
  const referenced = indexes ? [...new Set(indexes)].map(index => claims[index - 1]) : claims
  const cited = new Set(referenced.flatMap(claim => claim.sources))
  return sources.filter(source => cited.has(source.id))
}

export function renderResearchReport(state) {
  const english = state.input.language === 'en'
  const sources = reportSources(state)
  const numbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const references = sources.map(source => {
    const location = source.reference ? `[[${source.reference.id}.v${source.reference.version}]]` : `<${source.url}>`
    return `${numbers.get(source.id)}. ${markdownText(source.title)} · ${location}${source.publishedAt ? ' · ' + markdownText(source.publishedAt) : ''}`
  })
  const analysis = state.written.sections?.map(section => {
    const paragraphs = section.paragraphs.map(paragraph => {
      const ids = new Set(paragraph.claims.flatMap(index => state.verified.claims[index - 1].sources))
      const refs = [...ids].map(id => `[${numbers.get(id)}]`).join(' ')
      return reportProse(paragraph.text) + (refs ? ' ' + refs : '')
    })
    return `### ${markdownText(section.heading)}\n\n${paragraphs.join('\n\n')}`
  })
  return [
    `# ${markdownText(state.written.title ?? state.plan.topic)}`,
    `## ${english ? 'Overview' : '摘要'}\n\n${reportProse(state.written.summary)}`,
    ...(analysis ? [`## ${english ? 'Analysis' : '研究分析'}\n\n${analysis.join('\n\n')}`] : []),
    ...(state.written.conclusion ? [
      `## ${english ? 'Conclusion' : '结论'}\n\n${reportProse(state.written.conclusion)}`,
    ] : []),
    ...(references.length ? [`## ${english ? 'References' : '参考资料'}\n\n${references.join('\n')}`] : []),
  ].join('\n\n')
}
