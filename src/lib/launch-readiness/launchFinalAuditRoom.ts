import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { LaunchClosureEvidencePack } from './launchClosureEvidencePack'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchCommsApprovalCenter } from './launchCommunicationsApprovalCenter'
import type { LaunchDeliveryEvidenceLedger } from './launchDeliveryEvidenceLedger'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchRecipientResponseMonitor } from './launchRecipientResponseMonitor'
import type { LaunchSendReviewQueue } from './launchSendReviewQueue'

export type LaunchFinalAuditRoomStatus = 'Audit Blocked' | 'Audit Review' | 'Ready For Executive Closure' | 'Closed'
export type LaunchFinalAuditItemStatus = 'Blocked' | 'Needs Evidence' | 'Review' | 'Ready' | 'Closed'
export type LaunchFinalAuditCheckStatus = 'Missing' | 'Review' | 'Ready'
export type LaunchFinalAuditStage =
  | 'Launch Gate'
  | 'Communications'
  | 'Send Review'
  | 'Delivery Proof'
  | 'Recipient Replies'
  | 'Closure Pack'
  | 'Executive Closure'

export interface LaunchFinalAuditCheck {
  id: string
  label: string
  status: LaunchFinalAuditCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchFinalAuditItem {
  id: string
  stage: LaunchFinalAuditStage
  title: string
  status: LaunchFinalAuditItemStatus
  sourceStatus: string
  owner: string
  reference: string
  targetView: string
  summary: string
  evidence: string
  nextStep: string
  auditRecordCount: number
  customerFacingCount: number
  actionRequiredCount: number
  readyCount: number
  totalCount: number
  generatedAt: string
  actionRequired: boolean
  checks: LaunchFinalAuditCheck[]
}

export interface LaunchFinalAuditStageGroup {
  stage: LaunchFinalAuditStage
  status: LaunchFinalAuditItemStatus
  owner: string
  sourceStatus: string
  evidence: string
  nextStep: string
}

export interface LaunchFinalAuditOwnerGroup {
  owner: string
  total: number
  blocked: number
  needsEvidence: number
  review: number
  ready: number
  closed: number
  nextStep: string
}

export interface LaunchFinalAuditRecord {
  id: string
  itemId?: string
  itemTitle?: string
  stage?: LaunchFinalAuditStage
  itemStatus: LaunchFinalAuditItemStatus
  roomStatus: LaunchFinalAuditRoomStatus
  blockedCount: number
  needsEvidenceCount: number
  reviewCount: number
  readyCount: number
  closedCount: number
  auditScore: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchFinalAuditRoom {
  status: LaunchFinalAuditRoomStatus
  headline: string
  summary: string
  generatedAt: string
  auditScore: number
  items: LaunchFinalAuditItem[]
  nextItem?: LaunchFinalAuditItem
  blockedCount: number
  needsEvidenceCount: number
  reviewCount: number
  readyCount: number
  closedCount: number
  totalCount: number
  customerFacingCount: number
  auditRecordCount: number
  actionRequiredCount: number
  requiredReadyCount: number
  requiredCount: number
  recordCount: number
  latestRecord?: LaunchFinalAuditRecord
  stageGroups: LaunchFinalAuditStageGroup[]
  ownerGroups: LaunchFinalAuditOwnerGroup[]
}

interface BuildLaunchFinalAuditRoomInput {
  readinessModel: LaunchReadinessModel
  closureModel: LaunchClosureModel
  communicationsCenter: LaunchCommsApprovalCenter
  sendReviewQueue: LaunchSendReviewQueue
  deliveryEvidenceLedger: LaunchDeliveryEvidenceLedger
  recipientResponseMonitor: LaunchRecipientResponseMonitor
  closureEvidencePack: LaunchClosureEvidencePack
  records: LaunchFinalAuditRecord[]
}

interface SaveLaunchFinalAuditRecordInput {
  room: LaunchFinalAuditRoom
  item?: LaunchFinalAuditItem
  itemStatus?: LaunchFinalAuditItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_final_audit_room_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchFinalAuditRecord[] = []

export const launchFinalAuditBoundaryRule =
  'Final Launch Audit Room summarizes launch readiness, communications approval, send review, delivery proof, recipient responses, closure evidence, and executive closure readiness. Recording, exporting, or queueing final audit review does not send messages, publish notices, mutate customer data, close production incidents, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchFinalAuditRoom(input: BuildLaunchFinalAuditRoomInput): LaunchFinalAuditRoom {
  const generatedAt = new Date().toISOString()
  const items = [
    readinessItem(input.readinessModel, input.closureModel, generatedAt),
    communicationsItem(input.communicationsCenter, generatedAt),
    sendReviewItem(input.sendReviewQueue, generatedAt),
    deliveryEvidenceItem(input.deliveryEvidenceLedger, generatedAt),
    recipientResponseItem(input.recipientResponseMonitor, generatedAt),
    closureEvidenceItem(input.closureEvidencePack, generatedAt),
    executiveClosureItem(input.closureModel, input.closureEvidencePack, generatedAt),
  ]
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const needsEvidenceCount = items.filter(item => item.status === 'Needs Evidence').length
  const reviewCount = items.filter(item => item.status === 'Review').length
  const readyCount = items.filter(item => item.status === 'Ready').length
  const closedCount = items.filter(item => item.status === 'Closed').length
  const requiredReadyCount = items.filter(item => item.status === 'Ready' || item.status === 'Closed').length
  const requiredCount = items.length
  const auditScore = Math.round((requiredReadyCount / Math.max(requiredCount, 1)) * 100)
  const status = getAggregateStatus(blockedCount, needsEvidenceCount, reviewCount, readyCount, closedCount)

