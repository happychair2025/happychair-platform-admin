import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendClosureEvidenceBinder, BackendClosureEvidenceItem } from './backendClosureEvidenceBinder'
import type { ExecutiveGoNoGoEvidenceItem, ExecutiveGoNoGoRoom } from './executiveGoNoGoRoom'
import type { LaunchCommandItem, LaunchCommandModeModel } from './launchCommandMode'
import type { LaunchEvidenceEntry, LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchFollowUpItem, LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchWarRoomTimeline, LaunchWarRoomTimelineEvent } from './launchWarRoomTimeline'
import type { ProductionGuardrailItem, ProductionGuardrailMatrix } from './productionGuardrailMatrix'

export type LaunchCommandSavedViewStatus = 'Clear' | 'Review' | 'Blocked'
export type LaunchCommandSavedViewScope = 'Executive' | 'Owner' | 'Engineering' | 'Support' | 'Audit' | 'War Room'
export type LaunchCommandSavedViewSurface = 'command' | 'goNoGo' | 'backendClosure' | 'productionGuardrails' | 'followup' | 'warRoom'
export type LaunchCommandSavedViewResultStatus = 'Critical' | 'Action Needed' | 'Recorded' | 'Verified'

export interface LaunchCommandSavedViewFilter {
  label: string
  value: string
}

export interface LaunchCommandSavedViewResult {
  id: string
  status: LaunchCommandSavedViewResultStatus
  title: string
  owner: string
  source: string
  reference: string
  evidence: string
  nextStep: string
  updatedAt: string
  auditBacked: boolean
  localOnly: boolean
  surface: LaunchCommandSavedViewSurface
}

export interface LaunchCommandSavedView {
  id: string
  name: string
  scope: LaunchCommandSavedViewScope
  status: LaunchCommandSavedViewStatus
  audience: string
  description: string
  defaultSurface: LaunchCommandSavedViewSurface
  queryHint: string
  sort: string
  cadence: string
  filters: LaunchCommandSavedViewFilter[]
  columns: string[]
  results: LaunchCommandSavedViewResult[]
  resultCount: number
  criticalCount: number
  actionNeededCount: number
  recordedCount: number
  verifiedCount: number
  auditBackedCount: number
  ownerCount: number
  latestAt: string
  nextStep: string
}

export interface LaunchCommandSavedViewsModel {
  status: LaunchCommandSavedViewStatus
  summary: string
  generatedAt: string
  views: LaunchCommandSavedView[]
  totalResultCount: number
  blockedViewCount: number
  reviewViewCount: number
  clearViewCount: number
  criticalResultCount: number
  actionNeededResultCount: number
  auditBackedResultCount: number
  activeOwnerCount: number
  savedRecordCount: number
  latestRecord?: LaunchCommandSavedViewRecord
}

export interface LaunchCommandSavedViewRecord {
  id: string
  viewId: string
  viewName: string
  status: LaunchCommandSavedViewStatus
  scope: LaunchCommandSavedViewScope
  resultCount: number
  criticalCount: number
  actionNeededCount: number
  auditBackedCount: number
  ownerCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchCommandSavedViewsInput {
  readinessModel: LaunchReadinessModel
  commandMode: LaunchCommandModeModel
  launchWarRoomTimeline: LaunchWarRoomTimeline
  executiveGoNoGoRoom: ExecutiveGoNoGoRoom
  productionGuardrailMatrix: ProductionGuardrailMatrix
  backendClosureEvidenceBinder: BackendClosureEvidenceBinder
  followUpRegister: LaunchFollowUpRegisterModel
  evidenceLedger: LaunchEvidenceLedger
  records: LaunchCommandSavedViewRecord[]
}

interface SaveLaunchCommandSavedViewRecordInput {
  view: LaunchCommandSavedView
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_command_saved_view_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchCommandSavedViewRecord[] = []

export const launchCommandSavedViewBoundaryRule =
  'Launch command saved views are local review filters only. Saving, applying, or exporting a view does not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchCommandSavedViews(input: BuildLaunchCommandSavedViewsInput): LaunchCommandSavedViewsModel {
  const generatedAt = new Date().toISOString()
  const views = [
    buildExecutiveCommandView(input, generatedAt),
    buildOwnerBlockersView(input, generatedAt),
    buildEngineeringBackendView(input, generatedAt),
    buildSupportFollowUpView(input, generatedAt),
    buildAuditEvidenceView(input, generatedAt),
    buildWarRoomCriticalView(input, generatedAt),
  ].sort((a, b) => viewStatusRank(b.status) - viewStatusRank(a.status) || b.resultCount - a.resultCount || a.name.localeCompare(b.name))
  const blockedViewCount = views.filter(view => view.status === 'Blocked').length
  const reviewViewCount = views.filter(view => view.status === 'Review').length
  const clearViewCount = views.filter(view => view.status === 'Clear').length
  const criticalResultCount = views.reduce((total, view) => total + view.criticalCount, 0)
  const actionNeededResultCount = views.reduce((total, view) => total + view.actionNeededCount, 0)
  const auditBackedResultCount = views.reduce((total, view) => total + view.auditBackedCount, 0)
  const activeOwners = new Set(views.flatMap(view => view.results.filter(result => result.status !== 'Verified').map(result => result.owner)))
  const status = blockedViewCount > 0 ? 'Blocked' : reviewViewCount > 0 ? 'Review' : 'Clear'

