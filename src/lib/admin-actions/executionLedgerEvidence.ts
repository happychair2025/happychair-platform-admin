import type { AuditEvent } from '../audit/auditLog'
import type { ActionExecutionPacket } from './actionExecutionContract'
import type { ActionRequestGovernanceRecord } from './actionRequestGovernance'
import type { AdminActionRequest } from './actionRequests'
import type { ApprovalEvidencePack } from './approvalEvidencePacks'
import type { ExecutionHandoffReadinessPack } from './executionHandoffReadiness'
import type { MockServerExecutionRecord } from './mockServerExecutor'

export type ExecutionEvidenceChainStatus = 'Verified' | 'Warning' | 'Blocked' | 'Missing'

export interface ExecutionEvidenceChainItem {
  id: string
  label: string
  status: ExecutionEvidenceChainStatus
  detail: string
  reference: string
  actor?: string
  timestamp?: string
}

export interface ExecutionLedgerEvidenceChain {
  requestId: string
  executionId?: string
  status: ExecutionEvidenceChainStatus
  items: ExecutionEvidenceChainItem[]
  verifiedCount: number
  warningCount: number
  blockedCount: number
  missingCount: number
  evidenceScore: number
  mutationApplied: boolean
  browserMutationAllowed: boolean
  auditEventIds: string[]
}

export const executionLedgerEvidenceBoundaryRule =
  'Execution ledger evidence is an audit review surface. It links local review, approval, readiness, and dry-run records, but it does not approve, execute, retry, or mutate customer state.'

export function buildExecutionLedgerEvidenceChain(input: {
  request?: AdminActionRequest
  governance?: ActionRequestGovernanceRecord
  packet?: ActionExecutionPacket
  approvalPack?: ApprovalEvidencePack
  readinessPack?: ExecutionHandoffReadinessPack
  execution?: MockServerExecutionRecord
  auditEvent?: AuditEvent
}): ExecutionLedgerEvidenceChain {
  const requestId = input.request?.id ?? input.execution?.requestId ?? 'unknown-request'
  const items = [
    buildRequestItem(input.request, input.execution),
    buildGovernanceItem(input.governance),
    buildApprovalItem(input.approvalPack),
    buildReadinessItem(input.readinessPack),
    buildDryRunItem(input.execution),
    buildAuditItem(input.request, input.execution, input.auditEvent),
    buildIdempotencyItem(input.packet, input.execution),
    buildRollbackBoundaryItem(input.request, input.packet, input.execution),
  ]
  const verifiedCount = items.filter(item => item.status === 'Verified').length
  const warningCount = items.filter(item => item.status === 'Warning').length
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const missingCount = items.filter(item => item.status === 'Missing').length
  const mutationApplied = Boolean(input.execution?.mutationApplied)
  const browserMutationAllowed = Boolean(input.packet?.browserMutationAllowed)

  return {
    requestId,
    executionId: input.execution?.id,
    status: getChainStatus(blockedCount, missingCount, warningCount, mutationApplied, browserMutationAllowed),
    items,
    verifiedCount,
    warningCount,
    blockedCount,
    missingCount,
    evidenceScore: Math.round((verifiedCount / items.length) * 100),
    mutationApplied,
    browserMutationAllowed,
    auditEventIds: collectAuditEventIds(input.request, input.execution, input.auditEvent),
  }
}

export function summarizeExecutionEvidenceChains(chains: ExecutionLedgerEvidenceChain[]) {
  return {
    total: chains.length,
    verified: chains.filter(chain => chain.status === 'Verified').length,
    warning: chains.filter(chain => chain.status === 'Warning').length,
    blocked: chains.filter(chain => chain.status === 'Blocked').length,
    missing: chains.filter(chain => chain.status === 'Missing').length,
    mutationApplied: chains.filter(chain => chain.mutationApplied || chain.browserMutationAllowed).length,
    averageScore: chains.length
      ? Math.round(chains.reduce((total, chain) => total + chain.evidenceScore, 0) / chains.length)
      : 0,
  }
}

export function getExecutionEvidenceTone(status: ExecutionEvidenceChainStatus) {
  if (status === 'Verified') return 'ok' as const
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Warning') return 'warn' as const
  return 'neutral' as const
}

