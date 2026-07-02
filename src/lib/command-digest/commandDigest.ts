import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { AttentionCategory, AttentionPriority, AttentionQueueItem } from '../attention/attentionQueue'
import type { CommandCadenceDecision, CommandCadenceItem, CommandCadenceSlaStatus } from '../command-cadence/commandCadence'
import type { PermissionKey } from '../permissions/permissions'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { SlaEscalationItem } from '../watch-center/slaEscalations'
import type { WatchTargetPage } from '../watch-center/watchCenter'

export type CommandDigestLane =
  | 'Executive'
  | 'Revenue'
  | 'Support'
  | 'Client Success'
  | 'Platform Health'
  | 'Admin Actions'
  | 'AI & Automation'

export type CommandDigestSeverity = 'Critical' | 'High' | 'Moderate' | 'Stable'
export type CommandDigestDecision = 'Escalate' | 'Approve' | 'Assign' | 'Review' | 'Monitor'
export type CommandDigestPosture = 'Critical' | 'Needs Attention' | 'Steady'
export type CommandDigestSource = 'SLA' | 'Cadence' | 'Attention' | 'Revenue Rollup' | 'Support Rollup' | 'Health Rollup'
export type CommandDigestReviewStatus = 'Open' | 'Reviewed' | 'Follow-Up Queued'
export type CommandDigestTargetPage =
  | WatchTargetPage
  | 'watch-center'
  | 'sla-board'
  | 'command-cadence'
  | 'client-success'
  | 'agents'

export interface CommandDigestItem {
  id: string
  title: string
  brief: string
  lane: CommandDigestLane
  severity: CommandDigestSeverity
  decision: CommandDigestDecision
  owner: string
  scope: string
  source: CommandDigestSource
  sourceStatus: string
  score: number
  createdAt: string
  dueAt: string
  recommendedAction: string
  evidence: string[]
  targetPage: CommandDigestTargetPage
  permission: PermissionKey
  followUpActionType: AdminActionRequestType
  followUpPermission: PermissionKey
  relatedRecordId: string
  reviewStatus: CommandDigestReviewStatus
  localNote?: string
  reviewedAt?: string
  dedupeKey: string
}

export interface CommandDigestLocalState {
  itemId: string
  reviewStatus: CommandDigestReviewStatus
  note?: string
  updatedAt: string
}

export interface BuildCommandDigestInput {
  data: PlatformAdminReadModel
  attentionItems: AttentionQueueItem[]
  cadenceItems: CommandCadenceItem[]
  slaItems: SlaEscalationItem[]
  localStates?: CommandDigestLocalState[]
  now?: Date
}

export interface CommandDigestSummary {
  total: number
  critical: number
  high: number
  decisionsNeeded: number
  handoffsReady: number
  reviewed: number
  revenueAtRisk: number
  supportEscalations: number
  clientsImpacted: number
  readinessScore: number
  posture: CommandDigestPosture
}

export interface CommandDigestLaneSummary {
  lane: CommandDigestLane
  total: number
  critical: number
  nextDecision: CommandDigestDecision
  topOwner: string
}

export interface CommandDigestHeadline {
  id: string
  label: string
  value: string
  detail: string
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
}

const localStorageKey = 'hc_platform_command_digest_state_v1'

export const commandDigestLanes: CommandDigestLane[] = [
  'Executive',
  'Revenue',
  'Support',
  'Client Success',
  'Platform Health',
  'Admin Actions',
  'AI & Automation',
]

export const commandDigestBoundaryRule =
  'Command Digest is a read-only operating brief over platform signals. Reviews are audit-only, and follow-ups become governed Admin Action Requests before any production state can change.'

