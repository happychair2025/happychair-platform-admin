import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendClosureEvidenceBinder, BackendClosureEvidenceItem } from './backendClosureEvidenceBinder'
import type { ExecutiveGoNoGoEvidenceItem, ExecutiveGoNoGoRoom } from './executiveGoNoGoRoom'
import type { LaunchCommandItem, LaunchCommandModeModel } from './launchCommandMode'
import type {
  LaunchCommandSavedViewResult,
  LaunchCommandSavedViewSurface,
  LaunchCommandSavedViewsModel,
} from './launchCommandSavedViews'
import type { LaunchFollowUpItem, LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchWarRoomTimeline, LaunchWarRoomTimelineEvent } from './launchWarRoomTimeline'
import type { ProductionGuardrailItem, ProductionGuardrailMatrix } from './productionGuardrailMatrix'

export type LaunchExceptionSlaStatus = 'Overdue' | 'Due Soon' | 'Needs Review' | 'On Track' | 'Acknowledged'
export type LaunchExceptionSlaLevel = 'Monitor' | 'Owner Review' | 'Action Handoff' | 'Executive Review'
export type LaunchExceptionSlaReviewStatus = 'Open' | 'Reviewed' | 'Escalated'
export type LaunchExceptionSlaPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface LaunchExceptionSlaStep {
  label: string
  owner: string
  dueAt: string
  action: string
  level: LaunchExceptionSlaLevel
}

export interface LaunchExceptionSlaItem {
  id: string
  title: string
  description: string
  owner: string
  priority: LaunchExceptionSlaPriority
  status: LaunchExceptionSlaStatus
  reviewStatus: LaunchExceptionSlaReviewStatus
  level: LaunchExceptionSlaLevel
  source: string
  reference: string
  createdAt: string
  updatedAt: string
  dueAt: string
  slaMinutes: number
  elapsedMinutes: number
  minutesRemaining: number
  progress: number
  defaultSurface: LaunchCommandSavedViewSurface
  auditBacked: boolean
  localOnly: boolean
  actionHandoffRequired: boolean
  escalationSteps: LaunchExceptionSlaStep[]
  evidence: string[]
  nextStep: string
  localNote?: string
  auditEventId?: string
}

export interface LaunchExceptionSlaOwnerGroup {
  owner: string
  total: number
  overdue: number
  dueSoon: number
  actionHandoff: number
  executiveReview: number
  nextStep: string
}

export interface LaunchExceptionSlaBoard {
  status: LaunchExceptionSlaStatus
  summary: string
  generatedAt: string
  items: LaunchExceptionSlaItem[]
  nextItem?: LaunchExceptionSlaItem
  totalCount: number
  overdueCount: number
  dueSoonCount: number
  needsReviewCount: number
  acknowledgedCount: number
  actionHandoffCount: number
  executiveReviewCount: number
  auditBackedCount: number
  activeOwnerCount: number
  recordCount: number
  latestRecord?: LaunchExceptionSlaRecord
  ownerGroups: LaunchExceptionSlaOwnerGroup[]
}

