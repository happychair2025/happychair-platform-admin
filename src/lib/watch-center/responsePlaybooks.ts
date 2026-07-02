import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type { WatchSignalOwner, WatchSignalSensitivity, WatchTargetPage } from './watchCenter'
import type { WatchRuleDefinition, WatchRuleStatus } from './watchRules'

export type ResponsePlaybookCategory = 'Support' | 'Finance' | 'Engineering' | 'Security' | 'Client Success' | 'Admin Ops'
export type ResponsePlaybookStatus = WatchRuleStatus
export type ResponsePlaybookSource = 'System Playbook' | 'Local Override'
export type ResponsePlaybookStageType = 'Triage' | 'Customer Review' | 'Server Handoff' | 'Executive Review' | 'Closeout'

export interface ResponsePlaybookStep {
  id: string
  stage: ResponsePlaybookStageType
  owner: WatchSignalOwner
  action: string
  evidenceRequired: string[]
  auditExpectation: string
  customerVisible: boolean
}

export interface ResponsePlaybookHandoff {
  required: boolean
  actionType?: AdminActionRequestType
  permission?: PermissionKey
  handlerKey: string
  rollbackNotes: string
  humanConfirmationRequired: boolean
}

export interface ResponsePlaybookDefinition {
  id: string
  title: string
  description: string
  category: ResponsePlaybookCategory
  source: ResponsePlaybookSource
  owner: WatchSignalOwner
  status: ResponsePlaybookStatus
  sensitivity: WatchSignalSensitivity
  permission: PermissionKey
  targetPage: WatchTargetPage
  mappedRuleIds: string[]
  triggerSummary: string
  responseGoal: string
  steps: ResponsePlaybookStep[]
  handoff: ResponsePlaybookHandoff
  blockedActions: string[]
  successCriteria: string[]
  auditKeys: string[]
  updatedAt: string
}

export interface ResponsePlaybookLocalState {
  playbookId: string
  status: ResponsePlaybookStatus
  note?: string
  updatedAt: string
}

export interface ResponsePlaybookSummary {
  total: number
  active: number
  needsReview: number
  restricted: number
  handoffRequired: number
  customerVisible: number
  averageSteps: number
  localOverrides: number
}

const localStorageKey = 'hc_platform_response_playbook_states_v1'

export const responsePlaybookBoundaryRule =
  'Response playbooks are operating guidance and local handoff contracts. They do not silently mutate customer state, billing, modules, permissions, support records, or production alert policy.'

