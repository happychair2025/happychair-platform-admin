import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendServerHandlerTestCase,
  BackendServerHandlerTestMatrix,
  BackendServerHandlerTestMatrixStatus,
  BackendServerHandlerTestRow,
  BackendServerHandlerTestType,
} from './backendServerHandlerTestMatrix'

export type BackendServerTestEvidencePackStatus =
  'Blocked'
  | 'Missing Evidence'
  | 'Evidence Review'
  | 'Ready For Execution'
  | 'Verified'

export type BackendServerTestEvidenceItemStatus = 'Missing' | 'Review' | 'Ready' | 'Verified'

export interface BackendServerTestEvidenceItem {
  id: string
  testCaseId: string
  type: BackendServerHandlerTestType
  label: string
  status: BackendServerTestEvidenceItemStatus
  required: boolean
  expectedProof: string
  captureMethod: string
  storageTarget: string
}

export interface BackendServerTestRunbookStep {
  id: string
  label: string
  owner: string
  status: BackendServerTestEvidenceItemStatus
  detail: string
  expectedOutcome: string
}

export interface BackendServerTestEvidencePack {
  id: string
  rowId: string
  packetId: string
  specId: string
  readinessCardId: string
  title: string
  status: BackendServerTestEvidencePackStatus
  recommendedStatus: BackendServerTestEvidencePackStatus
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  coverageScore: number
  objective: string
  preconditions: string[]
  runbookSteps: BackendServerTestRunbookStep[]
  evidenceItems: BackendServerTestEvidenceItem[]
  failureModes: string[]
  exitCriteria: string[]
  rollbackPlan: string
  auditPlan: string
  nextStep: string
  requiredEvidenceCount: number
  verifiedEvidenceCount: number
  missingEvidenceCount: number
  reviewEvidenceCount: number
  readyEvidenceCount: number
  dryRunRequired: boolean
  humanConfirmationRequired: boolean
  idempotencyRequired: boolean
  auditBacked: boolean
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  evidenceLocation?: string
  note?: string
  auditEventId?: string
}

export interface BackendServerTestEvidencePackRegister {
  status: BackendServerTestEvidencePackStatus
  summary: string
  generatedAt: string
  packs: BackendServerTestEvidencePack[]
  nextPack?: BackendServerTestEvidencePack
  totalCount: number
  blockedCount: number
  missingCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  criticalCount: number
  requiredEvidenceCount: number
  verifiedEvidenceCount: number
  auditBackedCount: number
  ownerGroups: BackendServerTestEvidenceOwnerGroup[]
  evidenceTypeGroups: BackendServerTestEvidenceTypeGroup[]
}

export interface BackendServerTestEvidenceOwnerGroup {
  owner: string
  total: number
  blocked: number
  missing: number
  review: number
  ready: number
  verified: number
  criticalCount: number
  nextStep: string
}

export interface BackendServerTestEvidenceTypeGroup {
  type: BackendServerHandlerTestType
  total: number
  missing: number
  review: number
  ready: number
  verified: number
  requiredCount: number
  nextStep: string
}