export interface LaunchExceptionSlaRecord {
  id: string
  itemId: string
  itemTitle: string
  reviewStatus: LaunchExceptionSlaReviewStatus
  owner: string
  note: string
  status: LaunchExceptionSlaStatus
  level: LaunchExceptionSlaLevel
  dueAt: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchExceptionSlaBoardInput {
  commandMode: LaunchCommandModeModel
  launchWarRoomTimeline: LaunchWarRoomTimeline
  launchCommandSavedViews: LaunchCommandSavedViewsModel
  executiveGoNoGoRoom: ExecutiveGoNoGoRoom
  productionGuardrailMatrix: ProductionGuardrailMatrix
  backendClosureEvidenceBinder: BackendClosureEvidenceBinder
  followUpRegister: LaunchFollowUpRegisterModel
  records: LaunchExceptionSlaRecord[]
  now?: Date
}

interface SaveLaunchExceptionSlaRecordInput {
  item: LaunchExceptionSlaItem
  reviewStatus: LaunchExceptionSlaReviewStatus
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_exception_sla_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchExceptionSlaRecord[] = []

export const launchExceptionSlaBoundaryRule =
  'Launch Exception SLA records coordinate ownership, due windows, and handoffs only. They do not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchExceptionSlaBoard(input: BuildLaunchExceptionSlaBoardInput): LaunchExceptionSlaBoard {
  const now = input.now ?? new Date()
  const generatedAt = now.toISOString()
  const latestRecordByItem = getLatestRecordByItem(input.records)
  const items = dedupeItems([
    ...input.launchCommandSavedViews.views.flatMap(view => view.results.map(result => itemFromSavedViewResult(result, view.name, now))),
    ...input.commandMode.items.map(item => itemFromCommandItem(item, now)),
    ...input.launchWarRoomTimeline.events.map(itemFromWarRoomEvent),
    ...input.followUpRegister.items.filter(item => item.status !== 'Resolved').map(item => itemFromFollowUp(item, now)),
    ...input.executiveGoNoGoRoom.items.filter(item => item.status !== 'Clear').map(item => itemFromExecutiveItem(item, now)),
    ...input.productionGuardrailMatrix.items.filter(item => item.status !== 'Verified').map(item => itemFromGuardrailItem(item, now)),
    ...input.backendClosureEvidenceBinder.items.filter(item => item.status !== 'Closed').map(item => itemFromBackendClosureItem(item, now)),
  ])
    .map(item => applyRecord(item, latestRecordByItem.get(item.id)))
    .sort(sortSlaItems)
    .slice(0, 120)
  const openItems = items.filter(item => item.status !== 'Acknowledged')
  const overdueCount = items.filter(item => item.status === 'Overdue').length
  const dueSoonCount = items.filter(item => item.status === 'Due Soon').length
  const needsReviewCount = items.filter(item => item.status === 'Needs Review').length
  const status = overdueCount > 0 ? 'Overdue' : dueSoonCount > 0 ? 'Due Soon' : needsReviewCount > 0 ? 'Needs Review' : 'On Track'

