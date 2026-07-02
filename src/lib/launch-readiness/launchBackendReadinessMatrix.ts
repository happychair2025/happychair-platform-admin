import type { AuditEvent } from '../audit/auditLog'
import {
  buildActionExecutionPackets,
  type ActionExecutionConfig,
} from '../admin-actions/actionExecutionContract'
import { buildActionRequestGovernance } from '../admin-actions/actionRequestGovernance'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import {
  buildApprovalEvidencePack,
  type ApprovalChecklistLocalState,
} from '../admin-actions/approvalEvidencePacks'
import {
  buildExecutionHandoffReadinessPack,
  type ExecutionHandoffReadinessState,
} from '../admin-actions/executionHandoffReadiness'
import {
  buildExecutionLedgerEvidenceChain,
  summarizeExecutionEvidenceChains,
} from '../admin-actions/executionLedgerEvidence'
import {
  getLatestMockServerExecution,
  type MockServerExecutionRecord,
} from '../admin-actions/mockServerExecutor'
import {
  buildServerAdapterCoverage,
  summarizeServerAdapterCoverage,
} from '../admin-actions/serverAdapterCoverage'
import { buildServerAdapterReadiness } from '../admin-actions/serverAdapterReadiness'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type LaunchBackendMatrixStatus = 'Ready' | 'Watch' | 'Blocked' | 'Missing'
export type LaunchBackendMatrixArea = 'Approval' | 'Handoff' | 'Execution' | 'Adapters' | 'Audit' | 'Safety'

export interface LaunchBackendMatrixCheck {
  id: string
  label: string
  status: LaunchBackendMatrixStatus
  detail: string
}

export interface LaunchBackendMatrixRow {
  id: string
  area: LaunchBackendMatrixArea
  title: string
  owner: string
  status: LaunchBackendMatrixStatus
  score: number
  metric: string
  evidence: string
  nextStep: string
  checks: LaunchBackendMatrixCheck[]
}

export interface LaunchBackendReadinessMatrix {
  status: LaunchBackendMatrixStatus
  score: number
  summary: string
  rows: LaunchBackendMatrixRow[]
  readyCount: number
  watchCount: number
  blockedCount: number
  missingCount: number
  generatedAt: string
}

export const launchBackendReadinessMatrixBoundaryRule =
  'Backend readiness matrix rows are implementation evidence only. They do not approve launch, wire server handlers, run mutations, change billing, change modules, update support records, alter permissions, or execute agent actions.'

