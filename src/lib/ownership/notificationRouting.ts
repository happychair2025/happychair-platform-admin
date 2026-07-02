import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { InternalAdminUser } from '../mock-data/mockPlatform'
import type { AdminRole, PermissionKey } from '../permissions/permissions'
import type { OwnershipSourceType, OwnershipWorkItem } from './ownershipSla'

export type RoutingLane = 'Executive' | 'Support' | 'Engineering' | 'Finance' | 'Client Success' | 'Governance' | 'Agents'
export type RoutingCoverageStatus = 'Covered' | 'Backup Only' | 'Needs Backup' | 'Owner Invited' | 'No Active Owner'
export type RoutingPolicyStatus = 'Active' | 'Needs Review' | 'Local Override' | 'Paused'
export type RoutingDeliveryMode = 'Command Review' | 'Team Queue' | 'Action Request' | 'Owner Review'

export interface NotificationRoutingLocalState {
  routeId: string
  primaryUserId?: string
  backupUserId?: string
  status?: RoutingPolicyStatus
  note?: string
  updatedAt: string
}

export interface NotificationRouteDefinition {
  id: string
  name: string
  lane: RoutingLane
  description: string
  sourceTypes: OwnershipSourceType[]
  primaryRole: AdminRole
  backupRole: AdminRole
  deliveryMode: RoutingDeliveryMode
  escalationMinutes: number
  permission: PermissionKey
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  evidence: string[]
}

export interface NotificationRoutePolicy extends NotificationRouteDefinition {
  status: RoutingPolicyStatus
  coverageStatus: RoutingCoverageStatus
  primaryUser?: InternalAdminUser
  backupUser?: InternalAdminUser
  workload: number
  breached: number
  dueSoon: number
  critical: number
  nextDueAt?: string
  latestActivityAt?: string
  localState?: NotificationRoutingLocalState
  routedItems: OwnershipWorkItem[]
}

export interface NotificationRoutingSummary {
  total: number
  covered: number
  needsReview: number
  noActiveOwner: number
  needsBackup: number
  localOverrides: number
  workload: number
  breached: number
  critical: number
}

export interface BuildNotificationRoutingInput {
  workItems: OwnershipWorkItem[]
  users: InternalAdminUser[]
  localStates?: NotificationRoutingLocalState[]
}

const localStorageKey = 'hc_platform_notification_routing_state_v1'

export const notificationRoutingBoundaryRule =
  'Routing Center is an internal assignment and coverage map. Local routing changes are audit-recorded only; production alert delivery, staff routing, customer data, billing, modules, and permissions still require governed server-side handlers.'

