import { useEffect, useState } from 'react'
import type { AdminActionRequest } from './actionRequests'
import type { ActionRequestGovernanceRecord, GovernanceCheckStatus } from './actionRequestGovernance'

export type ApprovalEvidenceSource = 'Launchpad' | 'Local Queue' | 'Read View'
export type ApprovalChecklistStatus = 'Confirmed' | 'Pending' | 'Blocked'

export interface ApprovalChecklistLocalState {
  requestId: string
  confirmedItemIds: string[]
  reviewedBy?: string
  reviewedAt?: string
  updatedAt: string
}

export interface ApprovalChecklistItem {
  id: string
  label: string
  detail: string
  required: boolean
  status: ApprovalChecklistStatus
  governanceStatus?: GovernanceCheckStatus
}

export interface ApprovalEvidencePack {
  requestId: string
  source: ApprovalEvidenceSource
  sourceCommitmentId?: string
  evidence: string[]
  context: Array<{ label: string; value: string }>
  checklist: ApprovalChecklistItem[]
  requiredCount: number
  confirmedRequiredCount: number
  blockedCount: number
  readyForApproval: boolean
  localState?: ApprovalChecklistLocalState
}

const localStorageKey = 'hc_platform_approval_evidence_checklist_state_v1'

export const approvalEvidencePackBoundaryRule =
  'Approval evidence packs are reviewer workflow state only. Confirming checklist items records review intent and audit context, but does not approve, execute, mutate production data, message customers, change billing, alter modules, or change permissions.'

export function buildApprovalEvidencePack(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord,
  localState?: ApprovalChecklistLocalState,
): ApprovalEvidencePack {
  const confirmed = new Set(localState?.confirmedItemIds ?? [])
  const evidence = readEvidence(request)
  const checklist = buildChecklist(request, governance, evidence, confirmed)
  const requiredItems = checklist.filter(item => item.required)
  const confirmedRequiredCount = requiredItems.filter(item => item.status === 'Confirmed').length
  const blockedCount = checklist.filter(item => item.status === 'Blocked').length

  return {
    requestId: request.id,
    source: getEvidenceSource(request),
    sourceCommitmentId: readStringMetadata(request, 'sourceCommitmentId') ?? readStringMetadata(request, 'ownerCommitmentId'),
    evidence,
    context: buildContext(request, governance),
    checklist,
    requiredCount: requiredItems.length,
    confirmedRequiredCount,
    blockedCount,
    readyForApproval: blockedCount === 0 && confirmedRequiredCount === requiredItems.length,
    localState,
  }
}

export function summarizeApprovalEvidencePacks(packs: ApprovalEvidencePack[]) {
  return {
    launchpad: packs.filter(pack => pack.source === 'Launchpad').length,
    ready: packs.filter(pack => pack.readyForApproval).length,
    blocked: packs.filter(pack => pack.blockedCount > 0).length,
    evidenceItems: packs.reduce((total, pack) => total + pack.evidence.length, 0),
  }
}

export function getApprovalChecklistStatusTone(status: ApprovalChecklistStatus) {
  if (status === 'Confirmed') return 'ok' as const
  if (status === 'Blocked') return 'danger' as const
  return 'warn' as const
}

export function loadLocalApprovalChecklistStates(): ApprovalChecklistLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isApprovalChecklistLocalState)
  } catch {
    return []
  }
}

export function saveLocalApprovalChecklistStates(states: ApprovalChecklistLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 220)))
}

