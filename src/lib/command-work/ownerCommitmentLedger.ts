import { useEffect, useState } from 'react'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandWorkPriority } from './commandWorkQueue'
import type {
  OwnerDecisionRecord,
  OwnerDecisionStatus,
  OwnerDecisionTargetPage,
} from './ownerDecisionRoom'

export type OwnerCommitmentStatus = 'Open' | 'In Progress' | 'Blocked' | 'Due Soon' | 'Overdue' | 'Completed' | 'Dismissed'
export type OwnerCommitmentSource = 'Owner Decision' | 'Follow-Up' | 'Escalation' | 'Closure'
export type OwnerCommitmentTargetPage = OwnerDecisionTargetPage | 'owner-commitment-ledger' | 'action-request-launchpad'

export interface OwnerCommitmentLocalState {
  commitmentId: string
  status: OwnerCommitmentStatus
  owner?: string
  note?: string
  blockedReason?: string
  dueAt?: string
  completedAt?: string
  updatedAt: string
}

export interface OwnerCommitmentItem {
  id: string
  title: string
  description: string
  source: OwnerCommitmentSource
  owner: string
  scope: string
  priority: CommandWorkPriority
  status: OwnerCommitmentStatus
  sourceStatus: OwnerDecisionStatus
  targetPage: OwnerCommitmentTargetPage
  targetPermission: PermissionKey
  recommendedAction: string
  evidence: string[]
  rollbackNotes: string
  dueAt: string
  createdAt: string
  relatedDecisionId: string
  relatedRecordId: string
  selectedOptionLabel?: string
  blockedReason?: string
  completedAt?: string
  localState?: OwnerCommitmentLocalState
}

export interface OwnerCommitmentLedgerSummary {
  total: number
  open: number
  inProgress: number
  blocked: number
  dueSoon: number
  overdue: number
  completed: number
  dismissed: number
  critical: number
  followUps: number
}

export interface BuildOwnerCommitmentLedgerInput {
  decisions: OwnerDecisionRecord[]
  localStates?: OwnerCommitmentLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_owner_commitment_ledger_state_v1'
const dueSoonWindowMs = 4 * 60 * 60 * 1000

export const ownerCommitmentLedgerBoundaryRule =
  'Owner Commitment Ledger tracks local accountability for owner decisions. It can assign owners, flag blockers, mark completion, and preserve audit evidence, but it cannot approve, execute, mutate, message customers, change billing, alter modules, change permissions, or resolve support records from the browser.'

export function buildOwnerCommitmentLedger(input: BuildOwnerCommitmentLedgerInput): OwnerCommitmentItem[] {
  const now = input.now ?? new Date()
  const localStateByCommitmentId = new Map((input.localStates ?? []).map(state => [state.commitmentId, state]))
  return input.decisions
    .map(decision => createCommitment(decision, now, localStateByCommitmentId.get(createCommitmentId(decision))))
    .sort(sortOwnerCommitments)
}

export function summarizeOwnerCommitmentLedger(commitments: OwnerCommitmentItem[]): OwnerCommitmentLedgerSummary {
  const active = commitments.filter(commitment => commitment.status !== 'Dismissed')
  return {
    total: commitments.length,
    open: active.filter(commitment => commitment.status === 'Open').length,
    inProgress: active.filter(commitment => commitment.status === 'In Progress').length,
    blocked: active.filter(commitment => commitment.status === 'Blocked').length,
    dueSoon: active.filter(commitment => commitment.status === 'Due Soon').length,
    overdue: active.filter(commitment => commitment.status === 'Overdue').length,
    completed: commitments.filter(commitment => commitment.status === 'Completed').length,
    dismissed: commitments.filter(commitment => commitment.status === 'Dismissed').length,
    critical: active.filter(commitment => commitment.priority === 'Critical').length,
    followUps: active.filter(commitment => commitment.source === 'Follow-Up').length,
  }
}

export function getOwnerCommitmentStatusTone(status: OwnerCommitmentStatus) {
  if (status === 'Overdue' || status === 'Blocked') return 'danger' as const
  if (status === 'Open' || status === 'Due Soon') return 'warn' as const
  if (status === 'In Progress') return 'info' as const
  if (status === 'Completed') return 'ok' as const
  return 'neutral' as const
}

export function getOwnerCommitmentSourceTone(source: OwnerCommitmentSource) {
  if (source === 'Escalation') return 'danger' as const
  if (source === 'Follow-Up') return 'warn' as const
  if (source === 'Closure') return 'ok' as const
  return 'info' as const
}

export function getOwnerCommitmentPriorityTone(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function formatCommitmentDue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function loadLocalOwnerCommitmentStates(): OwnerCommitmentLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOwnerCommitmentLocalState)
  } catch {
    return []
  }
}

export function saveLocalOwnerCommitmentStates(states: OwnerCommitmentLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 220)))
}

export function useLocalOwnerCommitmentStates() {
  const [states, setStates] = useState<OwnerCommitmentLocalState[]>(() => loadLocalOwnerCommitmentStates())

  useEffect(() => {
    saveLocalOwnerCommitmentStates(states)
  }, [states])

  return [states, setStates] as const
}

