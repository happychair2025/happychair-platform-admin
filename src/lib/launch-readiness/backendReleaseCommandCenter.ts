import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  TrustedHandlerDeploymentChecklist,
  TrustedHandlerDeploymentItem,
  TrustedHandlerDeploymentStatus,
} from './trustedHandlerDeploymentChecklist'

export type BackendReleaseCommandStatus =
  | 'Blocked'
  | 'Build Planning'
  | 'Ready For Build'
  | 'Build Queued'
  | 'Release Candidate'
  | 'Release Verified'

export type BackendReleaseCommandCheckStatus = 'Blocked' | 'Review' | 'Ready' | 'Verified'
export type BackendReleaseCommandLane = 'Blocked' | 'Planning' | 'Build' | 'Release' | 'Watch'

export interface BackendReleaseCommandCheck {
  id: string
  label: string
  status: BackendReleaseCommandCheckStatus
  detail: string
}

export interface BackendReleaseCommandItem {
  id: string
  deploymentItemId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: BackendReleaseCommandStatus
  recommendedStatus: BackendReleaseCommandStatus
  deploymentStatus: TrustedHandlerDeploymentStatus
  lane: BackendReleaseCommandLane
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  releaseOwner: string
  endpointConfigured: boolean
  queuedRequestCount: number
  approvedRequestCount: number
  activeRequestCount: number
  completedRequestCount: number
  dryRunProofCount: number
  auditEventCount: number
  blockerCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  checks: BackendReleaseCommandCheck[]
  releaseWindow: string
  goNoGo: string
  buildPlan: string
  releasePlan: string
  rollbackPlan: string
  auditPlan: string
  monitoringPlan: string
  nextStep: string
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendReleaseCommandCenter {
  status: BackendReleaseCommandStatus
  summary: string
  generatedAt: string
  items: BackendReleaseCommandItem[]
  nextItem?: BackendReleaseCommandItem
  totalCount: number
  blockedCount: number
  buildPlanningCount: number
  readyForBuildCount: number
  buildQueuedCount: number
  releaseCandidateCount: number
  releaseVerifiedCount: number
  criticalCount: number
  queuedRequestCount: number
  activeRequestCount: number
  releaseReadyCount: number
  auditBackedCount: number
  laneGroups: BackendReleaseCommandLaneGroup[]
  ownerGroups: BackendReleaseCommandOwnerGroup[]
}

export interface BackendReleaseCommandLaneGroup {
  lane: BackendReleaseCommandLane
  total: number
  blocked: number
  review: number
  ready: number
  verified: number
  criticalCount: number
  nextStep: string
}

export interface BackendReleaseCommandOwnerGroup {
  owner: string
  total: number
  blocked: number
  planning: number
  build: number
  release: number
  watch: number
  criticalCount: number
  nextStep: string
}

export interface BackendReleaseCommandRecord {
  id: string
  itemId: string
  status: BackendReleaseCommandStatus
  owner: string
  releaseWindow: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendReleaseCommandCenterInput {
  deploymentChecklist: TrustedHandlerDeploymentChecklist
  actionRequests: AdminActionRequest[]
  records: BackendReleaseCommandRecord[]
}

interface SaveBackendReleaseCommandRecordInput {
  item: BackendReleaseCommandItem
  status: BackendReleaseCommandStatus
  owner: string
  releaseWindow: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_release_command_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendReleaseCommandRecord[] = []

export const backendReleaseCommandBoundaryRule =
  'Backend release command records are release-review and handoff artifacts only. They do not deploy code, enable production mutations, call server handlers, change billing, alter modules, change permissions, impersonate users, or execute agent actions from Platform Admin.'

export const backendReleaseCommandStatuses: BackendReleaseCommandStatus[] = [
  'Blocked',
  'Build Planning',
  'Ready For Build',
  'Build Queued',
  'Release Candidate',
  'Release Verified',
]

export function buildBackendReleaseCommandCenter({
  deploymentChecklist,
  actionRequests,
  records,
}: BuildBackendReleaseCommandCenterInput): BackendReleaseCommandCenter {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const items = deploymentChecklist.items
    .map(item => withLatestRecord(createItem(item, actionRequests, generatedAt), latestRecordByItem.get(getItemId(item))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openItems = items.filter(item => item.status !== 'Release Verified')
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const buildPlanningCount = items.filter(item => item.status === 'Build Planning').length
  const readyForBuildCount = items.filter(item => item.status === 'Ready For Build').length
  const buildQueuedCount = items.filter(item => item.status === 'Build Queued').length
  const releaseCandidateCount = items.filter(item => item.status === 'Release Candidate').length
  const releaseVerifiedCount = items.filter(item => item.status === 'Release Verified').length
  const status = getAggregateStatus(items)

  return {
    status,
    summary: getCenterSummary(status, blockedCount, buildPlanningCount, readyForBuildCount, buildQueuedCount, releaseCandidateCount, releaseVerifiedCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    blockedCount,
    buildPlanningCount,
    readyForBuildCount,
    buildQueuedCount,
    releaseCandidateCount,
    releaseVerifiedCount,
    criticalCount: openItems.filter(item => item.risk === 'Critical').length,
    queuedRequestCount: items.reduce((total, item) => total + item.queuedRequestCount, 0),
    activeRequestCount: items.reduce((total, item) => total + item.activeRequestCount, 0),
    releaseReadyCount: items.filter(item => item.status === 'Release Candidate' || item.status === 'Release Verified').length,
    auditBackedCount: items.filter(item => Boolean(item.auditEventId) || item.auditEventCount > 0).length,
    laneGroups: buildLaneGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getBackendReleaseCommandRecords(): BackendReleaseCommandRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendReleaseCommandRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendReleaseCommandRecord(input: SaveBackendReleaseCommandRecordInput) {
  const record: BackendReleaseCommandRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    releaseWindow: input.releaseWindow.trim() || input.item.releaseWindow,
    note: input.note.trim() || defaultReleaseCommandNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendReleaseCommandRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendReleaseCommandRecordChange()
  return record
}

export function subscribeToBackendReleaseCommandRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendReleaseCommandRecords() {
  return useSyncExternalStore(subscribeToBackendReleaseCommandRecords, getBackendReleaseCommandRecords, () => [])
}

export function getBackendReleaseCommandTone(status: BackendReleaseCommandStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Release Verified' || status === 'Release Candidate' || status === 'Ready For Build' || status === 'Build Queued') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Build Planning') return 'warn'
  return 'neutral'
}

export function getBackendReleaseCommandCheckTone(status: BackendReleaseCommandCheckStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendReleaseCommandRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendReleaseCommandFilename(item: BackendReleaseCommandItem) {
  return `backend-release-command-${item.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendReleaseCommandHtml(item: BackendReleaseCommandItem, session: AdminSession) {
  const checkRows = item.checks.map(check => `
    <tr>
      <td>${escapeHtml(check.label)}</td>
      <td>${escapeHtml(check.status)}</td>
      <td>${escapeHtml(check.detail)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.handlerLabel)} backend release command</title>
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
        <p>Happy Chair Platform Admin / Backend Release Command</p>
        <h1>${escapeHtml(item.handlerLabel)}</h1>
        <p>${escapeHtml(backendReleaseCommandBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
        <div><span>Lane</span><strong>${escapeHtml(item.lane)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(item.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(item.releaseOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(item.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(item.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${item.method} ${item.endpoint}`)}</strong></div>
        <div><span>Window</span><strong>${escapeHtml(item.releaseWindow)}</strong></div>
      </section>
      <section>
        <h2>Release Checks</h2>
        <table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${checkRows}</tbody></table>
      </section>
      <section>
        <h2>Release Plan</h2>
        <p><strong>Go / No-Go:</strong> ${escapeHtml(item.goNoGo)}</p>
        <p><strong>Build:</strong> ${escapeHtml(item.buildPlan)}</p>
        <p><strong>Release:</strong> ${escapeHtml(item.releasePlan)}</p>
        <p><strong>Monitoring:</strong> ${escapeHtml(item.monitoringPlan)}</p>
        <p><strong>Rollback:</strong> ${escapeHtml(item.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(item.auditPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createItem(
  item: TrustedHandlerDeploymentItem,
  actionRequests: AdminActionRequest[],
  generatedAt: string,
): BackendReleaseCommandItem {
  const handlerRequests = actionRequests.filter(request => request.serverHandler.key === item.handlerKey || request.metadata?.handlerKey === item.handlerKey)
  const queuedRequestCount = handlerRequests.filter(request => request.status === 'Queued' || request.status === 'Approved' || request.status === 'Running').length
  const approvedRequestCount = handlerRequests.filter(request => request.status === 'Approved').length
  const activeRequestCount = handlerRequests.filter(request => request.status === 'Approved' || request.status === 'Running').length
  const completedRequestCount = handlerRequests.filter(request => request.status === 'Completed').length
  const checks = buildReleaseChecks(item, queuedRequestCount, approvedRequestCount, activeRequestCount, completedRequestCount)
  const blockerCount = checks.filter(check => check.status === 'Blocked').length
  const reviewCount = checks.filter(check => check.status === 'Review').length
  const readyCount = checks.filter(check => check.status === 'Ready').length
  const verifiedCount = checks.filter(check => check.status === 'Verified').length
  const recommendedStatus = getRecommendedStatus(item, blockerCount, reviewCount, queuedRequestCount, completedRequestCount)
  const lane = getLane(recommendedStatus)

  return {
    id: getItemId(item),
    deploymentItemId: item.id,
    handlerKey: item.handlerKey,
    handlerLabel: item.handlerLabel,
    method: item.method,
    endpoint: item.endpoint,
    permission: item.permission,
    mutationMode: item.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    deploymentStatus: item.status,
    lane,
    risk: item.risk,
    productOwner: item.productOwner,
    engineeringOwner: item.engineeringOwner,
    releaseOwner: item.engineeringOwner,
    endpointConfigured: item.endpointConfigured,
    queuedRequestCount,
    approvedRequestCount,
    activeRequestCount,
    completedRequestCount,
    dryRunProofCount: item.dryRunProofCount,
    auditEventCount: item.auditEventCount,
    blockerCount,
    reviewCount,
    readyCount,
    verifiedCount,
    checks,
    releaseWindow: defaultReleaseWindow(recommendedStatus, item.risk),
    goNoGo: getGoNoGo(recommendedStatus, blockerCount, reviewCount),
    buildPlan: item.buildPlan,
    releasePlan: item.releasePlan,
    rollbackPlan: item.rollbackPlan,
    auditPlan: item.auditPlan,
    monitoringPlan: `Watch ${item.handlerKey} for permission denials, failed validation, duration spikes, rollback events, and support-visible activity after release approval.`,
    nextStep: getNextStep(recommendedStatus, item.handlerLabel, blockerCount, reviewCount),
    generatedAt,
  }
}

function buildReleaseChecks(
  item: TrustedHandlerDeploymentItem,
  queuedRequestCount: number,
  approvedRequestCount: number,
  activeRequestCount: number,
  completedRequestCount: number,
): BackendReleaseCommandCheck[] {
  return [
    releaseCheck(
      'deployment-checklist',
      'Deployment checklist',
      mapDeploymentStatus(item.status),
      `${item.handlerLabel} deployment checklist is ${item.status}.`,
    ),
    releaseCheck(
      'build-request',
      'Build request queued',
      completedRequestCount ? 'Verified' : queuedRequestCount ? 'Ready' : item.status === 'Ready For Build' || item.status === 'Release Candidate' || item.status === 'Verified' ? 'Ready' : 'Review',
      completedRequestCount
        ? `${completedRequestCount} completed request snapshot${completedRequestCount === 1 ? '' : 's'} found.`
        : queuedRequestCount
          ? `${queuedRequestCount} build or release request${queuedRequestCount === 1 ? '' : 's'} are queued, approved, or running.`
          : 'Queue a build request before this handler can move through release command.',
    ),
    releaseCheck(
      'endpoint',
      'Trusted endpoint',
      item.endpointConfigured ? 'Ready' : 'Review',
      item.endpointConfigured ? `${item.method} ${item.endpoint} is represented in the trusted endpoint contract.` : 'Trusted endpoint is not configured yet.',
    ),
    releaseCheck(
      'dry-run',
      'Dry-run proof',
      item.dryRunProofCount ? 'Verified' : item.status === 'Release Candidate' || item.status === 'Verified' ? 'Review' : 'Ready',
      item.dryRunProofCount ? `${item.dryRunProofCount} dry-run proof record${item.dryRunProofCount === 1 ? '' : 's'} attached.` : 'Dry-run proof should be attached before release approval.',
    ),
    releaseCheck(
      'audit',
      'Audit evidence',
      item.auditEventCount || item.auditEventId ? 'Verified' : 'Review',
      item.auditEventCount || item.auditEventId ? `${item.auditEventCount} matching audit event${item.auditEventCount === 1 ? '' : 's'} plus local review evidence.` : 'Audit evidence is not yet attached.',
    ),
    releaseCheck(
      'approval',
      'Owner approval path',
      approvedRequestCount || activeRequestCount || completedRequestCount || item.reviewedAt ? 'Ready' : 'Review',
      approvedRequestCount || activeRequestCount || completedRequestCount || item.reviewedAt
        ? 'Owner or action-request approval evidence is present.'
        : 'Release approval still needs a visible owner decision or queued action request.',
    ),
    releaseCheck(
      'rollback',
      'Rollback readiness',
      item.rollbackPlan ? 'Ready' : 'Blocked',
      item.rollbackPlan || 'No rollback plan is attached.',
    ),
    releaseCheck(
      'monitoring',
      'Watch plan',
      item.auditEventCount || item.dryRunProofCount ? 'Ready' : 'Review',
      'Release command requires monitoring for failures, permission denials, rollback events, and support-visible activity.',
    ),
  ]
}

function releaseCheck(
  id: string,
  label: string,
  status: BackendReleaseCommandCheckStatus,
  detail: string,
): BackendReleaseCommandCheck {
  return { id, label, status, detail }
}

function withLatestRecord(
  item: BackendReleaseCommandItem,
  record: BackendReleaseCommandRecord | undefined,
): BackendReleaseCommandItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    releaseOwner: record.owner,
    releaseWindow: record.releaseWindow,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    lane: getLane(record.status),
    goNoGo: getGoNoGo(record.status, item.blockerCount, item.reviewCount),
    nextStep: getNextStep(record.status, item.handlerLabel, item.blockerCount, item.reviewCount),
  }
}

function buildLaneGroups(items: BackendReleaseCommandItem[]): BackendReleaseCommandLaneGroup[] {
  const lanes: BackendReleaseCommandLane[] = ['Blocked', 'Planning', 'Build', 'Release', 'Watch']
  return lanes.map(lane => {
    const laneItems = items.filter(item => item.lane === lane)
    const checks = laneItems.flatMap(item => item.checks)
    const blocked = checks.filter(check => check.status === 'Blocked').length
    const review = checks.filter(check => check.status === 'Review').length
    const ready = checks.filter(check => check.status === 'Ready').length
    const verified = checks.filter(check => check.status === 'Verified').length
    return {
      lane,
      total: laneItems.length,
      blocked,
      review,
      ready,
      verified,
      criticalCount: laneItems.filter(item => item.risk === 'Critical').length,
      nextStep: laneItems.length
        ? blocked
          ? `Clear blocked ${lane.toLowerCase()} lane checks.`
          : review
            ? `Review ${lane.toLowerCase()} lane gaps.`
            : ready
              ? `Advance ${lane.toLowerCase()} lane items.`
              : `Monitor verified ${lane.toLowerCase()} lane items.`
        : `No ${lane.toLowerCase()} lane items.`,
    }
  })
}

function buildOwnerGroups(items: BackendReleaseCommandItem[]): BackendReleaseCommandOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.releaseOwner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.releaseOwner === owner)
    const blocked = ownerItems.filter(item => item.lane === 'Blocked').length
    const planning = ownerItems.filter(item => item.lane === 'Planning').length
    const build = ownerItems.filter(item => item.lane === 'Build').length
    const release = ownerItems.filter(item => item.lane === 'Release').length
    const watch = ownerItems.filter(item => item.lane === 'Watch').length
    return {
      owner,
      total: ownerItems.length,
      blocked,
      planning,
      build,
      release,
      watch,
      criticalCount: ownerItems.filter(item => item.risk === 'Critical' && item.status !== 'Release Verified').length,
      nextStep: blocked
        ? 'Clear blocked release command items.'
        : planning
          ? 'Finish build planning and queue release work.'
          : build
            ? 'Move build-ready items into queued implementation.'
            : release
              ? 'Collect go/no-go proof for release candidates.'
              : 'Monitor verified release command items.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.planning - a.planning || b.release - a.release || a.owner.localeCompare(b.owner))
}

function getRecommendedStatus(
  item: TrustedHandlerDeploymentItem,
  blockerCount: number,
  reviewCount: number,
  queuedRequestCount: number,
  completedRequestCount: number,
): BackendReleaseCommandStatus {
  if (item.status === 'Blocked' || blockerCount) return 'Blocked'
  if (item.status === 'Verified' && completedRequestCount) return 'Release Verified'
  if (item.status === 'Verified' || item.status === 'Release Candidate') return 'Release Candidate'
  if (item.status === 'Build Queued' || queuedRequestCount) return 'Build Queued'
  if (item.status === 'Ready For Build' && !reviewCount) return 'Ready For Build'
  return 'Build Planning'
}

function getAggregateStatus(items: BackendReleaseCommandItem[]): BackendReleaseCommandStatus {
  if (!items.length) return 'Release Verified'
  if (items.some(item => item.status === 'Blocked')) return 'Blocked'
  if (items.some(item => item.status === 'Build Planning')) return 'Build Planning'
  if (items.some(item => item.status === 'Ready For Build')) return 'Ready For Build'
  if (items.some(item => item.status === 'Build Queued')) return 'Build Queued'
  if (items.some(item => item.status === 'Release Candidate')) return 'Release Candidate'
  return 'Release Verified'
}

function getLane(status: BackendReleaseCommandStatus): BackendReleaseCommandLane {
  if (status === 'Blocked') return 'Blocked'
  if (status === 'Build Planning') return 'Planning'
  if (status === 'Ready For Build' || status === 'Build Queued') return 'Build'
  if (status === 'Release Candidate') return 'Release'
  return 'Watch'
}

function mapDeploymentStatus(status: TrustedHandlerDeploymentStatus): BackendReleaseCommandCheckStatus {
  if (status === 'Blocked') return 'Blocked'
  if (status === 'Needs Build Plan') return 'Review'
  if (status === 'Verified') return 'Verified'
  return 'Ready'
}

function getGoNoGo(
  status: BackendReleaseCommandStatus,
  blockerCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return 'No-Go'
  if (status === 'Build Planning' || reviewCount) return 'Conditional'
  if (status === 'Release Candidate' && !blockerCount && !reviewCount) return 'Go candidate'
  if (status === 'Release Verified') return 'Verified'
  return 'Build-ready'
}

function defaultReleaseWindow(status: BackendReleaseCommandStatus, risk: BackendImplementationPriority) {
  if (status === 'Blocked' || status === 'Build Planning') return 'Unscheduled'
  if (risk === 'Critical' || risk === 'High') return 'Owner-approved maintenance window'
  if (status === 'Release Candidate') return 'Next approved release window'
  return 'Next engineering build window'
}

function getNextStep(
  status: BackendReleaseCommandStatus,
  handlerLabel: string,
  blockerCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return `Clear ${blockerCount} blocked release check${blockerCount === 1 ? '' : 's'} before ${handlerLabel} can move.`
  if (status === 'Build Planning') return `Resolve ${reviewCount} review check${reviewCount === 1 ? '' : 's'} and complete release planning.`
  if (status === 'Ready For Build') return `Queue ${handlerLabel} into trusted server build work.`
  if (status === 'Build Queued') return `${handlerLabel} is queued for trusted build or release review.`
  if (status === 'Release Candidate') return `Collect go/no-go approval and watch-plan evidence for ${handlerLabel}.`
  return `${handlerLabel} release command is verified and ready for watch monitoring.`
}

function getCenterSummary(
  status: BackendReleaseCommandStatus,
  blockedCount: number,
  buildPlanningCount: number,
  readyForBuildCount: number,
  buildQueuedCount: number,
  releaseCandidateCount: number,
  releaseVerifiedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} backend release command item${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Build Planning') return `${buildPlanningCount} handler${buildPlanningCount === 1 ? '' : 's'} need release planning.`
  if (status === 'Ready For Build') return `${readyForBuildCount} handler${readyForBuildCount === 1 ? '' : 's'} are ready for build.`
  if (status === 'Build Queued') return `${buildQueuedCount} handler${buildQueuedCount === 1 ? '' : 's'} are queued for build.`
  if (status === 'Release Candidate') return `${releaseCandidateCount} handler${releaseCandidateCount === 1 ? '' : 's'} are release candidates.`
  return `${releaseVerifiedCount} backend release command item${releaseVerifiedCount === 1 ? '' : 's'} are verified.`
}

function defaultReleaseCommandNote(
  status: BackendReleaseCommandStatus,
  item: BackendReleaseCommandItem,
) {
  if (status === 'Release Verified') return `${item.handlerLabel} release command verified.`
  if (status === 'Release Candidate') return `${item.handlerLabel} marked as release candidate.`
  if (status === 'Build Queued') return `${item.handlerLabel} build work queued.`
  if (status === 'Ready For Build') return `${item.handlerLabel} ready for trusted server build.`
  if (status === 'Build Planning') return `${item.handlerLabel} needs release planning.`
  return `${item.handlerLabel} release command remains blocked.`
}

function getLatestRecordByItem(records: BackendReleaseCommandRecord[]) {
  const latestRecordByItem = new Map<string, BackendReleaseCommandRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getItemId(item: TrustedHandlerDeploymentItem) {
  return `backend-release-command-${item.id}`
}

function statusRank(status: BackendReleaseCommandStatus) {
  if (status === 'Blocked') return 6
  if (status === 'Build Planning') return 5
  if (status === 'Ready For Build') return 4
  if (status === 'Build Queued') return 3
  if (status === 'Release Candidate') return 2
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

function emitBackendReleaseCommandRecordChange() {
  listeners.forEach(listener => listener())
}