  return {
    status,
    summary: getSavedViewsSummary(status, blockedViewCount, reviewViewCount, criticalResultCount, actionNeededResultCount),
    generatedAt,
    views,
    totalResultCount: views.reduce((total, view) => total + view.resultCount, 0),
    blockedViewCount,
    reviewViewCount,
    clearViewCount,
    criticalResultCount,
    actionNeededResultCount,
    auditBackedResultCount,
    activeOwnerCount: activeOwners.size,
    savedRecordCount: input.records.length,
    latestRecord: input.records[0],
  }
}

export function getLaunchCommandSavedViewRecords(): LaunchCommandSavedViewRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchCommandSavedViewRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchCommandSavedViewRecord(input: SaveLaunchCommandSavedViewRecordInput) {
  const record: LaunchCommandSavedViewRecord = {
    id: crypto.randomUUID(),
    viewId: input.view.id,
    viewName: input.view.name,
    status: input.view.status,
    scope: input.view.scope,
    resultCount: input.view.resultCount,
    criticalCount: input.view.criticalCount,
    actionNeededCount: input.view.actionNeededCount,
    auditBackedCount: input.view.auditBackedCount,
    ownerCount: input.view.ownerCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchCommandSavedViewRecords()].slice(0, 140)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchCommandSavedViewRecordChange()
  return record
}

export function subscribeToLaunchCommandSavedViewRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchCommandSavedViewRecords() {
  return useSyncExternalStore(subscribeToLaunchCommandSavedViewRecords, getLaunchCommandSavedViewRecords, () => [])
}

export function getLaunchCommandSavedViewTone(status: LaunchCommandSavedViewStatus | LaunchCommandSavedViewResultStatus): 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'Blocked' || status === 'Critical') return 'danger'
  if (status === 'Review' || status === 'Action Needed') return 'warn'
  if (status === 'Recorded') return 'info'
  return 'ok'
}