export function buildCommandDigest(input: BuildCommandDigestInput): CommandDigestItem[] {
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  const candidates = [
    ...input.slaItems
      .filter(isDigestWorthySla)
      .map(item => fromSlaItem(item)),
    ...input.cadenceItems
      .filter(isDigestWorthyCadence)
      .map(item => fromCadenceItem(item)),
    ...input.attentionItems
      .filter(isDigestWorthyAttention)
      .map(item => fromAttentionItem(item)),
    ...buildRevenueRollups(input.data, input.now ?? new Date()),
    ...buildSupportRollups(input.data, input.now ?? new Date()),
    ...buildHealthRollups(input.data, input.now ?? new Date()),
  ]

  return dedupeDigestItems(candidates)
    .sort(sortDigestItems)
    .slice(0, 36)
    .map(item => applyLocalState(item, localStateByItemId.get(item.id)))
}

export function summarizeCommandDigest(items: CommandDigestItem[], data: PlatformAdminReadModel): CommandDigestSummary {
  const revenueAtRisk = data.billingRisks.reduce((total, risk) => total + risk.amountAtRisk, 0)
  const supportEscalations = data.supportIssues.filter(issue => issue.status === 'Escalated' || issue.severity === 'critical').length
  const impactedClients = new Set<string>()
  data.billingRisks.forEach(risk => impactedClients.add(risk.organizationName))
  data.supportIssues
    .filter(issue => issue.status !== 'Resolved')
    .forEach(issue => impactedClients.add(issue.organizationName))
  data.moduleUsageGaps.forEach(gap => impactedClients.add(gap.organizationName))
  const healthClientCount = data.platformHealthSignals
    .filter(signal => signal.status !== 'Passing')
    .reduce((total, signal) => total + signal.affectedClients, 0)

  const critical = items.filter(item => item.severity === 'Critical').length
  const high = items.filter(item => item.severity === 'High').length
  const handoffsReady = items.filter(item => item.decision === 'Approve' || item.decision === 'Escalate').length
  const decisionsNeeded = items.filter(item => item.decision !== 'Monitor').length
  const readinessScore = Math.max(0, Math.min(100, 96 - critical * 9 - high * 4 - handoffsReady * 2 - supportEscalations * 2))
  const posture: CommandDigestPosture = critical > 0 || readinessScore < 72
    ? 'Critical'
    : high > 0 || decisionsNeeded > 4 || revenueAtRisk > 0
      ? 'Needs Attention'
      : 'Steady'

  return {
    total: items.length,
    critical,
    high,
    decisionsNeeded,
    handoffsReady,
    reviewed: items.filter(item => item.reviewStatus === 'Reviewed' || item.reviewStatus === 'Follow-Up Queued').length,
    revenueAtRisk,
    supportEscalations,
    clientsImpacted: impactedClients.size + healthClientCount,
    readinessScore,
    posture,
  }
}

export function summarizeCommandDigestLanes(items: CommandDigestItem[]): CommandDigestLaneSummary[] {
  return commandDigestLanes.map(lane => {
    const laneItems = items.filter(item => item.lane === lane)
    const ownerCounts = new Map<string, number>()
    laneItems.forEach(item => ownerCounts.set(item.owner, (ownerCounts.get(item.owner) ?? 0) + 1))
    const [topOwner] = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['Unassigned']
    return {
      lane,
      total: laneItems.length,
      critical: laneItems.filter(item => item.severity === 'Critical').length,
      nextDecision: laneItems[0]?.decision ?? 'Monitor',
      topOwner,
    }
  })
}

export function buildCommandDigestHeadlines(summary: CommandDigestSummary, items: CommandDigestItem[]): CommandDigestHeadline[] {
  const leadItem = items[0]
  return [
    {
      id: 'posture',
      label: 'Posture',
      value: summary.posture,
      detail: leadItem ? `Lead: ${leadItem.title}` : 'No urgent operating item is open.',
      tone: getDigestPostureTone(summary.posture),
    },
    {
      id: 'decision-load',
      label: 'Decision Load',
      value: String(summary.decisionsNeeded),
      detail: `${summary.handoffsReady} ready for escalation or approval`,
      tone: summary.decisionsNeeded ? 'warn' : 'ok',
    },
    {
      id: 'revenue-risk',
      label: 'Revenue Risk',
      value: formatDigestCurrency(summary.revenueAtRisk),
      detail: `${summary.clientsImpacted} impacted client signals`,
      tone: summary.revenueAtRisk ? 'warn' : 'ok',
    },
    {
      id: 'reviewed',
      label: 'Reviewed',
      value: `${summary.reviewed}/${Math.max(summary.total, 1)}`,
      detail: 'Local executive review coverage',
      tone: summary.reviewed >= summary.total && summary.total > 0 ? 'ok' : 'info',
    },
  ]
}

