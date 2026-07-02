import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { InternalAdminUser } from '../mock-data/mockPlatform'
import type { AdminRole, PermissionKey } from '../permissions/permissions'
import type { NotificationRoutePolicy, RoutingLane } from './notificationRouting'
import type { OwnershipWorkItem } from './ownershipSla'

export type OnCallFrequency = 'Daily' | 'Weekdays'
export type OnCallShiftStatus = 'Active' | 'Upcoming' | 'Ended' | 'Coverage Gap' | 'Backup Only' | 'Paused'
export type OnCallHandoffStatus = 'Ready' | 'Due Soon' | 'Overdue' | 'No Backup' | 'No Active Owner'
export type OnCallLocalStatus = 'Active' | 'Paused' | 'Local Override' | 'Acknowledged'

export interface OnCallScheduleLocalState {
  shiftId: string
  primaryUserId?: string
  backupUserId?: string
  status?: OnCallLocalStatus
  acknowledgedAt?: string
  note?: string
  updatedAt: string
}

export interface OnCallShiftDefinition {
  id: string
  routeId: string
  name: string
  lane: RoutingLane
  frequency: OnCallFrequency
  startHour: number
  durationHours: number
  primaryRole: AdminRole
  backupRole: AdminRole
  permission: PermissionKey
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  evidence: string[]
}

export interface OnCallShift extends OnCallShiftDefinition {
  route?: NotificationRoutePolicy
  primaryUser?: InternalAdminUser
  backupUser?: InternalAdminUser
  status: OnCallShiftStatus
  handoffStatus: OnCallHandoffStatus
  startsAt: string
  endsAt: string
  minutesUntilStart: number
  minutesUntilEnd: number
  minutesUntilHandoff: number
  activeWorkload: number
  breached: number
  critical: number
  localState?: OnCallScheduleLocalState
  coverageNote: string
  routedItems: OwnershipWorkItem[]
}

export interface OnCallScheduleSummary {
  total: number
  active: number
  upcoming: number
  gaps: number
  backupGaps: number
  handoffsDue: number
  localOverrides: number
  activeWorkload: number
  critical: number
  nextHandoffAt?: string
}

