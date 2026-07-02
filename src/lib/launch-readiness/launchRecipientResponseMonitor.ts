import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchCommsApprovalAudience,
  LaunchCommsApprovalChannel,
} from './launchCommunicationsApprovalCenter'
import type {
  LaunchDeliveryEvidenceItem,
  LaunchDeliveryEvidenceLedger,
} from './launchDeliveryEvidenceLedger'
import type { LaunchPostLaunchIncidentSeverity } from './launchPostLaunchIncidentCommander'
import type { LaunchPostLaunchSurface } from './launchPostLaunchWatchtower'
import type { LaunchSendReviewItemStatus } from './launchSendReviewQueue'

export type LaunchRecipientResponseMonitorStatus = 'Response Needed' | 'Follow-Up' | 'Escalated' | 'Clear'
export type LaunchRecipientResponseItemStatus = 'Awaiting Response' | 'Acknowledged' | 'Needs Follow-Up' | 'Escalated' | 'Closed'
export type LaunchRecipientResponseCheckStatus = 'Missing' | 'Review' | 'Ready'

export interface LaunchRecipientResponseCheck {
  id: string
  label: string
  status: LaunchRecipientResponseCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchRecipientResponseItem {
  id: string
  title: string
  status: LaunchRecipientResponseItemStatus
  sourceDeliveryEvidenceId: string
  sourceDeliveryEvidenceTitle: string
  sourceDeliveryEvidenceStatus: LaunchDeliveryEvidenceItem['status']
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
  expectedResponse: string
  responseState: string
  followUpPlan: string
  escalationPlan: string
  evidence: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  customerFacing: boolean
  actionRequired: boolean
  checks: LaunchRecipientResponseCheck[]
}

export interface LaunchRecipientResponseAudienceGroup {
  audience: LaunchCommsApprovalAudience
  total: number
  awaiting: number
  acknowledged: number
  followUp: number
  escalated: number
  closed: number
  nextStep: string
}

export interface LaunchRecipientResponseOwnerGroup {
  owner: string
  total: number
  customerFacing: number
  awaiting: number
  followUp: number
  escalated: number
  closed: number
  nextStep: string
}

export interface LaunchRecipientResponseRecord {
  id: string
  itemId?: string
  itemTitle?: string
  audience?: LaunchCommsApprovalAudience
  channel?: LaunchCommsApprovalChannel
  itemStatus: LaunchRecipientResponseItemStatus
  monitorStatus: LaunchRecipientResponseMonitorStatus
  awaitingCount: number
  acknowledgedCount: number
  followUpCount: number
  escalatedCount: number
  closedCount: number
  customerFacingCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchRecipientResponseMonitor {
  status: LaunchRecipientResponseMonitorStatus
  headline: string
  summary: string
  generatedAt: string
  items: LaunchRecipientResponseItem[]
  nextItem?: LaunchRecipientResponseItem
  awaitingCount: number
  acknowledgedCount: number
  followUpCount: number
  escalatedCount: number
  closedCount: number
  customerFacingCount: number
  internalCount: number
  ownerUpdateCount: number
  evidenceCompleteCount: number
  auditBackedCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchRecipientResponseRecord
  audienceGroups: LaunchRecipientResponseAudienceGroup[]
  ownerGroups: LaunchRecipientResponseOwnerGroup[]
}

interface BuildLaunchRecipientResponseMonitorInput {
  deliveryEvidenceLedger: LaunchDeliveryEvidenceLedger
  records: LaunchRecipientResponseRecord[]
}

interface SaveLaunchRecipientResponseRecordInput {
  monitor: LaunchRecipientResponseMonitor
  item?: LaunchRecipientResponseItem
  itemStatus?: LaunchRecipientResponseItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_recipient_response_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchRecipientResponseRecord[] = []

export const launchRecipientResponseBoundaryRule =
  'Launch Recipient Response Monitor tracks replies, acknowledgements, escalations, and follow-up ownership after delivery evidence is captured. Recording, exporting, or queueing response follow-up does not send messages, reply to customers, publish notices, mutate customer data, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchRecipientResponseMonitor(input: BuildLaunchRecipientResponseMonitorInput): LaunchRecipientResponseMonitor {
  const generatedAt = new Date().toISOString()
  const items = input.deliveryEvidenceLedger.items
    .map(item => itemFromDeliveryEvidence(item, input.records))
    .sort((a, b) => itemStatusRank(a.status) - itemStatusRank(b.status) || audienceRank(a.audience) - audienceRank(b.audience) || severityRank(a.severity) - severityRank(b.severity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const awaitingCount = items.filter(item => item.status === 'Awaiting Response').length
  const acknowledgedCount = items.filter(item => item.status === 'Acknowledged').length
  const followUpCount = items.filter(item => item.status === 'Needs Follow-Up').length
  const escalatedCount = items.filter(item => item.status === 'Escalated').length
  const closedCount = items.filter(item => item.status === 'Closed').length
  const customerFacingCount = items.filter(item => item.customerFacing).length
  const status = getAggregateStatus(items, awaitingCount, followUpCount, escalatedCount)

  return {
    status,
    headline: getHeadline(status, awaitingCount, followUpCount, escalatedCount, closedCount),
    summary: getSummary(status, items.length, awaitingCount, followUpCount, escalatedCount, customerFacingCount),
    generatedAt,
    items,
    nextItem: items.find(item => item.status === 'Escalated' || item.status === 'Needs Follow-Up' || item.status === 'Awaiting Response') ?? items[0],
    awaitingCount,
    acknowledgedCount,
    followUpCount,
    escalatedCount,
    closedCount,
    customerFacingCount,
    internalCount: items.filter(item => item.audience === 'Internal').length,
    ownerUpdateCount: items.filter(item => item.audience === 'Owner').length,
    evidenceCompleteCount: items.filter(item => item.sourceDeliveryEvidenceStatus === 'Evidence Complete').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    actionRequiredCount: items.filter(item => item.actionRequired).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    audienceGroups: buildAudienceGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchRecipientResponseRecords(): LaunchRecipientResponseRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchRecipientResponseRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchRecipientResponseRecord(input: SaveLaunchRecipientResponseRecordInput) {
  const record: LaunchRecipientResponseRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    audience: input.item?.audience,
    channel: input.item?.channel,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Awaiting Response',
    monitorStatus: input.monitor.status,
    awaitingCount: input.monitor.awaitingCount,
    acknowledgedCount: input.monitor.acknowledgedCount,
    followUpCount: input.monitor.followUpCount,
    escalatedCount: input.monitor.escalatedCount,
    closedCount: input.monitor.closedCount,
    customerFacingCount: input.monitor.customerFacingCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchRecipientResponseRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchRecipientResponseRecordChange()
  return record
}

export function subscribeToLaunchRecipientResponseRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchRecipientResponseRecords() {
  return useSyncExternalStore(subscribeToLaunchRecipientResponseRecords, getLaunchRecipientResponseRecords, () => [])
}

export function getLaunchRecipientResponseMonitorTone(status: LaunchRecipientResponseMonitorStatus) {
  if (status === 'Escalated') return 'danger' as const
  if (status === 'Follow-Up' || status === 'Response Needed') return 'warn' as const
  return 'ok' as const
}

export function getLaunchRecipientResponseItemTone(status: LaunchRecipientResponseItemStatus) {
  if (status === 'Escalated') return 'danger' as const
  if (status === 'Needs Follow-Up' || status === 'Awaiting Response') return 'warn' as const
  if (status === 'Acknowledged' || status === 'Closed') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchRecipientResponseAudienceTone(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 'warn' as const
  if (audience === 'Internal') return 'info' as const
  return 'neutral' as const
}

export function getLaunchRecipientResponseCheckTone(status: LaunchRecipientResponseCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchRecipientResponseFilename(monitor: LaunchRecipientResponseMonitor) {
  return `launch-recipient-response-monitor-${monitor.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchRecipientResponseHtml(monitor: LaunchRecipientResponseMonitor, session: AdminSession) {
  const rows = monitor.items.map(item => `
    <tr>
      <td>${escapeHtml(item.audience)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.channel)}</td>
      <td>${escapeHtml(item.responseOwner)}</td>
      <td>${escapeHtml(item.expectedResponse)}</td>
      <td>${escapeHtml(item.followUpPlan)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Recipient Response Monitor</title>
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
    <h1>${escapeHtml(monitor.headline)}</h1>
    <p>${escapeHtml(monitor.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(monitor.status)}</strong></div>
      <div class="card"><span>Awaiting</span><strong>${monitor.awaitingCount}</strong></div>
      <div class="card"><span>Follow-Up</span><strong>${monitor.followUpCount}</strong></div>
      <div class="card"><span>Escalated</span><strong>${monitor.escalatedCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(monitor.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is recipient response monitoring evidence only and does not send, reply, publish, or mutate production state.
    </div>
    <h2>Recipient Response Items</h2>
    <table>
      <thead><tr><th>Audience</th><th>Status</th><th>Item</th><th>Channel</th><th>Response Owner</th><th>Expected Response</th><th>Follow-Up Plan</th><th>Next Step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No delivery evidence items are ready for recipient response monitoring.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function itemFromDeliveryEvidence(item: LaunchDeliveryEvidenceItem, records: LaunchRecipientResponseRecord[]): LaunchRecipientResponseItem {
  const id = `recipient-response-${item.id}`
  const latestRecord = records.find(record => record.itemId === id)
  const status = latestRecord?.itemStatus ?? defaultStatusForDeliveryEvidence(item)
  const responseOwner = responseOwnerForItem(item)

  return {
    id,
    title: `Recipient response: ${item.sourceDraftTitle}`,
    status,
    sourceDeliveryEvidenceId: item.id,
    sourceDeliveryEvidenceTitle: item.title,
    sourceDeliveryEvidenceStatus: item.status,
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
    responseOwner,
    expectedResponse: expectedResponseForItem(item),
    responseState: responseStateForItem(item, status),
    followUpPlan: followUpPlanForItem(item),
    escalationPlan: escalationPlanForItem(item),
    evidence: item.evidence,
    nextStep: nextStepForItem(status, item),
    responseWindow: item.responseWindow,
    updatedAt: latestRecord?.recordedAt ?? item.updatedAt,
    auditBacked: item.auditBacked,
    customerFacing: item.customerFacing,
    actionRequired: status === 'Awaiting Response' || status === 'Needs Follow-Up' || status === 'Escalated',
    checks: buildChecks(item, status),
  }
}

function defaultStatusForDeliveryEvidence(item: LaunchDeliveryEvidenceItem): LaunchRecipientResponseItemStatus {
  if (item.status === 'Blocked') return 'Escalated'
  if (item.status === 'Evidence Complete') return 'Awaiting Response'
  return 'Needs Follow-Up'
}

function buildChecks(item: LaunchDeliveryEvidenceItem, status: LaunchRecipientResponseItemStatus): LaunchRecipientResponseCheck[] {
  return [
    {
      id: `${item.id}-delivery-proof`,
      label: 'Delivery evidence is complete',
      status: item.status === 'Evidence Complete' ? 'Ready' : item.status === 'Blocked' ? 'Missing' : 'Review',
      evidence: item.status,
      required: true,
    },
    {
      id: `${item.id}-response-owner`,
      label: 'Response owner is assigned',
      status: responseOwnerForItem(item) ? 'Ready' : 'Missing',
      evidence: responseOwnerForItem(item),
      required: true,
    },
    {
      id: `${item.id}-response-window`,
      label: 'Response window is defined',
      status: item.responseWindow ? 'Ready' : 'Review',
      evidence: item.responseWindow || 'No response window defined.',
      required: true,
    },
    {
      id: `${item.id}-recipient-scope`,
      label: 'Recipient scope is available for response matching',
      status: item.recipientScope ? 'Ready' : 'Missing',
      evidence: item.recipientScope,
      required: item.customerFacing,
    },
    {
      id: `${item.id}-response-state`,
      label: 'Response state has an audit trail',
      status: status === 'Acknowledged' || status === 'Closed' ? 'Ready' : 'Review',
      evidence: responseStateForItem(item, status),
      required: true,
    },
  ]
}

function buildAudienceGroups(items: LaunchRecipientResponseItem[]): LaunchRecipientResponseAudienceGroup[] {
  return (['Customer', 'Internal', 'Owner'] as LaunchCommsApprovalAudience[]).map(audience => {
    const rows = items.filter(item => item.audience === audience)
    const nextItem = rows.find(item => item.status === 'Escalated' || item.status === 'Needs Follow-Up' || item.status === 'Awaiting Response') ?? rows[0]
    return {
      audience,
      total: rows.length,
      awaiting: rows.filter(item => item.status === 'Awaiting Response').length,
      acknowledged: rows.filter(item => item.status === 'Acknowledged').length,
      followUp: rows.filter(item => item.status === 'Needs Follow-Up').length,
      escalated: rows.filter(item => item.status === 'Escalated').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      nextStep: nextItem?.nextStep ?? 'No recipient response item for this audience.',
    }
  }).filter(group => group.total > 0)
}

function buildOwnerGroups(items: LaunchRecipientResponseItem[]): LaunchRecipientResponseOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.responseOwner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.responseOwner === owner)
    const nextItem = rows.find(item => item.status === 'Escalated' || item.status === 'Needs Follow-Up' || item.status === 'Awaiting Response') ?? rows[0]
    return {
      owner,
      total: rows.length,
      customerFacing: rows.filter(item => item.customerFacing).length,
      awaiting: rows.filter(item => item.status === 'Awaiting Response').length,
      followUp: rows.filter(item => item.status === 'Needs Follow-Up').length,
      escalated: rows.filter(item => item.status === 'Escalated').length,
      closed: rows.filter(item => item.status === 'Closed').length,
      nextStep: nextItem?.nextStep ?? 'No recipient response follow-up needed.',
    }
  }).sort((a, b) => b.escalated - a.escalated || b.followUp - a.followUp || b.awaiting - a.awaiting || a.owner.localeCompare(b.owner))
}

function responseOwnerForItem(item: LaunchDeliveryEvidenceItem) {
  if (item.audience === 'Customer') return 'Support Lead'
  if (item.audience === 'Owner') return 'Owner'
  return item.proofOwner
}

function expectedResponseForItem(item: LaunchDeliveryEvidenceItem) {
  if (item.audience === 'Customer') return 'Customer acknowledgement, reply, support ticket update, or no-response expiry tied to the delivered update.'
  if (item.audience === 'Owner') return 'Owner acknowledgement or explicit decision-thread follow-up.'
  return 'Internal responder acknowledgement, team handoff, or no-response expiry tied to the incident timeline.'
}

function responseStateForItem(item: LaunchDeliveryEvidenceItem, status: LaunchRecipientResponseItemStatus) {
  if (status === 'Closed') return 'Response tracking is closed and retained in the launch evidence packet.'
  if (status === 'Acknowledged') return 'Recipient acknowledgement has been recorded and is ready for closure review.'
  if (status === 'Escalated') return 'Response requires escalation because delivery proof, recipient scope, or response timing is at risk.'
  if (status === 'Needs Follow-Up') return 'Follow-up owner must review the response path before closure.'
  if (item.status !== 'Evidence Complete') return 'Delivery evidence is not complete, so response tracking cannot be closed.'
  return 'Awaiting recipient acknowledgement or response-window expiry.'
}

function followUpPlanForItem(item: LaunchDeliveryEvidenceItem) {
  if (item.audience === 'Customer') return 'Review customer replies and support tickets, then queue a human-approved follow-up if the response window expires or the customer reports impact.'
  if (item.audience === 'Owner') return 'Confirm owner acknowledgement in the decision thread and add unresolved questions to launch follow-up.'
  return 'Confirm internal acknowledgement in the launch timeline and assign any unresolved incident tasks.'
}

function escalationPlanForItem(item: LaunchDeliveryEvidenceItem) {
  if (item.audience === 'Customer') return 'Escalate to Support Lead and Owner if the customer response indicates impact, incorrect scope, or a correction is needed.'
  if (item.audience === 'Owner') return 'Escalate to Owner if acknowledgement or launch decision follow-up is missing after the response window.'
  return 'Escalate to Engineering or Support Lead if an internal responder does not acknowledge required follow-up.'
}

function nextStepForItem(status: LaunchRecipientResponseItemStatus, item: LaunchDeliveryEvidenceItem) {
  if (status === 'Closed') return 'Retain the closed response record in the launch evidence packet.'
  if (status === 'Acknowledged') return 'Review acknowledgement and close response monitoring when no follow-up is needed.'
  if (status === 'Escalated') return 'Queue a governed response follow-up and record the escalation owner.'
  if (status === 'Needs Follow-Up') return 'Assign a human follow-up owner before response monitoring can close.'
  if (item.status !== 'Evidence Complete') return 'Complete delivery evidence before response monitoring can close.'
  return 'Monitor acknowledgement, reply, or response-window expiry.'
}

function getAggregateStatus(
  items: LaunchRecipientResponseItem[],
  awaitingCount: number,
  followUpCount: number,
  escalatedCount: number,
): LaunchRecipientResponseMonitorStatus {
  if (!items.length) return 'Clear'
  if (escalatedCount) return 'Escalated'
  if (followUpCount) return 'Follow-Up'
  if (awaitingCount) return 'Response Needed'
  return 'Clear'
}

function getHeadline(
  status: LaunchRecipientResponseMonitorStatus,
  awaitingCount: number,
  followUpCount: number,
  escalatedCount: number,
  closedCount: number,
) {
  if (status === 'Escalated') return `${escalatedCount} recipient response item${escalatedCount === 1 ? '' : 's'} escalated`
  if (status === 'Follow-Up') return `${followUpCount} recipient response item${followUpCount === 1 ? '' : 's'} need follow-up`
  if (status === 'Response Needed') return `${awaitingCount} recipient response item${awaitingCount === 1 ? '' : 's'} awaiting acknowledgement`
  if (closedCount) return `${closedCount} recipient response item${closedCount === 1 ? '' : 's'} closed`
  return 'No delivery evidence items are ready for recipient response monitoring'
}

function getSummary(
  status: LaunchRecipientResponseMonitorStatus,
  total: number,
  awaitingCount: number,
  followUpCount: number,
  escalatedCount: number,
  customerFacingCount: number,
) {
  if (status === 'Escalated') return `${escalatedCount} of ${total} recipient response items are escalated, including ${customerFacingCount} customer-facing items.`
  if (status === 'Follow-Up') return `${followUpCount} response items need human follow-up before launch response monitoring can close.`
  if (status === 'Response Needed') return `${awaitingCount} response items are awaiting acknowledgement, reply, or response-window expiry.`
  return total ? `${total} response items are acknowledged or closed.` : 'No delivery evidence items are ready for recipient response monitoring.'
}

function itemStatusRank(status: LaunchRecipientResponseItemStatus) {
  if (status === 'Escalated') return 0
  if (status === 'Needs Follow-Up') return 1
  if (status === 'Awaiting Response') return 2
  if (status === 'Acknowledged') return 3
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

function emitLaunchRecipientResponseRecordChange() {
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
