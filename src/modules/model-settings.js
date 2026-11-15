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

export function selectModel(config, role) {
  if (config?.enabled !== true) return null
  return role === 'research' && config.deepResearch ? config.deepResearch : config
}

export function readModelSettings(config, provider) {
  const enabled = config?.enabled === true
  const deepResearch = config?.deepResearch ? { name: config.deepResearch.name, endpoint: config.deepResearch.endpoint } : null
  function connection(role) {
    const model = selectModel(config, role)
    if (!model?.endpoint || !model.name) return { status: 'unconfigured' }
    try {
      if (!provider?.(model, role, config)) return { status: 'failed', code: 'model-key' }
    } catch (error) {
      return { status: 'failed', code: error.code || 'model-unavailable' }
    }
    const result = config.connections?.[role]
    if (result?.endpoint !== model.endpoint || result?.name !== model.name) return { status: 'unverified' }
    return { status: result.status, code: result.code, message: result.message, checkedAt: result.checkedAt }
  }
  const main = connection('default')
  return { enabled, name: config?.name, endpoint: config?.endpoint, inspirationLinks: config?.inspirationLinks === true,
    webSearch: config?.webSearch === true, deepResearch, connection: main,
    researchConnection: deepResearch ? connection('research') : main, changeId: config?.changeId }
}

export function parseModelSettings(input, previous) {
  const enabled = input?.enabled !== false
  return {
    enabled,
    ...(enabled ? modelFields(input) : { name: previous?.name, endpoint: previous?.endpoint }),
    inspirationLinks: (input?.inspirationLinks ?? previous?.inspirationLinks) === true,
    webSearch: (input?.webSearch ?? previous?.webSearch) === true,
    deepResearch: !enabled || input?.deepResearch === undefined ? previous?.deepResearch ?? null
      : input.deepResearch === null ? null : modelFields(input.deepResearch),
  }
}

export async function testModel(config, role, factory) {
  const model = selectModel(config, role)
  if (!model) throw invalid('model-disabled', 'Enable a model before testing')
  const provider = factory?.(model, role, config)
  if (!provider) throw invalid('model-key', 'Set the model credential in the host environment')
  const reply = await provider.investigate({
    question: 'This is a connection test. Return only {"text":"OK","citations":[]}.', materials: [], history: [],
  })
  if (typeof reply?.text !== 'string' || !reply.text.trim() || !Array.isArray(reply.citations) || reply.citations.length) {
    throw invalid('model-response', 'The model did not return the expected format')
  }
}

export async function verifyModelSettings(config, previous, verify, factory) {
  const roles = config.deepResearch ? ['default', 'research'] : ['default']
  const connections = await Promise.all(roles.map(async role => {
    const model = selectModel(config, role)
    if (!model) return [role, null]
    const existing = previous?.connections?.[role]
    if (!verify) {
      return [role, existing?.name === model.name && existing?.endpoint === model.endpoint ? existing : null]
    }
    const result = { status: 'connected', name: model.name, endpoint: model.endpoint, checkedAt: new Date().toISOString() }
    try {
      await testModel(config, role, factory)
    } catch (error) {
      result.status = 'failed'
      result.code = error.code || 'model-unavailable'
      result.message = error.message
    }
    return [role, result]
  }))
  return { ...config, connections: Object.fromEntries(connections), changeId: randomUUID() }
}
