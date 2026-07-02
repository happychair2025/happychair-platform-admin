import { useEffect, useState } from 'react'
import type { ActionExecutionPacket } from './actionExecutionContract'
import type { ActionRequestGovernanceRecord } from './actionRequestGovernance'
import type { AdminActionRequest } from './actionRequests'
import type { MockServerExecutionRecord } from './mockServerExecutor'

export type ExecutionHandoffReadinessStatus =
  | 'Blocked'
  | 'Needs Review'
  | 'Ready For Dry Run'
  | 'Ready For Server'
  | 'Completed'

export type ExecutionHandoffChecklistStatus = 'Confirmed' | 'Pending' | 'Blocked'

export interface ExecutionHandoffReadinessState {
  requestId: string
  confirmedItemIds: string[]
  assignedExecutor?: string
  handoffWindow?: string
  note?: string
  reviewedBy?: string
  reviewedAt?: string
  updatedAt: string
}

export interface ExecutionHandoffChecklistItem {
  id: string
  label: string
  detail: string
  required: boolean
  status: ExecutionHandoffChecklistStatus
}

export interface ExecutionHandoffReadinessPack {
  requestId: string
  status: ExecutionHandoffReadinessStatus
  assignedExecutor?: string
  handoffWindow?: string
  checklist: ExecutionHandoffChecklistItem[]
  requiredCount: number
  confirmedRequiredCount: number
  blockedCount: number
  dryRunStatus: MockServerExecutionRecord['status'] | 'Not simulated'
  readyForDryRun: boolean
  readyForServer: boolean
  localState?: ExecutionHandoffReadinessState
}

const localStorageKey = 'hc_platform_execution_handoff_readiness_state_v1'

export const executionHandoffReadinessBoundaryRule =
  'Execution handoff readiness is local reviewer workflow state. It can assign an executor, confirm packet review, and document dry-run/server readiness, but it cannot execute production mutations from the browser.'

export function buildExecutionHandoffReadinessPack(input: {
  request: AdminActionRequest
  governance: ActionRequestGovernanceRecord
  packet: ActionExecutionPacket
  latestDryRun?: MockServerExecutionRecord
  localState?: ExecutionHandoffReadinessState
}): ExecutionHandoffReadinessPack {
  const confirmed = new Set(input.localState?.confirmedItemIds ?? [])
  const checklist = buildChecklist(input, confirmed)
  const requiredItems = checklist.filter(item => item.required)
  const confirmedRequiredCount = requiredItems.filter(item => item.status === 'Confirmed').length
  const blockedCount = checklist.filter(item => item.status === 'Blocked').length
  const dryRunStatus = input.latestDryRun?.status ?? 'Not simulated'
  const requiredComplete = confirmedRequiredCount === requiredItems.length
  const readyForDryRun = blockedCount === 0
    && requiredComplete
    && input.request.status === 'Approved'
  const readyForServer = readyForDryRun
    && input.packet.posture === 'Ready For Server'
    && dryRunStatus === 'Dry Run Passed'

  return {
    requestId: input.request.id,
    status: getReadinessStatus(input.request, input.packet, blockedCount, readyForDryRun, readyForServer),
    assignedExecutor: input.localState?.assignedExecutor,
    handoffWindow: input.localState?.handoffWindow,
    checklist,
    requiredCount: requiredItems.length,
    confirmedRequiredCount,
    blockedCount,
    dryRunStatus,
    readyForDryRun,
    readyForServer,
    localState: input.localState,
  }
}

export function summarizeExecutionHandoffReadiness(packs: ExecutionHandoffReadinessPack[]) {
  return {
    total: packs.length,
    assigned: packs.filter(pack => pack.assignedExecutor).length,
    needsReview: packs.filter(pack => pack.status === 'Needs Review').length,
    readyForDryRun: packs.filter(pack => pack.readyForDryRun).length,
    readyForServer: packs.filter(pack => pack.readyForServer).length,
    blocked: packs.filter(pack => pack.status === 'Blocked').length,
  }
}

export function getExecutionHandoffReadinessTone(status: ExecutionHandoffReadinessStatus) {
  if (status === 'Ready For Server' || status === 'Completed') return 'ok' as const
  if (status === 'Ready For Dry Run') return 'info' as const
  if (status === 'Blocked') return 'danger' as const
  return 'warn' as const
}

export function getExecutionHandoffChecklistTone(status: ExecutionHandoffChecklistStatus) {
  if (status === 'Confirmed') return 'ok' as const
  if (status === 'Blocked') return 'danger' as const
  return 'warn' as const
}

export function loadLocalExecutionHandoffReadinessStates(): ExecutionHandoffReadinessState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isExecutionHandoffReadinessState)
  } catch {
    return []
  }
}

export function saveLocalExecutionHandoffReadinessStates(states: ExecutionHandoffReadinessState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 220)))
}

