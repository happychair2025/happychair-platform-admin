import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformHealthSignal, SupportIssue } from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type IncidentStatus = 'Investigating' | 'Mitigation Ready' | 'Monitoring' | 'Resolved'
export type IncidentCommsStatus = 'Draft Needed' | 'Internal Only' | 'Ready To Send' | 'Sent'
export type IncidentPostmortemStatus = 'Required' | 'Draft Needed' | 'Not Required'

export interface IncidentTimelineEvent {
  id: string
  label: string
  detail: string
  createdAt: string
  source: 'Health' | 'Support' | 'Action Request' | 'Comms' | 'Postmortem'
}

export interface IncidentCommandRecord {
  id: string
  title: string
  severity: IncidentSeverity
  status: IncidentStatus
  commander: string
  scope: 'Platform' | 'Client' | 'Venue'
  affectedClients: number
  affectedVenues: number
  startedAt: string
  updatedAt: string
  customerImpact: string
  currentMitigation: string
  commsStatus: IncidentCommsStatus
  postmortemStatus: IncidentPostmortemStatus
  linkedHealthSignals: PlatformHealthSignal[]
  linkedSupportIssues: SupportIssue[]
  linkedActionRequests: AdminActionRequest[]
  timeline: IncidentTimelineEvent[]
}

export function buildIncidentCommandCenter(
  data: PlatformAdminReadModel,
  actionRequests: AdminActionRequest[],
): IncidentCommandRecord[] {
  const healthIncidents = data.platformHealthSignals
    .filter(signal => signal.status !== 'Passing' && (signal.affectedClients > 0 || signal.affectedVenues > 0))
    .map(signal => {
      const supportIssues = data.supportIssues.filter(issue => issueMatchesHealthSignal(issue, signal))
      const scopedActionRequests = actionRequests.filter(request => (
        supportIssues.some(issue => requestMatchesIssue(request, issue))
        || request.scope.label.toLowerCase().includes(signal.label.toLowerCase())
        || request.title.toLowerCase().includes(signal.label.toLowerCase())
      ))
      return createIncidentFromHealthSignal(signal, supportIssues, scopedActionRequests)
    })

  const coveredIssueIds = new Set(healthIncidents.flatMap(incident => incident.linkedSupportIssues.map(issue => issue.id)))
  const supportIncidents = data.supportIssues
    .filter(issue => issue.status !== 'Resolved')
    .filter(issue => issue.severity === 'critical' || issue.status === 'Escalated')
    .filter(issue => !coveredIssueIds.has(issue.id))
    .map(issue => {
      const linkedSignals = data.platformHealthSignals.filter(signal => issueMatchesHealthSignal(issue, signal))
      const scopedActionRequests = actionRequests.filter(request => requestMatchesIssue(request, issue))
      return createIncidentFromSupportIssue(issue, linkedSignals, scopedActionRequests)
    })

  return [...healthIncidents, ...supportIncidents].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity)
    if (severityDiff !== 0) return severityDiff
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function getIncidentSeverityTone(severity: IncidentSeverity): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (severity === 'SEV1') return 'danger'
  if (severity === 'SEV2') return 'warn'
  if (severity === 'SEV3') return 'info'
  return 'neutral'
}

export function getIncidentStatusTone(status: IncidentStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Investigating') return 'danger'
  if (status === 'Mitigation Ready') return 'warn'
  if (status === 'Monitoring') return 'info'
  return 'ok'
}

function createIncidentFromHealthSignal(
  signal: PlatformHealthSignal,
  supportIssues: SupportIssue[],
  actionRequests: AdminActionRequest[],
): IncidentCommandRecord {
  const severity = severityFromHealthSignal(signal)
  const startedAt = oldestDate([signal.checkedAt, ...supportIssues.map(issue => issue.detectedAt), ...actionRequests.map(request => request.createdAt)])
  const updatedAt = newestDate([signal.checkedAt, ...supportIssues.map(issue => issue.detectedAt), ...actionRequests.map(request => request.updatedAt ?? request.createdAt)])

  return {
    id: `incident-health-${signal.id}`,
    title: signal.label,
    severity,
    status: signal.status === 'Failing' ? 'Investigating' : actionRequests.some(request => request.status === 'Approved' || request.status === 'Running') ? 'Mitigation Ready' : 'Monitoring',
    commander: signal.status === 'Failing' || signal.severity === 'critical' ? 'Engineering' : 'Support Lead',
    scope: signal.affectedClients > 1 ? 'Platform' : signal.affectedVenues > 1 ? 'Client' : 'Venue',
    affectedClients: signal.affectedClients,
    affectedVenues: signal.affectedVenues,
    startedAt,
    updatedAt,
    customerImpact: signal.message,
    currentMitigation: signal.recommendedAction,
    commsStatus: severity === 'SEV1' || severity === 'SEV2' ? 'Draft Needed' : 'Internal Only',
    postmortemStatus: severity === 'SEV1' ? 'Required' : severity === 'SEV2' ? 'Draft Needed' : 'Not Required',
    linkedHealthSignals: [signal],
    linkedSupportIssues: supportIssues,
    linkedActionRequests: actionRequests,
    timeline: buildTimeline([signal], supportIssues, actionRequests),
  }
}

