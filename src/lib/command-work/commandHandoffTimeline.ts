import { useEffect, useState } from 'react'
import type { AuditEvent } from '../audit/auditLog'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { ActionTimelineEvent } from '../admin-actions/actionTimeline'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandWorkPriority } from './commandWorkQueue'
import type {
  OwnerActionCalendarItem,
  OwnerActionCalendarTargetPage,
} from './ownerActionCalendar'

export type CommandHandoffTimelineStage = 'Signal' | 'Owner Action' | 'Approval' | 'Execution Handoff' | 'Audit Trail'
export type CommandHandoffTimelineStatus =
  | 'Needs Owner'
  | 'Owner Scheduled'
  | 'Owner Confirmed'
  | 'Follow-Up Queued'
  | 'Approval Pending'
  | 'Ready For Handoff'
  | 'Audit Linked'
  | 'Closed'
  | 'Blocked'
export type CommandHandoffMilestoneStatus = 'Complete' | 'Active' | 'Waiting' | 'Blocked'
export type CommandHandoffTimelineTargetPage =
  | OwnerActionCalendarTargetPage
  | 'command-handoff-timeline'
  | 'action-timeline'
  | 'execution-handoff'

export interface CommandHandoffTimelineLocalState {
  itemId: string
  status: CommandHandoffTimelineStatus
  note?: string
  auditEventId?: string
  handoffReadyAt?: string
  closedAt?: string
  updatedAt: string
}

export interface CommandHandoffTimelineMilestone {
  stage: CommandHandoffTimelineStage
  status: CommandHandoffMilestoneStatus
  label: string
  detail: string
  occurredAt?: string
}

export interface CommandHandoffTimelineItem {
  id: string
  title: string
  detail: string
  owner: string
  scope: string
  priority: CommandWorkPriority
  lane: OwnerActionCalendarItem['lane']
  status: CommandHandoffTimelineStatus
  currentStage: CommandHandoffTimelineStage
  completion: number
  targetPage: CommandHandoffTimelineTargetPage
  sourceLabel: string
  recommendedAction: string
  evidence: string[]
  dueAt: string
  lastEventAt: string
  linkedActionRequestId?: string
  linkedAuditEventId?: string
  linkedHandlerKey?: string
  followUpPermission: PermissionKey
  rollbackNotes: string
  milestones: CommandHandoffTimelineMilestone[]
  relatedRecordId: string
  localState?: CommandHandoffTimelineLocalState
}

export interface CommandHandoffTimelineSummary {
  total: number
  needsOwner: number
  approvalPending: number
  readyForHandoff: number
  auditLinked: number
  closed: number
  blocked: number
  avgCompletion: number
}

export interface BuildCommandHandoffTimelineInput {
  calendarItems: OwnerActionCalendarItem[]
  actionRequests: AdminActionRequest[]
  actionTimelineEvents: ActionTimelineEvent[]
  auditEvents: AuditEvent[]
  localStates?: CommandHandoffTimelineLocalState[]
}

const localStorageKey = 'hc_platform_command_handoff_timeline_state_v1'

export const commandHandoffTimelineBoundaryRule =
  'Command Handoff Timeline shows operating lifecycle and local handoff readiness only. It links signals, owner action, approvals, handoff review, and audit evidence; it does not approve, execute, or mutate production customer state.'

export function buildCommandHandoffTimeline(input: BuildCommandHandoffTimelineInput): CommandHandoffTimelineItem[] {
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  return input.calendarItems.map(item => {
    const linkedRequests = findLinkedRequests(item, input.actionRequests)
    const linkedRequestIds = new Set(linkedRequests.map(request => request.id))
    const linkedTimelineEvents = input.actionTimelineEvents.filter(event => {
      if (event.actionRequestId && linkedRequestIds.has(event.actionRequestId)) return true
      return event.auditEventId && isLinkedAuditEventId(item, event.auditEventId, input.auditEvents)
    })
    const linkedAuditEvents = input.auditEvents.filter(event => isLinkedAuditEvent(item, event, linkedRequestIds))
    return fromCalendarItem(
      item,
      linkedRequests,
      linkedTimelineEvents,
      linkedAuditEvents,
      localStateByItemId.get(item.id),
    )
  }).sort(sortTimelineItems)
}