export function buildLaunchBackendReadinessMatrix(input: {
  data: PlatformAdminReadModel
  actionRequests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  mockServerExecutions: MockServerExecutionRecord[]
  approvalStates: ApprovalChecklistLocalState[]
  handoffReadinessStates: ExecutionHandoffReadinessState[]
  executionConfig: ActionExecutionConfig
}): LaunchBackendReadinessMatrix {
  const governanceRecords = buildActionRequestGovernance(input.actionRequests, input.data)
  const governanceByRequestId = new Map(governanceRecords.map(record => [record.requestId, record]))
  const packets = buildActionExecutionPackets(input.actionRequests, governanceByRequestId, input.executionConfig)
  const packetByRequestId = new Map(packets.map(packet => [packet.requestId, packet]))
  const requestById = new Map(input.actionRequests.map(request => [request.id, request]))
  const auditEventById = new Map(input.auditEvents.map(event => [event.id, event]))
  const approvalPacks = input.actionRequests.map(request => {
    const governance = governanceByRequestId.get(request.id)
    if (!governance) return undefined
    return buildApprovalEvidencePack(
      request,
      governance,
      input.approvalStates.find(state => state.requestId === request.id),
    )
  }).filter((pack): pack is NonNullable<typeof pack> => Boolean(pack))
  const readinessPacks = input.actionRequests.map(request => {
    const governance = governanceByRequestId.get(request.id)
    const packet = packetByRequestId.get(request.id)
    if (!governance || !packet) return undefined
    return buildExecutionHandoffReadinessPack({
      request,
      governance,
      packet,
      latestDryRun: getLatestMockServerExecution(request.id, input.mockServerExecutions),
      localState: input.handoffReadinessStates.find(state => state.requestId === request.id),
    })
  }).filter((pack): pack is NonNullable<typeof pack> => Boolean(pack))
  const evidenceChains = input.mockServerExecutions.map(execution => {
    const request = requestById.get(execution.requestId)
    return buildExecutionLedgerEvidenceChain({
      request,
      governance: request ? governanceByRequestId.get(request.id) : undefined,
      packet: request ? packetByRequestId.get(request.id) : undefined,
      approvalPack: request ? approvalPacks.find(pack => pack.requestId === request.id) : undefined,
      readinessPack: request ? readinessPacks.find(pack => pack.requestId === request.id) : undefined,
      execution,
      auditEvent: auditEventById.get(execution.auditEventId),
    })
  })
  const adapterContracts = buildServerAdapterReadiness(input.executionConfig)
  const adapterCoverage = buildServerAdapterCoverage({
    contracts: adapterContracts,
    requests: input.actionRequests,
    executions: input.mockServerExecutions,
    auditEvents: input.auditEvents,
  })
  const adapterSummary = summarizeServerAdapterCoverage(adapterCoverage)
  const evidenceSummary = summarizeExecutionEvidenceChains(evidenceChains)
  const rows = [
    buildActionRequestRow(input.actionRequests, governanceRecords),
    buildApprovalEvidenceRow(input.actionRequests, approvalPacks),
    buildHandoffReadinessRow(input.actionRequests, readinessPacks),
    buildDryRunRow(input.mockServerExecutions),
    buildExecutionEvidenceRow(evidenceSummary, evidenceChains.length),
    buildAdapterCoverageRow(adapterSummary),
    buildAuditChainRow(input.auditEvents),
    buildRollbackProofRow(input.actionRequests),
    buildBrowserBoundaryRow(packets, input.mockServerExecutions),
  ]
  const readyCount = rows.filter(row => row.status === 'Ready').length
  const watchCount = rows.filter(row => row.status === 'Watch').length
  const blockedCount = rows.filter(row => row.status === 'Blocked').length
  const missingCount = rows.filter(row => row.status === 'Missing').length
  const score = Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length)
  const status = blockedCount
    ? 'Blocked'
    : missingCount
      ? 'Missing'
      : watchCount
        ? 'Watch'
        : 'Ready'

  return {
    status,
    score,
    summary: getMatrixSummary(status, blockedCount, missingCount, watchCount),
    rows,
    readyCount,
    watchCount,
    blockedCount,
    missingCount,
    generatedAt: new Date().toISOString(),
  }
}

export function getLaunchBackendMatrixTone(status: LaunchBackendMatrixStatus) {
  if (status === 'Ready') return 'ok' as const
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Watch') return 'warn' as const
  return 'neutral' as const
}

function buildActionRequestRow(
  requests: AdminActionRequest[],
  governanceRecords: ReturnType<typeof buildActionRequestGovernance>,
): LaunchBackendMatrixRow {
  const openRequests = requests.filter(request => ['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'].includes(request.status))
  const blockedRequests = requests.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const governanceBlockers = governanceRecords.reduce((total, record) => total + record.hardBlockers.length, 0)
  return createRow({
    id: 'action_request_pipeline',
    area: 'Approval',
    title: 'Admin Action Request pipeline',
    owner: 'Owner / Admin',
    status: blockedRequests.length || governanceBlockers ? 'Blocked' : requests.length ? 'Ready' : 'Missing',
    score: blockedRequests.length || governanceBlockers ? 45 : requests.length ? 100 : 25,
    metric: `${requests.length} requests / ${openRequests.length} open`,
    evidence: `${blockedRequests.length} blocked requests and ${governanceBlockers} governance blockers.`,
    nextStep: blockedRequests.length || governanceBlockers
      ? 'Clear blocked or failed action requests before backend implementation.'
      : requests.length
        ? 'Keep requests scoped and audit-backed as handlers are wired.'
        : 'Create admin action requests for backend implementation candidates.',
    checks: [
      check('requests_present', 'Requests present', requests.length ? 'Ready' : 'Missing', `${requests.length} action requests are available.`),
      check('open_queue', 'Open queue visible', openRequests.length ? 'Watch' : 'Ready', `${openRequests.length} open requests remain in the queue.`),
      check('governance_blockers', 'Governance blockers', governanceBlockers ? 'Blocked' : 'Ready', `${governanceBlockers} hard governance blockers are present.`),
    ],
  })
}