export const notificationRouteDefinitions: NotificationRouteDefinition[] = [
  {
    id: 'owner-executive-escalations',
    name: 'Owner executive escalations',
    lane: 'Executive',
    description: 'Critical, breached, or owner-visible operating exceptions that should stay in the command review loop.',
    sourceTypes: ['Support', 'Billing', 'Health', 'Action Request'],
    primaryRole: 'owner',
    backupRole: 'admin',
    deliveryMode: 'Owner Review',
    escalationMinutes: 60,
    permission: 'dashboard.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Routes critical or breached items into owner review.',
      'Backup owner protects against single-person command dependency.',
      'Follow-ups still queue through Admin Action Requests.',
    ],
  },
  {
    id: 'support-escalation-routing',
    name: 'Support escalation routing',
    lane: 'Support',
    description: 'Support issues, notification delivery incidents, venue-impacting items, and remediation-safe follow-ups.',
    sourceTypes: ['Support'],
    primaryRole: 'support_lead',
    backupRole: 'admin',
    deliveryMode: 'Team Queue',
    escalationMinutes: 120,
    permission: 'support.view',
    followUpPermission: 'support.manage',
    followUpActionType: 'support_troubleshooting_action',
    evidence: [
      'Support lead owns venue-impacting exceptions.',
      'Admin backup is required for escalation and coverage.',
      'Customer-facing changes remain behind support action handlers.',
    ],
  },
  {
    id: 'engineering-platform-routing',
    name: 'Engineering platform routing',
    lane: 'Engineering',
    description: 'Platform health, remediation, server handler, and system-impacting exceptions.',
    sourceTypes: ['Health'],
    primaryRole: 'engineering',
    backupRole: 'admin',
    deliveryMode: 'Team Queue',
    escalationMinutes: 90,
    permission: 'health.view',
    followUpPermission: 'troubleshooting.run',
    followUpActionType: 'remediation_server_action',
    evidence: [
      'Engineering owns platform-health exceptions.',
      'Backup admin keeps visibility when engineering is unavailable.',
      'Remediation must use server-side runbook handlers.',
    ],
  },
  {
    id: 'finance-risk-routing',
    name: 'Finance risk routing',
    lane: 'Finance',
    description: 'Billing risk, failed payment, past-due, credit, discount, and revenue leakage exceptions.',
    sourceTypes: ['Billing'],
    primaryRole: 'finance',
    backupRole: 'owner',
    deliveryMode: 'Command Review',
    escalationMinutes: 240,
    permission: 'revenue.view',
    followUpPermission: 'billing.manage',
    followUpActionType: 'billing_review_action',
    evidence: [
      'Finance owns billing-sensitive review.',
      'Owner backup is required when finance is invited or unavailable.',
      'Billing-affecting actions require finance-governed handlers.',
    ],
  },
  {
    id: 'client-success-adoption-routing',
    name: 'Client success adoption routing',
    lane: 'Client Success',
    description: 'Usage gaps, adoption drift, expansion readiness, and customer-success follow-up signals.',
    sourceTypes: ['Usage'],
    primaryRole: 'client_success',
    backupRole: 'admin',
    deliveryMode: 'Team Queue',
    escalationMinutes: 1440,
    permission: 'clients.view',
    followUpPermission: 'clients.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Client Success owns adoption and expansion follow-up.',
      'Admin backup catches uncovered usage risk.',
      'Client state changes remain governed follow-ups.',
    ],
  },
  {
    id: 'admin-action-governance-routing',
    name: 'Admin action governance routing',
    lane: 'Governance',
    description: 'Blocked, failed, approved, queued, and running Admin Action Requests that need human decisioning.',
    sourceTypes: ['Action Request'],
    primaryRole: 'admin',
    backupRole: 'owner',
    deliveryMode: 'Action Request',
    escalationMinutes: 120,
    permission: 'admin_actions.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Admin owns mutation-path governance.',
      'Owner backup is required for sensitive or blocked action requests.',
      'The browser never bypasses server handlers.',
    ],
  },
  {
    id: 'agent-review-routing',
    name: 'Agent review routing',
    lane: 'Agents',
    description: 'Agent recommendations, queued review events, and automation findings waiting for human confirmation.',
    sourceTypes: ['Agent'],
    primaryRole: 'admin',
    backupRole: 'owner',
    deliveryMode: 'Command Review',
    escalationMinutes: 1440,
    permission: 'agents.view',
    followUpPermission: 'agents.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Agent outputs remain recommendations until confirmed by a human.',
      'Admin owns triage; owner backs up sensitive automation decisions.',
      'Agent-driven changes must create auditable action requests.',
    ],
  },
]

export function buildNotificationRoutingCenter(input: BuildNotificationRoutingInput): NotificationRoutePolicy[] {
  const localStateByRouteId = new Map((input.localStates ?? []).map(state => [state.routeId, state]))

  return notificationRouteDefinitions
    .map(route => buildRoutePolicy(route, input.workItems, input.users, localStateByRouteId.get(route.id)))
    .sort(sortRoutePolicies)
}

export function summarizeNotificationRouting(routes: NotificationRoutePolicy[]): NotificationRoutingSummary {
  return {
    total: routes.length,
    covered: routes.filter(route => route.coverageStatus === 'Covered').length,
    needsReview: routes.filter(route => route.status === 'Needs Review' || route.coverageStatus !== 'Covered').length,
    noActiveOwner: routes.filter(route => route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited').length,
    needsBackup: routes.filter(route => route.coverageStatus === 'Needs Backup' || route.coverageStatus === 'Backup Only').length,
    localOverrides: routes.filter(route => route.status === 'Local Override').length,
    workload: routes.reduce((total, route) => total + route.workload, 0),
    breached: routes.reduce((total, route) => total + route.breached, 0),
    critical: routes.reduce((total, route) => total + route.critical, 0),
  }
}

export function getRoutingCoverageTone(status: RoutingCoverageStatus) {
  if (status === 'No Active Owner' || status === 'Owner Invited') return 'danger' as const
  if (status === 'Needs Backup' || status === 'Backup Only') return 'warn' as const
  return 'ok' as const
}

export function getRoutingStatusTone(status: RoutingPolicyStatus) {
  if (status === 'Needs Review') return 'warn' as const
  if (status === 'Local Override') return 'info' as const
  if (status === 'Paused') return 'neutral' as const
  return 'ok' as const
}

export function getRoutingLaneTone(lane: RoutingLane) {
  if (lane === 'Executive' || lane === 'Finance') return 'warn' as const
  if (lane === 'Support' || lane === 'Engineering') return 'danger' as const
  if (lane === 'Client Success' || lane === 'Agents') return 'info' as const
  return 'neutral' as const
}

export function loadLocalNotificationRoutingStates(): NotificationRoutingLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isNotificationRoutingLocalState)
  } catch {
    return []
  }
}

