import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchPostLaunchIncidentCommander,
  LaunchPostLaunchIncidentPacket,
  LaunchPostLaunchIncidentSeverity,
} from './launchPostLaunchIncidentCommander'
import type { LaunchPostLaunchSurface } from './launchPostLaunchWatchtower'

export type LaunchCommsApprovalCenterStatus = 'Review Required' | 'Approved Drafts Ready' | 'Monitoring' | 'Clear'
export type LaunchCommsApprovalStatus = 'Needs Owner Review' | 'Approved Draft' | 'Hold' | 'Not Required'
export type LaunchCommsApprovalAudience = 'Customer' | 'Internal' | 'Owner'
export type LaunchCommsApprovalChannel = 'Customer Email' | 'In-App Notice' | 'Internal Brief' | 'Owner Update' | 'Support Note'
export type LaunchCommsApprovalCheckStatus = 'Missing' | 'Review' | 'Ready'

export interface LaunchCommsApprovalCheck {
  id: string
  label: string
  status: LaunchCommsApprovalCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchCommsApprovalDraft {
  id: string
  title: string
  audience: LaunchCommsApprovalAudience
  channel: LaunchCommsApprovalChannel
  status: LaunchCommsApprovalStatus
  sourceIncidentId: string
  sourceIncidentTitle: string
  severity: LaunchPostLaunchIncidentSeverity
  reference: string
  surface: LaunchPostLaunchSurface
  owner: string
  approvalOwner: string
  draft: string
  riskNote: string
  evidence: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  actionRequired: boolean
  checks: LaunchCommsApprovalCheck[]
}

export interface LaunchCommsApprovalAudienceGroup {
  audience: LaunchCommsApprovalAudience
  total: number
  needsReview: number
  approved: number
  hold: number
  nextStep: string
}

export interface LaunchCommsApprovalOwnerGroup {
  owner: string
  total: number
  customerFacing: number
  needsReview: number
  approved: number
  nextStep: string
}

export interface LaunchCommsApprovalRecord {
  id: string
  itemId?: string
  itemTitle?: string
  audience?: LaunchCommsApprovalAudience
  channel?: LaunchCommsApprovalChannel
  itemStatus: LaunchCommsApprovalStatus
  centerStatus: LaunchCommsApprovalCenterStatus
  pendingReviewCount: number
  approvedDraftCount: number
  holdCount: number
  customerFacingCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchCommsApprovalCenter {
  status: LaunchCommsApprovalCenterStatus
  headline: string
  summary: string
  generatedAt: string
  drafts: LaunchCommsApprovalDraft[]
  nextDraft?: LaunchCommsApprovalDraft
  pendingReviewCount: number
  approvedDraftCount: number
  holdCount: number
  customerFacingCount: number
  internalUpdateCount: number
  ownerUpdateCount: number
  auditBackedCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchCommsApprovalRecord
  audienceGroups: LaunchCommsApprovalAudienceGroup[]
  ownerGroups: LaunchCommsApprovalOwnerGroup[]
}

interface BuildLaunchCommsApprovalCenterInput {
  incidentCommander: LaunchPostLaunchIncidentCommander
  records: LaunchCommsApprovalRecord[]
}

interface SaveLaunchCommsApprovalRecordInput {
  center: LaunchCommsApprovalCenter
  draft?: LaunchCommsApprovalDraft
  itemStatus?: LaunchCommsApprovalStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_communications_approval_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchCommsApprovalRecord[] = []

export const launchCommsApprovalBoundaryRule =
  'Launch Communications Approval Center drafts, reviews, exports, and queues communication approval requests only. It does not send customer messages, publish in-app notices, change incident state, mutate customer data, alter billing, modify modules, change permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchCommsApprovalCenter(input: BuildLaunchCommsApprovalCenterInput): LaunchCommsApprovalCenter {
  const generatedAt = new Date().toISOString()
  const drafts = input.incidentCommander.incidents
    .flatMap(incident => draftsFromIncident(incident, input.records))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || audienceRank(a.audience) - audienceRank(b.audience) || severityRank(a.severity) - severityRank(b.severity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const pendingReviewCount = drafts.filter(draft => draft.status === 'Needs Owner Review').length
  const approvedDraftCount = drafts.filter(draft => draft.status === 'Approved Draft').length
  const holdCount = drafts.filter(draft => draft.status === 'Hold').length
  const customerFacingCount = drafts.filter(draft => draft.audience === 'Customer').length
  const internalUpdateCount = drafts.filter(draft => draft.audience === 'Internal').length
  const ownerUpdateCount = drafts.filter(draft => draft.audience === 'Owner').length
  const status: LaunchCommsApprovalCenterStatus = pendingReviewCount
    ? 'Review Required'
    : approvedDraftCount
      ? 'Approved Drafts Ready'
      : drafts.length
        ? 'Monitoring'
        : 'Clear'

  return {
    status,
    headline: getHeadline(status, pendingReviewCount, approvedDraftCount, customerFacingCount),
    summary: getSummary(status, drafts.length, pendingReviewCount, customerFacingCount, holdCount),
    generatedAt,
    drafts,
    nextDraft: drafts.find(draft => draft.status === 'Needs Owner Review' || draft.status === 'Hold') ?? drafts[0],
    pendingReviewCount,
    approvedDraftCount,
    holdCount,
    customerFacingCount,
    internalUpdateCount,
    ownerUpdateCount,
    auditBackedCount: drafts.filter(draft => draft.auditBacked).length,
    actionRequiredCount: drafts.filter(draft => draft.actionRequired).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    audienceGroups: buildAudienceGroups(drafts),
    ownerGroups: buildOwnerGroups(drafts),
  }
}

export function getLaunchCommsApprovalRecords(): LaunchCommsApprovalRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchCommsApprovalRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchCommsApprovalRecord(input: SaveLaunchCommsApprovalRecordInput) {
  const record: LaunchCommsApprovalRecord = {
    id: crypto.randomUUID(),
    itemId: input.draft?.id,
    itemTitle: input.draft?.title,
    audience: input.draft?.audience,
    channel: input.draft?.channel,
    itemStatus: input.itemStatus ?? input.draft?.status ?? 'Needs Owner Review',
    centerStatus: input.center.status,
    pendingReviewCount: input.center.pendingReviewCount,
    approvedDraftCount: input.center.approvedDraftCount,
    holdCount: input.center.holdCount,
    customerFacingCount: input.center.customerFacingCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchCommsApprovalRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchCommsApprovalRecordChange()
  return record
}

export function subscribeToLaunchCommsApprovalRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchCommsApprovalRecords() {
  return useSyncExternalStore(subscribeToLaunchCommsApprovalRecords, getLaunchCommsApprovalRecords, () => [])
}

export function getLaunchCommsApprovalCenterTone(status: LaunchCommsApprovalCenterStatus) {
  if (status === 'Review Required') return 'warn' as const
  if (status === 'Approved Drafts Ready') return 'ok' as const
  if (status === 'Monitoring') return 'neutral' as const
  return 'ok' as const
}

export function getLaunchCommsApprovalStatusTone(status: LaunchCommsApprovalStatus) {
  if (status === 'Needs Owner Review') return 'warn' as const
  if (status === 'Approved Draft') return 'ok' as const
  if (status === 'Hold') return 'danger' as const
  return 'neutral' as const
}

export function getLaunchCommsApprovalAudienceTone(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return 'warn' as const
  if (audience === 'Internal') return 'info' as const
  return 'neutral' as const
}

export function getLaunchCommsApprovalCheckTone(status: LaunchCommsApprovalCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchCommsApprovalMetricTone(status: LaunchCommsApprovalCenterStatus) {
  if (status === 'Review Required') return 'warn' as const
  if (status === 'Approved Drafts Ready' || status === 'Clear') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchCommsApprovalFilename(center: LaunchCommsApprovalCenter) {
  return `launch-communications-approval-${center.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchCommsApprovalHtml(center: LaunchCommsApprovalCenter, session: AdminSession) {
  const rows = center.drafts.map(draft => `
    <tr>
      <td>${escapeHtml(draft.audience)}</td>
      <td>${escapeHtml(draft.status)}</td>
      <td>${escapeHtml(draft.title)}</td>
      <td>${escapeHtml(draft.channel)}</td>
      <td>${escapeHtml(draft.approvalOwner)}</td>
      <td>${escapeHtml(draft.riskNote)}</td>
      <td>${escapeHtml(draft.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Communications Approval Center</title>
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
    <h1>${escapeHtml(center.headline)}</h1>
    <p>${escapeHtml(center.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(center.status)}</strong></div>
      <div class="card"><span>Needs Review</span><strong>${center.pendingReviewCount}</strong></div>
      <div class="card"><span>Approved Drafts</span><strong>${center.approvedDraftCount}</strong></div>
      <div class="card"><span>Customer Facing</span><strong>${center.customerFacingCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(center.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is communication approval evidence only and does not send or publish messages.
    </div>
    <h2>Communication Drafts</h2>
    <table>
      <thead><tr><th>Audience</th><th>Status</th><th>Draft</th><th>Channel</th><th>Approver</th><th>Risk</th><th>Next Step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No communication drafts require review.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function draftsFromIncident(incident: LaunchPostLaunchIncidentPacket, records: LaunchCommsApprovalRecord[]): LaunchCommsApprovalDraft[] {
  const drafts: LaunchCommsApprovalDraft[] = []

  if (incident.commsDraft) {
    drafts.push(buildDraft({
      incident,
      audience: 'Customer',
      channel: incident.severity === 'SEV1' || incident.severity === 'SEV2' ? 'Customer Email' : 'Support Note',
      title: `Customer update: ${incident.title}`,
      owner: 'Support Lead',
      approvalOwner: incident.severity === 'SEV1' || incident.severity === 'SEV2' ? 'Owner' : 'Client Success',
      draft: incident.commsDraft,
      defaultStatus: 'Needs Owner Review',
      records,
    }))
  }

  drafts.push(buildDraft({
    incident,
    audience: 'Internal',
    channel: 'Internal Brief',
    title: `Internal update: ${incident.title}`,
    owner: incident.commander,
    approvalOwner: incident.commander,
    draft: incident.internalUpdate,
    defaultStatus: incident.severity === 'SEV1' ? 'Needs Owner Review' : 'Approved Draft',
    records,
  }))

  if (incident.actionRequired || incident.severity === 'SEV1' || incident.severity === 'SEV2') {
    drafts.push(buildDraft({
      incident,
      audience: 'Owner',
      channel: 'Owner Update',
      title: `Owner decision update: ${incident.title}`,
      owner: 'Owner',
      approvalOwner: 'Owner',
      draft: `Owner review needed for ${incident.severity} ${incident.title}. Current mitigation: ${incident.currentMitigation}. Proposed response: ${incident.nextStep}`,
      defaultStatus: 'Needs Owner Review',
      records,
    }))
  }

  return drafts
}

function buildDraft(input: {
  incident: LaunchPostLaunchIncidentPacket
  audience: LaunchCommsApprovalAudience
  channel: LaunchCommsApprovalChannel
  title: string
  owner: string
  approvalOwner: string
  draft: string
  defaultStatus: LaunchCommsApprovalStatus
  records: LaunchCommsApprovalRecord[]
}): LaunchCommsApprovalDraft {
  const id = `${input.incident.id}-${input.audience.toLowerCase()}-${input.channel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const latestRecord = input.records.find(record => record.itemId === id)
  const status = latestRecord?.itemStatus ?? input.defaultStatus

  return {
    id,
    title: input.title,
    audience: input.audience,
    channel: input.channel,
    status,
    sourceIncidentId: input.incident.id,
    sourceIncidentTitle: input.incident.title,
    severity: input.incident.severity,
    reference: input.incident.reference,
    surface: input.incident.surface,
    owner: input.owner,
    approvalOwner: input.approvalOwner,
    draft: input.draft,
    riskNote: riskNoteForDraft(input.incident, input.audience),
    evidence: input.incident.evidence,
    nextStep: nextStepForDraft(status, input.audience),
    responseWindow: input.incident.responseWindow,
    updatedAt: latestRecord?.recordedAt ?? input.incident.updatedAt,
    auditBacked: input.incident.auditBacked,
    actionRequired: input.incident.actionRequired || status === 'Needs Owner Review' || status === 'Hold',
    checks: buildChecks(input.incident, input.audience, input.draft, status),
  }
}

function buildChecks(
  incident: LaunchPostLaunchIncidentPacket,
  audience: LaunchCommsApprovalAudience,
  draft: string,
  status: LaunchCommsApprovalStatus,
): LaunchCommsApprovalCheck[] {
  return [
    {
      id: `${incident.id}-${audience}-impact`,
      label: 'Impact statement is bounded',
      status: draft.includes('Current impact') || audience !== 'Customer' ? 'Ready' : 'Review',
      evidence: audience === 'Customer' ? 'Customer draft references current impact without root cause claims.' : 'Internal update can include operational context.',
      required: audience === 'Customer',
    },
    {
      id: `${incident.id}-${audience}-mitigation`,
      label: 'Mitigation is current-state only',
      status: draft.includes('Current response') || draft.includes('Current mitigation') ? 'Ready' : 'Review',
      evidence: incident.currentMitigation,
      required: true,
    },
    {
      id: `${incident.id}-${audience}-approval`,
      label: 'Human approval captured before send',
      status: status === 'Approved Draft' ? 'Ready' : status === 'Hold' ? 'Missing' : 'Review',
      evidence: status,
      required: audience === 'Customer' || incident.severity === 'SEV1' || incident.severity === 'SEV2',
    },
    {
      id: `${incident.id}-${audience}-audit`,
      label: 'Audit evidence attached',
      status: incident.auditBacked ? 'Ready' : 'Review',
      evidence: incident.auditBacked ? 'Source incident is audit backed.' : 'Audit evidence is still pending.',
      required: true,
    },
  ]
}

function buildAudienceGroups(drafts: LaunchCommsApprovalDraft[]): LaunchCommsApprovalAudienceGroup[] {
  return (['Customer', 'Internal', 'Owner'] as LaunchCommsApprovalAudience[]).map(audience => {
    const rows = drafts.filter(draft => draft.audience === audience)
    const nextDraft = rows.find(draft => draft.status === 'Needs Owner Review' || draft.status === 'Hold') ?? rows[0]
    return {
      audience,
      total: rows.length,
      needsReview: rows.filter(draft => draft.status === 'Needs Owner Review').length,
      approved: rows.filter(draft => draft.status === 'Approved Draft').length,
      hold: rows.filter(draft => draft.status === 'Hold').length,
      nextStep: nextDraft?.nextStep ?? 'No communication review needed for this audience.',
    }
  }).filter(group => group.total > 0)
}

function buildOwnerGroups(drafts: LaunchCommsApprovalDraft[]): LaunchCommsApprovalOwnerGroup[] {
  const owners = Array.from(new Set(drafts.map(draft => draft.approvalOwner)))
  return owners.map(owner => {
    const rows = drafts.filter(draft => draft.approvalOwner === owner)
    const nextDraft = rows.find(draft => draft.status === 'Needs Owner Review' || draft.status === 'Hold') ?? rows[0]
    return {
      owner,
      total: rows.length,
      customerFacing: rows.filter(draft => draft.audience === 'Customer').length,
      needsReview: rows.filter(draft => draft.status === 'Needs Owner Review').length,
      approved: rows.filter(draft => draft.status === 'Approved Draft').length,
      nextStep: nextDraft?.nextStep ?? 'No communication approval needed.',
    }
  }).sort((a, b) => b.needsReview - a.needsReview || b.customerFacing - a.customerFacing || a.owner.localeCompare(b.owner))
}

function riskNoteForDraft(incident: LaunchPostLaunchIncidentPacket, audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer' && (incident.severity === 'SEV1' || incident.severity === 'SEV2')) {
    return 'Customer-facing update requires owner approval and must avoid unverified root cause, timelines, or remediation claims.'
  }
  if (audience === 'Owner') return 'Owner update should separate confirmed facts from proposed next action.'
  return 'Internal update can be shared after confirming the incident packet is current.'
}

function nextStepForDraft(status: LaunchCommsApprovalStatus, audience: LaunchCommsApprovalAudience) {
  if (status === 'Approved Draft') return audience === 'Customer' ? 'Queue send-review request before any customer-facing delivery.' : 'Attach approved update to the incident timeline.'
  if (status === 'Hold') return 'Hold communication until impact, mitigation, and owner approval are refreshed.'
  if (status === 'Not Required') return 'No communication action required.'
  return 'Review draft, confirm facts, and record approval or hold decision.'
}

function getHeadline(status: LaunchCommsApprovalCenterStatus, pendingReviewCount: number, approvedDraftCount: number, customerFacingCount: number) {
  if (status === 'Review Required') return `${pendingReviewCount} launch communication draft${pendingReviewCount === 1 ? '' : 's'} need approval`
  if (status === 'Approved Drafts Ready') return `${approvedDraftCount} approved launch draft${approvedDraftCount === 1 ? '' : 's'} ready for governed follow-up`
  if (status === 'Monitoring') return `${customerFacingCount} customer-facing draft${customerFacingCount === 1 ? '' : 's'} under monitoring`
  return 'No launch communications require approval'
}

function getSummary(status: LaunchCommsApprovalCenterStatus, total: number, pendingReviewCount: number, customerFacingCount: number, holdCount: number) {
  if (status === 'Review Required') return `${pendingReviewCount} of ${total} communication drafts need human approval, including ${customerFacingCount} customer-facing drafts.`
  if (status === 'Approved Drafts Ready') return `${total} communication drafts are recorded, with ${customerFacingCount} customer-facing drafts ready for governed send review.`
  if (status === 'Monitoring') return `${total} communication drafts are available for incident monitoring.`
  if (holdCount) return `${holdCount} communication drafts are on hold.`
  return 'Incident commander has not produced communication drafts requiring approval.'
}

function statusRank(status: LaunchCommsApprovalStatus) {
  if (status === 'Hold') return 0
  if (status === 'Needs Owner Review') return 1
  if (status === 'Approved Draft') return 2
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

function emitLaunchCommsApprovalRecordChange() {
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