function buildApprovalEvidenceRow(
  requests: AdminActionRequest[],
  approvalPacks: ReturnType<typeof buildApprovalEvidencePack>[],
): LaunchBackendMatrixRow {
  const blocked = approvalPacks.filter(pack => pack.blockedCount > 0).length
  const ready = approvalPacks.filter(pack => pack.readyForApproval).length
  const pending = Math.max(0, approvalPacks.length - blocked - ready)
  return createRow({
    id: 'approval_evidence',
    area: 'Approval',
    title: 'Approval evidence packs',
    owner: 'Owner / Domain Owners',
    status: blocked ? 'Blocked' : approvalPacks.length && pending === 0 ? 'Ready' : requests.length ? 'Watch' : 'Missing',
    score: blocked ? 50 : approvalPacks.length ? Math.round((ready / approvalPacks.length) * 100) : 25,
    metric: `${ready}/${approvalPacks.length} ready`,
    evidence: `${blocked} blocked packs, ${pending} pending packs, ${approvalPacks.reduce((total, pack) => total + pack.evidence.length, 0)} evidence items.`,
    nextStep: blocked
      ? 'Resolve blocked approval checklist items.'
      : pending
        ? 'Confirm remaining approval evidence before backend wiring.'
        : approvalPacks.length
          ? 'Approval evidence is ready for current requests.'
          : 'Create approval packs by queueing/reviewing action requests.',
    checks: [
      check('packs_present', 'Packs present', approvalPacks.length ? 'Ready' : 'Missing', `${approvalPacks.length} approval packs are available.`),
      check('packs_ready', 'Ready packs', pending || blocked ? 'Watch' : 'Ready', `${ready} packs are fully confirmed.`),
      check('packs_blocked', 'Blocked packs', blocked ? 'Blocked' : 'Ready', `${blocked} packs contain blockers.`),
    ],
  })
}

function buildHandoffReadinessRow(
  requests: AdminActionRequest[],
  readinessPacks: ReturnType<typeof buildExecutionHandoffReadinessPack>[],
): LaunchBackendMatrixRow {
  const blocked = readinessPacks.filter(pack => pack.status === 'Blocked').length
  const readyForDryRun = readinessPacks.filter(pack => pack.readyForDryRun).length
  const readyForServer = readinessPacks.filter(pack => pack.readyForServer).length
  const assigned = readinessPacks.filter(pack => pack.assignedExecutor).length
  return createRow({
    id: 'execution_handoff_readiness',
    area: 'Handoff',
    title: 'Execution handoff readiness',
    owner: 'Engineering / Support Lead',
    status: blocked ? 'Blocked' : readyForServer ? 'Ready' : readyForDryRun ? 'Watch' : requests.length ? 'Watch' : 'Missing',
    score: readinessPacks.length ? Math.round(((readyForDryRun + readyForServer + assigned) / (readinessPacks.length * 3)) * 100) : 25,
    metric: `${readyForDryRun} dry-run ready / ${readyForServer} server ready`,
    evidence: `${assigned} assigned executors and ${blocked} blocked readiness packs.`,
    nextStep: blocked
      ? 'Assign executors and clear handoff checklist blockers.'
      : readyForServer
        ? 'Server-ready handoff exists; keep human confirmation and audit gates intact.'
        : readyForDryRun
          ? 'Run or review dry-run output, then re-check server readiness.'
          : 'Confirm required handoff readiness items.',
    checks: [
      check('readiness_present', 'Readiness packs present', readinessPacks.length ? 'Ready' : 'Missing', `${readinessPacks.length} readiness packs are available.`),
      check('executor_assigned', 'Executors assigned', assigned === readinessPacks.length && readinessPacks.length ? 'Ready' : 'Watch', `${assigned}/${readinessPacks.length} packs have assigned executors.`),
      check('readiness_blocked', 'Readiness blockers', blocked ? 'Blocked' : 'Ready', `${blocked} readiness packs are blocked.`),
    ],
  })
}