export function buildCommandDigestNarrative(summary: CommandDigestSummary, items: CommandDigestItem[]) {
  const lead = items[0]
  if (!lead) return 'The command digest is clear. No immediate executive decisions are waiting.'
  if (summary.posture === 'Critical') {
    return `${lead.title} is the lead executive decision. ${summary.critical} critical item${summary.critical === 1 ? '' : 's'} and ${summary.handoffsReady} handoff${summary.handoffsReady === 1 ? '' : 's'} need owner attention.`
  }
  if (summary.posture === 'Needs Attention') {
    return `${lead.title} leads today's operating review. ${summary.decisionsNeeded} decision${summary.decisionsNeeded === 1 ? '' : 's'} should be reviewed before close.`
  }
  return `Today's operating brief is steady. ${summary.total} item${summary.total === 1 ? '' : 's'} remain visible for monitoring.`
}

export function getDigestSeverityTone(severity: CommandDigestSeverity) {
  if (severity === 'Critical') return 'danger' as const
  if (severity === 'High') return 'warn' as const
  if (severity === 'Moderate') return 'info' as const
  return 'ok' as const
}

export function getDigestDecisionTone(decision: CommandDigestDecision) {
  if (decision === 'Escalate') return 'danger' as const
  if (decision === 'Approve' || decision === 'Assign') return 'warn' as const
  if (decision === 'Review') return 'info' as const
  return 'neutral' as const
}

export function getDigestLaneTone(lane: CommandDigestLane) {
  if (lane === 'Executive' || lane === 'Revenue') return 'warn' as const
  if (lane === 'Support' || lane === 'Platform Health') return 'danger' as const
  if (lane === 'Client Success' || lane === 'AI & Automation') return 'info' as const
  return 'neutral' as const
}

export function getDigestPostureTone(posture: CommandDigestPosture) {
  if (posture === 'Critical') return 'danger' as const
  if (posture === 'Needs Attention') return 'warn' as const
  return 'ok' as const
}

export function getDigestReviewTone(status: CommandDigestReviewStatus) {
  if (status === 'Follow-Up Queued') return 'warn' as const
  if (status === 'Reviewed') return 'ok' as const
  return 'neutral' as const
}

export function formatDigestCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function loadLocalCommandDigestStates(): CommandDigestLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCommandDigestLocalState)
  } catch {
    return []
  }
}

export function saveLocalCommandDigestStates(states: CommandDigestLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 120)))
}