export interface BuildOnCallScheduleInput {
  routes: NotificationRoutePolicy[]
  users: InternalAdminUser[]
  localStates?: OnCallScheduleLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_on_call_schedule_state_v1'

export const onCallScheduleBoundaryRule =
  'On-Call Schedule coordinates internal coverage windows and handoffs. Local changes are audit-recorded only; production alert delivery, staff routing, customer data, billing, modules, and permissions still require governed server-side handlers.'

export const onCallShiftDefinitions: OnCallShiftDefinition[] = [
  {
    id: 'owner-command-business-hours',
    routeId: 'owner-executive-escalations',
    name: 'Owner command coverage',
    lane: 'Executive',
    frequency: 'Daily',
    startHour: 8,
    durationHours: 12,
    primaryRole: 'owner',
    backupRole: 'admin',
    permission: 'dashboard.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Owner command window covers critical executive decisions.',
      'Admin backup must be active before handoff is considered ready.',
      'After-hours issues remain visible through SLA and Action Request queues.',
    ],
  },
  {
    id: 'support-day-watch',
    routeId: 'support-escalation-routing',
    name: 'Support day watch',
    lane: 'Support',
    frequency: 'Daily',
    startHour: 8,
    durationHours: 10,
    primaryRole: 'support_lead',
    backupRole: 'admin',
    permission: 'support.view',
    followUpPermission: 'support.manage',
    followUpActionType: 'support_troubleshooting_action',
    evidence: [
      'Support day watch covers venue-impacting issues.',
      'Backup admin protects incident review when support lead is unavailable.',
      'Support-safe production actions still require governed handlers.',
    ],
  },
  {
    id: 'support-after-hours-watch',
    routeId: 'support-escalation-routing',
    name: 'Support after-hours watch',
    lane: 'Support',
    frequency: 'Daily',
    startHour: 18,
    durationHours: 14,
    primaryRole: 'support_lead',
    backupRole: 'owner',
    permission: 'support.view',
    followUpPermission: 'support.manage',
    followUpActionType: 'support_troubleshooting_action',
    evidence: [
      'After-hours watch keeps customer-impacting support exceptions visible.',
      'Owner backup catches material escalation after business hours.',
      'No browser action changes customer support records directly.',
    ],
  },
  {
    id: 'engineering-platform-watch',
    routeId: 'engineering-platform-routing',
    name: 'Engineering platform watch',
    lane: 'Engineering',
    frequency: 'Daily',
    startHour: 9,
    durationHours: 10,
    primaryRole: 'engineering',
    backupRole: 'admin',
    permission: 'health.view',
    followUpPermission: 'troubleshooting.run',
    followUpActionType: 'remediation_server_action',
    evidence: [
      'Engineering watches platform health and remediation pressure.',
      'Admin backup keeps system-health incidents in command review.',
      'Remediation remains server-side with rollback metadata.',
    ],
  },
  {
    id: 'finance-risk-watch',
    routeId: 'finance-risk-routing',
    name: 'Finance risk watch',
    lane: 'Finance',
    frequency: 'Weekdays',
    startHour: 9,
    durationHours: 8,
    primaryRole: 'finance',
    backupRole: 'owner',
    permission: 'revenue.view',
    followUpPermission: 'billing.manage',
    followUpActionType: 'billing_review_action',
    evidence: [
      'Finance watches billing risk during weekday business hours.',
      'Owner backup covers finance invite gaps.',
      'Billing-affecting actions stay behind finance-governed handlers.',
    ],
  },
  {
    id: 'client-success-watch',
    routeId: 'client-success-adoption-routing',
    name: 'Client success watch',
    lane: 'Client Success',
    frequency: 'Weekdays',
    startHour: 9,
    durationHours: 8,
    primaryRole: 'client_success',
    backupRole: 'admin',
    permission: 'clients.view',
    followUpPermission: 'clients.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Client Success watches adoption and expansion follow-up windows.',
      'Admin backup protects coverage when client success is unavailable.',
      'Client state changes require governed follow-up approval.',
    ],
  },
  {
    id: 'admin-action-governance-watch',
    routeId: 'admin-action-governance-routing',
    name: 'Admin action governance watch',
    lane: 'Governance',
    frequency: 'Daily',
    startHour: 8,
    durationHours: 12,
    primaryRole: 'admin',
    backupRole: 'owner',
    permission: 'admin_actions.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Governance watch covers blocked, failed, approved, and running action requests.',
      'Owner backup is required for sensitive mutation-path decisions.',
      'The schedule never bypasses server action approval.',
    ],
  },
  {
    id: 'agent-review-watch',
    routeId: 'agent-review-routing',
    name: 'Agent review watch',
    lane: 'Agents',
    frequency: 'Daily',
    startHour: 10,
    durationHours: 8,
    primaryRole: 'admin',
    backupRole: 'owner',
    permission: 'agents.view',
    followUpPermission: 'agents.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Agent recommendations remain advisory until reviewed by a human.',
      'Admin owns the watch window; owner backs up sensitive automation findings.',
      'Agent-triggered production changes must enter Action Requests.',
    ],
  },
]

export function buildOnCallSchedule(input: BuildOnCallScheduleInput): OnCallShift[] {
  const now = input.now ?? new Date()
  const localStateByShiftId = new Map((input.localStates ?? []).map(state => [state.shiftId, state]))

  return onCallShiftDefinitions
    .map(definition => buildShift(definition, input.routes, input.users, localStateByShiftId.get(definition.id), now))
    .sort(sortOnCallShifts)
}

