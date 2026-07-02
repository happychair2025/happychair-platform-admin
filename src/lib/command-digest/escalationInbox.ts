import { useEffect, useState } from 'react'
import type { AdminActionRequest, AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandDigestItem, CommandDigestTargetPage } from './commandDigest'
import type { DigestReviewWindow } from './reviewCadence'
import type { SlaEscalationItem } from '../watch-center/slaEscalations'
import type { WatchSignal, WatchTargetPage } from '../watch-center/watchCenter'

export type EscalationInboxSource = 'Review Cadence' | 'SLA Board' | 'Action Request' | 'Command Digest' | 'Watch Center'
export type EscalationInboxSeverity = 'Critical' | 'High' | 'Medium' | 'Watch'
export type EscalationInboxDecision = 'Escalate' | 'Approve' | 'Assign' | 'Review' | 'Monitor'
export type EscalationInboxLocalStatus = 'Open' | 'Acknowledged' | 'Escalated' | 'Dismissed'
export type EscalationInboxStatus =
  | 'New'
  | 'Open'
  | 'Due Today'
  | 'Due Soon'
  | 'Overdue'
  | 'Escalation Ready'
  | 'Needs Setup'
  | 'Needs Review'
  | 'Action Handoff'
  | 'Blocked'
  | 'Failed'
  | 'Running'
  | 'Queued'
  | 'Approved'
  | 'Acknowledged'
  | 'Escalated'
  | 'Dismissed'

export type EscalationInboxTargetPage =
  | CommandDigestTargetPage
  | 'command-digest'
  | 'watch-center'
  | 'sla-board'
  | 'digest-cadence'
  | 'brief-archive'

export interface EscalationInboxLocalState {
  itemId: string
  status: EscalationInboxLocalStatus
  note?: string
  updatedAt: string
}

export interface EscalationInboxItem {
  id: string
  title: string
  description: string
  source: EscalationInboxSource
  severity: EscalationInboxSeverity
  status: EscalationInboxStatus
  decision: EscalationInboxDecision
  owner: string
  scope: string
  targetPage: EscalationInboxTargetPage
  targetLabel: string
  permission: PermissionKey
  followUpActionType: AdminActionRequestType
  followUpPermission: PermissionKey
  handlerKey?: string
  rollbackNotes: string
  createdAt: string
  dueAt: string
  minutesLate: number
  evidence: string[]
  relatedRecordId: string
  localStatus: EscalationInboxLocalStatus
  localNote?: string
  score: number
  dedupeKey: string
}

export interface BuildEscalationInboxInput {
  reviewWindows: DigestReviewWindow[]
  slaItems: SlaEscalationItem[]
  digestItems: CommandDigestItem[]
  watchSignals: WatchSignal[]
  actionRequests: AdminActionRequest[]
  localStates?: EscalationInboxLocalState[]
  now?: Date
}

export interface EscalationInboxSummary {
  total: number
  open: number
  critical: number
  escalationReady: number
  blockedOrFailed: number
  overdue: number
  dueToday: number
  acknowledged: number
  dismissed: number
  queueable: number
}

const localStorageKey = 'hc_platform_escalation_inbox_state_v1'

export const escalationInboxBoundaryRule =
  'Escalation Inbox is an owner decision queue over existing Platform Admin signals. It can record local review state and queue governed follow-ups, but production changes still require Admin Action Request approval and server-side handlers.'

export function buildEscalationInbox(input: BuildEscalationInboxInput): EscalationInboxItem[] {
  const now = input.now ?? new Date()
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  const candidates = [
    ...input.reviewWindows.filter(isEscalationReviewWindow).map(window => fromReviewWindow(window, now)),
    ...input.slaItems.filter(isEscalationSlaItem).map(item => fromSlaItem(item, now)),
    ...input.actionRequests.filter(isEscalationActionRequest).map(request => fromActionRequest(request, now)),
    ...input.digestItems.filter(isEscalationDigestItem).map(item => fromDigestItem(item, now)),
    ...input.watchSignals.filter(isEscalationWatchSignal).map(signal => fromWatchSignal(signal, now)),
  ]

  return dedupeEscalations(candidates)
    .map(item => applyLocalState(item, localStateByItemId.get(item.id)))
    .sort(sortEscalationItems)
    .slice(0, 60)
}