export function summarizeCommandHandoffTimeline(items: CommandHandoffTimelineItem[]): CommandHandoffTimelineSummary {
  return {
    total: items.length,
    needsOwner: items.filter(item => item.status === 'Needs Owner').length,
    approvalPending: items.filter(item => item.status === 'Approval Pending' || item.status === 'Follow-Up Queued').length,
    readyForHandoff: items.filter(item => item.status === 'Ready For Handoff').length,
    auditLinked: items.filter(item => item.status === 'Audit Linked').length,
    closed: items.filter(item => item.status === 'Closed').length,
    blocked: items.filter(item => item.status === 'Blocked').length,
    avgCompletion: items.length
      ? Math.round(items.reduce((total, item) => total + item.completion, 0) / items.length)
      : 0,
  }
}

export function getCommandHandoffTimelineStatusTone(status: CommandHandoffTimelineStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Owner' || status === 'Approval Pending') return 'warn' as const
  if (status === 'Ready For Handoff' || status === 'Follow-Up Queued' || status === 'Owner Confirmed') return 'info' as const
  if (status === 'Audit Linked' || status === 'Closed') return 'ok' as const
  return 'neutral' as const
}

export function getCommandHandoffMilestoneTone(status: CommandHandoffMilestoneStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Active') return 'warn' as const
  if (status === 'Complete') return 'ok' as const
  return 'neutral' as const
}

export function loadLocalCommandHandoffTimelineStates(): CommandHandoffTimelineLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCommandHandoffTimelineLocalState)
  } catch {
    return []
  }
}

export function saveLocalCommandHandoffTimelineStates(states: CommandHandoffTimelineLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 240)))
}

