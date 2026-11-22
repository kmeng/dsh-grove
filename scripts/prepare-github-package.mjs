import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'

const [directory] = process.argv.slice(2)
if (!directory) throw new Error('Pass the directory of the extracted npm package')

const manifestPath = join(directory, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.name !== 'dsh-grove') throw new Error('Expected an unscoped Grove package')

const patchPath = join(directory, manifest.dsh.bundle.patch)
const patch = parse(await readFile(patchPath, 'utf8'))
const entries = patch.flatMap(operation => operation.insert ?? [])
const grove = entries.find(entry => entry.id === 'grove' && entry.name === manifest.name)
if (!grove) throw new Error('Expected the Grove bundle insertion in the package patch')

manifest.name = '@kmeng/dsh-grove'
manifest.repository = { type: 'git', url: 'git+https://github.com/kmeng/dsh-grove.git' }
grove.name = manifest.name

await writeFile(patchPath, stringify(patch))
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
