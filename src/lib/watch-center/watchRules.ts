import { useEffect, useState } from 'react'
import type { PermissionKey } from '../permissions/permissions'
import type {
  WatchSignalOwner,
  WatchSignalPriority,
  WatchSignalSensitivity,
  WatchSignalSource,
  WatchTargetPage,
} from './watchCenter'

export type WatchRuleStatus = 'Active' | 'Draft' | 'Paused' | 'Needs Review'
export type WatchRuleSource = 'System Rule' | 'Local Override'
export type WatchRuleOperator = 'equals' | 'not equals' | 'greater than' | 'less than' | 'contains' | 'is one of'
export type WatchEscalationChannel = 'Watch Center' | 'Command Review' | 'Action Request' | 'Executive Review'

export interface WatchRuleTrigger {
  metric: string
  operator: WatchRuleOperator
  value: string
  window: string
}

export interface WatchEscalationStep {
  afterMinutes: number
  owner: WatchSignalOwner
  channel: WatchEscalationChannel
  action: string
}

export interface WatchRuleDefinition {
  id: string
  name: string
  description: string
  source: WatchRuleSource
  signalSource: WatchSignalSource
  targetPage: WatchTargetPage
  owner: WatchSignalOwner
  status: WatchRuleStatus
  priority: WatchSignalPriority
  sensitivity: WatchSignalSensitivity
  permission: PermissionKey
  trigger: WatchRuleTrigger
  slaMinutes: number
  escalationSteps: WatchEscalationStep[]
  evidenceFields: string[]
  impactedSignals: number
  falsePositiveRisk: 'Low' | 'Medium' | 'High'
  serverHandler: string
  updatedAt: string
}

export interface WatchRuleLocalState {
  ruleId: string
  status: WatchRuleStatus
  note?: string
  updatedAt: string
}

export interface WatchRulesSummary {
  total: number
  active: number
  needsReview: number
  paused: number
  restricted: number
  actionRequestEscalations: number
  averageSlaMinutes: number
  localOverrides: number
}

const localStorageKey = 'hc_platform_watch_rule_states_v1'

export const watchRulesBoundaryRule =
  'Watch rules are internal policy contracts for attention routing. Local rule reviews and pauses do not change production alert delivery, customer data, support records, billing state, or server-side escalation behavior.'

