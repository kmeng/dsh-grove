export function exactVersion(version) {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Choose an exact version')
  return version
}
