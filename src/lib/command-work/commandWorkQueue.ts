import { useEffect, useState } from 'react'
import type { AdminActionRequest, AdminActionRequestType } from '../admin-actions/actionRequests'
import type { ActionRequestGovernanceRecord } from '../admin-actions/actionRequestGovernance'
import type { CoverageLedgerEntry } from '../ownership/coverageLedger'
import type { OwnershipWorkItem } from '../ownership/ownershipSla'
import type { PermissionKey } from '../permissions/permissions'
import type { EscalationInboxItem, EscalationInboxTargetPage } from '../command-digest/escalationInbox'

export type CommandWorkSource = 'Escalation Inbox' | 'Coverage Ledger' | 'Approval Center' | 'Ownership SLA'
export type CommandWorkLane = 'Owner Review' | 'Coverage' | 'Approval' | 'SLA Breach' | 'Action Handoff'
export type CommandWorkPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type CommandWorkDecision = 'Escalate' | 'Approve' | 'Assign' | 'Review' | 'Monitor'
export type CommandWorkStatus = 'Open' | 'Claimed' | 'Snoozed' | 'Follow-Up Queued' | 'Done' | 'Dismissed'
export type CommandWorkTargetPage =
  | EscalationInboxTargetPage
  | 'coverage-ledger'
  | 'approval-center'
  | 'ownership-sla'
  | 'action-requests'
  | 'notification-routing'
  | 'on-call-schedule'

export interface CommandWorkLocalState {
  itemId: string
  status: CommandWorkStatus
  claimedBy?: string
  note?: string
  snoozedUntil?: string
  followUpRequestId?: string
  updatedAt: string
}

export interface CommandWorkItem {
  id: string
  dedupeKey: string
  source: CommandWorkSource
  lane: CommandWorkLane
  title: string
  description: string
  owner: string
  scope: string
  priority: CommandWorkPriority
  priorityScore: number
  status: CommandWorkStatus
  decision: CommandWorkDecision
  sourceStatus: string
  targetPage: CommandWorkTargetPage
  targetLabel: string
  permission: PermissionKey
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  handlerKey?: string
  rollbackNotes: string
  createdAt: string
  dueAt: string
  minutesLate: number
  evidence: string[]
  relatedRecordId: string
  actionRequestId?: string
  localState?: CommandWorkLocalState
}

export interface BuildCommandWorkQueueInput {
  escalations: EscalationInboxItem[]
  coverageEntries: CoverageLedgerEntry[]
  ownershipWorkItems: OwnershipWorkItem[]
  actionRequests: AdminActionRequest[]
  governanceRecords: ActionRequestGovernanceRecord[]
  localStates?: CommandWorkLocalState[]
  now?: Date
}

export interface CommandWorkQueueSummary {
  total: number
  open: number
  claimed: number
  snoozed: number
  followUps: number
  done: number
  dismissed: number
  critical: number
  overdue: number
  approvals: number
  coverage: number
  slaBreaches: number
}

const localStorageKey = 'hc_platform_command_work_queue_state_v1'

export const commandWorkQueueBoundaryRule =
  'Command Work Queue coordinates owner decisions across Platform Admin. It records local operating state and queues governed follow-ups; it does not directly mutate customer data, billing, modules, permissions, notifications, or production workflow state.'

export function buildCommandWorkQueue(input: BuildCommandWorkQueueInput): CommandWorkItem[] {
  const now = input.now ?? new Date()
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  const governanceByRequestId = new Map(input.governanceRecords.map(record => [record.requestId, record]))
  const actionRequestById = new Map(input.actionRequests.map(request => [request.id, request]))
  const candidates = [
    ...input.escalations
      .filter(item => item.localStatus !== 'Dismissed')
      .map(item => fromEscalation(item, now)),
    ...input.coverageEntries
      .filter(entry => entry.status !== 'Dismissed')
      .map(entry => fromCoverageEntry(entry, now)),
    ...input.actionRequests
      .map(request => fromApprovalRequest(request, governanceByRequestId.get(request.id), now))
      .filter((item): item is CommandWorkItem => Boolean(item)),
    ...input.ownershipWorkItems
      .filter(item => item.slaStatus === 'Breached' || item.slaStatus === 'Due Soon' || item.priority === 'Critical')
      .map(item => fromOwnershipWorkItem(item, actionRequestById, now)),
  ]

  return dedupeCommandWork(candidates)
    .map(item => applyLocalState(item, localStateByItemId.get(item.id), now))
    .sort(sortCommandWorkItems)
    .slice(0, 120)
}

