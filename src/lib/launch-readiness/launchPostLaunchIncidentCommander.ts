import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { LaunchPostLaunchSignal, LaunchPostLaunchSurface, LaunchPostLaunchWatchtower } from './launchPostLaunchWatchtower'
import type { LaunchWarRoomTimeline } from './launchWarRoomTimeline'

export type LaunchPostLaunchIncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type LaunchPostLaunchIncidentStatus = 'Investigating' | 'Mitigation Ready' | 'Monitoring' | 'Closure Ready'
export type LaunchPostLaunchIncidentStepStatus = 'Open' | 'Ready' | 'Done'
export type LaunchPostLaunchIncidentClosureStatus = 'Missing' | 'Review' | 'Ready' | 'Complete'

export interface LaunchPostLaunchIncidentStep {
  id: string
  label: string
  owner: string
  status: LaunchPostLaunchIncidentStepStatus
  detail: string
  action: string
}

export interface LaunchPostLaunchIncidentClosureCheck {
  id: string
  label: string
  status: LaunchPostLaunchIncidentClosureStatus
  evidence: string
  required: boolean
}

export interface LaunchPostLaunchIncidentTimelineItem {
  id: string
  label: string
  detail: string
  source: 'Watchtower' | 'War Room' | 'Action Queue' | 'Audit' | 'Support' | 'Health'
  occurredAt: string
}

export interface LaunchPostLaunchIncidentPacket {
  id: string
  title: string
  severity: LaunchPostLaunchIncidentSeverity
  status: LaunchPostLaunchIncidentStatus
  commander: string
  lane: LaunchPostLaunchSignal['lane']
  sourceSignalId: string
  reference: string
  surface: LaunchPostLaunchSurface
  customerImpact: string
  currentMitigation: string
  commsDraft: string
  internalUpdate: string
  responseWindow: string
  evidence: string
  nextStep: string
  startedAt: string
  updatedAt: string
  affectedClients: number
  affectedVenues: number
  linkedActionCount: number
  linkedAuditCount: number
  auditBacked: boolean
  actionRequired: boolean
  runbookSteps: LaunchPostLaunchIncidentStep[]
  closureChecks: LaunchPostLaunchIncidentClosureCheck[]
  timeline: LaunchPostLaunchIncidentTimelineItem[]
}

export interface LaunchPostLaunchIncidentCommanderGroup {
  commander: string
  total: number
  sev1: number
  sev2: number
  sev3: number
  open: number
  nextStep: string
}

export interface LaunchPostLaunchIncidentSeverityGroup {
  severity: LaunchPostLaunchIncidentSeverity
  total: number
  investigating: number
  mitigationReady: number
  monitoring: number
  closureReady: number
  nextStep: string
}

