import { useEffect, useState } from 'react'
import type { PermissionKey } from '../permissions/permissions'
import type {
  OperatingExceptionItem,
  OperatingExceptionSeverity,
  OperatingExceptionType,
} from './operatingExceptionsInbox'

export type ExceptionSlaPolicyStatus = 'Active' | 'Draft' | 'Paused' | 'Needs Review'
export type ExceptionSlaPolicySource = 'System Policy' | 'Local Override'
export type ExceptionSlaEnforcementMode = 'Monitor' | 'Manual Escalation' | 'Auto Escalation Candidate'
export type ExceptionSlaReviewCadence = 'Every Brief' | 'Daily' | 'Weekly'
export type ExceptionSlaPolicyHealth = 'Covered' | 'At Risk' | 'Breached' | 'Quiet' | 'Paused'
export type ExceptionSlaPolicyTargetPage =
  | 'operating-exceptions'
  | 'command-handoff-timeline'
  | 'owner-action-calendar'
  | 'approval-center'
  | 'action-requests'
  | 'audit'

export interface ExceptionSlaPolicyTemplate {
  id: string
  name: string
  description: string
  exceptionType: OperatingExceptionType
  minimumSeverity: OperatingExceptionSeverity
  status: ExceptionSlaPolicyStatus
  source: ExceptionSlaPolicySource
  ownerRole: string
  escalationRole: string
  responseMinutes: number
  resolutionMinutes: number
  reviewCadence: ExceptionSlaReviewCadence
  enforcementMode: ExceptionSlaEnforcementMode
  humanConfirmationRequired: boolean
  auditRequired: boolean
  targetPage: ExceptionSlaPolicyTargetPage
  targetPermission: PermissionKey
  escalationSteps: string[]
  evidenceFields: string[]
  rollbackNotes: string
  serverHandler: string
  updatedAt: string
}

export interface ExceptionSlaPolicyLocalState {
  policyId: string
  status: ExceptionSlaPolicyStatus
  ownerRole: string
  escalationRole: string
  responseMinutes: number
  resolutionMinutes: number
  reviewCadence: ExceptionSlaReviewCadence
  enforcementMode: ExceptionSlaEnforcementMode
  humanConfirmationRequired: boolean
  auditRequired: boolean
  note?: string
  updatedAt: string
}

export interface ExceptionSlaPolicyItem extends ExceptionSlaPolicyTemplate {
  matchingExceptions: OperatingExceptionItem[]
  activeExceptions: number
  breachedExceptions: number
  dueSoonExceptions: number
  oldestOpenMinutes: number
  health: ExceptionSlaPolicyHealth
  localState?: ExceptionSlaPolicyLocalState
}

export interface ExceptionSlaPolicySummary {
  total: number
  active: number
  needsReview: number
  paused: number
  localOverrides: number
  breachedPolicies: number
  atRiskPolicies: number
  coveredExceptions: number
  breachedExceptions: number
  averageResponseMinutes: number
}

