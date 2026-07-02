import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendWatchItem,
  BackendWatchMonitor,
  BackendWatchMonitorStatus,
} from './backendWatchMonitor'

export type BackendClosureEvidenceStatus =
  | 'Blocked'
  | 'Evidence Review'
  | 'Ready For Closure'
  | 'Packet Ready'
  | 'Closed'

export type BackendClosureEvidenceCheckStatus = 'Missing' | 'Review' | 'Ready' | 'Verified'
export type BackendClosureEvidenceCategory = 'Watch' | 'Release' | 'Audit' | 'Dry Run' | 'Rollback' | 'Support' | 'Packet'

export interface BackendClosureEvidenceCheck {
  id: string
  category: BackendClosureEvidenceCategory
  label: string
  status: BackendClosureEvidenceCheckStatus
  detail: string
  nextStep: string
  required: boolean
}

export interface BackendClosureEvidenceItem {
  id: string
  backendWatchItemId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: BackendClosureEvidenceStatus
  recommendedStatus: BackendClosureEvidenceStatus
  watchStatus: BackendWatchMonitorStatus
  releaseStatus: string
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  releaseOwner: string
  watchOwner: string
  closureOwner: string
  releaseWindow: string
  goNoGo: string
  auditEventCount: number
  dryRunProofCount: number
  supportFollowUpCount: number
  criticalSignalCount: number
  watchSignalCount: number
  missingCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  requiredCount: number
  requiredReadyCount: number
  checks: BackendClosureEvidenceCheck[]
  packetTitle: string
  packetLocation: string
  closureSummary: string
  closurePlan: string
  watchPlan: string
  rollbackPlan: string
  auditPlan: string
  supportPlan: string
  nextStep: string
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendClosureEvidenceBinder {
  status: BackendClosureEvidenceStatus
  summary: string
  generatedAt: string
  items: BackendClosureEvidenceItem[]
  nextItem?: BackendClosureEvidenceItem
  totalCount: number
  blockedCount: number
  evidenceReviewCount: number
  readyForClosureCount: number
  packetReadyCount: number
  closedCount: number
  requiredReadyCount: number
  requiredCount: number
  auditBackedCount: number
  dryRunBackedCount: number
  rollbackReadyCount: number
  supportClearCount: number
  categoryGroups: BackendClosureEvidenceCategoryGroup[]
  ownerGroups: BackendClosureEvidenceOwnerGroup[]
}

export interface BackendClosureEvidenceCategoryGroup {
  category: BackendClosureEvidenceCategory
  total: number
  missing: number
  review: number
  ready: number
  verified: number
  nextStep: string
}

export interface BackendClosureEvidenceOwnerGroup {
  owner: string
  total: number
  blocked: number
  review: number
  ready: number
  packetReady: number
  closed: number
  missingCount: number
  nextStep: string
}

export interface BackendClosureEvidenceRecord {
  id: string
  itemId: string
  status: BackendClosureEvidenceStatus
  owner: string
  packetLocation: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendClosureEvidenceBinderInput {
  watchMonitor: BackendWatchMonitor
  records: BackendClosureEvidenceRecord[]
}

interface SaveBackendClosureEvidenceRecordInput {
  item: BackendClosureEvidenceItem
  status: BackendClosureEvidenceStatus
  owner: string
  packetLocation: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_closure_evidence_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendClosureEvidenceRecord[] = []

export const backendClosureEvidenceBoundaryRule =
  'Backend closure evidence records are final proof and packet artifacts only. They do not close production releases, deploy code, roll back production, mutate data, change billing, alter modules, change permissions, impersonate users, or execute agent actions from Platform Admin.'

export const backendClosureEvidenceStatuses: BackendClosureEvidenceStatus[] = [
  'Blocked',
  'Evidence Review',
  'Ready For Closure',
  'Packet Ready',
  'Closed',
]

export function buildBackendClosureEvidenceBinder({
  watchMonitor,
  records,
}: BuildBackendClosureEvidenceBinderInput): BackendClosureEvidenceBinder {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const items = watchMonitor.items
    .map(item => withLatestRecord(createItem(item, generatedAt), latestRecordByItem.get(getItemId(item))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openItems = items.filter(item => item.status !== 'Closed')
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const evidenceReviewCount = items.filter(item => item.status === 'Evidence Review').length
  const readyForClosureCount = items.filter(item => item.status === 'Ready For Closure').length
  const packetReadyCount = items.filter(item => item.status === 'Packet Ready').length
  const closedCount = items.filter(item => item.status === 'Closed').length
  const status = getAggregateStatus(items)

  return {
    status,
    summary: getBinderSummary(status, blockedCount, evidenceReviewCount, readyForClosureCount, packetReadyCount, closedCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    blockedCount,
    evidenceReviewCount,
    readyForClosureCount,
    packetReadyCount,
    closedCount,
    requiredReadyCount: items.reduce((total, item) => total + item.requiredReadyCount, 0),
    requiredCount: items.reduce((total, item) => total + item.requiredCount, 0),
    auditBackedCount: items.filter(item => Boolean(item.auditEventId) || item.auditEventCount > 0).length,
    dryRunBackedCount: items.filter(item => item.dryRunProofCount > 0).length,
    rollbackReadyCount: items.filter(item => item.checks.some(check => check.category === 'Rollback' && (check.status === 'Ready' || check.status === 'Verified'))).length,
    supportClearCount: items.filter(item => item.supportFollowUpCount === 0).length,
    categoryGroups: buildCategoryGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getBackendClosureEvidenceRecords(): BackendClosureEvidenceRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendClosureEvidenceRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendClosureEvidenceRecord(input: SaveBackendClosureEvidenceRecordInput) {
  const record: BackendClosureEvidenceRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    packetLocation: input.packetLocation.trim() || input.item.packetLocation,
    note: input.note.trim() || defaultClosureNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendClosureEvidenceRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendClosureEvidenceRecordChange()
  return record
}

export function subscribeToBackendClosureEvidenceRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendClosureEvidenceRecords() {
  return useSyncExternalStore(subscribeToBackendClosureEvidenceRecords, getBackendClosureEvidenceRecords, () => [])
}

export function getBackendClosureEvidenceTone(status: BackendClosureEvidenceStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Closed' || status === 'Packet Ready' || status === 'Ready For Closure') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Evidence Review') return 'warn'
  return 'neutral'
}

export function getBackendClosureEvidenceCheckTone(status: BackendClosureEvidenceCheckStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Missing') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendClosureEvidenceRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendClosureEvidenceFilename(item: BackendClosureEvidenceItem) {
  return `backend-closure-evidence-${item.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendClosureEvidenceHtml(item: BackendClosureEvidenceItem, session: AdminSession) {
  const checkRows = item.checks.map(check => `
    <tr>
      <td>${escapeHtml(check.category)}</td>
      <td>${escapeHtml(check.label)}</td>
      <td>${escapeHtml(check.status)}</td>
      <td>${escapeHtml(check.detail)}</td>
      <td>${escapeHtml(check.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.handlerLabel)} backend closure evidence</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1120px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
      h2 { font-size: 17px; }
      p, td { line-height: 1.55; }
      .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .meta div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Backend Closure Evidence Binder</p>
        <h1>${escapeHtml(item.handlerLabel)}</h1>
        <p>${escapeHtml(backendClosureEvidenceBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
        <div><span>Watch Status</span><strong>${escapeHtml(item.watchStatus)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(item.risk)}</strong></div>
        <div><span>Closure Owner</span><strong>${escapeHtml(item.closureOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(item.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(item.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${item.method} ${item.endpoint}`)}</strong></div>
        <div><span>Packet Location</span><strong>${escapeHtml(item.packetLocation)}</strong></div>
      </section>
      <section>
        <h2>Evidence Checks</h2>
        <table><thead><tr><th>Category</th><th>Evidence</th><th>Status</th><th>Detail</th><th>Next Step</th></tr></thead><tbody>${checkRows}</tbody></table>
      </section>
      <section>
        <h2>Closure Plan</h2>
        <p><strong>Summary:</strong> ${escapeHtml(item.closureSummary)}</p>
        <p><strong>Closure:</strong> ${escapeHtml(item.closurePlan)}</p>
        <p><strong>Watch:</strong> ${escapeHtml(item.watchPlan)}</p>
        <p><strong>Rollback:</strong> ${escapeHtml(item.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(item.auditPlan)}</p>
        <p><strong>Support:</strong> ${escapeHtml(item.supportPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createItem(
  item: BackendWatchItem,
  generatedAt: string,
): BackendClosureEvidenceItem {
  const checks = buildChecks(item)
  const missingCount = checks.filter(check => check.status === 'Missing').length
  const reviewCount = checks.filter(check => check.status === 'Review').length
  const readyCount = checks.filter(check => check.status === 'Ready').length
  const verifiedCount = checks.filter(check => check.status === 'Verified').length
  const requiredChecks = checks.filter(check => check.required)
  const requiredReadyCount = requiredChecks.filter(check => check.status === 'Ready' || check.status === 'Verified').length
  const recommendedStatus = getRecommendedStatus(missingCount, reviewCount)

  return {
    id: getItemId(item),
    backendWatchItemId: item.id,
    handlerKey: item.handlerKey,
    handlerLabel: item.handlerLabel,
    method: item.method,
    endpoint: item.endpoint,
    permission: item.permission,
    mutationMode: item.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    watchStatus: item.status,
    releaseStatus: item.releaseStatus,
    risk: item.risk,
    productOwner: item.productOwner,
    engineeringOwner: item.engineeringOwner,
    releaseOwner: item.releaseOwner,
    watchOwner: item.watchOwner,
    closureOwner: item.watchOwner,
    releaseWindow: item.releaseWindow,
    goNoGo: item.goNoGo,
    auditEventCount: item.auditEventCount,
    dryRunProofCount: item.dryRunProofCount,
    supportFollowUpCount: item.supportFollowUpCount,
    criticalSignalCount: item.criticalSignalCount,
    watchSignalCount: item.watchSignalCount,
    missingCount,
    reviewCount,
    readyCount,
    verifiedCount,
    requiredCount: requiredChecks.length,
    requiredReadyCount,
    checks,
    packetTitle: `${item.handlerLabel} backend closure evidence packet`,
    packetLocation: `Platform Admin / Launch Gate / Backend Closure / ${item.handlerKey}`,
    closureSummary: getClosureSummary(item, missingCount, reviewCount, requiredReadyCount, requiredChecks.length),
    closurePlan: getClosurePlan(item, missingCount, reviewCount),
    watchPlan: item.watchPlan,
    rollbackPlan: item.rollbackPlan,
    auditPlan: item.auditPlan,
    supportPlan: item.supportPlan,
    nextStep: getNextStep(recommendedStatus, item.handlerLabel, missingCount, reviewCount),
    generatedAt,
  }
}

function buildChecks(item: BackendWatchItem): BackendClosureEvidenceCheck[] {
  return [
    check(
      'watch-status',
      'Watch',
      'Backend watch posture',
      item.status === 'Critical Drift' ? 'Missing' : item.status === 'Watch' ? 'Review' : item.status === 'Verified' ? 'Verified' : 'Ready',
      `${item.handlerLabel} watch status is ${item.status}.`,
      item.status === 'Critical Drift'
        ? 'Resolve critical watch drift before closure evidence can proceed.'
        : item.status === 'Watch'
          ? 'Record a stable or verified watch review before closure packet approval.'
          : 'Keep watch evidence attached to closure packet.',
      true,
    ),
    check(
      'release-command',
      'Release',
      'Release command evidence',
      item.releaseStatus === 'Blocked' ? 'Missing' : item.releaseStatus === 'Build Planning' ? 'Review' : item.releaseStatus === 'Release Verified' ? 'Verified' : 'Ready',
      `Release command is ${item.releaseStatus} with ${item.goNoGo} posture.`,
      item.releaseStatus === 'Blocked'
        ? 'Clear release command blockers before closure.'
        : item.releaseStatus === 'Build Planning'
          ? 'Finish release planning before closure packet approval.'
          : 'Keep release command evidence attached.',
      true,
    ),
    check(
      'audit-chain',
      'Audit',
      'Audit chain',
      item.auditEventCount || item.auditEventId ? 'Verified' : 'Review',
      item.auditEventCount || item.auditEventId ? `${item.auditEventCount} matching audit event${item.auditEventCount === 1 ? '' : 's'} plus local review evidence are present.` : 'No audit evidence is attached yet.',
      item.auditEventCount || item.auditEventId ? 'Keep audit event ids visible in exported closure packet.' : 'Record a closure evidence review to create an audit anchor.',
      true,
    ),
    check(
      'dry-run-proof',
      'Dry Run',
      'Dry-run proof',
      item.dryRunProofCount ? 'Verified' : 'Review',
      item.dryRunProofCount ? `${item.dryRunProofCount} dry-run proof record${item.dryRunProofCount === 1 ? '' : 's'} are visible.` : 'No dry-run proof is visible for this handler.',
      item.dryRunProofCount ? 'Keep dry-run proof referenced in closure packet.' : 'Attach dry-run proof or mark the gap before closure.',
      true,
    ),
    check(
      'rollback-plan',
      'Rollback',
      'Rollback readiness',
      item.rollbackReady ? 'Ready' : 'Missing',
      item.rollbackReady ? item.rollbackPlan : 'No rollback plan is attached.',
      item.rollbackReady ? 'Keep rollback plan visible in closure packet.' : 'Attach rollback plan before closure evidence can pass.',
      true,
    ),
    check(
      'support-follow-up',
      'Support',
      'Support follow-up posture',
      item.blockedRequestCount || item.failedRequestCount ? 'Missing' : item.supportFollowUpCount ? 'Review' : 'Verified',
      item.blockedRequestCount || item.failedRequestCount
        ? `${item.blockedRequestCount} blocked and ${item.failedRequestCount} failed request${item.failedRequestCount === 1 ? '' : 's'} remain.`
        : item.supportFollowUpCount
          ? `${item.supportFollowUpCount} open follow-up request${item.supportFollowUpCount === 1 ? '' : 's'} remain linked.`
          : 'No support follow-up load is linked.',
      item.blockedRequestCount || item.failedRequestCount
        ? 'Resolve blocked or failed follow-up before closure packet approval.'
        : item.supportFollowUpCount
          ? 'Assign or resolve open follow-up before final closure.'
          : 'No support escalation required.',
      true,
    ),
    check(
      'packet-record',
      'Packet',
      'Closure packet record',
      item.reviewedAt || item.auditEventId ? 'Ready' : 'Review',
      item.reviewedAt || item.auditEventId ? `Latest watch review was recorded${item.reviewedAt ? ` at ${item.reviewedAt}` : ''}.` : 'No backend closure packet review is recorded yet.',
      item.reviewedAt || item.auditEventId ? 'Export packet or mark packet ready when all checks are resolved.' : 'Record backend closure evidence review.',
      true,
    ),
  ]
}

function check(
  id: string,
  category: BackendClosureEvidenceCategory,
  label: string,
  status: BackendClosureEvidenceCheckStatus,
  detail: string,
  nextStep: string,
  required: boolean,
): BackendClosureEvidenceCheck {
  return { id, category, label, status, detail, nextStep, required }
}

function withLatestRecord(
  item: BackendClosureEvidenceItem,
  record: BackendClosureEvidenceRecord | undefined,
): BackendClosureEvidenceItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    closureOwner: record.owner,
    packetLocation: record.packetLocation,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    nextStep: getNextStep(record.status, item.handlerLabel, item.missingCount, item.reviewCount),
  }
}

function buildCategoryGroups(items: BackendClosureEvidenceItem[]): BackendClosureEvidenceCategoryGroup[] {
  const categories: BackendClosureEvidenceCategory[] = ['Watch', 'Release', 'Audit', 'Dry Run', 'Rollback', 'Support', 'Packet']
  return categories.map(category => {
    const checks = items.flatMap(item => item.checks.filter(check => check.category === category))
    const missing = checks.filter(check => check.status === 'Missing').length
    const review = checks.filter(check => check.status === 'Review').length
    const ready = checks.filter(check => check.status === 'Ready').length
    const verified = checks.filter(check => check.status === 'Verified').length
    return {
      category,
      total: checks.length,
      missing,
      review,
      ready,
      verified,
      nextStep: checks.length
        ? missing
          ? `Resolve missing ${category.toLowerCase()} evidence.`
          : review
            ? `Review ${category.toLowerCase()} evidence gaps.`
            : ready
              ? `Attach ${category.toLowerCase()} evidence to closure packet.`
              : `All ${category.toLowerCase()} evidence is verified.`
        : `No ${category.toLowerCase()} evidence checks.`,
    }
  })
}

function buildOwnerGroups(items: BackendClosureEvidenceItem[]): BackendClosureEvidenceOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.closureOwner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.closureOwner === owner)
    const blocked = ownerItems.filter(item => item.status === 'Blocked').length
    const review = ownerItems.filter(item => item.status === 'Evidence Review').length
    const ready = ownerItems.filter(item => item.status === 'Ready For Closure').length
    const packetReady = ownerItems.filter(item => item.status === 'Packet Ready').length
    const closed = ownerItems.filter(item => item.status === 'Closed').length
    const missingCount = ownerItems.reduce((total, item) => total + item.missingCount, 0)
    return {
      owner,
      total: ownerItems.length,
      blocked,
      review,
      ready,
      packetReady,
      closed,
      missingCount,
      nextStep: blocked
        ? 'Clear blocked backend closure evidence.'
        : review
          ? 'Review evidence gaps and record packet notes.'
          : ready
            ? 'Mark ready handlers as packet ready.'
            : packetReady
              ? 'Export packet-ready closure evidence.'
              : 'Maintain closed backend evidence packets.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.review - a.review || b.missingCount - a.missingCount || a.owner.localeCompare(b.owner))
}

function getRecommendedStatus(missingCount: number, reviewCount: number): BackendClosureEvidenceStatus {
  if (missingCount) return 'Blocked'
  if (reviewCount) return 'Evidence Review'
  return 'Ready For Closure'
}

function getAggregateStatus(items: BackendClosureEvidenceItem[]): BackendClosureEvidenceStatus {
  if (!items.length) return 'Closed'
  if (items.some(item => item.status === 'Blocked')) return 'Blocked'
  if (items.some(item => item.status === 'Evidence Review')) return 'Evidence Review'
  if (items.some(item => item.status === 'Ready For Closure')) return 'Ready For Closure'
  if (items.some(item => item.status === 'Packet Ready')) return 'Packet Ready'
  return 'Closed'
}

function getBinderSummary(
  status: BackendClosureEvidenceStatus,
  blockedCount: number,
  evidenceReviewCount: number,
  readyForClosureCount: number,
  packetReadyCount: number,
  closedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} backend closure evidence item${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Evidence Review') return `${evidenceReviewCount} backend closure evidence item${evidenceReviewCount === 1 ? '' : 's'} need review.`
  if (status === 'Ready For Closure') return `${readyForClosureCount} backend handler${readyForClosureCount === 1 ? '' : 's'} are ready for closure packets.`
  if (status === 'Packet Ready') return `${packetReadyCount} backend closure packet${packetReadyCount === 1 ? '' : 's'} are ready.`
  return `${closedCount} backend closure evidence packet${closedCount === 1 ? '' : 's'} are closed.`
}

function getClosureSummary(
  item: BackendWatchItem,
  missingCount: number,
  reviewCount: number,
  requiredReadyCount: number,
  requiredCount: number,
) {
  if (missingCount) return `${item.handlerLabel} is blocked by ${missingCount} missing closure evidence check${missingCount === 1 ? '' : 's'}.`
  if (reviewCount) return `${item.handlerLabel} has ${reviewCount} closure evidence check${reviewCount === 1 ? '' : 's'} needing review.`
  return `${item.handlerLabel} has ${requiredReadyCount}/${requiredCount} required closure evidence checks ready or verified.`
}

function getClosurePlan(item: BackendWatchItem, missingCount: number, reviewCount: number) {
  if (missingCount) return `Resolve missing evidence before ${item.handlerLabel} can be represented in backend launch closure.`
  if (reviewCount) return `Record closure evidence review and annotate accepted evidence gaps for ${item.handlerLabel}.`
  return `Export ${item.handlerLabel} backend closure packet and attach it to final Launch Closure review.`
}

function getNextStep(
  status: BackendClosureEvidenceStatus,
  handlerLabel: string,
  missingCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return `Resolve ${missingCount} missing backend closure evidence check${missingCount === 1 ? '' : 's'} for ${handlerLabel}.`
  if (status === 'Evidence Review') return `Review ${reviewCount} backend closure evidence check${reviewCount === 1 ? '' : 's'} for ${handlerLabel}.`
  if (status === 'Ready For Closure') return `Record packet-ready evidence for ${handlerLabel}.`
  if (status === 'Packet Ready') return `Export and attach ${handlerLabel} closure evidence packet.`
  return `${handlerLabel} backend closure evidence is closed.`
}

function defaultClosureNote(status: BackendClosureEvidenceStatus, item: BackendClosureEvidenceItem) {
  if (status === 'Closed') return `${item.handlerLabel} backend closure evidence closed.`
  if (status === 'Packet Ready') return `${item.handlerLabel} closure packet ready.`
  if (status === 'Ready For Closure') return `${item.handlerLabel} ready for backend closure.`
  if (status === 'Evidence Review') return `${item.handlerLabel} backend closure evidence needs review.`
  return `${item.handlerLabel} backend closure evidence remains blocked.`
}

function getLatestRecordByItem(records: BackendClosureEvidenceRecord[]) {
  const latestRecordByItem = new Map<string, BackendClosureEvidenceRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getItemId(item: BackendWatchItem) {
  return `backend-closure-evidence-${item.id}`
}

function statusRank(status: BackendClosureEvidenceStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Evidence Review') return 4
  if (status === 'Ready For Closure') return 3
  if (status === 'Packet Ready') return 2
  return 1
}

function priorityRank(priority: BackendImplementationPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function emitBackendClosureEvidenceRecordChange() {
  listeners.forEach(listener => listener())
}
