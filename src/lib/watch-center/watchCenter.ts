import { useEffect, useState } from 'react'
import type { AuditEvent } from '../audit/auditLog'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import { savedViewTemplates, type SavedViewDefinition } from '../saved-views/savedViews'
import type { PermissionKey } from '../permissions/permissions'

export type WatchSignalSource =
  | 'Support'
  | 'Billing'
  | 'Health'
  | 'Action Requests'
  | 'Audit'
  | 'Saved Views'
  | 'Usage'

export type WatchSignalPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type WatchSignalStatus = 'New' | 'Acknowledged' | 'Snoozed'
export type WatchSignalSensitivity = 'Standard' | 'Restricted'
export type WatchSignalOwner = 'Owner' | 'Admin Ops' | 'Support' | 'Engineering' | 'Finance' | 'Client Success' | 'Security'

export type WatchTargetPage =
  | 'attention'
  | 'support'
  | 'revenue'
  | 'health'
  | 'action-requests'
  | 'audit'
  | 'saved-views'
  | 'data-quality'
  | 'usage'

export interface WatchSignal {
  id: string
  title: string
  description: string
  source: WatchSignalSource
  priority: WatchSignalPriority
  status: WatchSignalStatus
  owner: WatchSignalOwner
  scope: string
  detectedAt: string
  dueAt: string
  permission: PermissionKey
  targetPage: WatchTargetPage
  sensitivity: WatchSignalSensitivity
  recommendedAction: string
  evidence: string[]
  sourceRecordId: string
  localNote?: string
  snoozedUntil?: string
}

export interface WatchSignalLocalState {
  signalId: string
  status: WatchSignalStatus
  note?: string
  snoozedUntil?: string
  updatedAt: string
}

export interface WatchCenterSummary {
  total: number
  critical: number
  high: number
  new: number
  acknowledged: number
  snoozed: number
  restricted: number
  overdue: number
}

export interface BuildWatchSignalsInput {
  data: PlatformAdminReadModel
  actionRequests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  savedViews?: SavedViewDefinition[]
  localStates?: WatchSignalLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_watch_center_state_v1'

export const watchCenterBoundaryRule =
  'Watch Center state is a local operating layer over read-only signals. Acknowledge and snooze actions record audit events but do not change customer data, billing, modules, support records, or production alert state.'

export function buildWatchSignals(input: BuildWatchSignalsInput): WatchSignal[] {
  const now = input.now ?? new Date()
  const localStateBySignalId = new Map((input.localStates ?? []).map(state => [state.signalId, state]))
  const signals: WatchSignal[] = [
    ...buildSupportSignals(input.data),
    ...buildBillingSignals(input.data),
    ...buildHealthSignals(input.data),
    ...buildActionRequestSignals(input.actionRequests),
    ...buildAuditSignals(input.auditEvents),
    ...buildSavedViewSignals(input.savedViews ?? savedViewTemplates),
    ...buildUsageSignals(input.data),
  ]

  return signals
    .map(signal => applyLocalState(signal, localStateBySignalId.get(signal.id), now))
    .sort(sortWatchSignals)
}

export function summarizeWatchSignals(signals: WatchSignal[], now = new Date()): WatchCenterSummary {
  return {
    total: signals.length,
    critical: signals.filter(signal => signal.priority === 'Critical').length,
    high: signals.filter(signal => signal.priority === 'High').length,
    new: signals.filter(signal => signal.status === 'New').length,
    acknowledged: signals.filter(signal => signal.status === 'Acknowledged').length,
    snoozed: signals.filter(signal => signal.status === 'Snoozed').length,
    restricted: signals.filter(signal => signal.sensitivity === 'Restricted').length,
    overdue: signals.filter(signal => new Date(signal.dueAt).getTime() < now.getTime() && signal.status !== 'Snoozed').length,
  }
}

export function getWatchPriorityTone(priority: WatchSignalPriority) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function getWatchStatusTone(status: WatchSignalStatus) {
  if (status === 'New') return 'warn' as const
  if (status === 'Acknowledged') return 'ok' as const
  return 'info' as const
}

export function getWatchSensitivityTone(sensitivity: WatchSignalSensitivity) {
  return sensitivity === 'Restricted' ? 'warn' as const : 'info' as const
}

export function getWatchSourceTone(source: WatchSignalSource) {
  if (source === 'Billing' || source === 'Support') return 'warn' as const
  if (source === 'Audit' || source === 'Action Requests') return 'danger' as const
  if (source === 'Health' || source === 'Usage') return 'info' as const
  return 'neutral' as const
}

export function loadLocalWatchSignalStates(): WatchSignalLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWatchSignalLocalState)
  } catch {
    return []
  }
}

