import { defineTool } from '@deepseek-ai/dsh-tools'
import { Vault, types } from './vault.js'
import { propose, roles } from './proposals.js'
import { registerRoutes } from './server.js'

export const name = 'grove'
export const inject = ['tools']

const output = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

/** The vault a row configured, else GROVE_VAULT. The panel reports which one is in use. */
function configuredVault(config) {
  const fromConfig = typeof config.vault === 'string' ? config.vault.trim() : ''
  const fromEnv = (process.env.GROVE_VAULT ?? '').trim()
  if (fromConfig !== '') return { path: fromConfig, source: 'config' }
  if (fromEnv !== '') return { path: fromEnv, source: 'env' }
  return { path: undefined, source: null }
}

export function apply(ctx, config = {}) {
  const { path, source } = configuredVault(config)

  // The panel routes stay registered without a vault so the cold start can pick one.
  if (typeof ctx.inject === 'function') registerRoutes(ctx, { current: () => configuredVault(config) })

  if (path === undefined) return
  let vault
  try {
    vault = new Vault(path)
  } catch (error) {
    // An unusable path must not take the whole plugin down: the panel shows the problem instead.
    console.warn(`[grove] ${error.message}`)
    return
  }
  const allowed = new Set(config.readableIds ?? (process.env.GROVE_READABLE_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean))

  ctx.tools.register(defineTool({
    name: 'grove_role',
    description: 'Get the Grove collaboration guidance for a role explicitly requested by the user.',
    parameters: { role: { type: 'string', enum: Object.keys(roles), required: true } },
    output,
    execute: ({ role }) => roles[role],
  }))

  ctx.tools.register(defineTool({
    name: 'grove_propose',
    description: 'When asked, save a draft for local human review. This tool does not create a knowledge asset.',
    parameters: {
      type: { type: 'string', enum: types.filter(type => !['evidence', 'research'].includes(type)), required: true },
      body: { type: 'string', required: true },
      title: { type: 'string' },
      origin: { type: 'string', description: 'User-approved session reference or source description' },
    },
    output,
    async execute(args) {
      const id = await propose(vault, args)
      return `Draft ${id}. The user can review it with grove preview ${id} in their terminal.`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'grove_read',
    description: 'Read one explicitly shared Grove asset by ID.',
    parameters: { id: { type: 'string', required: true } },
    output,
    async execute({ id }) {
      if (!allowed.has(id)) return 'This asset is outside the configured Grove sharing scope.'
      const { meta, body } = await vault.get(id)
      if (meta.status === 'archived') return 'This asset is archived.'
      return JSON.stringify({ id, version: meta.version, title: meta.title, type: meta.type, body, source: meta.source, locator: meta.locator })
    },
  }))
}