export function summarizeEscalationInbox(items: EscalationInboxItem[]): EscalationInboxSummary {
  const activeItems = items.filter(item => item.localStatus !== 'Dismissed')
  return {
    total: items.length,
    open: activeItems.filter(item => item.localStatus === 'Open').length,
    critical: activeItems.filter(item => item.severity === 'Critical').length,
    escalationReady: activeItems.filter(item => ['Escalation Ready', 'Action Handoff', 'Approved', 'Escalated'].includes(item.status)).length,
    blockedOrFailed: activeItems.filter(item => item.status === 'Blocked' || item.status === 'Failed').length,
    overdue: activeItems.filter(item => item.status === 'Overdue' || item.minutesLate > 0).length,
    dueToday: activeItems.filter(item => item.status === 'Due Today' || item.status === 'Due Soon').length,
    acknowledged: items.filter(item => item.localStatus === 'Acknowledged' || item.localStatus === 'Escalated').length,
    dismissed: items.filter(item => item.localStatus === 'Dismissed').length,
    queueable: activeItems.filter(item => item.decision === 'Escalate' || item.decision === 'Approve' || item.status === 'Action Handoff').length,
  }
}

export function getEscalationSeverityTone(severity: EscalationInboxSeverity) {
  if (severity === 'Critical') return 'danger' as const
  if (severity === 'High') return 'warn' as const
  if (severity === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function getEscalationStatusTone(status: EscalationInboxStatus) {
  if (['Blocked', 'Failed', 'Overdue', 'Escalation Ready'].includes(status)) return 'danger' as const
  if (['Due Today', 'Due Soon', 'Needs Review', 'Action Handoff', 'Approved', 'Running', 'Escalated'].includes(status)) return 'warn' as const
  if (status === 'Acknowledged') return 'ok' as const
  if (status === 'Dismissed') return 'neutral' as const
  return 'info' as const
}

export function getEscalationDecisionTone(decision: EscalationInboxDecision) {
  if (decision === 'Escalate') return 'danger' as const
  if (decision === 'Approve' || decision === 'Assign') return 'warn' as const
  if (decision === 'Review') return 'info' as const
  return 'neutral' as const
}

export function getEscalationSourceTone(source: EscalationInboxSource) {
  if (source === 'Action Request' || source === 'SLA Board') return 'danger' as const
  if (source === 'Review Cadence' || source === 'Command Digest') return 'warn' as const
  return 'info' as const
}

export function loadLocalEscalationInboxStates(): EscalationInboxLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEscalationInboxLocalState)
  } catch {
    return []
  }
}

export function saveLocalEscalationInboxStates(states: EscalationInboxLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 160)))
}

export function useLocalEscalationInboxStates() {
  const [states, setStates] = useState<EscalationInboxLocalState[]>(() => loadLocalEscalationInboxStates())

  useEffect(() => {
    saveLocalEscalationInboxStates(states)
  }, [states])

  return [states, setStates] as const
}

function isEscalationReviewWindow(window: DigestReviewWindow) {
  return window.status === 'Escalation Ready'
    || window.status === 'Missed'
    || window.status === 'Due Today'
    || window.status === 'Needs Setup'
}

function isEscalationSlaItem(item: SlaEscalationItem) {
  return item.status === 'Overdue'
    || item.status === 'Due Soon'
    || item.status === 'Needs Review'
    || item.level === 'Executive Review'
    || item.level === 'Action Handoff'
    || item.actionHandoffRequired
}

function isEscalationActionRequest(request: AdminActionRequest) {
  return ['Blocked', 'Failed', 'Running', 'Queued', 'Approved'].includes(request.status)
}

function isEscalationDigestItem(item: CommandDigestItem) {
  return item.severity === 'Critical'
    || item.severity === 'High'
    || item.decision === 'Escalate'
    || item.decision === 'Approve'
}

function isEscalationWatchSignal(signal: WatchSignal) {
  return signal.status === 'New' && (signal.priority === 'Critical' || signal.priority === 'High')
}

