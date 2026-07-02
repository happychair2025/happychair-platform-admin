import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandWorkPriority } from './commandWorkQueue'
import type {
  OperatorDailyBriefRecord,
  OperatorDailyFocusLane,
  OperatorDailyTargetPage,
  OperatorDailyBriefFocusItem,
} from './operatorDailyBrief'

export type OwnerActionCalendarStatus = 'Open' | 'Scheduled' | 'Confirmed' | 'Done' | 'Snoozed' | 'Skipped'
export type OwnerActionCalendarWindow = 'Overdue' | 'Today' | 'Tomorrow' | 'This Week' | 'Next Week' | 'Backlog'
export type OwnerActionCalendarTargetPage = OperatorDailyTargetPage | 'owner-action-calendar'

export interface OwnerActionCalendarLocalState {
  itemId: string
  status: OwnerActionCalendarStatus
  note?: string
  scheduledAt?: string
  snoozedUntil?: string
  followUpRequestId?: string
  updatedAt: string
}

export interface OwnerActionCalendarItem {
  id: string
  title: string
  detail: string
  owner: string
  scope: string
  lane: OperatorDailyFocusLane
  priority: CommandWorkPriority
  status: OwnerActionCalendarStatus
  window: OwnerActionCalendarWindow
  sourceLabel: string
  dueAt: string
  scheduledAt: string
  recommendedAction: string
  evidence: string[]
  targetPage: OwnerActionCalendarTargetPage
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  rollbackNotes: string
  handlerKey?: string
  relatedRecordId: string
  minutesUntilDue: number
  localState?: OwnerActionCalendarLocalState
}

export interface OwnerActionCalendarSummary {
  total: number
  open: number
  scheduled: number
  confirmed: number
  done: number
  overdue: number
  today: number
  owners: number
  critical: number
  followUps: number
}

export interface OwnerActionCalendarOwnerLoad {
  owner: string
  total: number
  today: number
  overdue: number
  critical: number
  nextAction: string
}

export interface BuildOwnerActionCalendarInput {
  brief: OperatorDailyBriefRecord
  localStates?: OwnerActionCalendarLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_owner_action_calendar_state_v1'

export const ownerActionCalendarBoundaryRule =
  'Owner Action Calendar schedules internal accountability for Platform Admin work. It can record local schedule, confirmation, and completion state, but production changes still require permissioned server-side handlers and audited action requests.'

export function buildOwnerActionCalendar(input: BuildOwnerActionCalendarInput): OwnerActionCalendarItem[] {
  const now = input.now ?? new Date()
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  return input.brief.focusItems
    .map(item => fromFocusItem(item, localStateByItemId.get(item.id), now))
    .sort(sortCalendarItems)
}

export function summarizeOwnerActionCalendar(items: OwnerActionCalendarItem[]): OwnerActionCalendarSummary {
  const active = items.filter(item => item.status !== 'Skipped')
  return {
    total: items.length,
    open: active.filter(item => item.status === 'Open').length,
    scheduled: active.filter(item => item.status === 'Scheduled').length,
    confirmed: active.filter(item => item.status === 'Confirmed').length,
    done: items.filter(item => item.status === 'Done').length,
    overdue: active.filter(item => item.window === 'Overdue').length,
    today: active.filter(item => item.window === 'Today').length,
    owners: new Set(active.map(item => item.owner)).size,
    critical: active.filter(item => item.priority === 'Critical').length,
    followUps: active.filter(item => item.localState?.followUpRequestId).length,
  }
}

export function summarizeOwnerLoads(items: OwnerActionCalendarItem[]): OwnerActionCalendarOwnerLoad[] {
  const active = items.filter(item => item.status !== 'Skipped' && item.status !== 'Done')
  const byOwner = new Map<string, OwnerActionCalendarItem[]>()
  active.forEach(item => {
    byOwner.set(item.owner, [...(byOwner.get(item.owner) ?? []), item])
  })
  return [...byOwner.entries()]
    .map(([owner, ownerItems]) => {
      const sorted = ownerItems.slice().sort(sortCalendarItems)
      return {
        owner,
        total: ownerItems.length,
        today: ownerItems.filter(item => item.window === 'Today').length,
        overdue: ownerItems.filter(item => item.window === 'Overdue').length,
        critical: ownerItems.filter(item => item.priority === 'Critical').length,
        nextAction: sorted[0]?.title ?? 'No active owner action',
      }
    })
    .sort((a, b) => b.overdue - a.overdue || b.critical - a.critical || b.today - a.today || b.total - a.total || a.owner.localeCompare(b.owner))
}

export function getOwnerActionCalendarStatusTone(status: OwnerActionCalendarStatus) {
  if (status === 'Open') return 'warn' as const
  if (status === 'Scheduled' || status === 'Confirmed') return 'info' as const
  if (status === 'Done') return 'ok' as const
  return 'neutral' as const
}

export function getOwnerActionCalendarWindowTone(window: OwnerActionCalendarWindow) {
  if (window === 'Overdue') return 'danger' as const
  if (window === 'Today') return 'warn' as const
  if (window === 'Tomorrow' || window === 'This Week') return 'info' as const
  return 'neutral' as const
}

export function loadLocalOwnerActionCalendarStates(): OwnerActionCalendarLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOwnerActionCalendarLocalState)
  } catch {
    return []
  }
}

