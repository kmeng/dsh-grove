import { vaultRecordStore } from './vault-records.js'

export function researchRunStore(vault) {
  return vaultRecordStore(vault, '.research-runs')
}