function fromReviewWindow(window: DigestReviewWindow, now: Date): EscalationInboxItem {
  const status = reviewStatusForInbox(window)
  const severity: EscalationInboxSeverity = window.status === 'Escalation Ready' || window.status === 'Missed'
    ? 'Critical'
    : window.status === 'Due Today'
      ? 'High'
      : 'Medium'
  const decision: EscalationInboxDecision = window.status === 'Escalation Ready' || window.status === 'Missed'
    ? 'Escalate'
    : window.status === 'Needs Setup'
      ? 'Assign'
      : 'Review'

  return {
    id: `inbox-review-${window.rule.id}`,
    title: window.rule.name,
    description: window.requiredAction,
    source: 'Review Cadence',
    severity,
    status,
    decision,
    owner: window.rule.owner,
    scope: window.rule.name,
    targetPage: 'digest-cadence',
    targetLabel: 'Review Cadence',
    permission: window.rule.permission,
    followUpActionType: window.rule.followUpActionType,
    followUpPermission: window.rule.followUpPermission,
    handlerKey: `server.digest_review_cadence.${window.rule.id}`,
    rollbackNotes: 'No production state changes from Escalation Inbox. Cadence escalation must remain governed by Admin Action Request approval.',
    createdAt: window.windowStartAt,
    dueAt: window.dueAt,
    minutesLate: Math.max(window.minutesLate, calculateMinutesLate(window.dueAt, now)),
    evidence: [
      `Required: ${window.rule.requiredSnapshotStatus}`,
      `Satisfied by: ${window.satisfiedBy}`,
      ...window.rule.evidence.slice(0, 3),
    ],
    relatedRecordId: window.rule.id,
    localStatus: 'Open',
    score: scoreEscalation(severity, status, decision, window.minutesLate),
    dedupeKey: `review:${window.rule.id}`,
  }
}

function fromSlaItem(item: SlaEscalationItem, now: Date): EscalationInboxItem {
  const status = slaStatusForInbox(item)
  const severity: EscalationInboxSeverity = item.status === 'Overdue' || item.level === 'Executive Review' || item.priority === 'Critical'
    ? 'Critical'
    : item.status === 'Due Soon' || item.status === 'Needs Review' || item.level === 'Action Handoff'
      ? 'High'
      : 'Medium'
  const decision: EscalationInboxDecision = item.level === 'Executive Review' || item.status === 'Overdue'
    ? 'Escalate'
    : item.actionHandoffRequired || item.level === 'Action Handoff'
      ? 'Approve'
      : item.status === 'Due Soon'
        ? 'Assign'
        : 'Review'

  return {
    id: `inbox-sla-${item.id}`,
    title: item.title,
    description: `${item.itemType} / ${item.level}: ${item.description}`,
    source: 'SLA Board',
    severity,
    status,
    decision,
    owner: item.owner,
    scope: item.scope,
    targetPage: 'sla-board',
    targetLabel: 'SLA Board',
    permission: item.permission,
    followUpActionType: item.handoffActionType ?? actionTypeForTarget(item.targetPage),
    followUpPermission: item.handoffPermission ?? actionPermissionForTarget(item.targetPage),
    handlerKey: item.handoffHandlerKey,
    rollbackNotes: item.rollbackNotes ?? 'Leave the source SLA item unchanged unless a governed server handler completes successfully.',
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    minutesLate: Math.max(calculateMinutesLate(item.dueAt, now), item.minutesRemaining < 0 ? Math.abs(item.minutesRemaining) : 0),
    evidence: [
      `SLA status: ${item.status}`,
      `Escalation level: ${item.level}`,
      ...item.evidence.slice(0, 3),
    ],
    relatedRecordId: item.sourceId,
    localStatus: 'Open',
    localNote: item.localNote,
    score: scoreEscalation(severity, status, decision, item.minutesRemaining < 0 ? Math.abs(item.minutesRemaining) : 0),
    dedupeKey: item.itemType === 'Watch Signal' ? `watch:${item.sourceId}` : `sla:${item.sourceId}:${item.itemType}`,
  }
}

function fromActionRequest(request: AdminActionRequest, now: Date): EscalationInboxItem {
  const createdAt = parseDate(request.updatedAt ?? request.createdAt, now).toISOString()
  const dueAt = dueAtForActionRequest(request, now)
  const severity: EscalationInboxSeverity = request.status === 'Blocked' || request.status === 'Failed'
    ? 'Critical'
    : request.status === 'Running' || request.status === 'Approved'
      ? 'High'
      : 'Medium'
  const decision: EscalationInboxDecision = request.status === 'Blocked' || request.status === 'Failed'
    ? 'Escalate'
    : request.status === 'Approved'
      ? 'Approve'
      : 'Review'

  return {
    id: `inbox-action-${request.id}`,
    title: request.title,
    description: request.reason,
    source: 'Action Request',
    severity,
    status: actionRequestStatusForInbox(request),
    decision,
    owner: request.requestedBy.role,
    scope: request.scope.label,
    targetPage: 'action-requests',
    targetLabel: 'Action Requests',
    permission: 'admin_actions.view',
    followUpActionType: request.actionType,
    followUpPermission: request.permissionRequired,
    handlerKey: request.serverHandler.key,
    rollbackNotes: request.rollbackNotes,
    createdAt,
    dueAt,
    minutesLate: calculateMinutesLate(dueAt, now),
    evidence: [
      `Permission required: ${request.permissionRequired}`,
      `Server handler: ${request.serverHandler.key}`,
      request.statusReason ? `Status reason: ${request.statusReason}` : `Persistence: ${request.persistenceStatus ?? 'local_durable'}`,
    ],
    relatedRecordId: request.id,
    localStatus: 'Open',
    score: scoreEscalation(severity, actionRequestStatusForInbox(request), decision, calculateMinutesLate(dueAt, now)),
    dedupeKey: `action:${request.id}`,
  }
}