export const responsePlaybookTemplates: ResponsePlaybookDefinition[] = [
  {
    id: 'playbook_support_critical_issue',
    title: 'Critical Support Response',
    description: 'Coordinate owner assignment, venue diagnostics, customer-safe follow-up, and server handoff for critical support signals.',
    category: 'Support',
    source: 'System Playbook',
    owner: 'Support',
    status: 'Active',
    sensitivity: 'Standard',
    permission: 'support.view',
    targetPage: 'support',
    mappedRuleIds: ['rule_support_critical_open'],
    triggerSummary: 'Critical support issue is open, investigating, or escalated.',
    responseGoal: 'Get a named owner and customer-safe next action within the support SLA.',
    steps: [
      {
        id: 'support-triage',
        stage: 'Triage',
        owner: 'Support',
        action: 'Confirm issue scope, related signal, affected users, and current status.',
        evidenceRequired: ['Support issue', 'Related signal', 'Affected users'],
        auditExpectation: 'Record issue review and owner assignment.',
        customerVisible: false,
      },
      {
        id: 'support-customer-review',
        stage: 'Customer Review',
        owner: 'Client Success',
        action: 'Prepare customer-safe update if the issue affects venue operations.',
        evidenceRequired: ['Venue name', 'Probable cause', 'Recommended action'],
        auditExpectation: 'Record customer-facing follow-up decision.',
        customerVisible: true,
      },
      {
        id: 'support-server-handoff',
        stage: 'Server Handoff',
        owner: 'Support',
        action: 'Queue a scoped support troubleshooting action if lifecycle or remediation writes are needed.',
        evidenceRequired: ['Scope', 'Rollback notes', 'Permission check'],
        auditExpectation: 'Queue action request before any production write.',
        customerVisible: false,
      },
    ],
    handoff: {
      required: true,
      actionType: 'support_troubleshooting_action',
      permission: 'support.manage',
      handlerKey: 'server.support.troubleshooting_lifecycle',
      rollbackNotes: 'Leave the support issue unchanged and append a failed activity note if server lifecycle write fails.',
      humanConfirmationRequired: true,
    },
    blockedActions: ['Silently mark support issues resolved', 'Change customer settings without confirmation', 'Bypass scoped server handler'],
    successCriteria: ['Owner assigned', 'Next action recorded', 'Customer impact reviewed', 'Server handoff queued when needed'],
    auditKeys: ['response_playbook.support_critical.reviewed.mock', 'admin_action_request.support_troubleshooting_action.queued.mock'],
    updatedAt: '2026-06-09T14:05:00.000Z',
  },
  {
    id: 'playbook_failed_payment_recovery',
    title: 'Failed Payment Recovery',
    description: 'Coordinate finance review, customer success context, and executive escalation for revenue leakage.',
    category: 'Finance',
    source: 'System Playbook',
    owner: 'Finance',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'billing.view',
    targetPage: 'revenue',
    mappedRuleIds: ['rule_billing_failed_payment'],
    triggerSummary: 'Failed payment or meaningful amount at risk enters the watch queue.',
    responseGoal: 'Protect revenue while keeping customer outreach coordinated and non-surprising.',
    steps: [
      {
        id: 'billing-triage',
        stage: 'Triage',
        owner: 'Finance',
        action: 'Review billing state, amount at risk, MRR, and owner.',
        evidenceRequired: ['Billing status', 'Amount at risk', 'MRR'],
        auditExpectation: 'Record finance review before escalation.',
        customerVisible: false,
      },
      {
        id: 'billing-customer-context',
        stage: 'Customer Review',
        owner: 'Client Success',
        action: 'Confirm account context before customer outreach or access changes.',
        evidenceRequired: ['Plan', 'Health status', 'Recent support context'],
        auditExpectation: 'Record outreach decision and owner.',
        customerVisible: true,
      },
      {
        id: 'billing-handoff',
        stage: 'Server Handoff',
        owner: 'Finance',
        action: 'Queue billing review action for provider-side checks or recovery workflow.',
        evidenceRequired: ['Provider state', 'Rollback notes', 'Finance owner'],
        auditExpectation: 'Queue billing action request for any provider mutation.',
        customerVisible: false,
      },
    ],
    handoff: {
      required: true,
      actionType: 'billing_review_action',
      permission: 'billing.manage',
      handlerKey: 'server.billing.review_action',
      rollbackNotes: 'Do not change customer access, discounts, credits, refunds, or provider records if finance review fails.',
      humanConfirmationRequired: true,
    },
    blockedActions: ['Issue refunds from browser', 'Grant discounts without finance approval', 'Change account access silently'],
    successCriteria: ['Finance owner confirmed', 'Customer context reviewed', 'Recovery path selected', 'Provider mutation queued only through server handler'],
    auditKeys: ['response_playbook.failed_payment.reviewed.mock', 'admin_action_request.billing_review_action.queued.mock'],
    updatedAt: '2026-06-09T14:10:00.000Z',
  },
  {
    id: 'playbook_platform_health_failure',
    title: 'Platform Health Failure',
    description: 'Route failing platform health checks into impact assessment, remediation handoff, and executive visibility.',
    category: 'Engineering',
    source: 'System Playbook',
    owner: 'Engineering',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'health.view',
    targetPage: 'health',
    mappedRuleIds: ['rule_health_failing_service_queue'],
    triggerSummary: 'Failing or critical platform health signal is detected.',
    responseGoal: 'Confirm customer impact and queue remediation only through approved server paths.',
    steps: [
      {
        id: 'health-impact',
        stage: 'Triage',
        owner: 'Support',
        action: 'Confirm affected clients, affected venues, probable cause, and support impact.',
        evidenceRequired: ['Affected clients', 'Affected venues', 'Probable cause'],
        auditExpectation: 'Record impact assessment before remediation.',
        customerVisible: false,
      },
      {
        id: 'health-remediation',
        stage: 'Server Handoff',
        owner: 'Engineering',
        action: 'Queue remediation server action if queue repair, sync repair, or feature mitigation is needed.',
        evidenceRequired: ['Health signal', 'Scope', 'Rollback plan'],
        auditExpectation: 'Queue remediation action request before production repair.',
        customerVisible: false,
      },
      {
        id: 'health-executive',
        stage: 'Executive Review',
        owner: 'Owner',
        action: 'Review unresolved customer-impacting platform risk after SLA breach.',
        evidenceRequired: ['SLA age', 'Open actions', 'Customer impact'],
        auditExpectation: 'Record executive review decision.',
        customerVisible: false,
      },
    ],
    handoff: {
      required: true,
      actionType: 'remediation_server_action',
      permission: 'troubleshooting.run',
      handlerKey: 'server.support.remediation_action',
      rollbackNotes: 'Do not run remediation if impact scope, rollback notes, and audit path are incomplete.',
      humanConfirmationRequired: true,
    },
    blockedActions: ['Run platform repair from browser', 'Disable features globally without owner review', 'Patch data to hide shared failure'],
    successCriteria: ['Impact assessed', 'Engineering owner confirmed', 'Remediation request queued if needed', 'Executive review triggered on breach'],
    auditKeys: ['response_playbook.platform_health.reviewed.mock', 'admin_action_request.remediation_server_action.queued.mock'],
    updatedAt: '2026-06-09T14:15:00.000Z',
  },
  {
    id: 'playbook_action_request_governance',
    title: 'Action Request Governance',
    description: 'Review queued, running, failed, and blocked admin action requests before production execution.',
    category: 'Admin Ops',
    source: 'System Playbook',
    owner: 'Admin Ops',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'admin_actions.view',
    targetPage: 'action-requests',
    mappedRuleIds: ['rule_action_request_waiting'],
    triggerSummary: 'Admin action request is queued, running, failed, or blocked.',
    responseGoal: 'Keep the mutation pathway governed, visible, and reversible.',
    steps: [
      {
        id: 'action-request-triage',
        stage: 'Triage',
        owner: 'Admin Ops',
        action: 'Review requester, permission, status, scope, and handler readiness.',
        evidenceRequired: ['Requester', 'Permission', 'Scope', 'Handler'],
        auditExpectation: 'Record governance review.',
        customerVisible: false,
      },
      {
        id: 'action-request-server',
        stage: 'Server Handoff',
        owner: 'Engineering',
        action: 'Confirm server handler can enforce permission, audit, human confirmation, and rollback metadata.',
        evidenceRequired: ['Handler key', 'Rollback notes', 'Approval state'],
        auditExpectation: 'No execution without completed governance checks.',
        customerVisible: false,
      },
      {
        id: 'action-request-closeout',
        stage: 'Closeout',
        owner: 'Admin Ops',
        action: 'Confirm completion, failure handling, or blocked state is visible in the action timeline.',
        evidenceRequired: ['Timeline event', 'Audit event', 'Final status'],
        auditExpectation: 'Record closeout or exception.',
        customerVisible: false,
      },
    ],
    handoff: {
      required: false,
      handlerKey: 'server.admin_actions.governance_review',
      rollbackNotes: 'Keep the action request in its current state if governance review cannot complete.',
      humanConfirmationRequired: true,
    },
    blockedActions: ['Execute without approval', 'Skip rollback metadata', 'Resolve failed actions without audit lineage'],
    successCriteria: ['Governance review complete', 'Handler readiness known', 'Timeline/audit lineage visible'],
    auditKeys: ['response_playbook.action_request.reviewed.mock'],
    updatedAt: '2026-06-09T14:20:00.000Z',
  },
  {
    id: 'playbook_sensitive_audit_review',
    title: 'Sensitive Audit Review',
    description: 'Review blocked or critical audit activity for policy gaps, suspicious use, or missing guardrails.',
    category: 'Security',
    source: 'System Playbook',
    owner: 'Security',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'audit.view',
    targetPage: 'audit',
    mappedRuleIds: ['rule_audit_blocked_or_critical'],
    triggerSummary: 'Audit event is blocked or critical.',
    responseGoal: 'Make sensitive activity reviewable without exposing unnecessary customer data.',
    steps: [
      {
        id: 'audit-triage',
        stage: 'Triage',
        owner: 'Security',
        action: 'Review actor, role, permission, outcome, action key, and persistence status.',
        evidenceRequired: ['Actor', 'Permission', 'Outcome', 'Action key'],
        auditExpectation: 'Record security review decision.',
        customerVisible: false,
      },
      {
        id: 'audit-policy',
        stage: 'Server Handoff',
        owner: 'Engineering',
        action: 'Create follow-up action only if policy, permission, or UI guardrail needs to change.',
        evidenceRequired: ['Failure mode', 'Permission gap', 'Recommended policy change'],
        auditExpectation: 'Queue policy work through action requests if it changes state.',
        customerVisible: false,
      },
      {
        id: 'audit-closeout',
        stage: 'Closeout',
        owner: 'Security',
        action: 'Close with no action, policy follow-up, or owner escalation.',
        evidenceRequired: ['Review outcome', 'Next owner', 'Closeout note'],
        auditExpectation: 'Record closeout note.',
        customerVisible: false,
      },
    ],
    handoff: {
      required: false,
      handlerKey: 'server.security.audit_review',
      rollbackNotes: 'No production state changes should occur from audit review without a separate approved action request.',
      humanConfirmationRequired: true,
    },
    blockedActions: ['Expose customer secrets', 'Change permissions from audit screen', 'Delete or rewrite audit records'],
    successCriteria: ['Actor reviewed', 'Permission outcome understood', 'Policy follow-up queued if needed'],
    auditKeys: ['response_playbook.audit_sensitive.reviewed.mock'],
    updatedAt: '2026-06-09T14:25:00.000Z',
  },
  {
    id: 'playbook_usage_decline',
    title: 'Usage Decline Recovery',
    description: 'Guide client success through adoption decline, inactivity, and account-risk review.',
    category: 'Client Success',
    source: 'System Playbook',
    owner: 'Client Success',
    status: 'Draft',
    sensitivity: 'Standard',
    permission: 'usage.view',
    targetPage: 'usage',
    mappedRuleIds: ['rule_usage_decline'],
    triggerSummary: 'Declining usage, inactivity, or elevated escalations are detected.',
    responseGoal: 'Turn usage decline into a concrete follow-up plan before it becomes churn.',
    steps: [
      {
        id: 'usage-triage',
        stage: 'Triage',
        owner: 'Client Success',
        action: 'Review adoption, manager logins, staff adoption, escalations, and inactive days.',
        evidenceRequired: ['Usage trend', 'Inactive days', 'Staff adoption'],
        auditExpectation: 'Record account review decision.',
        customerVisible: false,
      },
      {
        id: 'usage-support-context',
        stage: 'Customer Review',
        owner: 'Support',
        action: 'Check for support blockers or setup gaps before outreach.',
        evidenceRequired: ['Open support issues', 'Module usage gaps', 'Recent activity'],
        auditExpectation: 'Record support blocker decision.',
        customerVisible: false,
      },
      {
        id: 'usage-closeout',
        stage: 'Closeout',
        owner: 'Client Success',
        action: 'Assign follow-up owner, next date, and expansion/churn risk note.',
        evidenceRequired: ['Owner', 'Next date', 'Risk note'],
        auditExpectation: 'Record local success follow-up.',
        customerVisible: true,
      },
    ],
    handoff: {
      required: false,
      handlerKey: 'server.client_success.usage_review',
      rollbackNotes: 'Do not send customer outreach or change account state from browser-only review.',
      humanConfirmationRequired: false,
    },
    blockedActions: ['Send customer outreach silently', 'Mark churn risk without owner review', 'Change plan or modules'],
    successCriteria: ['Adoption driver understood', 'Owner assigned', 'Follow-up path selected'],
    auditKeys: ['response_playbook.usage_decline.reviewed.mock'],
    updatedAt: '2026-06-09T14:30:00.000Z',
  },
]

