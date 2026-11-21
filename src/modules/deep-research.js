const invalid = () => Object.assign(new Error('Invalid deep research response'), { code: 'model-response' })

function line(value, length) {
  if (typeof value !== 'string' || !value.trim()) throw invalid()
  return value.trim().replace(/\s+/g, ' ').slice(0, length)
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
  async run({ model, write = model.write?.bind(model), retrieve, checkpoint, initial }) {
    const state = { ...initial }
    async function step(key, action) {
      if (state[key] !== undefined) return
      state[key] = await action()
      await checkpoint(key, state[key])
    }

    async function modelCall(method, input) {
      const withBudget = size => method !== 'write' && input.sources ? { ...input, sources: input.sources.map(source => ({
        ...source, text: source.text.slice(0, size),
      })) } : input
      const call = method === 'write' ? write : model[method].bind(model)
      try {
        return await call(withBudget(2200))
      } catch (error) {
        if (error.code !== 'model-timeout') throw error
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
      const original = readable(state.collected)
      if (state.review.followups.length) {
        const extra = await collectFollowups(state, { review: input => modelCall('review', input) }, retrieve)
        for (const source of extra) {
          if (!all.has(source.id) || all.get(source.id).unavailable) all.set(source.id, source)
        }
      }
      const candidates = [...all.values()]
      const sources = readable(candidates).slice(0, 24)
      const unavailable = candidates.filter(source => source.unavailable).slice(0, 16).map(({ title }) => title)
      if (sources.length === original.length && sources.every((source, i) => source.id === original[i].id)) {
        return { claims: state.review.claims, sources, unavailable }
      }
      const prior = state.review.claims.map(({ text, explanation, status, sources }) => ({ text, explanation, status, sources }))
      const reviewed = await modelCall('review', { plan: state.plan, today: state.input.today, sources, prior })
      return { claims: assessment(reviewed, sources), sources, unavailable }
    })
    await step('written', async () => {
      const { claims, sources } = state.verified
      const cited = new Set(claims.flatMap(claim => claim.sources))
      const references = sources.filter(source => cited.has(source.id))
      const numbers = new Map(references.map((source, index) => [source.id, index + 1]))
      const result = await modelCall('write', {
        plan: state.plan, language: state.input.language, today: state.input.today,
        claims: claims.map((claim, index) => ({
          id: index + 1, text: claim.text, status: claim.status, sources: claim.sources.map(id => numbers.get(id)),
          ...(claim.status === 'disputed' && { context: claim.explanation.slice(0, 180) }),
        })),
        sources: references.map(source => {
          const excerpts = [...new Set(claims.flatMap(claim => (claim.quotes ?? [])
            .filter(quote => quote.id === source.id).map(quote => quote.text)))].slice(0, 2)
          return { id: numbers.get(source.id), title: source.title, publishedAt: source.publishedAt,
            excerpts: excerpts.length ? excerpts : [source.text.trim().slice(0, 320)] }
        }),
      })
      if (!Array.isArray(result?.sections) || !result.sections.length || result.sections.length > 6) throw invalid()
      const sections = result.sections.map(section => {
        if (!Array.isArray(section?.paragraphs) || !section.paragraphs.length || section.paragraphs.length > 6) throw invalid()
        const paragraphs = section.paragraphs.map(paragraph => {
          if (!Array.isArray(paragraph?.claims) || !paragraph.claims.length ||
            paragraph.claims.some(id => !Number.isInteger(id) || id < 1 || id > claims.length)) throw invalid()
          return { text: line(paragraph.text, 3200), claims: [...new Set(paragraph.claims)] }
        })
        return { heading: line(section.heading, 120), paragraphs }
      })
      return { title: result.title === undefined ? undefined : line(result.title, 100),
        summary: line(result.summary, 3000), sections, conclusion: line(result.conclusion, 3000) }
    })
    return state
  },
}

function markdownText(value) {
  return value.replace(/[\\`*_\[\]<>]/g, '\\$&')
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
      return markdownText(paragraph.text) + (refs ? ' ' + refs : '')
    })
    return `### ${markdownText(section.heading)}\n\n${paragraphs.join('\n\n')}`
  })
  return [
    `# ${markdownText(state.written.title ?? state.plan.topic)}`,
    `## ${english ? 'Overview' : '摘要'}\n\n${markdownText(state.written.summary)}`,
    ...(analysis ? [`## ${english ? 'Analysis' : '研究分析'}\n\n${analysis.join('\n\n')}`] : []),
    ...(state.written.conclusion ? [
      `## ${english ? 'Conclusion' : '结论'}\n\n${markdownText(state.written.conclusion)}`,
    ] : []),
    ...(references.length ? [`## ${english ? 'References' : '参考资料'}\n\n${references.join('\n')}`] : []),
  ].join('\n\n')
}
