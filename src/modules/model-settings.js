import { randomUUID } from 'node:crypto'

function invalid(code, message) {
  return Object.assign(new Error(message), { code })
}

function modelFields(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint.trim() : ''
  if (!name || name.length > 200 || !endpoint || endpoint.length > 2048) {
    throw invalid('model-settings', 'Enter the model endpoint and name')
  }
  const url = URL.parse(endpoint)
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw invalid('model-endpoint', 'Use an HTTPS endpoint without credentials, query parameters or fragments')
  }
  return { name, endpoint }
}

function source(config, dsh) {
  return config?.source ?? (config ? 'custom' : dsh ? 'dsh' : 'custom')
}

function usesModel(config, dsh) {
  return config?.enabled ?? (source(config, dsh) === 'dsh')
}

export function selectModel(config, role, dsh) {
  if (!usesModel(config, dsh)) return null
  if (role === 'work' && config?.workWriting) return config.workWriting
  if (role === 'report') return config?.reportWriting ?? selectModel(config, 'research', dsh)
  if (role === 'research' && config?.deepResearch) return config.deepResearch
  if (source(config, dsh) !== 'dsh') return config
  const selected = dsh?.defaultSelection()
  return selected ? { source: 'dsh', ...selected } : null
}

function verificationKey(model) {
  return model.source === 'dsh'
    ? JSON.stringify(['dsh', model.provider, model.model, model.reasoningEffort])
    : JSON.stringify(['custom', model.endpoint, model.name])
}

function matches(result, model) {
  return !!result && (result.key === verificationKey(model) ||
    (model.source !== 'dsh' && result.name === model.name && result.endpoint === model.endpoint))
}

export function readModelSettings(config, provider, dsh) {
  const enabled = usesModel(config, dsh)
  const deepResearch = config?.deepResearch ?? null
  function connection(role) {
    const model = selectModel(config, role, dsh)
    if (!model) return { status: 'unconfigured' }
    const result = config?.connections?.[role]
    if (model.source === 'dsh') {
      if (!dsh) return { status: 'failed', code: 'model-dsh-route' }
      const live = dsh.connection(model)
      if (live && (!live.checkedAt || !matches(result, model) || live.checkedAt > result.checkedAt)) return live
    } else {
      if (!model.endpoint || !model.name) return { status: 'unconfigured' }
      try {
        if (!provider?.(model, role, config)) return { status: 'failed', code: 'model-key' }
      } catch (error) {
        return { status: 'failed', code: error.code || 'model-unavailable' }
      }
    }
    if (!matches(result, model)) return { status: 'unverified' }
    return { status: result.status, code: result.code, message: result.message, checkedAt: result.checkedAt }
  }
  const main = connection('default')
  const selected = dsh?.defaultSelection()
  return { enabled, source: source(config, dsh), name: config?.name, endpoint: config?.endpoint,
    inspirationLinks: config?.inspirationLinks === true, webSearch: config?.webSearch === true,
    dshDefault: selected, deepResearch, customResearch: config?.customResearch ?? (deepResearch?.source === 'dsh' ? null : deepResearch), connection: main,
    researchConnection: deepResearch ? connection('research') : main,
    workWriting: config?.workWriting ?? null, workConnection: config?.workWriting ? connection('work') : main,
    workModelName: selectModel(config, 'work', dsh)?.model ?? selectModel(config, 'work', dsh)?.name,
    imageWriting: config?.imageWriting ?? null,
    reportWriting: config?.reportWriting ?? null,
    reportConnection: config?.reportWriting ? connection('report') : deepResearch ? connection('research') : main, changeId: config?.changeId }
}