function buildDryRunRow(executions: MockServerExecutionRecord[]): LaunchBackendMatrixRow {
  const passed = executions.filter(execution => execution.status === 'Dry Run Passed' || execution.status === 'Completed Snapshot').length
  const blocked = executions.filter(execution => execution.status === 'Dry Run Blocked').length
  const needsApproval = executions.filter(execution => execution.status === 'Needs Approval').length
  return createRow({
    id: 'dry_run_ledger',
    area: 'Execution',
    title: 'Dry-run execution ledger',
    owner: 'Engineering',
    status: blocked ? 'Blocked' : passed ? 'Ready' : executions.length ? 'Watch' : 'Missing',
    score: blocked ? 50 : executions.length ? Math.round((passed / executions.length) * 100) : 25,
    metric: `${passed}/${executions.length} passed`,
    evidence: `${blocked} blocked dry runs and ${needsApproval} previews still needing approval.`,
    nextStep: blocked
      ? 'Resolve blocked dry-run checks.'
      : passed
        ? 'Keep dry-run proof current as request payloads change.'
        : 'Run mock server dry runs from Execution Handoff.',
    checks: [
      check('dry_runs_present', 'Dry runs present', executions.length ? 'Ready' : 'Missing', `${executions.length} dry-run records are available.`),
      check('dry_runs_passed', 'Dry runs passed', passed ? 'Ready' : 'Watch', `${passed} dry runs passed.`),
      check('dry_runs_blocked', 'Dry runs blocked', blocked ? 'Blocked' : 'Ready', `${blocked} dry runs are blocked.`),
    ],
  })
}

function buildExecutionEvidenceRow(
  evidenceSummary: ReturnType<typeof summarizeExecutionEvidenceChains>,
  evidenceChainCount: number,
): LaunchBackendMatrixRow {
  return createRow({
    id: 'execution_evidence_chain',
    area: 'Execution',
    title: 'Execution evidence chain',
    owner: 'Engineering / Owner',
    status: evidenceSummary.blocked ? 'Blocked' : evidenceSummary.missing ? 'Missing' : evidenceSummary.warning ? 'Watch' : evidenceChainCount ? 'Ready' : 'Missing',
    score: evidenceChainCount ? evidenceSummary.averageScore : 25,
    metric: `${evidenceSummary.averageScore}% average`,
    evidence: `${evidenceSummary.verified} verified chains, ${evidenceSummary.warning} warnings, ${evidenceSummary.blocked} blocked, ${evidenceSummary.missing} missing.`,
    nextStep: evidenceSummary.blocked
      ? 'Open Execution Ledger and clear blocked evidence chain items.'
      : evidenceSummary.missing
        ? 'Link missing request, approval, readiness, dry-run, or audit proof.'
        : evidenceSummary.warning
          ? 'Review warning evidence before backend implementation.'
          : evidenceChainCount
            ? 'Evidence chains are ready for current dry-run records.'
            : 'Create dry-run records so execution evidence can be generated.',
    checks: [
      check('chains_present', 'Evidence chains present', evidenceChainCount ? 'Ready' : 'Missing', `${evidenceChainCount} evidence chains are available.`),
      check('chains_verified', 'Verified chains', evidenceSummary.verified ? 'Ready' : 'Watch', `${evidenceSummary.verified} chains are verified.`),
      check('chains_blocked', 'Blocked chains', evidenceSummary.blocked ? 'Blocked' : 'Ready', `${evidenceSummary.blocked} chains are blocked.`),
    ],
  })
}

