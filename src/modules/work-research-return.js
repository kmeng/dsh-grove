import { confirmReport, reportWorkOrigin } from './reports.js'
import { exactVersion } from './version-reference.js'
import { workDrafts } from './work-drafts.js'

export async function adoptConfirmedReport(store, ref) {
  const report = await store.get(ref.id, exactVersion(ref.version))
  if (report.meta.type !== 'report' || report.meta.review === 'draft') {
    throw Object.assign(new Error('Confirm the report before adding it as a source'), { code: 'invalid-body' })
  }
  const target = await reportWorkOrigin(store, report)
  if (!target) throw Object.assign(new Error('This report has no originating work section'), { code: 'invalid-body' })
  const draft = await workDrafts(store, { action: 'draft-read', id: target.draftId })
  await workDrafts(store, { action: 'draft-source-add', id: draft.id, revision: draft.revision,
    section: target.sectionId, ref: { id: report.meta.id, version: report.meta.version } })
  return target
}

export async function confirmAndReturnReport(store, input) {
  const report = await confirmReport(store, input)
  try {
    return { report, target: await adoptConfirmedReport(store, report.meta) }
  } catch (error) {
    return { report, adoptionError: { code: error.code ?? 'internal', message: error.message } }
  }
}