export function getLaunchCommandSavedViewFilename(view: LaunchCommandSavedView) {
  return `launch-command-saved-view-${view.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchCommandSavedViewHtml(view: LaunchCommandSavedView, session: AdminSession) {
  const filters = view.filters.map(filter => `
    <div><span>${escapeHtml(filter.label)}</span><strong>${escapeHtml(filter.value)}</strong></div>
  `).join('')
  const rows = view.results.map(result => `
    <tr>
      <td>${escapeHtml(result.updatedAt)}</td>
      <td>${escapeHtml(result.status)}</td>
      <td>${escapeHtml(result.title)}</td>
      <td>${escapeHtml(result.owner)}</td>
      <td>${escapeHtml(result.source)}</td>
      <td>${escapeHtml(result.reference)}</td>
      <td>${escapeHtml(result.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(view.name)}</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 17px; }
      p, td { line-height: 1.55; }
      .meta, .filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .meta div, .filters div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span, .filters span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong, .filters strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Launch Command Saved View</p>
        <h1>${escapeHtml(view.name)}</h1>
        <p>${escapeHtml(view.description)}</p>
        <p>${escapeHtml(launchCommandSavedViewBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(view.status)}</strong></div>
        <div><span>Scope</span><strong>${escapeHtml(view.scope)}</strong></div>
        <div><span>Results</span><strong>${view.resultCount}</strong></div>
        <div><span>Critical</span><strong>${view.criticalCount}</strong></div>
        <div><span>Action Needed</span><strong>${view.actionNeededCount}</strong></div>
        <div><span>Audit Backed</span><strong>${view.auditBackedCount}</strong></div>
        <div><span>Owners</span><strong>${view.ownerCount}</strong></div>
        <div><span>Generated By</span><strong>${escapeHtml(session.name)} / ${escapeHtml(session.email)}</strong></div>
      </section>
      <section>
        <h2>Filter Contract</h2>
        <div class="filters">${filters}</div>
      </section>
      <section>
        <h2>Results</h2>
        <table><thead><tr><th>Updated</th><th>Status</th><th>Result</th><th>Owner</th><th>Source</th><th>Reference</th><th>Next Step</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
    </main>
  </body>
</html>`
}

function buildExecutiveCommandView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const openExecutiveItems = input.executiveGoNoGoRoom.items
    .filter(item => item.status !== 'Clear')
    .map(resultFromExecutiveItem)
  const commandItems = input.commandMode.items
    .filter(item => item.type === 'Required Sign-Off')
    .slice(0, 8)
    .map(resultFromCommandItem)

  return createView({
    id: 'launch-sv-executive-command',
    name: 'Executive Command',
    scope: 'Executive',
    audience: 'Owner, Admin, Executive Ops',
    description: 'Final decision view for required Go / No-Go evidence, owner sign-offs, and unresolved executive conditions.',
    defaultSurface: 'goNoGo',
    queryHint: 'no go conditional required sign-off owner approval',
    sort: 'Critical first, then latest evidence',
    cadence: 'Before every launch decision meeting',
    filters: [
      { label: 'Decision', value: input.executiveGoNoGoRoom.decision },
      { label: 'Required evidence', value: 'Not clear or missing' },
      { label: 'Launch status', value: input.readinessModel.status },
      { label: 'Surface', value: 'Go / No-Go Evidence Room' },
    ],
    columns: ['Status', 'Evidence', 'Owner', 'Reference', 'Next step'],
    results: dedupeResults([...openExecutiveItems, ...commandItems]).slice(0, 24),
    generatedAt,
    fallbackStep: input.executiveGoNoGoRoom.nextItem?.nextStep ?? 'Keep executive decision evidence attached to the launch packet.',
  })
}

function buildOwnerBlockersView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const commandResults = input.commandMode.items
    .filter(item => item.status !== 'Ready' || item.type === 'Required Sign-Off')
    .map(resultFromCommandItem)
  const ownerWarRoomResults = input.launchWarRoomTimeline.events
    .filter(event => event.status === 'Critical' || event.status === 'Action Needed')
    .filter(event => event.owner === 'Owner' || event.owner === 'Admin' || event.lane === 'Approval' || event.lane === 'Executive Decision')
    .map(resultFromWarRoomEvent)

  return createView({
    id: 'launch-sv-owner-blockers',
    name: 'Owner Blockers',
    scope: 'Owner',
    audience: 'Owner, Admin',
    description: 'Focused view of launch blockers, required sign-offs, approval gaps, and executive items that need a named owner decision.',
    defaultSurface: 'command',
    queryHint: 'blocked deferred assigned owner approval',
    sort: 'Blocked first, then owner decision age',
    cadence: 'Daily until launch close',
    filters: [
      { label: 'Status', value: 'Blocked, Watch, or Action Needed' },
      { label: 'Owner', value: 'Owner/Admin/approval lane' },
      { label: 'Decision packets', value: `${input.commandMode.decisionCount} open` },
      { label: 'Surface', value: 'Command Mode' },
    ],
    columns: ['Status', 'Decision', 'Owner', 'Reference', 'Next step'],
    results: dedupeResults([...commandResults, ...ownerWarRoomResults]).slice(0, 28),
    generatedAt,
    fallbackStep: input.commandMode.nextItem?.nextDecision ?? 'No owner blocker is open in the current launch model.',
  })
}

function buildEngineeringBackendView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const closureResults = input.backendClosureEvidenceBinder.items
    .filter(item => item.status !== 'Closed')
    .map(resultFromBackendClosureItem)
  const guardrailResults = input.productionGuardrailMatrix.items
    .filter(item => item.status !== 'Verified')
    .map(resultFromProductionGuardrailItem)
  const backendWarRoomResults = input.launchWarRoomTimeline.events
    .filter(event => (event.lane === 'Backend' || event.lane === 'Guardrail') && event.status !== 'Verified')
    .map(resultFromWarRoomEvent)

  return createView({
    id: 'launch-sv-engineering-backend',
    name: 'Engineering Backend',
    scope: 'Engineering',
    audience: 'Engineering, Admin',
    description: 'Backend closure and production guardrail view for handlers, rollback proof, audit proof, and browser mutation boundaries.',
    defaultSurface: 'backendClosure',
    queryHint: 'backend guardrail closure handler audit rollback dry run',
    sort: 'Critical risk first, then closure readiness',
    cadence: 'Engineering launch standup',
    filters: [
      { label: 'Backend closure', value: input.backendClosureEvidenceBinder.status },
      { label: 'Guardrails', value: input.productionGuardrailMatrix.status },
      { label: 'Browser boundary', value: `${input.productionGuardrailMatrix.browserSafeCount}/${input.productionGuardrailMatrix.totalCount} safe` },
      { label: 'Surface', value: 'Backend Closure / Guardrails' },
    ],
    columns: ['Status', 'Handler', 'Owner', 'Permission', 'Next step'],
    results: dedupeResults([...closureResults, ...guardrailResults, ...backendWarRoomResults]).slice(0, 32),
    generatedAt,
    fallbackStep: input.productionGuardrailMatrix.nextItem?.nextStep ?? input.backendClosureEvidenceBinder.nextItem?.nextStep ?? 'Backend closure and production guardrails are clear.',
  })
}

function buildSupportFollowUpView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const followUpResults = input.followUpRegister.items
    .filter(item => item.status !== 'Resolved')
    .map(resultFromFollowUpItem)
  const timelineResults = input.launchWarRoomTimeline.events
    .filter(event => event.lane === 'Follow-Up' && event.status !== 'Verified')
    .map(resultFromWarRoomEvent)

  return createView({
    id: 'launch-sv-support-follow-up',
    name: 'Support Follow-Up',
    scope: 'Support',
    audience: 'Support Lead, Client Success, Admin',
    description: 'Launch follow-up view for approval conditions, manifest gaps, read contract issues, and action queue items that need a support-safe owner.',
    defaultSurface: 'followup',
    queryHint: 'follow-up blocked open support client success condition',
    sort: 'Critical follow-up first, then due before approval',
    cadence: 'Twice daily through launch window',
    filters: [
      { label: 'Open', value: String(input.followUpRegister.openCount) },
      { label: 'Blocked', value: String(input.followUpRegister.blockedCount) },
      { label: 'Critical', value: String(input.followUpRegister.criticalCount) },
      { label: 'Surface', value: 'Launch Follow-Up' },
    ],
    columns: ['Status', 'Follow-up', 'Owner', 'Due', 'Next step'],
    results: dedupeResults([...followUpResults, ...timelineResults]).slice(0, 24),
    generatedAt,
    fallbackStep: input.followUpRegister.nextItem?.nextStep ?? 'No support follow-up is open for this launch model.',
  })
}

function buildAuditEvidenceView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const auditResults = input.evidenceLedger.entries
    .filter(entry => entry.source === 'Audit Ledger' || entry.type === 'Report Export' || entry.type === 'Action Queue' || entry.type === 'Read Contract')
    .map(resultFromEvidenceEntry)
  const timelineResults = input.launchWarRoomTimeline.events
    .filter(event => event.auditEventId || event.localOnly)
    .slice(0, 80)
    .map(resultFromWarRoomEvent)

  return createView({
    id: 'launch-sv-audit-evidence',
    name: 'Audit Evidence',
    scope: 'Audit',
    audience: 'Admin, Engineering, Owner',
    description: 'Evidence trail view for audit-backed launch activity, local-only review artifacts, exports, read contracts, and action queue proof.',
    defaultSurface: 'warRoom',
    queryHint: 'audit export local evidence action request read contract',
    sort: 'Unaudited critical items first, then latest audit event',
    cadence: 'Before executive packet export',
    filters: [
      { label: 'Audit events', value: String(input.evidenceLedger.auditEventCount) },
      { label: 'Exports', value: String(input.evidenceLedger.exportCount) },
      { label: 'Action queue', value: String(input.evidenceLedger.actionQueueCount) },
      { label: 'Surface', value: 'War Room Timeline' },
    ],
    columns: ['Status', 'Evidence', 'Source', 'Audit', 'Next step'],
    results: dedupeResults([...auditResults, ...timelineResults]).slice(0, 32),
    generatedAt,
    fallbackStep: 'Keep audit-backed launch evidence attached before executive decision export.',
  })
}

function buildWarRoomCriticalView(input: BuildLaunchCommandSavedViewsInput, generatedAt: string) {
  const results = input.launchWarRoomTimeline.events
    .filter(event => event.status === 'Critical' || event.status === 'Action Needed')
    .map(resultFromWarRoomEvent)

  return createView({
    id: 'launch-sv-war-room-critical',
    name: 'War Room Critical',
    scope: 'War Room',
    audience: 'Launch Command Team',
    description: 'Immediate launch coordination view for critical timeline events and action-needed items across every operational lane.',
    defaultSurface: 'warRoom',
    queryHint: 'critical action needed war room launch lane',
    sort: 'Critical first, latest event next',
    cadence: 'Live during launch window',
    filters: [
      { label: 'Critical', value: String(input.launchWarRoomTimeline.criticalCount) },
      { label: 'Action needed', value: String(input.launchWarRoomTimeline.actionNeededCount) },
      { label: 'Active owners', value: String(input.launchWarRoomTimeline.activeOwnerCount) },
      { label: 'Surface', value: 'War Room Timeline' },
    ],
    columns: ['Status', 'Event', 'Lane', 'Owner', 'Next step'],
    results: dedupeResults(results).slice(0, 30),
    generatedAt,
    fallbackStep: input.launchWarRoomTimeline.nextEvent?.nextStep ?? 'No critical war room event is open.',
  })
}

function createView(input: Omit<LaunchCommandSavedView, 'status' | 'resultCount' | 'criticalCount' | 'actionNeededCount' | 'recordedCount' | 'verifiedCount' | 'auditBackedCount' | 'ownerCount' | 'latestAt' | 'nextStep'> & { generatedAt: string, fallbackStep: string }): LaunchCommandSavedView {
  const results = input.results
  const criticalCount = results.filter(result => result.status === 'Critical').length
  const actionNeededCount = results.filter(result => result.status === 'Action Needed').length
  const recordedCount = results.filter(result => result.status === 'Recorded').length
  const verifiedCount = results.filter(result => result.status === 'Verified').length
  const status = criticalCount > 0 ? 'Blocked' : actionNeededCount > 0 || recordedCount > 0 ? 'Review' : 'Clear'
  const openResults = results.filter(result => result.status !== 'Verified')

  return {
    id: input.id,
    name: input.name,
    scope: input.scope,
    status,
    audience: input.audience,
    description: input.description,
    defaultSurface: input.defaultSurface,
    queryHint: input.queryHint,
    sort: input.sort,
    cadence: input.cadence,
    filters: input.filters,
    columns: input.columns,
    results,
    resultCount: results.length,
    criticalCount,
    actionNeededCount,
    recordedCount,
    verifiedCount,
    auditBackedCount: results.filter(result => result.auditBacked).length,
    ownerCount: new Set(openResults.map(result => result.owner)).size,
    latestAt: latestResultDate(results, input.generatedAt),
    nextStep: openResults[0]?.nextStep ?? input.fallbackStep,
  }
}

function resultFromExecutiveItem(item: ExecutiveGoNoGoEvidenceItem): LaunchCommandSavedViewResult {
  return {
    id: `executive-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Condition' ? 'Action Needed' : 'Verified',
    title: item.title,
    owner: item.owner,
    source: item.category,
    reference: item.reference,
    evidence: item.evidence,
    nextStep: item.nextStep,
    updatedAt: item.updatedAt,
    auditBacked: item.auditBacked,
    localOnly: true,
    surface: 'goNoGo',
  }
}

