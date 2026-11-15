import { Resolver } from 'node:dns/promises'
import { request as getHttp } from 'node:http'
import { request as getHttps } from 'node:https'
import { BlockList, isIP } from 'node:net'

const nonPublic = new BlockList()
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['168.63.129.16', 32], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) nonPublic.addSubnet(address, bits)

const maxBytes = 2_000_000
const namedEntities = new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' ']])

function htmlText(html) {
  return html.replace(/<!doctype[^<>]*>|<!--[^]*?-->|<(script|style)\b[^<>]*>[^]*?<\/\1\s*>|<\/?[a-z][^<>]*>/gi, ' ')
    .replace(/&(#x[\da-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (match, entity) => {
      if (!entity.startsWith('#')) return namedEntities.get(entity.toLowerCase()) ?? match
      const hex = entity[1].toLowerCase() === 'x'
      const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' '
    }).replace(/\s+/g, ' ').trim()
}

async function resolvePublic(hostname, signal) {
  const name = hostname.replace(/^\[|\]$/g, '')
  if (isIP(name)) {
    if (isIP(name) !== 4 || nonPublic.check(name)) throw new Error('The link does not point to a public IPv4 address')
    return name
  }

  const resolver = new Resolver({ timeout: 3500, tries: 2 })
  const cancel = () => resolver.cancel()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const addresses = await resolver.resolve4(name)
    if (!addresses.length || addresses.some(address => isIP(address) !== 4 || nonPublic.check(address))) {
      throw new Error('The link does not point to a public IPv4 address')
    }
    return addresses[0]
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

async function get(url, signal) {
  if (!['http:', 'https:'].includes(url.protocol) || url.port || url.username || url.password || url.href.length > 2048) {
    throw new Error('Use a public HTTP or HTTPS page')
  }
  const address = await resolvePublic(url.hostname, signal)
  const transport = url.protocol === 'https:' ? getHttps : getHttp
  return new Promise((resolve, reject) => {
    const req = transport(url, {
      method: 'GET', family: 4, agent: false, signal,
      // Preserve the URL host and TLS identity, but never resolve it again.
      lookup(_host, options, done) {
        if (options.all) done(null, [{ address, family: 4 }])
        else done(null, address, 4)
      },
      headers: { accept: 'text/html, text/plain, text/markdown', 'accept-encoding': 'identity', 'user-agent': 'Grove public-page reader' },
    }, resolve)
    req.once('error', reject)
    req.end()
  })
}

export async function readPublicPage(link) {
  const signal = AbortSignal.timeout(15_000)
  const initial = new URL(link)
  let url = initial
  for (let hop = 0; hop <= 4; hop++) {
    const response = await get(url, signal)
    const code = response.statusCode ?? 0
    if ([301, 302, 303, 307, 308].includes(code) && response.headers.location) {
      response.destroy()
      const next = new URL(response.headers.location, url)
      if (next.hostname !== initial.hostname || (url.protocol === 'https:' && next.protocol !== 'https:')) {
        throw new Error('Open the redirected URL directly')
      }
      url = next
      continue
    }
    const type = String(response.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
    if (code < 200 || code >= 300 || !['text/html', 'text/plain', 'text/markdown', 'application/xhtml+xml'].includes(type) ||
      Number(response.headers['content-length']) > maxBytes ||
      ![undefined, 'identity'].includes(response.headers['content-encoding'])) {
      response.destroy()
      return null
    }
    const chunks = []
    let size = 0
    for await (const chunk of response) {
      size += chunk.byteLength
      if (size > maxBytes) {
        response.destroy()
        return null
      }
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks, size).toString('utf8').slice(0, 60_000)
    const html = type === 'text/html' || type === 'application/xhtml+xml'
    const title = html ? htmlText(/<title\b[^<>]*>([^<]*)/i.exec(body)?.[1] ?? '') : ''
    const text = html ? htmlText(body) : body.trim()
    return text ? { url: url.href, title: title || url.hostname, text } : null
  }
  return null
}