function reviewStatusForInbox(window: DigestReviewWindow): EscalationInboxStatus {
  if (window.status === 'Missed') return 'Overdue'
  if (window.status === 'Escalation Ready') return 'Escalation Ready'
  if (window.status === 'Due Today') return 'Due Today'
  return 'Needs Setup'
}

function slaStatusForInbox(item: SlaEscalationItem): EscalationInboxStatus {
  if (item.status === 'Overdue') return 'Overdue'
  if (item.actionHandoffRequired || item.level === 'Action Handoff') return 'Action Handoff'
  if (item.status === 'Due Soon') return 'Due Soon'
  return 'Needs Review'
}

function actionRequestStatusForInbox(request: AdminActionRequest): EscalationInboxStatus {
  if (request.status === 'Blocked') return 'Blocked'
  if (request.status === 'Failed') return 'Failed'
  if (request.status === 'Running') return 'Running'
  if (request.status === 'Approved') return 'Approved'
  return 'Queued'
}

function fromDigestItem(item: CommandDigestItem, now: Date): EscalationInboxItem {
  const status: EscalationInboxStatus = item.decision === 'Escalate'
    ? 'Escalation Ready'
    : item.decision === 'Approve'
      ? 'Approved'
      : item.severity === 'Critical'
        ? 'Needs Review'
        : 'Open'
  const severity: EscalationInboxSeverity = item.severity === 'Critical'
    ? 'Critical'
    : item.severity === 'High'
      ? 'High'
      : item.severity === 'Moderate'
        ? 'Medium'
        : 'Watch'

  return {
    id: `inbox-digest-${item.id}`,
    title: item.title,
    description: item.brief,
    source: 'Command Digest',
    severity,
    status,
    decision: item.decision,
    owner: item.owner,
    scope: item.scope,
    targetPage: 'command-digest',
    targetLabel: 'Command Digest',
    permission: 'dashboard.view',
    followUpActionType: item.followUpActionType,
    followUpPermission: item.followUpPermission,
    handlerKey: `server.command_digest.${item.followUpActionType}`,
    rollbackNotes: 'No production state is changed from Escalation Inbox. Digest follow-up must be governed by Admin Action Requests.',
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    minutesLate: calculateMinutesLate(item.dueAt, now),
    evidence: [
      `Digest lane: ${item.lane}`,
      `Source status: ${item.sourceStatus}`,
      ...item.evidence.slice(0, 3),
    ],
    relatedRecordId: item.relatedRecordId,
    localStatus: 'Open',
    localNote: item.localNote,
    score: scoreEscalation(severity, status, item.decision, calculateMinutesLate(item.dueAt, now)),
    dedupeKey: dedupeKeyForDigestItem(item),
  }
}

function fromWatchSignal(signal: WatchSignal, now: Date): EscalationInboxItem {
  const minutesLate = calculateMinutesLate(signal.dueAt, now)
  const status: EscalationInboxStatus = minutesLate > 0 ? 'Overdue' : 'New'
  const severity: EscalationInboxSeverity = signal.priority === 'Critical' ? 'Critical' : 'High'
  const decision: EscalationInboxDecision = signal.priority === 'Critical' && minutesLate > 0
    ? 'Escalate'
    : 'Assign'

  return {
    id: `inbox-watch-${signal.id}`,
    title: signal.title,
    description: signal.description,
    source: 'Watch Center',
    severity,
    status,
    decision,
    owner: signal.owner,
    scope: signal.scope,
    targetPage: 'watch-center',
    targetLabel: 'Watch Center',
    permission: signal.permission,
    followUpActionType: actionTypeForTarget(signal.targetPage),
    followUpPermission: actionPermissionForTarget(signal.targetPage),
    handlerKey: `server.watch_center.${signal.source}`,
    rollbackNotes: 'Watch signals are local operating alerts. Production changes require a governed Admin Action Request.',
    createdAt: signal.detectedAt,
    dueAt: signal.dueAt,
    minutesLate,
    evidence: [
      `Source: ${signal.source}`,
      `Priority: ${signal.priority}`,
      ...signal.evidence.slice(0, 3),
    ],
    relatedRecordId: signal.sourceRecordId,
    localStatus: 'Open',
    localNote: signal.localNote,
    score: scoreEscalation(severity, status, decision, minutesLate),
    dedupeKey: `watch:${signal.id}`,
  }
}