  return {
    status,
    headline: getHeadline(status, blockedCount, needsEvidenceCount, reviewCount, auditScore),
    summary: getSummary(status, items.length, blockedCount, needsEvidenceCount, reviewCount, auditScore),
    generatedAt,
    auditScore,
    items,
    nextItem: items.find(item => item.status === 'Blocked' || item.status === 'Needs Evidence' || item.status === 'Review') ?? items[0],
    blockedCount,
    needsEvidenceCount,
    reviewCount,
    readyCount,
    closedCount,
    totalCount: items.length,
    customerFacingCount: items.reduce((total, item) => total + item.customerFacingCount, 0),
    auditRecordCount: items.reduce((total, item) => total + item.auditRecordCount, 0),
    actionRequiredCount: items.reduce((total, item) => total + item.actionRequiredCount, 0),
    requiredReadyCount,
    requiredCount,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    stageGroups: items.map(item => ({
      stage: item.stage,
      status: item.status,
      owner: item.owner,
      sourceStatus: item.sourceStatus,
      evidence: item.evidence,
      nextStep: item.nextStep,
    })),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchFinalAuditRecords(): LaunchFinalAuditRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchFinalAuditRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchFinalAuditRecord(input: SaveLaunchFinalAuditRecordInput) {
  const record: LaunchFinalAuditRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    stage: input.item?.stage,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Review',
    roomStatus: input.room.status,
    blockedCount: input.room.blockedCount,
    needsEvidenceCount: input.room.needsEvidenceCount,
    reviewCount: input.room.reviewCount,
    readyCount: input.room.readyCount,
    closedCount: input.room.closedCount,
    auditScore: input.room.auditScore,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchFinalAuditRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchFinalAuditRecordChange()
  return record
}

export function subscribeToLaunchFinalAuditRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchFinalAuditRecords() {
  return useSyncExternalStore(subscribeToLaunchFinalAuditRecords, getLaunchFinalAuditRecords, () => [])
}

export function getLaunchFinalAuditRoomTone(status: LaunchFinalAuditRoomStatus) {
  if (status === 'Audit Blocked') return 'danger' as const
  if (status === 'Audit Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchFinalAuditItemTone(status: LaunchFinalAuditItemStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Evidence' || status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchFinalAuditCheckTone(status: LaunchFinalAuditCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchFinalAuditFilename(room: LaunchFinalAuditRoom) {
  return `launch-final-audit-room-${room.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchFinalAuditHtml(room: LaunchFinalAuditRoom, session: AdminSession) {
  const rows = room.items.map(item => `
    <tr>
      <td>${escapeHtml(item.stage)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.sourceStatus)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.evidence)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Final Launch Audit Room</title>
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
    <h1>${escapeHtml(room.headline)}</h1>
    <p>${escapeHtml(room.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(room.status)}</strong></div>
      <div class="card"><span>Audit Score</span><strong>${room.auditScore}%</strong></div>
      <div class="card"><span>Blocked</span><strong>${room.blockedCount}</strong></div>
      <div class="card"><span>Review</span><strong>${room.needsEvidenceCount + room.reviewCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(room.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is final launch audit evidence only and does not close production incidents, send messages, publish notices, or mutate production state.
    </div>
    <h2>Audit Items</h2>
    <table>
      <thead><tr><th>Stage</th><th>Status</th><th>Source</th><th>Owner</th><th>Evidence</th><th>Next Step</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`
}

function readinessItem(readinessModel: LaunchReadinessModel, closureModel: LaunchClosureModel, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = readinessModel.blockedCount || closureModel.decision === 'No Go'
    ? 'Blocked'
    : readinessModel.watchCount || closureModel.decision === 'Conditional Go'
      ? 'Review'
      : 'Ready'
  return {
    id: 'final-audit-launch-gate',
    stage: 'Launch Gate',
    title: 'Launch gate and executive closure posture',
    status,
    sourceStatus: `${readinessModel.status} / ${closureModel.decision}`,
    owner: 'Owner',
    reference: 'Launch Gate',
    targetView: 'command',
    summary: readinessModel.summary,
    evidence: `${readinessModel.score}% readiness, ${readinessModel.blockedCount} blocked gates, ${closureModel.completeRequiredCount}/${closureModel.requiredCount} closure checks complete.`,
    nextStep: status === 'Ready' ? 'Keep readiness snapshot attached to final audit.' : closureModel.summary,
    auditRecordCount: closureModel.evidenceItemCount,
    customerFacingCount: 0,
    actionRequiredCount: closureModel.blockedCount + closureModel.reviewCount,
    readyCount: closureModel.completeRequiredCount,
    totalCount: closureModel.requiredCount,
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('launch-readiness-score', 'Readiness score supports final closure', status === 'Blocked' ? 'Missing' : status === 'Review' ? 'Review' : 'Ready', `${readinessModel.score}% readiness`, true),
      check('launch-closure-decision', 'Executive closure decision is not blocked', closureModel.decision === 'No Go' ? 'Missing' : closureModel.decision === 'Conditional Go' ? 'Review' : 'Ready', closureModel.decision, true),
    ],
  }
}

function communicationsItem(center: LaunchCommsApprovalCenter, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = center.holdCount
    ? 'Blocked'
    : center.pendingReviewCount
      ? 'Review'
      : center.approvedDraftCount || center.status === 'Clear'
        ? 'Ready'
        : 'Review'
  return {
    id: 'final-audit-communications',
    stage: 'Communications',
    title: 'Communications approval coverage',
    status,
    sourceStatus: center.status,
    owner: 'Support Lead',
    reference: 'Launch Communications',
    targetView: 'communications',
    summary: center.summary,
    evidence: `${center.approvedDraftCount} approved drafts, ${center.pendingReviewCount} pending review, ${center.holdCount} held.`,
    nextStep: center.nextDraft?.nextStep ?? 'Keep communication approvals attached to launch audit.',
    auditRecordCount: center.recordCount,
    customerFacingCount: center.customerFacingCount,
    actionRequiredCount: center.actionRequiredCount,
    readyCount: center.approvedDraftCount,
    totalCount: Math.max(center.drafts.length, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('communications-owner-review', 'Owner review has no held customer-facing draft', center.holdCount ? 'Missing' : center.pendingReviewCount ? 'Review' : 'Ready', center.status, true),
      check('communications-audit', 'Communication approval records are audit backed', center.recordCount || center.auditBackedCount ? 'Ready' : 'Review', `${center.recordCount} records / ${center.auditBackedCount} audit-backed drafts`, true),
    ],
  }
}

function sendReviewItem(queue: LaunchSendReviewQueue, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = queue.blockedCount
    ? 'Blocked'
    : queue.pendingReviewCount
      ? 'Review'
      : queue.handoffQueuedCount || queue.approvedCount || queue.status === 'Clear'
        ? 'Ready'
        : 'Review'
  return {
    id: 'final-audit-send-review',
    stage: 'Send Review',
    title: 'Send review and handoff governance',
    status,
    sourceStatus: queue.status,
    owner: 'Support Lead',
    reference: 'Launch Send Review',
    targetView: 'sendReview',
    summary: queue.summary,
    evidence: `${queue.handoffQueuedCount} handoffs queued, ${queue.approvedCount} approved, ${queue.pendingReviewCount} pending, ${queue.blockedCount} blocked.`,
    nextStep: queue.nextItem?.nextStep ?? 'Keep send-review handoff evidence retained.',
    auditRecordCount: queue.recordCount,
    customerFacingCount: queue.customerFacingCount,
    actionRequiredCount: queue.actionRequiredCount,
    readyCount: queue.handoffQueuedCount + queue.approvedCount,
    totalCount: Math.max(queue.items.length, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('send-review-handoff', 'Send review has no blocked or pending handoff', queue.blockedCount ? 'Missing' : queue.pendingReviewCount ? 'Review' : 'Ready', queue.status, true),
      check('send-review-boundary', 'No browser-side send path is available', 'Ready', 'Send review records and queues only.', true),
    ],
  }
}

function deliveryEvidenceItem(ledger: LaunchDeliveryEvidenceLedger, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = ledger.blockedCount
    ? 'Blocked'
    : ledger.needsProofCount
      ? 'Needs Evidence'
      : ledger.proofReviewCount
        ? 'Review'
        : 'Ready'
  return {
    id: 'final-audit-delivery-proof',
    stage: 'Delivery Proof',
    title: 'Delivery proof and recipient scope',
    status,
    sourceStatus: ledger.status,
    owner: 'Support Lead',
    reference: 'Launch Delivery Evidence',
    targetView: 'deliveryEvidence',
    summary: ledger.summary,
    evidence: `${ledger.completeCount} complete, ${ledger.proofReviewCount} proof review, ${ledger.needsProofCount} needs proof, ${ledger.blockedCount} blocked.`,
    nextStep: ledger.nextItem?.nextStep ?? 'Keep delivery proof retained in closure packet.',
    auditRecordCount: ledger.recordCount,
    customerFacingCount: ledger.customerFacingCount,
    actionRequiredCount: ledger.actionRequiredCount,
    readyCount: ledger.completeCount,
    totalCount: Math.max(ledger.items.length, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('delivery-proof-complete', 'Delivery evidence is complete or reviewed', ledger.blockedCount || ledger.needsProofCount ? 'Missing' : ledger.proofReviewCount ? 'Review' : 'Ready', ledger.status, true),
      check('delivery-proof-audit', 'Delivery proof has audit records or source evidence', ledger.recordCount || ledger.auditBackedCount ? 'Ready' : 'Review', `${ledger.recordCount} records / ${ledger.auditBackedCount} audit-backed items`, true),
    ],
  }
}

function recipientResponseItem(monitor: LaunchRecipientResponseMonitor, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = monitor.escalatedCount
    ? 'Blocked'
    : monitor.followUpCount || monitor.awaitingCount
      ? 'Review'
      : 'Ready'
  return {
    id: 'final-audit-recipient-replies',
    stage: 'Recipient Replies',
    title: 'Recipient response and follow-up state',
    status,
    sourceStatus: monitor.status,
    owner: 'Support Lead',
    reference: 'Launch Recipient Response',
    targetView: 'recipientResponse',
    summary: monitor.summary,
    evidence: `${monitor.acknowledgedCount} acknowledged, ${monitor.awaitingCount} awaiting, ${monitor.followUpCount} follow-up, ${monitor.escalatedCount} escalated.`,
    nextStep: monitor.nextItem?.nextStep ?? 'Retain response status in the final audit packet.',
    auditRecordCount: monitor.recordCount,
    customerFacingCount: monitor.customerFacingCount,
    actionRequiredCount: monitor.actionRequiredCount,
    readyCount: monitor.acknowledgedCount + monitor.closedCount,
    totalCount: Math.max(monitor.items.length, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('recipient-response-clear', 'Recipient responses are acknowledged, closed, or non-blocking', monitor.escalatedCount ? 'Missing' : monitor.followUpCount || monitor.awaitingCount ? 'Review' : 'Ready', monitor.status, true),
      check('recipient-response-evidence', 'Response monitor has delivery evidence inputs', monitor.evidenceCompleteCount ? 'Ready' : 'Review', `${monitor.evidenceCompleteCount} delivery evidence inputs`, true),
    ],
  }
}

function closureEvidenceItem(pack: LaunchClosureEvidencePack, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = pack.blockedCount
    ? 'Blocked'
    : pack.needsPacketCount
      ? 'Needs Evidence'
      : pack.reviewCount
        ? 'Review'
        : pack.readyCount || pack.closedCount
          ? 'Ready'
          : 'Review'
  return {
    id: 'final-audit-closure-pack',
    stage: 'Closure Pack',
    title: 'Closure evidence pack completeness',
    status,
    sourceStatus: pack.status,
    owner: 'Owner',
    reference: 'Launch Closure Evidence Pack',
    targetView: 'closurePack',
    summary: pack.summary,
    evidence: `${pack.readyCount} ready, ${pack.reviewCount} review, ${pack.needsPacketCount} needs packet, ${pack.blockedCount} blocked.`,
    nextStep: pack.nextItem?.nextStep ?? 'Attach closure evidence pack to final executive audit.',
    auditRecordCount: pack.recordCount,
    customerFacingCount: pack.customerFacingCount,
    actionRequiredCount: pack.actionRequiredCount,
    readyCount: pack.readyCount + pack.closedCount,
    totalCount: Math.max(pack.items.length, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('closure-pack-ready', 'Closure evidence pack is ready or closed', pack.blockedCount || pack.needsPacketCount ? 'Missing' : pack.reviewCount ? 'Review' : 'Ready', pack.status, true),
      check('closure-pack-response-clear', 'Closure pack has clear response state', pack.responseClearCount ? 'Ready' : 'Review', `${pack.responseClearCount} response-clear items`, true),
    ],
  }
}

function executiveClosureItem(closureModel: LaunchClosureModel, pack: LaunchClosureEvidencePack, generatedAt: string): LaunchFinalAuditItem {
  const status: LaunchFinalAuditItemStatus = closureModel.decision === 'No Go' || pack.blockedCount
    ? 'Blocked'
    : closureModel.decision === 'Conditional Go' || pack.reviewCount || pack.needsPacketCount
      ? 'Review'
      : pack.readyCount || pack.closedCount
        ? 'Ready'
        : 'Review'
  return {
    id: 'final-audit-executive-closure',
    stage: 'Executive Closure',
    title: 'Executive closure decision package',
    status,
    sourceStatus: closureModel.decision,
    owner: 'Owner',
    reference: 'Launch Closure',
    targetView: 'closure',
    summary: closureModel.summary,
    evidence: `${closureModel.completeRequiredCount}/${closureModel.requiredCount} required closure checks complete; ${pack.readyCount} closure packet items ready.`,
    nextStep: status === 'Ready' ? 'Executive closure can be reviewed with the final audit export attached.' : closureModel.summary,
    auditRecordCount: pack.recordCount,
    customerFacingCount: pack.customerFacingCount,
    actionRequiredCount: closureModel.blockedCount + closureModel.reviewCount,
    readyCount: closureModel.completeRequiredCount,
    totalCount: Math.max(closureModel.requiredCount, 1),
    generatedAt,
    actionRequired: status !== 'Ready',
    checks: [
      check('executive-closure-decision', 'Executive closure decision is not No Go', closureModel.decision === 'No Go' ? 'Missing' : closureModel.decision === 'Conditional Go' ? 'Review' : 'Ready', closureModel.decision, true),
      check('executive-closure-pack', 'Closure evidence pack is available for executive review', pack.readyCount || pack.closedCount ? 'Ready' : pack.reviewCount ? 'Review' : 'Missing', pack.status, true),
    ],
  }
}

function buildOwnerGroups(items: LaunchFinalAuditItem[]): LaunchFinalAuditOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.owner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.owner === owner)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Evidence' || item.status === 'Review') ?? rows[0]
    return {
      owner,
      total: rows.length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      needsEvidence: rows.filter(item => item.status === 'Needs Evidence').length,
      review: rows.filter(item => item.status === 'Review').length,
      ready: rows.filter(item => item.status === 'Ready').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      nextStep: nextItem?.nextStep ?? 'No final audit follow-up needed.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.needsEvidence - a.needsEvidence || b.review - a.review || a.owner.localeCompare(b.owner))
}

function getAggregateStatus(
  blockedCount: number,
  needsEvidenceCount: number,
  reviewCount: number,
  readyCount: number,
  closedCount: number,
): LaunchFinalAuditRoomStatus {
  if (blockedCount) return 'Audit Blocked'
  if (needsEvidenceCount || reviewCount) return 'Audit Review'
  if (readyCount) return 'Ready For Executive Closure'
  if (closedCount) return 'Closed'
  return 'Audit Review'
}

function getHeadline(status: LaunchFinalAuditRoomStatus, blockedCount: number, needsEvidenceCount: number, reviewCount: number, auditScore: number) {
  if (status === 'Audit Blocked') return `${blockedCount} final audit stage${blockedCount === 1 ? '' : 's'} blocked`
  if (status === 'Audit Review') return `${needsEvidenceCount + reviewCount} final audit stage${needsEvidenceCount + reviewCount === 1 ? '' : 's'} need review`
  if (status === 'Ready For Executive Closure') return `${auditScore}% final audit ready`
  return 'Final launch audit is closed'
}

function getSummary(status: LaunchFinalAuditRoomStatus, total: number, blockedCount: number, needsEvidenceCount: number, reviewCount: number, auditScore: number) {
  if (status === 'Audit Blocked') return `${blockedCount} of ${total} final audit stages are blocked. Do not close launch until these are resolved.`
  if (status === 'Audit Review') return `${needsEvidenceCount + reviewCount} of ${total} final audit stages need evidence or human review. Audit score is ${auditScore}%.`
  if (status === 'Ready For Executive Closure') return `All required final audit stages are ready or closed. Audit score is ${auditScore}%.`
  return 'Final launch audit has been recorded as closed.'
}

function check(id: string, label: string, status: LaunchFinalAuditCheckStatus, evidence: string, required: boolean): LaunchFinalAuditCheck {
  return { id, label, status, evidence, required }
}

function emitLaunchFinalAuditRecordChange() {
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
