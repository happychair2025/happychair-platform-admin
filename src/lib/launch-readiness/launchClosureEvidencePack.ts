import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchCommsApprovalAudience,
  LaunchCommsApprovalChannel,
} from './launchCommunicationsApprovalCenter'
import type { LaunchDeliveryEvidenceItemStatus } from './launchDeliveryEvidenceLedger'
import type { LaunchPostLaunchIncidentSeverity } from './launchPostLaunchIncidentCommander'
import type { LaunchPostLaunchSurface } from './launchPostLaunchWatchtower'
import type {
  LaunchRecipientResponseItem,
  LaunchRecipientResponseItemStatus,
  LaunchRecipientResponseMonitor,
} from './launchRecipientResponseMonitor'
import type { LaunchSendReviewItemStatus } from './launchSendReviewQueue'

export type LaunchClosureEvidencePackStatus = 'Packet Needed' | 'Closure Review' | 'Packet Ready' | 'Closed'
export type LaunchClosureEvidenceItemStatus = 'Needs Packet' | 'Closure Review' | 'Packet Ready' | 'Closed' | 'Blocked'
export type LaunchClosureEvidenceCheckStatus = 'Missing' | 'Review' | 'Ready'
export type LaunchClosureEvidenceSection = 'Customer Response' | 'Owner Decision' | 'Internal Handoff'

