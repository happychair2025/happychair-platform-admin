import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { AgentEventRecord } from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type AttentionCategory = 'Support' | 'Billing' | 'Usage' | 'Health' | 'Agent' | 'Action Request'
export type AttentionPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type AttentionStatus = 'New' | 'Needs Review' | 'In Progress' | 'Action Queued' | 'Blocked' | 'Monitoring'

export interface AttentionQueueItem {
  id: string
  category: AttentionCategory
  title: string
  scope: string
  owner: string
  priority: AttentionPriority
  priorityScore: number
  status: AttentionStatus
  source: string
  createdAt: string
  recommendedAction: string
  evidence: string[]
  relatedRecordId: string
  actionRequestId?: string
}

const openActionRequestStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildAttentionQueue(
  data: PlatformAdminReadModel,
  actionRequests: AdminActionRequest[],
  agentEvents: AgentEventRecord[],
): AttentionQueueItem[] {
  const items: AttentionQueueItem[] = [
    ...data.supportIssues
      .filter(issue => issue.status !== 'Resolved')
      .map(issue => {
        const score = severityScore(issue.severity)
        return {
          id: `support-${issue.id}`,
          category: 'Support' as const,
          title: issue.issueType,
          scope: `${issue.organizationName} / ${issue.propertyName} / ${issue.venueName}`,
          owner: issue.owner,
          priority: priorityFromScore(score),
          priorityScore: score,
          status: issue.status === 'Escalated' ? 'Blocked' as const : issue.status === 'Investigating' ? 'In Progress' as const : 'New' as const,
          source: 'Support Signals',
          createdAt: issue.detectedAt,
          recommendedAction: issue.recommendedAction,
          evidence: [
            issue.probableCause,
            issue.relatedSignal,
            `${issue.affectedUsers} affected user${issue.affectedUsers === 1 ? '' : 's'}`,
          ],
          relatedRecordId: issue.id,
        }
      }),
    ...data.billingRisks.map(risk => {
      const score = billingScore(risk.billingStatus)
      return {
        id: `billing-${risk.id}`,
        category: 'Billing' as const,
        title: risk.billingStatus,
        scope: risk.organizationName,
        owner: risk.owner,
        priority: priorityFromScore(score),
        priorityScore: score,
        status: risk.billingStatus === 'Failed Payment' ? 'Blocked' as const : 'Needs Review' as const,
        source: 'Finance Signals',
        createdAt: risk.lastPaymentAttempt,
        recommendedAction: risk.nextAction,
        evidence: [
          `${formatCurrency(risk.amountAtRisk)} at risk`,
          `${formatCurrency(risk.mrr)} monthly recurring revenue`,
          `Last payment attempt ${formatShortDate(risk.lastPaymentAttempt)}`,
        ],
        relatedRecordId: risk.id,
      }
    }),
    ...data.moduleUsageGaps.map(gap => {
      const score = gap.usageLast7Days === 0 ? 82 : 68
      return {
        id: `usage-gap-${gap.id}`,
        category: 'Usage' as const,
        title: `${gap.moduleName} adoption gap`,
        scope: gap.organizationName,
        owner: gap.owner,
        priority: priorityFromScore(score),
        priorityScore: score,
        status: 'Needs Review' as const,
        source: 'Usage Analytics',
        createdAt: gap.enabledAt,
        recommendedAction: gap.recommendedAction,
        evidence: [
          `${gap.usageLast7Days} usage events in the last 7 days`,
          `${gap.moduleName} has been enabled since ${formatShortDate(gap.enabledAt)}`,
          `${gap.owner} owns the next follow-up`,
        ],
        relatedRecordId: gap.id,
      }
    }),
    ...data.platformHealthSignals
      .filter(signal => signal.status !== 'Passing')
      .map(signal => {
        const score = severityScore(signal.severity)
        return {
          id: `health-${signal.id}`,
          category: 'Health' as const,
          title: signal.label,
          scope: 'Platform',
          owner: signal.severity === 'critical' || signal.status === 'Failing' ? 'Engineering' : 'Support',
          priority: priorityFromScore(score),
          priorityScore: score,
          status: signal.status === 'Failing' ? 'Blocked' as const : 'Monitoring' as const,
          source: 'System Health',
          createdAt: signal.checkedAt,
          recommendedAction: signal.recommendedAction,
          evidence: [
            signal.message,
            signal.probableCause,
            `${signal.affectedClients} affected clients / ${signal.affectedVenues} affected venues`,
          ],
          relatedRecordId: signal.id,
        }
      }),
    ...agentEvents
      .filter(event => event.status !== 'Reviewed')
      .map(event => {
        const score = event.status === 'Needs Review' ? 76 : event.status === 'Queued' ? 64 : 48
        return {
          id: `agent-${event.id}`,
          category: 'Agent' as const,
          title: `${event.agentName}: ${event.eventType}`,
          scope: [event.organizationName, event.propertyName, event.venueName].filter(Boolean).join(' / ') || 'Platform',
          owner: 'Agent Review',
          priority: priorityFromScore(score),
          priorityScore: score,
          status: event.status === 'Queued' ? 'Action Queued' as const : event.status === 'Needs Review' ? 'Needs Review' as const : 'Monitoring' as const,
          source: 'Agent Foundation',
          createdAt: event.createdAt,
          recommendedAction: event.outputSummary,
          evidence: [
            event.inputSummary,
            event.auditRequired ? 'Audit required before action' : 'Draft-only advisory signal',
            `Generated by ${event.agentName}`,
          ],
          relatedRecordId: event.id,
        }
      }),
    ...actionRequests
      .filter(request => openActionRequestStatuses.has(request.status))
      .map(request => {
        const score = actionRequestScore(request.status)
        return {
          id: `action-request-${request.id}`,
          category: 'Action Request' as const,
          title: request.title,
          scope: request.scope.label,
          owner: request.requestedBy.role,
          priority: priorityFromScore(score),
          priorityScore: score,
          status: request.status === 'Blocked' || request.status === 'Failed'
            ? 'Blocked' as const
            : request.status === 'Approved' || request.status === 'Running'
              ? 'Action Queued' as const
              : 'Needs Review' as const,
          source: 'Admin Action Requests',
          createdAt: request.createdAt,
          recommendedAction: request.reason,
          evidence: [
            `Permission required: ${request.permissionRequired}`,
            `Server handler: ${request.serverHandler.key}`,
            request.rollbackNotes,
          ],
          relatedRecordId: request.id,
          actionRequestId: request.id,
        }
      }),
  ]

  return items
    .sort((a, b) => {
      const priorityDiff = b.priorityScore - a.priorityScore
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 80)
}

export function getAttentionPriorityTone(priority: AttentionPriority): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'neutral'
}

export function getAttentionStatusTone(status: AttentionStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Action Queued' || status === 'In Progress') return 'info'
  if (status === 'Needs Review' || status === 'New') return 'warn'
  return 'neutral'
}

function severityScore(severity: string) {
  if (severity === 'critical') return 96
  if (severity === 'warning') return 82
  if (severity === 'notice') return 58
  return 34
}

function billingScore(status: string) {
  if (status === 'Failed Payment') return 94
  if (status === 'Past Due') return 84
  if (status === 'Credit Review') return 70
  return 62
}

function actionRequestScore(status: AdminActionRequest['status']) {
  if (status === 'Blocked' || status === 'Failed') return 88
  if (status === 'Approved' || status === 'Running') return 78
  if (status === 'Queued') return 66
  return 46
}

function priorityFromScore(score: number): AttentionPriority {
  if (score >= 90) return 'Critical'
  if (score >= 75) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}