export const watchRuleTemplates: WatchRuleDefinition[] = [
  {
    id: 'rule_support_critical_open',
    name: 'Critical Support Open',
    description: 'Raise critical support issues that are open or escalated into the command inbox immediately.',
    source: 'System Rule',
    signalSource: 'Support',
    targetPage: 'support',
    owner: 'Support',
    status: 'Active',
    priority: 'Critical',
    sensitivity: 'Standard',
    permission: 'support.view',
    trigger: {
      metric: 'support.severity/status',
      operator: 'is one of',
      value: 'critical + Open, Investigating, Escalated',
      window: 'Realtime read model',
    },
    slaMinutes: 120,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Support', channel: 'Watch Center', action: 'Assign support owner and review probable cause.' },
      { afterMinutes: 60, owner: 'Admin Ops', channel: 'Command Review', action: 'Confirm ownership and next action.' },
      { afterMinutes: 120, owner: 'Owner', channel: 'Executive Review', action: 'Escalate if no customer-facing response exists.' },
    ],
    evidenceFields: ['Status', 'Severity', 'Related signal', 'Affected users'],
    impactedSignals: 1,
    falsePositiveRisk: 'Low',
    serverHandler: 'server.watch.support_critical_open',
    updatedAt: '2026-06-09T13:15:00.000Z',
  },
  {
    id: 'rule_billing_failed_payment',
    name: 'Failed Payment Recovery',
    description: 'Route failed payments and meaningful revenue leakage to finance-owned recovery review.',
    source: 'System Rule',
    signalSource: 'Billing',
    targetPage: 'revenue',
    owner: 'Finance',
    status: 'Active',
    priority: 'Critical',
    sensitivity: 'Restricted',
    permission: 'billing.view',
    trigger: {
      metric: 'billing.status/amountAtRisk',
      operator: 'is one of',
      value: 'Failed Payment or amount at risk > $5000',
      window: 'Daily finance read model',
    },
    slaMinutes: 1440,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Finance', channel: 'Watch Center', action: 'Review payment recovery path.' },
      { afterMinutes: 720, owner: 'Client Success', channel: 'Command Review', action: 'Coordinate customer-safe outreach.' },
      { afterMinutes: 1440, owner: 'Owner', channel: 'Executive Review', action: 'Review material revenue risk.' },
    ],
    evidenceFields: ['Billing status', 'Amount at risk', 'MRR', 'Owner'],
    impactedSignals: 1,
    falsePositiveRisk: 'Low',
    serverHandler: 'server.watch.billing_failed_payment',
    updatedAt: '2026-06-09T13:20:00.000Z',
  },
  {
    id: 'rule_health_failing_service_queue',
    name: 'Failing Health Signal',
    description: 'Escalate failing health checks that can block venue service or customer support confidence.',
    source: 'System Rule',
    signalSource: 'Health',
    targetPage: 'health',
    owner: 'Engineering',
    status: 'Active',
    priority: 'Critical',
    sensitivity: 'Restricted',
    permission: 'health.view',
    trigger: {
      metric: 'platform_health.status/severity',
      operator: 'equals',
      value: 'Failing or critical',
      window: 'Last health probe',
    },
    slaMinutes: 180,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Support', channel: 'Watch Center', action: 'Confirm customer impact.' },
      { afterMinutes: 60, owner: 'Engineering', channel: 'Action Request', action: 'Prepare remediation request if server repair is needed.' },
      { afterMinutes: 180, owner: 'Owner', channel: 'Executive Review', action: 'Escalate unresolved platform risk.' },
    ],
    evidenceFields: ['Status', 'Probable cause', 'Affected clients', 'Affected venues'],
    impactedSignals: 1,
    falsePositiveRisk: 'Medium',
    serverHandler: 'server.watch.health_failing_signal',
    updatedAt: '2026-06-09T13:25:00.000Z',
  },
  {
    id: 'rule_action_request_waiting',
    name: 'Action Request Waiting',
    description: 'Keep queued, running, blocked, and failed action requests visible until they have a completed outcome.',
    source: 'System Rule',
    signalSource: 'Action Requests',
    targetPage: 'action-requests',
    owner: 'Admin Ops',
    status: 'Active',
    priority: 'High',
    sensitivity: 'Restricted',
    permission: 'admin_actions.view',
    trigger: {
      metric: 'admin_action.status',
      operator: 'is one of',
      value: 'Queued, Running, Failed, Blocked',
      window: 'Local + read-only action ledger',
    },
    slaMinutes: 1440,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Admin Ops', channel: 'Watch Center', action: 'Review request status and permission.' },
      { afterMinutes: 240, owner: 'Engineering', channel: 'Action Request', action: 'Review handler readiness or failed execution.' },
      { afterMinutes: 1440, owner: 'Owner', channel: 'Command Review', action: 'Review unresolved internal mutation pathway.' },
    ],
    evidenceFields: ['Status', 'Permission', 'Requester', 'Handler'],
    impactedSignals: 3,
    falsePositiveRisk: 'Low',
    serverHandler: 'server.watch.action_request_waiting',
    updatedAt: '2026-06-09T13:30:00.000Z',
  },
  {
    id: 'rule_audit_blocked_or_critical',
    name: 'Blocked / Critical Audit',
    description: 'Surface blocked sensitive actions and critical audit records for security review.',
    source: 'System Rule',
    signalSource: 'Audit',
    targetPage: 'audit',
    owner: 'Security',
    status: 'Active',
    priority: 'Critical',
    sensitivity: 'Restricted',
    permission: 'audit.view',
    trigger: {
      metric: 'audit.outcome/severity',
      operator: 'is one of',
      value: 'blocked or critical',
      window: 'Latest audit ledger',
    },
    slaMinutes: 2880,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Security', channel: 'Watch Center', action: 'Review actor and permission.' },
      { afterMinutes: 1440, owner: 'Engineering', channel: 'Command Review', action: 'Confirm whether policy or UI needs adjustment.' },
      { afterMinutes: 2880, owner: 'Owner', channel: 'Executive Review', action: 'Review unresolved sensitive activity.' },
    ],
    evidenceFields: ['Action key', 'Outcome', 'Permission', 'Persistence'],
    impactedSignals: 2,
    falsePositiveRisk: 'Medium',
    serverHandler: 'server.watch.audit_blocked_or_critical',
    updatedAt: '2026-06-09T13:35:00.000Z',
  },
  {
    id: 'rule_saved_view_restricted_review',
    name: 'Restricted Saved View Review',
    description: 'Route restricted saved views marked for review through admin governance before promotion.',
    source: 'System Rule',
    signalSource: 'Saved Views',
    targetPage: 'saved-views',
    owner: 'Admin Ops',
    status: 'Needs Review',
    priority: 'High',
    sensitivity: 'Restricted',
    permission: 'saved_views.view',
    trigger: {
      metric: 'saved_view.status/sensitivity',
      operator: 'equals',
      value: 'Needs Review + Restricted',
      window: 'Saved view registry',
    },
    slaMinutes: 4320,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Admin Ops', channel: 'Watch Center', action: 'Review filters and audience.' },
      { afterMinutes: 1440, owner: 'Security', channel: 'Command Review', action: 'Review restricted data exposure.' },
      { afterMinutes: 4320, owner: 'Owner', channel: 'Executive Review', action: 'Resolve stale restricted view governance.' },
    ],
    evidenceFields: ['Audience', 'Filters', 'Columns', 'Permission'],
    impactedSignals: 1,
    falsePositiveRisk: 'Low',
    serverHandler: 'server.watch.saved_view_restricted_review',
    updatedAt: '2026-06-09T13:40:00.000Z',
  },
  {
    id: 'rule_usage_decline',
    name: 'Usage Decline Watch',
    description: 'Detect adoption decline, inactivity, or high escalations before the account becomes a churn risk.',
    source: 'System Rule',
    signalSource: 'Usage',
    targetPage: 'usage',
    owner: 'Client Success',
    status: 'Draft',
    priority: 'Medium',
    sensitivity: 'Standard',
    permission: 'usage.view',
    trigger: {
      metric: 'usage.trend/inactiveDays/escalations',
      operator: 'is one of',
      value: 'Declining, inactive >= 7 days, or escalations > 4',
      window: 'Last 7 days',
    },
    slaMinutes: 4320,
    escalationSteps: [
      { afterMinutes: 0, owner: 'Client Success', channel: 'Watch Center', action: 'Review adoption and owner follow-up.' },
      { afterMinutes: 2880, owner: 'Support', channel: 'Command Review', action: 'Check support blockers or setup gaps.' },
      { afterMinutes: 4320, owner: 'Owner', channel: 'Executive Review', action: 'Review account-level risk.' },
    ],
    evidenceFields: ['Active users 7d', 'Staff adoption', 'Escalations 7d', 'Ignored requests 7d'],
    impactedSignals: 1,
    falsePositiveRisk: 'High',
    serverHandler: 'server.watch.usage_decline',
    updatedAt: '2026-06-09T13:45:00.000Z',
  },
]

