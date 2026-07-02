import { useEffect, useState } from 'react'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { ActionRequestGovernanceRecord } from '../admin-actions/actionRequestGovernance'
import type { AuditEvent } from '../audit/auditLog'
import type { CommandWorkItem, CommandWorkPriority } from './commandWorkQueue'

export type DecisionBriefStatus = 'Draft' | 'Saved' | 'Reviewed' | 'Follow-Up Queued' | 'Archived'
export type DecisionBriefReadiness = 'Ready' | 'Needs Approval' | 'Needs Evidence' | 'Blocked'

export interface DecisionBriefLocalState {
  briefId: string
  status: DecisionBriefStatus
  note?: string
  reviewedAt?: string
  followUpRequestId?: string
  updatedAt: string
}

export interface DecisionBriefSection {
  heading: string
  body: string
  items: string[]
}

export interface DecisionBriefRecord {
  id: string
  workItemId: string
  title: string
  status: DecisionBriefStatus
  readiness: DecisionBriefReadiness
  priority: CommandWorkPriority
  owner: string
  scope: string
  decision: CommandWorkItem['decision']
  source: CommandWorkItem['source']
  targetLabel: string
  executiveSummary: string
  recommendedAction: string
  approvalPath: string[]
  rollbackPlan: string
  evidence: string[]
  auditTrail: string[]
  riskNotes: string[]
  generatedAt: string
  dueAt: string
  workItem: CommandWorkItem
  actionRequest?: AdminActionRequest
  governance?: ActionRequestGovernanceRecord
  localState?: DecisionBriefLocalState
  sections: DecisionBriefSection[]
}

export interface BuildDecisionBriefsInput {
  workItems: CommandWorkItem[]
  actionRequests: AdminActionRequest[]
  governanceRecords: ActionRequestGovernanceRecord[]
  auditEvents: AuditEvent[]
  localStates?: DecisionBriefLocalState[]
  now?: Date
}

export interface DecisionBriefSummary {
  total: number
  ready: number
  needsApproval: number
  needsEvidence: number
  blocked: number
  saved: number
  reviewed: number
  followUps: number
  highPriority: number
}

const localStorageKey = 'hc_platform_decision_brief_state_v1'

export const decisionBriefBoundaryRule =
  'Decision Brief Builder creates internal owner-ready recommendations from existing Platform Admin evidence. Briefs do not approve, execute, mutate, message customers, change billing, alter modules, or modify permissions without governed Admin Action Requests and server-side handlers.'

export function buildDecisionBriefs(input: BuildDecisionBriefsInput): DecisionBriefRecord[] {
  const now = input.now ?? new Date()
  const localStateByBriefId = new Map((input.localStates ?? []).map(state => [state.briefId, state]))
  const requestById = new Map(input.actionRequests.map(request => [request.id, request]))
  const governanceByRequestId = new Map(input.governanceRecords.map(record => [record.requestId, record]))

  return input.workItems.map(workItem => {
    const actionRequest = workItem.actionRequestId ? requestById.get(workItem.actionRequestId) : undefined
    const governance = workItem.actionRequestId ? governanceByRequestId.get(workItem.actionRequestId) : undefined
    const brief = createDecisionBrief(workItem, actionRequest, governance, input.auditEvents, now)
    const localState = localStateByBriefId.get(brief.id)
    return localState ? { ...brief, status: localState.status, localState } : brief
  }).sort(sortDecisionBriefs)
}

export function summarizeDecisionBriefs(briefs: DecisionBriefRecord[]): DecisionBriefSummary {
  const active = briefs.filter(brief => brief.status !== 'Archived')
  return {
    total: briefs.length,
    ready: active.filter(brief => brief.readiness === 'Ready').length,
    needsApproval: active.filter(brief => brief.readiness === 'Needs Approval').length,
    needsEvidence: active.filter(brief => brief.readiness === 'Needs Evidence').length,
    blocked: active.filter(brief => brief.readiness === 'Blocked').length,
    saved: briefs.filter(brief => brief.status === 'Saved').length,
    reviewed: briefs.filter(brief => brief.status === 'Reviewed').length,
    followUps: briefs.filter(brief => brief.status === 'Follow-Up Queued').length,
    highPriority: active.filter(brief => brief.priority === 'Critical' || brief.priority === 'High').length,
  }
}