export function useLocalCommandHandoffTimelineStates() {
  const [states, setStates] = useState<CommandHandoffTimelineLocalState[]>(() => loadLocalCommandHandoffTimelineStates())

  useEffect(() => {
    saveLocalCommandHandoffTimelineStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromCalendarItem(
  item: OwnerActionCalendarItem,
  linkedRequests: AdminActionRequest[],
  linkedTimelineEvents: ActionTimelineEvent[],
  linkedAuditEvents: AuditEvent[],
  localState: CommandHandoffTimelineLocalState | undefined,
): CommandHandoffTimelineItem {
  const latestRequest = linkedRequests.slice().sort(sortRequestsByUpdatedAt)[0]
  const latestTimelineEvent = linkedTimelineEvents.slice().sort(sortEventsByDate)[0]
  const latestAuditEvent = linkedAuditEvents.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const baseStatus = getTimelineStatus(item, linkedRequests, linkedTimelineEvents, linkedAuditEvents)
  const status = localState?.status ?? baseStatus
  const milestones = buildMilestones(item, linkedRequests, linkedTimelineEvents, linkedAuditEvents, localState, status)
  const currentStage = milestones.find(milestone => milestone.status === 'Active' || milestone.status === 'Blocked')?.stage
    ?? milestones.find(milestone => milestone.status === 'Waiting')?.stage
    ?? 'Audit Trail'
  const completeCount = milestones.filter(milestone => milestone.status === 'Complete').length

  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    lane: item.lane,
    status,
    currentStage,
    completion: Math.round((completeCount / milestones.length) * 100),
    targetPage: item.targetPage,
    sourceLabel: item.sourceLabel,
    recommendedAction: item.recommendedAction,
    evidence: item.evidence,
    dueAt: item.dueAt,
    lastEventAt: localState?.updatedAt ?? latestTimelineEvent?.occurredAt ?? latestAuditEvent?.createdAt ?? latestRequest?.updatedAt ?? latestRequest?.createdAt ?? item.scheduledAt,
    linkedActionRequestId: latestRequest?.id ?? item.localState?.followUpRequestId,
    linkedAuditEventId: localState?.auditEventId ?? latestTimelineEvent?.auditEventId ?? latestAuditEvent?.id,
    linkedHandlerKey: latestRequest?.serverHandler.key ?? item.handlerKey,
    followUpPermission: item.followUpPermission,
    rollbackNotes: item.rollbackNotes,
    milestones,
    relatedRecordId: item.relatedRecordId,
    localState,
  }
}

function buildMilestones(
  item: OwnerActionCalendarItem,
  linkedRequests: AdminActionRequest[],
  linkedTimelineEvents: ActionTimelineEvent[],
  linkedAuditEvents: AuditEvent[],
  localState: CommandHandoffTimelineLocalState | undefined,
  status: CommandHandoffTimelineStatus,
): CommandHandoffTimelineMilestone[] {
  const latestRequest = linkedRequests.slice().sort(sortRequestsByUpdatedAt)[0]
  const hasRequest = linkedRequests.length > 0 || Boolean(item.localState?.followUpRequestId)
  const approvalBlocked = linkedRequests.some(request => request.status === 'Blocked' || request.status === 'Failed')
  const handoffEvent = linkedTimelineEvents.find(event => event.eventType === 'Handoff' || event.eventType === 'Dry Run')
  const auditEvent = linkedAuditEvents[0]
  const ownerComplete = item.status === 'Confirmed' || item.status === 'Scheduled' || item.status === 'Done' || Boolean(item.localState?.followUpRequestId)
  const approvalComplete = linkedRequests.some(request => request.status === 'Approved' || request.status === 'Running' || request.status === 'Completed')
  const auditComplete = status === 'Audit Linked' || status === 'Closed' || item.status === 'Done' || Boolean(localState?.auditEventId) || linkedAuditEvents.length > 0
  const handoffComplete = status === 'Ready For Handoff' || status === 'Audit Linked' || status === 'Closed' || Boolean(handoffEvent) || linkedRequests.some(request => request.status === 'Running' || request.status === 'Completed')

  return [
    {
      stage: 'Signal',
      status: 'Complete',
      label: item.sourceLabel,
      detail: item.detail,
      occurredAt: item.dueAt,
    },
    {
      stage: 'Owner Action',
      status: ownerComplete ? 'Complete' : 'Active',
      label: item.owner,
      detail: item.status === 'Open' ? item.recommendedAction : `${item.status}: ${item.localState?.note ?? item.recommendedAction}`,
      occurredAt: item.localState?.updatedAt ?? item.scheduledAt,
    },
    {
      stage: 'Approval',
      status: approvalBlocked ? 'Blocked' : approvalComplete ? 'Complete' : hasRequest ? 'Active' : 'Waiting',
      label: latestRequest?.status ?? (hasRequest ? 'Queued follow-up' : 'No request queued'),
      detail: latestRequest?.reason ?? 'Governed follow-up must be queued before production-affecting execution.',
      occurredAt: latestRequest?.updatedAt ?? latestRequest?.createdAt,
    },
    {
      stage: 'Execution Handoff',
      status: approvalBlocked ? 'Blocked' : handoffComplete ? 'Complete' : approvalComplete ? 'Active' : 'Waiting',
      label: handoffEvent?.statusLabel ?? (approvalComplete ? 'Ready for packet review' : 'Waiting on approval'),
      detail: handoffEvent?.detail ?? 'Server-side handoff review, dry-run, and rollback readiness remain required.',
      occurredAt: localState?.handoffReadyAt ?? handoffEvent?.occurredAt,
    },
    {
      stage: 'Audit Trail',
      status: auditComplete ? 'Complete' : handoffComplete ? 'Active' : 'Waiting',
      label: localState?.auditEventId ?? auditEvent?.id ?? 'Audit evidence pending',
      detail: auditEvent?.actionLabel ?? localState?.note ?? 'Link final audit evidence before closing the loop.',
      occurredAt: localState?.closedAt ?? localState?.updatedAt ?? auditEvent?.createdAt,
    },
  ]
}

function getTimelineStatus(
  item: OwnerActionCalendarItem,
  linkedRequests: AdminActionRequest[],
  linkedTimelineEvents: ActionTimelineEvent[],
  linkedAuditEvents: AuditEvent[],
): CommandHandoffTimelineStatus {
  if (linkedRequests.some(request => request.status === 'Blocked' || request.status === 'Failed')) return 'Blocked'
  if (linkedTimelineEvents.some(event => event.statusLabel.toLowerCase().includes('blocked'))) return 'Blocked'
  if (item.status === 'Done') return 'Audit Linked'
  if (linkedAuditEvents.length) return 'Audit Linked'
  if (linkedTimelineEvents.some(event => event.eventType === 'Handoff' || event.eventType === 'Dry Run')) return 'Ready For Handoff'
  if (linkedRequests.some(request => request.status === 'Approved' || request.status === 'Running' || request.status === 'Completed')) return 'Ready For Handoff'
  if (linkedRequests.some(request => request.status === 'Queued' || request.status === 'Draft')) return 'Approval Pending'
  if (item.localState?.followUpRequestId) return 'Follow-Up Queued'
  if (item.status === 'Confirmed') return 'Owner Confirmed'
  if (item.status === 'Scheduled' || item.status === 'Snoozed') return 'Owner Scheduled'
  return 'Needs Owner'
}

function findLinkedRequests(item: OwnerActionCalendarItem, requests: AdminActionRequest[]) {
  return requests.filter(request => {
    if (getStringMetadata(request.metadata, 'ownerActionCalendarItemId') === item.id) return true
    if (getStringMetadata(request.metadata, 'operatorDailyFocusItemId') === item.id) return true
    if (getStringMetadata(request.metadata, 'relatedRecordId') === item.relatedRecordId) return true
    if (item.localState?.followUpRequestId && request.id === item.localState.followUpRequestId) return true
    return false
  })
}

function isLinkedAuditEvent(
  item: OwnerActionCalendarItem,
  event: AuditEvent,
  linkedRequestIds: Set<string>,
) {
  if (getStringMetadata(event.metadata, 'ownerActionCalendarItemId') === item.id) return true
  if (getStringMetadata(event.metadata, 'operatorDailyFocusItemId') === item.id) return true
  if (getStringMetadata(event.metadata, 'operatorDailyFocusItemId') === item.relatedRecordId) return true
  const actionRequestId = getStringMetadata(event.metadata, 'actionRequestId')
  if (actionRequestId && linkedRequestIds.has(actionRequestId)) return true
  return false
}

function isLinkedAuditEventId(item: OwnerActionCalendarItem, auditEventId: string, auditEvents: AuditEvent[]) {
  const event = auditEvents.find(auditEvent => auditEvent.id === auditEventId)
  return event ? isLinkedAuditEvent(item, event, new Set()) : false
}

function sortTimelineItems(a: CommandHandoffTimelineItem, b: CommandHandoffTimelineItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || a.completion - b.completion
    || new Date(a.lastEventAt).getTime() - new Date(b.lastEventAt).getTime()
}

function sortRequestsByUpdatedAt(a: AdminActionRequest, b: AdminActionRequest) {
  return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
}

function sortEventsByDate(a: ActionTimelineEvent, b: ActionTimelineEvent) {
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
}

function statusWeight(status: CommandHandoffTimelineStatus) {
  if (status === 'Blocked') return 0
  if (status === 'Needs Owner') return 1
  if (status === 'Owner Scheduled') return 2
  if (status === 'Owner Confirmed') return 3
  if (status === 'Follow-Up Queued') return 4
  if (status === 'Approval Pending') return 5
  if (status === 'Ready For Handoff') return 6
  if (status === 'Audit Linked') return 7
  return 8
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function getStringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : undefined
}

function isCommandHandoffTimelineLocalState(value: unknown): value is CommandHandoffTimelineLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && [
      'Needs Owner',
      'Owner Scheduled',
      'Owner Confirmed',
      'Follow-Up Queued',
      'Approval Pending',
      'Ready For Handoff',
      'Audit Linked',
      'Closed',
      'Blocked',
    ].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
