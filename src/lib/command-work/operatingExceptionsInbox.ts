import { useEffect, useState } from 'react'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { ActionRequestGovernanceRecord, ActionRequestRiskLevel } from '../admin-actions/actionRequestGovernance'
import type { PermissionKey } from '../permissions/permissions'
import type {
  CommandHandoffTimelineItem,
  CommandHandoffTimelineTargetPage,
} from './commandHandoffTimeline'
import type { OwnerActionCalendarItem } from './ownerActionCalendar'

export type OperatingExceptionType =
  | 'Blocked Handoff'
  | 'Overdue Owner Action'
  | 'Approval Gap'
  | 'Audit Gap'
  | 'Critical Command'
  | 'Governance Blocker'
export type OperatingExceptionSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type OperatingExceptionStatus = 'Open' | 'Acknowledged' | 'Assigned' | 'Escalated' | 'Resolved' | 'Dismissed'
export type OperatingExceptionTargetPage =
  | CommandHandoffTimelineTargetPage
  | 'operating-exceptions'
  | 'exception-sla-policies'
  | 'owner-action-calendar'
  | 'command-handoff-timeline'
  | 'approval-center'
  | 'action-requests'
  | 'audit'

export interface OperatingExceptionLocalState {
  exceptionId: string
  status: OperatingExceptionStatus
  owner?: string
  note?: string
  acknowledgedAt?: string
  resolvedAt?: string
  updatedAt: string
}

export interface OperatingExceptionItem {
  id: string
  type: OperatingExceptionType
  title: string
  description: string
  owner: string
  scope: string
  severity: OperatingExceptionSeverity
  status: OperatingExceptionStatus
  sourceLabel: string
  targetPage: OperatingExceptionTargetPage
  targetPermission: PermissionKey
  detectedAt: string
  dueAt: string
  recommendedAction: string
  evidence: string[]
  rollbackNotes: string
  relatedRecordId: string
  linkedActionRequestId?: string
  linkedAuditEventId?: string
  localState?: OperatingExceptionLocalState
}

export interface OperatingExceptionsSummary {
  total: number
  open: number
  acknowledged: number
  assigned: number
  escalated: number
  resolved: number
  critical: number
  blocked: number
  overdue: number
  approvalGaps: number
  auditGaps: number
}

export interface BuildOperatingExceptionsInput {
  calendarItems: OwnerActionCalendarItem[]
  handoffItems: CommandHandoffTimelineItem[]
  actionRequests: AdminActionRequest[]
  governanceRecords: ActionRequestGovernanceRecord[]
  localStates?: OperatingExceptionLocalState[]
  now?: Date
}

interface ExceptionSourceItem {
  owner: string
  scope: string
  rollbackNotes: string
  relatedRecordId: string
  linkedActionRequestId?: string
  linkedAuditEventId?: string
}

const localStorageKey = 'hc_platform_operating_exceptions_state_v1'

export const operatingExceptionsBoundaryRule =
  'Operating Exceptions Inbox is an internal triage layer. It can record local acknowledgement, assignment, escalation, and resolution state, but it cannot approve, execute, or mutate production customer state from the browser.'

export function buildOperatingExceptions(input: BuildOperatingExceptionsInput): OperatingExceptionItem[] {
  const now = input.now ?? new Date()
  const localStateByExceptionId = new Map((input.localStates ?? []).map(state => [state.exceptionId, state]))
  return dedupeExceptions([
    ...input.handoffItems.flatMap(item => fromHandoffItem(item, now)),
    ...input.calendarItems.flatMap(item => fromCalendarItem(item, now)),
    ...input.governanceRecords.flatMap(record => fromGovernanceRecord(record, input.actionRequests)),
  ])
    .map(item => applyLocalState(item, localStateByExceptionId.get(item.id)))
    .sort(sortOperatingExceptions)
}