function resultFromCommandItem(item: LaunchCommandItem): LaunchCommandSavedViewResult {
  return {
    id: `command-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Watch' ? 'Action Needed' : 'Verified',
    title: item.title,
    owner: item.owner,
    source: item.type,
    reference: item.reference,
    evidence: item.whyItMatters,
    nextStep: item.nextDecision,
    updatedAt: item.createdAt,
    auditBacked: false,
    localOnly: true,
    surface: 'command',
  }
}

function resultFromWarRoomEvent(event: LaunchWarRoomTimelineEvent): LaunchCommandSavedViewResult {
  return {
    id: `war-room-${event.id}`,
    status: event.status,
    title: event.title,
    owner: event.owner,
    source: event.lane,
    reference: event.reference,
    evidence: event.evidence,
    nextStep: event.nextStep,
    updatedAt: event.occurredAt,
    auditBacked: Boolean(event.auditEventId),
    localOnly: event.localOnly,
    surface: event.lane === 'Follow-Up'
      ? 'followup'
      : event.lane === 'Backend' || event.lane === 'Closure'
        ? 'backendClosure'
        : event.lane === 'Guardrail'
          ? 'productionGuardrails'
          : event.lane === 'Executive Decision'
            ? 'goNoGo'
            : 'warRoom',
  }
}

function resultFromBackendClosureItem(item: BackendClosureEvidenceItem): LaunchCommandSavedViewResult {
  return {
    id: `backend-closure-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Closed' ? 'Verified' : item.status === 'Packet Ready' ? 'Recorded' : 'Action Needed',
    title: item.handlerLabel,
    owner: item.closureOwner,
    source: 'Backend Closure',
    reference: item.endpoint,
    evidence: item.closureSummary,
    nextStep: item.nextStep,
    updatedAt: item.reviewedAt ?? item.generatedAt,
    auditBacked: item.auditEventCount > 0 || Boolean(item.auditEventId),
    localOnly: true,
    surface: 'backendClosure',
  }
}

