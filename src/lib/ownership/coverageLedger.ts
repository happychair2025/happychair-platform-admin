import { useEffect, useState } from 'react'
import type { AdminActionRequest, AdminActionRequestType } from '../admin-actions/actionRequests'
import type { AuditEvent } from '../audit/auditLog'
import type { PermissionKey } from '../permissions/permissions'
import type { NotificationRoutePolicy, RoutingLane } from './notificationRouting'
import type { OnCallShift } from './onCallSchedule'
import type { OwnershipWorkItem } from './ownershipSla'

export type CoverageLedgerEntryType =
  | 'Handoff Due'
  | 'Coverage Gap'
  | 'Backup Missing'
  | 'Local Override'
  | 'Routed Work'
  | 'Action Queue'
  | 'Audit Event'

export type CoverageLedgerStatus = 'Open' | 'Reviewed' | 'Follow-Up Queued' | 'Dismissed'
export type CoverageLedgerSeverity = 'Critical' | 'Warning' | 'Notice'

export interface CoverageLedgerLocalState {
  entryId: string
  status: CoverageLedgerStatus
  note?: string
  reviewedAt?: string
  followUpRequestId?: string
  updatedAt: string
}

export interface CoverageLedgerEntry {
  id: string
  type: CoverageLedgerEntryType
  lane: RoutingLane
  severity: CoverageLedgerSeverity
  status: CoverageLedgerStatus
  title: string
  description: string
  owner: string
  backup?: string
  scope: string
  sourceLabel: string
  sourceStatus: string
  createdAt: string
  dueAt?: string
  nextAction: string
  evidence: string[]
  routeId?: string
  shiftId?: string
  workItemId?: string
  actionRequestId?: string
  auditEventId?: string
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  localState?: CoverageLedgerLocalState
}

export interface BuildCoverageLedgerInput {
  routes: NotificationRoutePolicy[]
  shifts: OnCallShift[]
  workItems: OwnershipWorkItem[]
  actionRequests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  localStates?: CoverageLedgerLocalState[]
}

export interface CoverageLedgerSummary {
  total: number
  open: number
  reviewed: number
  followUps: number
  dismissed: number
  critical: number
  handoffsDue: number
  coverageGaps: number
  backupMissing: number
}

const localStorageKey = 'hc_platform_coverage_ledger_state_v1'
const routingLanes: RoutingLane[] = ['Executive', 'Support', 'Engineering', 'Finance', 'Client Success', 'Governance', 'Agents']
const openActionStatuses = new Set(['Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export const coverageLedgerBoundaryRule =
  'Coverage Evidence Ledger records internal coverage posture and review evidence. It does not deliver alerts, mutate customer data, change billing, alter modules, or bypass server-side action handlers.'

export function buildCoverageLedger(input: BuildCoverageLedgerInput): CoverageLedgerEntry[] {
  const localStateByEntryId = new Map((input.localStates ?? []).map(state => [state.entryId, state]))
  const entries = [
    ...input.shifts.flatMap(shift => buildShiftEntries(shift)),
    ...input.routes.flatMap(route => buildRouteEntries(route)),
    ...input.workItems
      .filter(item => item.slaStatus === 'Breached' || item.slaStatus === 'Due Soon' || item.priority === 'Critical')
      .slice(0, 12)
      .map(item => buildWorkItemEntry(item)),
    ...input.actionRequests
      .filter(request => openActionStatuses.has(request.status))
      .slice(0, 12)
      .map(request => buildActionRequestEntry(request)),
    ...input.auditEvents
      .filter(isCoverageAuditEvent)
      .slice(0, 10)
      .map(event => buildAuditEventEntry(event)),
  ].map(entry => applyLocalState(entry, localStateByEntryId.get(entry.id)))

  return entries.sort(sortCoverageLedgerEntries)
}

export function summarizeCoverageLedger(entries: CoverageLedgerEntry[]): CoverageLedgerSummary {
  return {
    total: entries.length,
    open: entries.filter(entry => entry.status === 'Open').length,
    reviewed: entries.filter(entry => entry.status === 'Reviewed').length,
    followUps: entries.filter(entry => entry.status === 'Follow-Up Queued').length,
    dismissed: entries.filter(entry => entry.status === 'Dismissed').length,
    critical: entries.filter(entry => entry.severity === 'Critical' && entry.status !== 'Dismissed').length,
    handoffsDue: entries.filter(entry => entry.type === 'Handoff Due' && entry.status !== 'Dismissed').length,
    coverageGaps: entries.filter(entry => entry.type === 'Coverage Gap' && entry.status !== 'Dismissed').length,
    backupMissing: entries.filter(entry => entry.type === 'Backup Missing' && entry.status !== 'Dismissed').length,
  }
}

export function getCoverageLedgerSeverityTone(severity: CoverageLedgerSeverity) {
  if (severity === 'Critical') return 'danger' as const
  if (severity === 'Warning') return 'warn' as const
  return 'info' as const
}

export function getCoverageLedgerStatusTone(status: CoverageLedgerStatus) {
  if (status === 'Open') return 'warn' as const
  if (status === 'Follow-Up Queued') return 'info' as const
  if (status === 'Reviewed') return 'ok' as const
  return 'neutral' as const
}

export function getCoverageLedgerTypeTone(type: CoverageLedgerEntryType) {
  if (type === 'Coverage Gap' || type === 'Action Queue') return 'danger' as const
  if (type === 'Handoff Due' || type === 'Backup Missing') return 'warn' as const
  if (type === 'Local Override' || type === 'Audit Event') return 'info' as const
  return 'neutral' as const
}

export function loadLocalCoverageLedgerStates(): CoverageLedgerLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCoverageLedgerLocalState)
  } catch {
    return []
  }
}