export function saveLocalNotificationRoutingStates(states: NotificationRoutingLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 120)))
}

export function useLocalNotificationRoutingStates() {
  const [states, setStates] = useState<NotificationRoutingLocalState[]>(() => loadLocalNotificationRoutingStates())

  useEffect(() => {
    saveLocalNotificationRoutingStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildRoutePolicy(
  route: NotificationRouteDefinition,
  workItems: OwnershipWorkItem[],
  users: InternalAdminUser[],
  localState: NotificationRoutingLocalState | undefined,
): NotificationRoutePolicy {
  const routedItems = workItems.filter(item => route.sourceTypes.includes(item.sourceType))
  const activePrimary = pickUser(users, route.primaryRole, localState?.primaryUserId)
  const activeBackup = pickUser(users, route.backupRole, localState?.backupUserId)
  const primaryUser = localState?.primaryUserId
    ? users.find(user => user.id === localState.primaryUserId)
    : activePrimary
  const backupUser = localState?.backupUserId
    ? users.find(user => user.id === localState.backupUserId)
    : activeBackup
  const coverageStatus = getCoverageStatus(route, users, primaryUser, backupUser)
  const status = localState?.status
    ?? (coverageStatus === 'Covered' ? 'Active' : 'Needs Review')

  return {
    ...route,
    status,
    coverageStatus,
    primaryUser,
    backupUser,
    workload: routedItems.length,
    breached: routedItems.filter(item => item.slaStatus === 'Breached').length,
    dueSoon: routedItems.filter(item => item.slaStatus === 'Due Soon').length,
    critical: routedItems.filter(item => item.priority === 'Critical').length,
    nextDueAt: routedItems.map(item => item.dueAt).sort()[0],
    latestActivityAt: routedItems.map(item => item.createdAt).sort().reverse()[0],
    localState,
    routedItems,
  }
}

function pickUser(users: InternalAdminUser[], role: AdminRole, overrideUserId?: string) {
  if (overrideUserId) {
    const overrideUser = users.find(user => user.id === overrideUserId)
    if (overrideUser) return overrideUser
  }
  return users.find(user => user.role === role && user.status === 'Active')
    ?? users.find(user => user.role === role)
}

function getCoverageStatus(
  route: NotificationRouteDefinition,
  users: InternalAdminUser[],
  primaryUser: InternalAdminUser | undefined,
  backupUser: InternalAdminUser | undefined,
): RoutingCoverageStatus {
  const hasActivePrimary = primaryUser?.status === 'Active'
  const hasActiveBackup = backupUser?.status === 'Active'
  const hasInvitedPrimary = users.some(user => user.role === route.primaryRole && user.status === 'Invited')

  if (hasActivePrimary && hasActiveBackup) return 'Covered'
  if (hasActivePrimary) return 'Needs Backup'
  if (hasActiveBackup) return 'Backup Only'
  if (hasInvitedPrimary || primaryUser?.status === 'Invited') return 'Owner Invited'
  return 'No Active Owner'
}

function sortRoutePolicies(a: NotificationRoutePolicy, b: NotificationRoutePolicy) {
  return coverageWeight(a.coverageStatus) - coverageWeight(b.coverageStatus)
    || b.breached - a.breached
    || b.critical - a.critical
    || b.workload - a.workload
    || a.name.localeCompare(b.name)
}

function coverageWeight(status: RoutingCoverageStatus) {
  if (status === 'No Active Owner' || status === 'Owner Invited') return 0
  if (status === 'Backup Only' || status === 'Needs Backup') return 1
  return 2
}

function isNotificationRoutingLocalState(value: unknown): value is NotificationRoutingLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.routeId === 'string'
    && typeof record.updatedAt === 'string'
}
