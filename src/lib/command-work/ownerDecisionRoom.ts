import { useEffect, useState } from 'react'
import type { PermissionKey } from '../permissions/permissions'
import type {
  ExecutiveMorningReviewItem,
  ExecutiveMorningReviewLane,
  ExecutiveMorningReviewRecord,
  ExecutiveMorningReviewTargetPage,
} from './executiveMorningReview'
import type { CommandWorkPriority } from './commandWorkQueue'

export type OwnerDecisionStatus = 'Open' | 'Option Selected' | 'Follow-Up Needed' | 'Deferred' | 'Escalated' | 'Closed'
export type OwnerDecisionOptionKind = 'Recommended' | 'Conservative' | 'Escalate' | 'Defer' | 'Follow-Up'
export type OwnerDecisionTargetPage = ExecutiveMorningReviewTargetPage | 'owner-decision-room' | 'owner-commitment-ledger'

export interface OwnerDecisionOption {
  id: string
  kind: OwnerDecisionOptionKind
  label: string
  description: string
  impact: string
  risk: 'Low' | 'Medium' | 'High'
  requiresApproval: boolean
  targetPage: OwnerDecisionTargetPage
  targetPermission: PermissionKey
}

export interface OwnerDecisionLocalState {
  decisionId: string
  status: OwnerDecisionStatus
  selectedOptionId?: string
  note?: string
  decidedBy?: string
  decidedAt?: string
  followUpDueAt?: string
  updatedAt: string
}

export interface OwnerDecisionRecord {
  id: string
  reviewId: string
  title: string
  context: string
  owner: string
  scope: string
  lane: ExecutiveMorningReviewLane
  priority: CommandWorkPriority
  status: OwnerDecisionStatus
  sourceLabel: string
  targetPage: OwnerDecisionTargetPage
  targetPermission: PermissionKey
  recommendation: string
  approvalPath: string[]
  options: OwnerDecisionOption[]
  selectedOption?: OwnerDecisionOption
  evidence: string[]
  rollbackNotes: string
  dueAt: string
  relatedRecordId: string
  reviewItem: ExecutiveMorningReviewItem
  localState?: OwnerDecisionLocalState
}

export interface OwnerDecisionRoomSummary {
  total: number
  open: number
  selected: number
  followUps: number
  deferred: number
  escalated: number
  closed: number
  critical: number
  approvalsRequired: number
}

export interface BuildOwnerDecisionRoomInput {
  morningReview: ExecutiveMorningReviewRecord
  localStates?: OwnerDecisionLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_owner_decision_room_state_v1'

export const ownerDecisionRoomBoundaryRule =
  'Owner Decision Room records local owner decision intent only. It does not approve, execute, mutate, message customers, change billing, alter modules, change permissions, resolve support records, or bypass governed Admin Action Requests.'

export function buildOwnerDecisionRoom(input: BuildOwnerDecisionRoomInput): OwnerDecisionRecord[] {
  const now = input.now ?? new Date()
  const localStateByDecisionId = new Map((input.localStates ?? []).map(state => [state.decisionId, state]))
  return input.morningReview.reviewItems
    .filter(item => item.priority === 'Critical' || item.priority === 'High' || item.lane === 'Decisions' || item.lane === 'Exceptions' || item.lane === 'SLA')
    .map(item => createDecision(item, input.morningReview.id, now, localStateByDecisionId.get(createDecisionId(item))))
    .sort(sortOwnerDecisions)
}

export function summarizeOwnerDecisionRoom(decisions: OwnerDecisionRecord[]): OwnerDecisionRoomSummary {
  const active = decisions.filter(decision => decision.status !== 'Closed')
  return {
    total: decisions.length,
    open: active.filter(decision => decision.status === 'Open').length,
    selected: active.filter(decision => decision.status === 'Option Selected').length,
    followUps: active.filter(decision => decision.status === 'Follow-Up Needed').length,
    deferred: active.filter(decision => decision.status === 'Deferred').length,
    escalated: active.filter(decision => decision.status === 'Escalated').length,
    closed: decisions.filter(decision => decision.status === 'Closed').length,
    critical: active.filter(decision => decision.priority === 'Critical').length,
    approvalsRequired: active.filter(decision => decision.options.some(option => option.requiresApproval)).length,
  }
}

export function getOwnerDecisionStatusTone(status: OwnerDecisionStatus) {
  if (status === 'Open') return 'warn' as const
  if (status === 'Escalated') return 'danger' as const
  if (status === 'Option Selected' || status === 'Follow-Up Needed') return 'info' as const
  if (status === 'Closed') return 'ok' as const
  return 'neutral' as const
}

export function getOwnerDecisionOptionTone(kind: OwnerDecisionOptionKind) {
  if (kind === 'Escalate') return 'danger' as const
  if (kind === 'Recommended' || kind === 'Follow-Up') return 'warn' as const
  if (kind === 'Conservative') return 'info' as const
  return 'neutral' as const
}

export function getOwnerDecisionPriorityTone(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function loadLocalOwnerDecisionStates(): OwnerDecisionLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOwnerDecisionLocalState)
  } catch {
    return []
  }
}

