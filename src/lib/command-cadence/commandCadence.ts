import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type { AttentionCategory, AttentionPriority, AttentionQueueItem } from '../attention/attentionQueue'

export type CommandCadenceLane =
  | 'Owner Review'
  | 'Revenue Risk'
  | 'Client Success'
  | 'Support Ops'
  | 'Engineering'
  | 'Agent Review'

export type CommandCadenceSlaStatus = 'On Track' | 'Due Today' | 'Overdue' | 'Blocked'
export type CommandCadenceDecision = 'Review' | 'Assign' | 'Approve' | 'Escalate' | 'Monitor'

export interface CommandCadenceItem {
  id: string
  lane: CommandCadenceLane
  title: string
  scope: string
  owner: string
  priority: AttentionPriority
  priorityScore: number
  source: string
  status: string
  slaStatus: CommandCadenceSlaStatus
  decision: CommandCadenceDecision
  cadenceWindow: string
  createdAt: string
  dueAt: string
  recommendedAction: string
  evidence: string[]
  relatedAttentionId: string
  actionRequestId?: string
  blockerCount: number
  followUpActionType: AdminActionRequestType
  followUpPermission: PermissionKey
}

export interface CommandCadenceLaneSummary {
  lane: CommandCadenceLane
  total: number
  blocked: number
  overdue: number
  nextDecision: CommandCadenceDecision
  topOwner: string
}

export interface CommandCadenceSummary {
  total: number
  blocked: number
  overdue: number
  dueToday: number
  readyForApproval: number
  ownerReview: number
}

const cadenceWindowByPriority: Record<AttentionPriority, { label: string; hours: number }> = {
  Critical: { label: 'Next 2 hours', hours: 2 },
  High: { label: 'Today', hours: 8 },
  Medium: { label: 'Next business day', hours: 24 },
  Low: { label: 'Monitor this week', hours: 72 },
}

const laneOrder: CommandCadenceLane[] = [
  'Owner Review',
  'Revenue Risk',
  'Support Ops',
  'Client Success',
  'Engineering',
  'Agent Review',
]

export function buildCommandCadence(items: AttentionQueueItem[]): CommandCadenceItem[] {
  return items
    .map(item => {
      const lane = getCadenceLane(item)
      const window = cadenceWindowByPriority[item.priority]
      return {
        id: `cadence-${item.id}`,
        lane,
        title: item.title,
        scope: item.scope,
        owner: getCadenceOwner(item, lane),
        priority: item.priority,
        priorityScore: item.priorityScore,
        source: item.source,
        status: item.status,
        slaStatus: getCadenceSlaStatus(item),
        decision: getCadenceDecision(item, lane),
        cadenceWindow: window.label,
        createdAt: item.createdAt,
        dueAt: addHours(item.createdAt, window.hours),
        recommendedAction: item.recommendedAction,
        evidence: item.evidence,
        relatedAttentionId: item.id,
        actionRequestId: item.actionRequestId,
        blockerCount: getBlockerCount(item),
        followUpActionType: getFollowUpActionType(item.category),
        followUpPermission: getFollowUpPermission(item.category),
      }
    })
    .sort((a, b) => {
      const laneDiff = laneOrder.indexOf(a.lane) - laneOrder.indexOf(b.lane)
      if (laneDiff !== 0 && (a.slaStatus !== 'Blocked' && b.slaStatus !== 'Blocked')) return laneDiff
      const scoreDiff = b.priorityScore - a.priorityScore
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 80)
}

export function summarizeCommandCadence(items: CommandCadenceItem[]): CommandCadenceSummary {
  return {
    total: items.length,
    blocked: items.filter(item => item.slaStatus === 'Blocked').length,
    overdue: items.filter(item => item.slaStatus === 'Overdue').length,
    dueToday: items.filter(item => item.slaStatus === 'Due Today').length,
    readyForApproval: items.filter(item => item.decision === 'Approve').length,
    ownerReview: items.filter(item => item.lane === 'Owner Review').length,
  }
}

export function summarizeCommandCadenceLanes(items: CommandCadenceItem[]): CommandCadenceLaneSummary[] {
  return laneOrder.map(lane => {
    const laneItems = items.filter(item => item.lane === lane)
    const ownerCounts = new Map<string, number>()
    laneItems.forEach(item => ownerCounts.set(item.owner, (ownerCounts.get(item.owner) ?? 0) + 1))
    const [topOwner] = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['Unassigned']
    return {
      lane,
      total: laneItems.length,
      blocked: laneItems.filter(item => item.slaStatus === 'Blocked').length,
      overdue: laneItems.filter(item => item.slaStatus === 'Overdue').length,
      nextDecision: laneItems[0]?.decision ?? 'Monitor',
      topOwner,
    }
  })
}

export function getCadenceLaneTone(lane: CommandCadenceLane): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (lane === 'Owner Review' || lane === 'Revenue Risk') return 'warn'
  if (lane === 'Support Ops' || lane === 'Engineering') return 'danger'
  if (lane === 'Client Success' || lane === 'Agent Review') return 'info'
  return 'neutral'
}