export function useLocalCommandDigestStates() {
  const [states, setStates] = useState<CommandDigestLocalState[]>(() => loadLocalCommandDigestStates())

  useEffect(() => {
    saveLocalCommandDigestStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromSlaItem(item: SlaEscalationItem): CommandDigestItem {
  const decision = decisionFromSla(item)
  return {
    id: `digest-sla-${item.id}`,
    title: item.title,
    brief: `${item.itemType} / ${item.level}: ${item.description}`,
    lane: laneFromTarget(item.targetPage, item.owner),
    severity: severityFromSla(item),
    decision,
    owner: item.owner,
    scope: item.scope,
    source: 'SLA',
    sourceStatus: item.status,
    score: scoreSlaItem(item),
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    recommendedAction: item.escalationSteps[0]?.action ?? item.description,
    evidence: [
      `SLA status: ${item.status}`,
      `Escalation level: ${item.level}`,
      ...item.evidence.slice(0, 3),
    ],
    targetPage: item.targetPage,
    permission: item.permission,
    followUpActionType: item.handoffActionType ?? actionTypeForTarget(item.targetPage),
    followUpPermission: item.handoffPermission ?? actionPermissionForTarget(item.targetPage),
    relatedRecordId: item.sourceId,
    reviewStatus: 'Open',
    localNote: item.localNote,
    dedupeKey: `sla:${item.sourceId}:${item.itemType}`,
  }
}

function fromCadenceItem(item: CommandCadenceItem): CommandDigestItem {
  return {
    id: `digest-${item.id}`,
    title: item.title,
    brief: `${item.lane} / ${item.slaStatus}: ${item.recommendedAction}`,
    lane: laneFromCadence(item.lane),
    severity: severityFromCadence(item.slaStatus, item.priority),
    decision: decisionFromCadence(item.decision),
    owner: item.owner,
    scope: item.scope,
    source: 'Cadence',
    sourceStatus: item.slaStatus,
    score: item.priorityScore,
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    recommendedAction: item.recommendedAction,
    evidence: [
      `Decision: ${item.decision}`,
      `Cadence window: ${item.cadenceWindow}`,
      ...item.evidence.slice(0, 3),
    ],
    targetPage: item.actionRequestId ? 'action-requests' : 'command-cadence',
    permission: item.actionRequestId ? 'admin_actions.view' : 'dashboard.view',
    followUpActionType: item.followUpActionType,
    followUpPermission: item.followUpPermission,
    relatedRecordId: item.relatedAttentionId,
    reviewStatus: 'Open',
    dedupeKey: `attention:${item.relatedAttentionId}`,
  }
}

function fromAttentionItem(item: AttentionQueueItem): CommandDigestItem {
  return {
    id: `digest-attention-${item.id}`,
    title: item.title,
    brief: `${item.category} / ${item.status}: ${item.recommendedAction}`,
    lane: laneFromAttention(item.category),
    severity: severityFromAttention(item.priority, item.status),
    decision: decisionFromAttention(item),
    owner: item.owner,
    scope: item.scope,
    source: 'Attention',
    sourceStatus: item.status,
    score: item.priorityScore,
    createdAt: item.createdAt,
    dueAt: addHours(item.createdAt, item.priority === 'Critical' ? 2 : item.priority === 'High' ? 8 : 24),
    recommendedAction: item.recommendedAction,
    evidence: [
      `Priority: ${item.priority}`,
      `Source: ${item.source}`,
      ...item.evidence.slice(0, 3),
    ],
    targetPage: targetFromAttention(item.category, item.actionRequestId),
    permission: permissionFromAttention(item.category, item.actionRequestId),
    followUpActionType: actionTypeFromAttention(item.category),
    followUpPermission: actionPermissionFromAttention(item.category),
    relatedRecordId: item.relatedRecordId,
    reviewStatus: 'Open',
    dedupeKey: `attention:${item.id}`,
  }
}

function buildRevenueRollups(data: PlatformAdminReadModel, now: Date): CommandDigestItem[] {
  const risks = data.billingRisks.filter(risk => risk.amountAtRisk > 0)
  if (!risks.length) return []
  const totalAtRisk = risks.reduce((total, risk) => total + risk.amountAtRisk, 0)
  const topRisk = [...risks].sort((a, b) => b.amountAtRisk - a.amountAtRisk)[0]
  return [{
    id: 'digest-rollup-revenue-risk',
    title: 'Revenue risk rollup',
    brief: `${formatDigestCurrency(totalAtRisk)} is in billing review across ${risks.length} account${risks.length === 1 ? '' : 's'}.`,
    lane: 'Revenue',
    severity: totalAtRisk >= 10000 ? 'Critical' : totalAtRisk > 0 ? 'High' : 'Stable',
    decision: 'Review',
    owner: topRisk?.owner ?? 'Finance',
    scope: 'Finance portfolio',
    source: 'Revenue Rollup',
    sourceStatus: topRisk?.billingStatus ?? 'Needs Review',
    score: Math.min(98, Math.round(totalAtRisk / 250)),
    createdAt: topRisk?.lastPaymentAttempt ?? now.toISOString(),
    dueAt: addHours(topRisk?.lastPaymentAttempt ?? now.toISOString(), 24),
    recommendedAction: topRisk?.nextAction ?? 'Review billing risk exposure and decide finance follow-up.',
    evidence: risks.slice(0, 4).map(risk => `${risk.organizationName}: ${formatDigestCurrency(risk.amountAtRisk)} / ${risk.billingStatus}`),
    targetPage: 'revenue',
    permission: 'revenue.view',
    followUpActionType: 'billing_review_action',
    followUpPermission: 'billing.manage',
    relatedRecordId: 'billing-risk-rollup',
    reviewStatus: 'Open',
    dedupeKey: 'rollup:revenue-risk',
  }]
}

function buildSupportRollups(data: PlatformAdminReadModel, now: Date): CommandDigestItem[] {
  const issues = data.supportIssues.filter(issue => issue.status !== 'Resolved' && (issue.status === 'Escalated' || issue.severity === 'critical'))
  if (issues.length < 2) return []
  return [{
    id: 'digest-rollup-support-escalations',
    title: 'Support escalation rollup',
    brief: `${issues.length} support escalations are open across service, device, or configuration workflows.`,
    lane: 'Support',
    severity: issues.some(issue => issue.severity === 'critical') ? 'Critical' : 'High',
    decision: 'Assign',
    owner: 'Support',
    scope: 'Support portfolio',
    source: 'Support Rollup',
    sourceStatus: 'Escalated',
    score: Math.min(96, 76 + issues.length * 5),
    createdAt: issues[0]?.detectedAt ?? now.toISOString(),
    dueAt: addHours(issues[0]?.detectedAt ?? now.toISOString(), 4),
    recommendedAction: 'Confirm owners for every escalated support signal and queue governed follow-up where remediation is required.',
    evidence: issues.slice(0, 4).map(issue => `${issue.organizationName} / ${issue.venueName}: ${issue.issueType}`),
    targetPage: 'support',
    permission: 'support.view',
    followUpActionType: 'support_troubleshooting_action',
    followUpPermission: 'support.manage',
    relatedRecordId: 'support-escalation-rollup',
    reviewStatus: 'Open',
    dedupeKey: 'rollup:support-escalations',
  }]
}

function buildHealthRollups(data: PlatformAdminReadModel, now: Date): CommandDigestItem[] {
  const signals = data.platformHealthSignals.filter(signal => signal.status === 'Failing' || signal.severity === 'critical')
  if (!signals.length) return []
  const affectedClients = signals.reduce((total, signal) => total + signal.affectedClients, 0)
  const lead = signals[0]
  return [{
    id: 'digest-rollup-health-impact',
    title: 'Platform health impact rollup',
    brief: `${affectedClients} client impact signal${affectedClients === 1 ? '' : 's'} tied to failing or critical checks.`,
    lane: 'Platform Health',
    severity: signals.some(signal => signal.severity === 'critical') ? 'Critical' : 'High',
    decision: 'Escalate',
    owner: 'Engineering',
    scope: 'Platform',
    source: 'Health Rollup',
    sourceStatus: lead?.status ?? 'Failing',
    score: Math.min(99, 84 + signals.length * 5),
    createdAt: lead?.checkedAt ?? now.toISOString(),
    dueAt: addHours(lead?.checkedAt ?? now.toISOString(), 2),
    recommendedAction: lead?.recommendedAction ?? 'Review failing platform checks and queue remediation through the governed handler.',
    evidence: signals.slice(0, 4).map(signal => `${signal.label}: ${signal.message}`),
    targetPage: 'health',
    permission: 'health.view',
    followUpActionType: 'remediation_server_action',
    followUpPermission: 'troubleshooting.run',
    relatedRecordId: 'platform-health-rollup',
    reviewStatus: 'Open',
    dedupeKey: 'rollup:health-impact',
  }]
}

function isDigestWorthySla(item: SlaEscalationItem) {
  return item.status === 'Overdue'
    || item.status === 'Due Soon'
    || item.status === 'Needs Review'
    || item.level === 'Executive Review'
    || item.level === 'Action Handoff'
    || item.actionHandoffRequired
}

function isDigestWorthyCadence(item: CommandCadenceItem) {
  return item.slaStatus === 'Blocked'
    || item.slaStatus === 'Overdue'
    || item.slaStatus === 'Due Today'
    || item.decision !== 'Monitor'
}

function isDigestWorthyAttention(item: AttentionQueueItem) {
  return item.priority === 'Critical' || item.priority === 'High' || item.status === 'Blocked'
}

function severityFromSla(item: SlaEscalationItem): CommandDigestSeverity {
  if (item.status === 'Overdue' || item.level === 'Executive Review' || item.priority === 'Critical') return 'Critical'
  if (item.status === 'Due Soon' || item.status === 'Needs Review' || item.level === 'Action Handoff') return 'High'
  if (item.status === 'On Track' || item.status === 'Acknowledged') return 'Moderate'
  return 'Stable'
}

function severityFromCadence(status: CommandCadenceSlaStatus, priority: AttentionPriority): CommandDigestSeverity {
  if (status === 'Blocked' || status === 'Overdue' || priority === 'Critical') return 'Critical'
  if (status === 'Due Today' || priority === 'High') return 'High'
  if (priority === 'Medium') return 'Moderate'
  return 'Stable'
}

function severityFromAttention(priority: AttentionPriority, status: AttentionQueueItem['status']): CommandDigestSeverity {
  if (priority === 'Critical' || status === 'Blocked') return 'Critical'
  if (priority === 'High') return 'High'
  if (priority === 'Medium') return 'Moderate'
  return 'Stable'
}

function decisionFromSla(item: SlaEscalationItem): CommandDigestDecision {
  if (item.level === 'Executive Review' || item.status === 'Overdue') return 'Escalate'
  if (item.level === 'Action Handoff' || item.actionHandoffRequired) return 'Approve'
  if (item.status === 'Due Soon') return 'Assign'
  if (item.status === 'Needs Review') return 'Review'
  return 'Monitor'
}

function decisionFromCadence(decision: CommandCadenceDecision): CommandDigestDecision {
  return decision
}

function decisionFromAttention(item: AttentionQueueItem): CommandDigestDecision {
  if (item.status === 'Blocked') return 'Escalate'
  if (item.actionRequestId || item.category === 'Action Request') return 'Approve'
  if (item.priority === 'Critical') return 'Review'
  if (item.priority === 'High') return 'Assign'
  return 'Monitor'
}

function laneFromCadence(lane: CommandCadenceItem['lane']): CommandDigestLane {
  if (lane === 'Owner Review') return 'Executive'
  if (lane === 'Revenue Risk') return 'Revenue'
  if (lane === 'Support Ops') return 'Support'
  if (lane === 'Client Success') return 'Client Success'
  if (lane === 'Engineering') return 'Platform Health'
  return 'AI & Automation'
}

function laneFromAttention(category: AttentionCategory): CommandDigestLane {
  if (category === 'Billing') return 'Revenue'
  if (category === 'Support') return 'Support'
  if (category === 'Usage') return 'Client Success'
  if (category === 'Health') return 'Platform Health'
  if (category === 'Agent') return 'AI & Automation'
  return 'Admin Actions'
}

function laneFromTarget(targetPage: WatchTargetPage, owner: string): CommandDigestLane {
  if (owner === 'Owner') return 'Executive'
  if (targetPage === 'revenue') return 'Revenue'
  if (targetPage === 'support') return 'Support'
  if (targetPage === 'usage') return 'Client Success'
  if (targetPage === 'health' || targetPage === 'data-quality') return 'Platform Health'
  if (targetPage === 'action-requests' || targetPage === 'audit' || targetPage === 'saved-views') return 'Admin Actions'
  return 'Executive'
}

function targetFromAttention(category: AttentionCategory, actionRequestId?: string): CommandDigestTargetPage {
  if (actionRequestId || category === 'Action Request') return 'action-requests'
  if (category === 'Billing') return 'revenue'
  if (category === 'Support') return 'support'
  if (category === 'Usage') return 'client-success'
  if (category === 'Health') return 'health'
  if (category === 'Agent') return 'agents'
  return 'attention'
}

function permissionFromAttention(category: AttentionCategory, actionRequestId?: string): PermissionKey {
  if (actionRequestId || category === 'Action Request') return 'admin_actions.view'
  if (category === 'Billing') return 'revenue.view'
  if (category === 'Support') return 'support.view'
  if (category === 'Usage') return 'clients.view'
  if (category === 'Health') return 'health.view'
  if (category === 'Agent') return 'agents.view'
  return 'dashboard.view'
}

function actionTypeFromAttention(category: AttentionCategory): AdminActionRequestType {
  if (category === 'Billing') return 'billing_review_action'
  if (category === 'Support') return 'support_troubleshooting_action'
  if (category === 'Health') return 'remediation_server_action'
  return 'agent_recommended_action'
}

function actionPermissionFromAttention(category: AttentionCategory): PermissionKey {
  if (category === 'Billing') return 'billing.manage'
  if (category === 'Support') return 'support.manage'
  if (category === 'Health') return 'troubleshooting.run'
  if (category === 'Usage') return 'clients.manage'
  if (category === 'Agent') return 'agents.manage'
  return 'admin_actions.manage'
}

function actionTypeForTarget(targetPage: WatchTargetPage): AdminActionRequestType {
  if (targetPage === 'revenue') return 'billing_review_action'
  if (targetPage === 'support') return 'support_troubleshooting_action'
  if (targetPage === 'health' || targetPage === 'data-quality') return 'remediation_server_action'
  return 'agent_recommended_action'
}

function actionPermissionForTarget(targetPage: WatchTargetPage): PermissionKey {
  if (targetPage === 'revenue') return 'billing.manage'
  if (targetPage === 'support') return 'support.manage'
  if (targetPage === 'health' || targetPage === 'data-quality') return 'troubleshooting.run'
  if (targetPage === 'usage') return 'clients.manage'
  return 'admin_actions.manage'
}

function scoreSlaItem(item: SlaEscalationItem) {
  const priorityScore = item.priority === 'Critical' ? 98 : item.priority === 'High' ? 86 : item.priority === 'Medium' ? 68 : 44
  const statusBoost = item.status === 'Overdue' ? 8 : item.status === 'Due Soon' || item.status === 'Needs Review' ? 4 : 0
  const levelBoost = item.level === 'Executive Review' ? 6 : item.level === 'Action Handoff' ? 4 : 0
  return Math.min(100, priorityScore + statusBoost + levelBoost)
}

function dedupeDigestItems(items: CommandDigestItem[]) {
  const byKey = new Map<string, CommandDigestItem>()
  items.forEach(item => {
    const existing = byKey.get(item.dedupeKey)
    if (!existing || sortDigestItems(item, existing) < 0) byKey.set(item.dedupeKey, item)
  })
  return [...byKey.values()]
}

function sortDigestItems(a: CommandDigestItem, b: CommandDigestItem) {
  return severityWeight(a.severity) - severityWeight(b.severity)
    || decisionWeight(a.decision) - decisionWeight(b.decision)
    || b.score - a.score
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function severityWeight(severity: CommandDigestSeverity) {
  if (severity === 'Critical') return 0
  if (severity === 'High') return 1
  if (severity === 'Moderate') return 2
  return 3
}

function decisionWeight(decision: CommandDigestDecision) {
  if (decision === 'Escalate') return 0
  if (decision === 'Approve') return 1
  if (decision === 'Assign') return 2
  if (decision === 'Review') return 3
  return 4
}

function applyLocalState(item: CommandDigestItem, state: CommandDigestLocalState | undefined): CommandDigestItem {
  if (!state) return item
  return {
    ...item,
    reviewStatus: state.reviewStatus,
    localNote: state.note ?? item.localNote,
    reviewedAt: state.updatedAt,
  }
}

function addHours(value: string, hours: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

function isCommandDigestLocalState(value: unknown): value is CommandDigestLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && typeof record.reviewStatus === 'string'
    && typeof record.updatedAt === 'string'
}
