import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { AgentEventRecord } from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type OwnershipPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type OwnershipSlaStatus = 'Breached' | 'Due Soon' | 'On Track' | 'Monitoring'
export type OwnershipSourceType = 'Support' | 'Billing' | 'Usage' | 'Health' | 'Action Request' | 'Agent'

export interface OwnershipWorkItem {
  id: string
  sourceType: OwnershipSourceType
  title: string
  client: string
  scope: string
  owner: string
  priority: OwnershipPriority
  priorityScore: number
  sourceStatus: string
  slaStatus: OwnershipSlaStatus
  escalationTarget: string
  createdAt: string
  dueAt: string
  ageHours: number
  nextAction: string
  evidence: string[]
  sourceRecordId: string
  actionRequestId?: string
}

export interface OwnerSlaSummary {
  owner: string
  total: number
  breached: number
  dueSoon: number
  critical: number
  nextDueAt?: string
}

const openActionRequestStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildOwnershipSlaQueue(
  data: PlatformAdminReadModel,
  actionRequests: AdminActionRequest[],
  agentEvents: AgentEventRecord[],
  now = new Date(),
) {
  const workItems = [
    ...data.supportIssues
      .filter(issue => issue.status !== 'Resolved')
      .map(issue => createWorkItem({
        id: `support-${issue.id}`,
        sourceType: 'Support',
        title: `${issue.issueType} at ${issue.venueName}`,
        client: issue.organizationName,
        scope: `${issue.propertyName} / ${issue.venueName}`,
        owner: issue.owner,
        priorityScore: severityScore(issue.severity),
        sourceStatus: issue.status,
        escalationTarget: issue.severity === 'critical' || issue.status === 'Escalated' ? 'Support Lead + Engineering' : 'Support Lead',
        createdAt: issue.detectedAt,
        dueHours: issue.severity === 'critical' ? 4 : issue.severity === 'warning' ? 12 : 24,
        nextAction: issue.recommendedAction,
        evidence: [issue.probableCause, issue.relatedSignal, `${issue.affectedUsers} affected user${issue.affectedUsers === 1 ? '' : 's'}`],
        sourceRecordId: issue.id,
      }, now)),
    ...data.billingRisks.map(risk => createWorkItem({
      id: `billing-${risk.id}`,
      sourceType: 'Billing',
      title: risk.billingStatus,
      client: risk.organizationName,
      scope: risk.organizationName,
      owner: risk.owner,
      priorityScore: risk.billingStatus === 'Failed Payment' ? 94 : risk.billingStatus === 'Past Due' ? 84 : 66,
      sourceStatus: risk.billingStatus,
      escalationTarget: risk.billingStatus === 'Failed Payment' ? 'Finance + Owner' : 'Finance',
      createdAt: risk.lastPaymentAttempt,
      dueHours: risk.billingStatus === 'Failed Payment' ? 8 : risk.billingStatus === 'Past Due' ? 16 : 48,
      nextAction: risk.nextAction,
      evidence: [`${formatCurrency(risk.amountAtRisk)} at risk`, `${formatCurrency(risk.mrr)} monthly recurring revenue`, `Last payment attempt ${formatShortDate(risk.lastPaymentAttempt)}`],
      sourceRecordId: risk.id,
    }, now)),
    ...data.moduleUsageGaps.map(gap => createWorkItem({
      id: `usage-gap-${gap.id}`,
      sourceType: 'Usage',
      title: `${gap.moduleName} adoption gap`,
      client: gap.organizationName,
      scope: gap.moduleName,
      owner: gap.owner,
      priorityScore: gap.usageLast7Days === 0 ? 82 : 66,
      sourceStatus: `${gap.usageLast7Days} uses / 7d`,
      escalationTarget: gap.owner === 'Marketing' ? 'Client Success' : 'Support Lead',
      createdAt: gap.enabledAt,
      dueHours: gap.usageLast7Days === 0 ? 48 : 72,
      nextAction: gap.recommendedAction,
      evidence: [`${gap.moduleName} enabled since ${formatShortDate(gap.enabledAt)}`, `${gap.usageLast7Days} recent usage events`, `${gap.owner} owns follow-up`],
      sourceRecordId: gap.id,
    }, now)),
    ...data.platformHealthSignals
      .filter(signal => signal.status !== 'Passing')
      .map(signal => createWorkItem({
        id: `health-${signal.id}`,
        sourceType: 'Health',
        title: signal.label,
        client: 'Platform',
        scope: 'Platform Health',
        owner: signal.severity === 'critical' || signal.status === 'Failing' ? 'Engineering' : 'Support',
        priorityScore: severityScore(signal.severity),
        sourceStatus: signal.status,
        escalationTarget: signal.severity === 'critical' || signal.status === 'Failing' ? 'Engineering Lead + Owner' : 'Engineering',
        createdAt: signal.checkedAt,
        dueHours: signal.severity === 'critical' ? 2 : signal.severity === 'warning' ? 6 : 24,
        nextAction: signal.recommendedAction,
        evidence: [signal.message, signal.probableCause, `${signal.affectedClients} affected clients / ${signal.affectedVenues} affected venues`],
        sourceRecordId: signal.id,
      }, now)),
    ...actionRequests
      .filter(request => openActionRequestStatuses.has(request.status))
      .map(request => {
        const isBlocked = request.status === 'Blocked' || request.status === 'Failed'
        return createWorkItem({
          id: `action-request-${request.id}`,
          sourceType: 'Action Request',
          title: request.title,
          client: request.scope.organizationName ?? request.scope.clientName ?? request.scope.label,
          scope: request.scope.label,
          owner: request.requestedBy.role,
          priorityScore: isBlocked ? 88 : request.status === 'Approved' || request.status === 'Running' ? 78 : 62,
          sourceStatus: request.status,
          escalationTarget: isBlocked ? 'Owner + Engineering' : 'Request Approver',
          createdAt: request.createdAt,
          dueHours: isBlocked ? 8 : request.status === 'Approved' || request.status === 'Running' ? 12 : 24,
          nextAction: request.reason,
          evidence: [`Permission required: ${request.permissionRequired}`, `Handler: ${request.serverHandler.key}`, request.rollbackNotes],
          sourceRecordId: request.id,
          actionRequestId: request.id,
        }, now)
      }),
    ...agentEvents
      .filter(event => event.status !== 'Reviewed')
      .map(event => createWorkItem({
        id: `agent-${event.id}`,
        sourceType: 'Agent',
        title: `${event.agentName}: ${event.eventType}`,
        client: event.organizationName ?? 'Platform',
        scope: [event.organizationName, event.propertyName, event.venueName].filter(Boolean).join(' / ') || 'Platform',
        owner: 'Agent Review',
        priorityScore: event.status === 'Needs Review' ? 76 : event.status === 'Queued' ? 64 : 48,
        sourceStatus: event.status,
        escalationTarget: event.auditRequired ? 'Human Reviewer' : 'Agent Owner',
        createdAt: event.createdAt,
        dueHours: event.status === 'Needs Review' ? 24 : event.status === 'Queued' ? 24 : 72,
        nextAction: event.outputSummary,
        evidence: [event.inputSummary, event.auditRequired ? 'Audit required before action' : 'Draft-only advisory signal', `Generated by ${event.agentName}`],
        sourceRecordId: event.id,
      }, now)),
  ].sort((a, b) => {
    const slaDiff = slaRank(b.slaStatus) - slaRank(a.slaStatus)
    if (slaDiff !== 0) return slaDiff
    const priorityDiff = b.priorityScore - a.priorityScore
    if (priorityDiff !== 0) return priorityDiff
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  })

  return {
    workItems,
    ownerSummaries: buildOwnerSummaries(workItems),
  }
}