export function getCadenceSlaTone(status: CommandCadenceSlaStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Blocked' || status === 'Overdue') return 'danger'
  if (status === 'Due Today') return 'warn'
  return 'ok'
}

export function getCadenceDecisionTone(decision: CommandCadenceDecision): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (decision === 'Escalate') return 'danger'
  if (decision === 'Approve' || decision === 'Assign') return 'warn'
  if (decision === 'Review') return 'info'
  return 'neutral'
}

function getCadenceLane(item: AttentionQueueItem): CommandCadenceLane {
  if (item.priority === 'Critical') return 'Owner Review'
  if (item.category === 'Billing') return 'Revenue Risk'
  if (item.category === 'Usage') return 'Client Success'
  if (item.category === 'Support') return 'Support Ops'
  if (item.category === 'Health') return 'Engineering'
  if (item.category === 'Agent') return 'Agent Review'
  return item.priority === 'High' ? 'Owner Review' : 'Support Ops'
}

function getCadenceOwner(item: AttentionQueueItem, lane: CommandCadenceLane) {
  if (lane === 'Owner Review') return 'Owner / Admin'
  if (lane === 'Engineering') return 'Engineering'
  if (lane === 'Agent Review') return 'Agent Review'
  return item.owner
}

function getCadenceSlaStatus(item: AttentionQueueItem): CommandCadenceSlaStatus {
  if (item.status === 'Blocked') return 'Blocked'
  if (item.priority === 'Critical') return 'Overdue'
  if (item.priority === 'High' || item.priority === 'Medium') return 'Due Today'
  return 'On Track'
}

function getCadenceDecision(item: AttentionQueueItem, lane: CommandCadenceLane): CommandCadenceDecision {
  if (item.status === 'Blocked') return 'Escalate'
  if (item.actionRequestId || item.category === 'Action Request') return 'Approve'
  if (lane === 'Owner Review' || item.category === 'Agent') return 'Review'
  if (item.priority === 'High') return 'Assign'
  return 'Monitor'
}

function getBlockerCount(item: AttentionQueueItem) {
  return item.status === 'Blocked' ? 1 : 0
}

function getFollowUpActionType(category: AttentionCategory): AdminActionRequestType {
  if (category === 'Billing') return 'billing_review_action'
  if (category === 'Support') return 'support_troubleshooting_action'
  if (category === 'Health') return 'remediation_server_action'
  if (category === 'Action Request') return 'agent_recommended_action'
  return 'agent_recommended_action'
}

function getFollowUpPermission(category: AttentionCategory): PermissionKey {
  if (category === 'Billing') return 'billing.manage'
  if (category === 'Support') return 'support.manage'
  if (category === 'Health') return 'troubleshooting.run'
  if (category === 'Usage') return 'clients.manage'
  if (category === 'Agent') return 'agents.manage'
  return 'admin_actions.manage'
}

function addHours(value: string, hours: number) {
  const date = new Date(value)
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}