export function getDecisionBriefStatusTone(status: DecisionBriefStatus) {
  if (status === 'Draft') return 'warn' as const
  if (status === 'Saved' || status === 'Follow-Up Queued') return 'info' as const
  if (status === 'Reviewed') return 'ok' as const
  return 'neutral' as const
}

export function getDecisionBriefReadinessTone(readiness: DecisionBriefReadiness) {
  if (readiness === 'Blocked') return 'danger' as const
  if (readiness === 'Needs Approval' || readiness === 'Needs Evidence') return 'warn' as const
  return 'ok' as const
}

export function loadLocalDecisionBriefStates(): DecisionBriefLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDecisionBriefLocalState)
  } catch {
    return []
  }
}

export function saveLocalDecisionBriefStates(states: DecisionBriefLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 180)))
}

export function useLocalDecisionBriefStates() {
  const [states, setStates] = useState<DecisionBriefLocalState[]>(() => loadLocalDecisionBriefStates())

  useEffect(() => {
    saveLocalDecisionBriefStates(states)
  }, [states])

  return [states, setStates] as const
}

function createDecisionBrief(
  workItem: CommandWorkItem,
  actionRequest: AdminActionRequest | undefined,
  governance: ActionRequestGovernanceRecord | undefined,
  auditEvents: AuditEvent[],
  now: Date,
): DecisionBriefRecord {
  const readiness = getReadiness(workItem, actionRequest, governance)
  const approvalPath = getApprovalPath(workItem, actionRequest, governance)
  const auditTrail = getAuditTrail(workItem, actionRequest, auditEvents)
  const riskNotes = getRiskNotes(workItem, actionRequest, governance)
  const recommendedAction = getRecommendedAction(workItem, readiness)
  const executiveSummary = `${workItem.decision} ${workItem.lane.toLowerCase()} item from ${workItem.source}: ${workItem.description}`
  const sections: DecisionBriefSection[] = [
    {
      heading: 'Decision',
      body: recommendedAction,
      items: [
        `Decision type: ${workItem.decision}`,
        `Owner: ${workItem.owner}`,
        `Target: ${workItem.targetLabel}`,
      ],
    },
    {
      heading: 'Evidence',
      body: 'Evidence is derived from existing Platform Admin queues and read models.',
      items: workItem.evidence,
    },
    {
      heading: 'Approval Path',
      body: actionRequest ? 'A governed action request is already linked.' : 'No linked action request exists yet.',
      items: approvalPath,
    },
    {
      heading: 'Rollback',
      body: workItem.rollbackNotes,
      items: [
        actionRequest?.rollbackNotes ?? workItem.rollbackNotes,
        actionRequest ? `Handler: ${actionRequest.serverHandler.key}` : `Suggested handler: ${workItem.handlerKey ?? 'server handler placeholder required'}`,
      ],
    },
  ]

  return {
    id: `decision-brief-${workItem.id}`,
    workItemId: workItem.id,
    title: workItem.title,
    status: 'Draft',
    readiness,
    priority: workItem.priority,
    owner: workItem.owner,
    scope: workItem.scope,
    decision: workItem.decision,
    source: workItem.source,
    targetLabel: workItem.targetLabel,
    executiveSummary,
    recommendedAction,
    approvalPath,
    rollbackPlan: actionRequest?.rollbackNotes ?? workItem.rollbackNotes,
    evidence: workItem.evidence,
    auditTrail,
    riskNotes,
    generatedAt: now.toISOString(),
    dueAt: workItem.dueAt,
    workItem,
    actionRequest,
    governance,
    sections,
  }
}

function getReadiness(
  workItem: CommandWorkItem,
  actionRequest: AdminActionRequest | undefined,
  governance: ActionRequestGovernanceRecord | undefined,
): DecisionBriefReadiness {
  if (governance?.hardBlockers.length || actionRequest?.status === 'Blocked' || actionRequest?.status === 'Failed') return 'Blocked'
  if (workItem.evidence.length < 2) return 'Needs Evidence'
  if (!actionRequest || actionRequest.status === 'Draft' || actionRequest.status === 'Queued') return 'Needs Approval'
  return 'Ready'
}

