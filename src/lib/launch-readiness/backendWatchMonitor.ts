import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { MockServerExecutionRecord } from '../admin-actions/mockServerExecutor'
import type { AuditEvent } from '../audit/auditLog'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendReleaseCommandCenter,
  BackendReleaseCommandItem,
  BackendReleaseCommandLane,
  BackendReleaseCommandStatus,
} from './backendReleaseCommandCenter'

export type BackendWatchMonitorStatus = 'Critical Drift' | 'Watch' | 'Stable' | 'Verified'
export type BackendWatchSignalStatus = 'Critical' | 'Watch' | 'Stable' | 'Verified'
export type BackendWatchSignalType = 'Release' | 'Audit' | 'Dry Run' | 'Queue' | 'Rollback' | 'Support' | 'Monitoring'

export interface BackendWatchSignal {
  id: string
  type: BackendWatchSignalType
  label: string
  status: BackendWatchSignalStatus
  detail: string
  recommendedAction: string
}

export interface BackendWatchItem {
  id: string
  releaseCommandItemId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: BackendWatchMonitorStatus
  recommendedStatus: BackendWatchMonitorStatus
  releaseStatus: BackendReleaseCommandStatus
  lane: BackendReleaseCommandLane
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  releaseOwner: string
  watchOwner: string
  releaseWindow: string
  goNoGo: string
  queuedRequestCount: number
  activeRequestCount: number
  completedRequestCount: number
  blockedRequestCount: number
  failedRequestCount: number
  auditEventCount: number
  dryRunProofCount: number
  supportFollowUpCount: number
  rollbackReady: boolean
  monitoringReady: boolean
  criticalSignalCount: number
  watchSignalCount: number
  stableSignalCount: number
  verifiedSignalCount: number
  signals: BackendWatchSignal[]
  watchPlan: string
  rollbackPlan: string
  auditPlan: string
  supportPlan: string
  nextStep: string
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendWatchMonitor {
  status: BackendWatchMonitorStatus
  summary: string
  generatedAt: string
  items: BackendWatchItem[]
  nextItem?: BackendWatchItem
  totalCount: number
  criticalCount: number
  watchCount: number
  stableCount: number
  verifiedCount: number
  releaseCandidateCount: number
  releaseVerifiedCount: number
  rollbackReadyCount: number
  auditBackedCount: number
  dryRunBackedCount: number
  supportFollowUpCount: number
  signalGroups: BackendWatchSignalGroup[]
  ownerGroups: BackendWatchOwnerGroup[]
}

export interface BackendWatchSignalGroup {
  type: BackendWatchSignalType
  total: number
  critical: number
  watch: number
  stable: number
  verified: number
  nextStep: string
}

export interface BackendWatchOwnerGroup {
  owner: string
  total: number
  critical: number
  watch: number
  stable: number
  verified: number
  criticalSignalCount: number
  watchSignalCount: number
  nextStep: string
}

export interface BackendWatchRecord {
  id: string
  itemId: string
  status: BackendWatchMonitorStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendWatchMonitorInput {
  releaseCommandCenter: BackendReleaseCommandCenter
  actionRequests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  mockServerExecutions: MockServerExecutionRecord[]
  records: BackendWatchRecord[]
}

interface SaveBackendWatchRecordInput {
  item: BackendWatchItem
  status: BackendWatchMonitorStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_watch_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendWatchRecord[] = []

export const backendWatchMonitorBoundaryRule =
  'Backend watch records are monitoring and review artifacts only. They do not run handlers, deploy code, roll back production, mutate data, change billing, alter modules, change permissions, impersonate users, or execute agent actions from Platform Admin.'

export const backendWatchMonitorStatuses: BackendWatchMonitorStatus[] = [
  'Critical Drift',
  'Watch',
  'Stable',
  'Verified',
]

export function buildBackendWatchMonitor({
  releaseCommandCenter,
  actionRequests,
  auditEvents,
  mockServerExecutions,
  records,
}: BuildBackendWatchMonitorInput): BackendWatchMonitor {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const items = releaseCommandCenter.items
    .map(item => withLatestRecord(createItem(item, actionRequests, auditEvents, mockServerExecutions, generatedAt), latestRecordByItem.get(getItemId(item))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openItems = items.filter(item => item.status !== 'Verified')
  const criticalCount = items.filter(item => item.status === 'Critical Drift').length
  const watchCount = items.filter(item => item.status === 'Watch').length
  const stableCount = items.filter(item => item.status === 'Stable').length
  const verifiedCount = items.filter(item => item.status === 'Verified').length
  const status = getAggregateStatus(items)

  return {
    status,
    summary: getMonitorSummary(status, criticalCount, watchCount, stableCount, verifiedCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    criticalCount,
    watchCount,
    stableCount,
    verifiedCount,
    releaseCandidateCount: items.filter(item => item.releaseStatus === 'Release Candidate').length,
    releaseVerifiedCount: items.filter(item => item.releaseStatus === 'Release Verified').length,
    rollbackReadyCount: items.filter(item => item.rollbackReady).length,
    auditBackedCount: items.filter(item => Boolean(item.auditEventId) || item.auditEventCount > 0).length,
    dryRunBackedCount: items.filter(item => item.dryRunProofCount > 0).length,
    supportFollowUpCount: items.reduce((total, item) => total + item.supportFollowUpCount, 0),
    signalGroups: buildSignalGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getBackendWatchRecords(): BackendWatchRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendWatchRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendWatchRecord(input: SaveBackendWatchRecordInput) {
  const record: BackendWatchRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultWatchNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendWatchRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendWatchRecordChange()
  return record
}

export function subscribeToBackendWatchRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendWatchRecords() {
  return useSyncExternalStore(subscribeToBackendWatchRecords, getBackendWatchRecords, () => [])
}

export function getBackendWatchMonitorTone(status: BackendWatchMonitorStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Stable') return 'ok'
  if (status === 'Critical Drift') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'neutral'
}

export function getBackendWatchSignalTone(status: BackendWatchSignalStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Stable') return 'ok'
  if (status === 'Critical') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'neutral'
}

export function getBackendWatchRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendWatchFilename(item: BackendWatchItem) {
  return `backend-watch-monitor-${item.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendWatchHtml(item: BackendWatchItem, session: AdminSession) {
  const signalRows = item.signals.map(signal => `
    <tr>
      <td>${escapeHtml(signal.type)}</td>
      <td>${escapeHtml(signal.label)}</td>
      <td>${escapeHtml(signal.status)}</td>
      <td>${escapeHtml(signal.detail)}</td>
      <td>${escapeHtml(signal.recommendedAction)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.handlerLabel)} backend watch monitor</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1120px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
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
        <p>Happy Chair Platform Admin / Backend Watch Monitor</p>
        <h1>${escapeHtml(item.handlerLabel)}</h1>
        <p>${escapeHtml(backendWatchMonitorBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
        <div><span>Release Status</span><strong>${escapeHtml(item.releaseStatus)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(item.risk)}</strong></div>
        <div><span>Watch Owner</span><strong>${escapeHtml(item.watchOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(item.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(item.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${item.method} ${item.endpoint}`)}</strong></div>
        <div><span>Window</span><strong>${escapeHtml(item.releaseWindow)}</strong></div>
      </section>
      <section>
        <h2>Watch Signals</h2>
        <table><thead><tr><th>Type</th><th>Signal</th><th>Status</th><th>Detail</th><th>Action</th></tr></thead><tbody>${signalRows}</tbody></table>
      </section>
      <section>
        <h2>Watch Plan</h2>
        <p><strong>Watch:</strong> ${escapeHtml(item.watchPlan)}</p>
        <p><strong>Rollback:</strong> ${escapeHtml(item.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(item.auditPlan)}</p>
        <p><strong>Support:</strong> ${escapeHtml(item.supportPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createItem(
  item: BackendReleaseCommandItem,
  actionRequests: AdminActionRequest[],
  auditEvents: AuditEvent[],
  mockServerExecutions: MockServerExecutionRecord[],
  generatedAt: string,
): BackendWatchItem {
  const handlerRequests = actionRequests.filter(request => matchesHandler(request.serverHandler.key, item) || matchesMetadataHandler(request.metadata, item))
  const handlerAuditEvents = auditEvents.filter(event => matchesMetadataHandler(event.metadata, item) || event.actionKey.includes(item.handlerKey) || event.scope.includes(item.handlerKey))
  const handlerExecutions = mockServerExecutions.filter(execution => execution.handlerKey === item.handlerKey)
  const blockedRequestCount = handlerRequests.filter(request => request.status === 'Blocked').length
  const failedRequestCount = handlerRequests.filter(request => request.status === 'Failed').length
  const queuedRequestCount = item.queuedRequestCount + handlerRequests.filter(request => request.status === 'Queued' || request.status === 'Approved' || request.status === 'Running').length
  const activeRequestCount = item.activeRequestCount + handlerRequests.filter(request => request.status === 'Approved' || request.status === 'Running').length
  const completedRequestCount = item.completedRequestCount + handlerRequests.filter(request => request.status === 'Completed').length
  const auditEventCount = item.auditEventCount + handlerAuditEvents.length
  const dryRunProofCount = item.dryRunProofCount + handlerExecutions.filter(execution => execution.status === 'Dry Run Passed' || execution.status === 'Completed Snapshot').length
  const supportFollowUpCount = handlerRequests.filter(request => request.status === 'Blocked' || request.status === 'Failed' || request.status === 'Queued' || request.status === 'Approved' || request.status === 'Running').length
  const rollbackReady = Boolean(item.rollbackPlan.trim())
  const monitoringReady = Boolean(item.monitoringPlan.trim())
  const signals = buildSignals({
    item,
    queuedRequestCount,
    activeRequestCount,
    completedRequestCount,
    blockedRequestCount,
    failedRequestCount,
    auditEventCount,
    dryRunProofCount,
    supportFollowUpCount,
    rollbackReady,
    monitoringReady,
  })
  const criticalSignalCount = signals.filter(signal => signal.status === 'Critical').length
  const watchSignalCount = signals.filter(signal => signal.status === 'Watch').length
  const stableSignalCount = signals.filter(signal => signal.status === 'Stable').length
  const verifiedSignalCount = signals.filter(signal => signal.status === 'Verified').length
  const recommendedStatus = getRecommendedStatus(signals)

  return {
    id: getItemId(item),
    releaseCommandItemId: item.id,
    handlerKey: item.handlerKey,
    handlerLabel: item.handlerLabel,
    method: item.method,
    endpoint: item.endpoint,
    permission: item.permission,
    mutationMode: item.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    releaseStatus: item.status,
    lane: item.lane,
    risk: item.risk,
    productOwner: item.productOwner,
    engineeringOwner: item.engineeringOwner,
    releaseOwner: item.releaseOwner,
    watchOwner: item.releaseOwner,
    releaseWindow: item.releaseWindow,
    goNoGo: item.goNoGo,
    queuedRequestCount,
    activeRequestCount,
    completedRequestCount,
    blockedRequestCount,
    failedRequestCount,
    auditEventCount,
    dryRunProofCount,
    supportFollowUpCount,
    rollbackReady,
    monitoringReady,
    criticalSignalCount,
    watchSignalCount,
    stableSignalCount,
    verifiedSignalCount,
    signals,
    watchPlan: item.monitoringPlan,
    rollbackPlan: item.rollbackPlan,
    auditPlan: item.auditPlan,
    supportPlan: getSupportPlan(supportFollowUpCount, blockedRequestCount, failedRequestCount, item.handlerLabel),
    nextStep: getNextStep(recommendedStatus, item.handlerLabel, criticalSignalCount, watchSignalCount),
    generatedAt,
  }
}

function buildSignals(input: {
  item: BackendReleaseCommandItem
  queuedRequestCount: number
  activeRequestCount: number
  completedRequestCount: number
  blockedRequestCount: number
  failedRequestCount: number
  auditEventCount: number
  dryRunProofCount: number
  supportFollowUpCount: number
  rollbackReady: boolean
  monitoringReady: boolean
}): BackendWatchSignal[] {
  return [
    signal(
      'release-posture',
      'Release',
      'Release posture',
      getReleaseSignalStatus(input.item.status),
      `${input.item.handlerLabel} release command is ${input.item.status} with ${input.item.goNoGo} go/no-go posture.`,
      getReleaseSignalAction(input.item.status, input.item.handlerLabel),
    ),
    signal(
      'audit-evidence',
      'Audit',
      'Audit coverage',
      input.auditEventCount || input.item.auditEventId ? 'Verified' : 'Watch',
      input.auditEventCount || input.item.auditEventId
        ? `${input.auditEventCount} matching audit event${input.auditEventCount === 1 ? '' : 's'} plus local review evidence are available.`
        : 'No matching audit evidence is attached to the watch record yet.',
      input.auditEventCount || input.item.auditEventId ? 'Keep audit chain visible during watch.' : 'Record a watch review or attach audit evidence before closure.',
    ),
    signal(
      'dry-run-proof',
      'Dry Run',
      'Dry-run proof',
      input.dryRunProofCount ? 'Verified' : input.item.status === 'Blocked' || input.item.status === 'Build Planning' ? 'Stable' : 'Watch',
      input.dryRunProofCount
        ? `${input.dryRunProofCount} dry-run proof record${input.dryRunProofCount === 1 ? '' : 's'} are available.`
        : 'No dry-run proof record is visible for this handler yet.',
      input.dryRunProofCount ? 'Keep dry-run evidence linked to release watch.' : 'Collect dry-run proof before verified watch closure.',
    ),
    signal(
      'queue-state',
      'Queue',
      'Action queue state',
      input.blockedRequestCount || input.failedRequestCount ? 'Critical' : input.activeRequestCount || input.queuedRequestCount ? 'Stable' : input.completedRequestCount ? 'Verified' : 'Watch',
      input.blockedRequestCount || input.failedRequestCount
        ? `${input.blockedRequestCount} blocked and ${input.failedRequestCount} failed request${input.failedRequestCount === 1 ? '' : 's'} need review.`
        : input.activeRequestCount || input.queuedRequestCount
          ? `${input.queuedRequestCount} queued request${input.queuedRequestCount === 1 ? '' : 's'} with ${input.activeRequestCount} active.`
          : input.completedRequestCount
            ? `${input.completedRequestCount} completed request snapshot${input.completedRequestCount === 1 ? '' : 's'} are available.`
            : 'No queue activity is visible for this handler.',
      input.blockedRequestCount || input.failedRequestCount
        ? 'Review the blocked or failed request before moving watch status forward.'
        : input.queuedRequestCount
          ? 'Keep request owner engaged until server-side work closes.'
          : 'Queue follow-up only if release watch needs support or engineering action.',
    ),
    signal(
      'rollback-ready',
      'Rollback',
      'Rollback readiness',
      input.rollbackReady ? 'Stable' : 'Critical',
      input.rollbackReady ? input.item.rollbackPlan : 'No rollback plan is attached.',
      input.rollbackReady ? 'Keep rollback owner visible through the watch window.' : 'Attach rollback plan before watch can be considered stable.',
    ),
    signal(
      'support-load',
      'Support',
      'Support follow-up load',
      input.blockedRequestCount || input.failedRequestCount ? 'Critical' : input.supportFollowUpCount ? 'Watch' : 'Stable',
      input.supportFollowUpCount
        ? `${input.supportFollowUpCount} open support or engineering follow-up request${input.supportFollowUpCount === 1 ? '' : 's'} are linked.`
        : 'No open support follow-up load is linked to this handler.',
      input.supportFollowUpCount ? 'Keep follow-up owner assigned until the watch record is closed.' : 'No support escalation is required unless watch signals drift.',
    ),
    signal(
      'monitoring-ready',
      'Monitoring',
      'Monitoring plan',
      input.monitoringReady ? input.item.status === 'Release Verified' ? 'Verified' : 'Stable' : 'Watch',
      input.monitoringReady ? input.item.monitoringPlan : 'No monitoring plan is attached.',
      input.monitoringReady ? 'Continue watching permission denials, validation failures, duration spikes, rollback events, and support-visible activity.' : 'Attach monitoring plan before watch closure.',
    ),
  ]
}

function signal(
  id: string,
  type: BackendWatchSignalType,
  label: string,
  status: BackendWatchSignalStatus,
  detail: string,
  recommendedAction: string,
): BackendWatchSignal {
  return { id, type, label, status, detail, recommendedAction }
}

function withLatestRecord(
  item: BackendWatchItem,
  record: BackendWatchRecord | undefined,
): BackendWatchItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    watchOwner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    nextStep: getNextStep(record.status, item.handlerLabel, item.criticalSignalCount, item.watchSignalCount),
  }
}

function buildSignalGroups(items: BackendWatchItem[]): BackendWatchSignalGroup[] {
  const signalTypes: BackendWatchSignalType[] = ['Release', 'Audit', 'Dry Run', 'Queue', 'Rollback', 'Support', 'Monitoring']
  return signalTypes.map(type => {
    const signals = items.flatMap(item => item.signals.filter(signal => signal.type === type))
    const critical = signals.filter(signal => signal.status === 'Critical').length
    const watch = signals.filter(signal => signal.status === 'Watch').length
    const stable = signals.filter(signal => signal.status === 'Stable').length
    const verified = signals.filter(signal => signal.status === 'Verified').length
    return {
      type,
      total: signals.length,
      critical,
      watch,
      stable,
      verified,
      nextStep: signals.length
        ? critical
          ? `Resolve critical ${type.toLowerCase()} signals.`
          : watch
            ? `Review ${type.toLowerCase()} watch signals.`
            : stable
              ? `Keep ${type.toLowerCase()} signals under watch.`
              : `All ${type.toLowerCase()} signals are verified.`
        : `No ${type.toLowerCase()} signals.`,
    }
  })
}

function buildOwnerGroups(items: BackendWatchItem[]): BackendWatchOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.watchOwner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.watchOwner === owner)
    const critical = ownerItems.filter(item => item.status === 'Critical Drift').length
    const watch = ownerItems.filter(item => item.status === 'Watch').length
    const stable = ownerItems.filter(item => item.status === 'Stable').length
    const verified = ownerItems.filter(item => item.status === 'Verified').length
    const criticalSignalCount = ownerItems.reduce((total, item) => total + item.criticalSignalCount, 0)
    const watchSignalCount = ownerItems.reduce((total, item) => total + item.watchSignalCount, 0)
    return {
      owner,
      total: ownerItems.length,
      critical,
      watch,
      stable,
      verified,
      criticalSignalCount,
      watchSignalCount,
      nextStep: critical
        ? 'Clear critical drift signals before closure.'
        : watch
          ? 'Record watch review and keep release owner engaged.'
          : stable
            ? 'Monitor stable handlers until verified.'
            : 'Maintain verified watch evidence.',
    }
  }).sort((a, b) => b.critical - a.critical || b.watch - a.watch || b.criticalSignalCount - a.criticalSignalCount || a.owner.localeCompare(b.owner))
}

function getReleaseSignalStatus(status: BackendReleaseCommandStatus): BackendWatchSignalStatus {
  if (status === 'Blocked') return 'Critical'
  if (status === 'Build Planning') return 'Watch'
  if (status === 'Release Verified') return 'Verified'
  return 'Stable'
}

function getReleaseSignalAction(status: BackendReleaseCommandStatus, handlerLabel: string) {
  if (status === 'Blocked') return `Clear release blockers before ${handlerLabel} can enter watch.`
  if (status === 'Build Planning') return `Complete release planning before ${handlerLabel} can stabilize.`
  if (status === 'Release Candidate') return `Watch ${handlerLabel} through go/no-go evidence and owner review.`
  if (status === 'Release Verified') return `Keep ${handlerLabel} in verified watch until closure evidence is exported.`
  return `Keep ${handlerLabel} on the release path and record watch review after owner approval.`
}

function getRecommendedStatus(signals: BackendWatchSignal[]): BackendWatchMonitorStatus {
  if (signals.some(signal => signal.status === 'Critical')) return 'Critical Drift'
  if (signals.some(signal => signal.status === 'Watch')) return 'Watch'
  if (signals.every(signal => signal.status === 'Verified')) return 'Verified'
  return 'Stable'
}

function getAggregateStatus(items: BackendWatchItem[]): BackendWatchMonitorStatus {
  if (!items.length) return 'Verified'
  if (items.some(item => item.status === 'Critical Drift')) return 'Critical Drift'
  if (items.some(item => item.status === 'Watch')) return 'Watch'
  if (items.some(item => item.status === 'Stable')) return 'Stable'
  return 'Verified'
}

function getMonitorSummary(
  status: BackendWatchMonitorStatus,
  criticalCount: number,
  watchCount: number,
  stableCount: number,
  verifiedCount: number,
) {
  if (status === 'Critical Drift') return `${criticalCount} backend watch item${criticalCount === 1 ? '' : 's'} show critical drift.`
  if (status === 'Watch') return `${watchCount} backend watch item${watchCount === 1 ? '' : 's'} need review.`
  if (status === 'Stable') return `${stableCount} backend watch item${stableCount === 1 ? '' : 's'} are stable under watch.`
  return `${verifiedCount} backend watch item${verifiedCount === 1 ? '' : 's'} are verified.`
}

function getNextStep(
  status: BackendWatchMonitorStatus,
  handlerLabel: string,
  criticalSignalCount: number,
  watchSignalCount: number,
) {
  if (status === 'Critical Drift') return `Review ${criticalSignalCount} critical signal${criticalSignalCount === 1 ? '' : 's'} before ${handlerLabel} can advance.`
  if (status === 'Watch') return `Record watch review and resolve ${watchSignalCount} watch signal${watchSignalCount === 1 ? '' : 's'} for ${handlerLabel}.`
  if (status === 'Stable') return `Monitor ${handlerLabel} through the release window and keep rollback/audit proof visible.`
  return `${handlerLabel} backend watch is verified and ready for closure evidence.`
}

function getSupportPlan(
  supportFollowUpCount: number,
  blockedRequestCount: number,
  failedRequestCount: number,
  handlerLabel: string,
) {
  if (blockedRequestCount || failedRequestCount) return `Review blocked or failed follow-up for ${handlerLabel} before watch closure.`
  if (supportFollowUpCount) return `Keep ${supportFollowUpCount} open follow-up request${supportFollowUpCount === 1 ? '' : 's'} assigned until release watch closes.`
  return `No support escalation required for ${handlerLabel}; open a follow-up only if watch signals drift.`
}

function defaultWatchNote(status: BackendWatchMonitorStatus, item: BackendWatchItem) {
  if (status === 'Verified') return `${item.handlerLabel} backend watch verified.`
  if (status === 'Stable') return `${item.handlerLabel} backend watch stable.`
  if (status === 'Watch') return `${item.handlerLabel} remains under backend watch.`
  return `${item.handlerLabel} has critical backend watch drift.`
}

function matchesHandler(handlerKey: string, item: BackendReleaseCommandItem) {
  return handlerKey === item.handlerKey
}

function matchesMetadataHandler(metadata: Record<string, unknown> | undefined, item: BackendReleaseCommandItem) {
  if (!metadata) return false
  return metadata.handlerKey === item.handlerKey
    || metadata.releaseCommandItemId === item.id
    || metadata.deploymentItemId === item.deploymentItemId
}

function getLatestRecordByItem(records: BackendWatchRecord[]) {
  const latestRecordByItem = new Map<string, BackendWatchRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getItemId(item: BackendReleaseCommandItem) {
  return `backend-watch-monitor-${item.id}`
}

function statusRank(status: BackendWatchMonitorStatus) {
  if (status === 'Critical Drift') return 4
  if (status === 'Watch') return 3
  if (status === 'Stable') return 2
  return 1
}

function priorityRank(priority: BackendImplementationPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function emitBackendWatchRecordChange() {
  listeners.forEach(listener => listener())
}