export interface LaunchPostLaunchIncidentRecord {
  id: string
  incidentId?: string
  incidentTitle?: string
  severity?: LaunchPostLaunchIncidentSeverity
  status: LaunchPostLaunchIncidentStatus
  commander?: string
  packetStatus: LaunchPostLaunchIncidentCommander['status']
  openIncidentCount: number
  sev1Count: number
  sev2Count: number
  commsDraftCount: number
  closureReadyCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchPostLaunchIncidentCommander {
  status: 'Critical' | 'Active' | 'Monitoring' | 'Clear'
  headline: string
  summary: string
  generatedAt: string
  incidents: LaunchPostLaunchIncidentPacket[]
  nextIncident?: LaunchPostLaunchIncidentPacket
  openIncidentCount: number
  sev1Count: number
  sev2Count: number
  sev3Count: number
  sev4Count: number
  commsDraftCount: number
  mitigationReadyCount: number
  monitoringCount: number
  closureReadyCount: number
  auditBackedCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchPostLaunchIncidentRecord
  commanderGroups: LaunchPostLaunchIncidentCommanderGroup[]
  severityGroups: LaunchPostLaunchIncidentSeverityGroup[]
}

interface BuildLaunchPostLaunchIncidentCommanderInput {
  data: PlatformAdminReadModel
  postLaunchWatchtower: LaunchPostLaunchWatchtower
  launchWarRoomTimeline: LaunchWarRoomTimeline
  actionRequests: AdminActionRequest[]
  records: LaunchPostLaunchIncidentRecord[]
}

interface SaveLaunchPostLaunchIncidentRecordInput {
  commander: LaunchPostLaunchIncidentCommander
  incident?: LaunchPostLaunchIncidentPacket
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_post_launch_incident_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchPostLaunchIncidentRecord[] = []

export const launchPostLaunchIncidentBoundaryRule =
  'Post-Launch Incident Commander records coordinate response, communications, and closure evidence only. Recording, exporting, or queueing incident response does not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchPostLaunchIncidentCommander(input: BuildLaunchPostLaunchIncidentCommanderInput): LaunchPostLaunchIncidentCommander {
  const generatedAt = new Date().toISOString()
  const incidents = input.postLaunchWatchtower.signals
    .filter(signal => signal.actionRequired || signal.status === 'Critical' || signal.status === 'Watch')
    .map(signal => incidentFromSignal(signal, input, generatedAt))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || statusRank(b.status) - statusRank(a.status) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const sev1Count = incidents.filter(incident => incident.severity === 'SEV1').length
  const sev2Count = incidents.filter(incident => incident.severity === 'SEV2').length
  const sev3Count = incidents.filter(incident => incident.severity === 'SEV3').length
  const sev4Count = incidents.filter(incident => incident.severity === 'SEV4').length
  const openIncidentCount = incidents.filter(incident => incident.status !== 'Closure Ready').length
  const status = sev1Count ? 'Critical' : sev2Count || openIncidentCount ? 'Active' : incidents.length ? 'Monitoring' : 'Clear'