function createIncidentFromSupportIssue(
  issue: SupportIssue,
  healthSignals: PlatformHealthSignal[],
  actionRequests: AdminActionRequest[],
): IncidentCommandRecord {
  const severity = issue.severity === 'critical' ? 'SEV1' : issue.status === 'Escalated' ? 'SEV2' : 'SEV3'
  const startedAt = oldestDate([issue.detectedAt, ...healthSignals.map(signal => signal.checkedAt), ...actionRequests.map(request => request.createdAt)])
  const updatedAt = newestDate([issue.detectedAt, ...healthSignals.map(signal => signal.checkedAt), ...actionRequests.map(request => request.updatedAt ?? request.createdAt)])

  return {
    id: `incident-support-${issue.id}`,
    title: `${issue.issueType} / ${issue.venueName}`,
    severity,
    status: issue.status === 'Escalated' || issue.severity === 'critical' ? 'Investigating' : 'Monitoring',
    commander: issue.owner === 'Engineering' ? 'Engineering' : issue.owner === 'Client Success' ? 'Client Success' : 'Support Lead',
    scope: 'Venue',
    affectedClients: 1,
    affectedVenues: 1,
    startedAt,
    updatedAt,
    customerImpact: issue.relatedSignal,
    currentMitigation: issue.recommendedAction,
    commsStatus: severity === 'SEV1' || severity === 'SEV2' ? 'Draft Needed' : 'Internal Only',
    postmortemStatus: severity === 'SEV1' ? 'Required' : severity === 'SEV2' ? 'Draft Needed' : 'Not Required',
    linkedHealthSignals: healthSignals,
    linkedSupportIssues: [issue],
    linkedActionRequests: actionRequests,
    timeline: buildTimeline(healthSignals, [issue], actionRequests),
  }
}

function buildTimeline(
  healthSignals: PlatformHealthSignal[],
  supportIssues: SupportIssue[],
  actionRequests: AdminActionRequest[],
): IncidentTimelineEvent[] {
  return [
    ...healthSignals.map(signal => ({
      id: `health-${signal.id}`,
      label: `${signal.label} ${signal.status}`,
      detail: signal.message,
      createdAt: signal.checkedAt,
      source: 'Health' as const,
    })),
    ...supportIssues.map(issue => ({
      id: `support-${issue.id}`,
      label: `${issue.issueType} ${issue.status}`,
      detail: issue.recommendedAction,
      createdAt: issue.detectedAt,
      source: 'Support' as const,
    })),
    ...actionRequests.map(request => ({
      id: `action-${request.id}`,
      label: `${request.status} action request`,
      detail: request.title,
      createdAt: request.updatedAt ?? request.createdAt,
      source: 'Action Request' as const,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function issueMatchesHealthSignal(issue: SupportIssue, signal: PlatformHealthSignal) {
  if (signal.checkKey === 'notification_delivery') return issue.issueType === 'Notification Delivery' || issue.issueType === 'Device Offline'
  if (signal.checkKey === 'device_presence') return issue.issueType === 'Device Offline' || issue.relatedSignal.toLowerCase().includes('device')
  if (signal.checkKey === 'qr_scans') return issue.issueType === 'QR Scan Failure' || issue.relatedSignal.toLowerCase().includes('qr')
  if (signal.checkKey === 'service_queue') return issue.issueType === 'Stalled Queue' || issue.issueType === 'High Escalations' || issue.relatedSignal.toLowerCase().includes('queue')
  if (signal.checkKey === 'module_configuration') return issue.issueType === 'Module Configuration'
  if (signal.checkKey === 'api_errors' || signal.checkKey === 'database_sync' || signal.checkKey === 'websocket_sessions') return issue.status === 'Escalated'
  return false
}

function requestMatchesIssue(request: AdminActionRequest, issue: SupportIssue) {
  return request.scope.organizationName === issue.organizationName
    || request.scope.propertyName === issue.propertyName
    || request.scope.venueName === issue.venueName
    || request.scope.label === issue.venueName
    || request.title.toLowerCase().includes(issue.venueName.toLowerCase())
}

function severityFromHealthSignal(signal: PlatformHealthSignal): IncidentSeverity {
  if (signal.status === 'Failing' || signal.severity === 'critical') return 'SEV1'
  if (signal.severity === 'warning' || signal.affectedClients > 1 || signal.affectedVenues > 2) return 'SEV2'
  if (signal.severity === 'notice' || signal.status === 'Warning') return 'SEV3'
  return 'SEV4'
}

function severityRank(severity: IncidentSeverity) {
  if (severity === 'SEV1') return 1
  if (severity === 'SEV2') return 2
  if (severity === 'SEV3') return 3
  return 4
}

function oldestDate(values: string[]) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? new Date().toISOString()
}

function newestDate(values: string[]) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date().toISOString()
}
