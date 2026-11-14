#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { readFile } from 'node:fs/promises'
import { captureInspiration } from './modules/inspirations.js'
import { Vault, stages, types } from './vault.js'
import { backupVault, restoreVault } from './adapters/storage/obsidian/backup.js'
import { accept, discard, preview } from './proposals.js'

import manifest from '../package.json' with { type: 'json' }

const usage = `Grove v${manifest.version} · set GROVE_VAULT to an absolute Obsidian vault path
  grove backup ABSOLUTE_DESTINATION
  grove restore ABSOLUTE_BACKUP --destination ABSOLUTE_VAULT
  grove capture --body 'idea'
  grove add TYPE --body 'text' [--title 'title'] [--origin 'session or source']
  grove add evidence --body 'excerpt' --source 'source URL or identifier' --locator 'p. 12'
  grove add research --body 'scope' --question QUESTION_ID
  grove list [--query 'term']
  grove show ID [--version N]
  grove update ID --version N [--body 'new text'] [--status open|paused|closed|archived]
  grove update ID --version N --stage STAGE
  grove update ID --version N --link TARGET_ID --relation supports|refutes|qualifies|related|derived
  grove preview DRAFT_ID
  grove discard DRAFT_ID
  grove accept DRAFT_ID [--body 'edited text' | --file FILE]
Types: ${types.join(', ')}
Research stages: ${stages.join(', ')}
Use --file instead of --body for multiline text.
`

function print(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
}

async function main() {
  const { positionals: [command, id, ...extra], values } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(['destination', 'body', 'file', 'title', 'origin', 'source', 'locator', 'question', 'query', 'version', 'status', 'stage', 'link', 'relation'].map(name => [name, { type: 'string' }])),
  })
  if (!command || command === 'help') return process.stdout.write(usage)
  if (extra.length) throw new Error('Unexpected positional arguments')
  if (values.body !== undefined && values.file !== undefined) throw new Error('Specify either --body or --file')
  if (command === 'backup') return print(await backupVault(process.env.GROVE_VAULT, id))
  if (command === 'restore') return print(await restoreVault(id, values.destination))
  const vault = new Vault(process.env.GROVE_VAULT)
  const body = values.file === undefined ? values.body : await readFile(values.file, 'utf8')
  const version = values.version === undefined ? undefined : Number(values.version)
  switch (command) {
    case 'capture': return print(await captureInspiration(vault, { ...values, body }))
    case 'add': return print(await vault.create({ ...values, body, type: id }))
    case 'list': return print((await vault.list(values.query)).map(({ meta }) => meta))
    case 'show': return print(await vault.get(id, version))
    case 'update': {
      if (!Number.isSafeInteger(version) || version < 1) throw new Error('Provide the current --version')
      if (!body && !values.status && !values.stage && !values.link) throw new Error('Provide a change')
      const link = values.link ? { id: values.link, kind: values.relation } : undefined
      return print(await vault.update(id, version, { ...values, body, link }))
    }
    case 'preview': return print(await preview(vault, id))
    case 'discard': return discard(vault, id)
    case 'accept': {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Acceptance requires an interactive terminal')
      const proposal = await preview(vault, id)
      if (body !== undefined) proposal.body = body
      print(proposal)
      const terminal = createInterface({ input: process.stdin, output: process.stdout })
      try {
        if ((await terminal.question('Type SAVE to create this asset: ')) !== 'SAVE') {
          return process.stdout.write('Cancelled. No asset created.\n')
        }
        return print(await accept(vault, id, proposal))
      } finally {
        terminal.close()
      }
    }
    default: throw new Error('Unknown command; run grove help')
  }
}
main().catch(error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