export function summarizeOperatingExceptions(items: OperatingExceptionItem[]): OperatingExceptionsSummary {
  const active = items.filter(item => item.status !== 'Dismissed')
  return {
    total: items.length,
    open: active.filter(item => item.status === 'Open').length,
    acknowledged: active.filter(item => item.status === 'Acknowledged').length,
    assigned: active.filter(item => item.status === 'Assigned').length,
    escalated: active.filter(item => item.status === 'Escalated').length,
    resolved: items.filter(item => item.status === 'Resolved').length,
    critical: active.filter(item => item.severity === 'Critical').length,
    blocked: active.filter(item => item.type === 'Blocked Handoff' || item.type === 'Governance Blocker').length,
    overdue: active.filter(item => item.type === 'Overdue Owner Action').length,
    approvalGaps: active.filter(item => item.type === 'Approval Gap').length,
    auditGaps: active.filter(item => item.type === 'Audit Gap').length,
  }
}

export function getOperatingExceptionSeverityTone(severity: OperatingExceptionSeverity) {
  if (severity === 'Critical') return 'danger' as const
  if (severity === 'High') return 'warn' as const
  if (severity === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function getOperatingExceptionStatusTone(status: OperatingExceptionStatus) {
  if (status === 'Open') return 'warn' as const
  if (status === 'Escalated') return 'danger' as const
  if (status === 'Acknowledged' || status === 'Assigned') return 'info' as const
  if (status === 'Resolved') return 'ok' as const
  return 'neutral' as const
}

export function getOperatingExceptionTypeTone(type: OperatingExceptionType) {
  if (type === 'Blocked Handoff' || type === 'Governance Blocker') return 'danger' as const
  if (type === 'Overdue Owner Action' || type === 'Approval Gap' || type === 'Audit Gap') return 'warn' as const
  if (type === 'Critical Command') return 'info' as const
  return 'neutral' as const
}

export function loadLocalOperatingExceptionStates(): OperatingExceptionLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOperatingExceptionLocalState)
  } catch {
    return []
  }
}

export function saveLocalOperatingExceptionStates(states: OperatingExceptionLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 240)))
}