export function summarizeOnCallSchedule(shifts: OnCallShift[]): OnCallScheduleSummary {
  const nextHandoffAt = shifts
    .filter(shift => shift.status === 'Active' || shift.status === 'Upcoming')
    .map(shift => shift.endsAt)
    .sort()[0]

  return {
    total: shifts.length,
    active: shifts.filter(shift => shift.status === 'Active' || shift.status === 'Backup Only').length,
    upcoming: shifts.filter(shift => shift.status === 'Upcoming').length,
    gaps: shifts.filter(shift => shift.status === 'Coverage Gap').length,
    backupGaps: shifts.filter(shift => shift.handoffStatus === 'No Backup' || shift.status === 'Backup Only').length,
    handoffsDue: shifts.filter(shift => shift.handoffStatus === 'Due Soon' || shift.handoffStatus === 'Overdue').length,
    localOverrides: shifts.filter(shift => shift.localState?.status === 'Local Override').length,
    activeWorkload: shifts.reduce((total, shift) => total + shift.activeWorkload, 0),
    critical: shifts.reduce((total, shift) => total + shift.critical, 0),
    nextHandoffAt,
  }
}

export function getOnCallShiftTone(status: OnCallShiftStatus) {
  if (status === 'Coverage Gap') return 'danger' as const
  if (status === 'Backup Only') return 'warn' as const
  if (status === 'Active') return 'ok' as const
  if (status === 'Upcoming') return 'info' as const
  return 'neutral' as const
}

export function getOnCallHandoffTone(status: OnCallHandoffStatus) {
  if (status === 'No Active Owner' || status === 'Overdue') return 'danger' as const
  if (status === 'No Backup' || status === 'Due Soon') return 'warn' as const
  return 'ok' as const
}

export function loadLocalOnCallScheduleStates(): OnCallScheduleLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOnCallScheduleLocalState)
  } catch {
    return []
  }
}

export function saveLocalOnCallScheduleStates(states: OnCallScheduleLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 160)))
}

