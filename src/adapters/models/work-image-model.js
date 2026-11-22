export async function generateWorkImage(settings, credential, prompt, request = fetch) {
  if (!settings || !credential) return null
  const endpoint = new URL(settings.endpoint)
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('Invalid image model endpoint')
  const response = await request(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120_000),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential },
    body: JSON.stringify({ model: settings.name, prompt, n: 1, size: '1024x1024' }),
  })
  if (!response.ok) throw Object.assign(new Error('Image provider returned HTTP ' + response.status), { code: 'model-rejected' })
  const reader = response.body.getReader()
  const chunks = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > 6 * 1024 * 1024) {
        await reader.cancel()
        throw new Error('Image model response too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const encoded = JSON.parse(Buffer.concat(chunks).toString()).data?.[0]?.b64_json
  if (typeof encoded !== 'string') throw Object.assign(new Error('Image provider must return data[0].b64_json'), { code: 'model-response' })
  return encoded
}
