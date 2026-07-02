import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { ActionExecutionConfig } from '../admin-actions/actionExecutionContract'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { MockServerExecutionRecord } from '../admin-actions/mockServerExecutor'
import type { AuditEvent } from '../audit/auditLog'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendServerTestEvidencePack,
  BackendServerTestEvidencePackRegister,
  BackendServerTestEvidencePackStatus,
} from './backendServerTestEvidencePacks'

export type BackendExecutionReadinessStatus =
  | 'Blocked'
  | 'Review Only'
  | 'Ready For Server'
  | 'Execution Queued'
  | 'Verified'

export type BackendExecutionReadinessCheckStatus = 'Blocked' | 'Review' | 'Ready' | 'Verified'

export interface BackendExecutionReadinessCheck {
  id: string
  label: string
  status: BackendExecutionReadinessCheckStatus
  detail: string
}

export interface BackendExecutionReadinessRow {
  id: string
  packId: string
  rowId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: BackendExecutionReadinessStatus
  recommendedStatus: BackendExecutionReadinessStatus
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  evidenceStatus: BackendServerTestEvidencePackStatus
  coverageScore: number
  endpointConfigured: boolean
  executionPosture: string
  queuedRequestCount: number
  activeRequestCount: number
  approvedRequestCount: number
  completedRequestCount: number
  mockExecutionCount: number
  passedDryRunCount: number
  auditEventCount: number
  blockerCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  checks: BackendExecutionReadinessCheck[]
  nextStep: string
  rollbackPlan: string
  auditPlan: string
  evidenceLocation?: string
  dryRunRequired: boolean
  humanConfirmationRequired: boolean
  idempotencyRequired: boolean
  auditBacked: boolean
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendExecutionReadinessDashboard {
  status: BackendExecutionReadinessStatus
  summary: string
  generatedAt: string
  rows: BackendExecutionReadinessRow[]
  nextRow?: BackendExecutionReadinessRow
  totalCount: number
  blockedCount: number
  reviewOnlyCount: number
  readyForServerCount: number
  queuedCount: number
  verifiedCount: number
  criticalCount: number
  endpointConfiguredCount: number
  queuedRequestCount: number
  activeRequestCount: number
  mockExecutionCount: number
  dryRunProofCount: number
  auditBackedCount: number
  ownerGroups: BackendExecutionReadinessOwnerGroup[]
  handlerGroups: BackendExecutionReadinessHandlerGroup[]
}

export interface BackendExecutionReadinessOwnerGroup {
  owner: string
  total: number
  blocked: number
  reviewOnly: number
  readyForServer: number
  queued: number
  verified: number
  criticalCount: number
  nextStep: string
}

export interface BackendExecutionReadinessHandlerGroup {
  handlerKey: string
  handlerLabel: string
  status: BackendExecutionReadinessStatus
  risk: BackendImplementationPriority
  endpoint: string
  method: string
  queuedRequestCount: number
  mockExecutionCount: number
  auditEventCount: number
  blockerCount: number
  reviewCount: number
  nextStep: string
}

export interface BackendExecutionReadinessRecord {
  id: string
  rowId: string
  status: BackendExecutionReadinessStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendExecutionReadinessDashboardInput {
  evidenceRegister: BackendServerTestEvidencePackRegister
  actionRequests: AdminActionRequest[]
  mockServerExecutions: MockServerExecutionRecord[]
  auditEvents: AuditEvent[]
  executionConfig: ActionExecutionConfig
  records: BackendExecutionReadinessRecord[]
}

interface SaveBackendExecutionReadinessRecordInput {
  row: BackendExecutionReadinessRow
  status: BackendExecutionReadinessStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_execution_readiness_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendExecutionReadinessRecord[] = []

export const backendExecutionReadinessBoundaryRule =
  'Backend execution readiness records prepare trusted server handoff only. They do not execute handlers, deploy code, mutate production data, change billing, alter modules, change permissions, impersonate users, or execute agent actions from the browser.'

export const backendExecutionReadinessStatuses: BackendExecutionReadinessStatus[] = [
  'Blocked',
  'Review Only',
  'Ready For Server',
  'Execution Queued',
  'Verified',
]

export function buildBackendExecutionReadinessDashboard({
  evidenceRegister,
  actionRequests,
  mockServerExecutions,
  auditEvents,
  executionConfig,
  records,
}: BuildBackendExecutionReadinessDashboardInput): BackendExecutionReadinessDashboard {
  const generatedAt = new Date().toISOString()
  const latestRecordByRow = getLatestRecordByRow(records)
  const rows = evidenceRegister.packs
    .map(pack => withLatestRecord(
      createRow(pack, actionRequests, mockServerExecutions, auditEvents, executionConfig, generatedAt),
      latestRecordByRow.get(getRowId(pack)),
    ))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openRows = rows.filter(row => row.status !== 'Verified')
  const blockedCount = rows.filter(row => row.status === 'Blocked').length
  const reviewOnlyCount = rows.filter(row => row.status === 'Review Only').length
  const readyForServerCount = rows.filter(row => row.status === 'Ready For Server').length
  const queuedCount = rows.filter(row => row.status === 'Execution Queued').length
  const verifiedCount = rows.filter(row => row.status === 'Verified').length
  const status = getAggregateStatus(rows)

  return {
    status,
    summary: getDashboardSummary(status, blockedCount, reviewOnlyCount, readyForServerCount, queuedCount, verifiedCount),
    generatedAt,
    rows,
    nextRow: openRows[0],
    totalCount: rows.length,
    blockedCount,
    reviewOnlyCount,
    readyForServerCount,
    queuedCount,
    verifiedCount,
    criticalCount: openRows.filter(row => row.risk === 'Critical').length,
    endpointConfiguredCount: rows.filter(row => row.endpointConfigured).length,
    queuedRequestCount: rows.reduce((total, row) => total + row.queuedRequestCount, 0),
    activeRequestCount: rows.reduce((total, row) => total + row.activeRequestCount, 0),
    mockExecutionCount: rows.reduce((total, row) => total + row.mockExecutionCount, 0),
    dryRunProofCount: rows.filter(row => !row.dryRunRequired || row.passedDryRunCount > 0).length,
    auditBackedCount: rows.filter(row => row.auditBacked || row.auditEventCount > 0).length,
    ownerGroups: buildOwnerGroups(rows),
    handlerGroups: buildHandlerGroups(rows),
  }
}

export function getBackendExecutionReadinessRecords(): BackendExecutionReadinessRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendExecutionReadinessRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendExecutionReadinessRecord(input: SaveBackendExecutionReadinessRecordInput) {
  const record: BackendExecutionReadinessRecord = {
    id: crypto.randomUUID(),
    rowId: input.row.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultExecutionReadinessNote(input.status, input.row),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendExecutionReadinessRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendExecutionReadinessRecordChange()
  return record
}

export function subscribeToBackendExecutionReadinessRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendExecutionReadinessRecords() {
  return useSyncExternalStore(subscribeToBackendExecutionReadinessRecords, getBackendExecutionReadinessRecords, () => [])
}

export function getBackendExecutionReadinessTone(status: BackendExecutionReadinessStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready For Server') return 'ok'
  if (status === 'Execution Queued') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Review Only') return 'warn'
  return 'neutral'
}

export function getBackendExecutionReadinessCheckTone(status: BackendExecutionReadinessCheckStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendExecutionReadinessRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendExecutionReadinessFilename(row: BackendExecutionReadinessRow) {
  return `backend-execution-readiness-${row.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendExecutionReadinessHtml(row: BackendExecutionReadinessRow, session: AdminSession) {
  const checkRows = row.checks.map(check => `
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
    <title>${escapeHtml(row.handlerLabel)} backend execution readiness</title>
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
        <p>Happy Chair Platform Admin / Backend Execution Readiness</p>
        <h1>${escapeHtml(row.handlerLabel)}</h1>
        <p>${escapeHtml(backendExecutionReadinessBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(row.status)}</strong></div>
        <div><span>Evidence</span><strong>${escapeHtml(row.evidenceStatus)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(row.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(row.engineeringOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(row.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(row.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${row.method} ${row.endpoint}`)}</strong></div>
        <div><span>Queue</span><strong>${row.queuedRequestCount} request${row.queuedRequestCount === 1 ? '' : 's'}</strong></div>
      </section>
      <section>
        <h2>Execution Checks</h2>
        <table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${checkRows}</tbody></table>
      </section>
      <section>
        <h2>Queue, Dry Run, And Audit</h2>
        <p><strong>Endpoint configured:</strong> ${row.endpointConfigured ? 'Yes' : 'No'}</p>
        <p><strong>Queued requests:</strong> ${row.queuedRequestCount}</p>
        <p><strong>Dry-run executions:</strong> ${row.mockExecutionCount} total / ${row.passedDryRunCount} passed</p>
        <p><strong>Audit events:</strong> ${row.auditEventCount}</p>
        <p><strong>Evidence location:</strong> ${escapeHtml(row.evidenceLocation ?? 'Pending')}</p>
      </section>
      <section>
        <h2>Rollback And Audit</h2>
        <p><strong>Rollback:</strong> ${escapeHtml(row.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(row.auditPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(row.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createRow(
  pack: BackendServerTestEvidencePack,
  actionRequests: AdminActionRequest[],
  mockServerExecutions: MockServerExecutionRecord[],
  auditEvents: AuditEvent[],
  executionConfig: ActionExecutionConfig,
  generatedAt: string,
): BackendExecutionReadinessRow {
  const matchingRequests = actionRequests.filter(request => requestTouchesPack(request, pack))
  const matchingExecutions = mockServerExecutions.filter(execution => execution.handlerKey === pack.handlerKey)
  const matchingAuditEvents = auditEvents.filter(event => eventTouchesPack(event, pack))
  const endpointConfigured = Boolean(executionConfig.endpoint)
  const queuedRequestCount = matchingRequests.filter(request => request.status === 'Queued' || request.status === 'Approved' || request.status === 'Running').length
  const approvedRequestCount = matchingRequests.filter(request => request.status === 'Approved').length
  const activeRequestCount = matchingRequests.filter(request => request.status === 'Approved' || request.status === 'Running').length
  const completedRequestCount = matchingRequests.filter(request => request.status === 'Completed').length
  const passedDryRunCount = matchingExecutions.filter(execution => execution.status === 'Dry Run Passed' || execution.status === 'Completed Snapshot').length
  const checks = buildChecks({
    pack,
    endpointConfigured,
    queuedRequestCount,
    approvedRequestCount,
    activeRequestCount,
    completedRequestCount,
    mockExecutionCount: matchingExecutions.length,
    passedDryRunCount,
    auditEventCount: matchingAuditEvents.length,
  })
  const blockerCount = checks.filter(check => check.status === 'Blocked').length
  const reviewCount = checks.filter(check => check.status === 'Review').length
  const readyCount = checks.filter(check => check.status === 'Ready').length
  const verifiedCount = checks.filter(check => check.status === 'Verified').length
  const recommendedStatus = getRecommendedStatus({
    blockerCount,
    reviewCount,
    endpointConfigured,
    queuedRequestCount,
    activeRequestCount,
    completedRequestCount,
    passedDryRunCount,
    evidenceStatus: pack.status,
    dryRunRequired: pack.dryRunRequired,
  })

  return {
    id: getRowId(pack),
    packId: pack.id,
    rowId: pack.rowId,
    handlerKey: pack.handlerKey,
    handlerLabel: pack.handlerLabel,
    method: pack.method,
    endpoint: pack.endpoint,
    permission: pack.permission,
    mutationMode: pack.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    risk: pack.risk,
    productOwner: pack.productOwner,
    engineeringOwner: pack.engineeringOwner,
    evidenceStatus: pack.status,
    coverageScore: pack.coverageScore,
    endpointConfigured,
    executionPosture: endpointConfigured ? 'Trusted server endpoint configured' : 'Browser contract only',
    queuedRequestCount,
    activeRequestCount,
    approvedRequestCount,
    completedRequestCount,
    mockExecutionCount: matchingExecutions.length,
    passedDryRunCount,
    auditEventCount: matchingAuditEvents.length,
    blockerCount,
    reviewCount,
    readyCount,
    verifiedCount,
    checks,
    nextStep: getNextStep(recommendedStatus, pack.handlerLabel, endpointConfigured, reviewCount, queuedRequestCount),
    rollbackPlan: pack.rollbackPlan,
    auditPlan: pack.auditPlan,
    evidenceLocation: pack.evidenceLocation,
    dryRunRequired: pack.dryRunRequired,
    humanConfirmationRequired: pack.humanConfirmationRequired,
    idempotencyRequired: pack.idempotencyRequired,
    auditBacked: pack.auditBacked,
    generatedAt,
  }
}

function buildChecks(input: {
  pack: BackendServerTestEvidencePack
  endpointConfigured: boolean
  queuedRequestCount: number
  approvedRequestCount: number
  activeRequestCount: number
  completedRequestCount: number
  mockExecutionCount: number
  passedDryRunCount: number
  auditEventCount: number
}): BackendExecutionReadinessCheck[] {
  const idempotencyItem = input.pack.evidenceItems.find(item => item.type === 'Idempotency' && item.required)
  const boundaryItem = input.pack.evidenceItems.find(item => item.type === 'Browser Boundary')
  return [
    {
      id: 'evidence_pack',
      label: 'Evidence Pack',
      status: mapEvidenceStatus(input.pack.status),
      detail: `${input.pack.handlerLabel} evidence is ${input.pack.status} with ${input.pack.verifiedEvidenceCount}/${input.pack.requiredEvidenceCount} required items verified.`,
    },
    {
      id: 'server_endpoint',
      label: 'Server Endpoint',
      status: input.endpointConfigured ? 'Ready' : 'Review',
      detail: input.endpointConfigured
        ? 'Trusted server endpoint is configured for future execution handoff.'
        : 'No VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT is configured, so the browser remains in review-only contract mode.',
    },
    {
      id: 'action_request',
      label: 'Admin Action Request',
      status: input.completedRequestCount ? 'Verified' : input.queuedRequestCount ? 'Ready' : 'Review',
      detail: input.completedRequestCount
        ? `${input.completedRequestCount} completed request snapshot${input.completedRequestCount === 1 ? '' : 's'} exist for this handler.`
        : input.queuedRequestCount
          ? `${input.queuedRequestCount} request${input.queuedRequestCount === 1 ? '' : 's'} are queued, approved, or running for this handler.`
          : 'Queue an Admin Action Request before a trusted server handler can take ownership.',
    },
    {
      id: 'dry_run_proof',
      label: 'Dry-Run Proof',
      status: getDryRunCheckStatus(input.pack.dryRunRequired, input.mockExecutionCount, input.passedDryRunCount),
      detail: getDryRunCheckDetail(input.pack.dryRunRequired, input.mockExecutionCount, input.passedDryRunCount),
    },
    {
      id: 'human_confirmation',
      label: 'Human Confirmation',
      status: input.pack.humanConfirmationRequired
        ? input.completedRequestCount || input.activeRequestCount || input.approvedRequestCount
          ? 'Ready'
          : 'Review'
        : 'Ready',
      detail: input.pack.humanConfirmationRequired
        ? input.completedRequestCount || input.activeRequestCount || input.approvedRequestCount
          ? 'A request has reached an approved, active, or completed state.'
          : 'Human approval is still required before this handler can run.'
        : 'Human confirmation is not required for this handler class.',
    },
    {
      id: 'idempotency',
      label: 'Idempotency',
      status: input.pack.idempotencyRequired ? mapEvidenceItemStatus(idempotencyItem?.status) : 'Ready',
      detail: input.pack.idempotencyRequired
        ? idempotencyItem
          ? `${idempotencyItem.label} is ${idempotencyItem.status}.`
          : 'Idempotency evidence is required but not present in the pack.'
        : 'Idempotency is optional for this handler class.',
    },
    {
      id: 'audit_chain',
      label: 'Audit Chain',
      status: input.pack.auditBacked || input.auditEventCount ? 'Verified' : 'Review',
      detail: input.pack.auditBacked || input.auditEventCount
        ? `${input.auditEventCount} matching audit event${input.auditEventCount === 1 ? '' : 's'} found, and the local evidence chain is recorded.`
        : 'Record a review, queue action, or dry-run event to anchor this handler in Audit Logs.',
    },
    {
      id: 'rollback_plan',
      label: 'Rollback Plan',
      status: input.pack.rollbackPlan ? 'Ready' : 'Blocked',
      detail: input.pack.rollbackPlan || 'No rollback plan is attached.',
    },
    {
      id: 'browser_boundary',
      label: 'Browser Boundary',
      status: boundaryItem ? mapEvidenceItemStatus(boundaryItem.status) : 'Ready',
      detail: boundaryItem
        ? `${boundaryItem.label} is ${boundaryItem.status}. Browser controls may only review, queue, and export.`
        : 'Platform Admin browser controls remain review, queue, and export only.',
    },
  ]
}

function withLatestRecord(
  row: BackendExecutionReadinessRow,
  record: BackendExecutionReadinessRecord | undefined,
): BackendExecutionReadinessRow {
  if (!record) return row
  return {
    ...row,
    status: record.status,
    engineeringOwner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    auditBacked: true,
  }
}

function requestTouchesPack(request: AdminActionRequest, pack: BackendServerTestEvidencePack) {
  if (request.serverHandler.key === pack.handlerKey) return true
  const metadata = request.metadata ?? {}
  return metadata.handlerKey === pack.handlerKey
    || metadata.packId === pack.id
    || metadata.rowId === pack.rowId
    || String(metadata.handlerKey ?? '').includes(pack.handlerKey)
}

function eventTouchesPack(event: AuditEvent, pack: BackendServerTestEvidencePack) {
  if (event.actionKey.includes(pack.handlerKey)) return true
  const metadata = event.metadata ?? {}
  if (metadata.handlerKey === pack.handlerKey || metadata.packId === pack.id || metadata.rowId === pack.rowId) return true

  try {
    const metadataText = JSON.stringify(metadata)
    return metadataText.includes(pack.handlerKey) || metadataText.includes(pack.id) || metadataText.includes(pack.rowId)
  } catch {
    return false
  }
}

function buildOwnerGroups(rows: BackendExecutionReadinessRow[]): BackendExecutionReadinessOwnerGroup[] {
  const owners = Array.from(new Set(rows.map(row => row.engineeringOwner)))
  return owners.map(owner => {
    const ownerRows = rows.filter(row => row.engineeringOwner === owner)
    const blocked = ownerRows.filter(row => row.status === 'Blocked').length
    const reviewOnly = ownerRows.filter(row => row.status === 'Review Only').length
    const readyForServer = ownerRows.filter(row => row.status === 'Ready For Server').length
    const queued = ownerRows.filter(row => row.status === 'Execution Queued').length
    const verified = ownerRows.filter(row => row.status === 'Verified').length
    return {
      owner,
      total: ownerRows.length,
      blocked,
      reviewOnly,
      readyForServer,
      queued,
      verified,
      criticalCount: ownerRows.filter(row => row.risk === 'Critical' && row.status !== 'Verified').length,
      nextStep: blocked
        ? 'Clear blocked server execution readiness checks.'
        : reviewOnly
          ? 'Resolve review-only endpoint, approval, or dry-run gaps.'
          : readyForServer
            ? 'Queue trusted server handoff requests.'
            : queued
              ? 'Monitor queued execution handoff requests.'
              : 'Monitor verified handlers.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.reviewOnly - a.reviewOnly || b.readyForServer - a.readyForServer || a.owner.localeCompare(b.owner))
}

function buildHandlerGroups(rows: BackendExecutionReadinessRow[]): BackendExecutionReadinessHandlerGroup[] {
  return rows.map(row => ({
    handlerKey: row.handlerKey,
    handlerLabel: row.handlerLabel,
    status: row.status,
    risk: row.risk,
    endpoint: row.endpoint,
    method: row.method,
    queuedRequestCount: row.queuedRequestCount,
    mockExecutionCount: row.mockExecutionCount,
    auditEventCount: row.auditEventCount,
    blockerCount: row.blockerCount,
    reviewCount: row.reviewCount,
    nextStep: row.nextStep,
  }))
}

function getAggregateStatus(rows: BackendExecutionReadinessRow[]): BackendExecutionReadinessStatus {
  if (!rows.length) return 'Verified'
  if (rows.some(row => row.status === 'Blocked')) return 'Blocked'
  if (rows.some(row => row.status === 'Review Only')) return 'Review Only'
  if (rows.some(row => row.status === 'Ready For Server')) return 'Ready For Server'
  if (rows.some(row => row.status === 'Execution Queued')) return 'Execution Queued'
  return 'Verified'
}

function getRecommendedStatus(input: {
  blockerCount: number
  reviewCount: number
  endpointConfigured: boolean
  queuedRequestCount: number
  activeRequestCount: number
  completedRequestCount: number
  passedDryRunCount: number
  evidenceStatus: BackendServerTestEvidencePackStatus
  dryRunRequired: boolean
}): BackendExecutionReadinessStatus {
  if (input.blockerCount) return 'Blocked'
  if (!input.endpointConfigured || input.reviewCount) return 'Review Only'
  if (
    input.evidenceStatus === 'Verified'
    && input.completedRequestCount
    && (!input.dryRunRequired || input.passedDryRunCount)
  ) return 'Verified'
  if (input.queuedRequestCount || input.activeRequestCount) return 'Execution Queued'
  return 'Ready For Server'
}

function mapEvidenceStatus(status: BackendServerTestEvidencePackStatus): BackendExecutionReadinessCheckStatus {
  if (status === 'Blocked' || status === 'Missing Evidence') return 'Blocked'
  if (status === 'Evidence Review') return 'Review'
  if (status === 'Ready For Execution') return 'Ready'
  return 'Verified'
}

function mapEvidenceItemStatus(status: BackendServerTestEvidencePack['evidenceItems'][number]['status'] | undefined): BackendExecutionReadinessCheckStatus {
  if (status === 'Missing' || !status) return 'Blocked'
  if (status === 'Review') return 'Review'
  if (status === 'Ready') return 'Ready'
  return 'Verified'
}

function getDryRunCheckStatus(
  dryRunRequired: boolean,
  mockExecutionCount: number,
  passedDryRunCount: number,
): BackendExecutionReadinessCheckStatus {
  if (!dryRunRequired) return 'Ready'
  if (passedDryRunCount) return 'Verified'
  if (mockExecutionCount) return 'Review'
  return 'Review'
}

function getDryRunCheckDetail(
  dryRunRequired: boolean,
  mockExecutionCount: number,
  passedDryRunCount: number,
) {
  if (!dryRunRequired) return 'Dry-run proof is optional for this handler class.'
  if (passedDryRunCount) return `${passedDryRunCount} passing dry-run proof record${passedDryRunCount === 1 ? '' : 's'} found.`
  if (mockExecutionCount) return `${mockExecutionCount} dry-run record${mockExecutionCount === 1 ? '' : 's'} found, but passing proof is not complete.`
  return 'Run a dry-run simulation or attach server test proof before trusted execution is enabled.'
}

function getNextStep(
  status: BackendExecutionReadinessStatus,
  handlerLabel: string,
  endpointConfigured: boolean,
  reviewCount: number,
  queuedRequestCount: number,
) {
  if (status === 'Blocked') return `Clear blocked readiness checks before ${handlerLabel} can move forward.`
  if (status === 'Review Only' && !endpointConfigured) return 'Configure the trusted server endpoint, then re-check execution readiness.'
  if (status === 'Review Only') return `Resolve ${reviewCount} review check${reviewCount === 1 ? '' : 's'} before trusted handoff.`
  if (status === 'Ready For Server') return `Queue ${handlerLabel} for trusted server handoff review.`
  if (status === 'Execution Queued') return `${queuedRequestCount} request${queuedRequestCount === 1 ? '' : 's'} are queued for trusted server handling.`
  return `${handlerLabel} execution readiness is verified.`
}

function getDashboardSummary(
  status: BackendExecutionReadinessStatus,
  blockedCount: number,
  reviewOnlyCount: number,
  readyForServerCount: number,
  queuedCount: number,
  verifiedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} handler${blockedCount === 1 ? '' : 's'} are blocked from server handoff.`
  if (status === 'Review Only') return `${reviewOnlyCount} handler${reviewOnlyCount === 1 ? '' : 's'} remain in review-only mode.`
  if (status === 'Ready For Server') return `${readyForServerCount} handler${readyForServerCount === 1 ? '' : 's'} are ready for server handoff.`
  if (status === 'Execution Queued') return `${queuedCount} handler${queuedCount === 1 ? '' : 's'} are queued for trusted execution handling.`
  return `${verifiedCount} handler${verifiedCount === 1 ? '' : 's'} are execution-ready verified.`
}

function defaultExecutionReadinessNote(
  status: BackendExecutionReadinessStatus,
  row: BackendExecutionReadinessRow,
) {
  if (status === 'Verified') return `${row.handlerLabel} execution readiness verified.`
  if (status === 'Execution Queued') return `${row.handlerLabel} queued for trusted server execution handling.`
  if (status === 'Ready For Server') return `${row.handlerLabel} ready for server handoff.`
  if (status === 'Review Only') return `${row.handlerLabel} remains review-only.`
  return `${row.handlerLabel} remains blocked from trusted execution handoff.`
}

function getLatestRecordByRow(records: BackendExecutionReadinessRecord[]) {
  const latestRecordByRow = new Map<string, BackendExecutionReadinessRecord>()
  records.forEach(record => {
    if (!latestRecordByRow.has(record.rowId)) latestRecordByRow.set(record.rowId, record)
  })
  return latestRecordByRow
}

function getRowId(pack: BackendServerTestEvidencePack) {
  return `backend-execution-readiness-${pack.id}`
}

function statusRank(status: BackendExecutionReadinessStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Review Only') return 4
  if (status === 'Ready For Server') return 3
  if (status === 'Execution Queued') return 2
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

function emitBackendExecutionReadinessRecordChange() {
  listeners.forEach(listener => listener())
}