export function useLocalOnCallScheduleStates() {
  const [states, setStates] = useState<OnCallScheduleLocalState[]>(() => loadLocalOnCallScheduleStates())

  useEffect(() => {
    saveLocalOnCallScheduleStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildShift(
  definition: OnCallShiftDefinition,
  routes: NotificationRoutePolicy[],
  users: InternalAdminUser[],
  localState: OnCallScheduleLocalState | undefined,
  now: Date,
): OnCallShift {
  const route = routes.find(item => item.id === definition.routeId)
  const primaryUser = pickUser(users, localState?.primaryUserId, route?.primaryUser?.id, definition.primaryRole)
  const backupUser = pickUser(users, localState?.backupUserId, route?.backupUser?.id, definition.backupRole)
  const window = resolveWindow(definition, now)
  const hasActivePrimary = primaryUser?.status === 'Active'
  const hasActiveBackup = backupUser?.status === 'Active'
  const baseStatus = getShiftStatus(window.startsAt, window.endsAt, hasActivePrimary, hasActiveBackup, now)
  const status = localState?.status === 'Paused' ? 'Paused' : baseStatus
  const minutesUntilStart = Math.round((window.startsAt.getTime() - now.getTime()) / 60000)
  const minutesUntilEnd = Math.round((window.endsAt.getTime() - now.getTime()) / 60000)
  const minutesUntilHandoff = minutesUntilEnd
  const handoffStatus = getHandoffStatus(status, hasActivePrimary, hasActiveBackup, minutesUntilHandoff)
  const routedItems = route?.routedItems ?? []

  return {
    ...definition,
    route,
    primaryUser,
    backupUser,
    status,
    handoffStatus,
    startsAt: window.startsAt.toISOString(),
    endsAt: window.endsAt.toISOString(),
    minutesUntilStart,
    minutesUntilEnd,
    minutesUntilHandoff,
    activeWorkload: route?.workload ?? 0,
    breached: route?.breached ?? 0,
    critical: route?.critical ?? 0,
    localState,
    coverageNote: getCoverageNote(primaryUser, backupUser, status, handoffStatus),
    routedItems,
  }
}

function resolveWindow(definition: OnCallShiftDefinition, now: Date) {
  const today = startOfDay(now)
  const candidates = Array.from({ length: 10 }, (_, index) => index - 1).map(offset => {
    const startsAt = new Date(today.getTime())
    startsAt.setDate(today.getDate() + offset)
    startsAt.setHours(definition.startHour, 0, 0, 0)
    const endsAt = new Date(startsAt.getTime() + definition.durationHours * 60 * 60 * 1000)
    return { startsAt, endsAt }
  }).filter(window => isAllowedFrequency(definition.frequency, window.startsAt))

  return candidates.find(window => now >= window.startsAt && now <= window.endsAt)
    ?? candidates.find(window => window.startsAt > now)
    ?? candidates[0]
    ?? { startsAt: today, endsAt: new Date(today.getTime() + definition.durationHours * 60 * 60 * 1000) }
}

function getShiftStatus(
  startsAt: Date,
  endsAt: Date,
  hasActivePrimary: boolean,
  hasActiveBackup: boolean,
  now: Date,
): OnCallShiftStatus {
  if (!hasActivePrimary && !hasActiveBackup) return 'Coverage Gap'
  if (!hasActivePrimary && hasActiveBackup) return 'Backup Only'
  if (now < startsAt) return 'Upcoming'
  if (now > endsAt) return 'Ended'
  return 'Active'
}

function getHandoffStatus(
  status: OnCallShiftStatus,
  hasActivePrimary: boolean,
  hasActiveBackup: boolean,
  minutesUntilHandoff: number,
): OnCallHandoffStatus {
  if (!hasActivePrimary) return 'No Active Owner'
  if (!hasActiveBackup) return 'No Backup'
  if (status === 'Active' && minutesUntilHandoff < 0) return 'Overdue'
  if (status === 'Active' && minutesUntilHandoff <= 60) return 'Due Soon'
  return 'Ready'
}

function pickUser(
  users: InternalAdminUser[],
  localUserId: string | undefined,
  routeUserId: string | undefined,
  role: AdminRole,
) {
  const localUser = localUserId ? users.find(user => user.id === localUserId) : undefined
  if (localUser) return localUser
  const routeUser = routeUserId ? users.find(user => user.id === routeUserId) : undefined
  if (routeUser) return routeUser
  return users.find(user => user.role === role && user.status === 'Active')
    ?? users.find(user => user.role === role)
}

function getCoverageNote(
  primaryUser: InternalAdminUser | undefined,
  backupUser: InternalAdminUser | undefined,
  status: OnCallShiftStatus,
  handoffStatus: OnCallHandoffStatus,
) {
  if (status === 'Coverage Gap') return 'No active primary or backup user covers this window.'
  if (status === 'Backup Only') return `${backupUser?.name ?? 'Backup'} is covering because the primary owner is unavailable.`
  if (handoffStatus === 'No Backup') return `${primaryUser?.name ?? 'Primary'} is active, but backup coverage is missing.`
  if (handoffStatus === 'Due Soon') return `Handoff from ${primaryUser?.name ?? 'primary'} is due inside the next hour.`
  return `${primaryUser?.name ?? 'Primary'} is the scheduled owner with ${backupUser?.name ?? 'backup'} as backup.`
}

function sortOnCallShifts(a: OnCallShift, b: OnCallShift) {
  return shiftStatusWeight(a.status) - shiftStatusWeight(b.status)
    || handoffWeight(a.handoffStatus) - handoffWeight(b.handoffStatus)
    || b.breached - a.breached
    || b.critical - a.critical
    || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
}

function shiftStatusWeight(status: OnCallShiftStatus) {
  if (status === 'Coverage Gap') return 0
  if (status === 'Backup Only') return 1
  if (status === 'Active') return 2
  if (status === 'Upcoming') return 3
  if (status === 'Paused') return 4
  return 5
}

function handoffWeight(status: OnCallHandoffStatus) {
  if (status === 'No Active Owner' || status === 'Overdue') return 0
  if (status === 'No Backup' || status === 'Due Soon') return 1
  return 2
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function isAllowedFrequency(frequency: OnCallFrequency, startsAt: Date) {
  if (frequency === 'Daily') return true
  const day = startsAt.getDay()
  return day >= 1 && day <= 5
}

function isOnCallScheduleLocalState(value: unknown): value is OnCallScheduleLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.shiftId === 'string'
    && typeof record.updatedAt === 'string'
}