function buildAdapterCoverageRow(adapterSummary: ReturnType<typeof summarizeServerAdapterCoverage>): LaunchBackendMatrixRow {
  return createRow({
    id: 'server_adapter_coverage',
    area: 'Adapters',
    title: 'Server adapter coverage',
    owner: 'Engineering',
    status: adapterSummary.blocked ? 'Blocked' : adapterSummary.needsDryRun ? 'Watch' : adapterSummary.covered || adapterSummary.readyForWiring ? 'Ready' : 'Missing',
    score: adapterSummary.averageScore,
    metric: `${adapterSummary.covered + adapterSummary.readyForWiring}/${adapterSummary.total} covered`,
    evidence: `${adapterSummary.needsDryRun} need dry run, ${adapterSummary.blocked} blocked, ${adapterSummary.reviewed} reviewed.`,
    nextStep: adapterSummary.blocked
      ? 'Resolve blocked adapter coverage before backend wiring.'
      : adapterSummary.needsDryRun
        ? 'Run dry-run coverage for handlers with request demand.'
        : adapterSummary.reviewed < adapterSummary.total
          ? 'Record adapter reviews for handler coverage proof.'
          : 'Adapter coverage is ready for implementation planning.',
    checks: [
      check('adapters_present', 'Adapters present', adapterSummary.total ? 'Ready' : 'Missing', `${adapterSummary.total} adapter contracts are registered.`),
      check('adapters_covered', 'Covered handlers', adapterSummary.covered || adapterSummary.readyForWiring ? 'Ready' : 'Watch', `${adapterSummary.covered + adapterSummary.readyForWiring} handlers are covered.`),
      check('adapters_blocked', 'Blocked handlers', adapterSummary.blocked ? 'Blocked' : 'Ready', `${adapterSummary.blocked} handlers are blocked.`),
    ],
  })
}

function buildAuditChainRow(auditEvents: AuditEvent[]): LaunchBackendMatrixRow {
  const actionAuditEvents = auditEvents.filter(event => event.actionKey.includes('admin_action') || event.actionKey.includes('execution_') || event.actionKey.includes('server_adapter'))
  const blockedEvents = auditEvents.filter(event => event.outcome === 'blocked').length
  return createRow({
    id: 'audit_chain',
    area: 'Audit',
    title: 'Audit chain coverage',
    owner: 'Owner / Engineering',
    status: actionAuditEvents.length ? blockedEvents ? 'Watch' : 'Ready' : 'Missing',
    score: actionAuditEvents.length ? blockedEvents ? 80 : 100 : 25,
    metric: `${actionAuditEvents.length} action audit events`,
    evidence: `${blockedEvents} blocked audit outcomes are present.`,
    nextStep: actionAuditEvents.length
      ? blockedEvents
        ? 'Review blocked audit events and confirm they are expected guardrails.'
        : 'Audit chain is recording action, handoff, adapter, and execution reviews.'
      : 'Record reviews or dry runs to anchor backend readiness in the audit ledger.',
    checks: [
      check('audit_present', 'Audit events present', actionAuditEvents.length ? 'Ready' : 'Missing', `${actionAuditEvents.length} backend-readiness audit events are available.`),
      check('blocked_outcomes', 'Blocked outcomes reviewed', blockedEvents ? 'Watch' : 'Ready', `${blockedEvents} blocked audit outcomes are present.`),
      check('local_durable', 'Local durable ledger', auditEvents.length ? 'Ready' : 'Missing', `${auditEvents.length} total audit events are loaded.`),
    ],
  })
}