export interface LaunchClosureEvidenceCheck {
  id: string
  label: string
  status: LaunchClosureEvidenceCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchClosureEvidenceItem {
  id: string
  title: string
  status: LaunchClosureEvidenceItemStatus
  sourceRecipientResponseId: string
  sourceRecipientResponseTitle: string
  sourceRecipientResponseStatus: LaunchRecipientResponseItemStatus
  sourceDeliveryEvidenceStatus: LaunchDeliveryEvidenceItemStatus
  sourceSendReviewStatus: LaunchSendReviewItemStatus
  sourceDraftTitle: string
  sourceIncidentTitle: string
  audience: LaunchCommsApprovalAudience
  channel: LaunchCommsApprovalChannel
  severity: LaunchPostLaunchIncidentSeverity
  reference: string
  surface: LaunchPostLaunchSurface
  owner: string
  proofOwner: string
  responseOwner: string
  closureOwner: string
  packetSection: LaunchClosureEvidenceSection
  closureState: string
  closureEvidence: string
  packetRequirement: string
  responseSummary: string
  signoffPlan: string
  retentionPlan: string
  rollbackPlan: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  customerFacing: boolean
  actionRequired: boolean
  checks: LaunchClosureEvidenceCheck[]
}

export interface LaunchClosureEvidenceAudienceGroup {
  audience: LaunchCommsApprovalAudience
  total: number
  needsPacket: number
  review: number
  ready: number
  closed: number
  blocked: number
  nextStep: string
}

export interface LaunchClosureEvidenceOwnerGroup {
  owner: string
  total: number
  customerFacing: number
  needsPacket: number
  review: number
  ready: number
  closed: number
  blocked: number
  nextStep: string
}

export interface LaunchClosureEvidenceSectionGroup {
  section: LaunchClosureEvidenceSection
  total: number
  needsPacket: number
  review: number
  ready: number
  closed: number
  blocked: number
  nextStep: string
}

export interface LaunchClosureEvidenceRecord {
  id: string
  itemId?: string
  itemTitle?: string
  audience?: LaunchCommsApprovalAudience
  section?: LaunchClosureEvidenceSection
  itemStatus: LaunchClosureEvidenceItemStatus
  packStatus: LaunchClosureEvidencePackStatus
  needsPacketCount: number
  reviewCount: number
  readyCount: number
  closedCount: number
  blockedCount: number
  customerFacingCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchClosureEvidencePack {
  status: LaunchClosureEvidencePackStatus
  headline: string
  summary: string
  generatedAt: string
  items: LaunchClosureEvidenceItem[]
  nextItem?: LaunchClosureEvidenceItem
  needsPacketCount: number
  reviewCount: number
  readyCount: number
  closedCount: number
  blockedCount: number
  customerFacingCount: number
  evidenceCompleteCount: number
  responseClearCount: number
  auditBackedCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchClosureEvidenceRecord
  audienceGroups: LaunchClosureEvidenceAudienceGroup[]
  ownerGroups: LaunchClosureEvidenceOwnerGroup[]
  sectionGroups: LaunchClosureEvidenceSectionGroup[]
}

interface BuildLaunchClosureEvidencePackInput {
  responseMonitor: LaunchRecipientResponseMonitor
  records: LaunchClosureEvidenceRecord[]
}

interface SaveLaunchClosureEvidenceRecordInput {
  pack: LaunchClosureEvidencePack
  item?: LaunchClosureEvidenceItem
  itemStatus?: LaunchClosureEvidenceItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_closure_evidence_pack_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchClosureEvidenceRecord[] = []

export const launchClosureEvidenceBoundaryRule =
  'Launch Closure Evidence Pack assembles delivery proof, recipient response state, response follow-up status, closure signoff notes, and audit retention evidence. Recording, exporting, or queueing closure review does not send messages, publish notices, mutate customer data, close production incidents, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchClosureEvidencePack(input: BuildLaunchClosureEvidencePackInput): LaunchClosureEvidencePack {
  const generatedAt = new Date().toISOString()
  const items = input.responseMonitor.items
    .map(item => itemFromRecipientResponse(item, input.records))
    .sort((a, b) => itemStatusRank(a.status) - itemStatusRank(b.status) || audienceRank(a.audience) - audienceRank(b.audience) || severityRank(a.severity) - severityRank(b.severity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const needsPacketCount = items.filter(item => item.status === 'Needs Packet').length
  const reviewCount = items.filter(item => item.status === 'Closure Review').length
  const readyCount = items.filter(item => item.status === 'Packet Ready').length
  const closedCount = items.filter(item => item.status === 'Closed').length
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const customerFacingCount = items.filter(item => item.customerFacing).length
  const status = getAggregateStatus(items, needsPacketCount, reviewCount, readyCount, blockedCount)

  return {
    status,
    headline: getHeadline(status, needsPacketCount, reviewCount, readyCount, blockedCount, closedCount),
    summary: getSummary(status, items.length, needsPacketCount, reviewCount, readyCount, blockedCount, customerFacingCount),
    generatedAt,
    items,
    nextItem: items.find(item => item.status === 'Blocked' || item.status === 'Needs Packet' || item.status === 'Closure Review') ?? items[0],
    needsPacketCount,
    reviewCount,
    readyCount,
    closedCount,
    blockedCount,
    customerFacingCount,
    evidenceCompleteCount: items.filter(item => item.sourceDeliveryEvidenceStatus === 'Evidence Complete').length,
    responseClearCount: items.filter(item => item.sourceRecipientResponseStatus === 'Acknowledged' || item.sourceRecipientResponseStatus === 'Closed').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    actionRequiredCount: items.filter(item => item.actionRequired).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    audienceGroups: buildAudienceGroups(items),
    ownerGroups: buildOwnerGroups(items),
    sectionGroups: buildSectionGroups(items),
  }
}

export function getLaunchClosureEvidenceRecords(): LaunchClosureEvidenceRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchClosureEvidenceRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchClosureEvidenceRecord(input: SaveLaunchClosureEvidenceRecordInput) {
  const record: LaunchClosureEvidenceRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    audience: input.item?.audience,
    section: input.item?.packetSection,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Needs Packet',
    packStatus: input.pack.status,
    needsPacketCount: input.pack.needsPacketCount,
    reviewCount: input.pack.reviewCount,
    readyCount: input.pack.readyCount,
    closedCount: input.pack.closedCount,
    blockedCount: input.pack.blockedCount,
    customerFacingCount: input.pack.customerFacingCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchClosureEvidenceRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchClosureEvidenceRecordChange()
  return record
}

export function subscribeToLaunchClosureEvidenceRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchClosureEvidenceRecords() {
  return useSyncExternalStore(subscribeToLaunchClosureEvidenceRecords, getLaunchClosureEvidenceRecords, () => [])
}

export function getLaunchClosureEvidencePackTone(status: LaunchClosureEvidencePackStatus) {
  if (status === 'Packet Needed' || status === 'Closure Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchClosureEvidenceItemTone(status: LaunchClosureEvidenceItemStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Packet' || status === 'Closure Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchClosureEvidenceAudienceTone(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 'warn' as const
  if (audience === 'Internal') return 'info' as const
  return 'neutral' as const
}

export function getLaunchClosureEvidenceCheckTone(status: LaunchClosureEvidenceCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchClosureEvidenceFilename(pack: LaunchClosureEvidencePack) {
  return `launch-closure-evidence-pack-${pack.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchClosureEvidenceHtml(pack: LaunchClosureEvidencePack, session: AdminSession) {
  const rows = pack.items.map(item => `
    <tr>
      <td>${escapeHtml(item.audience)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.packetSection)}</td>
      <td>${escapeHtml(item.closureOwner)}</td>
      <td>${escapeHtml(item.closureEvidence)}</td>
      <td>${escapeHtml(item.signoffPlan)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Closure Evidence Pack</title>
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
    <h1>${escapeHtml(pack.headline)}</h1>
    <p>${escapeHtml(pack.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(pack.status)}</strong></div>
      <div class="card"><span>Needs Packet</span><strong>${pack.needsPacketCount}</strong></div>
      <div class="card"><span>Review</span><strong>${pack.reviewCount}</strong></div>
      <div class="card"><span>Ready</span><strong>${pack.readyCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(pack.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is closure evidence only and does not close production incidents, send messages, publish notices, or mutate production state.
    </div>
    <h2>Closure Evidence Items</h2>
    <table>
      <thead><tr><th>Audience</th><th>Status</th><th>Item</th><th>Section</th><th>Closure Owner</th><th>Evidence</th><th>Signoff</th><th>Next Step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No recipient response items are ready for closure evidence packing.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function itemFromRecipientResponse(item: LaunchRecipientResponseItem, records: LaunchClosureEvidenceRecord[]): LaunchClosureEvidenceItem {
  const id = `closure-evidence-${item.id}`
  const latestRecord = records.find(record => record.itemId === id)
  const status = latestRecord?.itemStatus ?? defaultStatusForResponseItem(item)
  const closureOwner = closureOwnerForItem(item)

  return {
    id,
    title: `Closure evidence: ${item.sourceDraftTitle}`,
    status,
    sourceRecipientResponseId: item.id,
    sourceRecipientResponseTitle: item.title,
    sourceRecipientResponseStatus: item.status,
    sourceDeliveryEvidenceStatus: item.sourceDeliveryEvidenceStatus,
    sourceSendReviewStatus: item.sourceSendReviewStatus,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    audience: item.audience,
    channel: item.channel,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    proofOwner: item.proofOwner,
    responseOwner: item.responseOwner,
    closureOwner,
    packetSection: packetSectionForItem(item),
    closureState: closureStateForItem(item, status),
    closureEvidence: closureEvidenceForItem(item),
    packetRequirement: packetRequirementForItem(item),
    responseSummary: responseSummaryForItem(item),
    signoffPlan: signoffPlanForItem(item),
    retentionPlan: retentionPlanForItem(item),
    rollbackPlan: rollbackPlanForItem(item),
    nextStep: nextStepForItem(status, item),
    responseWindow: item.responseWindow,
    updatedAt: latestRecord?.recordedAt ?? item.updatedAt,
    auditBacked: item.auditBacked,
    customerFacing: item.customerFacing,
    actionRequired: status === 'Needs Packet' || status === 'Closure Review' || status === 'Blocked',
    checks: buildChecks(item, status),
  }
}

function defaultStatusForResponseItem(item: LaunchRecipientResponseItem): LaunchClosureEvidenceItemStatus {
  if (item.status === 'Escalated' || item.status === 'Needs Follow-Up') return 'Blocked'
  if (item.sourceDeliveryEvidenceStatus !== 'Evidence Complete') return 'Needs Packet'
  if (item.status === 'Closed') return 'Packet Ready'
  if (item.status === 'Acknowledged') return 'Needs Packet'
  return 'Closure Review'
}

function buildChecks(item: LaunchRecipientResponseItem, status: LaunchClosureEvidenceItemStatus): LaunchClosureEvidenceCheck[] {
  return [
    {
      id: `${item.id}-delivery-proof`,
      label: 'Delivery proof is complete',
      status: item.sourceDeliveryEvidenceStatus === 'Evidence Complete' ? 'Ready' : item.sourceDeliveryEvidenceStatus === 'Blocked' ? 'Missing' : 'Review',
      evidence: item.sourceDeliveryEvidenceStatus,
      required: true,
    },
    {
      id: `${item.id}-response-clear`,
      label: 'Recipient response is clear for closure',
      status: item.status === 'Acknowledged' || item.status === 'Closed' ? 'Ready' : item.status === 'Escalated' ? 'Missing' : 'Review',
      evidence: item.status,
      required: true,
    },
    {
      id: `${item.id}-section`,
      label: 'Closure packet section is assigned',
      status: 'Ready',
      evidence: packetSectionForItem(item),
      required: true,
    },
    {
      id: `${item.id}-signoff`,
      label: 'Closure signoff plan is defined',
      status: status === 'Packet Ready' || status === 'Closed' ? 'Ready' : 'Review',
      evidence: signoffPlanForItem(item),
      required: true,
    },
    {
      id: `${item.id}-audit`,
      label: 'Audit-backed source evidence is attached',
      status: item.auditBacked ? 'Ready' : 'Review',
      evidence: item.auditBacked ? 'Response and delivery evidence are audit backed.' : 'Audit evidence still needs review.',
      required: true,
    },
  ]
}

function buildAudienceGroups(items: LaunchClosureEvidenceItem[]): LaunchClosureEvidenceAudienceGroup[] {
  return (['Customer', 'Internal', 'Owner'] as LaunchCommsApprovalAudience[]).map(audience => {
    const rows = items.filter(item => item.audience === audience)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Packet' || item.status === 'Closure Review') ?? rows[0]
    return {
      audience,
      total: rows.length,
      needsPacket: rows.filter(item => item.status === 'Needs Packet').length,
      review: rows.filter(item => item.status === 'Closure Review').length,
      ready: rows.filter(item => item.status === 'Packet Ready').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No closure evidence item for this audience.',
    }
  }).filter(group => group.total > 0)
}

function buildOwnerGroups(items: LaunchClosureEvidenceItem[]): LaunchClosureEvidenceOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.closureOwner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.closureOwner === owner)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Packet' || item.status === 'Closure Review') ?? rows[0]
    return {
      owner,
      total: rows.length,
      customerFacing: rows.filter(item => item.customerFacing).length,
      needsPacket: rows.filter(item => item.status === 'Needs Packet').length,
      review: rows.filter(item => item.status === 'Closure Review').length,
      ready: rows.filter(item => item.status === 'Packet Ready').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No closure evidence follow-up needed.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.needsPacket - a.needsPacket || b.review - a.review || a.owner.localeCompare(b.owner))
}

function buildSectionGroups(items: LaunchClosureEvidenceItem[]): LaunchClosureEvidenceSectionGroup[] {
  return (['Customer Response', 'Owner Decision', 'Internal Handoff'] as LaunchClosureEvidenceSection[]).map(section => {
    const rows = items.filter(item => item.packetSection === section)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Packet' || item.status === 'Closure Review') ?? rows[0]
    return {
      section,
      total: rows.length,
      needsPacket: rows.filter(item => item.status === 'Needs Packet').length,
      review: rows.filter(item => item.status === 'Closure Review').length,
      ready: rows.filter(item => item.status === 'Packet Ready').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      nextStep: nextItem?.nextStep ?? 'No closure evidence item for this packet section.',
    }
  }).filter(group => group.total > 0)
}

function closureOwnerForItem(item: LaunchRecipientResponseItem) {
  if (item.audience === 'Customer') return 'Support Lead'
  if (item.audience === 'Owner') return 'Owner'
  return item.responseOwner
}

function packetSectionForItem(item: LaunchRecipientResponseItem): LaunchClosureEvidenceSection {
  if (item.audience === 'Customer') return 'Customer Response'
  if (item.audience === 'Owner') return 'Owner Decision'
  return 'Internal Handoff'
}

function closureStateForItem(item: LaunchRecipientResponseItem, status: LaunchClosureEvidenceItemStatus) {
  if (status === 'Closed') return 'Closure evidence is closed and retained for audit review.'
  if (status === 'Packet Ready') return 'Closure evidence packet is assembled and ready for final closure.'
  if (status === 'Blocked') return 'Closure is blocked until response follow-up, escalation, or delivery proof is resolved.'
  if (status === 'Closure Review') return 'Closure packet requires human review before it can be marked ready.'
  if (item.status === 'Awaiting Response') return 'Recipient response monitoring is still open; packet evidence can be prepared but not closed.'
  return 'Closure packet evidence must be assembled and reviewed.'
}

function closureEvidenceForItem(item: LaunchRecipientResponseItem) {
  if (item.audience === 'Customer') return 'Include approved customer copy, delivery proof, recipient scope, customer response or expiry state, and correction/escalation trail.'
  if (item.audience === 'Owner') return 'Include owner update, decision-thread acknowledgement, unresolved questions, and closure owner signoff.'
  return 'Include internal handoff proof, team acknowledgement, incident timeline entry, and unresolved follow-up state.'
}

function packetRequirementForItem(item: LaunchRecipientResponseItem) {
  if (item.status === 'Escalated' || item.status === 'Needs Follow-Up') return 'Resolve response escalation or follow-up before closure packet can be marked ready.'
  if (item.sourceDeliveryEvidenceStatus !== 'Evidence Complete') return 'Complete delivery evidence before closure packet can be marked ready.'
  return 'Attach response state, delivery proof, signoff owner, and retention notes to the launch closure packet.'
}

function responseSummaryForItem(item: LaunchRecipientResponseItem) {
  return `${item.status}: ${item.responseState}`
}

function signoffPlanForItem(item: LaunchRecipientResponseItem) {
  if (item.audience === 'Customer') return 'Support Lead verifies response status and Owner approves closure when customer-facing follow-up is complete.'
  if (item.audience === 'Owner') return 'Owner confirms acknowledgement or records final decision before closure.'
  return 'Owning team confirms internal handoff and unresolved tasks before closure.'
}

function retentionPlanForItem(item: LaunchRecipientResponseItem) {
  if (item.audience === 'Customer') return 'Retain customer-facing delivery proof, response state, support ticket links, and correction trail in the launch evidence packet.'
  if (item.audience === 'Owner') return 'Retain owner-thread acknowledgement, decision notes, and closure signoff in the launch evidence packet.'
  return 'Retain internal handoff proof, timeline entry, and follow-up owner in the launch evidence packet.'
}

function rollbackPlanForItem(item: LaunchRecipientResponseItem) {
  if (item.status === 'Escalated' || item.status === 'Needs Follow-Up') return item.escalationPlan
  if (item.audience === 'Customer') return 'If closure evidence is incomplete, reopen response follow-up and block closure until customer-facing proof is corrected.'
  return 'If closure evidence is incomplete, reopen the owner or internal follow-up path and update the launch timeline.'
}

function nextStepForItem(status: LaunchClosureEvidenceItemStatus, item: LaunchRecipientResponseItem) {
  if (status === 'Closed') return 'Retain the closed closure packet for audit review.'
  if (status === 'Packet Ready') return 'Review final closure decision and export the closure evidence pack.'
  if (status === 'Blocked') return 'Resolve response escalation, follow-up, or missing proof before closure can proceed.'
  if (status === 'Closure Review') return 'Review packet evidence, response state, signoff owner, and retention notes.'
  if (item.status === 'Awaiting Response') return 'Wait for acknowledgement or response-window expiry before marking packet ready.'
  return 'Assemble delivery proof, response summary, signoff plan, and retention notes.'
}

function getAggregateStatus(
  items: LaunchClosureEvidenceItem[],
  needsPacketCount: number,
  reviewCount: number,
  readyCount: number,
  blockedCount: number,
): LaunchClosureEvidencePackStatus {
  if (!items.length) return 'Closed'
  if (blockedCount || needsPacketCount) return 'Packet Needed'
  if (reviewCount) return 'Closure Review'
  if (readyCount) return 'Packet Ready'
  return 'Closed'
}

function getHeadline(
  status: LaunchClosureEvidencePackStatus,
  needsPacketCount: number,
  reviewCount: number,
  readyCount: number,
  blockedCount: number,
  closedCount: number,
) {
  if (status === 'Packet Needed') return `${needsPacketCount + blockedCount} closure evidence item${needsPacketCount + blockedCount === 1 ? '' : 's'} need packet work`
  if (status === 'Closure Review') return `${reviewCount} closure evidence item${reviewCount === 1 ? '' : 's'} need review`
  if (status === 'Packet Ready') return `${readyCount} closure evidence item${readyCount === 1 ? '' : 's'} ready for closure`
  return `${closedCount} closure evidence item${closedCount === 1 ? '' : 's'} closed`
}

function getSummary(
  status: LaunchClosureEvidencePackStatus,
  total: number,
  needsPacketCount: number,
  reviewCount: number,
  readyCount: number,
  blockedCount: number,
  customerFacingCount: number,
) {
  if (status === 'Packet Needed') return `${needsPacketCount} of ${total} closure evidence items need packet assembly and ${blockedCount} are blocked, including ${customerFacingCount} customer-facing items.`
  if (status === 'Closure Review') return `${reviewCount} closure evidence items are assembled enough for human review.`
  if (status === 'Packet Ready') return `${readyCount} closure evidence items are ready for final closure decision.`
  return total ? `${total} closure evidence items are closed.` : 'No recipient response items are ready for closure evidence packing.'
}

function itemStatusRank(status: LaunchClosureEvidenceItemStatus) {
  if (status === 'Blocked') return 0
  if (status === 'Needs Packet') return 1
  if (status === 'Closure Review') return 2
  if (status === 'Packet Ready') return 3
  return 4
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

function emitLaunchClosureEvidenceRecordChange() {
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
