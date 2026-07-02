import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchCommsApprovalAudience,
  LaunchCommsApprovalChannel,
} from './launchCommunicationsApprovalCenter'
import type { LaunchPostLaunchIncidentSeverity } from './launchPostLaunchIncidentCommander'
import type { LaunchPostLaunchSurface } from './launchPostLaunchWatchtower'
import type {
  LaunchSendReviewItem,
  LaunchSendReviewQueue,
} from './launchSendReviewQueue'

export type LaunchDeliveryEvidenceLedgerStatus = 'Evidence Needed' | 'Proof Review' | 'Evidence Complete' | 'Clear'
export type LaunchDeliveryEvidenceItemStatus = 'Needs Proof' | 'Proof Review' | 'Evidence Complete' | 'Blocked'
export type LaunchDeliveryEvidenceCheckStatus = 'Missing' | 'Review' | 'Ready'

export interface LaunchDeliveryEvidenceCheck {
  id: string
  label: string
  status: LaunchDeliveryEvidenceCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchDeliveryEvidenceItem {
  id: string
  title: string
  status: LaunchDeliveryEvidenceItemStatus
  sourceSendReviewId: string
  sourceSendReviewTitle: string
  sourceSendReviewStatus: LaunchSendReviewItem['status']
  sourceDraftTitle: string
  sourceIncidentTitle: string
  audience: LaunchCommsApprovalAudience
  channel: LaunchCommsApprovalChannel
  severity: LaunchPostLaunchIncidentSeverity
  reference: string
  surface: LaunchPostLaunchSurface
  owner: string
  approvalOwner: string
  sendOwner: string
  proofOwner: string
  deliveryState: string
  recipientScope: string
  deliveryProof: string
  correctionPlan: string
  evidence: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  customerFacing: boolean
  actionRequired: boolean
  checks: LaunchDeliveryEvidenceCheck[]
}

export interface LaunchDeliveryEvidenceAudienceGroup {
  audience: LaunchCommsApprovalAudience
  total: number
  needsProof: number
  proofReview: number
  complete: number
  blocked: number
  nextStep: string
}

export interface LaunchDeliveryEvidenceOwnerGroup {
  owner: string
  total: number
  customerFacing: number
  needsProof: number
  proofReview: number
  complete: number
  blocked: number
  nextStep: string
}

export interface LaunchDeliveryEvidenceRecord {
  id: string
  itemId?: string
  itemTitle?: string
  audience?: LaunchCommsApprovalAudience
  channel?: LaunchCommsApprovalChannel
  itemStatus: LaunchDeliveryEvidenceItemStatus
  ledgerStatus: LaunchDeliveryEvidenceLedgerStatus
  needsProofCount: number
  proofReviewCount: number
  completeCount: number
  blockedCount: number
  customerFacingCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchDeliveryEvidenceLedger {
  status: LaunchDeliveryEvidenceLedgerStatus
  headline: string
  summary: string
  generatedAt: string
  items: LaunchDeliveryEvidenceItem[]
  nextItem?: LaunchDeliveryEvidenceItem
  needsProofCount: number
  proofReviewCount: number
  completeCount: number
  blockedCount: number
  customerFacingCount: number
  internalCount: number
  ownerUpdateCount: number
  auditBackedCount: number
  actionRequiredCount: number
  sourceHandoffCount: number
  recordCount: number
  latestRecord?: LaunchDeliveryEvidenceRecord
  audienceGroups: LaunchDeliveryEvidenceAudienceGroup[]
  ownerGroups: LaunchDeliveryEvidenceOwnerGroup[]
}

interface BuildLaunchDeliveryEvidenceLedgerInput {
  sendReviewQueue: LaunchSendReviewQueue
  records: LaunchDeliveryEvidenceRecord[]
}

interface SaveLaunchDeliveryEvidenceRecordInput {
  ledger: LaunchDeliveryEvidenceLedger
  item?: LaunchDeliveryEvidenceItem
  itemStatus?: LaunchDeliveryEvidenceItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_delivery_evidence_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchDeliveryEvidenceRecord[] = []

export const launchDeliveryEvidenceBoundaryRule =
  'Launch Delivery Evidence Ledger captures proof, recipient scope, correction notes, and audit records after send-review handoff. Recording, exporting, or queueing evidence review does not send customer messages, publish notices, mutate customer data, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchDeliveryEvidenceLedger(input: BuildLaunchDeliveryEvidenceLedgerInput): LaunchDeliveryEvidenceLedger {
  const generatedAt = new Date().toISOString()
  const items = input.sendReviewQueue.items
    .map(item => itemFromSendReviewItem(item, input.records))
    .sort((a, b) => itemStatusRank(a.status) - itemStatusRank(b.status) || audienceRank(a.audience) - audienceRank(b.audience) || severityRank(a.severity) - severityRank(b.severity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const needsProofCount = items.filter(item => item.status === 'Needs Proof').length
  const proofReviewCount = items.filter(item => item.status === 'Proof Review').length
  const completeCount = items.filter(item => item.status === 'Evidence Complete').length
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const customerFacingCount = items.filter(item => item.customerFacing).length
  const status = getAggregateStatus(items, needsProofCount, proofReviewCount, blockedCount)

  return {
    status,
    headline: getHeadline(status, needsProofCount, proofReviewCount, blockedCount, completeCount),
    summary: getSummary(status, items.length, needsProofCount, proofReviewCount, customerFacingCount, blockedCount),
    generatedAt,
    items,
    nextItem: items.find(item => item.status === 'Blocked' || item.status === 'Needs Proof' || item.status === 'Proof Review') ?? items[0],
    needsProofCount,
    proofReviewCount,
    completeCount,
    blockedCount,
    customerFacingCount,
    internalCount: items.filter(item => item.audience === 'Internal').length,
    ownerUpdateCount: items.filter(item => item.audience === 'Owner').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    actionRequiredCount: items.filter(item => item.actionRequired).length,
    sourceHandoffCount: items.filter(item => item.sourceSendReviewStatus === 'Handoff Queued' || item.sourceSendReviewStatus === 'Approved For Send').length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    audienceGroups: buildAudienceGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchDeliveryEvidenceRecords(): LaunchDeliveryEvidenceRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchDeliveryEvidenceRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchDeliveryEvidenceRecord(input: SaveLaunchDeliveryEvidenceRecordInput) {
  const record: LaunchDeliveryEvidenceRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    audience: input.item?.audience,
    channel: input.item?.channel,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Needs Proof',
    ledgerStatus: input.ledger.status,
    needsProofCount: input.ledger.needsProofCount,
    proofReviewCount: input.ledger.proofReviewCount,
    completeCount: input.ledger.completeCount,
    blockedCount: input.ledger.blockedCount,
    customerFacingCount: input.ledger.customerFacingCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchDeliveryEvidenceRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchDeliveryEvidenceRecordChange()
  return record
}

export function subscribeToLaunchDeliveryEvidenceRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchDeliveryEvidenceRecords() {
  return useSyncExternalStore(subscribeToLaunchDeliveryEvidenceRecords, getLaunchDeliveryEvidenceRecords, () => [])
}

export function getLaunchDeliveryEvidenceLedgerTone(status: LaunchDeliveryEvidenceLedgerStatus) {
  if (status === 'Evidence Needed') return 'warn' as const
  if (status === 'Proof Review') return 'info' as const
  return 'ok' as const
}

export function getLaunchDeliveryEvidenceMetricTone(status: LaunchDeliveryEvidenceLedgerStatus) {
  if (status === 'Evidence Needed') return 'warn' as const
  if (status === 'Proof Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchDeliveryEvidenceItemTone(status: LaunchDeliveryEvidenceItemStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Proof') return 'warn' as const
  if (status === 'Proof Review') return 'info' as const
  return 'ok' as const
}

export function getLaunchDeliveryEvidenceAudienceTone(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 'warn' as const
  if (audience === 'Internal') return 'info' as const
  return 'neutral' as const
}

export function getLaunchDeliveryEvidenceCheckTone(status: LaunchDeliveryEvidenceCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchDeliveryEvidenceFilename(ledger: LaunchDeliveryEvidenceLedger) {
  return `launch-delivery-evidence-ledger-${ledger.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchDeliveryEvidenceHtml(ledger: LaunchDeliveryEvidenceLedger, session: AdminSession) {
  const rows = ledger.items.map(item => `
    <tr>
      <td>${escapeHtml(item.audience)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.channel)}</td>
      <td>${escapeHtml(item.proofOwner)}</td>
      <td>${escapeHtml(item.recipientScope)}</td>
      <td>${escapeHtml(item.deliveryProof)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Delivery Evidence Ledger</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17211c; margin: 40px; background: #f8faf7; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 28px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { border: 1px solid #d8e0d7; border-radius: 8px; padding: 14px; background: #fff; }
      .card span { display: block; color: #66736b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .card strong { display: block; margin-top: 8px; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8e0d7; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e8eee7; vertical-align: top; }
      th { color: #516157; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .notice { border-left: 4px solid #7a8f5f; padding: 14px; background: #fff; margin: 20px 0; }
    </style>
  </head>
  <body>
    <p>Happy Chair Platform Admin</p>
    <h1>${escapeHtml(ledger.headline)}</h1>
    <p>${escapeHtml(ledger.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(ledger.status)}</strong></div>
      <div class="card"><span>Needs Proof</span><strong>${ledger.needsProofCount}</strong></div>
      <div class="card"><span>Proof Review</span><strong>${ledger.proofReviewCount}</strong></div>
      <div class="card"><span>Evidence Complete</span><strong>${ledger.completeCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(ledger.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is delivery evidence only and does not send customer messages, publish notices, or mutate production state.
    </div>
    <h2>Delivery Evidence Items</h2>
    <table>
      <thead><tr><th>Audience</th><th>Status</th><th>Item</th><th>Channel</th><th>Proof Owner</th><th>Recipient Scope</th><th>Delivery Proof</th><th>Next Step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No send-review items are ready for delivery evidence.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function itemFromSendReviewItem(item: LaunchSendReviewItem, records: LaunchDeliveryEvidenceRecord[]): LaunchDeliveryEvidenceItem {
  const id = `delivery-evidence-${item.id}`
  const latestRecord = records.find(record => record.itemId === id)
  const status = latestRecord?.itemStatus ?? defaultStatusForSendReviewItem(item)
  const proofOwner = proofOwnerForItem(item)

  return {
    id,
    title: `Delivery evidence: ${item.sourceDraftTitle}`,
    status,
    sourceSendReviewId: item.id,
    sourceSendReviewTitle: item.title,
    sourceSendReviewStatus: item.status,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    audience: item.audience,
    channel: item.channel,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    approvalOwner: item.approvalOwner,
    sendOwner: item.sendOwner,
    proofOwner,
    deliveryState: deliveryStateForItem(item),
    recipientScope: recipientScopeForItem(item),
    deliveryProof: deliveryProofForItem(item),
    correctionPlan: correctionPlanForItem(item),
    evidence: item.evidence,
    nextStep: nextStepForItem(status, item),
    responseWindow: item.responseWindow,
    updatedAt: latestRecord?.recordedAt ?? item.updatedAt,
    auditBacked: item.auditBacked,
    customerFacing: item.customerFacing,
    actionRequired: status === 'Needs Proof' || status === 'Proof Review' || status === 'Blocked',
    checks: buildChecks(item, status),
  }
}

function defaultStatusForSendReviewItem(item: LaunchSendReviewItem): LaunchDeliveryEvidenceItemStatus {
  if (item.status === 'Blocked') return 'Blocked'
  if (item.status === 'Approved For Send') return 'Proof Review'
  return 'Needs Proof'
}

function buildChecks(item: LaunchSendReviewItem, status: LaunchDeliveryEvidenceItemStatus): LaunchDeliveryEvidenceCheck[] {
  const sendReviewReady = item.status === 'Handoff Queued' || item.status === 'Approved For Send'

  return [
    {
      id: `${item.id}-handoff`,
      label: 'Send-review handoff is present',
      status: item.status === 'Blocked' ? 'Missing' : sendReviewReady ? 'Ready' : 'Review',
      evidence: item.status,
      required: true,
    },
    {
      id: `${item.id}-recipient-scope`,
      label: 'Recipient scope is captured',
      status: item.customerFacing && status !== 'Evidence Complete' ? 'Review' : 'Ready',
      evidence: recipientScopeForItem(item),
      required: true,
    },
    {
      id: `${item.id}-delivery-proof`,
      label: 'Delivery proof is attached',
      status: status === 'Evidence Complete' ? 'Ready' : status === 'Proof Review' ? 'Review' : 'Missing',
      evidence: deliveryProofForItem(item),
      required: true,
    },
    {
      id: `${item.id}-correction-path`,
      label: 'Correction path is available',
      status: item.status === 'Blocked' ? 'Review' : 'Ready',
      evidence: correctionPlanForItem(item),
      required: item.customerFacing,
    },
    {
      id: `${item.id}-audit`,
      label: 'Audit-backed source evidence is attached',
      status: item.auditBacked ? 'Ready' : 'Review',
      evidence: item.auditBacked ? 'Send-review source is audit backed.' : 'Source audit evidence still needs review.',
      required: true,
    },
  ]
}

function buildAudienceGroups(items: LaunchDeliveryEvidenceItem[]): LaunchDeliveryEvidenceAudienceGroup[] {
  return (['Customer', 'Internal', 'Owner'] as LaunchCommsApprovalAudience[]).map(audience => {
    const rows = items.filter(item => item.audience === audience)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Proof' || item.status === 'Proof Review') ?? rows[0]
    return {
      audience,
      total: rows.length,
      needsProof: rows.filter(item => item.status === 'Needs Proof').length,
      proofReview: rows.filter(item => item.status === 'Proof Review').length,
      complete: rows.filter(item => item.status === 'Evidence Complete').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No delivery evidence item for this audience.',
    }
  }).filter(group => group.total > 0)
}

function buildOwnerGroups(items: LaunchDeliveryEvidenceItem[]): LaunchDeliveryEvidenceOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.proofOwner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.proofOwner === owner)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Proof' || item.status === 'Proof Review') ?? rows[0]
    return {
      owner,
      total: rows.length,
      customerFacing: rows.filter(item => item.customerFacing).length,
      needsProof: rows.filter(item => item.status === 'Needs Proof').length,
      proofReview: rows.filter(item => item.status === 'Proof Review').length,
      complete: rows.filter(item => item.status === 'Evidence Complete').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No delivery proof follow-up needed.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.needsProof - a.needsProof || b.proofReview - a.proofReview || a.owner.localeCompare(b.owner))
}

function proofOwnerForItem(item: LaunchSendReviewItem) {
  if (item.audience === 'Customer') return 'Support Lead'
  if (item.audience === 'Owner') return 'Owner'
  return item.sendOwner
}

function deliveryStateForItem(item: LaunchSendReviewItem) {
  if (item.status === 'Approved For Send') return 'Send review approved; delivery proof must be attached after the approved workflow completes.'
  if (item.status === 'Handoff Queued') return 'Send-review handoff is queued; proof owner must attach delivery evidence when complete.'
  if (item.status === 'Blocked') return 'Delivery evidence is blocked until send-review scope, approval, or evidence is corrected.'
  return 'Send review is still pending; delivery evidence is not complete.'
}

function recipientScopeForItem(item: LaunchSendReviewItem) {
  if (item.audience === 'Customer') return `Customer recipient list for ${item.reference}; final scope must match approved ${item.channel} handoff.`
  if (item.audience === 'Owner') return `Owner update recipients tied to ${item.reference} and launch decision thread.`
  return `Internal launch responders tied to ${item.reference} and ${item.sourceIncidentTitle}.`
}

function deliveryProofForItem(item: LaunchSendReviewItem) {
  if (item.audience === 'Customer') return 'Attach delivery timestamp, sender, approved copy, recipient scope snapshot, and correction path from the customer messaging workflow.'
  if (item.audience === 'Owner') return 'Attach owner-thread acknowledgement, timestamp, approved copy, and follow-up owner.'
  return 'Attach internal timeline entry, receiving team acknowledgement, timestamp, and incident reference.'
}

function correctionPlanForItem(item: LaunchSendReviewItem) {
  if (item.audience === 'Customer') return 'If delivery scope or wording is wrong, hold evidence completion, prepare a corrected update, and route through owner approval before any follow-up.'
  if (item.audience === 'Owner') return 'If owner update is stale, add corrected context to the launch decision thread and record the correction in the audit trail.'
  return 'If internal delivery is incomplete, resend through the governed internal channel and attach the corrected timeline entry.'
}

function nextStepForItem(status: LaunchDeliveryEvidenceItemStatus, item: LaunchSendReviewItem) {
  if (status === 'Evidence Complete') return 'Monitor recipient response and retain proof in the launch evidence packet.'
  if (status === 'Proof Review') return 'Review attached proof for timestamp, recipient scope, approved wording, and correction path before closing evidence.'
  if (status === 'Blocked') return 'Hold evidence completion until send-review scope, approval, or delivery proof is corrected.'
  if (item.status === 'Needs Send Review') return 'Complete send review handoff before accepting delivery evidence.'
  return 'Attach delivery proof and recipient scope, then mark the evidence ready for review.'
}

function getAggregateStatus(
  items: LaunchDeliveryEvidenceItem[],
  needsProofCount: number,
  proofReviewCount: number,
  blockedCount: number,
): LaunchDeliveryEvidenceLedgerStatus {
  if (!items.length) return 'Clear'
  if (blockedCount || needsProofCount) return 'Evidence Needed'
  if (proofReviewCount) return 'Proof Review'
  return 'Evidence Complete'
}

function getHeadline(
  status: LaunchDeliveryEvidenceLedgerStatus,
  needsProofCount: number,
  proofReviewCount: number,
  blockedCount: number,
  completeCount: number,
) {
  if (status === 'Evidence Needed') return `${needsProofCount + blockedCount} delivery evidence item${needsProofCount + blockedCount === 1 ? '' : 's'} need proof`
  if (status === 'Proof Review') return `${proofReviewCount} delivery proof item${proofReviewCount === 1 ? '' : 's'} need review`
  if (status === 'Evidence Complete') return `${completeCount} delivery evidence item${completeCount === 1 ? '' : 's'} complete`
  return 'No send-review items are ready for delivery evidence'
}

function getSummary(
  status: LaunchDeliveryEvidenceLedgerStatus,
  total: number,
  needsProofCount: number,
  proofReviewCount: number,
  customerFacingCount: number,
  blockedCount: number,
) {
  if (status === 'Evidence Needed') return `${needsProofCount} of ${total} delivery evidence items need proof and ${blockedCount} are blocked, including ${customerFacingCount} customer-facing items.`
  if (status === 'Proof Review') return `${proofReviewCount} delivery proof items are ready for human review before evidence closure.`
  if (status === 'Evidence Complete') return `${total} delivery evidence items have proof captured and are available for launch packet retention.`
  return 'No send-review items are currently ready for delivery evidence.'
}

function itemStatusRank(status: LaunchDeliveryEvidenceItemStatus) {
  if (status === 'Blocked') return 0
  if (status === 'Needs Proof') return 1
  if (status === 'Proof Review') return 2
  return 3
}

function audienceRank(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 0
  if (audience === 'Owner') return 1
  return 2
}

function severityRank(severity: LaunchPostLaunchIncidentSeverity) {
  if (severity === 'SEV1') return 1
  if (severity === 'SEV2') return 2
  if (severity === 'SEV3') return 3
  return 4
}

function emitLaunchDeliveryEvidenceRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