export function saveLocalCoverageLedgerStates(states: CoverageLedgerLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 200)))
}

export function useLocalCoverageLedgerStates() {
  const [states, setStates] = useState<CoverageLedgerLocalState[]>(() => loadLocalCoverageLedgerStates())

  useEffect(() => {
    saveLocalCoverageLedgerStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildShiftEntries(shift: OnCallShift): CoverageLedgerEntry[] {
  const entries: CoverageLedgerEntry[] = []
  if (shift.status === 'Coverage Gap' || shift.handoffStatus === 'No Active Owner') {
    entries.push({
      id: `shift-gap-${shift.id}`,
      type: 'Coverage Gap',
      lane: shift.lane,
      severity: 'Critical',
      status: 'Open',
      title: `${shift.name} has no active primary owner`,
      description: shift.coverageNote,
      owner: shift.primaryUser?.name ?? 'Unassigned',
      backup: shift.backupUser?.name,
      scope: shift.name,
      sourceLabel: 'On-Call Schedule',
      sourceStatus: `${shift.status} / ${shift.handoffStatus}`,
      createdAt: shift.startsAt,
      dueAt: shift.endsAt,
      nextAction: 'Assign an active primary owner or queue an internal access follow-up before the handoff window closes.',
      evidence: [
        shift.coverageNote,
        `${shift.activeWorkload} routed items / ${shift.breached} breached / ${shift.critical} critical`,
        ...shift.evidence.slice(0, 2),
      ],
      routeId: shift.routeId,
      shiftId: shift.id,
      followUpPermission: 'admin_users.manage',
      followUpActionType: 'admin_user_change',
    })
  }

  if (shift.status === 'Backup Only' || shift.handoffStatus === 'No Backup') {
    entries.push({
      id: `shift-backup-${shift.id}`,
      type: 'Backup Missing',
      lane: shift.lane,
      severity: 'Warning',
      status: 'Open',
      title: `${shift.name} backup coverage needs review`,
      description: shift.coverageNote,
      owner: shift.primaryUser?.name ?? 'Unassigned',
      backup: shift.backupUser?.name ?? 'Missing',
      scope: shift.name,
      sourceLabel: 'On-Call Schedule',
      sourceStatus: `${shift.status} / ${shift.handoffStatus}`,
      createdAt: shift.startsAt,
      dueAt: shift.endsAt,
      nextAction: 'Confirm a backup owner or queue a coverage correction before escalation load increases.',
      evidence: [
        shift.coverageNote,
        `${shift.activeWorkload} routed items are tied to this coverage window.`,
        ...shift.evidence.slice(0, 2),
      ],
      routeId: shift.routeId,
      shiftId: shift.id,
      followUpPermission: shift.followUpPermission,
      followUpActionType: shift.followUpActionType,
    })
  }

  if (shift.handoffStatus === 'Due Soon' || shift.handoffStatus === 'Overdue') {
    entries.push({
      id: `shift-handoff-${shift.id}`,
      type: 'Handoff Due',
      lane: shift.lane,
      severity: shift.handoffStatus === 'Overdue' ? 'Critical' : 'Warning',
      status: 'Open',
      title: `${shift.name} handoff is ${shift.handoffStatus.toLowerCase()}`,
      description: shift.coverageNote,
      owner: shift.primaryUser?.name ?? 'Unassigned',
      backup: shift.backupUser?.name,
      scope: shift.name,
      sourceLabel: 'On-Call Schedule',
      sourceStatus: shift.handoffStatus,
      createdAt: shift.startsAt,
      dueAt: shift.endsAt,
      nextAction: 'Record handoff review or queue a governed follow-up if coverage cannot be confirmed.',
      evidence: [
        `Handoff target: ${shift.endsAt}`,
        `${shift.activeWorkload} routed items / ${shift.critical} critical`,
        ...shift.evidence.slice(0, 2),
      ],
      routeId: shift.routeId,
      shiftId: shift.id,
      followUpPermission: shift.followUpPermission,
      followUpActionType: shift.followUpActionType,
    })
  }

  if (shift.localState) {
    entries.push({
      id: `shift-local-${shift.id}`,
      type: 'Local Override',
      lane: shift.lane,
      severity: shift.localState.status === 'Paused' || shift.localState.status === 'Local Override' ? 'Warning' : 'Notice',
      status: 'Open',
      title: `${shift.name} has local schedule evidence`,
      description: shift.localState.note ?? 'Local on-call coverage state was recorded in this browser.',
      owner: shift.primaryUser?.name ?? 'Unassigned',
      backup: shift.backupUser?.name,
      scope: shift.name,
      sourceLabel: 'On-Call Schedule',
      sourceStatus: shift.localState.status ?? 'Local Override',
      createdAt: shift.localState.updatedAt,
      dueAt: shift.endsAt,
      nextAction: 'Review local schedule evidence and decide whether it needs a governed server follow-up.',
      evidence: [
        `Local status: ${shift.localState.status}`,
        shift.localState.note ?? 'No local note captured.',
        `Updated ${shift.localState.updatedAt}`,
      ],
      routeId: shift.routeId,
      shiftId: shift.id,
      followUpPermission: shift.followUpPermission,
      followUpActionType: shift.followUpActionType,
    })
  }

  return entries
}

function buildRouteEntries(route: NotificationRoutePolicy): CoverageLedgerEntry[] {
  const entries: CoverageLedgerEntry[] = []
  if (route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited') {
    entries.push({
      id: `route-gap-${route.id}`,
      type: 'Coverage Gap',
      lane: route.lane,
      severity: 'Critical',
      status: 'Open',
      title: `${route.name} needs an active owner`,
      description: route.description,
      owner: route.primaryUser?.name ?? 'Unassigned',
      backup: route.backupUser?.name,
      scope: route.name,
      sourceLabel: 'Routing Center',
      sourceStatus: route.coverageStatus,
      createdAt: route.latestActivityAt ?? new Date().toISOString(),
      dueAt: route.nextDueAt,
      nextAction: 'Assign an active owner or queue an internal admin follow-up for this routing lane.',
      evidence: [
        `${route.workload} routed work items / ${route.breached} breached / ${route.critical} critical`,
        ...route.evidence.slice(0, 2),
      ],
      routeId: route.id,
      followUpPermission: 'admin_users.manage',
      followUpActionType: 'admin_user_change',
    })
  }

  if (route.coverageStatus === 'Needs Backup' || route.coverageStatus === 'Backup Only') {
    entries.push({
      id: `route-backup-${route.id}`,
      type: 'Backup Missing',
      lane: route.lane,
      severity: 'Warning',
      status: 'Open',
      title: `${route.name} backup coverage is incomplete`,
      description: route.description,
      owner: route.primaryUser?.name ?? 'Unassigned',
      backup: route.backupUser?.name ?? 'Missing',
      scope: route.name,
      sourceLabel: 'Routing Center',
      sourceStatus: route.coverageStatus,
      createdAt: route.latestActivityAt ?? new Date().toISOString(),
      dueAt: route.nextDueAt,
      nextAction: 'Confirm backup coverage so escalations do not depend on one person.',
      evidence: [
        `${route.workload} routed work items / ${route.dueSoon} due soon`,
        ...route.evidence.slice(0, 2),
      ],
      routeId: route.id,
      followUpPermission: route.followUpPermission,
      followUpActionType: route.followUpActionType,
    })
  }

  if (route.status === 'Local Override' || route.localState) {
    entries.push({
      id: `route-local-${route.id}`,
      type: 'Local Override',
      lane: route.lane,
      severity: route.status === 'Local Override' ? 'Warning' : 'Notice',
      status: 'Open',
      title: `${route.name} has local routing evidence`,
      description: route.localState?.note ?? route.description,
      owner: route.primaryUser?.name ?? 'Unassigned',
      backup: route.backupUser?.name,
      scope: route.name,
      sourceLabel: 'Routing Center',
      sourceStatus: route.status,
      createdAt: route.localState?.updatedAt ?? route.latestActivityAt ?? new Date().toISOString(),
      dueAt: route.nextDueAt,
      nextAction: 'Review the local routing assignment and queue a governed follow-up if it should become production state.',
      evidence: [
        `Local status: ${route.status}`,
        route.localState?.note ?? 'No local note captured.',
        `${route.workload} routed work items`,
      ],
      routeId: route.id,
      followUpPermission: route.followUpPermission,
      followUpActionType: route.followUpActionType,
    })
  }

  if (route.breached > 0 || route.dueSoon > 0 || route.critical > 0) {
    entries.push({
      id: `route-work-${route.id}`,
      type: 'Routed Work',
      lane: route.lane,
      severity: route.critical > 0 || route.breached > 0 ? 'Critical' : 'Warning',
      status: 'Open',
      title: `${route.name} has active routed workload`,
      description: route.description,
      owner: route.primaryUser?.name ?? 'Unassigned',
      backup: route.backupUser?.name,
      scope: route.name,
      sourceLabel: 'Ownership SLA',
      sourceStatus: `${route.breached} breached / ${route.dueSoon} due soon`,
      createdAt: route.latestActivityAt ?? new Date().toISOString(),
      dueAt: route.nextDueAt,
      nextAction: 'Review the routed SLA items and confirm whether the lane owner needs a follow-up request.',
      evidence: [
        `${route.workload} active items`,
        `${route.breached} breached / ${route.dueSoon} due soon / ${route.critical} critical`,
        ...route.routedItems.slice(0, 2).map(item => `${item.title}: ${item.slaStatus}`),
      ],
      routeId: route.id,
      followUpPermission: route.followUpPermission,
      followUpActionType: route.followUpActionType,
    })
  }

  return entries
}

function buildWorkItemEntry(item: OwnershipWorkItem): CoverageLedgerEntry {
  return {
    id: `work-${item.id}`,
    type: 'Routed Work',
    lane: laneFromWorkItem(item),
    severity: item.priority === 'Critical' || item.slaStatus === 'Breached' ? 'Critical' : 'Warning',
    status: 'Open',
    title: item.title,
    description: item.nextAction,
    owner: item.owner,
    scope: item.scope,
    sourceLabel: item.sourceType,
    sourceStatus: `${item.priority} / ${item.slaStatus}`,
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    nextAction: item.nextAction,
    evidence: item.evidence,
    workItemId: item.id,
    actionRequestId: item.actionRequestId,
    followUpPermission: permissionFromWorkItem(item),
    followUpActionType: actionTypeFromWorkItem(item),
  }
}

function buildActionRequestEntry(request: AdminActionRequest): CoverageLedgerEntry {
  const isCritical = request.status === 'Blocked' || request.status === 'Failed'
  return {
    id: `action-${request.id}`,
    type: 'Action Queue',
    lane: 'Governance',
    severity: isCritical ? 'Critical' : 'Warning',
    status: 'Open',
    title: request.title,
    description: request.reason,
    owner: request.requestedBy.role,
    scope: request.scope.label,
    sourceLabel: 'Action Requests',
    sourceStatus: request.status,
    createdAt: request.updatedAt ?? request.createdAt,
    nextAction: request.rollbackNotes,
    evidence: [
      `Permission required: ${request.permissionRequired}`,
      `Handler: ${request.serverHandler.key}`,
      request.statusReason ?? 'Awaiting governed server-side handling.',
    ],
    actionRequestId: request.id,
    followUpPermission: request.permissionRequired,
    followUpActionType: request.actionType,
  }
}

function buildAuditEventEntry(event: AuditEvent): CoverageLedgerEntry {
  const metadataLane = typeof event.metadata?.lane === 'string' ? event.metadata.lane : undefined
  const lane = routingLanes.includes(metadataLane as RoutingLane) ? metadataLane as RoutingLane : 'Governance'
  return {
    id: `audit-${event.id}`,
    type: 'Audit Event',
    lane,
    severity: event.severity === 'critical' ? 'Critical' : event.severity === 'warning' ? 'Warning' : 'Notice',
    status: 'Open',
    title: event.actionLabel,
    description: `${event.actor} recorded ${event.actionKey}.`,
    owner: event.actorRole,
    scope: event.scope,
    sourceLabel: 'Audit Logs',
    sourceStatus: event.outcome ?? 'recorded',
    createdAt: event.createdAt,
    nextAction: 'Review whether this audit event closes the coverage item or needs an Action Request follow-up.',
    evidence: [
      `Actor: ${event.actor}`,
      `Action: ${event.actionKey}`,
      `Persistence: ${event.persistenceStatus ?? 'local_or_mock'}`,
    ],
    auditEventId: event.id,
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
  }
}

function applyLocalState(entry: CoverageLedgerEntry, localState: CoverageLedgerLocalState | undefined): CoverageLedgerEntry {
  if (!localState) return entry
  return {
    ...entry,
    status: localState.status,
    localState,
  }
}

function isCoverageAuditEvent(event: AuditEvent) {
  if (event.severity === 'critical' || event.severity === 'warning') return true
  return [
    'coverage',
    'on_call',
    'notification_routing',
    'admin_action_request',
    'handoff',
  ].some(token => event.actionKey.includes(token))
}

function laneFromWorkItem(item: OwnershipWorkItem): RoutingLane {
  if (item.sourceType === 'Support') return 'Support'
  if (item.sourceType === 'Billing') return 'Finance'
  if (item.sourceType === 'Usage') return 'Client Success'
  if (item.sourceType === 'Health') return 'Engineering'
  if (item.sourceType === 'Agent') return 'Agents'
  return 'Governance'
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

function sortCoverageLedgerEntries(a: CoverageLedgerEntry, b: CoverageLedgerEntry) {
  return statusWeight(a.status) - statusWeight(b.status)
    || severityWeight(b.severity) - severityWeight(a.severity)
    || typeWeight(a.type) - typeWeight(b.type)
    || new Date(a.dueAt ?? a.createdAt).getTime() - new Date(b.dueAt ?? b.createdAt).getTime()
}

function statusWeight(status: CoverageLedgerStatus) {
  if (status === 'Open') return 0
  if (status === 'Follow-Up Queued') return 1
  if (status === 'Reviewed') return 2
  return 3
}

function severityWeight(severity: CoverageLedgerSeverity) {
  if (severity === 'Critical') return 3
  if (severity === 'Warning') return 2
  return 1
}

function typeWeight(type: CoverageLedgerEntryType) {
  if (type === 'Coverage Gap') return 0
  if (type === 'Handoff Due') return 1
  if (type === 'Backup Missing') return 2
  if (type === 'Action Queue') return 3
  if (type === 'Routed Work') return 4
  if (type === 'Local Override') return 5
  return 6
}

function isCoverageLedgerLocalState(value: unknown): value is CoverageLedgerLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.entryId === 'string'
    && typeof record.status === 'string'
    && typeof record.updatedAt === 'string'
}