function resultFromProductionGuardrailItem(item: ProductionGuardrailItem): LaunchCommandSavedViewResult {
  return {
    id: `production-guardrail-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Verified' ? 'Verified' : item.status === 'Ready For Production Review' ? 'Recorded' : 'Action Needed',
    title: item.handlerLabel,
    owner: item.guardrailOwner,
    source: 'Production Guardrail',
    reference: item.permission,
    evidence: item.productionBoundary,
    nextStep: item.nextStep,
    updatedAt: item.reviewedAt ?? item.generatedAt,
    auditBacked: item.auditEventCount > 0 || Boolean(item.auditEventId),
    localOnly: true,
    surface: 'productionGuardrails',
  }
}

function resultFromFollowUpItem(item: LaunchFollowUpItem): LaunchCommandSavedViewResult {
  return {
    id: `follow-up-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Resolved' ? 'Verified' : item.status === 'In Progress' ? 'Recorded' : 'Action Needed',
    title: item.title,
    owner: item.owner,
    source: item.source,
    reference: item.reference,
    evidence: item.evidence,
    nextStep: item.nextStep,
    updatedAt: item.updatedAt ?? item.createdAt,
    auditBacked: item.auditBacked || Boolean(item.auditEventId),
    localOnly: true,
    surface: 'followup',
  }
}

