import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  BackendEngineeringHandoffPacket,
  BackendEngineeringHandoffRegister,
} from './backendEngineeringHandoffPackets'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'

export type BackendServerHandlerTestMatrixStatus = 'Blocked' | 'Missing' | 'Review' | 'Ready' | 'Passed'
export type BackendServerHandlerTestType =
  'Permission'
  | 'Actor Scope'
  | 'Dry Run'
  | 'Idempotency'
  | 'Audit'
  | 'Rollback'
  | 'Browser Boundary'
  | 'Launch Acceptance'

export interface BackendServerHandlerTestCase {
  id: string
  type: BackendServerHandlerTestType
  label: string
  status: BackendServerHandlerTestMatrixStatus
  required: boolean
  scenario: string
  expectedEvidence: string
  automationHint: string
}

export interface BackendServerHandlerTestRow {
  id: string
  packetId: string
  specId: string
  readinessCardId: string
  status: BackendServerHandlerTestMatrixStatus
  recommendedStatus: BackendServerHandlerTestMatrixStatus
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
  requiredCount: number
  passedCount: number
  readyCount: number
  reviewCount: number
  blockedCount: number
  missingCount: number
  nextStep: string
  testCases: BackendServerHandlerTestCase[]
  rollbackPlan: string
  auditPlan: string
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

export interface BackendServerHandlerTestGroup {
  id: string
  label: string
  status: BackendServerHandlerTestMatrixStatus
  total: number
  blocked: number
  missing: number
  review: number
  ready: number
  passed: number
  averageCoverage: number
  nextStep: string
}

export interface BackendServerHandlerTestMatrix {
  status: BackendServerHandlerTestMatrixStatus
  summary: string
  generatedAt: string
  rows: BackendServerHandlerTestRow[]
  nextRow?: BackendServerHandlerTestRow
  totalCount: number
  blockedCount: number
  missingCount: number
  reviewCount: number
  readyCount: number
  passedCount: number
  criticalCount: number
  averageCoverage: number
  requiredCaseCount: number
  readyCaseCount: number
  auditBackedCount: number
  permissionGroups: BackendServerHandlerTestGroup[]
  endpointGroups: BackendServerHandlerTestGroup[]
}

export interface BackendServerHandlerTestRecord {
  id: string
  rowId: string
  status: BackendServerHandlerTestMatrixStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendServerHandlerTestMatrixInput {
  handoffRegister: BackendEngineeringHandoffRegister
  records: BackendServerHandlerTestRecord[]
}

interface SaveBackendServerHandlerTestRecordInput {
  row: BackendServerHandlerTestRow
  status: BackendServerHandlerTestMatrixStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_server_handler_test_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendServerHandlerTestRecord[] = []

export const backendServerHandlerTestMatrixBoundaryRule =
  'Server handler test matrix updates are local verification records only. They do not run live handlers, deploy code, mutate production data, change billing, alter modules, change permissions, impersonate users, or execute agent actions.'

export const backendServerHandlerTestMatrixStatuses: BackendServerHandlerTestMatrixStatus[] = [
  'Blocked',
  'Missing',
  'Review',
  'Ready',
  'Passed',
]

export function buildBackendServerHandlerTestMatrix({
  handoffRegister,
  records,
}: BuildBackendServerHandlerTestMatrixInput): BackendServerHandlerTestMatrix {
  const generatedAt = new Date().toISOString()
  const latestRecordByRow = getLatestRecordByRow(records)
  const rows = handoffRegister.packets
    .map(packet => withLatestRecord(createRow(packet, generatedAt), latestRecordByRow.get(getRowId(packet))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openRows = rows.filter(row => row.status !== 'Passed')
  const blockedCount = rows.filter(row => row.status === 'Blocked').length
  const missingCount = rows.filter(row => row.status === 'Missing').length
  const reviewCount = rows.filter(row => row.status === 'Review').length
  const readyCount = rows.filter(row => row.status === 'Ready').length
  const passedCount = rows.filter(row => row.status === 'Passed').length
  const status = getAggregateStatus(rows)
  const requiredCaseCount = rows.reduce((total, row) => total + row.requiredCount, 0)
  const readyCaseCount = rows.reduce((total, row) => total + row.readyCount + row.passedCount, 0)
  const averageCoverage = rows.length
    ? Math.round(rows.reduce((total, row) => total + row.coverageScore, 0) / rows.length)
    : 0

  return {
    status,
    summary: getMatrixSummary(status, blockedCount, missingCount, reviewCount, readyCount, passedCount),
    generatedAt,
    rows,
    nextRow: openRows[0],
    totalCount: rows.length,
    blockedCount,
    missingCount,
    reviewCount,
    readyCount,
    passedCount,
    criticalCount: openRows.filter(row => row.risk === 'Critical').length,
    averageCoverage,
    requiredCaseCount,
    readyCaseCount,
    auditBackedCount: rows.filter(row => row.auditBacked).length,
    permissionGroups: buildGroups(rows, 'permission'),
    endpointGroups: buildGroups(rows, 'endpoint'),
  }
}

export function getBackendServerHandlerTestRecords(): BackendServerHandlerTestRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendServerHandlerTestRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendServerHandlerTestRecord(input: SaveBackendServerHandlerTestRecordInput) {
  const record: BackendServerHandlerTestRecord = {
    id: crypto.randomUUID(),
    rowId: input.row.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultTestRecordNote(input.status, input.row),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendServerHandlerTestRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendServerHandlerTestRecordChange()
  return record
}

export function subscribeToBackendServerHandlerTestRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendServerHandlerTestRecords() {
  return useSyncExternalStore(subscribeToBackendServerHandlerTestRecords, getBackendServerHandlerTestRecords, () => [])
}

export function getBackendServerHandlerTestTone(status: BackendServerHandlerTestMatrixStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Passed' || status === 'Ready') return 'ok'
  if (status === 'Blocked' || status === 'Missing') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendServerHandlerTestRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendServerHandlerTestMatrixFilename(row: BackendServerHandlerTestRow) {
  return `server-handler-test-matrix-${row.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendServerHandlerTestMatrixHtml(row: BackendServerHandlerTestRow, session: AdminSession) {
  const testRows = row.testCases.map(test => `
    <tr>
      <td>${escapeHtml(test.type)}</td>
      <td>${escapeHtml(test.label)}</td>
      <td>${escapeHtml(test.status)}</td>
      <td>${test.required ? 'Required' : 'Optional'}</td>
      <td>${escapeHtml(test.scenario)}</td>
      <td>${escapeHtml(test.expectedEvidence)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(row.handlerLabel)} Server Handler Test Matrix</title>
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
        <p>Happy Chair Platform Admin / Server Handler Test Matrix</p>
        <h1>${escapeHtml(row.handlerLabel)}</h1>
        <p>${escapeHtml(backendServerHandlerTestMatrixBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(row.status)}</strong></div>
        <div><span>Coverage</span><strong>${row.coverageScore}%</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(row.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(row.engineeringOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(row.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(row.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${row.method} ${row.endpoint}`)}</strong></div>
        <div><span>Mode</span><strong>${escapeHtml(row.mutationMode)}</strong></div>
      </section>
      <section>
        <h2>Next Step</h2>
        <p>${escapeHtml(row.nextStep)}</p>
      </section>
      <section>
        <h2>Test Cases</h2>
        <table><thead><tr><th>Type</th><th>Case</th><th>Status</th><th>Required</th><th>Scenario</th><th>Expected Evidence</th></tr></thead><tbody>${testRows}</tbody></table>
      </section>
      <section>
        <h2>Rollback And Audit</h2>
        <p><strong>Rollback:</strong> ${escapeHtml(row.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(row.auditPlan)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createRow(
  packet: BackendEngineeringHandoffPacket,
  generatedAt: string,
): BackendServerHandlerTestRow {
  const testCases = buildTestCases(packet)
  const recommendedStatus = getRecommendedStatus(packet, testCases)
  const requiredCases = testCases.filter(test => test.required)
  const passedCount = requiredCases.filter(test => test.status === 'Passed').length
  const readyCount = requiredCases.filter(test => test.status === 'Ready').length
  const reviewCount = requiredCases.filter(test => test.status === 'Review').length
  const blockedCount = requiredCases.filter(test => test.status === 'Blocked').length
  const missingCount = requiredCases.filter(test => test.status === 'Missing').length
  const coverageScore = requiredCases.length
    ? Math.round(((passedCount + readyCount) / requiredCases.length) * 100)
    : 100

  return {
    id: getRowId(packet),
    packetId: packet.id,
    specId: packet.specId,
    readinessCardId: packet.readinessCardId,
    status: recommendedStatus,
    recommendedStatus,
    risk: packet.risk,
    productOwner: packet.productOwner,
    engineeringOwner: packet.engineeringOwner,
    handlerKey: packet.handlerKey,
    handlerLabel: packet.handlerLabel,
    method: packet.method,
    endpoint: packet.endpoint,
    permission: packet.permission,
    mutationMode: packet.mutationMode,
    coverageScore,
    requiredCount: requiredCases.length,
    passedCount,
    readyCount,
    reviewCount,
    blockedCount,
    missingCount,
    nextStep: getNextStep(recommendedStatus, packet, blockedCount, missingCount, reviewCount),
    testCases,
    rollbackPlan: packet.rollbackPlan,
    auditPlan: packet.auditPlan,
    dryRunRequired: packet.dryRunRequired,
    humanConfirmationRequired: packet.humanConfirmationRequired,
    idempotencyRequired: packet.idempotencyRequired,
    auditBacked: packet.auditBacked,
    generatedAt,
  }
}

function withLatestRecord(
  row: BackendServerHandlerTestRow,
  record: BackendServerHandlerTestRecord | undefined,
): BackendServerHandlerTestRow {
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

function buildTestCases(packet: BackendEngineeringHandoffPacket): BackendServerHandlerTestCase[] {
  const readyStatus = getReadyCaseStatus(packet)
  const blockedStatus: BackendServerHandlerTestMatrixStatus = packet.status === 'Blocked' ? 'Blocked' : readyStatus
  const authorizedStatus: BackendServerHandlerTestMatrixStatus = packet.status === 'Blocked'
    ? 'Blocked'
    : packet.status === 'Draft' || packet.status === 'Review'
      ? 'Review'
      : readyStatus
  const acceptanceStatus: BackendServerHandlerTestMatrixStatus = packet.blockerCount
    ? 'Blocked'
    : packet.reviewGateCount
      ? 'Review'
      : readyStatus
  const mutationCandidate = packet.mutationMode === 'Server Mutation Candidate'
  const dryRunStatus: BackendServerHandlerTestMatrixStatus = packet.dryRunRequired
    ? readyStatus
    : mutationCandidate
      ? 'Missing'
      : readyStatus
  const idempotencyStatus: BackendServerHandlerTestMatrixStatus = packet.idempotencyRequired
    ? readyStatus
    : mutationCandidate
      ? 'Review'
      : readyStatus
  const auditStatus: BackendServerHandlerTestMatrixStatus = packet.auditPlan.includes('mutationApplied') && packet.auditPlan.includes('rollbackPlan')
    ? readyStatus
    : 'Missing'
  const rollbackStatus: BackendServerHandlerTestMatrixStatus = packet.rollbackPlan.length >= 24 ? readyStatus : 'Missing'

  return [
    testCase({
      id: 'permission_denied',
      type: 'Permission',
      label: 'Unauthorized actor is denied',
      status: blockedStatus,
      required: true,
      scenario: `Call ${packet.method} ${packet.endpoint} without ${packet.permission}.`,
      expectedEvidence: '403-style rejection, no mutationApplied flag, and audit event with denied outcome.',
      automationHint: 'Unit or integration test with a role below the required permission.',
    }),
    testCase({
      id: 'authorized_actor',
      type: 'Actor Scope',
      label: 'Authorized actor reaches handler boundary',
      status: authorizedStatus,
      required: true,
      scenario: `Call ${packet.handlerKey} as ${packet.engineeringOwner} with ${packet.permission}.`,
      expectedEvidence: 'Handler validates actor, scope, tenant context, and request shape before any write path.',
      automationHint: 'Server test with scoped admin session and explicit permission assertion.',
    }),
    testCase({
      id: 'dry_run_no_mutation',
      type: 'Dry Run',
      label: 'Dry-run path performs no mutation',
      status: dryRunStatus,
      required: mutationCandidate,
      scenario: `Submit ${packet.handlerKey} with dryRun=true.`,
      expectedEvidence: 'Response previews outcome, audit event records mutationApplied=false, and no production row changes.',
      automationHint: 'Database snapshot before/after dry-run handler invocation.',
    }),
    testCase({
      id: 'idempotency_duplicate',
      type: 'Idempotency',
      label: 'Duplicate submission is deduped',
      status: idempotencyStatus,
      required: mutationCandidate,
      scenario: `Submit ${packet.handlerKey} twice with the same idempotency key.`,
      expectedEvidence: 'Second call returns same operation reference or duplicate guard without applying a second mutation.',
      automationHint: 'Repeat request integration test with deterministic idempotency key.',
    }),
    testCase({
      id: 'audit_shape',
      type: 'Audit',
      label: 'Audit event contains required fields',
      status: auditStatus,
      required: true,
      scenario: `Review audit payload for ${packet.handlerKey}.`,
      expectedEvidence: 'actor, permission, scope, outcome, mutationApplied, rollbackPlan, productionWritePath, and handler key.',
      automationHint: 'Schema assertion against emitted audit event payload.',
    }),
    testCase({
      id: 'rollback_reference',
      type: 'Rollback',
      label: 'Rollback reference is attached',
      status: rollbackStatus,
      required: true,
      scenario: `Inspect rollback notes for ${packet.handlerKey}.`,
      expectedEvidence: 'Rollback plan is specific enough for support or engineering to reverse a failed action.',
      automationHint: 'Static packet assertion plus handler metadata assertion.',
    }),
    testCase({
      id: 'browser_boundary',
      type: 'Browser Boundary',
      label: 'Platform Admin cannot mutate directly',
      status: readyStatus,
      required: true,
      scenario: 'Exercise Platform Admin buttons from Launch Gate.',
      expectedEvidence: 'UI only records local review, queues a request, or exports an artifact; production mutation remains server-only.',
      automationHint: 'Browser QA confirms action metadata has localOnly=true and mutationApplied=false.',
    }),
    testCase({
      id: 'launch_acceptance',
      type: 'Launch Acceptance',
      label: 'Launch acceptance gates are clear',
      status: acceptanceStatus,
      required: true,
      scenario: `Review ${packet.handlerLabel} launch acceptance criteria.`,
      expectedEvidence: `${packet.blockerCount} blocked gates, ${packet.reviewGateCount} review gates, and ${packet.readyGateCount} ready gates.`,
      automationHint: 'Derived from handler spec gates and engineering handoff packet acceptance checks.',
    }),
    testCase({
      id: 'human_confirmation',
      type: 'Actor Scope',
      label: 'Human confirmation rule is explicit',
      status: readyStatus,
      required: packet.humanConfirmationRequired,
      scenario: `Check confirmation requirement before ${packet.handlerKey} can apply production changes.`,
      expectedEvidence: packet.humanConfirmationRequired
        ? 'Handler requires explicit human confirmation before production mutation.'
        : 'Handler is classified as not requiring extra confirmation beyond permission and audit controls.',
      automationHint: 'Server handler policy assertion.',
    }),
  ]
}

function testCase(input: BackendServerHandlerTestCase): BackendServerHandlerTestCase {
  return input
}

function getRecommendedStatus(
  packet: BackendEngineeringHandoffPacket,
  testCases: BackendServerHandlerTestCase[],
): BackendServerHandlerTestMatrixStatus {
  const requiredCases = testCases.filter(test => test.required)
  if (packet.status === 'Blocked' || requiredCases.some(test => test.status === 'Blocked')) return 'Blocked'
  if (requiredCases.some(test => test.status === 'Missing')) return 'Missing'
  if (requiredCases.some(test => test.status === 'Review')) return 'Review'
  if (packet.status === 'Accepted') return 'Passed'
  return 'Ready'
}

function getReadyCaseStatus(packet: BackendEngineeringHandoffPacket): BackendServerHandlerTestMatrixStatus {
  return packet.status === 'Accepted' ? 'Passed' : 'Ready'
}

function buildGroups(
  rows: BackendServerHandlerTestRow[],
  mode: 'permission' | 'endpoint',
): BackendServerHandlerTestGroup[] {
  const labels = Array.from(new Set(rows.map(row => mode === 'permission' ? row.permission : `${row.method} ${row.endpoint}`)))
  return labels.map(label => {
    const groupRows = rows.filter(row => (mode === 'permission' ? row.permission : `${row.method} ${row.endpoint}`) === label)
    const status = getAggregateStatus(groupRows)
    const blocked = groupRows.filter(row => row.status === 'Blocked').length
    const missing = groupRows.filter(row => row.status === 'Missing').length
    const review = groupRows.filter(row => row.status === 'Review').length
    const ready = groupRows.filter(row => row.status === 'Ready').length
    const passed = groupRows.filter(row => row.status === 'Passed').length
    const averageCoverage = groupRows.length
      ? Math.round(groupRows.reduce((total, row) => total + row.coverageScore, 0) / groupRows.length)
      : 0
    return {
      id: `${mode}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      label,
      status,
      total: groupRows.length,
      blocked,
      missing,
      review,
      ready,
      passed,
      averageCoverage,
      nextStep: getGroupNextStep(status, blocked, missing, review, ready),
    }
  }).sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.label.localeCompare(b.label))
}

function getAggregateStatus(rows: BackendServerHandlerTestRow[]): BackendServerHandlerTestMatrixStatus {
  if (!rows.length) return 'Passed'
  if (rows.some(row => row.status === 'Blocked')) return 'Blocked'
  if (rows.some(row => row.status === 'Missing')) return 'Missing'
  if (rows.some(row => row.status === 'Review')) return 'Review'
  if (rows.some(row => row.status === 'Ready')) return 'Ready'
  return 'Passed'
}

function getLatestRecordByRow(records: BackendServerHandlerTestRecord[]) {
  const latestRecordByRow = new Map<string, BackendServerHandlerTestRecord>()
  records.forEach(record => {
    if (!latestRecordByRow.has(record.rowId)) latestRecordByRow.set(record.rowId, record)
  })
  return latestRecordByRow
}

function getRowId(packet: BackendEngineeringHandoffPacket) {
  return `server-handler-test-${packet.id}`
}

function getMatrixSummary(
  status: BackendServerHandlerTestMatrixStatus,
  blockedCount: number,
  missingCount: number,
  reviewCount: number,
  readyCount: number,
  passedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} handler test row${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Missing') return `${missingCount} handler test row${missingCount === 1 ? '' : 's'} are missing required evidence.`
  if (status === 'Review') return `${reviewCount} handler test row${reviewCount === 1 ? '' : 's'} need review.`
  if (status === 'Ready') return `${readyCount} handler test row${readyCount === 1 ? '' : 's'} are ready for server test execution.`
  return `${passedCount} handler test row${passedCount === 1 ? '' : 's'} have passed local review.`
}

function getNextStep(
  status: BackendServerHandlerTestMatrixStatus,
  packet: BackendEngineeringHandoffPacket,
  blockedCount: number,
  missingCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return `Clear ${blockedCount} blocked required test case${blockedCount === 1 ? '' : 's'} before ${packet.handlerLabel} can enter server implementation.`
  if (status === 'Missing') return `Attach missing test evidence before ${packet.handlerLabel} can be marked ready.`
  if (status === 'Review') return `Review ${reviewCount} required test case${reviewCount === 1 ? '' : 's'} and confirm policy coverage.`
  if (status === 'Ready') return `Queue ${packet.handlerLabel} for trusted server test execution.`
  return `${packet.handlerLabel} test matrix has passed local review.`
}

function getGroupNextStep(
  status: BackendServerHandlerTestMatrixStatus,
  blocked: number,
  missing: number,
  review: number,
  ready: number,
) {
  if (status === 'Blocked') return `Clear ${blocked} blocked handler test row${blocked === 1 ? '' : 's'}.`
  if (status === 'Missing') return `Attach missing evidence for ${missing} row${missing === 1 ? '' : 's'}.`
  if (status === 'Review') return `Review ${review} handler test row${review === 1 ? '' : 's'}.`
  if (status === 'Ready') return `Queue ${ready} ready handler test row${ready === 1 ? '' : 's'} for execution.`
  return 'Monitor passed handler test coverage.'
}

function defaultTestRecordNote(
  status: BackendServerHandlerTestMatrixStatus,
  row: BackendServerHandlerTestRow,
) {
  if (status === 'Passed') return `${row.handlerLabel} server handler test matrix marked passed.`
  if (status === 'Ready') return `${row.handlerLabel} server handler tests are ready for execution.`
  if (status === 'Review') return `${row.handlerLabel} server handler tests need review.`
  if (status === 'Missing') return `${row.handlerLabel} server handler tests are missing required evidence.`
  return `${row.handlerLabel} server handler test matrix remains blocked.`
}

function statusRank(status: BackendServerHandlerTestMatrixStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Missing') return 4
  if (status === 'Review') return 3
  if (status === 'Ready') return 2
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

function emitBackendServerHandlerTestRecordChange() {
  listeners.forEach(listener => listener())
}