function applyLocalState(item: EscalationInboxItem, state: EscalationInboxLocalState | undefined): EscalationInboxItem {
  if (!state) return item
  const status: EscalationInboxStatus = state.status === 'Open'
    ? item.status
    : state.status

  return {
    ...item,
    status,
    localStatus: state.status,
    localNote: state.note ?? item.localNote,
  }
}

function dedupeEscalations(items: EscalationInboxItem[]) {
  const byKey = new Map<string, EscalationInboxItem>()
  items.forEach(item => {
    const existing = byKey.get(item.dedupeKey)
    if (!existing || sortEscalationItems(item, existing) < 0) {
      byKey.set(item.dedupeKey, item)
    }
  })
  return [...byKey.values()]
}

function sortEscalationItems(a: EscalationInboxItem, b: EscalationInboxItem) {
  return localStatusWeight(a.localStatus) - localStatusWeight(b.localStatus)
    || severityWeight(a.severity) - severityWeight(b.severity)
    || statusWeight(a.status) - statusWeight(b.status)
    || decisionWeight(a.decision) - decisionWeight(b.decision)
    || b.score - a.score
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function dedupeKeyForDigestItem(item: CommandDigestItem) {
  if (item.source === 'SLA') return `watch:${item.relatedRecordId}`
  if (item.source === 'Cadence' || item.source === 'Attention') return `attention:${item.relatedRecordId}`
  return `digest:${item.dedupeKey}`
}

function scoreEscalation(
  severity: EscalationInboxSeverity,
  status: EscalationInboxStatus,
  decision: EscalationInboxDecision,
  minutesLate: number,
) {
  return Math.min(
    100,
    100 - severityWeight(severity) * 16 - statusWeight(status) * 3 - decisionWeight(decision) * 2 + Math.min(18, Math.max(0, minutesLate / 30)),
  )
}

function severityWeight(severity: EscalationInboxSeverity) {
  if (severity === 'Critical') return 0
  if (severity === 'High') return 1
  if (severity === 'Medium') return 2
  return 3
}

function statusWeight(status: EscalationInboxStatus) {
  if (status === 'Blocked' || status === 'Failed') return 0
  if (status === 'Escalation Ready' || status === 'Overdue') return 1
  if (status === 'Action Handoff' || status === 'Approved') return 2
  if (status === 'Running' || status === 'Due Today' || status === 'Due Soon') return 3
  if (status === 'Needs Review' || status === 'New') return 4
  if (status === 'Open' || status === 'Queued') return 5
  if (status === 'Escalated') return 6
  if (status === 'Acknowledged') return 7
  return 8
}

function decisionWeight(decision: EscalationInboxDecision) {
  if (decision === 'Escalate') return 0
  if (decision === 'Approve') return 1
  if (decision === 'Assign') return 2
  if (decision === 'Review') return 3
  return 4
}

function localStatusWeight(status: EscalationInboxLocalStatus) {
  if (status === 'Open') return 0
  if (status === 'Escalated') return 1
  if (status === 'Acknowledged') return 2
  return 3
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

function dueAtForActionRequest(request: AdminActionRequest, now: Date) {
  const baseDate = parseDate(request.updatedAt ?? request.createdAt, now)
  if (request.status === 'Blocked' || request.status === 'Failed') return baseDate.toISOString()
  if (request.status === 'Approved' || request.status === 'Running') return addHours(baseDate.toISOString(), 2)
  return addHours(baseDate.toISOString(), 8)
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

function isEscalationInboxLocalState(value: unknown): value is EscalationInboxLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && ['Open', 'Acknowledged', 'Escalated', 'Dismissed'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