function buildRollbackProofRow(requests: AdminActionRequest[]): LaunchBackendMatrixRow {
  const withRollback = requests.filter(request => request.rollbackNotes.trim().length >= 24).length
  const missingRollback = requests.length - withRollback
  return createRow({
    id: 'rollback_proof',
    area: 'Safety',
    title: 'Rollback proof',
    owner: 'Engineering / Domain Owners',
    status: missingRollback ? requests.length ? 'Blocked' : 'Missing' : 'Ready',
    score: requests.length ? Math.round((withRollback / requests.length) * 100) : 25,
    metric: `${withRollback}/${requests.length} captured`,
    evidence: `${missingRollback} requests need stronger rollback notes.`,
    nextStep: missingRollback
      ? 'Capture rollback notes before any backend implementation work proceeds.'
      : requests.length
        ? 'Rollback proof is present for current action requests.'
        : 'Create action requests with rollback notes for backend candidates.',
    checks: [
      check('rollback_present', 'Rollback notes present', withRollback ? 'Ready' : 'Missing', `${withRollback} requests have rollback proof.`),
      check('rollback_missing', 'Rollback notes missing', missingRollback ? 'Blocked' : 'Ready', `${missingRollback} requests are missing rollback proof.`),
      check('request_scope', 'Request scope', requests.length ? 'Ready' : 'Missing', `${requests.length} scoped requests are available.`),
    ],
  })
}

function buildBrowserBoundaryRow(
  packets: ReturnType<typeof buildActionExecutionPackets>,
  executions: MockServerExecutionRecord[],
): LaunchBackendMatrixRow {
  const browserMutationAllowed = packets.filter(packet => packet.browserMutationAllowed).length
  const mutationsApplied = executions.filter(execution => Boolean(execution.mutationApplied)).length
  return createRow({
    id: 'browser_mutation_boundary',
    area: 'Safety',
    title: 'Browser mutation boundary',
    owner: 'Engineering',
    status: browserMutationAllowed || mutationsApplied ? 'Blocked' : 'Ready',
    score: browserMutationAllowed || mutationsApplied ? 0 : 100,
    metric: `${browserMutationAllowed + mutationsApplied} unsafe flags`,
    evidence: `${packets.length} execution packets and ${executions.length} dry-run records keep browser mutation disabled.`,
    nextStep: browserMutationAllowed || mutationsApplied
      ? 'Stop backend implementation until browser mutation flags are removed.'
      : 'Boundary is intact: browser reviews evidence only and never mutates production.',
    checks: [
      check('browser_packet_boundary', 'Packet boundary', browserMutationAllowed ? 'Blocked' : 'Ready', `${browserMutationAllowed} packets allow browser mutation.`),
      check('dry_run_boundary', 'Dry-run boundary', mutationsApplied ? 'Blocked' : 'Ready', `${mutationsApplied} dry-run records applied mutations.`),
      check('server_required', 'Server required', 'Ready', 'Production-changing work still requires trusted server handlers.'),
    ],
  })
}

function createRow(row: LaunchBackendMatrixRow): LaunchBackendMatrixRow {
  return row
}

function check(
  id: string,
  label: string,
  status: LaunchBackendMatrixStatus,
  detail: string,
): LaunchBackendMatrixCheck {
  return { id, label, status, detail }
}

function getMatrixSummary(
  status: LaunchBackendMatrixStatus,
  blockedCount: number,
  missingCount: number,
  watchCount: number,
) {
  if (status === 'Blocked') return `Backend implementation remains blocked by ${blockedCount} matrix gate${blockedCount === 1 ? '' : 's'}.`
  if (status === 'Missing') return `Backend implementation is missing proof in ${missingCount} matrix gate${missingCount === 1 ? '' : 's'}.`
  if (status === 'Watch') return `${watchCount} matrix gate${watchCount === 1 ? '' : 's'} need review before backend implementation.`
  return 'Backend implementation evidence is ready for owner review.'
}
