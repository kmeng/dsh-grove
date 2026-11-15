import { modelTasks } from './tasks.js'

function modelError(code, message) {
  return Object.assign(new Error(message), { code })
}

export function httpModel({ endpoint, name, credential }, request = fetch) {
  if (!endpoint || !name || !credential) return null
  const url = URL.parse(endpoint)
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw modelError('model-endpoint', 'Model endpoint must use HTTPS')
  async function complete(system, input) {
    const signal = AbortSignal.timeout(60000)
    let response
    let payload
    try {
      response = await request(url, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential },
        body: JSON.stringify({
          model: name, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(input) },
          ],
        }),
      })
      if (response.ok) payload = await response.text()
    } catch (error) {
      if (signal.aborted || error?.name === 'TimeoutError') throw modelError('model-timeout', 'Model request timed out')
      throw modelError('model-network', 'Could not reach the model endpoint')
    }

    if (!response.ok) {
      const { status } = response
      const reason = {
        401: 'model-auth', 403: 'model-auth', 404: 'model-not-found', 429: 'model-rate-limit',
      }[status] ?? (status >= 500 ? 'model-unavailable' : 'model-rejected')
      throw modelError(reason, `HTTP ${status}`)
    }
    try {
      const data = JSON.parse(payload)
      return JSON.parse(data.choices?.[0]?.message?.content ?? '')
    } catch {
      throw modelError('model-response', 'Model reply was not in the expected JSON format')
    }
  }

  return modelTasks(name, complete)
}