export function useLocalOperatingExceptionStates() {
  const [states, setStates] = useState<OperatingExceptionLocalState[]>(() => loadLocalOperatingExceptionStates())

  useEffect(() => {
    saveLocalOperatingExceptionStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromHandoffItem(item: CommandHandoffTimelineItem, now: Date): OperatingExceptionItem[] {
  const exceptions: OperatingExceptionItem[] = []
  if (item.status === 'Blocked') {
    exceptions.push(createException({
      id: `exception-blocked-handoff-${item.id}`,
      type: 'Blocked Handoff',
      title: `Blocked handoff: ${item.title}`,
      description: `${item.currentStage} is blocked before execution handoff can safely proceed.`,
      item,
      severity: item.priority === 'Critical' ? 'Critical' : 'High',
      sourceLabel: 'Handoff Timeline',
      targetPage: 'command-handoff-timeline',
      targetPermission: 'dashboard.view',
      recommendedAction: 'Escalate blocker to the operating owner and verify the governed action request path.',
      dueAt: item.dueAt,
      evidence: [
        `Status: ${item.status}`,
        `Current stage: ${item.currentStage}`,
        `Completion: ${item.completion}%`,
      ],
    }))
  }

  if ((item.status === 'Needs Owner' || item.status === 'Owner Scheduled') && item.priority === 'Critical') {
    exceptions.push(createException({
      id: `exception-critical-command-${item.id}`,
      type: 'Critical Command',
      title: `Critical command needs closure: ${item.title}`,
      description: item.detail,
      item,
      severity: 'Critical',
      sourceLabel: 'Command Handoff',
      targetPage: 'command-handoff-timeline',
      targetPermission: 'dashboard.view',
      recommendedAction: item.recommendedAction,
      dueAt: item.dueAt,
      evidence: [
        `Priority: ${item.priority}`,
        `Owner: ${item.owner}`,
        `Stage: ${item.currentStage}`,
      ],
    }))
  }

  if (item.status === 'Approval Pending' || item.status === 'Follow-Up Queued') {
    exceptions.push(createException({
      id: `exception-approval-gap-${item.id}`,
      type: 'Approval Gap',
      title: `Approval gap: ${item.title}`,
      description: 'A governed follow-up exists or is needed, but the lifecycle has not reached handoff readiness.',
      item,
      severity: item.priority === 'Critical' ? 'Critical' : 'High',
      sourceLabel: 'Command Handoff',
      targetPage: item.linkedActionRequestId ? 'approval-center' : 'owner-action-calendar',
      targetPermission: item.linkedActionRequestId ? 'admin_actions.view' : 'dashboard.view',
      recommendedAction: 'Review approval readiness and assign the next human decision owner.',
      dueAt: item.dueAt,
      evidence: [
        `Action request: ${item.linkedActionRequestId ?? 'not queued'}`,
        `Handler: ${item.linkedHandlerKey ?? 'not linked'}`,
        `Completion: ${item.completion}%`,
      ],
    }))
  }

  if ((item.status === 'Ready For Handoff' || item.currentStage === 'Audit Trail') && !item.linkedAuditEventId && item.status !== 'Closed') {
    exceptions.push(createException({
      id: `exception-audit-gap-${item.id}`,
      type: 'Audit Gap',
      title: `Audit evidence missing: ${item.title}`,
      description: 'The lifecycle is near handoff or closure but does not have linked audit evidence.',
      item,
      severity: item.priority === 'Critical' ? 'High' : 'Medium',
      sourceLabel: 'Command Handoff',
      targetPage: 'command-handoff-timeline',
      targetPermission: 'dashboard.view',
      recommendedAction: 'Link the audit trail or close the loop after evidence is confirmed.',
      dueAt: item.dueAt,
      evidence: [
        `Audit event: ${item.linkedAuditEventId ?? 'not linked'}`,
        `Action request: ${item.linkedActionRequestId ?? 'not linked'}`,
        `Last event: ${formatShortDate(item.lastEventAt)}`,
      ],
    }))
  }

  if (new Date(item.dueAt).getTime() < now.getTime() && item.status !== 'Closed' && item.status !== 'Audit Linked') {
    exceptions.push(createException({
      id: `exception-overdue-handoff-${item.id}`,
      type: 'Overdue Owner Action',
      title: `Overdue command line: ${item.title}`,
      description: item.detail,
      item,
      severity: item.priority === 'Critical' ? 'Critical' : 'High',
      sourceLabel: 'Command Handoff',
      targetPage: 'owner-action-calendar',
      targetPermission: 'dashboard.view',
      recommendedAction: 'Pull the owner action into today’s operating review.',
      dueAt: item.dueAt,
      evidence: [
        `Due: ${formatShortDate(item.dueAt)}`,
        `Owner: ${item.owner}`,
        `Status: ${item.status}`,
      ],
    }))
  }

  return exceptions
}

function fromCalendarItem(item: OwnerActionCalendarItem, now: Date): OperatingExceptionItem[] {
  if (item.status === 'Done' || item.status === 'Skipped') return []
  if (item.window !== 'Overdue' && !(item.priority === 'Critical' && item.status === 'Open')) return []
  return [createException({
    id: `exception-calendar-${item.id}`,
    type: item.window === 'Overdue' ? 'Overdue Owner Action' : 'Critical Command',
    title: item.window === 'Overdue' ? `Overdue owner action: ${item.title}` : `Critical owner action open: ${item.title}`,
    description: item.detail,
    item,
    severity: item.priority === 'Critical' ? 'Critical' : 'High',
    sourceLabel: 'Owner Calendar',
    targetPage: 'owner-action-calendar',
    targetPermission: 'dashboard.view',
    recommendedAction: item.recommendedAction,
    dueAt: item.dueAt,
    evidence: [
      `Window: ${item.window}`,
      `Owner: ${item.owner}`,
      `${Math.abs(item.minutesUntilDue)} minutes ${item.minutesUntilDue < 0 ? 'late' : 'until due'}`,
    ],
    detectedAt: now.toISOString(),
  })]
}

function fromGovernanceRecord(
  record: ActionRequestGovernanceRecord,
  requests: AdminActionRequest[],
): OperatingExceptionItem[] {
  const request = requests.find(item => item.id === record.requestId)
  if (!request) return []
  if (record.readiness !== 'Blocked' && record.readiness !== 'Needs Approval') return []
  const type: OperatingExceptionType = record.readiness === 'Blocked' ? 'Governance Blocker' : 'Approval Gap'
  return [{
    id: `exception-governance-${record.requestId}`,
    type,
    title: `${type}: ${request.title}`,
    description: record.policyReason,
    owner: record.requiredApprovers.join(', '),
    scope: request.scope.label,
    severity: severityFromRisk(record.riskLevel),
    status: 'Open',
    sourceLabel: 'Approval Governance',
    targetPage: record.readiness === 'Blocked' ? 'action-requests' : 'approval-center',
    targetPermission: 'admin_actions.view',
    detectedAt: request.updatedAt ?? request.createdAt,
    dueAt: request.updatedAt ?? request.createdAt,
    recommendedAction: record.hardBlockers[0] ?? 'Review required approvers and complete human approval.',
    evidence: [
      `Readiness: ${record.readiness}`,
      `Risk: ${record.riskLevel}`,
      `${record.warningCount} warnings / ${record.passCount} passing checks`,
    ],
    rollbackNotes: request.rollbackNotes,
    relatedRecordId: record.requestId,
    linkedActionRequestId: record.requestId,
  }]
}

function createException(input: {
  id: string
  type: OperatingExceptionType
  title: string
  description: string
  item: ExceptionSourceItem
  severity: OperatingExceptionSeverity
  sourceLabel: string
  targetPage: OperatingExceptionTargetPage
  targetPermission: PermissionKey
  recommendedAction: string
  dueAt: string
  evidence: string[]
  detectedAt?: string
}): OperatingExceptionItem {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description,
    owner: input.item.owner,
    scope: input.item.scope,
    severity: input.severity,
    status: 'Open',
    sourceLabel: input.sourceLabel,
    targetPage: input.targetPage,
    targetPermission: input.targetPermission,
    detectedAt: input.detectedAt ?? input.dueAt,
    dueAt: input.dueAt,
    recommendedAction: input.recommendedAction,
    evidence: input.evidence,
    rollbackNotes: input.item.rollbackNotes,
    relatedRecordId: input.item.relatedRecordId,
    linkedActionRequestId: input.item.linkedActionRequestId,
    linkedAuditEventId: input.item.linkedAuditEventId,
  }
}

function applyLocalState(item: OperatingExceptionItem, localState: OperatingExceptionLocalState | undefined): OperatingExceptionItem {
  if (!localState) return item
  return {
    ...item,
    owner: localState.owner ?? item.owner,
    status: localState.status,
    localState,
  }
}

function dedupeExceptions(items: OperatingExceptionItem[]) {
  const byKey = new Map<string, OperatingExceptionItem>()
  items.forEach(item => {
    const key = `${item.type}:${item.relatedRecordId}`
    const existing = byKey.get(key)
    if (!existing || sortOperatingExceptions(item, existing) < 0) byKey.set(key, item)
  })
  return [...byKey.values()]
}

function sortOperatingExceptions(a: OperatingExceptionItem, b: OperatingExceptionItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || severityWeight(a.severity) - severityWeight(b.severity)
    || typeWeight(a.type) - typeWeight(b.type)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function statusWeight(status: OperatingExceptionStatus) {
  if (status === 'Open') return 0
  if (status === 'Escalated') return 1
  if (status === 'Assigned') return 2
  if (status === 'Acknowledged') return 3
  if (status === 'Resolved') return 4
  return 5
}

function severityWeight(severity: OperatingExceptionSeverity) {
  if (severity === 'Critical') return 0
  if (severity === 'High') return 1
  if (severity === 'Medium') return 2
  return 3
}

function typeWeight(type: OperatingExceptionType) {
  if (type === 'Blocked Handoff' || type === 'Governance Blocker') return 0
  if (type === 'Overdue Owner Action') return 1
  if (type === 'Approval Gap') return 2
  if (type === 'Audit Gap') return 3
  return 4
}

function severityFromRisk(risk: ActionRequestRiskLevel): OperatingExceptionSeverity {
  if (risk === 'Critical') return 'Critical'
  if (risk === 'High') return 'High'
  if (risk === 'Medium') return 'Medium'
  return 'Low'
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function isOperatingExceptionLocalState(value: unknown): value is OperatingExceptionLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.exceptionId === 'string'
    && ['Open', 'Acknowledged', 'Assigned', 'Escalated', 'Resolved', 'Dismissed'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