export function saveLocalOwnerDecisionStates(states: OwnerDecisionLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 180)))
}

export function useLocalOwnerDecisionStates() {
  const [states, setStates] = useState<OwnerDecisionLocalState[]>(() => loadLocalOwnerDecisionStates())

  useEffect(() => {
    saveLocalOwnerDecisionStates(states)
  }, [states])

  return [states, setStates] as const
}

function createDecision(
  item: ExecutiveMorningReviewItem,
  reviewId: string,
  now: Date,
  localState: OwnerDecisionLocalState | undefined,
): OwnerDecisionRecord {
  const options = createDecisionOptions(item)
  const selectedOption = localState?.selectedOptionId
    ? options.find(option => option.id === localState.selectedOptionId)
    : undefined
  return {
    id: createDecisionId(item),
    reviewId,
    title: item.title,
    context: item.detail,
    owner: localState?.decidedBy ?? item.owner,
    scope: item.scope,
    lane: item.lane,
    priority: item.priority,
    status: localState?.status ?? 'Open',
    sourceLabel: item.sourceLabel,
    targetPage: item.targetPage,
    targetPermission: item.targetPermission,
    recommendation: item.recommendedAction,
    approvalPath: createApprovalPath(item),
    options,
    selectedOption,
    evidence: item.evidence,
    rollbackNotes: item.rollbackNotes,
    dueAt: localState?.followUpDueAt ?? item.dueAt ?? now.toISOString(),
    relatedRecordId: item.relatedRecordId,
    reviewItem: item,
    localState,
  }
}

function createDecisionOptions(item: ExecutiveMorningReviewItem): OwnerDecisionOption[] {
  const approvalRequired = item.lane === 'Decisions' || item.lane === 'SLA' || item.targetPermission === 'admin_actions.view'
  return [
    {
      id: `${item.id}-recommended`,
      kind: 'Recommended',
      label: 'Accept recommendation',
      description: item.recommendedAction,
      impact: `Moves ${item.scope} toward closure using ${item.sourceLabel} evidence.`,
      risk: item.priority === 'Critical' ? 'High' : 'Medium',
      requiresApproval: approvalRequired,
      targetPage: item.targetPage,
      targetPermission: item.targetPermission,
    },
    {
      id: `${item.id}-follow-up`,
      kind: 'Follow-Up',
      label: 'Create follow-up path',
      description: 'Keep the decision open and require a named follow-up before the next operating review.',
      impact: 'Preserves visibility while avoiding a browser-side production action.',
      risk: 'Medium',
      requiresApproval: true,
      targetPage: item.targetPage,
      targetPermission: item.targetPermission,
    },
    {
      id: `${item.id}-escalate`,
      kind: 'Escalate',
      label: 'Escalate to owner review',
      description: 'Escalate the item for explicit owner attention before execution or customer-facing action.',
      impact: 'Raises operating urgency and keeps the source record unchanged.',
      risk: item.priority === 'Critical' ? 'High' : 'Medium',
      requiresApproval: true,
      targetPage: 'executive-morning-review',
      targetPermission: 'dashboard.view',
    },
    {
      id: `${item.id}-defer`,
      kind: 'Defer',
      label: 'Defer with note',
      description: 'Defer the decision to the next review window with local rationale.',
      impact: 'Reduces immediate pressure but keeps the item visible in local decision state.',
      risk: item.priority === 'Critical' ? 'High' : 'Low',
      requiresApproval: false,
      targetPage: 'owner-decision-room',
      targetPermission: 'dashboard.view',
    },
  ]
}

function createApprovalPath(item: ExecutiveMorningReviewItem) {
  const path = ['Owner decision recorded locally']
  if (item.targetPermission === 'admin_actions.view') path.push('Admin Action Request approval required')
  if (item.priority === 'Critical') path.push('Critical item requires explicit human confirmation')
  path.push('Server-side handler required before production mutation')
  path.push('Immutable audit log required')
  return path
}

function createDecisionId(item: ExecutiveMorningReviewItem) {
  return `owner-decision-${item.id}`
}

function sortOwnerDecisions(a: OwnerDecisionRecord, b: OwnerDecisionRecord) {
  return statusWeight(a.status) - statusWeight(b.status)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || laneWeight(a.lane) - laneWeight(b.lane)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function statusWeight(status: OwnerDecisionStatus) {
  if (status === 'Open') return 0
  if (status === 'Escalated') return 1
  if (status === 'Follow-Up Needed') return 2
  if (status === 'Option Selected') return 3
  if (status === 'Deferred') return 4
  return 5
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function laneWeight(lane: ExecutiveMorningReviewLane) {
  if (lane === 'Decisions') return 0
  if (lane === 'Exceptions') return 1
  if (lane === 'SLA') return 2
  if (lane === 'Handoffs') return 3
  if (lane === 'Revenue') return 4
  if (lane === 'Support') return 5
  return 6
}

function isOwnerDecisionLocalState(value: unknown): value is OwnerDecisionLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.decisionId === 'string'
    && ['Open', 'Option Selected', 'Follow-Up Needed', 'Deferred', 'Escalated', 'Closed'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