export function saveLocalWatchSignalStates(states: WatchSignalLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 120)))
}

export function useLocalWatchSignalStates() {
  const [states, setStates] = useState<WatchSignalLocalState[]>(() => loadLocalWatchSignalStates())

  useEffect(() => {
    saveLocalWatchSignalStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildSupportSignals(data: PlatformAdminReadModel): WatchSignal[] {
  return data.supportIssues
    .filter(issue => issue.status !== 'Resolved')
    .filter(issue => issue.severity === 'critical' || issue.severity === 'warning')
    .map(issue => ({
      id: `support:${issue.id}`,
      title: `${issue.issueType} at ${issue.venueName}`,
      description: `${issue.organizationName} / ${issue.propertyName}`,
      source: 'Support' as const,
      priority: issue.severity === 'critical' ? 'Critical' as const : 'High' as const,
      status: 'New' as const,
      owner: issue.owner,
      scope: issue.venueName,
      detectedAt: issue.detectedAt,
      dueAt: addHours(issue.detectedAt, issue.severity === 'critical' ? 2 : 8),
      permission: 'support.view' as const,
      targetPage: 'support' as const,
      sensitivity: 'Standard' as const,
      recommendedAction: issue.recommendedAction,
      evidence: [
        `Status: ${issue.status}`,
        `Severity: ${issue.severity}`,
        `Related signal: ${issue.relatedSignal}`,
        `Affected users: ${issue.affectedUsers}`,
      ],
      sourceRecordId: issue.id,
    }))
}

function buildBillingSignals(data: PlatformAdminReadModel): WatchSignal[] {
  return data.billingRisks.map(risk => ({
    id: `billing:${risk.id}`,
    title: `${risk.billingStatus} / ${risk.organizationName}`,
    description: `$${risk.amountAtRisk.toLocaleString()} at risk against $${risk.mrr.toLocaleString()} MRR.`,
    source: 'Billing' as const,
    priority: risk.amountAtRisk >= 5000 || risk.billingStatus === 'Failed Payment' ? 'Critical' as const : 'High' as const,
    status: 'New' as const,
    owner: risk.owner,
    scope: risk.organizationName,
    detectedAt: risk.lastPaymentAttempt,
    dueAt: addHours(risk.lastPaymentAttempt, risk.billingStatus === 'Failed Payment' ? 24 : 72),
    permission: 'billing.view' as const,
    targetPage: 'revenue' as const,
    sensitivity: 'Restricted' as const,
    recommendedAction: risk.nextAction,
    evidence: [
      `Billing status: ${risk.billingStatus}`,
      `Amount at risk: $${risk.amountAtRisk.toLocaleString()}`,
      `MRR: $${risk.mrr.toLocaleString()}`,
      `Owner: ${risk.owner}`,
    ],
    sourceRecordId: risk.id,
  }))
}

function buildHealthSignals(data: PlatformAdminReadModel): WatchSignal[] {
  return data.platformHealthSignals
    .filter(signal => signal.status !== 'Passing')
    .map(signal => ({
      id: `health:${signal.id}`,
      title: signal.label,
      description: signal.message,
      source: 'Health' as const,
      priority: signal.severity === 'critical'
        ? 'Critical' as const
        : signal.severity === 'warning'
          ? 'High' as const
          : 'Medium' as const,
      status: 'New' as const,
      owner: signal.checkKey === 'database_sync' || signal.checkKey === 'api_errors' ? 'Engineering' as const : 'Support' as const,
      scope: `${signal.affectedClients} clients / ${signal.affectedVenues} venues`,
      detectedAt: signal.checkedAt,
      dueAt: addHours(signal.checkedAt, signal.severity === 'critical' ? 3 : 12),
      permission: 'health.view' as const,
      targetPage: 'health' as const,
      sensitivity: signal.severity === 'critical' ? 'Restricted' as const : 'Standard' as const,
      recommendedAction: signal.recommendedAction,
      evidence: [
        `Status: ${signal.status}`,
        `Probable cause: ${signal.probableCause}`,
        `Affected clients: ${signal.affectedClients}`,
        `Affected venues: ${signal.affectedVenues}`,
      ],
      sourceRecordId: signal.id,
    }))
}

function buildActionRequestSignals(requests: AdminActionRequest[]): WatchSignal[] {
  return requests
    .filter(request => ['Queued', 'Failed', 'Blocked', 'Running'].includes(request.status))
    .map(request => ({
      id: `action:${request.id}`,
      title: request.title,
      description: `${request.status} / ${request.actionType.replace(/_/g, ' ')}`,
      source: 'Action Requests' as const,
      priority: request.status === 'Failed' || request.status === 'Blocked' ? 'Critical' as const : 'High' as const,
      status: 'New' as const,
      owner: 'Admin Ops' as const,
      scope: request.scope.label,
      detectedAt: request.updatedAt ?? request.createdAt,
      dueAt: addHours(request.updatedAt ?? request.createdAt, request.status === 'Running' ? 2 : 24),
      permission: 'admin_actions.view' as const,
      targetPage: 'action-requests' as const,
      sensitivity: request.permissionRequired.includes('manage') ? 'Restricted' as const : 'Standard' as const,
      recommendedAction: request.status === 'Queued'
        ? 'Review approval, rollback notes, and server handler readiness.'
        : 'Review action request lineage and decide next operational step.',
      evidence: [
        `Status: ${request.status}`,
        `Permission: ${request.permissionRequired}`,
        `Requester: ${request.requestedBy.name}`,
        `Handler: ${request.serverHandler.label}`,
      ],
      sourceRecordId: request.id,
    }))
}

function buildAuditSignals(events: AuditEvent[]): WatchSignal[] {
  return events
    .filter(event => event.severity === 'critical' || event.outcome === 'blocked')
    .slice(0, 12)
    .map(event => ({
      id: `audit:${event.id}`,
      title: event.actionLabel,
      description: `${event.actor} / ${event.actorRole}`,
      source: 'Audit' as const,
      priority: event.severity === 'critical' ? 'Critical' as const : 'High' as const,
      status: 'New' as const,
      owner: 'Security' as const,
      scope: event.scope,
      detectedAt: event.createdAt,
      dueAt: addHours(event.createdAt, 48),
      permission: 'audit.view' as const,
      targetPage: 'audit' as const,
      sensitivity: 'Restricted' as const,
      recommendedAction: 'Review actor, permission, outcome, and source workflow before closing the watch item.',
      evidence: [
        `Action key: ${event.actionKey}`,
        `Outcome: ${event.outcome ?? 'recorded'}`,
        `Permission: ${event.permission ?? 'not specified'}`,
        `Persistence: ${event.persistenceStatus ?? 'unknown'}`,
      ],
      sourceRecordId: event.id,
    }))
}

function buildSavedViewSignals(views: SavedViewDefinition[]): WatchSignal[] {
  return views
    .filter(view => view.status === 'Needs Review')
    .map(view => ({
      id: `saved-view:${view.id}`,
      title: `${view.name} needs review`,
      description: `${view.targetLabel} / ${view.audience}`,
      source: 'Saved Views' as const,
      priority: view.sensitivity === 'Restricted' ? 'High' as const : 'Medium' as const,
      status: 'New' as const,
      owner: view.ownerRole === 'engineering' ? 'Engineering' as const : 'Admin Ops' as const,
      scope: view.targetLabel,
      detectedAt: view.lastUsedAt,
      dueAt: addHours(view.lastUsedAt, 72),
      permission: 'saved_views.view' as const,
      targetPage: 'saved-views' as const,
      sensitivity: view.sensitivity === 'Restricted' ? 'Restricted' as const : 'Standard' as const,
      recommendedAction: 'Review filters, sensitivity, target permission, and audience before promoting this saved view.',
      evidence: [
        `Audience: ${view.audience}`,
        `Filters: ${view.filters.length}`,
        `Columns: ${view.columns.length}`,
        `Permission: ${view.permission}`,
      ],
      sourceRecordId: view.id,
    }))
}

function buildUsageSignals(data: PlatformAdminReadModel): WatchSignal[] {
  return data.usageAnalytics
    .filter(row => row.usageTrend === 'Declining' || row.inactiveDays >= 7 || row.escalations7d > 4)
    .map(row => ({
      id: `usage:${row.id}`,
      title: `${row.organizationName} usage watch`,
      description: `${row.usageTrend} trend / ${row.inactiveDays} inactive days`,
      source: 'Usage' as const,
      priority: row.inactiveDays >= 14 || row.escalations7d > 8 ? 'High' as const : 'Medium' as const,
      status: 'New' as const,
      owner: 'Client Success' as const,
      scope: row.organizationName,
      detectedAt: coerceDateIso(row.lastActive),
      dueAt: addHours(row.lastActive, row.inactiveDays >= 14 ? 24 : 72),
      permission: 'usage.view' as const,
      targetPage: 'usage' as const,
      sensitivity: 'Standard' as const,
      recommendedAction: 'Review adoption, recent activity, and client success owner follow-up.',
      evidence: [
        `Active users 7d: ${row.activeUsers7d}`,
        `Staff adoption: ${row.staffAdoption}%`,
        `Escalations 7d: ${row.escalations7d}`,
        `Ignored requests 7d: ${row.ignoredRequests7d}`,
      ],
      sourceRecordId: row.id,
    }))
}

function applyLocalState(signal: WatchSignal, state: WatchSignalLocalState | undefined, now: Date): WatchSignal {
  if (!state) return signal
  const snoozedUntil = state.snoozedUntil ? new Date(state.snoozedUntil) : null
  const status = state.status === 'Snoozed' && snoozedUntil && snoozedUntil.getTime() <= now.getTime()
    ? 'New'
    : state.status

  return {
    ...signal,
    status,
    localNote: state.note,
    snoozedUntil: status === 'Snoozed' ? state.snoozedUntil : undefined,
  }
}

function sortWatchSignals(a: WatchSignal, b: WatchSignal) {
  const statusWeight = (signal: WatchSignal) => signal.status === 'Snoozed' ? 1 : 0
  const priorityWeight = (priority: WatchSignalPriority) => {
    if (priority === 'Critical') return 0
    if (priority === 'High') return 1
    if (priority === 'Medium') return 2
    return 3
  }

  return statusWeight(a) - statusWeight(b)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function addHours(value: string, hours: number) {
  return new Date(parseDate(value).getTime() + hours * 60 * 60 * 1000).toISOString()
}

function coerceDateIso(value: string) {
  return parseDate(value).toISOString()
}

function parseDate(value: string) {
  const directDate = new Date(value)
  if (!Number.isNaN(directDate.getTime())) return directDate

  const relativeMatch = value.match(/^(\d+)\s+(minute|hour|day)s?\s+ago$/i)
  if (!relativeMatch) return new Date()

  const amount = Number(relativeMatch[1])
  const unit = relativeMatch[2].toLowerCase()
  const multiplier = unit === 'day'
    ? 24 * 60 * 60 * 1000
    : unit === 'hour'
      ? 60 * 60 * 1000
      : 60 * 1000
  return new Date(Date.now() - amount * multiplier)
}

function isWatchSignalLocalState(value: unknown): value is WatchSignalLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.signalId === 'string'
    && typeof record.status === 'string'
    && typeof record.updatedAt === 'string'
}