export interface BackendServerTestEvidencePackRecord {
  id: string
  packId: string
  status: BackendServerTestEvidencePackStatus
  owner: string
  evidenceLocation: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendServerTestEvidencePackRegisterInput {
  matrix: BackendServerHandlerTestMatrix
  records: BackendServerTestEvidencePackRecord[]
}

interface SaveBackendServerTestEvidencePackRecordInput {
  pack: BackendServerTestEvidencePack
  status: BackendServerTestEvidencePackStatus
  owner: string
  evidenceLocation: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_server_test_evidence_pack_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendServerTestEvidencePackRecord[] = []

export const backendServerTestEvidencePackBoundaryRule =
  'Server test evidence packs are runbook and evidence-review artifacts only. They do not run live handlers, deploy code, mutate production data, change billing, alter modules, change permissions, impersonate users, or execute agent actions.'

export const backendServerTestEvidencePackStatuses: BackendServerTestEvidencePackStatus[] = [
  'Blocked',
  'Missing Evidence',
  'Evidence Review',
  'Ready For Execution',
  'Verified',
]

export function buildBackendServerTestEvidencePackRegister({
  matrix,
  records,
}: BuildBackendServerTestEvidencePackRegisterInput): BackendServerTestEvidencePackRegister {
  const generatedAt = new Date().toISOString()
  const latestRecordByPack = getLatestRecordByPack(records)
  const packs = matrix.rows
    .map(row => withLatestRecord(createPack(row, generatedAt), latestRecordByPack.get(getPackId(row))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openPacks = packs.filter(pack => pack.status !== 'Verified')
  const blockedCount = packs.filter(pack => pack.status === 'Blocked').length
  const missingCount = packs.filter(pack => pack.status === 'Missing Evidence').length
  const reviewCount = packs.filter(pack => pack.status === 'Evidence Review').length
  const readyCount = packs.filter(pack => pack.status === 'Ready For Execution').length
  const verifiedCount = packs.filter(pack => pack.status === 'Verified').length
  const status = getAggregateStatus(packs)

  return {
    status,
    summary: getRegisterSummary(status, blockedCount, missingCount, reviewCount, readyCount, verifiedCount),
    generatedAt,
    packs,
    nextPack: openPacks[0],
    totalCount: packs.length,
    blockedCount,
    missingCount,
    reviewCount,
    readyCount,
    verifiedCount,
    criticalCount: openPacks.filter(pack => pack.risk === 'Critical').length,
    requiredEvidenceCount: packs.reduce((total, pack) => total + pack.requiredEvidenceCount, 0),
    verifiedEvidenceCount: packs.reduce((total, pack) => total + pack.verifiedEvidenceCount, 0),
    auditBackedCount: packs.filter(pack => pack.auditBacked).length,
    ownerGroups: buildOwnerGroups(packs),
    evidenceTypeGroups: buildEvidenceTypeGroups(packs),
  }
}

export function getBackendServerTestEvidencePackRecords(): BackendServerTestEvidencePackRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendServerTestEvidencePackRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendServerTestEvidencePackRecord(input: SaveBackendServerTestEvidencePackRecordInput) {
  const record: BackendServerTestEvidencePackRecord = {
    id: crypto.randomUUID(),
    packId: input.pack.id,
    status: input.status,
    owner: input.owner,
    evidenceLocation: input.evidenceLocation.trim() || defaultEvidenceLocation(input.pack),
    note: input.note.trim() || defaultEvidencePackNote(input.status, input.pack),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendServerTestEvidencePackRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendServerTestEvidencePackRecordChange()
  return record
}

export function subscribeToBackendServerTestEvidencePackRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendServerTestEvidencePackRecords() {
  return useSyncExternalStore(subscribeToBackendServerTestEvidencePackRecords, getBackendServerTestEvidencePackRecords, () => [])
}

export function getBackendServerTestEvidencePackTone(status: BackendServerTestEvidencePackStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready For Execution') return 'ok'
  if (status === 'Blocked' || status === 'Missing Evidence') return 'danger'
  if (status === 'Evidence Review') return 'warn'
  return 'neutral'
}

export function getBackendServerTestEvidenceItemTone(status: BackendServerTestEvidenceItemStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Missing') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendServerTestEvidenceRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendServerTestEvidencePackFilename(pack: BackendServerTestEvidencePack) {
  return `server-test-evidence-pack-${pack.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendServerTestEvidencePackHtml(pack: BackendServerTestEvidencePack, session: AdminSession) {
  const listItems = (items: string[]) => items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
  const stepRows = pack.runbookSteps.map(step => `
    <tr>
      <td>${escapeHtml(step.label)}</td>
      <td>${escapeHtml(step.owner)}</td>
      <td>${escapeHtml(step.status)}</td>
      <td>${escapeHtml(step.detail)}</td>
      <td>${escapeHtml(step.expectedOutcome)}</td>
    </tr>
  `).join('')
  const evidenceRows = pack.evidenceItems.map(item => `
    <tr>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${item.required ? 'Required' : 'Optional'}</td>
      <td>${escapeHtml(item.expectedProof)}</td>
      <td>${escapeHtml(item.storageTarget)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(pack.title)}</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1120px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
      h2 { font-size: 17px; }
      p, li, td { line-height: 1.55; }
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
        <p>Happy Chair Platform Admin / Server Test Evidence Pack</p>
        <h1>${escapeHtml(pack.title)}</h1>
        <p>${escapeHtml(backendServerTestEvidencePackBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(pack.status)}</strong></div>
        <div><span>Coverage</span><strong>${pack.coverageScore}%</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(pack.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(pack.engineeringOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(pack.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(pack.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${pack.method} ${pack.endpoint}`)}</strong></div>
        <div><span>Evidence</span><strong>${pack.verifiedEvidenceCount}/${pack.requiredEvidenceCount} verified</strong></div>
      </section>
      <section>
        <h2>Objective</h2>
        <p>${escapeHtml(pack.objective)}</p>
      </section>
      <section>
        <h2>Preconditions</h2>
        <ul>${listItems(pack.preconditions)}</ul>
      </section>
      <section>
        <h2>Runbook Steps</h2>
        <table><thead><tr><th>Step</th><th>Owner</th><th>Status</th><th>Detail</th><th>Expected Outcome</th></tr></thead><tbody>${stepRows}</tbody></table>
      </section>
      <section>
        <h2>Evidence Checklist</h2>
        <table><thead><tr><th>Type</th><th>Evidence</th><th>Status</th><th>Required</th><th>Expected Proof</th><th>Storage Target</th></tr></thead><tbody>${evidenceRows}</tbody></table>
      </section>
      <section>
        <h2>Failure Modes</h2>
        <ul>${listItems(pack.failureModes)}</ul>
      </section>
      <section>
        <h2>Exit Criteria</h2>
        <ul>${listItems(pack.exitCriteria)}</ul>
      </section>
      <section>
        <h2>Rollback And Audit</h2>
        <p><strong>Rollback:</strong> ${escapeHtml(pack.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(pack.auditPlan)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createPack(
  row: BackendServerHandlerTestRow,
  generatedAt: string,
): BackendServerTestEvidencePack {
  const evidenceItems = row.testCases.map(test => createEvidenceItem(row, test))
  const runbookSteps = buildRunbookSteps(row, evidenceItems)
  const recommendedStatus = getRecommendedPackStatus(row, evidenceItems)
  const requiredEvidence = evidenceItems.filter(item => item.required)
  const missingEvidenceCount = requiredEvidence.filter(item => item.status === 'Missing').length
  const reviewEvidenceCount = requiredEvidence.filter(item => item.status === 'Review').length
  const readyEvidenceCount = requiredEvidence.filter(item => item.status === 'Ready').length
  const verifiedEvidenceCount = requiredEvidence.filter(item => item.status === 'Verified').length

  return {
    id: getPackId(row),
    rowId: row.id,
    packetId: row.packetId,
    specId: row.specId,
    readinessCardId: row.readinessCardId,
    title: `${row.handlerLabel} server test evidence pack`,
    status: recommendedStatus,
    recommendedStatus,
    risk: row.risk,
    productOwner: row.productOwner,
    engineeringOwner: row.engineeringOwner,
    handlerKey: row.handlerKey,
    handlerLabel: row.handlerLabel,
    method: row.method,
    endpoint: row.endpoint,
    permission: row.permission,
    mutationMode: row.mutationMode,
    coverageScore: row.coverageScore,
    objective: `Prove ${row.handlerLabel} can be implemented and tested as a trusted server handler without browser-side production mutation.`,
    preconditions: buildPreconditions(row),
    runbookSteps,
    evidenceItems,
    failureModes: buildFailureModes(row),
    exitCriteria: buildExitCriteria(row),
    rollbackPlan: row.rollbackPlan,
    auditPlan: row.auditPlan,
    nextStep: getPackNextStep(recommendedStatus, row, missingEvidenceCount, reviewEvidenceCount),
    requiredEvidenceCount: requiredEvidence.length,
    verifiedEvidenceCount,
    missingEvidenceCount,
    reviewEvidenceCount,
    readyEvidenceCount,
    dryRunRequired: row.dryRunRequired,
    humanConfirmationRequired: row.humanConfirmationRequired,
    idempotencyRequired: row.idempotencyRequired,
    auditBacked: row.auditBacked,
    generatedAt,
  }
}

function withLatestRecord(
  pack: BackendServerTestEvidencePack,
  record: BackendServerTestEvidencePackRecord | undefined,
): BackendServerTestEvidencePack {
  if (!record) return pack
  return {
    ...pack,
    status: record.status,
    engineeringOwner: record.owner,
    evidenceLocation: record.evidenceLocation,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    auditBacked: true,
  }
}

function createEvidenceItem(
  row: BackendServerHandlerTestRow,
  test: BackendServerHandlerTestCase,
): BackendServerTestEvidenceItem {
  return {
    id: `evidence-${row.id}-${test.id}`,
    testCaseId: test.id,
    type: test.type,
    label: test.label,
    status: mapEvidenceStatus(test.status),
    required: test.required,
    expectedProof: test.expectedEvidence,
    captureMethod: test.automationHint,
    storageTarget: getStorageTarget(test.type, row),
  }
}

function buildRunbookSteps(
  row: BackendServerHandlerTestRow,
  evidenceItems: BackendServerTestEvidenceItem[],
): BackendServerTestRunbookStep[] {
  return [
    runbookStep('scope', 'Confirm handler scope', row.productOwner, 'Ready', `Review ${row.handlerKey}, ${row.permission}, and ${row.method} ${row.endpoint}.`, 'Handler scope is agreed before test execution.'),
    runbookStep('fixture', 'Capture pre-test fixture', row.engineeringOwner, getEvidenceStatusByType(evidenceItems, 'Actor Scope'), 'Record test actor, tenant scope, request payload, and baseline data snapshot.', 'The test can prove whether a mutation occurred.'),
    runbookStep('permission', 'Run permission denial case', row.engineeringOwner, getEvidenceStatusByType(evidenceItems, 'Permission'), 'Execute the denied actor scenario and capture rejection evidence.', 'Unauthorized actor receives a denial and no production write occurs.'),
    runbookStep('dry-run', 'Run dry-run and idempotency cases', row.engineeringOwner, getCombinedStatus(evidenceItems, ['Dry Run', 'Idempotency']), 'Execute dry-run and duplicate submission checks where required.', 'Dry-run avoids mutation and duplicate submission is guarded.'),
    runbookStep('audit', 'Validate audit payload', row.engineeringOwner, getEvidenceStatusByType(evidenceItems, 'Audit'), 'Inspect emitted audit payload for handler, actor, permission, rollbackPlan, and mutationApplied.', 'Audit event is immutable and complete.'),
    runbookStep('rollback', 'Attach rollback proof', row.engineeringOwner, getEvidenceStatusByType(evidenceItems, 'Rollback'), 'Confirm rollback notes and operational reversal path are attached.', 'Engineering and support can reverse a failed operation.'),
    runbookStep('boundary', 'Verify browser boundary', row.productOwner, getEvidenceStatusByType(evidenceItems, 'Browser Boundary'), 'Confirm Platform Admin only records local reviews, queues requests, and exports evidence.', 'No browser path mutates production directly.'),
    runbookStep('exit', 'Record evidence review', row.productOwner, getCombinedStatus(evidenceItems, ['Launch Acceptance', 'Browser Boundary', 'Audit']), 'Record final evidence review with links to test artifacts.', 'Evidence pack is ready for owner or engineering sign-off.'),
  ]
}

function runbookStep(
  id: string,
  label: string,
  owner: string,
  status: BackendServerTestEvidenceItemStatus,
  detail: string,
  expectedOutcome: string,
): BackendServerTestRunbookStep {
  return { id, label, owner, status, detail, expectedOutcome }
}

function buildPreconditions(row: BackendServerHandlerTestRow) {
  return [
    `${row.permission} is enforced server-side before ${row.handlerKey} can run.`,
    `Test actor and tenant scope are explicit for ${row.method} ${row.endpoint}.`,
    row.dryRunRequired ? 'Dry-run request path is available and must prove mutationApplied=false.' : 'Dry-run requirement is optional unless engineering marks the handler as production-changing.',
    row.idempotencyRequired ? 'Idempotency key is required for duplicate submission coverage.' : 'Idempotency requirement should be reviewed before mutation enablement.',
    'Rollback and audit plans are attached before any production-changing execution.',
  ]
}

function buildFailureModes(row: BackendServerHandlerTestRow) {
  return [
    `Permission bypass allows ${row.handlerKey} to execute without ${row.permission}.`,
    'Dry-run path writes production data or omits mutationApplied=false.',
    'Duplicate request applies the same operation more than once.',
    'Audit payload omits actor, permission, rollbackPlan, handler key, or productionWritePath.',
    'Rollback path is not specific enough for support or engineering to reverse a failed action.',
    'Platform Admin browser controls perform a production mutation instead of queueing/reviewing/exporting.',
  ]
}

function buildExitCriteria(row: BackendServerHandlerTestRow) {
  return [
    `${row.coverageScore}% matrix coverage is reviewed and unresolved missing evidence is accepted or cleared.`,
    'All required evidence items are Ready or Verified.',
    'Audit evidence proves mutationApplied behavior for denied, dry-run, and successful paths.',
    'Rollback proof is attached to the queued server handler work.',
    'Owner or engineering review is recorded in Platform Admin audit logs.',
  ]
}

function mapEvidenceStatus(status: BackendServerHandlerTestMatrixStatus): BackendServerTestEvidenceItemStatus {
  if (status === 'Passed') return 'Verified'
  if (status === 'Ready') return 'Ready'
  if (status === 'Review') return 'Review'
  return 'Missing'
}

function getEvidenceStatusByType(
  items: BackendServerTestEvidenceItem[],
  type: BackendServerHandlerTestType,
): BackendServerTestEvidenceItemStatus {
  const matches = items.filter(item => item.type === type && item.required)
  if (!matches.length) return 'Ready'
  return getWorstEvidenceStatus(matches)
}

function getCombinedStatus(
  items: BackendServerTestEvidenceItem[],
  types: BackendServerHandlerTestType[],
): BackendServerTestEvidenceItemStatus {
  const matches = items.filter(item => types.includes(item.type) && item.required)
  if (!matches.length) return 'Ready'
  return getWorstEvidenceStatus(matches)
}

function getWorstEvidenceStatus(items: BackendServerTestEvidenceItem[]): BackendServerTestEvidenceItemStatus {
  if (items.some(item => item.status === 'Missing')) return 'Missing'
  if (items.some(item => item.status === 'Review')) return 'Review'
  if (items.some(item => item.status === 'Ready')) return 'Ready'
  return 'Verified'
}

function getStorageTarget(type: BackendServerHandlerTestType, row: BackendServerHandlerTestRow) {
  if (type === 'Audit') return `Audit Logs / server_handler.${row.handlerKey}.executed`
  if (type === 'Rollback') return 'Engineering runbook / rollback notes'
  if (type === 'Browser Boundary') return 'Platform Admin browser QA evidence'
  return `Server test artifact / ${row.handlerKey}`
}

function getRecommendedPackStatus(
  row: BackendServerHandlerTestRow,
  evidenceItems: BackendServerTestEvidenceItem[],
): BackendServerTestEvidencePackStatus {
  const required = evidenceItems.filter(item => item.required)
  if (row.status === 'Blocked' || required.some(item => item.status === 'Missing')) return 'Blocked'
  if (row.status === 'Missing') return 'Missing Evidence'
  if (required.some(item => item.status === 'Review')) return 'Evidence Review'
  if (row.status === 'Passed' || required.every(item => item.status === 'Verified')) return 'Verified'
  return 'Ready For Execution'
}

function buildOwnerGroups(packs: BackendServerTestEvidencePack[]): BackendServerTestEvidenceOwnerGroup[] {
  const owners = Array.from(new Set(packs.map(pack => pack.engineeringOwner)))
  return owners.map(owner => {
    const ownerPacks = packs.filter(pack => pack.engineeringOwner === owner)
    const blocked = ownerPacks.filter(pack => pack.status === 'Blocked').length
    const missing = ownerPacks.filter(pack => pack.status === 'Missing Evidence').length
    const review = ownerPacks.filter(pack => pack.status === 'Evidence Review').length
    const ready = ownerPacks.filter(pack => pack.status === 'Ready For Execution').length
    const verified = ownerPacks.filter(pack => pack.status === 'Verified').length
    return {
      owner,
      total: ownerPacks.length,
      blocked,
      missing,
      review,
      ready,
      verified,
      criticalCount: ownerPacks.filter(pack => pack.risk === 'Critical' && pack.status !== 'Verified').length,
      nextStep: blocked
        ? 'Clear blocked evidence packs.'
        : missing
          ? 'Attach missing evidence before execution.'
          : review
            ? 'Review evidence gaps and policy notes.'
            : ready
              ? 'Queue ready runbooks for server test execution.'
              : 'Monitor verified evidence packs.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.missing - a.missing || b.review - a.review || a.owner.localeCompare(b.owner))
}

function buildEvidenceTypeGroups(packs: BackendServerTestEvidencePack[]): BackendServerTestEvidenceTypeGroup[] {
  const evidenceItems = packs.flatMap(pack => pack.evidenceItems)
  const types = Array.from(new Set(evidenceItems.map(item => item.type)))
  return types.map(type => {
    const typeItems = evidenceItems.filter(item => item.type === type)
    const missing = typeItems.filter(item => item.status === 'Missing').length
    const review = typeItems.filter(item => item.status === 'Review').length
    const ready = typeItems.filter(item => item.status === 'Ready').length
    const verified = typeItems.filter(item => item.status === 'Verified').length
    return {
      type,
      total: typeItems.length,
      missing,
      review,
      ready,
      verified,
      requiredCount: typeItems.filter(item => item.required).length,
      nextStep: missing
        ? `Attach missing ${type.toLowerCase()} evidence.`
        : review
          ? `Review ${type.toLowerCase()} evidence.`
          : ready
            ? `Queue ${type.toLowerCase()} evidence for verification.`
            : `Monitor verified ${type.toLowerCase()} evidence.`,
    }
  }).sort((a, b) => b.missing - a.missing || b.review - a.review || a.type.localeCompare(b.type))
}

function getAggregateStatus(packs: BackendServerTestEvidencePack[]): BackendServerTestEvidencePackStatus {
  if (!packs.length) return 'Verified'
  if (packs.some(pack => pack.status === 'Blocked')) return 'Blocked'
  if (packs.some(pack => pack.status === 'Missing Evidence')) return 'Missing Evidence'
  if (packs.some(pack => pack.status === 'Evidence Review')) return 'Evidence Review'
  if (packs.some(pack => pack.status === 'Ready For Execution')) return 'Ready For Execution'
  return 'Verified'
}

function getLatestRecordByPack(records: BackendServerTestEvidencePackRecord[]) {
  const latestRecordByPack = new Map<string, BackendServerTestEvidencePackRecord>()
  records.forEach(record => {
    if (!latestRecordByPack.has(record.packId)) latestRecordByPack.set(record.packId, record)
  })
  return latestRecordByPack
}

function getPackId(row: BackendServerHandlerTestRow) {
  return `server-test-evidence-${row.id}`
}

function getRegisterSummary(
  status: BackendServerTestEvidencePackStatus,
  blockedCount: number,
  missingCount: number,
  reviewCount: number,
  readyCount: number,
  verifiedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} evidence pack${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Missing Evidence') return `${missingCount} evidence pack${missingCount === 1 ? '' : 's'} are missing proof.`
  if (status === 'Evidence Review') return `${reviewCount} evidence pack${reviewCount === 1 ? '' : 's'} need review.`
  if (status === 'Ready For Execution') return `${readyCount} evidence pack${readyCount === 1 ? '' : 's'} are ready for server test execution.`
  return `${verifiedCount} evidence pack${verifiedCount === 1 ? '' : 's'} are verified.`
}

function getPackNextStep(
  status: BackendServerTestEvidencePackStatus,
  row: BackendServerHandlerTestRow,
  missingEvidenceCount: number,
  reviewEvidenceCount: number,
) {
  if (status === 'Blocked') return `Clear blocked test evidence before ${row.handlerLabel} can move forward.`
  if (status === 'Missing Evidence') return `Attach ${missingEvidenceCount} missing evidence item${missingEvidenceCount === 1 ? '' : 's'}.`
  if (status === 'Evidence Review') return `Review ${reviewEvidenceCount} evidence item${reviewEvidenceCount === 1 ? '' : 's'} before execution.`
  if (status === 'Ready For Execution') return `Queue ${row.handlerLabel} evidence pack for trusted server test execution.`
  return `${row.handlerLabel} evidence pack is verified.`
}

function defaultEvidenceLocation(pack: BackendServerTestEvidencePack) {
  return `Platform Admin / Launch Gate / Server Test Evidence / ${pack.handlerKey}`
}

function defaultEvidencePackNote(
  status: BackendServerTestEvidencePackStatus,
  pack: BackendServerTestEvidencePack,
) {
  if (status === 'Verified') return `${pack.handlerLabel} evidence pack verified.`
  if (status === 'Ready For Execution') return `${pack.handlerLabel} evidence pack ready for server test execution.`
  if (status === 'Evidence Review') return `${pack.handlerLabel} evidence pack needs review.`
  if (status === 'Missing Evidence') return `${pack.handlerLabel} evidence pack is missing required proof.`
  return `${pack.handlerLabel} evidence pack remains blocked.`
}

function statusRank(status: BackendServerTestEvidencePackStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Missing Evidence') return 4
  if (status === 'Evidence Review') return 3
  if (status === 'Ready For Execution') return 2
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

function emitBackendServerTestEvidencePackRecordChange() {
  listeners.forEach(listener => listener())
}