export function buildResponsePlaybooks(localStates: ResponsePlaybookLocalState[] = []): ResponsePlaybookDefinition[] {
  const localStateByPlaybookId = new Map(localStates.map(state => [state.playbookId, state]))
  return responsePlaybookTemplates.map(playbook => {
    const localState = localStateByPlaybookId.get(playbook.id)
    if (!localState) return playbook
    return {
      ...playbook,
      status: localState.status,
      source: 'Local Override',
      updatedAt: localState.updatedAt,
    }
  })
}

export function summarizeResponsePlaybooks(playbooks: ResponsePlaybookDefinition[]): ResponsePlaybookSummary {
  const stepCount = playbooks.reduce((sum, playbook) => sum + playbook.steps.length, 0)
  return {
    total: playbooks.length,
    active: playbooks.filter(playbook => playbook.status === 'Active').length,
    needsReview: playbooks.filter(playbook => playbook.status === 'Needs Review').length,
    restricted: playbooks.filter(playbook => playbook.sensitivity === 'Restricted').length,
    handoffRequired: playbooks.filter(playbook => playbook.handoff.required).length,
    customerVisible: playbooks.filter(playbook => playbook.steps.some(step => step.customerVisible)).length,
    averageSteps: playbooks.length ? Math.round(stepCount / playbooks.length) : 0,
    localOverrides: playbooks.filter(playbook => playbook.source === 'Local Override').length,
  }
}

