import { randomUUID } from 'node:crypto'
import { modelTasks } from './tasks.js'

function failure(code, message) {
  return Object.assign(new Error(message), { code })
}

function requestFailure(error, signal) {
  if (signal.aborted) return failure('model-timeout', 'The dsh model request timed out')
  const byCode = {
    AUTH: 'model-dsh-auth', MISSING_CREDENTIAL: 'model-dsh-auth', INVALID_CREDENTIAL: 'model-dsh-auth',
    RATE_LIMIT: 'model-rate-limit', QUOTA: 'model-rate-limit', QUOTA_EXCEEDED: 'model-rate-limit',
    UNKNOWN_PROVIDER: 'model-dsh-route', UNKNOWN_MODEL: 'model-dsh-route', MODEL_NOT_FOUND: 'model-dsh-route',
    TIMEOUT: 'model-timeout', TRANSPORT: 'model-network', INVALID_REQUEST: 'model-rejected',
    EMPTY_RESPONSE: 'model-response', modelResponse: 'model-response',
  }
  const byStatus = { 401: 'model-dsh-auth', 403: 'model-dsh-auth', 404: 'model-dsh-route', 429: 'model-rate-limit' }
  return failure(byCode[error?.code] ?? byStatus[error?.status] ?? 'model-unavailable',
    error?.status ? 'HTTP ' + error.status : 'The dsh model request failed')
}

export function createDshModels(ctx) {
  const checks = new Map()
  const llm = () => ctx.get?.('llm')
  const available = selection => !!llm()?.listProviders?.().some(provider => provider.id === selection.provider)
  const identity = selection => JSON.stringify([selection.provider, selection.model, selection.reasoningEffort])

  return {
    defaultSelection() {
      const selection = ctx.get?.('agentDefaultModel')?.currentSelection?.()
      return selection?.provider && selection?.model ? selection : null
    },
    async catalog() {
      const runtime = llm()
      const providers = runtime?.listProviders?.() ?? []
      const groups = await Promise.allSettled(providers.map(async provider => {
        const models = await runtime.listModels(provider.id)
        return models.filter(model => !model.inputModalities || model.inputModalities.includes('text'))
          .map(model => ({ provider: provider.id, providerName: provider.name, model: model.id, label: model.name }))
      }))
      return groups.flatMap(group => group.status === 'fulfilled' ? group.value : [])
    },
    connection(selection) {
      if (!available(selection)) return { status: 'failed', code: 'model-dsh-route' }
      return checks.get(identity(selection))
    },
    model(selection) {
      if (!available(selection)) throw failure('model-dsh-route', 'This model route is unavailable in dsh')
      return modelTasks(selection.model, async (system, input, requestOptions) => {
        const local = /^ollama(?:-|$)/i.test(selection.provider)
        const recoverReport = local && requestOptions?.reportOutput === true
        const timeout = requestOptions?.timeoutMs ?? 60_000
        const signal = AbortSignal.timeout(local ? Math.max(timeout, 600_000) : timeout)
        const key = identity(selection)
        try {
          const runtime = llm()
          const effort = selection.reasoningEffort
          const defaultDeepSeek = !effort && /^deepseek(?:-|$)/.test(selection.provider)
          const reduced = (requestOptions?.preferLowEffort && defaultDeepSeek) ||
            (requestOptions?.lowerEffort && (defaultDeepSeek || ['medium', 'high', 'xhigh', 'max'].includes(effort)))
          const reasoningEffort = reduced ? 'low' : effort
          const route = { provider: selection.provider, model: selection.model,
            ...(reasoningEffort ? { reasoningEffort } : {}) }
          const call = typeof runtime.prepareCall === 'function' ? await runtime.prepareCall(route, signal) : null
          const options = { ...(call?.config ?? route), signal,
            system: system + '\nRespond with a JSON object only.',
            messages: [{ id: randomUUID(), role: 'user', source: { kind: 'grove' },
              content: [{ type: 'text', text: JSON.stringify(input) }] }] }
          const blocks = new Map()
          let finish
          for await (const chunk of (call ? call.stream(options) : runtime.stream(options))) {
            if (recoverReport && chunk.type === 'text-delta') {
              blocks.set(chunk.index, (blocks.get(chunk.index) ?? '') + chunk.text)
            }
            if (chunk.type === 'block-end' && chunk.block?.type === 'text') blocks.set(chunk.index, chunk.block.text)
            if (chunk.type === 'finish') finish = chunk.reason
          }
          signal.throwIfAborted()
          const text = [...blocks].sort(([a], [b]) => a - b).map(([, block]) => block).join('').trim()
          if (recoverReport && (!finish?.failure || text)) return { rawReport: text, finish: finish?.kind }
          if (finish?.failure) throw finish.failure
          if (finish?.kind !== 'stop') {
            throw Object.assign(failure('modelResponse', 'The model did not finish the JSON response'), { detail: 'incomplete' })
          }
          if (!text) throw Object.assign(failure('modelResponse', 'The model returned no text'), { detail: 'empty' })
          let result
          try {
            result = JSON.parse(text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1'))
          } catch {
            throw Object.assign(failure('modelResponse', 'The model did not return JSON'), { detail: 'json' })
          }
          checks.set(key, { status: 'connected', checkedAt: new Date().toISOString() })
          return result
        } catch (error) {
          const mapped = requestFailure(error, signal)
          if (error.detail) mapped.detail = error.detail
          if (recoverReport && mapped.code === 'model-response') mapped.noRewrite = true
          checks.set(key, { status: 'failed', code: mapped.code, message: mapped.message, checkedAt: new Date().toISOString() })
          throw mapped
        }
      })
    },
  }
}
