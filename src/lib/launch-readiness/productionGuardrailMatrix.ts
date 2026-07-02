import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendClosureEvidenceBinder,
  BackendClosureEvidenceItem,
  BackendClosureEvidenceStatus,
} from './backendClosureEvidenceBinder'

export type ProductionGuardrailStatus =
  | 'Blocked'
  | 'Guardrail Review'
  | 'Ready For Production Review'
  | 'Verified'

export type ProductionGuardrailCheckStatus = 'Missing' | 'Review' | 'Ready' | 'Verified'
export type ProductionGuardrailCategory =
  | 'Browser Boundary'
  | 'Server Handler'
  | 'Permissions'
  | 'Human Confirmation'
  | 'Audit'
  | 'Rollback'
  | 'Dry Run'
  | 'Support'
  | 'Closure Packet'

export interface ProductionGuardrailCheck {
  id: string
  category: ProductionGuardrailCategory
  label: string
  status: ProductionGuardrailCheckStatus
  detail: string
  guardrail: string
  required: boolean
}

export interface ProductionGuardrailItem {
  id: string
  backendClosureEvidenceItemId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: ProductionGuardrailStatus
  recommendedStatus: ProductionGuardrailStatus
  closureStatus: BackendClosureEvidenceStatus
  watchStatus: string
  releaseStatus: string
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  closureOwner: string
  guardrailOwner: string
  packetLocation: string
  auditEventCount: number
  dryRunProofCount: number
  supportFollowUpCount: number
  browserMutationBlocked: boolean
  serverExecutionRequired: boolean
  humanConfirmationRequired: boolean
  auditRequired: boolean
  rollbackRequired: boolean
  dryRunRequired: boolean
  missingCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  requiredCount: number
  requiredSatisfiedCount: number
  checks: ProductionGuardrailCheck[]
  productionBoundary: string
  verificationPlan: string
  escalationPlan: string
  nextStep: string
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface ProductionGuardrailMatrix {
  status: ProductionGuardrailStatus
  summary: string
  generatedAt: string
  items: ProductionGuardrailItem[]
  nextItem?: ProductionGuardrailItem
  totalCount: number
  blockedCount: number
  reviewCount: number
  readyForReviewCount: number
  verifiedCount: number
  requiredSatisfiedCount: number
  requiredCount: number
  browserSafeCount: number
  permissionedCount: number
  auditBackedCount: number
  rollbackReadyCount: number
  categoryGroups: ProductionGuardrailCategoryGroup[]
  ownerGroups: ProductionGuardrailOwnerGroup[]
}

export interface ProductionGuardrailCategoryGroup {
  category: ProductionGuardrailCategory
  total: number
  missing: number
  review: number
  ready: number
  verified: number
  nextStep: string
}

export interface ProductionGuardrailOwnerGroup {
  owner: string
  total: number
  blocked: number
  review: number
  ready: number
  verified: number
  missingCount: number
  nextStep: string
}

export interface ProductionGuardrailRecord {
  id: string
  itemId: string
  status: ProductionGuardrailStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildProductionGuardrailMatrixInput {
  closureBinder: BackendClosureEvidenceBinder
  records: ProductionGuardrailRecord[]
}

interface SaveProductionGuardrailRecordInput {
  item: ProductionGuardrailItem
  status: ProductionGuardrailStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_production_guardrail_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: ProductionGuardrailRecord[] = []

export const productionGuardrailBoundaryRule =
  'Production guardrail records are safety review artifacts only. They do not execute handlers, deploy code, roll back production, mutate data, change billing, alter modules, change permissions, impersonate users, close releases, or execute agent actions from Platform Admin.'

export const productionGuardrailStatuses: ProductionGuardrailStatus[] = [
  'Blocked',
  'Guardrail Review',
  'Ready For Production Review',
  'Verified',
]

export function buildProductionGuardrailMatrix({
  closureBinder,
  records,
}: BuildProductionGuardrailMatrixInput): ProductionGuardrailMatrix {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const items = closureBinder.items
    .map(item => withLatestRecord(createItem(item, generatedAt), latestRecordByItem.get(getItemId(item))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openItems = items.filter(item => item.status !== 'Verified')
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const reviewCount = items.filter(item => item.status === 'Guardrail Review').length
  const readyForReviewCount = items.filter(item => item.status === 'Ready For Production Review').length
  const verifiedCount = items.filter(item => item.status === 'Verified').length
  const status = getAggregateStatus(items)

  return {
    status,
    summary: getMatrixSummary(status, blockedCount, reviewCount, readyForReviewCount, verifiedCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    blockedCount,
    reviewCount,
    readyForReviewCount,
    verifiedCount,
    requiredSatisfiedCount: items.reduce((total, item) => total + item.requiredSatisfiedCount, 0),
    requiredCount: items.reduce((total, item) => total + item.requiredCount, 0),
    browserSafeCount: items.filter(item => item.browserMutationBlocked).length,
    permissionedCount: items.filter(item => Boolean(item.permission)).length,
    auditBackedCount: items.filter(item => item.auditEventCount > 0 || Boolean(item.auditEventId)).length,
    rollbackReadyCount: items.filter(item => item.checks.some(check => check.category === 'Rollback' && (check.status === 'Ready' || check.status === 'Verified'))).length,
    categoryGroups: buildCategoryGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getProductionGuardrailRecords(): ProductionGuardrailRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as ProductionGuardrailRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveProductionGuardrailRecord(input: SaveProductionGuardrailRecordInput) {
  const record: ProductionGuardrailRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultGuardrailNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getProductionGuardrailRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitProductionGuardrailRecordChange()
  return record
}

export function subscribeToProductionGuardrailRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useProductionGuardrailRecords() {
  return useSyncExternalStore(subscribeToProductionGuardrailRecords, getProductionGuardrailRecords, () => [])
}

export function getProductionGuardrailTone(status: ProductionGuardrailStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready For Production Review') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Guardrail Review') return 'warn'
  return 'neutral'
}

export function getProductionGuardrailCheckTone(status: ProductionGuardrailCheckStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Missing') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getProductionGuardrailRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getProductionGuardrailFilename(item: ProductionGuardrailItem) {
  return `production-guardrail-matrix-${item.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildProductionGuardrailHtml(item: ProductionGuardrailItem, session: AdminSession) {
  const checkRows = item.checks.map(check => `
    <tr>
      <td>${escapeHtml(check.category)}</td>
      <td>${escapeHtml(check.label)}</td>
      <td>${escapeHtml(check.status)}</td>
      <td>${escapeHtml(check.detail)}</td>
      <td>${escapeHtml(check.guardrail)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.handlerLabel)} production guardrail matrix</title>
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
        <p>Happy Chair Platform Admin / Production Guardrail Matrix</p>
        <h1>${escapeHtml(item.handlerLabel)}</h1>
        <p>${escapeHtml(productionGuardrailBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
        <div><span>Closure Status</span><strong>${escapeHtml(item.closureStatus)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(item.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(item.guardrailOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(item.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(item.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${item.method} ${item.endpoint}`)}</strong></div>
        <div><span>Packet</span><strong>${escapeHtml(item.packetLocation)}</strong></div>
      </section>
      <section>
        <h2>Guardrail Checks</h2>
        <table><thead><tr><th>Category</th><th>Guardrail</th><th>Status</th><th>Detail</th><th>Control</th></tr></thead><tbody>${checkRows}</tbody></table>
      </section>
      <section>
        <h2>Production Boundary</h2>
        <p><strong>Boundary:</strong> ${escapeHtml(item.productionBoundary)}</p>
        <p><strong>Verification:</strong> ${escapeHtml(item.verificationPlan)}</p>
        <p><strong>Escalation:</strong> ${escapeHtml(item.escalationPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createItem(
  item: BackendClosureEvidenceItem,
  generatedAt: string,
): ProductionGuardrailItem {
  const checks = buildChecks(item)
  const missingCount = checks.filter(check => check.status === 'Missing').length
  const reviewCount = checks.filter(check => check.status === 'Review').length
  const readyCount = checks.filter(check => check.status === 'Ready').length
  const verifiedCount = checks.filter(check => check.status === 'Verified').length
  const requiredChecks = checks.filter(check => check.required)
  const requiredSatisfiedCount = requiredChecks.filter(check => check.status === 'Ready' || check.status === 'Verified').length
  const recommendedStatus = getRecommendedStatus(missingCount, reviewCount)

  return {
    id: getItemId(item),
    backendClosureEvidenceItemId: item.id,
    handlerKey: item.handlerKey,
    handlerLabel: item.handlerLabel,
    method: item.method,
    endpoint: item.endpoint,
    permission: item.permission,
    mutationMode: item.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    closureStatus: item.status,
    watchStatus: item.watchStatus,
    releaseStatus: item.releaseStatus,
    risk: item.risk,
    productOwner: item.productOwner,
    engineeringOwner: item.engineeringOwner,
    closureOwner: item.closureOwner,
    guardrailOwner: item.closureOwner,
    packetLocation: item.packetLocation,
    auditEventCount: item.auditEventCount,
    dryRunProofCount: item.dryRunProofCount,
    supportFollowUpCount: item.supportFollowUpCount,
    browserMutationBlocked: true,
    serverExecutionRequired: true,
    humanConfirmationRequired: true,
    auditRequired: true,
    rollbackRequired: true,
    dryRunRequired: true,
    missingCount,
    reviewCount,
    readyCount,
    verifiedCount,
    requiredCount: requiredChecks.length,
    requiredSatisfiedCount,
    checks,
    productionBoundary: `${item.handlerLabel} can be coordinated from Platform Admin, but production execution must happen through trusted server handlers with permission checks, audit writes, rollback metadata, and human approval where required.`,
    verificationPlan: getVerificationPlan(item, missingCount, reviewCount),
    escalationPlan: getEscalationPlan(item),
    nextStep: getNextStep(recommendedStatus, item.handlerLabel, missingCount, reviewCount),
    generatedAt,
  }
}

function buildChecks(item: BackendClosureEvidenceItem): ProductionGuardrailCheck[] {
  return [
    check(
      'browser-boundary',
      'Browser Boundary',
      'Browser mutation boundary',
      'Verified',
      'Platform Admin stores review records, local packet state, exports, and queued requests only.',
      'Browser UI must never call production mutation handlers directly.',
      true,
    ),
    check(
      'server-handler',
      'Server Handler',
      'Trusted server execution',
      item.method && item.endpoint ? 'Ready' : 'Missing',
      item.method && item.endpoint ? `${item.method} ${item.endpoint} is represented for server-side execution review.` : 'No trusted server route is attached.',
      'Production work must run through server-side handlers after approval.',
      true,
    ),
    check(
      'permission',
      'Permissions',
      'Permission check',
      item.permission ? 'Ready' : 'Missing',
      item.permission ? `${item.permission} is required before this handler can be executed.` : 'No permission requirement is attached.',
      'Every production action must verify the actor permission server-side.',
      true,
    ),
    check(
      'human-confirmation',
      'Human Confirmation',
      'Human approval path',
      item.status === 'Closed' || item.status === 'Packet Ready' ? 'Verified' : item.status === 'Ready For Closure' ? 'Ready' : item.status === 'Evidence Review' ? 'Review' : 'Missing',
      `Backend closure status is ${item.status}.`,
      'State-changing production work requires visible human approval unless explicitly allowlisted.',
      true,
    ),
    check(
      'audit',
      'Audit',
      'Immutable audit anchor',
      item.auditEventCount || item.auditEventId ? 'Verified' : 'Review',
      item.auditEventCount || item.auditEventId ? `${item.auditEventCount} audit event${item.auditEventCount === 1 ? '' : 's'} plus local evidence are visible.` : 'Audit evidence is not attached yet.',
      'Every meaningful admin, support, finance, module, export, troubleshooting, and agent action must write audit evidence.',
      true,
    ),
    check(
      'rollback',
      'Rollback',
      'Rollback plan',
      item.rollbackPlan ? 'Ready' : 'Missing',
      item.rollbackPlan || 'Rollback plan is missing.',
      'Production handlers must capture rollback notes or rollback metadata before execution.',
      true,
    ),
    check(
      'dry-run',
      'Dry Run',
      'Dry-run proof',
      item.dryRunProofCount ? 'Verified' : 'Review',
      item.dryRunProofCount ? `${item.dryRunProofCount} dry-run proof record${item.dryRunProofCount === 1 ? '' : 's'} are visible.` : 'Dry-run proof is not visible yet.',
      'State-changing handlers should prove validation paths before production execution.',
      true,
    ),
    check(
      'support',
      'Support',
      'Support follow-up state',
      item.supportFollowUpCount ? 'Review' : 'Verified',
      item.supportFollowUpCount ? `${item.supportFollowUpCount} support or engineering follow-up request${item.supportFollowUpCount === 1 ? '' : 's'} remain linked.` : 'No open support follow-up load is linked.',
      'Support-visible follow-up must remain assigned until closure evidence is accepted.',
      true,
    ),
    check(
      'closure-packet',
      'Closure Packet',
      'Closure packet evidence',
      item.status === 'Closed' ? 'Verified' : item.status === 'Packet Ready' || item.reviewedAt || item.auditEventId ? 'Ready' : 'Review',
      item.packetLocation ? `Closure evidence packet location: ${item.packetLocation}.` : 'Closure packet location is not set.',
      'Launch closure must reference an exportable evidence packet before final go/no-go.',
      true,
    ),
  ]
}

function check(
  id: string,
  category: ProductionGuardrailCategory,
  label: string,
  status: ProductionGuardrailCheckStatus,
  detail: string,
  guardrail: string,
  required: boolean,
): ProductionGuardrailCheck {
  return { id, category, label, status, detail, guardrail, required }
}

function withLatestRecord(
  item: ProductionGuardrailItem,
  record: ProductionGuardrailRecord | undefined,
): ProductionGuardrailItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    guardrailOwner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    nextStep: getNextStep(record.status, item.handlerLabel, item.missingCount, item.reviewCount),
  }
}

function buildCategoryGroups(items: ProductionGuardrailItem[]): ProductionGuardrailCategoryGroup[] {
  const categories: ProductionGuardrailCategory[] = [
    'Browser Boundary',
    'Server Handler',
    'Permissions',
    'Human Confirmation',
    'Audit',
    'Rollback',
    'Dry Run',
    'Support',
    'Closure Packet',
  ]
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
          ? `Resolve missing ${category.toLowerCase()} guardrails.`
          : review
            ? `Review ${category.toLowerCase()} guardrails.`
            : ready
              ? `Keep ${category.toLowerCase()} guardrails attached to production review.`
              : `All ${category.toLowerCase()} guardrails are verified.`
        : `No ${category.toLowerCase()} guardrail checks.`,
    }
  })
}

function buildOwnerGroups(items: ProductionGuardrailItem[]): ProductionGuardrailOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.guardrailOwner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.guardrailOwner === owner)
    const blocked = ownerItems.filter(item => item.status === 'Blocked').length
    const review = ownerItems.filter(item => item.status === 'Guardrail Review').length
    const ready = ownerItems.filter(item => item.status === 'Ready For Production Review').length
    const verified = ownerItems.filter(item => item.status === 'Verified').length
    const missingCount = ownerItems.reduce((total, item) => total + item.missingCount, 0)
    return {
      owner,
      total: ownerItems.length,
      blocked,
      review,
      ready,
      verified,
      missingCount,
      nextStep: blocked
        ? 'Clear blocked production guardrails.'
        : review
          ? 'Review guardrail gaps before production review.'
          : ready
            ? 'Record verified guardrail review.'
            : 'Maintain verified production guardrails.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.review - a.review || b.missingCount - a.missingCount || a.owner.localeCompare(b.owner))
}

function getRecommendedStatus(missingCount: number, reviewCount: number): ProductionGuardrailStatus {
  if (missingCount) return 'Blocked'
  if (reviewCount) return 'Guardrail Review'
  return 'Ready For Production Review'
}

function getAggregateStatus(items: ProductionGuardrailItem[]): ProductionGuardrailStatus {
  if (!items.length) return 'Verified'
  if (items.some(item => item.status === 'Blocked')) return 'Blocked'
  if (items.some(item => item.status === 'Guardrail Review')) return 'Guardrail Review'
  if (items.some(item => item.status === 'Ready For Production Review')) return 'Ready For Production Review'
  return 'Verified'
}

function getMatrixSummary(
  status: ProductionGuardrailStatus,
  blockedCount: number,
  reviewCount: number,
  readyForReviewCount: number,
  verifiedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} production guardrail item${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Guardrail Review') return `${reviewCount} production guardrail item${reviewCount === 1 ? '' : 's'} need review.`
  if (status === 'Ready For Production Review') return `${readyForReviewCount} production guardrail item${readyForReviewCount === 1 ? '' : 's'} are ready for review.`
  return `${verifiedCount} production guardrail item${verifiedCount === 1 ? '' : 's'} are verified.`
}

function getVerificationPlan(item: BackendClosureEvidenceItem, missingCount: number, reviewCount: number) {
  if (missingCount) return `Resolve missing production guardrails before ${item.handlerLabel} can enter production review.`
  if (reviewCount) return `Record guardrail review and accepted evidence gaps for ${item.handlerLabel}.`
  return `Attach ${item.handlerLabel} guardrail matrix to launch closure and production review.`
}

function getEscalationPlan(item: BackendClosureEvidenceItem) {
  if (item.supportFollowUpCount) return `Keep ${item.supportFollowUpCount} support or engineering follow-up request${item.supportFollowUpCount === 1 ? '' : 's'} assigned until guardrails are verified.`
  return `Escalate ${item.handlerLabel} only if guardrail evidence drifts, support load appears, or rollback/audit proof becomes stale.`
}

function getNextStep(
  status: ProductionGuardrailStatus,
  handlerLabel: string,
  missingCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return `Resolve ${missingCount} missing production guardrail${missingCount === 1 ? '' : 's'} for ${handlerLabel}.`
  if (status === 'Guardrail Review') return `Review ${reviewCount} production guardrail${reviewCount === 1 ? '' : 's'} for ${handlerLabel}.`
  if (status === 'Ready For Production Review') return `Record verified guardrail review for ${handlerLabel}.`
  return `${handlerLabel} production guardrails are verified.`
}

function defaultGuardrailNote(status: ProductionGuardrailStatus, item: ProductionGuardrailItem) {
  if (status === 'Verified') return `${item.handlerLabel} production guardrails verified.`
  if (status === 'Ready For Production Review') return `${item.handlerLabel} ready for production review.`
  if (status === 'Guardrail Review') return `${item.handlerLabel} production guardrails need review.`
  return `${item.handlerLabel} production guardrails remain blocked.`
}

function getLatestRecordByItem(records: ProductionGuardrailRecord[]) {
  const latestRecordByItem = new Map<string, ProductionGuardrailRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getItemId(item: BackendClosureEvidenceItem) {
  return `production-guardrail-${item.id}`
}

function statusRank(status: ProductionGuardrailStatus) {
  if (status === 'Blocked') return 4
  if (status === 'Guardrail Review') return 3
  if (status === 'Ready For Production Review') return 2
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

function emitProductionGuardrailRecordChange() {
  listeners.forEach(listener => listener())
}