export function getOwnershipPriorityTone(priority: OwnershipPriority): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'neutral'
}

export function getOwnershipSlaTone(status: OwnershipSlaStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Breached') return 'danger'
  if (status === 'Due Soon') return 'warn'
  if (status === 'On Track') return 'ok'
  return 'neutral'
}

function createWorkItem(
  input: Omit<OwnershipWorkItem, 'priority' | 'slaStatus' | 'dueAt' | 'ageHours'> & { dueHours: number },
  now: Date,
): OwnershipWorkItem {
  const createdAt = parseDate(input.createdAt, now)
  const dueAt = new Date(createdAt.getTime() + input.dueHours * 60 * 60 * 1000)
  return {
    ...input,
    priority: priorityFromScore(input.priorityScore),
    slaStatus: getSlaStatus(dueAt, now),
    dueAt: dueAt.toISOString(),
    ageHours: Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000))),
  }
}

function buildOwnerSummaries(workItems: OwnershipWorkItem[]): OwnerSlaSummary[] {
  const summaryByOwner = new Map<string, OwnerSlaSummary>()
  workItems.forEach(item => {
    const current = summaryByOwner.get(item.owner) ?? {
      owner: item.owner,
      total: 0,
      breached: 0,
      dueSoon: 0,
      critical: 0,
      nextDueAt: item.dueAt,
    }
    current.total += 1
    current.breached += item.slaStatus === 'Breached' ? 1 : 0
    current.dueSoon += item.slaStatus === 'Due Soon' ? 1 : 0
    current.critical += item.priority === 'Critical' ? 1 : 0
    if (!current.nextDueAt || new Date(item.dueAt).getTime() < new Date(current.nextDueAt).getTime()) {
      current.nextDueAt = item.dueAt
    }
    summaryByOwner.set(item.owner, current)
  })

  return [...summaryByOwner.values()].sort((a, b) => {
    const breachDiff = b.breached - a.breached
    if (breachDiff !== 0) return breachDiff
    const dueSoonDiff = b.dueSoon - a.dueSoon
    if (dueSoonDiff !== 0) return dueSoonDiff
    return b.total - a.total
  })
}

function getSlaStatus(dueAt: Date, now: Date): OwnershipSlaStatus {
  const hoursUntilDue = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000)
  if (hoursUntilDue < 0) return 'Breached'
  if (hoursUntilDue <= 6) return 'Due Soon'
  if (hoursUntilDue <= 72) return 'On Track'
  return 'Monitoring'
}

function severityScore(severity: string) {
  if (severity === 'critical') return 96
  if (severity === 'warning') return 82
  if (severity === 'notice') return 58
  return 34
}

function priorityFromScore(score: number): OwnershipPriority {
  if (score >= 90) return 'Critical'
  if (score >= 75) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function slaRank(status: OwnershipSlaStatus) {
  if (status === 'Breached') return 4
  if (status === 'Due Soon') return 3
  if (status === 'On Track') return 2
  return 1
}

function parseDate(value: string, fallback: Date) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parseDate(value, new Date()))
}
