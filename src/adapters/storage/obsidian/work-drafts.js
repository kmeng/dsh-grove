import { vaultRecordStore } from './vault-records.js'

export function workDraftStore(vault) {
  return vaultRecordStore(vault, '.work-drafts', { revisions: true })
}