function buildRequestItem(
  request: AdminActionRequest | undefined,
  execution: MockServerExecutionRecord | undefined,
): ExecutionEvidenceChainItem {
  if (!request) {
    return createItem({
      id: 'request',
      label: 'Action request',
      status: 'Missing',
      detail: 'The dry-run record exists, but the source action request is not available in the current read model.',
      reference: execution?.requestId ?? 'No request id',
      actor: execution?.actorEmail,
      timestamp: execution?.createdAt,
    })
  }

  return createItem({
    id: 'request',
    label: 'Action request',
    status: request.status === 'Blocked' || request.status === 'Failed' ? 'Blocked' : 'Verified',
    detail: `${request.title} is ${request.status} and scoped to ${request.scope.label}.`,
    reference: request.id,
    actor: request.requestedBy.email ?? request.requestedBy.name,
    timestamp: request.updatedAt ?? request.createdAt,
  })
}

function buildGovernanceItem(governance: ActionRequestGovernanceRecord | undefined): ExecutionEvidenceChainItem {
  if (!governance) {
    return createItem({
      id: 'governance',
      label: 'Governance policy',
      status: 'Missing',
      detail: 'No governance record is available for this request.',
      reference: 'No governance record',
    })
  }

  return createItem({
    id: 'governance',
    label: 'Governance policy',
    status: governance.hardBlockers.length
      ? 'Blocked'
      : governance.readiness === 'Ready' || governance.readiness === 'Executing' || governance.readiness === 'Completed'
        ? 'Verified'
        : 'Warning',
    detail: governance.hardBlockers[0]
      ?? `${governance.riskLevel} risk policy requires ${governance.requiredApprovers.join(', ')}.`,
    reference: governance.readiness,
  })
}

function buildApprovalItem(approvalPack: ApprovalEvidencePack | undefined): ExecutionEvidenceChainItem {
  if (!approvalPack) {
    return createItem({
      id: 'approval',
      label: 'Approval evidence',
      status: 'Missing',
      detail: 'No approval evidence pack is linked to this request.',
      reference: 'No approval pack',
    })
  }

  return createItem({
    id: 'approval',
    label: 'Approval evidence',
    status: approvalPack.blockedCount
      ? 'Blocked'
      : approvalPack.readyForApproval
        ? 'Verified'
        : 'Warning',
    detail: `${approvalPack.confirmedRequiredCount} of ${approvalPack.requiredCount} required reviewer items confirmed with ${approvalPack.evidence.length} evidence item${approvalPack.evidence.length === 1 ? '' : 's'}.`,
    reference: approvalPack.sourceCommitmentId ?? approvalPack.source,
    actor: approvalPack.localState?.reviewedBy,
    timestamp: approvalPack.localState?.reviewedAt ?? approvalPack.localState?.updatedAt,
  })
}

function buildReadinessItem(readinessPack: ExecutionHandoffReadinessPack | undefined): ExecutionEvidenceChainItem {
  if (!readinessPack) {
    return createItem({
      id: 'readiness',
      label: 'Handoff readiness',
      status: 'Missing',
      detail: 'No execution handoff readiness pack is available for this request.',
      reference: 'No readiness pack',
    })
  }

  return createItem({
    id: 'readiness',
    label: 'Handoff readiness',
    status: readinessPack.status === 'Blocked'
      ? 'Blocked'
      : readinessPack.readyForServer || readinessPack.status === 'Completed'
        ? 'Verified'
        : 'Warning',
    detail: `${readinessPack.confirmedRequiredCount} of ${readinessPack.requiredCount} required handoff items confirmed. Assigned executor: ${readinessPack.assignedExecutor ?? 'Not assigned'}.`,
    reference: readinessPack.status,
    actor: readinessPack.localState?.reviewedBy,
    timestamp: readinessPack.localState?.reviewedAt ?? readinessPack.localState?.updatedAt,
  })
}

function buildDryRunItem(execution: MockServerExecutionRecord | undefined): ExecutionEvidenceChainItem {
  if (!execution) {
    return createItem({
      id: 'dry_run',
      label: 'Dry-run execution',
      status: 'Missing',
      detail: 'No mock server dry-run record is linked to this request.',
      reference: 'No dry run',
    })
  }

  return createItem({
    id: 'dry_run',
    label: 'Dry-run execution',
    status: execution.status === 'Dry Run Blocked'
      ? 'Blocked'
      : execution.status === 'Dry Run Passed' || execution.status === 'Completed Snapshot'
        ? 'Verified'
        : 'Warning',
    detail: execution.outcomeSummary,
    reference: execution.id,
    actor: execution.actorEmail,
    timestamp: execution.createdAt,
  })
}

