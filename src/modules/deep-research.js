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
    const quotes = Array.isArray(claim.quotes) ? claim.quotes : []
    const matched = sources.filter(source => supporting.includes(source.id) && quotes.some(item => {
      const quote = typeof item?.text === 'string' ? item.text.trim().replace(/\s+/g, ' ') : ''
      return item?.id === source.id && quote.length >= 8 && quote.length <= 350 &&
        source.text.replace(/\s+/g, ' ').includes(quote)
    }))
    const distinct = new Set(matched.map(source => source.origin))
    const status = distinct.size < 2 ? 'insufficient' : claim.status
    return { text, explanation, status, sources: supporting }
  })
}

async function collectFollowups(state, model, retrieve) {
  const { followups } = state.review
  if (state.links?.length || state.localOnly) return retrieve(followups, 'local')
  if (!state.collected.some(source => source.reference)) return retrieve(followups)

  // Private passages can inform local retrieval. Only the original plan and
  // public results are visible to the call that generates more web queries.
  const publicSources = state.collected.filter(source => !source.reference && !source.unavailable)
  const publicReview = await model.review({ plan: state.plan, sources: publicSources })
  const webQueries = questions(publicReview?.followups, 2)
  const online = webQueries.length ? await retrieve(webQueries, 'web') : []
  const local = await retrieve(followups, 'local')
  return local.concat(online)
}

export const stagedResearch = {
  async run({ model, retrieve, checkpoint, initial }) {
    const state = { ...initial }
    async function step(key, action) {
      if (state[key] !== undefined) return
      state[key] = await action()
      await checkpoint(key, state[key])
    }

    async function modelCall(method, input) {
      const withBudget = size => input.sources ? { ...input, sources: input.sources.map(source => ({
        ...source, text: source.text.slice(0, size),
      })) } : input
      try {
        return await model[method](withBudget(2200))
      } catch (error) {
        if (error.code !== 'model-timeout') throw error
        const retries = (state.automaticRetries ?? 0) + 1
        state.automaticRetries = retries
        await checkpoint('automaticRetries', retries)
        await checkpoint('retrying', true)
        try { return await model[method](withBudget(800), { lowerEffort: true }) }
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
      const reviewed = await modelCall('review', { plan: state.plan, sources })
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
      const reviewed = await modelCall('review', { plan: state.plan, sources, prior: state.review.claims })
      return { claims: assessment(reviewed, sources), sources, unavailable }
    })
    await step('written', async () => {
      const result = await modelCall('write', { plan: state.plan, claims: state.verified.claims, language: state.input.language, history: state.history })
      if (!Array.isArray(result?.nextSteps)) throw invalid()
      return { summary: line(result.summary, 3000), nextSteps: questions(result.nextSteps, 6) }
    })
    return state
  },
}

function markdownText(value) {
  return value.replace(/[\\`*_\[\]<>]/g, '\\$&')
}

export function renderResearchReport(state) {
  const english = state.input.language === 'en'
  const title = english
    ? { summary: 'Overview', questions: 'Research questions', claims: 'Findings and evidence', next: 'Open questions and next steps', sources: 'Sources', supported: 'Supported', disputed: 'Disputed', insufficient: 'Insufficient evidence', noSources: 'No citable sources were retrieved.' }
    : { summary: '摘要', questions: '研究问题', claims: '发现与证据', next: '开放问题与下一步', sources: '来源', supported: '有证据支持', disputed: '证据有分歧', insufficient: '证据不足', noSources: '本次未检索到可引用的资料。' }
  const unavailable = state.verified.unavailable ?? []
  const unverified = english ? 'Some sources could not be opened; claims without accessible evidence could not be independently verified.'
    : '部分来源无法打开；缺少可访问依据的结论未能独立核验。'
  const cited = new Set(state.verified.claims.flatMap(claim => claim.sources))
  const sources = state.verified.sources.filter(source => cited.has(source.id))
  const numbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const claims = state.verified.claims.map(claim => {
    const refs = claim.sources.map(id => `[${numbers.get(id)}]`).join(' ')
    return `- **${title[claim.status]}** · ${markdownText(claim.text)}${refs ? ' ' + refs : ''}\n  ${markdownText(claim.explanation)}${unavailable.length && !refs ? (english ? ' · Could not be independently verified.' : ' · 未能独立核验。') : ''}`
  })
  const references = sources.map(source => {
    const location = source.reference ? `[[${source.reference.id}.v${source.reference.version}]]` : `<${source.url}>`
    return `${numbers.get(source.id)}. ${markdownText(source.title)} · ${location}${source.publishedAt ? ' · ' + markdownText(source.publishedAt) : ''}`
  })

  const hasSupport = state.verified.claims.some(claim => claim.status === 'supported')
  return [
    `# ${markdownText(state.plan.topic)}`,
    `## ${title.summary}\n\n${hasSupport ? '' : title.insufficient + (english ? '. ' : '。 ')}${markdownText(state.written.summary)}`,
    `## ${title.questions}\n\n${state.plan.questions.map(question => '- ' + markdownText(question)).join('\n')}`,
    `## ${title.claims}\n\n${claims.join('\n')}`,
    ...(state.written.nextSteps.length ? [`## ${title.next}\n\n${state.written.nextSteps.map(item => '- ' + markdownText(item)).join('\n')}`] : []),
    `## ${title.sources}\n\n${references.length ? references.join('\n') : title.noSources}${unavailable.length ? '\n\n' + unverified : ''}`,
  ].join('\n\n')
}