  return {
    status,
    headline: getHeadline(status, sev1Count, sev2Count, openIncidentCount),
    summary: getSummary(status, incidents.length, sev1Count, sev2Count, openIncidentCount),
    generatedAt,
    incidents,
    nextIncident: incidents.find(incident => incident.status === 'Investigating' || incident.status === 'Mitigation Ready') ?? incidents[0],
    openIncidentCount,
    sev1Count,
    sev2Count,
    sev3Count,
    sev4Count,
    commsDraftCount: incidents.filter(incident => incident.commsDraft.length > 0 && incident.status !== 'Closure Ready').length,
    mitigationReadyCount: incidents.filter(incident => incident.status === 'Mitigation Ready').length,
    monitoringCount: incidents.filter(incident => incident.status === 'Monitoring').length,
    closureReadyCount: incidents.filter(incident => incident.status === 'Closure Ready').length,
    auditBackedCount: incidents.filter(incident => incident.auditBacked).length,
    actionRequiredCount: incidents.filter(incident => incident.actionRequired).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    commanderGroups: buildCommanderGroups(incidents),
    severityGroups: buildSeverityGroups(incidents),
  }
}

export function getLaunchPostLaunchIncidentRecords(): LaunchPostLaunchIncidentRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchPostLaunchIncidentRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchPostLaunchIncidentRecord(input: SaveLaunchPostLaunchIncidentRecordInput) {
  const record: LaunchPostLaunchIncidentRecord = {
    id: crypto.randomUUID(),
    incidentId: input.incident?.id,
    incidentTitle: input.incident?.title,
    severity: input.incident?.severity,
    status: input.incident?.status ?? input.commander.nextIncident?.status ?? 'Monitoring',
    commander: input.incident?.commander,
    packetStatus: input.commander.status,
    openIncidentCount: input.commander.openIncidentCount,
    sev1Count: input.commander.sev1Count,
    sev2Count: input.commander.sev2Count,
    commsDraftCount: input.commander.commsDraftCount,
    closureReadyCount: input.commander.closureReadyCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchPostLaunchIncidentRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchPostLaunchIncidentRecordChange()
  return record
}

export function subscribeToLaunchPostLaunchIncidentRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchPostLaunchIncidentRecords() {
  return useSyncExternalStore(subscribeToLaunchPostLaunchIncidentRecords, getLaunchPostLaunchIncidentRecords, () => [])
}

export function getLaunchPostLaunchIncidentSeverityTone(severity: LaunchPostLaunchIncidentSeverity) {
  if (severity === 'SEV1') return 'danger' as const
  if (severity === 'SEV2') return 'warn' as const
  if (severity === 'SEV3') return 'info' as const
  return 'neutral' as const
}

export function getLaunchPostLaunchIncidentStatusTone(status: LaunchPostLaunchIncidentStatus | LaunchPostLaunchIncidentCommander['status']) {
  if (status === 'Critical' || status === 'Investigating') return 'danger' as const
  if (status === 'Active' || status === 'Mitigation Ready') return 'warn' as const
  if (status === 'Monitoring') return 'info' as const
  return 'ok' as const
}

export function getLaunchPostLaunchIncidentMetricTone(status: LaunchPostLaunchIncidentCommander['status']) {
  if (status === 'Critical') return 'danger' as const
  if (status === 'Active') return 'warn' as const
  if (status === 'Monitoring') return 'neutral' as const
  return 'ok' as const
}

export function getLaunchPostLaunchIncidentStepTone(status: LaunchPostLaunchIncidentStepStatus | LaunchPostLaunchIncidentClosureStatus) {
  if (status === 'Open' || status === 'Missing') return 'danger' as const
  if (status === 'Ready' || status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchPostLaunchIncidentFilename(commander: LaunchPostLaunchIncidentCommander) {
  return `launch-post-launch-incident-commander-${commander.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchPostLaunchIncidentHtml(commander: LaunchPostLaunchIncidentCommander, session: AdminSession) {
  const incidentRows = commander.incidents.map(incident => `
    <tr>
      <td>${escapeHtml(incident.severity)}</td>
      <td>${escapeHtml(incident.status)}</td>
      <td>${escapeHtml(incident.title)}</td>
      <td>${escapeHtml(incident.commander)}</td>
      <td>${escapeHtml(incident.responseWindow)}</td>
      <td>${escapeHtml(incident.customerImpact)}</td>
      <td>${escapeHtml(incident.nextStep)}</td>
    </tr>
  `).join('')
  const timelineRows = commander.incidents.flatMap(incident => incident.timeline.map(item => `
    <tr>
      <td>${escapeHtml(incident.title)}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.detail)}</td>
      <td>${escapeHtml(item.occurredAt)}</td>
    </tr>
  `)).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Post-Launch Incident Commander</title>
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
    <h1>${escapeHtml(commander.headline)}</h1>
    <p>${escapeHtml(commander.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(commander.status)}</strong></div>
      <div class="card"><span>Open Incidents</span><strong>${commander.openIncidentCount}</strong></div>
      <div class="card"><span>SEV1 / SEV2</span><strong>${commander.sev1Count}/${commander.sev2Count}</strong></div>
      <div class="card"><span>Comms Drafts</span><strong>${commander.commsDraftCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(commander.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is incident coordination evidence only and does not execute production changes.
    </div>
    <h2>Incident Packets</h2>
    <table>
      <thead><tr><th>Severity</th><th>Status</th><th>Incident</th><th>Commander</th><th>Response</th><th>Impact</th><th>Next Step</th></tr></thead>
      <tbody>${incidentRows || '<tr><td colspan="7">No launch incidents are open.</td></tr>'}</tbody>
    </table>
    <h2>Incident Timeline</h2>
    <table>
      <thead><tr><th>Incident</th><th>Source</th><th>Label</th><th>Detail</th><th>Time</th></tr></thead>
      <tbody>${timelineRows || '<tr><td colspan="5">No incident timeline entries.</td></tr>'}</tbody>
    </table>
  </body>
</html>`
}

function incidentFromSignal(
  signal: LaunchPostLaunchSignal,
  input: BuildLaunchPostLaunchIncidentCommanderInput,
  generatedAt: string,
): LaunchPostLaunchIncidentPacket {
  const severity = severityFromSignal(signal)
  const linkedActions = matchingActionRequests(signal, input.actionRequests)
  const linkedAudits = matchingAuditEvents(signal, input.data)
  const supportImpact = supportImpactForSignal(signal, input.data)
  const healthImpact = healthImpactForSignal(signal, input.data)
  const commander = commanderForSignal(signal)
  const status = statusFromSignal(signal, linkedActions.length)
  const timeline = buildTimeline(signal, linkedActions, input, generatedAt)

  return {
    id: `launch-incident-${signal.id}`,
    title: signal.title,
    severity,
    status,
    commander,
    lane: signal.lane,
    sourceSignalId: signal.id,
    reference: signal.reference,
    surface: signal.surface,
    customerImpact: getCustomerImpact(signal, supportImpact, healthImpact),
    currentMitigation: getMitigation(signal, linkedActions),
    commsDraft: buildCommsDraft(signal, severity, supportImpact, healthImpact),
    internalUpdate: buildInternalUpdate(signal, severity, commander),
    responseWindow: signal.responseWindow,
    evidence: signal.evidence,
    nextStep: signal.nextStep,
    startedAt: timeline[0]?.occurredAt ?? signal.updatedAt,
    updatedAt: signal.updatedAt,
    affectedClients: Math.max(supportImpact.clients, healthImpact.clients),
    affectedVenues: Math.max(supportImpact.venues, healthImpact.venues),
    linkedActionCount: linkedActions.length,
    linkedAuditCount: linkedAudits.length,
    auditBacked: signal.auditBacked || linkedAudits.length > 0,
    actionRequired: signal.actionRequired,
    runbookSteps: buildRunbook(signal, severity, commander, linkedActions.length, linkedAudits.length),
    closureChecks: buildClosureChecks(signal, linkedActions.length, linkedAudits.length),
    timeline,
  }
}

function matchingActionRequests(signal: LaunchPostLaunchSignal, actionRequests: AdminActionRequest[]) {
  const needle = signal.title.toLowerCase()
  const lane = signal.lane.toLowerCase()
  return actionRequests.filter(request => {
    const haystack = `${request.title} ${request.reason} ${request.scope.label} ${request.status}`.toLowerCase()
    return haystack.includes(needle) || haystack.includes(lane) || haystack.includes(signal.reference.toLowerCase())
  })
}

function matchingAuditEvents(signal: LaunchPostLaunchSignal, data: PlatformAdminReadModel) {
  const needle = signal.title.toLowerCase()
  const lane = signal.lane.toLowerCase()
  return data.auditEvents.filter(event => {
    const haystack = `${event.actionKey} ${event.actionLabel} ${event.scope}`.toLowerCase()
    return haystack.includes(needle) || haystack.includes(lane) || haystack.includes(signal.reference.toLowerCase())
  })
}

function supportImpactForSignal(signal: LaunchPostLaunchSignal, data: PlatformAdminReadModel) {
  if (signal.lane !== 'Support' && signal.lane !== 'Platform Health') return { clients: 0, venues: 0, users: 0 }
  const activeIssues = data.supportIssues.filter(issue => issue.status !== 'Resolved')
  return {
    clients: new Set(activeIssues.map(issue => issue.organizationName)).size,
    venues: new Set(activeIssues.map(issue => issue.venueName)).size,
    users: activeIssues.reduce((total, issue) => total + issue.affectedUsers, 0),
  }
}

function healthImpactForSignal(signal: LaunchPostLaunchSignal, data: PlatformAdminReadModel) {
  if (signal.lane !== 'Platform Health') return { clients: 0, venues: 0 }
  const activeSignals = data.platformHealthSignals.filter(item => item.status === 'Failing' || item.status === 'Warning')
  return {
    clients: activeSignals.reduce((total, item) => total + item.affectedClients, 0),
    venues: activeSignals.reduce((total, item) => total + item.affectedVenues, 0),
  }
}

function buildTimeline(
  signal: LaunchPostLaunchSignal,
  linkedActions: AdminActionRequest[],
  input: BuildLaunchPostLaunchIncidentCommanderInput,
  generatedAt: string,
): LaunchPostLaunchIncidentTimelineItem[] {
  const warRoomEvents = input.launchWarRoomTimeline.events
    .filter(event => event.status === 'Critical' || event.status === 'Action Needed' || event.reference === signal.reference || event.owner === signal.owner)
    .slice(0, 4)
  return [
    {
      id: `${signal.id}-watchtower`,
      label: `${signal.status} watchtower signal`,
      detail: signal.evidence,
      source: 'Watchtower' as const,
      occurredAt: signal.updatedAt,
    },
    ...warRoomEvents.map(event => ({
      id: `${signal.id}-war-${event.id}`,
      label: event.title,
      detail: event.nextStep,
      source: 'War Room' as const,
      occurredAt: event.occurredAt,
    })),
    ...linkedActions.slice(0, 4).map(request => ({
      id: `${signal.id}-action-${request.id}`,
      label: `${request.status} action request`,
      detail: request.title,
      source: 'Action Queue' as const,
      occurredAt: request.updatedAt ?? request.createdAt,
    })),
    {
      id: `${signal.id}-generated`,
      label: 'Incident packet generated',
      detail: 'Launch-specific incident packet assembled from post-launch watchtower state.',
      source: 'Audit' as const,
      occurredAt: generatedAt,
    },
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

function buildRunbook(
  signal: LaunchPostLaunchSignal,
  severity: LaunchPostLaunchIncidentSeverity,
  commander: string,
  linkedActionCount: number,
  linkedAuditCount: number,
): LaunchPostLaunchIncidentStep[] {
  return [
    {
      id: `${signal.id}-assign`,
      label: 'Confirm commander and severity',
      owner: 'Owner',
      status: 'Ready',
      detail: `${commander} is proposed commander for ${severity}.`,
      action: 'Confirm commander, severity, and response window before any production follow-up.',
    },
    {
      id: `${signal.id}-impact`,
      label: 'Validate customer impact',
      owner: signal.owner,
      status: signal.status === 'Critical' ? 'Open' : 'Ready',
      detail: signal.evidence,
      action: 'Confirm affected clients, venues, and operational impact from read-only signals.',
    },
    {
      id: `${signal.id}-mitigation`,
      label: 'Route mitigation through governed action',
      owner: 'Operations',
      status: linkedActionCount ? 'Ready' : 'Open',
      detail: linkedActionCount ? `${linkedActionCount} related action request${linkedActionCount === 1 ? '' : 's'} linked.` : 'No governed response request is linked yet.',
      action: signal.nextStep,
    },
    {
      id: `${signal.id}-comms`,
      label: 'Prepare internal and customer communications',
      owner: severity === 'SEV1' || severity === 'SEV2' ? 'Support Lead' : 'Client Success',
      status: severity === 'SEV1' || severity === 'SEV2' ? 'Open' : 'Ready',
      detail: 'Draft must avoid unverified root cause and should reference current mitigation only.',
      action: 'Prepare update for owner approval before any customer-facing send.',
    },
    {
      id: `${signal.id}-evidence`,
      label: 'Attach closure evidence',
      owner: 'Engineering',
      status: linkedAuditCount || signal.auditBacked ? 'Done' : 'Open',
      detail: linkedAuditCount ? `${linkedAuditCount} audit event${linkedAuditCount === 1 ? '' : 's'} linked.` : 'Closure evidence still needs an audit-backed record.',
      action: 'Attach audit event, response record, watch check, and closure notes before closing.',
    },
  ]
}

function buildClosureChecks(signal: LaunchPostLaunchSignal, linkedActionCount: number, linkedAuditCount: number): LaunchPostLaunchIncidentClosureCheck[] {
  return [
    {
      id: `${signal.id}-signal-stable`,
      label: 'Signal stable or explicitly accepted',
      status: signal.status === 'Stable' ? 'Complete' : signal.status === 'Monitoring' ? 'Ready' : 'Missing',
      evidence: signal.status,
      required: true,
    },
    {
      id: `${signal.id}-response-routed`,
      label: 'Response routed through Admin Action Requests',
      status: linkedActionCount ? 'Ready' : 'Missing',
      evidence: linkedActionCount ? `${linkedActionCount} action request${linkedActionCount === 1 ? '' : 's'} linked.` : 'No linked action request.',
      required: signal.actionRequired,
    },
    {
      id: `${signal.id}-audit-evidence`,
      label: 'Audit-backed incident evidence attached',
      status: linkedAuditCount || signal.auditBacked ? 'Complete' : 'Review',
      evidence: linkedAuditCount ? `${linkedAuditCount} audit event${linkedAuditCount === 1 ? '' : 's'} linked.` : signal.auditBacked ? 'Source signal is audit backed.' : 'Audit evidence pending.',
      required: true,
    },
    {
      id: `${signal.id}-comms`,
      label: 'Communications reviewed',
      status: signal.status === 'Critical' ? 'Missing' : 'Review',
      evidence: 'Draft generated for owner review.',
      required: signal.status === 'Critical' || signal.status === 'Watch',
    },
  ]
}

function severityFromSignal(signal: LaunchPostLaunchSignal): LaunchPostLaunchIncidentSeverity {
  if (signal.status === 'Critical' && (signal.lane === 'Platform Health' || signal.lane === 'Support' || signal.lane === 'Backend Watch')) return 'SEV1'
  if (signal.status === 'Critical') return 'SEV2'
  if (signal.status === 'Watch' && (signal.lane === 'Platform Health' || signal.lane === 'Support' || signal.lane === 'Billing')) return 'SEV2'
  if (signal.status === 'Watch') return 'SEV3'
  return 'SEV4'
}

function commanderForSignal(signal: LaunchPostLaunchSignal) {
  if (signal.lane === 'Platform Health' || signal.lane === 'Backend Watch' || signal.lane === 'Action Queue') return 'Engineering'
  if (signal.lane === 'Support') return 'Support Lead'
  if (signal.lane === 'Billing') return 'Finance'
  if (signal.lane === 'Usage' || signal.lane === 'Owner Follow-Up') return 'Client Success'
  return signal.owner
}

function statusFromSignal(signal: LaunchPostLaunchSignal, linkedActionCount: number): LaunchPostLaunchIncidentStatus {
  if (signal.status === 'Critical') return linkedActionCount ? 'Mitigation Ready' : 'Investigating'
  if (signal.status === 'Watch') return linkedActionCount ? 'Mitigation Ready' : 'Monitoring'
  if (signal.status === 'Monitoring') return 'Monitoring'
  return 'Closure Ready'
}

function getCustomerImpact(signal: LaunchPostLaunchSignal, supportImpact: { clients: number; venues: number; users: number }, healthImpact: { clients: number; venues: number }) {
  if (supportImpact.clients || supportImpact.venues) {
    return `${supportImpact.clients} client${supportImpact.clients === 1 ? '' : 's'}, ${supportImpact.venues} venue${supportImpact.venues === 1 ? '' : 's'}, and ${supportImpact.users} affected user${supportImpact.users === 1 ? '' : 's'} are tied to this launch signal.`
  }
  if (healthImpact.clients || healthImpact.venues) {
    return `${healthImpact.clients} client impact count and ${healthImpact.venues} affected venue signals are active.`
  }
  return signal.evidence
}

function getMitigation(signal: LaunchPostLaunchSignal, linkedActions: AdminActionRequest[]) {
  const runningAction = linkedActions.find(request => request.status === 'Approved' || request.status === 'Running')
  if (runningAction) return `${runningAction.status} action request: ${runningAction.title}`
  const queuedAction = linkedActions[0]
  if (queuedAction) return `${queuedAction.status} action request: ${queuedAction.title}`
  return signal.nextStep
}

function buildCommsDraft(
  signal: LaunchPostLaunchSignal,
  severity: LaunchPostLaunchIncidentSeverity,
  supportImpact: { clients: number; venues: number; users: number },
  healthImpact: { clients: number; venues: number },
) {
  if (severity === 'SEV4') return ''
  const impact = supportImpact.clients || supportImpact.venues
    ? `${supportImpact.clients} client${supportImpact.clients === 1 ? '' : 's'} / ${supportImpact.venues} venue${supportImpact.venues === 1 ? '' : 's'}`
    : healthImpact.clients || healthImpact.venues
      ? `${healthImpact.clients} client signal${healthImpact.clients === 1 ? '' : 's'} / ${healthImpact.venues} venue signal${healthImpact.venues === 1 ? '' : 's'}`
      : 'the affected launch scope'
  return `We are investigating a ${severity} post-launch signal for ${signal.reference}. Current impact: ${impact}. Current response: ${signal.nextStep}`
}

function buildInternalUpdate(signal: LaunchPostLaunchSignal, severity: LaunchPostLaunchIncidentSeverity, commander: string) {
  return `${commander} owns ${severity} response for ${signal.title}. Evidence: ${signal.evidence} Next step: ${signal.nextStep}`
}

function buildCommanderGroups(incidents: LaunchPostLaunchIncidentPacket[]): LaunchPostLaunchIncidentCommanderGroup[] {
  const commanders = Array.from(new Set(incidents.map(incident => incident.commander)))
  return commanders.map(commander => {
    const rows = incidents.filter(incident => incident.commander === commander)
    const nextIncident = rows.find(incident => incident.status !== 'Closure Ready') ?? rows[0]
    return {
      commander,
      total: rows.length,
      sev1: rows.filter(incident => incident.severity === 'SEV1').length,
      sev2: rows.filter(incident => incident.severity === 'SEV2').length,
      sev3: rows.filter(incident => incident.severity === 'SEV3').length,
      open: rows.filter(incident => incident.status !== 'Closure Ready').length,
      nextStep: nextIncident?.nextStep ?? 'No commander action required.',
    }
  }).sort((a, b) => b.sev1 - a.sev1 || b.sev2 - a.sev2 || b.open - a.open || a.commander.localeCompare(b.commander))
}

function buildSeverityGroups(incidents: LaunchPostLaunchIncidentPacket[]): LaunchPostLaunchIncidentSeverityGroup[] {
  return (['SEV1', 'SEV2', 'SEV3', 'SEV4'] as LaunchPostLaunchIncidentSeverity[]).map(severity => {
    const rows = incidents.filter(incident => incident.severity === severity)
    const nextIncident = rows.find(incident => incident.status !== 'Closure Ready') ?? rows[0]
    return {
      severity,
      total: rows.length,
      investigating: rows.filter(incident => incident.status === 'Investigating').length,
      mitigationReady: rows.filter(incident => incident.status === 'Mitigation Ready').length,
      monitoring: rows.filter(incident => incident.status === 'Monitoring').length,
      closureReady: rows.filter(incident => incident.status === 'Closure Ready').length,
      nextStep: nextIncident?.nextStep ?? 'No incident action for this severity.',
    }
  }).filter(group => group.total > 0)
}

function getHeadline(status: LaunchPostLaunchIncidentCommander['status'], sev1Count: number, sev2Count: number, openIncidentCount: number) {
  if (status === 'Critical') return `${sev1Count} SEV1 launch incident${sev1Count === 1 ? '' : 's'} need commander review`
  if (status === 'Active') return `${openIncidentCount} post-launch incident${openIncidentCount === 1 ? '' : 's'} remain open`
  if (status === 'Monitoring') return `${sev2Count} SEV2 incident${sev2Count === 1 ? '' : 's'} under monitoring`
  return 'No post-launch incidents are open'
}

function getSummary(status: LaunchPostLaunchIncidentCommander['status'], total: number, sev1Count: number, sev2Count: number, openIncidentCount: number) {
  if (status === 'Critical') return `${sev1Count} SEV1 incidents are active across ${total} launch incident packets.`
  if (status === 'Active') return `${openIncidentCount} of ${total} incident packets need response, including ${sev2Count} SEV2 incidents.`
  if (status === 'Monitoring') return `${total} launch incident packets are being monitored.`
  return 'Post-launch watchtower has no incident packets requiring response.'
}

function severityRank(severity: LaunchPostLaunchIncidentSeverity) {
  if (severity === 'SEV1') return 1
  if (severity === 'SEV2') return 2
  if (severity === 'SEV3') return 3
  return 4
}

function statusRank(status: LaunchPostLaunchIncidentStatus) {
  if (status === 'Investigating') return 4
  if (status === 'Mitigation Ready') return 3
  if (status === 'Monitoring') return 2
  return 1
}

function emitLaunchPostLaunchIncidentRecordChange() {
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