function createCommitment(
  decision: OwnerDecisionRecord,
  now: Date,
  localState: OwnerCommitmentLocalState | undefined,
): OwnerCommitmentItem {
  const source = sourceFromDecision(decision.status)
  const dueAt = localState?.dueAt ?? decision.localState?.followUpDueAt ?? decision.dueAt ?? now.toISOString()
  const selectedOption = decision.selectedOption
  return {
    id: createCommitmentId(decision),
    title: titleFromDecision(decision),
    description: descriptionFromDecision(decision),
    source,
    owner: localState?.owner ?? decision.owner,
    scope: decision.scope,
    priority: decision.priority,
    status: statusFromDecision(decision, localState, dueAt, now),
    sourceStatus: decision.status,
    targetPage: selectedOption?.targetPage ?? decision.targetPage,
    targetPermission: selectedOption?.targetPermission ?? decision.targetPermission,
    recommendedAction: recommendedActionFromDecision(decision),
    evidence: evidenceFromDecision(decision, localState),
    rollbackNotes: `${decision.rollbackNotes} Commitment tracking is local-only; resetting a commitment removes browser state without changing production data.`,
    dueAt,
    createdAt: decision.localState?.updatedAt ?? now.toISOString(),
    relatedDecisionId: decision.id,
    relatedRecordId: decision.relatedRecordId,
    selectedOptionLabel: selectedOption?.label,
    blockedReason: localState?.blockedReason,
    completedAt: localState?.completedAt,
    localState,
  }
}

function sourceFromDecision(status: OwnerDecisionStatus): OwnerCommitmentSource {
  if (status === 'Follow-Up Needed') return 'Follow-Up'
  if (status === 'Escalated') return 'Escalation'
  if (status === 'Closed') return 'Closure'
  return 'Owner Decision'
}

function titleFromDecision(decision: OwnerDecisionRecord) {
  if (decision.status === 'Follow-Up Needed') return `Follow up: ${decision.title}`
  if (decision.status === 'Escalated') return `Resolve escalation: ${decision.title}`
  if (decision.status === 'Option Selected') return `Carry selected path: ${decision.title}`
  if (decision.status === 'Deferred') return `Return deferred decision: ${decision.title}`
  if (decision.status === 'Closed') return `Closed decision: ${decision.title}`
  return `Decide path: ${decision.title}`
}

function descriptionFromDecision(decision: OwnerDecisionRecord) {
  if (decision.selectedOption) {
    return `${decision.selectedOption.label}: ${decision.selectedOption.description}`
  }
  if (decision.status === 'Follow-Up Needed') {
    return 'A follow-up is required before this decision can safely leave the owner review loop.'
  }
  if (decision.status === 'Escalated') {
    return 'The decision has been escalated locally and needs explicit owner closure before governed execution.'
  }
  return decision.context
}

function recommendedActionFromDecision(decision: OwnerDecisionRecord) {
  if (decision.status === 'Closed') return 'Verify audit evidence and keep the commitment available for history.'
  if (decision.status === 'Escalated') return 'Remove blocker, confirm the approval path, and record the next owner decision.'
  if (decision.status === 'Follow-Up Needed') return 'Complete the named follow-up before the next owner review.'
  if (decision.status === 'Option Selected') return 'Convert the selected option into the governed approval or action request path.'
  return decision.recommendation
}

function evidenceFromDecision(decision: OwnerDecisionRecord, localState: OwnerCommitmentLocalState | undefined) {
  return [
    `Decision status: ${decision.status}`,
    `Source: ${decision.sourceLabel}`,
    `Approval path: ${decision.approvalPath.join(' > ')}`,
    ...(decision.selectedOption ? [`Selected option: ${decision.selectedOption.label}`] : []),
    ...(localState?.note ? [`Local note: ${localState.note}`] : []),
    ...(localState?.blockedReason ? [`Blocker: ${localState.blockedReason}`] : []),
    ...decision.evidence,
  ]
}

function statusFromDecision(
  decision: OwnerDecisionRecord,
  localState: OwnerCommitmentLocalState | undefined,
  dueAt: string,
  now: Date,
): OwnerCommitmentStatus {
  if (localState?.status === 'Completed' || localState?.status === 'Dismissed') return localState.status
  if (decision.status === 'Closed') return 'Completed'
  if (localState?.status === 'Blocked') return 'Blocked'
  const dueMs = new Date(dueAt).getTime()
  if (!Number.isNaN(dueMs)) {
    if (dueMs < now.getTime()) return 'Overdue'
    if (dueMs - now.getTime() <= dueSoonWindowMs) return 'Due Soon'
  }
  if (localState?.status === 'In Progress') return 'In Progress'
  if (decision.status === 'Follow-Up Needed' || decision.status === 'Option Selected') return 'In Progress'
  if (decision.status === 'Escalated') return 'Blocked'
  return 'Open'
}

function createCommitmentId(decision: OwnerDecisionRecord) {
  return `owner-commitment-${decision.id}`
}

function sortOwnerCommitments(a: OwnerCommitmentItem, b: OwnerCommitmentItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || sourceWeight(a.source) - sourceWeight(b.source)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function statusWeight(status: OwnerCommitmentStatus) {
  if (status === 'Overdue') return 0
  if (status === 'Blocked') return 1
  if (status === 'Due Soon') return 2
  if (status === 'Open') return 3
  if (status === 'In Progress') return 4
  if (status === 'Completed') return 5
  return 6
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function sourceWeight(source: OwnerCommitmentSource) {
  if (source === 'Escalation') return 0
  if (source === 'Follow-Up') return 1
  if (source === 'Owner Decision') return 2
  return 3
}

function isOwnerCommitmentLocalState(value: unknown): value is OwnerCommitmentLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.commitmentId === 'string'
    && ['Open', 'In Progress', 'Blocked', 'Due Soon', 'Overdue', 'Completed', 'Dismissed'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