export function useLocalExecutionHandoffReadinessStates() {
  const [states, setStates] = useState<ExecutionHandoffReadinessState[]>(() => loadLocalExecutionHandoffReadinessStates())

  useEffect(() => {
    saveLocalExecutionHandoffReadinessStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildChecklist(
  input: {
    request: AdminActionRequest
    governance: ActionRequestGovernanceRecord
    packet: ActionExecutionPacket
    latestDryRun?: MockServerExecutionRecord
    localState?: ExecutionHandoffReadinessState
  },
  confirmed: Set<string>,
): ExecutionHandoffChecklistItem[] {
  const dryRunBlocked = input.latestDryRun?.status === 'Dry Run Blocked'
  return [
    createChecklistItem({
      id: 'executor_assigned',
      label: 'Executor assigned',
      detail: input.localState?.assignedExecutor
        ? `Assigned to ${input.localState.assignedExecutor}.`
        : 'Assign a human owner before server handoff.',
      required: true,
      confirmed,
      autoConfirmed: Boolean(input.localState?.assignedExecutor),
      blocked: !input.localState?.assignedExecutor,
    }),
    createChecklistItem({
      id: 'approval_confirmed',
      label: 'Approval confirmed',
      detail: `Request status is ${input.request.status}.`,
      required: true,
      confirmed,
      autoConfirmed: input.request.status === 'Approved' || input.request.status === 'Running' || input.request.status === 'Completed',
      blocked: input.request.status !== 'Approved' && input.request.status !== 'Running' && input.request.status !== 'Completed',
    }),
    createChecklistItem({
      id: 'governance_clear',
      label: 'Governance clear',
      detail: input.governance.hardBlockers[0] ?? `Governance readiness is ${input.governance.readiness}.`,
      required: true,
      confirmed,
      autoConfirmed: input.governance.hardBlockers.length === 0 && (input.governance.readiness === 'Ready' || input.governance.readiness === 'Executing' || input.governance.readiness === 'Completed'),
      blocked: input.governance.hardBlockers.length > 0,
    }),
    createChecklistItem({
      id: 'dry_run_reviewed',
      label: 'Dry run reviewed',
      detail: input.latestDryRun
        ? `${input.latestDryRun.status}: ${input.latestDryRun.outcomeSummary}`
        : 'No mock server dry run is linked yet.',
      required: true,
      confirmed,
      autoConfirmed: input.latestDryRun?.status === 'Dry Run Passed' || input.latestDryRun?.status === 'Completed Snapshot',
      blocked: dryRunBlocked,
    }),
    createChecklistItem({
      id: 'endpoint_reviewed',
      label: 'Endpoint reviewed',
      detail: input.packet.endpointLabel,
      required: input.packet.posture === 'Ready For Server',
      confirmed,
      autoConfirmed: false,
      blocked: false,
    }),
    createChecklistItem({
      id: 'idempotency_confirmed',
      label: 'Idempotency confirmed',
      detail: input.packet.idempotencyKey,
      required: true,
      confirmed,
      autoConfirmed: false,
      blocked: false,
    }),
    createChecklistItem({
      id: 'rollback_confirmed',
      label: 'Rollback confirmed',
      detail: input.request.rollbackNotes,
      required: true,
      confirmed,
      autoConfirmed: false,
      blocked: input.request.rollbackNotes.trim().length < 24,
    }),
    createChecklistItem({
      id: 'browser_boundary_confirmed',
      label: 'Browser boundary confirmed',
      detail: 'Browser mutation is disabled; production execution belongs to a trusted server handler.',
      required: true,
      confirmed,
      autoConfirmed: false,
      blocked: input.packet.browserMutationAllowed,
    }),
  ]
}

function createChecklistItem(input: {
  id: string
  label: string
  detail: string
  required: boolean
  confirmed: Set<string>
  autoConfirmed: boolean
  blocked: boolean
}): ExecutionHandoffChecklistItem {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    required: input.required,
    status: input.blocked ? 'Blocked' : input.autoConfirmed || input.confirmed.has(input.id) ? 'Confirmed' : 'Pending',
  }
}

function getReadinessStatus(
  request: AdminActionRequest,
  packet: ActionExecutionPacket,
  blockedCount: number,
  readyForDryRun: boolean,
  readyForServer: boolean,
): ExecutionHandoffReadinessStatus {
  if (request.status === 'Completed' || packet.posture === 'Completed') return 'Completed'
  if (blockedCount > 0 || packet.posture === 'Blocked') return 'Blocked'
  if (readyForServer) return 'Ready For Server'
  if (readyForDryRun) return 'Ready For Dry Run'
  return 'Needs Review'
}

function isExecutionHandoffReadinessState(value: unknown): value is ExecutionHandoffReadinessState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.requestId === 'string'
    && Array.isArray(record.confirmedItemIds)
    && record.confirmedItemIds.every(item => typeof item === 'string')
    && typeof record.updatedAt === 'string'
}
