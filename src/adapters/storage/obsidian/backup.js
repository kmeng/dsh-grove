import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readdir, realpath, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

async function realDirectory(path) {
  if (!isAbsolute(path ?? '') || await realpath(path) !== path || !(await lstat(path)).isDirectory()) {
    throw new Error('Use an absolute path to a real directory')
  }
  return path
}

async function openRegular(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  if (!(await file.stat()).isFile()) {
    await file.close()
    throw new Error('Snapshot requires regular files')
  }
  return file
}

// Traversal order is stable so manifests can be compared without path lookups.
async function scan(root, destination, directory = root) {
  await realDirectory(directory)
  const entries = []
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name)
    const key = relative(root, path)
    const stat = await lstat(path)
    if (stat.isDirectory()) {
      if (destination) await mkdir(join(destination, key), { mode: 0o700 })
      entries.push({ path: key, directory: true }, ...await scan(root, destination, path))
      continue
    }
    if (!stat.isFile()) throw new Error(`Unsupported snapshot entry: ${key}`)
    const file = await openRegular(path)
    try {
      const hash = createHash('sha256')
      const target = destination ? await open(join(destination, key), 'wx', 0o600) : null
      try {
        for await (const chunk of file.createReadStream({ autoClose: false })) {
          hash.update(chunk)
          if (target) await target.writeFile(chunk)
        }
        if (target) await target.sync()
      } finally {
        if (target) await target.close()
      }
      entries.push({ path: key, sha256: hash.digest('hex') })
    } finally {
      await file.close()
    }
  }
  return entries
}

function verify(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Snapshot verification failed: file contents or inventory changed')
}

async function newDestination(path, source) {
  if (!isAbsolute(path ?? '') || resolve(path) !== path) throw new Error('Use an absolute destination path')
  const parent = await realDirectory(dirname(path))
  const outside = relative(source, join(parent, basename(path)))
  if (!outside || (!outside.startsWith(`..${sep}`) && outside !== '..')) {
    throw new Error('Destination must be outside the source directory')
  }
  await mkdir(path, { mode: 0o700 })
}

export async function backupVault(vault, destination) {
  const source = await realDirectory(join(await realDirectory(vault), 'Grove'))
  const initial = await scan(source)
  await newDestination(destination, source)
  const tree = join(destination, 'Grove')
  await mkdir(tree, { mode: 0o700 })
  verify(await scan(source, tree), initial)
  verify(await scan(tree), initial)
  verify(await scan(source), initial)
  const pending = join(destination, '.manifest.pending')
  await writeFile(pending, JSON.stringify({ format: 1, entries: initial }), { flag: 'wx', mode: 0o600, flush: true })
  await rename(pending, join(destination, 'manifest.json'))
  return { backup: destination, entries: initial.length }
}

export async function restoreVault(backup, destination) {
  const snapshot = await realDirectory(backup)
  const source = await realDirectory(join(snapshot, 'Grove'))
  const manifestFile = await openRegular(join(snapshot, 'manifest.json'))
  let manifest
  try {
    manifest = JSON.parse(await manifestFile.readFile('utf8'))
  } finally {
    await manifestFile.close()
  }
  if (manifest.format !== 1 || !Array.isArray(manifest.entries)) throw new Error('Unsupported snapshot manifest')
  verify(await scan(source), manifest.entries)
  await newDestination(destination, snapshot)
  const tree = join(destination, 'Grove')
  await mkdir(tree, { mode: 0o700 })
  verify(await scan(source, tree), manifest.entries)
  verify(await scan(tree), manifest.entries)
  return { vault: destination, entries: manifest.entries.length }
}