function getApprovalPath(
  workItem: CommandWorkItem,
  actionRequest: AdminActionRequest | undefined,
  governance: ActionRequestGovernanceRecord | undefined,
) {
  if (governance) {
    return [
      `Risk level: ${governance.riskLevel}`,
      `Required approvers: ${governance.requiredApprovers.join(', ')}`,
      `Readiness: ${governance.readiness}`,
      governance.humanConfirmationRequired ? 'Human confirmation required.' : 'Human confirmation optional for this policy.',
    ]
  }

  return [
    `Queue follow-up action type: ${workItem.followUpActionType}`,
    `Required permission: ${workItem.followUpPermission}`,
    actionRequest ? `Current request status: ${actionRequest.status}` : 'Create a governed Admin Action Request before production execution.',
  ]
}

function getAuditTrail(
  workItem: CommandWorkItem,
  actionRequest: AdminActionRequest | undefined,
  auditEvents: AuditEvent[],
) {
  const matches = auditEvents.filter(event => {
    if (actionRequest && event.id === actionRequest.auditEventId) return true
    if (actionRequest && event.metadata?.actionRequestId === actionRequest.id) return true
    if (event.metadata?.commandWorkItemId === workItem.id) return true
    if (event.metadata?.relatedRecordId === workItem.relatedRecordId) return true
    if (event.scope === workItem.scope && event.actionLabel.includes(workItem.title)) return true
    return false
  })

  if (!matches.length) {
    return [
      'No matching audit event has been recorded for this brief yet.',
      'Saving or reviewing this brief will create a local audit event.',
    ]
  }

  return matches.slice(0, 5).map(event => `${formatDateTime(event.createdAt)} / ${event.actorRole}: ${event.actionLabel}`)
}

function getRiskNotes(
  workItem: CommandWorkItem,
  actionRequest: AdminActionRequest | undefined,
  governance: ActionRequestGovernanceRecord | undefined,
) {
  return [
    workItem.priority === 'Critical' ? 'Critical priority requires same-day owner visibility.' : `${workItem.priority} priority item.`,
    workItem.minutesLate > 0 ? `${formatMinutes(workItem.minutesLate)} overdue.` : 'Inside the active decision window.',
    governance?.hardBlockers[0] ?? `${governance?.warningCount ?? 0} governance warnings.`,
    actionRequest ? `Linked action request status: ${actionRequest.status}.` : 'No linked action request exists.',
  ]
}

function getRecommendedAction(workItem: CommandWorkItem, readiness: DecisionBriefReadiness) {
  if (readiness === 'Blocked') return `Escalate before execution. Resolve blockers, then revisit ${workItem.targetLabel}.`
  if (readiness === 'Needs Approval') return `Queue or approve the governed follow-up before any production-impacting action.`
  if (readiness === 'Needs Evidence') return `Collect more evidence from ${workItem.targetLabel} before making the owner decision.`
  if (workItem.decision === 'Approve') return 'Proceed to approval review, then hand off to server-side execution controls.'
  if (workItem.decision === 'Assign') return 'Assign accountable coverage or owner follow-up, then verify the audit trail.'
  if (workItem.decision === 'Escalate') return 'Escalate to owner review and keep all execution behind Admin Action Requests.'
  return `Review in ${workItem.targetLabel} and record the decision outcome.`
}

function sortDecisionBriefs(a: DecisionBriefRecord, b: DecisionBriefRecord) {
  return readinessWeight(a.readiness) - readinessWeight(b.readiness)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function readinessWeight(readiness: DecisionBriefReadiness) {
  if (readiness === 'Blocked') return 0
  if (readiness === 'Needs Approval') return 1
  if (readiness === 'Needs Evidence') return 2
  return 3
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.round(minutes / 60)}h`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function isDecisionBriefLocalState(value: unknown): value is DecisionBriefLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.briefId === 'string'
    && ['Draft', 'Saved', 'Reviewed', 'Follow-Up Queued', 'Archived'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