function buildAuditItem(
  request: AdminActionRequest | undefined,
  execution: MockServerExecutionRecord | undefined,
  auditEvent: AuditEvent | undefined,
): ExecutionEvidenceChainItem {
  if (!request?.auditEventId && !execution?.auditEventId) {
    return createItem({
      id: 'audit',
      label: 'Audit lineage',
      status: 'Missing',
      detail: 'No audit anchor is attached to the request or execution record.',
      reference: 'No audit anchor',
    })
  }

  return createItem({
    id: 'audit',
    label: 'Audit lineage',
    status: auditEvent || request?.auditEventId || execution?.auditEventId ? 'Verified' : 'Warning',
    detail: auditEvent
      ? `${auditEvent.actionLabel} was recorded by ${auditEvent.actorEmail ?? auditEvent.actor}.`
      : 'Audit ids are present, but the full audit event is not available in the current read model.',
    reference: execution?.auditEventId ?? request?.auditEventId ?? 'Audit id pending',
    actor: auditEvent?.actorEmail ?? auditEvent?.actor,
    timestamp: auditEvent?.createdAt,
  })
}

function buildIdempotencyItem(
  packet: ActionExecutionPacket | undefined,
  execution: MockServerExecutionRecord | undefined,
): ExecutionEvidenceChainItem {
  const packetKey = packet?.idempotencyKey
  const executionKey = execution?.idempotencyKey
  const packetCorrelation = packet?.correlationId
  const executionCorrelation = execution?.correlationId

  if (!packetKey && !executionKey) {
    return createItem({
      id: 'idempotency',
      label: 'Idempotency and correlation',
      status: 'Missing',
      detail: 'No idempotency key is available for this evidence chain.',
      reference: 'No idempotency key',
    })
  }

  const keyMatches = !packetKey || !executionKey || packetKey === executionKey
  const correlationMatches = !packetCorrelation || !executionCorrelation || packetCorrelation === executionCorrelation

  return createItem({
    id: 'idempotency',
    label: 'Idempotency and correlation',
    status: keyMatches && correlationMatches ? 'Verified' : 'Warning',
    detail: keyMatches && correlationMatches
      ? 'Idempotency and correlation keys are present for traceable server handoff.'
      : 'The packet and execution record do not fully agree on idempotency or correlation.',
    reference: executionKey ?? packetKey ?? 'Key pending',
  })
}

function buildRollbackBoundaryItem(
  request: AdminActionRequest | undefined,
  packet: ActionExecutionPacket | undefined,
  execution: MockServerExecutionRecord | undefined,
): ExecutionEvidenceChainItem {
  const hasRollback = Boolean(request?.rollbackNotes && request.rollbackNotes.trim().length >= 24)
  const mutationApplied = Boolean(execution?.mutationApplied)
  const browserMutationAllowed = Boolean(packet?.browserMutationAllowed)

  return createItem({
    id: 'rollback_boundary',
    label: 'Rollback and browser boundary',
    status: mutationApplied || browserMutationAllowed
      ? 'Blocked'
      : hasRollback
        ? 'Verified'
        : 'Missing',
    detail: mutationApplied || browserMutationAllowed
      ? 'A mutation boundary flag is unsafe for browser-side execution review.'
      : hasRollback
        ? request?.rollbackNotes ?? 'Rollback notes are captured and browser mutation remains disabled.'
        : 'Rollback notes are missing or too short for execution evidence.',
    reference: mutationApplied ? 'mutationApplied=true' : browserMutationAllowed ? 'browserMutationAllowed=true' : 'mutationApplied=false',
  })
}

function getChainStatus(
  blockedCount: number,
  missingCount: number,
  warningCount: number,
  mutationApplied: boolean,
  browserMutationAllowed: boolean,
): ExecutionEvidenceChainStatus {
  if (blockedCount > 0 || mutationApplied || browserMutationAllowed) return 'Blocked'
  if (missingCount > 0) return 'Missing'
  if (warningCount > 0) return 'Warning'
  return 'Verified'
}

function collectAuditEventIds(
  request: AdminActionRequest | undefined,
  execution: MockServerExecutionRecord | undefined,
  auditEvent: AuditEvent | undefined,
) {
  return Array.from(new Set([
    request?.auditEventId,
    request?.transitionAuditEventId,
    execution?.auditEventId,
    auditEvent?.id,
  ].filter((value): value is string => Boolean(value))))
}

function createItem(input: ExecutionEvidenceChainItem): ExecutionEvidenceChainItem {
  return input
}