  return {
    status,
    summary: getBoardSummary(status, overdueCount, dueSoonCount, needsReviewCount, openItems.length),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    overdueCount,
    dueSoonCount,
    needsReviewCount,
    acknowledgedCount: items.filter(item => item.status === 'Acknowledged').length,
    actionHandoffCount: items.filter(item => item.actionHandoffRequired || item.level === 'Action Handoff').length,
    executiveReviewCount: items.filter(item => item.level === 'Executive Review').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    activeOwnerCount: new Set(openItems.map(item => item.owner)).size,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchExceptionSlaRecords(): LaunchExceptionSlaRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchExceptionSlaRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchExceptionSlaRecord(input: SaveLaunchExceptionSlaRecordInput) {
  const record: LaunchExceptionSlaRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    itemTitle: input.item.title,
    reviewStatus: input.reviewStatus,
    owner: input.item.owner,
    note: input.note.trim() || defaultReviewNote(input.reviewStatus, input.item),
    status: input.item.status,
    level: input.item.level,
    dueAt: input.item.dueAt,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchExceptionSlaRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchExceptionSlaRecordChange()
  return record
}

export function subscribeToLaunchExceptionSlaRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchExceptionSlaRecords() {
  return useSyncExternalStore(subscribeToLaunchExceptionSlaRecords, getLaunchExceptionSlaRecords, () => [])
}

export function getLaunchExceptionSlaStatusTone(status: LaunchExceptionSlaStatus) {
  if (status === 'Overdue') return 'danger' as const
  if (status === 'Due Soon' || status === 'Needs Review') return 'warn' as const
  if (status === 'Acknowledged') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchExceptionSlaLevelTone(level: LaunchExceptionSlaLevel) {
  if (level === 'Executive Review') return 'danger' as const
  if (level === 'Action Handoff') return 'warn' as const
  if (level === 'Owner Review') return 'info' as const
  return 'neutral' as const
}

export function getLaunchExceptionSlaReviewTone(status: LaunchExceptionSlaReviewStatus) {
  if (status === 'Escalated') return 'warn' as const
  if (status === 'Reviewed') return 'ok' as const
  return 'neutral' as const
}

export function getLaunchExceptionSlaFilename(board: LaunchExceptionSlaBoard) {
  return `launch-exception-sla-board-${board.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchExceptionSlaHtml(board: LaunchExceptionSlaBoard, session: AdminSession) {
  const itemRows = board.items.map(item => `
    <tr>
      <td>${escapeHtml(item.dueAt)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.level)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')
  const ownerRows = board.ownerGroups.map(group => `
    <tr>
      <td>${escapeHtml(group.owner)}</td>
      <td>${group.total}</td>
      <td>${group.overdue}</td>
      <td>${group.dueSoon}</td>
      <td>${group.actionHandoff}</td>
      <td>${group.executiveReview}</td>
      <td>${escapeHtml(group.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Launch Exception SLA Board</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 17px; }
      p, td { line-height: 1.55; }
      .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .meta div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Launch Exception SLA Board</p>
        <h1>${escapeHtml(board.summary)}</h1>
        <p>${escapeHtml(launchExceptionSlaBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(board.status)}</strong></div>
        <div><span>Items</span><strong>${board.totalCount}</strong></div>
        <div><span>Overdue</span><strong>${board.overdueCount}</strong></div>
        <div><span>Due Soon</span><strong>${board.dueSoonCount}</strong></div>
        <div><span>Action Handoffs</span><strong>${board.actionHandoffCount}</strong></div>
        <div><span>Executive Review</span><strong>${board.executiveReviewCount}</strong></div>
        <div><span>Audit Backed</span><strong>${board.auditBackedCount}</strong></div>
        <div><span>Generated By</span><strong>${escapeHtml(session.name)} / ${escapeHtml(session.email)}</strong></div>
      </section>
      <section>
        <h2>SLA Queue</h2>
        <table><thead><tr><th>Due</th><th>Status</th><th>Level</th><th>Item</th><th>Owner</th><th>Source</th><th>Next Step</th></tr></thead><tbody>${itemRows}</tbody></table>
      </section>
      <section>
        <h2>Owner Load</h2>
        <table><thead><tr><th>Owner</th><th>Total</th><th>Overdue</th><th>Due Soon</th><th>Handoffs</th><th>Executive</th><th>Next Step</th></tr></thead><tbody>${ownerRows}</tbody></table>
      </section>
    </main>
  </body>
</html>`
}

export function formatLaunchSlaDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.round(minutes / 60)}h`
}

export function formatLaunchSlaRemaining(minutes: number) {
  if (minutes < 0) return `${formatLaunchSlaDuration(Math.abs(minutes))} overdue`
  if (minutes === 0) return 'Due now'
  return `${formatLaunchSlaDuration(minutes)} remaining`
}

function itemFromSavedViewResult(result: LaunchCommandSavedViewResult, viewName: string, now: Date): LaunchExceptionSlaItem {
  const priority = priorityFromStatus(result.status)
  return createItem({
    id: `saved-view:${result.id}`,
    title: result.title,
    description: result.evidence,
    owner: result.owner,
    priority,
    source: `Saved View / ${viewName}`,
    reference: result.reference,
    createdAt: result.updatedAt,
    updatedAt: result.updatedAt,
    defaultSurface: result.surface,
    auditBacked: result.auditBacked,
    localOnly: result.localOnly,
    actionHandoffRequired: result.status === 'Critical' || result.source === 'Action Queue',
    evidence: [result.evidence, `Reference: ${result.reference}`, result.auditBacked ? 'Audit-backed result' : 'Local evidence result'],
    nextStep: result.nextStep,
  }, now)
}

function itemFromCommandItem(item: LaunchCommandItem, now: Date): LaunchExceptionSlaItem {
  return createItem({
    id: `command:${item.id}`,
    title: item.title,
    description: item.whyItMatters,
    owner: item.owner,
    priority: priorityFromCommand(item),
    source: `Command Mode / ${item.type}`,
    reference: item.reference,
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    defaultSurface: 'command',
    auditBacked: false,
    localOnly: true,
    actionHandoffRequired: item.type === 'Server Action' || item.status === 'Blocked',
    evidence: [item.whyItMatters, `Severity: ${item.severity}`, `Reference: ${item.reference}`],
    nextStep: item.nextDecision,
  }, now)
}

function itemFromWarRoomEvent(event: LaunchWarRoomTimelineEvent): LaunchExceptionSlaItem {
  return createItem({
    id: `war-room:${event.id}`,
    title: event.title,
    description: event.evidence,
    owner: event.owner,
    priority: event.status === 'Critical' ? 'Critical' : event.status === 'Action Needed' ? 'High' : 'Medium',
    source: `War Room / ${event.lane}`,
    reference: event.reference,
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
    defaultSurface: event.lane === 'Follow-Up'
      ? 'followup'
      : event.lane === 'Backend' || event.lane === 'Closure'
        ? 'backendClosure'
        : event.lane === 'Guardrail'
          ? 'productionGuardrails'
          : event.lane === 'Executive Decision'
            ? 'goNoGo'
            : 'warRoom',
    auditBacked: Boolean(event.auditEventId),
    localOnly: event.localOnly,
    actionHandoffRequired: event.status === 'Critical' || event.lane === 'Action Queue',
    evidence: [event.evidence, `Source: ${event.source}`, event.auditEventId ? `Audit: ${event.auditEventId}` : 'Local-only event'],
    nextStep: event.nextStep,
    auditEventId: event.auditEventId,
  }, new Date())
}

function itemFromFollowUp(item: LaunchFollowUpItem, now: Date): LaunchExceptionSlaItem {
  return createItem({
    id: `follow-up:${item.id}`,
    title: item.title,
    description: item.evidence,
    owner: item.owner,
    priority: item.priority,
    source: `Follow-Up / ${item.source}`,
    reference: item.reference,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    defaultSurface: 'followup',
    auditBacked: item.auditBacked || Boolean(item.auditEventId),
    localOnly: true,
    actionHandoffRequired: item.status === 'Blocked' || item.priority === 'Critical',
    evidence: [item.evidence, `Due: ${item.dueLabel}`, `Reference: ${item.reference}`],
    nextStep: item.nextStep,
    auditEventId: item.auditEventId,
  }, now)
}

function itemFromExecutiveItem(item: ExecutiveGoNoGoEvidenceItem, now: Date): LaunchExceptionSlaItem {
  return createItem({
    id: `executive:${item.id}`,
    title: item.title,
    description: item.evidence,
    owner: item.owner,
    priority: item.status === 'Blocked' ? 'Critical' : 'High',
    source: `Go / No-Go / ${item.category}`,
    reference: item.reference,
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt,
    defaultSurface: 'goNoGo',
    auditBacked: item.auditBacked,
    localOnly: true,
    actionHandoffRequired: item.required && item.status === 'Blocked',
    evidence: [item.evidence, item.required ? 'Required executive evidence' : 'Supporting executive evidence', `Reference: ${item.reference}`],
    nextStep: item.nextStep,
  }, now)
}

function itemFromGuardrailItem(item: ProductionGuardrailItem, now: Date): LaunchExceptionSlaItem {
  return createItem({
    id: `guardrail:${item.id}`,
    title: item.handlerLabel,
    description: item.productionBoundary,
    owner: item.guardrailOwner,
    priority: item.status === 'Blocked' || item.risk === 'Critical' ? 'Critical' : 'High',
    source: 'Production Guardrails',
    reference: item.permission,
    createdAt: item.generatedAt,
    updatedAt: item.reviewedAt ?? item.generatedAt,
    defaultSurface: 'productionGuardrails',
    auditBacked: item.auditEventCount > 0 || Boolean(item.auditEventId),
    localOnly: true,
    actionHandoffRequired: item.status === 'Blocked' || item.missingCount > 0,
    evidence: [item.productionBoundary, `${item.requiredSatisfiedCount}/${item.requiredCount} required guardrails satisfied`, `Endpoint: ${item.method} ${item.endpoint}`],
    nextStep: item.nextStep,
    auditEventId: item.auditEventId,
  }, now)
}

function itemFromBackendClosureItem(item: BackendClosureEvidenceItem, now: Date): LaunchExceptionSlaItem {
  return createItem({
    id: `backend-closure:${item.id}`,
    title: item.handlerLabel,
    description: item.closureSummary,
    owner: item.closureOwner,
    priority: item.status === 'Blocked' || item.risk === 'Critical' ? 'Critical' : 'High',
    source: 'Backend Closure',
    reference: item.endpoint,
    createdAt: item.generatedAt,
    updatedAt: item.reviewedAt ?? item.generatedAt,
    defaultSurface: 'backendClosure',
    auditBacked: item.auditEventCount > 0 || Boolean(item.auditEventId),
    localOnly: true,
    actionHandoffRequired: item.status === 'Blocked' || item.missingCount > 0,
    evidence: [item.closureSummary, `${item.requiredReadyCount}/${item.requiredCount} closure checks ready`, `Endpoint: ${item.method} ${item.endpoint}`],
    nextStep: item.nextStep,
    auditEventId: item.auditEventId,
  }, now)
}

function createItem(input: Omit<LaunchExceptionSlaItem, 'status' | 'reviewStatus' | 'level' | 'dueAt' | 'slaMinutes' | 'elapsedMinutes' | 'minutesRemaining' | 'progress' | 'escalationSteps'>, now: Date): LaunchExceptionSlaItem {
  const createdAt = parseDate(input.createdAt)
  const slaMinutes = slaMinutesForPriority(input.priority, input.source)
  const dueAt = addMinutes(createdAt, slaMinutes)
  const timing = calculateTiming(createdAt, dueAt, slaMinutes, now)
  const level = getLevel(input.priority, timing.status, input.actionHandoffRequired)

  return {
    ...input,
    ...timing,
    reviewStatus: 'Open',
    level,
    dueAt: dueAt.toISOString(),
    slaMinutes,
    escalationSteps: buildEscalationSteps(input.owner, input.priority, createdAt, dueAt, slaMinutes, input.nextStep, level),
  }
}

function calculateTiming(createdAt: Date, dueAt: Date, slaMinutes: number, now: Date) {
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60000))
  const minutesRemaining = Math.round((dueAt.getTime() - now.getTime()) / 60000)
  const progress = Math.min(100, Math.max(0, Math.round(elapsedMinutes / slaMinutes * 100)))
  const warningWindow = Math.max(120, Math.round(slaMinutes * 0.3))
  const status: LaunchExceptionSlaStatus = minutesRemaining < 0
    ? 'Overdue'
    : minutesRemaining <= warningWindow
      ? 'Due Soon'
      : 'On Track'

  return { elapsedMinutes, minutesRemaining, progress, status }
}

function applyRecord(item: LaunchExceptionSlaItem, record: LaunchExceptionSlaRecord | undefined): LaunchExceptionSlaItem {
  if (!record) return item
  return {
    ...item,
    reviewStatus: record.reviewStatus,
    status: record.reviewStatus === 'Reviewed' ? 'Acknowledged' : item.status,
    level: record.reviewStatus === 'Escalated' ? 'Executive Review' : item.level,
    localNote: record.note,
    auditEventId: record.auditEventId,
  }
}

function buildEscalationSteps(owner: string, priority: LaunchExceptionSlaPriority, createdAt: Date, dueAt: Date, slaMinutes: number, nextStep: string, level: LaunchExceptionSlaLevel): LaunchExceptionSlaStep[] {
  return [
    {
      label: 'Owner response',
      owner,
      dueAt: dueAt.toISOString(),
      action: nextStep,
      level: 'Owner Review',
    },
    {
      label: 'Launch command review',
      owner: priority === 'Critical' ? 'Owner' : 'Admin',
      dueAt: addMinutes(createdAt, slaMinutes + Math.max(60, Math.round(slaMinutes / 2))).toISOString(),
      action: 'Review unresolved launch exception and decide whether it blocks close, needs a handoff, or can be acknowledged.',
      level: level === 'Executive Review' ? 'Executive Review' : 'Action Handoff',
    },
  ]
}

function buildOwnerGroups(items: LaunchExceptionSlaItem[]): LaunchExceptionSlaOwnerGroup[] {
  const groups = new Map<string, LaunchExceptionSlaItem[]>()
  items.forEach(item => groups.set(item.owner, [...(groups.get(item.owner) ?? []), item]))

  return Array.from(groups.entries()).map(([owner, ownerItems]) => {
    const open = ownerItems.filter(item => item.status !== 'Acknowledged')
    return {
      owner,
      total: ownerItems.length,
      overdue: ownerItems.filter(item => item.status === 'Overdue').length,
      dueSoon: ownerItems.filter(item => item.status === 'Due Soon').length,
      actionHandoff: ownerItems.filter(item => item.actionHandoffRequired || item.level === 'Action Handoff').length,
      executiveReview: ownerItems.filter(item => item.level === 'Executive Review').length,
      nextStep: open[0]?.nextStep ?? 'No open launch SLA exception for this owner.',
    }
  }).sort((a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.total - a.total || a.owner.localeCompare(b.owner))
}

function getLatestRecordByItem(records: LaunchExceptionSlaRecord[]) {
  const latest = new Map<string, LaunchExceptionSlaRecord>()
  records.forEach(record => {
    const current = latest.get(record.itemId)
    if (!current || new Date(record.recordedAt).getTime() > new Date(current.recordedAt).getTime()) {
      latest.set(record.itemId, record)
    }
  })
  return latest
}

function dedupeItems(items: LaunchExceptionSlaItem[]) {
  const byKey = new Map<string, LaunchExceptionSlaItem>()
  items.forEach(item => {
    const key = `${item.title.toLowerCase()}|${item.owner.toLowerCase()}|${item.reference.toLowerCase()}`
    const current = byKey.get(key)
    if (!current || itemPriorityRank(item.priority) > itemPriorityRank(current.priority) || item.auditBacked && !current.auditBacked) {
      byKey.set(key, item)
    }
  })
  return Array.from(byKey.values())
}

function sortSlaItems(a: LaunchExceptionSlaItem, b: LaunchExceptionSlaItem) {
  return statusRank(a.status) - statusRank(b.status)
    || levelRank(a.level) - levelRank(b.level)
    || itemPriorityRank(b.priority) - itemPriorityRank(a.priority)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function getBoardSummary(status: LaunchExceptionSlaStatus, overdue: number, dueSoon: number, needsReview: number, open: number) {
  if (status === 'Overdue') return `${overdue} launch exceptions are overdue for owner response.`
  if (status === 'Due Soon') return `${dueSoon} launch exceptions are due soon and need owner attention.`
  if (status === 'Needs Review') return `${needsReview} launch exceptions need command review.`
  return `${open} launch SLA items are on track for the current review model.`
}

function defaultReviewNote(status: LaunchExceptionSlaReviewStatus, item: LaunchExceptionSlaItem) {
  if (status === 'Escalated') return `${item.title} escalated for ${item.level}.`
  if (status === 'Reviewed') return `${item.title} reviewed against launch SLA evidence.`
  return `${item.title} remains open for launch SLA review.`
}

function priorityFromStatus(status: LaunchCommandSavedViewResult['status']): LaunchExceptionSlaPriority {
  if (status === 'Critical') return 'Critical'
  if (status === 'Action Needed') return 'High'
  if (status === 'Recorded') return 'Medium'
  return 'Low'
}

function priorityFromCommand(item: LaunchCommandItem): LaunchExceptionSlaPriority {
  if (item.status === 'Blocked' || item.severity === 'Critical') return 'Critical'
  if (item.severity === 'High') return 'High'
  if (item.severity === 'Medium') return 'Medium'
  return 'Low'
}

function slaMinutesForPriority(priority: LaunchExceptionSlaPriority, source: string) {
  if (priority === 'Critical' && source.includes('Executive')) return 60
  if (priority === 'Critical') return 120
  if (priority === 'High') return 360
  if (priority === 'Medium') return 720
  return 1440
}

function getLevel(priority: LaunchExceptionSlaPriority, status: LaunchExceptionSlaStatus, handoff: boolean): LaunchExceptionSlaLevel {
  if (status === 'Overdue' && priority === 'Critical') return 'Executive Review'
  if (handoff || status === 'Overdue') return 'Action Handoff'
  if (status === 'Due Soon' || priority === 'High' || priority === 'Critical') return 'Owner Review'
  return 'Monitor'
}

function statusRank(status: LaunchExceptionSlaStatus) {
  if (status === 'Overdue') return 0
  if (status === 'Due Soon') return 1
  if (status === 'Needs Review') return 2
  if (status === 'On Track') return 3
  return 4
}

function levelRank(level: LaunchExceptionSlaLevel) {
  if (level === 'Executive Review') return 0
  if (level === 'Action Handoff') return 1
  if (level === 'Owner Review') return 2
  return 3
}

function itemPriorityRank(priority: LaunchExceptionSlaPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000)
}

function parseDate(value: string) {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) return date
  return new Date()
}

function emitLaunchExceptionSlaRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | boolean | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