export function parseModelSettings(input, previous, dsh) {
  const modelSource = input?.source ?? (dsh && input?.endpoint === undefined ? source(previous, dsh) : 'custom')
  if (!['dsh', 'custom'].includes(modelSource)) throw invalid('model-settings', 'Choose a model source')
  const enabled = input?.enabled !== false
  const previousCustom = previous?.customResearch ?? (previous?.deepResearch?.source !== 'dsh' ? previous?.deepResearch : null)
  let deepResearch = previous?.deepResearch ?? null
  let customResearch = previousCustom ?? null
  if (enabled && input?.deepResearch !== undefined) {
    const value = input.deepResearch
    if (value === null) deepResearch = null
    else if (value?.source === 'dsh') {
      if (typeof value.provider !== 'string' || !value.provider.trim() || value.provider.length > 200 ||
        typeof value.model !== 'string' || !value.model.trim() || value.model.length > 200) {
        throw invalid('model-dsh-route', 'Choose a dsh model for deep research')
      }
      deepResearch = { source: 'dsh', provider: value.provider, model: value.model }
    } else {
      customResearch = modelFields(value)
      deepResearch = customResearch
    }
  }
  let reportWriting = previous?.reportWriting ?? null
  if (enabled && input?.reportWriting !== undefined) {
    const value = input.reportWriting
    if (value === null) reportWriting = null
    else if (value?.source === 'dsh') {
      if (![value.provider, value.model].every(field => typeof field === 'string' && field.trim() && field.length <= 200)) {
        throw invalid('model-dsh-route', 'Choose a dsh model for report writing')
      }
      reportWriting = { source: 'dsh', provider: value.provider, model: value.model }
    } else reportWriting = modelFields(value)
  }
  let workWriting = previous?.workWriting ?? null
  if (input?.workWriting !== undefined) {
    const value = input.workWriting
    if (!value) workWriting = null
    else if (value.source === 'dsh') {
      if (![value.provider, value.model].every(field => typeof field === 'string' && field.trim() && field.length <= 200)) {
        throw invalid('model-dsh-route', 'Choose a dsh model for writing')
      }
      workWriting = { source: 'dsh', provider: value.provider, model: value.model }
    } else workWriting = modelFields(value)
  }
  const imageWriting = input?.imageWriting === undefined ? previous?.imageWriting ?? null : input.imageWriting && modelFields(input.imageWriting)
  const custom = enabled && modelSource === 'custom' ? modelFields(input) : {
    ...(typeof previous?.name === 'string' ? { name: previous.name } : {}),
    ...(typeof previous?.endpoint === 'string' ? { endpoint: previous.endpoint } : {}),
  }
  return {
    enabled, source: modelSource, ...custom,
    inspirationLinks: (input?.inspirationLinks ?? previous?.inspirationLinks) === true,
    webSearch: (input?.webSearch ?? previous?.webSearch) === true,
    deepResearch, customResearch, reportWriting, workWriting, imageWriting,
  }
}

export async function testModel(config, role, factory, dsh) {
  const model = selectModel(config, role, dsh)
  if (!model) throw invalid('model-disabled', 'Enable a model before testing')
  const effectiveRole = role === 'report' && !config.reportWriting ? 'research' : role
  const provider = factory?.(model, effectiveRole, config)
  if (!provider) throw invalid(model.source === 'dsh' ? 'model-dsh-route' : 'model-key', 'The model is unavailable')
  const reply = await provider.investigate({
    question: 'This is a connection test. Return only {"text":"OK","citations":[]}.', materials: [], history: [],
  })
  if (typeof reply?.text !== 'string' || !reply.text.trim() || !Array.isArray(reply.citations) || reply.citations.length) {
    throw invalid('model-response', 'The model did not return the expected format')
  }
}

export async function verifyModelSettings(config, previous, verify, factory, dsh) {
  const roles = ['default']
  if (config.deepResearch) roles.push('research')
  if (config.reportWriting) roles.push('report')
  if (config.workWriting) roles.push('work')
  const connections = await Promise.all(roles.map(async role => {
    const model = selectModel(config, role, dsh)
    if (!model) return [role, null]
    const existing = previous?.connections?.[role]
    if (!verify) {
      return [role, matches(existing, model) ? existing : null]
    }
    const result = { status: 'connected', key: verificationKey(model) }
    try {
      await testModel(config, role, factory, dsh)
    } catch (error) {
      result.status = 'failed'
      result.code = error.code || 'model-unavailable'
      result.message = error.message
    }
    return [role, { ...result, checkedAt: new Date().toISOString() }]
  }))
  return { ...config, connections: Object.fromEntries(connections), changeId: randomUUID() }
}