export function saveLocalOwnerActionCalendarStates(states: OwnerActionCalendarLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 240)))
}

export function useLocalOwnerActionCalendarStates() {
  const [states, setStates] = useState<OwnerActionCalendarLocalState[]>(() => loadLocalOwnerActionCalendarStates())

  useEffect(() => {
    saveLocalOwnerActionCalendarStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromFocusItem(
  item: OperatorDailyBriefFocusItem,
  localState: OwnerActionCalendarLocalState | undefined,
  now: Date,
): OwnerActionCalendarItem {
  const scheduledAt = localState?.scheduledAt ?? defaultScheduleAt(item, now)
  const status = resolveStatus(localState, now)
  const minutesUntilDue = Math.round((new Date(item.dueAt).getTime() - now.getTime()) / 60000)

  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    owner: item.owner,
    scope: item.scope,
    lane: item.lane,
    priority: item.priority,
    status,
    window: getWindow(item.dueAt, scheduledAt, now),
    sourceLabel: item.sourceLabel,
    dueAt: item.dueAt,
    scheduledAt,
    recommendedAction: item.recommendedAction,
    evidence: item.evidence,
    targetPage: item.targetPage,
    followUpPermission: item.followUpPermission,
    followUpActionType: item.followUpActionType,
    rollbackNotes: item.rollbackNotes,
    handlerKey: item.handlerKey,
    relatedRecordId: item.relatedRecordId,
    minutesUntilDue,
    localState,
  }
}

function resolveStatus(
  localState: OwnerActionCalendarLocalState | undefined,
  now: Date,
): OwnerActionCalendarStatus {
  if (!localState) return 'Open'
  if (localState.status === 'Snoozed' && localState.snoozedUntil && new Date(localState.snoozedUntil).getTime() <= now.getTime()) {
    return 'Open'
  }
  return localState.status
}

function defaultScheduleAt(item: OperatorDailyBriefFocusItem, now: Date) {
  const due = new Date(item.dueAt)
  const base = Number.isNaN(due.getTime()) ? now : due
  if (base.getTime() <= now.getTime()) return now.toISOString()
  if (item.priority === 'Critical') return addHours(now, 1)
  if (item.priority === 'High') return addHours(now, 3)
  return base.toISOString()
}

function getWindow(dueAt: string, scheduledAt: string, now: Date): OwnerActionCalendarWindow {
  const due = new Date(dueAt)
  const scheduled = new Date(scheduledAt)
  const basis = Number.isNaN(due.getTime()) ? scheduled : due
  if (basis.getTime() < now.getTime()) return 'Overdue'
  const days = Math.floor((startOfDay(basis).getTime() - startOfDay(now).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 6) return 'This Week'
  if (days <= 13) return 'Next Week'
  return 'Backlog'
}

function sortCalendarItems(a: OwnerActionCalendarItem, b: OwnerActionCalendarItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || windowWeight(a.window) - windowWeight(b.window)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    || a.owner.localeCompare(b.owner)
}

function statusWeight(status: OwnerActionCalendarStatus) {
  if (status === 'Open') return 0
  if (status === 'Scheduled') return 1
  if (status === 'Confirmed') return 2
  if (status === 'Snoozed') return 3
  if (status === 'Done') return 4
  return 5
}

function windowWeight(window: OwnerActionCalendarWindow) {
  if (window === 'Overdue') return 0
  if (window === 'Today') return 1
  if (window === 'Tomorrow') return 2
  if (window === 'This Week') return 3
  if (window === 'Next Week') return 4
  return 5
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function isOwnerActionCalendarLocalState(value: unknown): value is OwnerActionCalendarLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && ['Open', 'Scheduled', 'Confirmed', 'Done', 'Snoozed', 'Skipped'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