export function summarizeCommandWorkQueue(items: CommandWorkItem[]): CommandWorkQueueSummary {
  const active = items.filter(item => item.status !== 'Dismissed')
  return {
    total: items.length,
    open: active.filter(item => item.status === 'Open').length,
    claimed: active.filter(item => item.status === 'Claimed').length,
    snoozed: active.filter(item => item.status === 'Snoozed').length,
    followUps: active.filter(item => item.status === 'Follow-Up Queued').length,
    done: items.filter(item => item.status === 'Done').length,
    dismissed: items.filter(item => item.status === 'Dismissed').length,
    critical: active.filter(item => item.priority === 'Critical').length,
    overdue: active.filter(item => item.minutesLate > 0).length,
    approvals: active.filter(item => item.lane === 'Approval').length,
    coverage: active.filter(item => item.lane === 'Coverage').length,
    slaBreaches: active.filter(item => item.lane === 'SLA Breach').length,
  }
}

export function getCommandWorkPriorityTone(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function getCommandWorkStatusTone(status: CommandWorkStatus) {
  if (status === 'Open') return 'warn' as const
  if (status === 'Claimed' || status === 'Follow-Up Queued') return 'info' as const
  if (status === 'Done') return 'ok' as const
  return 'neutral' as const
}

export function getCommandWorkLaneTone(lane: CommandWorkLane) {
  if (lane === 'Owner Review' || lane === 'Action Handoff') return 'danger' as const
  if (lane === 'Approval' || lane === 'SLA Breach') return 'warn' as const
  if (lane === 'Coverage') return 'info' as const
  return 'neutral' as const
}

export function getCommandWorkDecisionTone(decision: CommandWorkDecision) {
  if (decision === 'Escalate') return 'danger' as const
  if (decision === 'Approve' || decision === 'Assign') return 'warn' as const
  if (decision === 'Review') return 'info' as const
  return 'neutral' as const
}

export function loadLocalCommandWorkStates(): CommandWorkLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCommandWorkLocalState)
  } catch {
    return []
  }
}

export function saveLocalCommandWorkStates(states: CommandWorkLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 240)))
}