export function getResponsePlaybookStatusTone(status: ResponsePlaybookStatus) {
  if (status === 'Active') return 'ok' as const
  if (status === 'Needs Review') return 'warn' as const
  if (status === 'Paused') return 'info' as const
  return 'neutral' as const
}

export function getResponsePlaybookCategoryTone(category: ResponsePlaybookCategory) {
  if (category === 'Finance' || category === 'Support') return 'warn' as const
  if (category === 'Engineering' || category === 'Security') return 'danger' as const
  if (category === 'Client Success') return 'ok' as const
  return 'info' as const
}

export function getPlaybooksForRule(rule: WatchRuleDefinition) {
  return responsePlaybookTemplates.filter(playbook => playbook.mappedRuleIds.includes(rule.id))
}

export function loadLocalResponsePlaybookStates(): ResponsePlaybookLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isResponsePlaybookLocalState)
  } catch {
    return []
  }
}

export function saveLocalResponsePlaybookStates(states: ResponsePlaybookLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 80)))
}

export function useLocalResponsePlaybookStates() {
  const [states, setStates] = useState<ResponsePlaybookLocalState[]>(() => loadLocalResponsePlaybookStates())

  useEffect(() => {
    saveLocalResponsePlaybookStates(states)
  }, [states])

  return [states, setStates] as const
}

function isResponsePlaybookLocalState(value: unknown): value is ResponsePlaybookLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.playbookId === 'string'
    && typeof record.status === 'string'
    && typeof record.updatedAt === 'string'
}
