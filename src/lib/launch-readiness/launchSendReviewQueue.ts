import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchCommsApprovalAudience,
  LaunchCommsApprovalCenter,
  LaunchCommsApprovalChannel,
  LaunchCommsApprovalDraft,
} from './launchCommunicationsApprovalCenter'
import type { LaunchPostLaunchIncidentSeverity } from './launchPostLaunchIncidentCommander'
import type { LaunchPostLaunchSurface } from './launchPostLaunchWatchtower'

export type LaunchSendReviewQueueStatus = 'Review Needed' | 'Ready For Handoff' | 'Monitoring' | 'Clear'
export type LaunchSendReviewItemStatus = 'Needs Send Review' | 'Handoff Queued' | 'Approved For Send' | 'Blocked'
export type LaunchSendReviewCheckStatus = 'Missing' | 'Review' | 'Ready'

export interface LaunchSendReviewCheck {
  id: string
  label: string
  status: LaunchSendReviewCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchSendReviewItem {
  id: string
  title: string
  status: LaunchSendReviewItemStatus
  audience: LaunchCommsApprovalAudience
  channel: LaunchCommsApprovalChannel
  sourceDraftId: string
  sourceDraftTitle: string
  sourceIncidentTitle: string
  severity: LaunchPostLaunchIncidentSeverity
  reference: string
  surface: LaunchPostLaunchSurface
  owner: string
  approvalOwner: string
  sendOwner: string
  draft: string
  deliveryPlan: string
  sendGuardrail: string
  rollbackPlan: string
  evidence: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  customerFacing: boolean
  actionRequired: boolean
  checks: LaunchSendReviewCheck[]
}

export interface LaunchSendReviewAudienceGroup {
  audience: LaunchCommsApprovalAudience
  total: number
  needsReview: number
  handoffQueued: number
  approved: number
  blocked: number
  nextStep: string
}

export interface LaunchSendReviewOwnerGroup {
  owner: string
  total: number
  customerFacing: number
  needsReview: number
  handoffQueued: number
  approved: number
  nextStep: string
}

export interface LaunchSendReviewRecord {
  id: string
  itemId?: string
  itemTitle?: string
  audience?: LaunchCommsApprovalAudience
  channel?: LaunchCommsApprovalChannel
  itemStatus: LaunchSendReviewItemStatus
  queueStatus: LaunchSendReviewQueueStatus
  pendingReviewCount: number
  handoffQueuedCount: number
  approvedCount: number
  blockedCount: number
  customerFacingCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchSendReviewQueue {
  status: LaunchSendReviewQueueStatus
  headline: string
  summary: string
  generatedAt: string
  items: LaunchSendReviewItem[]
  nextItem?: LaunchSendReviewItem
  pendingReviewCount: number
  handoffQueuedCount: number
  approvedCount: number
  blockedCount: number
  customerFacingCount: number
  internalCount: number
  ownerUpdateCount: number
  auditBackedCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchSendReviewRecord
  audienceGroups: LaunchSendReviewAudienceGroup[]
  ownerGroups: LaunchSendReviewOwnerGroup[]
}

interface BuildLaunchSendReviewQueueInput {
  communicationsCenter: LaunchCommsApprovalCenter
  records: LaunchSendReviewRecord[]
}

interface SaveLaunchSendReviewRecordInput {
  queue: LaunchSendReviewQueue
  item?: LaunchSendReviewItem
  itemStatus?: LaunchSendReviewItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_send_review_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchSendReviewRecord[] = []

export const launchSendReviewBoundaryRule =
  'Launch Send Review Queue creates governed handoff evidence for approved communication drafts only. Recording, exporting, or queueing a send review does not send customer messages, publish notices, change incident state, mutate customer data, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchSendReviewQueue(input: BuildLaunchSendReviewQueueInput): LaunchSendReviewQueue {
  const generatedAt = new Date().toISOString()
  const items = input.communicationsCenter.drafts
    .filter(draft => draft.status === 'Approved Draft')
    .map(draft => itemFromDraft(draft, input.records))
    .sort((a, b) => itemStatusRank(a.status) - itemStatusRank(b.status) || audienceRank(a.audience) - audienceRank(b.audience) || severityRank(a.severity) - severityRank(b.severity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const pendingReviewCount = items.filter(item => item.status === 'Needs Send Review').length
  const handoffQueuedCount = items.filter(item => item.status === 'Handoff Queued').length
  const approvedCount = items.filter(item => item.status === 'Approved For Send').length
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const customerFacingCount = items.filter(item => item.customerFacing).length
  const status: LaunchSendReviewQueueStatus = blockedCount || pendingReviewCount
    ? 'Review Needed'
    : handoffQueuedCount
      ? 'Ready For Handoff'
      : items.length
        ? 'Monitoring'
        : 'Clear'

  return {
    status,
    headline: getHeadline(status, pendingReviewCount, handoffQueuedCount, customerFacingCount),
    summary: getSummary(status, items.length, pendingReviewCount, customerFacingCount, blockedCount),
    generatedAt,
    items,
    nextItem: items.find(item => item.status === 'Blocked' || item.status === 'Needs Send Review') ?? items[0],
    pendingReviewCount,
    handoffQueuedCount,
    approvedCount,
    blockedCount,
    customerFacingCount,
    internalCount: items.filter(item => item.audience === 'Internal').length,
    ownerUpdateCount: items.filter(item => item.audience === 'Owner').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    actionRequiredCount: items.filter(item => item.actionRequired).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    audienceGroups: buildAudienceGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchSendReviewRecords(): LaunchSendReviewRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchSendReviewRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchSendReviewRecord(input: SaveLaunchSendReviewRecordInput) {
  const record: LaunchSendReviewRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    audience: input.item?.audience,
    channel: input.item?.channel,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Needs Send Review',
    queueStatus: input.queue.status,
    pendingReviewCount: input.queue.pendingReviewCount,
    handoffQueuedCount: input.queue.handoffQueuedCount,
    approvedCount: input.queue.approvedCount,
    blockedCount: input.queue.blockedCount,
    customerFacingCount: input.queue.customerFacingCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchSendReviewRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchSendReviewRecordChange()
  return record
}

export function subscribeToLaunchSendReviewRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchSendReviewRecords() {
  return useSyncExternalStore(subscribeToLaunchSendReviewRecords, getLaunchSendReviewRecords, () => [])
}

export function getLaunchSendReviewQueueTone(status: LaunchSendReviewQueueStatus) {
  if (status === 'Review Needed') return 'warn' as const
  if (status === 'Ready For Handoff' || status === 'Clear') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchSendReviewItemTone(status: LaunchSendReviewItemStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Send Review') return 'warn' as const
  if (status === 'Handoff Queued' || status === 'Approved For Send') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchSendReviewAudienceTone(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 'warn' as const
  if (audience === 'Internal') return 'info' as const
  return 'neutral' as const
}

export function getLaunchSendReviewCheckTone(status: LaunchSendReviewCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchSendReviewMetricTone(status: LaunchSendReviewQueueStatus) {
  if (status === 'Review Needed') return 'warn' as const
  if (status === 'Ready For Handoff' || status === 'Clear') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchSendReviewFilename(queue: LaunchSendReviewQueue) {
  return `launch-send-review-queue-${queue.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchSendReviewHtml(queue: LaunchSendReviewQueue, session: AdminSession) {
  const rows = queue.items.map(item => `
    <tr>
      <td>${escapeHtml(item.audience)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.channel)}</td>
      <td>${escapeHtml(item.sendOwner)}</td>
      <td>${escapeHtml(item.deliveryPlan)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Send Review Queue</title>
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
    <h1>${escapeHtml(queue.headline)}</h1>
    <p>${escapeHtml(queue.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(queue.status)}</strong></div>
      <div class="card"><span>Needs Review</span><strong>${queue.pendingReviewCount}</strong></div>
      <div class="card"><span>Handoff Queued</span><strong>${queue.handoffQueuedCount}</strong></div>
      <div class="card"><span>Customer Facing</span><strong>${queue.customerFacingCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(queue.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is send-review handoff evidence only and does not send or publish messages.
    </div>
    <h2>Send Review Items</h2>
    <table>
      <thead><tr><th>Audience</th><th>Status</th><th>Item</th><th>Channel</th><th>Owner</th><th>Delivery Plan</th><th>Next Step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No approved communication drafts are ready for send review.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function itemFromDraft(draft: LaunchCommsApprovalDraft, records: LaunchSendReviewRecord[]): LaunchSendReviewItem {
  const id = `send-review-${draft.id}`
  const latestRecord = records.find(record => record.itemId === id)
  const status = latestRecord?.itemStatus ?? 'Needs Send Review'

  return {
    id,
    title: `Send review: ${draft.title}`,
    status,
    audience: draft.audience,
    channel: draft.channel,
    sourceDraftId: draft.id,
    sourceDraftTitle: draft.title,
    sourceIncidentTitle: draft.sourceIncidentTitle,
    severity: draft.severity,
    reference: draft.reference,
    surface: draft.surface,
    owner: draft.owner,
    approvalOwner: draft.approvalOwner,
    sendOwner: sendOwnerForDraft(draft),
    draft: draft.draft,
    deliveryPlan: deliveryPlanForDraft(draft),
    sendGuardrail: guardrailForDraft(draft),
    rollbackPlan: rollbackPlanForDraft(draft),
    evidence: draft.evidence,
    nextStep: nextStepForItem(status, draft),
    responseWindow: draft.responseWindow,
    updatedAt: latestRecord?.recordedAt ?? draft.updatedAt,
    auditBacked: draft.auditBacked,
    customerFacing: draft.audience === 'Customer',
    actionRequired: status === 'Needs Send Review' || status === 'Blocked',
    checks: buildChecks(draft, status),
  }
}

function buildChecks(draft: LaunchCommsApprovalDraft, status: LaunchSendReviewItemStatus): LaunchSendReviewCheck[] {
  return [
    {
      id: `${draft.id}-approval`,
      label: 'Communication approval evidence is present',
      status: draft.status === 'Approved Draft' ? 'Ready' : 'Missing',
      evidence: draft.status,
      required: true,
    },
    {
      id: `${draft.id}-recipient-scope`,
      label: 'Audience and channel are scoped',
      status: draft.audience === 'Customer' && draft.channel === 'Internal Brief' ? 'Missing' : 'Ready',
      evidence: `${draft.audience} / ${draft.channel}`,
      required: true,
    },
    {
      id: `${draft.id}-human-confirmation`,
      label: 'Final send requires human confirmation',
      status: status === 'Approved For Send' || status === 'Handoff Queued' ? 'Ready' : 'Review',
      evidence: 'No browser-side send path is available from Platform Admin.',
      required: draft.audience === 'Customer',
    },
    {
      id: `${draft.id}-audit`,
      label: 'Audit-backed source evidence attached',
      status: draft.auditBacked ? 'Ready' : 'Review',
      evidence: draft.auditBacked ? 'Source communication is audit backed.' : 'Audit source evidence is still pending.',
      required: true,
    },
  ]
}

function buildAudienceGroups(items: LaunchSendReviewItem[]): LaunchSendReviewAudienceGroup[] {
  return (['Customer', 'Internal', 'Owner'] as LaunchCommsApprovalAudience[]).map(audience => {
    const rows = items.filter(item => item.audience === audience)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Send Review') ?? rows[0]
    return {
      audience,
      total: rows.length,
      needsReview: rows.filter(item => item.status === 'Needs Send Review').length,
      handoffQueued: rows.filter(item => item.status === 'Handoff Queued').length,
      approved: rows.filter(item => item.status === 'Approved For Send').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No send review item for this audience.',
    }
  }).filter(group => group.total > 0)
}

function buildOwnerGroups(items: LaunchSendReviewItem[]): LaunchSendReviewOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.sendOwner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.sendOwner === owner)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Send Review') ?? rows[0]
    return {
      owner,
      total: rows.length,
      customerFacing: rows.filter(item => item.customerFacing).length,
      needsReview: rows.filter(item => item.status === 'Needs Send Review').length,
      handoffQueued: rows.filter(item => item.status === 'Handoff Queued').length,
      approved: rows.filter(item => item.status === 'Approved For Send').length,
      nextStep: nextItem?.nextStep ?? 'No send review handoff needed.',
    }
  }).sort((a, b) => b.needsReview - a.needsReview || b.customerFacing - a.customerFacing || a.owner.localeCompare(b.owner))
}

function sendOwnerForDraft(draft: LaunchCommsApprovalDraft) {
  if (draft.audience === 'Customer') return 'Support Lead'
  if (draft.audience === 'Owner') return 'Owner'
  return draft.owner
}

function deliveryPlanForDraft(draft: LaunchCommsApprovalDraft) {
  if (draft.audience === 'Customer') return `Prepare ${draft.channel} through approved customer messaging workflow after final human confirmation.`
  if (draft.audience === 'Owner') return 'Route owner update into the launch decision thread for acknowledgement.'
  return 'Attach internal brief to the launch incident timeline and notify the owning team.'
}

function guardrailForDraft(draft: LaunchCommsApprovalDraft) {
  if (draft.audience === 'Customer') return 'Verify recipient scope, owner approval, incident status, and final wording before any customer-facing send.'
  return 'Verify draft is still current and linked to the launch incident packet before distribution.'
}

function rollbackPlanForDraft(draft: LaunchCommsApprovalDraft) {
  if (draft.audience === 'Customer') return 'If wording or recipient scope is wrong, hold the send review and prepare a corrected update through owner approval.'
  return 'If information is stale, replace the internal update and record the correction in the incident timeline.'
}

function nextStepForItem(status: LaunchSendReviewItemStatus, draft: LaunchCommsApprovalDraft) {
  if (status === 'Approved For Send') return draft.audience === 'Customer' ? 'Await final human send confirmation in the approved messaging workflow.' : 'Attach approved update to the incident timeline.'
  if (status === 'Handoff Queued') return 'Send-review handoff is queued for governed follow-up.'
  if (status === 'Blocked') return 'Hold send review until scope, evidence, or approval is corrected.'
  return 'Review delivery plan, recipient scope, and guardrails before queueing handoff.'
}

function getHeadline(status: LaunchSendReviewQueueStatus, pendingReviewCount: number, handoffQueuedCount: number, customerFacingCount: number) {
  if (status === 'Review Needed') return `${pendingReviewCount} approved communication draft${pendingReviewCount === 1 ? '' : 's'} need send review`
  if (status === 'Ready For Handoff') return `${handoffQueuedCount} send-review handoff${handoffQueuedCount === 1 ? '' : 's'} queued`
  if (status === 'Monitoring') return `${customerFacingCount} customer-facing send review item${customerFacingCount === 1 ? '' : 's'} under monitoring`
  return 'No communication drafts are ready for send review'
}

function getSummary(status: LaunchSendReviewQueueStatus, total: number, pendingReviewCount: number, customerFacingCount: number, blockedCount: number) {
  if (status === 'Review Needed') return `${pendingReviewCount} of ${total} approved drafts need send review, including ${customerFacingCount} customer-facing items.`
  if (status === 'Ready For Handoff') return `${total} approved communication drafts are routed into governed send-review handoff.`
  if (status === 'Monitoring') return `${total} send-review items are available for monitoring.`
  if (blockedCount) return `${blockedCount} send-review items are blocked.`
  return 'No approved communication drafts are ready for send review.'
}

function itemStatusRank(status: LaunchSendReviewItemStatus) {
  if (status === 'Blocked') return 0
  if (status === 'Needs Send Review') return 1
  if (status === 'Handoff Queued') return 2
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

function emitLaunchSendReviewRecordChange() {
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