export function useLocalCommandWorkStates() {
  const [states, setStates] = useState<CommandWorkLocalState[]>(() => loadLocalCommandWorkStates())

  useEffect(() => {
    saveLocalCommandWorkStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromEscalation(item: EscalationInboxItem, now: Date): CommandWorkItem {
  const lane: CommandWorkLane = item.status === 'Action Handoff' || item.status === 'Approved'
    ? 'Action Handoff'
    : 'Owner Review'
  const relatedActionRequestId = item.source === 'Action Request' ? item.relatedRecordId : undefined

  return {
    id: `command-escalation-${item.id}`,
    dedupeKey: relatedActionRequestId ? `action:${relatedActionRequestId}` : item.dedupeKey,
    source: 'Escalation Inbox',
    lane,
    title: item.title,
    description: item.description,
    owner: item.owner,
    scope: item.scope,
    priority: priorityFromEscalation(item.severity),
    priorityScore: item.score,
    status: 'Open',
    decision: item.decision,
    sourceStatus: `${item.source} / ${item.status}`,
    targetPage: item.targetPage,
    targetLabel: item.targetLabel,
    permission: item.permission,
    followUpPermission: item.followUpPermission,
    followUpActionType: item.followUpActionType,
    handlerKey: item.handlerKey,
    rollbackNotes: item.rollbackNotes,
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    minutesLate: item.minutesLate,
    evidence: item.evidence,
    relatedRecordId: item.relatedRecordId,
    actionRequestId: relatedActionRequestId,
  }
}

function fromCoverageEntry(entry: CoverageLedgerEntry, now: Date): CommandWorkItem {
  return {
    id: `command-coverage-${entry.id}`,
    dedupeKey: `coverage:${entry.id}`,
    source: 'Coverage Ledger',
    lane: 'Coverage',
    title: entry.title,
    description: entry.description,
    owner: entry.owner,
    scope: entry.scope,
    priority: entry.severity === 'Critical' ? 'Critical' : entry.severity === 'Warning' ? 'High' : 'Medium',
    priorityScore: scoreCoverageEntry(entry, now),
    status: 'Open',
    decision: entry.type === 'Coverage Gap' || entry.type === 'Backup Missing'
      ? 'Assign'
      : entry.type === 'Action Queue'
        ? 'Approve'
        : 'Review',
    sourceStatus: `${entry.type} / ${entry.sourceStatus}`,
    targetPage: 'coverage-ledger',
    targetLabel: 'Coverage Ledger',
    permission: 'notifications.view',
    followUpPermission: entry.followUpPermission,
    followUpActionType: entry.followUpActionType,
    rollbackNotes: 'Coverage evidence cannot change production delivery from the browser. Queue a governed follow-up for server-side coverage corrections.',
    createdAt: entry.createdAt,
    dueAt: entry.dueAt ?? addHours(entry.createdAt, 8),
    minutesLate: calculateMinutesLate(entry.dueAt ?? addHours(entry.createdAt, 8), now),
    evidence: entry.evidence,
    relatedRecordId: entry.id,
    actionRequestId: entry.actionRequestId,
  }
}

function fromApprovalRequest(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord | undefined,
  now: Date,
): CommandWorkItem | null {
  if (!governance) return null
  if (request.status === 'Completed') return null
  if (!['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'].includes(request.status)) return null

  const dueAt = dueAtForActionRequest(request, now)
  const decision: CommandWorkDecision = request.status === 'Queued' && !governance.hardBlockers.length
    ? 'Approve'
    : request.status === 'Blocked' || request.status === 'Failed' || governance.hardBlockers.length
      ? 'Escalate'
      : 'Review'

  return {
    id: `command-approval-${request.id}`,
    dedupeKey: `action:${request.id}`,
    source: 'Approval Center',
    lane: 'Approval',
    title: request.title,
    description: governance.policyReason,
    owner: governance.requiredApprovers.join(', '),
    scope: request.scope.label,
    priority: priorityFromGovernance(governance.riskLevel),
    priorityScore: scoreApprovalRequest(request, governance, now),
    status: 'Open',
    decision,
    sourceStatus: `${request.status} / ${governance.readiness}`,
    targetPage: 'approval-center',
    targetLabel: 'Approval Center',
    permission: 'admin_actions.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: request.actionType,
    handlerKey: request.serverHandler.key,
    rollbackNotes: request.rollbackNotes,
    createdAt: request.createdAt,
    dueAt,
    minutesLate: calculateMinutesLate(dueAt, now),
    evidence: [
      `Risk: ${governance.riskLevel}`,
      `Readiness: ${governance.readiness}`,
      `Approvers: ${governance.requiredApprovers.join(', ')}`,
      governance.hardBlockers[0] ?? `${governance.warningCount} warnings / ${governance.passCount} passing checks`,
    ],
    relatedRecordId: request.id,
    actionRequestId: request.id,
  }
}

function fromOwnershipWorkItem(
  item: OwnershipWorkItem,
  actionRequestById: Map<string, AdminActionRequest>,
  now: Date,
): CommandWorkItem {
  const actionRequest = item.actionRequestId ? actionRequestById.get(item.actionRequestId) : undefined
  return {
    id: `command-sla-${item.id}`,
    dedupeKey: item.actionRequestId ? `action:${item.actionRequestId}` : `sla:${item.id}`,
    source: 'Ownership SLA',
    lane: 'SLA Breach',
    title: item.title,
    description: item.nextAction,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    priorityScore: item.priorityScore,
    status: 'Open',
    decision: item.slaStatus === 'Breached' || item.priority === 'Critical' ? 'Escalate' : 'Review',
    sourceStatus: `${item.sourceType} / ${item.slaStatus}`,
    targetPage: item.actionRequestId ? 'action-requests' : 'ownership-sla',
    targetLabel: item.actionRequestId ? 'Action Requests' : 'Ownership / SLA',
    permission: item.actionRequestId ? 'admin_actions.view' : 'dashboard.view',
    followUpPermission: actionRequest?.permissionRequired ?? permissionFromWorkItem(item),
    followUpActionType: actionRequest?.actionType ?? actionTypeFromWorkItem(item),
    handlerKey: actionRequest?.serverHandler.key,
    rollbackNotes: actionRequest?.rollbackNotes ?? 'SLA follow-up must be queued through a governed server-side action before production state changes.',
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    minutesLate: Math.max(calculateMinutesLate(item.dueAt, now), item.slaStatus === 'Breached' ? 1 : 0),
    evidence: item.evidence,
    relatedRecordId: item.sourceRecordId,
    actionRequestId: item.actionRequestId,
  }
}

function applyLocalState(item: CommandWorkItem, state: CommandWorkLocalState | undefined, now: Date): CommandWorkItem {
  if (!state) return item
  const snoozedUntil = state.snoozedUntil ? new Date(state.snoozedUntil) : undefined
  const status = state.status === 'Snoozed' && snoozedUntil && snoozedUntil.getTime() <= now.getTime()
    ? 'Open'
    : state.status

  return {
    ...item,
    status,
    localState: state,
  }
}

function dedupeCommandWork(items: CommandWorkItem[]) {
  const byKey = new Map<string, CommandWorkItem>()
  items.forEach(item => {
    const existing = byKey.get(item.dedupeKey)
    if (!existing || sortCommandWorkItems(item, existing) < 0) {
      byKey.set(item.dedupeKey, item)
    }
  })
  return [...byKey.values()]
}

function sortCommandWorkItems(a: CommandWorkItem, b: CommandWorkItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || laneWeight(a.lane) - laneWeight(b.lane)
    || b.priorityScore - a.priorityScore
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function priorityFromEscalation(severity: EscalationInboxItem['severity']): CommandWorkPriority {
  if (severity === 'Critical') return 'Critical'
  if (severity === 'High') return 'High'
  if (severity === 'Medium') return 'Medium'
  return 'Low'
}

function priorityFromGovernance(riskLevel: ActionRequestGovernanceRecord['riskLevel']): CommandWorkPriority {
  if (riskLevel === 'Critical') return 'Critical'
  if (riskLevel === 'High') return 'High'
  if (riskLevel === 'Medium') return 'Medium'
  return 'Low'
}

function scoreCoverageEntry(entry: CoverageLedgerEntry, now: Date) {
  const dueAt = entry.dueAt ?? addHours(entry.createdAt, 8)
  const overdueBoost = Math.min(16, calculateMinutesLate(dueAt, now) / 30)
  const base = entry.severity === 'Critical' ? 96 : entry.severity === 'Warning' ? 82 : 58
  return Math.min(100, base + overdueBoost)
}

function scoreApprovalRequest(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord,
  now: Date,
) {
  const riskBase = governance.riskLevel === 'Critical'
    ? 96
    : governance.riskLevel === 'High'
      ? 84
      : governance.riskLevel === 'Medium'
        ? 68
        : 48
  const blockerBoost = governance.hardBlockers.length ? 8 : 0
  const statusBoost = request.status === 'Blocked' || request.status === 'Failed' ? 8 : request.status === 'Queued' ? 4 : 0
  const overdueBoost = Math.min(10, calculateMinutesLate(dueAtForActionRequest(request, now), now) / 60)
  return Math.min(100, riskBase + blockerBoost + statusBoost + overdueBoost)
}

function permissionFromWorkItem(item: OwnershipWorkItem): PermissionKey {
  if (item.sourceType === 'Support') return 'support.manage'
  if (item.sourceType === 'Billing') return 'billing.manage'
  if (item.sourceType === 'Usage') return 'clients.manage'
  if (item.sourceType === 'Health') return 'troubleshooting.run'
  if (item.sourceType === 'Agent') return 'agents.manage'
  return 'admin_actions.manage'
}

function actionTypeFromWorkItem(item: OwnershipWorkItem): AdminActionRequestType {
  if (item.sourceType === 'Support') return 'support_troubleshooting_action'
  if (item.sourceType === 'Billing') return 'billing_review_action'
  if (item.sourceType === 'Health') return 'remediation_server_action'
  return 'agent_recommended_action'
}

function dueAtForActionRequest(request: AdminActionRequest, now: Date) {
  const baseDate = parseDate(request.updatedAt ?? request.createdAt, now)
  if (request.status === 'Blocked' || request.status === 'Failed') return baseDate.toISOString()
  if (request.status === 'Approved' || request.status === 'Running') return addHours(baseDate.toISOString(), 2)
  if (request.status === 'Queued') return addHours(baseDate.toISOString(), 8)
  return addHours(baseDate.toISOString(), 24)
}

function calculateMinutesLate(value: string, now: Date) {
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return 0
  return Math.max(0, Math.round((now.getTime() - due.getTime()) / 60000))
}

function parseDate(value: string, fallback: Date) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function addHours(value: string, hours: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

function statusWeight(status: CommandWorkStatus) {
  if (status === 'Open') return 0
  if (status === 'Claimed') return 1
  if (status === 'Follow-Up Queued') return 2
  if (status === 'Snoozed') return 3
  if (status === 'Done') return 4
  return 5
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function laneWeight(lane: CommandWorkLane) {
  if (lane === 'Owner Review') return 0
  if (lane === 'Approval') return 1
  if (lane === 'Action Handoff') return 2
  if (lane === 'Coverage') return 3
  return 4
}

function isCommandWorkLocalState(value: unknown): value is CommandWorkLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && ['Open', 'Claimed', 'Snoozed', 'Follow-Up Queued', 'Done', 'Dismissed'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