function resultFromEvidenceEntry(entry: LaunchEvidenceEntry): LaunchCommandSavedViewResult {
  return {
    id: `evidence-${entry.id}`,
    status: entry.status === 'Blocked' ? 'Critical' : entry.status === 'Watch' ? 'Action Needed' : 'Verified',
    title: `${entry.type}: ${entry.reference}`,
    owner: entry.owner,
    source: entry.source,
    reference: entry.reference,
    evidence: entry.evidence,
    nextStep: entry.nextStep,
    updatedAt: entry.createdAt,
    auditBacked: entry.source === 'Audit Ledger' || entry.type === 'Report Export',
    localOnly: true,
    surface: 'warRoom',
  }
}

function dedupeResults(results: LaunchCommandSavedViewResult[]) {
  const resultById = new Map<string, LaunchCommandSavedViewResult>()
  results.forEach(result => {
    if (!resultById.has(result.id)) resultById.set(result.id, result)
  })
  return Array.from(resultById.values()).sort((a, b) => resultStatusRank(b.status) - resultStatusRank(a.status) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || a.title.localeCompare(b.title))
}

function latestResultDate(results: LaunchCommandSavedViewResult[], fallback: string) {
  if (!results.length) return fallback
  return results.reduce((latest, result) => new Date(result.updatedAt).getTime() > new Date(latest).getTime() ? result.updatedAt : latest, results[0].updatedAt)
}

function getSavedViewsSummary(status: LaunchCommandSavedViewStatus, blockedViews: number, reviewViews: number, criticalResults: number, actionNeededResults: number) {
  if (status === 'Blocked') return `${blockedViews} saved views are pointing at ${criticalResults} critical launch results.`
  if (status === 'Review') return `${reviewViews} saved views have ${actionNeededResults} action-needed launch results.`
  return 'All launch command saved views are clear for the current review model.'
}

function viewStatusRank(status: LaunchCommandSavedViewStatus) {
  if (status === 'Blocked') return 3
  if (status === 'Review') return 2
  return 1
}

function resultStatusRank(status: LaunchCommandSavedViewResultStatus) {
  if (status === 'Critical') return 4
  if (status === 'Action Needed') return 3
  if (status === 'Recorded') return 2
  return 1
}

function emitLaunchCommandSavedViewRecordChange() {
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