export function buildWatchRules(localStates: WatchRuleLocalState[] = []): WatchRuleDefinition[] {
  const localStateByRuleId = new Map(localStates.map(state => [state.ruleId, state]))
  return watchRuleTemplates.map(rule => {
    const localState = localStateByRuleId.get(rule.id)
    if (!localState) return rule
    return {
      ...rule,
      status: localState.status,
      source: 'Local Override',
      updatedAt: localState.updatedAt,
    }
  })
}

export function summarizeWatchRules(rules: WatchRuleDefinition[]): WatchRulesSummary {
  const totalSla = rules.reduce((sum, rule) => sum + rule.slaMinutes, 0)
  return {
    total: rules.length,
    active: rules.filter(rule => rule.status === 'Active').length,
    needsReview: rules.filter(rule => rule.status === 'Needs Review').length,
    paused: rules.filter(rule => rule.status === 'Paused').length,
    restricted: rules.filter(rule => rule.sensitivity === 'Restricted').length,
    actionRequestEscalations: rules.filter(rule => rule.escalationSteps.some(step => step.channel === 'Action Request')).length,
    averageSlaMinutes: rules.length ? Math.round(totalSla / rules.length) : 0,
    localOverrides: rules.filter(rule => rule.source === 'Local Override').length,
  }
}

export function getWatchRuleStatusTone(status: WatchRuleStatus) {
  if (status === 'Active') return 'ok' as const
  if (status === 'Needs Review') return 'warn' as const
  if (status === 'Paused') return 'info' as const
  return 'neutral' as const
}

export function getWatchRuleRiskTone(risk: WatchRuleDefinition['falsePositiveRisk']) {
  if (risk === 'High') return 'danger' as const
  if (risk === 'Medium') return 'warn' as const
  return 'ok' as const
}

export function formatSla(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.round(minutes / 60)}h`
}

export function loadLocalWatchRuleStates(): WatchRuleLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWatchRuleLocalState)
  } catch {
    return []
  }
}

export function saveLocalWatchRuleStates(states: WatchRuleLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 80)))
}

export function useLocalWatchRuleStates() {
  const [states, setStates] = useState<WatchRuleLocalState[]>(() => loadLocalWatchRuleStates())

  useEffect(() => {
    saveLocalWatchRuleStates(states)
  }, [states])

  return [states, setStates] as const
}

function isWatchRuleLocalState(value: unknown): value is WatchRuleLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.ruleId === 'string'
    && typeof record.status === 'string'
    && typeof record.updatedAt === 'string'
}