export interface BuildExceptionSlaPoliciesInput {
  exceptions: OperatingExceptionItem[]
  localStates?: ExceptionSlaPolicyLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_exception_sla_policy_states_v1'

export const exceptionSlaPolicyBoundaryRule =
  'Exception SLA policies are internal operating contracts. Local edits preview ownership, escalation, review, and timing rules, but they do not change production alert delivery, approvals, customer state, billing, modules, permissions, or server-side escalation behavior.'

export const exceptionSlaPolicyTemplates: ExceptionSlaPolicyTemplate[] = [
  {
    id: 'exception-sla-critical-command',
    name: 'Critical Command Closure',
    description: 'Critical command lines need a named owner quickly and visible executive escalation if they remain open.',
    exceptionType: 'Critical Command',
    minimumSeverity: 'Critical',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Owner',
    escalationRole: 'Owner',
    responseMinutes: 30,
    resolutionMinutes: 360,
    reviewCadence: 'Every Brief',
    enforcementMode: 'Manual Escalation',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'operating-exceptions',
    targetPermission: 'dashboard.view',
    escalationSteps: [
      '0 minutes: identify accountable owner and next decision.',
      '30 minutes: escalate unresolved ownership gap to the owner review lane.',
      '360 minutes: require explicit closure note or executive review.',
    ],
    evidenceFields: ['Exception severity', 'Owner', 'Target workspace', 'Latest local state'],
    rollbackNotes: 'Reset the local policy override. Any production escalation must stay behind governed server handlers.',
    serverHandler: 'server.exception_sla.critical_command',
    updatedAt: '2026-06-12T14:10:00.000Z',
  },
  {
    id: 'exception-sla-blocked-handoff',
    name: 'Blocked Handoff Recovery',
    description: 'Blocked handoffs must surface fast because they usually mean a governed workstream cannot safely proceed.',
    exceptionType: 'Blocked Handoff',
    minimumSeverity: 'High',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Support Lead',
    escalationRole: 'Admin Ops',
    responseMinutes: 45,
    resolutionMinutes: 360,
    reviewCadence: 'Every Brief',
    enforcementMode: 'Manual Escalation',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'command-handoff-timeline',
    targetPermission: 'dashboard.view',
    escalationSteps: [
      '0 minutes: confirm blocker and owner.',
      '45 minutes: escalate to Admin Ops if blocker remains open.',
      '360 minutes: require handoff plan, rollback note, or executive review.',
    ],
    evidenceFields: ['Current stage', 'Completion', 'Linked request', 'Rollback note'],
    rollbackNotes: 'Restore the system policy and leave all source handoff records unchanged.',
    serverHandler: 'server.exception_sla.blocked_handoff',
    updatedAt: '2026-06-12T14:15:00.000Z',
  },
  {
    id: 'exception-sla-overdue-owner-action',
    name: 'Overdue Owner Action',
    description: 'Owner work that slips past its review window should be pulled back into the current operating cadence.',
    exceptionType: 'Overdue Owner Action',
    minimumSeverity: 'High',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Client Success',
    escalationRole: 'Support Lead',
    responseMinutes: 60,
    resolutionMinutes: 480,
    reviewCadence: 'Daily',
    enforcementMode: 'Monitor',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'owner-action-calendar',
    targetPermission: 'dashboard.view',
    escalationSteps: [
      '0 minutes: keep overdue action visible in today’s owner review.',
      '60 minutes: assign a human owner or escalate to support leadership.',
      '480 minutes: require next-business-day follow-up plan.',
    ],
    evidenceFields: ['Due time', 'Owner', 'Status', 'Operating calendar window'],
    rollbackNotes: 'Remove the local override and preserve the source calendar item exactly as generated.',
    serverHandler: 'server.exception_sla.overdue_owner_action',
    updatedAt: '2026-06-12T14:20:00.000Z',
  },
  {
    id: 'exception-sla-approval-gap',
    name: 'Approval Gap Closure',
    description: 'Approval gaps must name the next approver without bypassing governed action-request checks.',
    exceptionType: 'Approval Gap',
    minimumSeverity: 'High',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Admin Ops',
    escalationRole: 'Owner',
    responseMinutes: 90,
    resolutionMinutes: 720,
    reviewCadence: 'Every Brief',
    enforcementMode: 'Manual Escalation',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'approval-center',
    targetPermission: 'admin_actions.view',
    escalationSteps: [
      '0 minutes: verify required approvers and current readiness.',
      '90 minutes: escalate missing approval owner to Admin Ops.',
      '720 minutes: require explicit owner decision or block continuation.',
    ],
    evidenceFields: ['Action request', 'Readiness', 'Required approvers', 'Permission'],
    rollbackNotes: 'Reset the local SLA policy only. Do not approve or execute the source request from the policy builder.',
    serverHandler: 'server.exception_sla.approval_gap',
    updatedAt: '2026-06-12T14:25:00.000Z',
  },
  {
    id: 'exception-sla-audit-gap',
    name: 'Audit Evidence Gap',
    description: 'Near-closure work without audit evidence should stay visible until lineage is linked or closure is justified.',
    exceptionType: 'Audit Gap',
    minimumSeverity: 'Medium',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Engineering',
    escalationRole: 'Admin Ops',
    responseMinutes: 240,
    resolutionMinutes: 1440,
    reviewCadence: 'Daily',
    enforcementMode: 'Monitor',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'audit',
    targetPermission: 'audit.view',
    escalationSteps: [
      '0 minutes: confirm whether audit linkage exists elsewhere.',
      '240 minutes: assign evidence owner or document why linkage is unavailable.',
      '1440 minutes: escalate unresolved audit gap to Admin Ops.',
    ],
    evidenceFields: ['Audit event', 'Action request', 'Last event', 'Closure state'],
    rollbackNotes: 'Restore system timing and keep all audit records immutable.',
    serverHandler: 'server.exception_sla.audit_gap',
    updatedAt: '2026-06-12T14:30:00.000Z',
  },
  {
    id: 'exception-sla-governance-blocker',
    name: 'Governance Blocker',
    description: 'Hard blockers on governed action requests must remain blocked until policy requirements pass.',
    exceptionType: 'Governance Blocker',
    minimumSeverity: 'High',
    status: 'Active',
    source: 'System Policy',
    ownerRole: 'Admin Ops',
    escalationRole: 'Owner',
    responseMinutes: 30,
    resolutionMinutes: 240,
    reviewCadence: 'Every Brief',
    enforcementMode: 'Manual Escalation',
    humanConfirmationRequired: true,
    auditRequired: true,
    targetPage: 'action-requests',
    targetPermission: 'admin_actions.view',
    escalationSteps: [
      '0 minutes: keep production mutation blocked.',
      '30 minutes: confirm blockers and required remediation owner.',
      '240 minutes: escalate unresolved governance issue to owner review.',
    ],
    evidenceFields: ['Hard blockers', 'Risk', 'Permission', 'Rollback notes'],
    rollbackNotes: 'Reset the local policy. Never lower the source governance blocker from this browser surface.',
    serverHandler: 'server.exception_sla.governance_blocker',
    updatedAt: '2026-06-12T14:35:00.000Z',
  },
]

export function buildExceptionSlaPolicies(input: BuildExceptionSlaPoliciesInput): ExceptionSlaPolicyItem[] {
  const now = input.now ?? new Date()
  const localStateByPolicyId = new Map((input.localStates ?? []).map(state => [state.policyId, state]))

  return exceptionSlaPolicyTemplates
    .map(template => applyPolicyLocalState(template, localStateByPolicyId.get(template.id)))
    .map(policy => attachExceptionLoad(policy, input.exceptions, now))
    .sort(sortExceptionSlaPolicies)
}

export function summarizeExceptionSlaPolicies(policies: ExceptionSlaPolicyItem[]): ExceptionSlaPolicySummary {
  const activePolicies = policies.filter(policy => policy.status !== 'Paused')
  const averageResponseMinutes = policies.length
    ? Math.round(policies.reduce((sum, policy) => sum + policy.responseMinutes, 0) / policies.length)
    : 0

  return {
    total: policies.length,
    active: policies.filter(policy => policy.status === 'Active').length,
    needsReview: policies.filter(policy => policy.status === 'Needs Review').length,
    paused: policies.filter(policy => policy.status === 'Paused').length,
    localOverrides: policies.filter(policy => policy.source === 'Local Override').length,
    breachedPolicies: activePolicies.filter(policy => policy.health === 'Breached').length,
    atRiskPolicies: activePolicies.filter(policy => policy.health === 'At Risk').length,
    coveredExceptions: activePolicies.reduce((sum, policy) => sum + policy.activeExceptions, 0),
    breachedExceptions: activePolicies.reduce((sum, policy) => sum + policy.breachedExceptions, 0),
    averageResponseMinutes,
  }
}

export function getExceptionSlaPolicyStatusTone(status: ExceptionSlaPolicyStatus) {
  if (status === 'Active') return 'ok' as const
  if (status === 'Needs Review') return 'warn' as const
  if (status === 'Paused') return 'danger' as const
  return 'neutral' as const
}

export function getExceptionSlaPolicyHealthTone(health: ExceptionSlaPolicyHealth) {
  if (health === 'Covered') return 'ok' as const
  if (health === 'At Risk') return 'warn' as const
  if (health === 'Breached') return 'danger' as const
  if (health === 'Paused') return 'neutral' as const
  return 'info' as const
}

export function formatExceptionSlaMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours}h`
  return `${Math.round(hours * 10) / 10}h`
}

export function loadLocalExceptionSlaPolicyStates(): ExceptionSlaPolicyLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isExceptionSlaPolicyLocalState)
  } catch {
    return []
  }
}

export function saveLocalExceptionSlaPolicyStates(states: ExceptionSlaPolicyLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 120)))
}

export function useLocalExceptionSlaPolicyStates() {
  const [states, setStates] = useState<ExceptionSlaPolicyLocalState[]>(() => loadLocalExceptionSlaPolicyStates())

  useEffect(() => {
    saveLocalExceptionSlaPolicyStates(states)
  }, [states])

  return [states, setStates] as const
}

function applyPolicyLocalState(
  template: ExceptionSlaPolicyTemplate,
  localState: ExceptionSlaPolicyLocalState | undefined,
): ExceptionSlaPolicyTemplate & { localState?: ExceptionSlaPolicyLocalState } {
  if (!localState) return template
  return {
    ...template,
    source: 'Local Override',
    status: localState.status,
    ownerRole: localState.ownerRole,
    escalationRole: localState.escalationRole,
    responseMinutes: localState.responseMinutes,
    resolutionMinutes: localState.resolutionMinutes,
    reviewCadence: localState.reviewCadence,
    enforcementMode: localState.enforcementMode,
    humanConfirmationRequired: localState.humanConfirmationRequired,
    auditRequired: localState.auditRequired,
    updatedAt: localState.updatedAt,
    localState,
  }
}

function attachExceptionLoad(
  policy: ExceptionSlaPolicyTemplate & { localState?: ExceptionSlaPolicyLocalState },
  exceptions: OperatingExceptionItem[],
  now: Date,
): ExceptionSlaPolicyItem {
  const matchingExceptions = exceptions.filter(exception => exceptionMatchesPolicy(exception, policy))
  const activeExceptions = matchingExceptions.filter(exception => exception.status !== 'Resolved' && exception.status !== 'Dismissed')
  const oldestOpenMinutes = activeExceptions.reduce((oldest, exception) => Math.max(oldest, ageMinutes(exception.detectedAt, now)), 0)
  const breachedExceptions = activeExceptions.filter(exception => isExceptionBreached(exception, policy, now)).length
  const dueSoonExceptions = activeExceptions.filter(exception => isExceptionDueSoon(exception, policy, now)).length

  return {
    ...policy,
    matchingExceptions,
    activeExceptions: activeExceptions.length,
    breachedExceptions,
    dueSoonExceptions,
    oldestOpenMinutes,
    health: policyHealth(policy.status, activeExceptions.length, breachedExceptions, dueSoonExceptions),
  }
}

function exceptionMatchesPolicy(exception: OperatingExceptionItem, policy: ExceptionSlaPolicyTemplate) {
  return exception.type === policy.exceptionType
    && severityWeight(exception.severity) <= severityWeight(policy.minimumSeverity)
}

function isExceptionBreached(exception: OperatingExceptionItem, policy: ExceptionSlaPolicyTemplate, now: Date) {
  const age = ageMinutes(exception.detectedAt, now)
  if (exception.status === 'Open') return age >= policy.responseMinutes
  return age >= policy.resolutionMinutes
}

function isExceptionDueSoon(exception: OperatingExceptionItem, policy: ExceptionSlaPolicyTemplate, now: Date) {
  if (isExceptionBreached(exception, policy, now)) return false
  const age = ageMinutes(exception.detectedAt, now)
  const windowMinutes = exception.status === 'Open' ? policy.responseMinutes : policy.resolutionMinutes
  return age >= Math.round(windowMinutes * 0.75)
}

function policyHealth(
  status: ExceptionSlaPolicyStatus,
  activeExceptions: number,
  breachedExceptions: number,
  dueSoonExceptions: number,
): ExceptionSlaPolicyHealth {
  if (status === 'Paused') return 'Paused'
  if (!activeExceptions) return 'Quiet'
  if (breachedExceptions) return 'Breached'
  if (dueSoonExceptions) return 'At Risk'
  return 'Covered'
}

function sortExceptionSlaPolicies(a: ExceptionSlaPolicyItem, b: ExceptionSlaPolicyItem) {
  return healthWeight(a.health) - healthWeight(b.health)
    || statusWeight(a.status) - statusWeight(b.status)
    || severityWeight(a.minimumSeverity) - severityWeight(b.minimumSeverity)
    || a.exceptionType.localeCompare(b.exceptionType)
}

function ageMinutes(value: string, now: Date) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 0
  return Math.max(0, Math.round((now.getTime() - time) / 60000))
}

function severityWeight(severity: OperatingExceptionSeverity) {
  if (severity === 'Critical') return 0
  if (severity === 'High') return 1
  if (severity === 'Medium') return 2
  return 3
}

function healthWeight(health: ExceptionSlaPolicyHealth) {
  if (health === 'Breached') return 0
  if (health === 'At Risk') return 1
  if (health === 'Covered') return 2
  if (health === 'Quiet') return 3
  return 4
}

function statusWeight(status: ExceptionSlaPolicyStatus) {
  if (status === 'Needs Review') return 0
  if (status === 'Active') return 1
  if (status === 'Draft') return 2
  return 3
}

function isExceptionSlaPolicyLocalState(value: unknown): value is ExceptionSlaPolicyLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.policyId === 'string'
    && ['Active', 'Draft', 'Paused', 'Needs Review'].includes(String(record.status))
    && typeof record.ownerRole === 'string'
    && typeof record.escalationRole === 'string'
    && typeof record.responseMinutes === 'number'
    && typeof record.resolutionMinutes === 'number'
    && ['Every Brief', 'Daily', 'Weekly'].includes(String(record.reviewCadence))
    && ['Monitor', 'Manual Escalation', 'Auto Escalation Candidate'].includes(String(record.enforcementMode))
    && typeof record.humanConfirmationRequired === 'boolean'
    && typeof record.auditRequired === 'boolean'
    && typeof record.updatedAt === 'string'
}