export function useLocalApprovalChecklistStates() {
  const [states, setStates] = useState<ApprovalChecklistLocalState[]>(() => loadLocalApprovalChecklistStates())

  useEffect(() => {
    saveLocalApprovalChecklistStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildChecklist(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord,
  evidence: string[],
  confirmed: Set<string>,
): ApprovalChecklistItem[] {
  return [
    createChecklistItem({
      id: 'scope_reviewed',
      label: 'Scope reviewed',
      detail: `Reviewer confirmed scope is ${request.scope.label}.`,
      required: true,
      confirmed,
      blocked: !request.scope.label,
    }),
    createChecklistItem({
      id: 'permission_reviewed',
      label: 'Permission gate reviewed',
      detail: `Request requires ${request.permissionRequired}.`,
      required: true,
      confirmed,
      blocked: !request.permissionRequired,
    }),
    createChecklistItem({
      id: 'rollback_reviewed',
      label: 'Rollback reviewed',
      detail: request.rollbackNotes,
      required: true,
      confirmed,
      blocked: request.rollbackNotes.trim().length < 24,
    }),
    createChecklistItem({
      id: 'handler_reviewed',
      label: 'Server handler reviewed',
      detail: `${request.serverHandler.key}: ${request.serverHandler.description}`,
      required: true,
      confirmed,
      blocked: !request.serverHandler.key,
    }),
    createChecklistItem({
      id: 'evidence_reviewed',
      label: 'Evidence reviewed',
      detail: evidence.length ? `${evidence.length} evidence items attached.` : 'No launchpad evidence items are attached.',
      required: true,
      confirmed,
      blocked: evidence.length === 0 && request.metadata?.source === 'owner_commitment_ledger',
    }),
    createChecklistItem({
      id: 'human_gate_reviewed',
      label: 'Human gate reviewed',
      detail: governance.humanConfirmationRequired
        ? `Requires approval from ${governance.requiredApprovers.join(', ')}.`
        : 'Policy does not require human confirmation for this safety-oriented action.',
      required: governance.humanConfirmationRequired,
      confirmed,
      blocked: false,
    }),
    createChecklistItem({
      id: 'blockers_clear',
      label: 'Hard blockers clear',
      detail: governance.hardBlockers.length
        ? governance.hardBlockers.join(' ')
        : 'No hard governance blockers are present.',
      required: true,
      confirmed,
      blocked: governance.hardBlockers.length > 0,
    }),
  ]
}

function createChecklistItem(input: {
  id: string
  label: string
  detail: string
  required: boolean
  confirmed: Set<string>
  blocked: boolean
}): ApprovalChecklistItem {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    required: input.required,
    status: input.blocked ? 'Blocked' : input.confirmed.has(input.id) ? 'Confirmed' : 'Pending',
    governanceStatus: input.blocked ? 'fail' : input.confirmed.has(input.id) ? 'pass' : 'warn',
  }
}

function readEvidence(request: AdminActionRequest) {
  const evidence = request.metadata?.evidence
  if (!Array.isArray(evidence)) return []
  return evidence.filter(item => typeof item === 'string') as string[]
}

function buildContext(request: AdminActionRequest, governance: ActionRequestGovernanceRecord) {
  return [
    { label: 'Source', value: getEvidenceSource(request) },
    { label: 'Readiness', value: governance.readiness },
    { label: 'Risk', value: governance.riskLevel },
    { label: 'Approvers', value: governance.requiredApprovers.join(', ') },
    { label: 'Human Gate', value: governance.humanConfirmationRequired ? 'Required' : 'Not required' },
    { label: 'Audit Anchor', value: request.auditEventId },
    { label: 'Source Commitment', value: readStringMetadata(request, 'sourceCommitmentId') ?? 'Not attached' },
    { label: 'Mutation Applied', value: request.metadata?.mutationApplied === true ? 'Yes' : 'No' },
  ]
}

function getEvidenceSource(request: AdminActionRequest): ApprovalEvidenceSource {
  if (request.metadata?.source === 'owner_commitment_ledger' || request.metadata?.sourceCommitmentId || request.metadata?.ownerCommitmentId) {
    return 'Launchpad'
  }
  if (request.persistenceStatus === 'local_durable' || !request.persistenceStatus) return 'Local Queue'
  return 'Read View'
}

function readStringMetadata(request: AdminActionRequest, key: string) {
  const value = request.metadata?.[key]
  return typeof value === 'string' ? value : undefined
}

function isApprovalChecklistLocalState(value: unknown): value is ApprovalChecklistLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.requestId === 'string'
    && Array.isArray(record.confirmedItemIds)
    && record.confirmedItemIds.every(item => typeof item === 'string')
    && typeof record.updatedAt === 'string'
}
