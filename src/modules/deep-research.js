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
  const publicSources = state.collected.filter(source => !source.reference)
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

    await step('plan', async () => {
      const { language, direction, today } = state.input
      const plan = await model.plan(state.hostSearch ? { language, direction, today } :
        state.localOnly ? { ...state.input, history: state.history } : state.input)
      const items = questions(plan?.questions, 4)
      if (!items.length) throw invalid()
      return { topic: line(plan.topic, 160), questions: items }
    })
    await step('collected', () => retrieve(state.plan.questions))
    await step('review', async () => {
      const reviewed = await model.review({ plan: state.plan, sources: state.collected })
      return { claims: assessment(reviewed, state.collected), followups: questions(reviewed.followups, 2) }
    })
    await step('verified', async () => {
      if (!state.review.followups.length) return { claims: state.review.claims, sources: state.collected }
      const extra = await collectFollowups(state, model, retrieve)
      const existing = new Set(state.collected.map(source => source.id))
      const sources = state.collected.concat(extra.filter(source => !existing.has(source.id))).slice(0, 24)
      if (sources.length === existing.size) return { claims: state.review.claims, sources }
      const reviewed = await model.review({ plan: state.plan, sources, prior: state.review.claims })
      return { claims: assessment(reviewed, sources), sources }
    })
    await step('written', async () => {
      const result = await model.write({ plan: state.plan, claims: state.verified.claims, language: state.input.language, history: state.history })
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
  const cited = new Set(state.verified.claims.flatMap(claim => claim.sources))
  const sources = state.verified.sources.filter(source => cited.has(source.id))
  const numbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const claims = state.verified.claims.map(claim => {
    const refs = claim.sources.map(id => `[${numbers.get(id)}]`).join(' ')
    return `- **${title[claim.status]}** · ${markdownText(claim.text)}${refs ? ' ' + refs : ''}\n  ${markdownText(claim.explanation)}`
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
    `## ${title.sources}\n\n${references.length ? references.join('\n') : title.noSources}`,
  ].join('\n\n')
}
