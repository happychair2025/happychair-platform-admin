import { useSyncExternalStore } from 'react'
import type { AuditEvent } from '../audit/auditLog'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { ActionExecutionPacket } from './actionExecutionContract'
import type { ActionRequestGovernanceRecord } from './actionRequestGovernance'
import type { AdminActionRequest, AdminActionRequestType } from './actionRequests'

export type MockServerExecutionStatus = 'Dry Run Passed' | 'Dry Run Blocked' | 'Needs Approval' | 'Completed Snapshot'
export type MockServerCheckStatus = 'pass' | 'warn' | 'fail'

export interface MockServerHandlerDefinition {
  key: string
  label: string
  actionType: AdminActionRequestType
  simulatedWriteTarget: string
  domainChecks: string[]
  responseShape: string[]
}

export interface MockServerExecutionCheck {
  id: string
  label: string
  status: MockServerCheckStatus
  detail: string
}

export interface MockServerExecutionRecord {
  id: string
  requestId: string
  actionType: AdminActionRequestType
  handlerKey: string
  handlerLabel: string
  status: MockServerExecutionStatus
  outcomeSummary: string
  dryRun: true
  mutationApplied: false
  simulatedWriteTarget: string
  idempotencyKey: string
  correlationId: string
  route: string
  auditEventId: string
  actorEmail: string
  durationMs: number
  checks: MockServerExecutionCheck[]
  responsePreview: Record<string, unknown>
  createdAt: string
}

export interface MockServerExecutionSummary {
  total: number
  passed: number
  blocked: number
  needsApproval: number
  latest?: MockServerExecutionRecord
}

export interface RunMockServerExecutionInput {
  request: AdminActionRequest
  packet: ActionExecutionPacket
  governance?: ActionRequestGovernanceRecord
  data: PlatformAdminReadModel
  auditEvent: AuditEvent
}

const storageKey = 'hc_platform_mock_server_executions'
const listeners = new Set<() => void>()
let cachedRawExecutions = ''
let cachedExecutions: MockServerExecutionRecord[] = []

export const mockServerExecutionBoundaryRule =
  'Mock server executions are dry-run simulations only. They may validate packets, return response previews, and write a local execution ledger, but mutationApplied is always false.'

export const mockServerHandlerRegistry: Record<string, MockServerHandlerDefinition> = {
  'server.modules.activation_change': {
    key: 'server.modules.activation_change',
    label: 'Module activation handler',
    actionType: 'module_activation_change',
    simulatedWriteTarget: 'platform_admin.module_activation_requests',
    domainChecks: ['Registry dependency check', 'Tenant entitlement scope', 'Rollback snapshot'],
    responseShape: ['activation_request_id', 'dependency_status', 'rollback_snapshot_id'],
  },
  'server.support.remediation_action': {
    key: 'server.support.remediation_action',
    label: 'Remediation handler',
    actionType: 'remediation_server_action',
    simulatedWriteTarget: 'platform_admin.remediation_packets',
    domainChecks: ['Runbook scope check', 'Support issue linkage', 'Evidence preservation'],
    responseShape: ['remediation_packet_id', 'runbook_status', 'evidence_anchor'],
  },
  'server.support.troubleshooting_lifecycle': {
    key: 'server.support.troubleshooting_lifecycle',
    label: 'Support lifecycle handler',
    actionType: 'support_troubleshooting_action',
    simulatedWriteTarget: 'platform_admin.support_activity',
    domainChecks: ['Support issue status check', 'Visible activity note', 'Escalation owner'],
    responseShape: ['support_activity_id', 'issue_status', 'owner'],
  },
  'server.impersonation.start': {
    key: 'server.impersonation.start',
    label: 'Impersonation start handler',
    actionType: 'impersonation_start',
    simulatedWriteTarget: 'platform_admin.impersonation_sessions',
    domainChecks: ['Scoped actor check', 'Expiry check', 'Sensitive access audit'],
    responseShape: ['session_id', 'expires_at', 'scope_label'],
  },
  'server.impersonation.end': {
    key: 'server.impersonation.end',
    label: 'Impersonation end handler',
    actionType: 'impersonation_end',
    simulatedWriteTarget: 'platform_admin.impersonation_sessions',
    domainChecks: ['Session lookup', 'Audit closure', 'Access revocation'],
    responseShape: ['session_id', 'ended_at', 'closure_audit_id'],
  },
  'server.internal_access.admin_user_change': {
    key: 'server.internal_access.admin_user_change',
    label: 'Internal admin user handler',
    actionType: 'admin_user_change',
    simulatedWriteTarget: 'platform_admin.internal_admin_users',
    domainChecks: ['Owner/admin approval', 'Auth provider sync', 'Access review evidence'],
    responseShape: ['admin_user_id', 'role', 'status'],
  },
  'server.feature_flags.change': {
    key: 'server.feature_flags.change',
    label: 'Feature flag handler',
    actionType: 'feature_flag_change',
    simulatedWriteTarget: 'platform_admin.feature_flag_changes',
    domainChecks: ['Rollout scope', 'Blast radius', 'Rollback window'],
    responseShape: ['flag_key', 'rollout_scope', 'rollback_window'],
  },
  'server.billing.review_action': {
    key: 'server.billing.review_action',
    label: 'Billing review handler',
    actionType: 'billing_review_action',
    simulatedWriteTarget: 'platform_admin.billing_reviews',
    domainChecks: ['Finance approval', 'Provider reconciliation', 'Revenue impact note'],
    responseShape: ['billing_review_id', 'provider_status', 'finance_owner'],
  },
  'server.agents.approved_recommendation': {
    key: 'server.agents.approved_recommendation',
    label: 'Agent approval handler',
    actionType: 'agent_recommended_action',
    simulatedWriteTarget: 'platform_admin.agent_action_reviews',
    domainChecks: ['Human domain owner', 'Agent safety policy', 'Customer-state boundary'],
    responseShape: ['agent_review_id', 'domain_owner', 'action_scope'],
  },
}

export function getLocalMockServerExecutions(): MockServerExecutionRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawExecutions = localStorage.getItem(storageKey) ?? '[]'
  if (rawExecutions === cachedRawExecutions) return cachedExecutions

  try {
    cachedRawExecutions = rawExecutions
    cachedExecutions = JSON.parse(rawExecutions) as MockServerExecutionRecord[]
    return cachedExecutions
  } catch {
    cachedRawExecutions = rawExecutions
    cachedExecutions = []
    return []
  }
}

export function saveMockServerExecution(record: MockServerExecutionRecord) {
  const executions = [
    record,
    ...getLocalMockServerExecutions().filter(item => item.id !== record.id),
  ].slice(0, 80)

  cachedExecutions = executions
  cachedRawExecutions = JSON.stringify(executions)
  localStorage.setItem(storageKey, cachedRawExecutions)
  emitMockServerExecutionChange()
  return record
}

export function subscribeToMockServerExecutions(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLocalMockServerExecutions() {
  return useSyncExternalStore(subscribeToMockServerExecutions, getLocalMockServerExecutions, () => [])
}

export function runMockServerExecution(input: RunMockServerExecutionInput) {
  const handler = mockServerHandlerRegistry[input.request.serverHandler.key]
  const startedAt = Date.now()
  const checks = buildMockServerChecks(input, handler)
  const status = getMockServerStatus(input.request, checks)
  const record: MockServerExecutionRecord = {
    id: `mock-server-execution-${crypto.randomUUID()}`,
    requestId: input.request.id,
    actionType: input.request.actionType,
    handlerKey: input.request.serverHandler.key,
    handlerLabel: handler?.label ?? input.request.serverHandler.label,
    status,
    outcomeSummary: getOutcomeSummary(status, input.request.title),
    dryRun: true,
    mutationApplied: false,
    simulatedWriteTarget: handler?.simulatedWriteTarget ?? 'unregistered_handler',
    idempotencyKey: input.packet.idempotencyKey,
    correlationId: input.packet.correlationId,
    route: input.packet.route,
    auditEventId: input.auditEvent.id,
    actorEmail: input.auditEvent.actorEmail ?? input.auditEvent.actor,
    durationMs: Math.max(24, Date.now() - startedAt + 37),
    checks,
    responsePreview: buildResponsePreview(input, handler, status),
    createdAt: new Date().toISOString(),
  }

  return saveMockServerExecution(record)
}

export function summarizeMockServerExecutions(executions: MockServerExecutionRecord[]): MockServerExecutionSummary {
  return {
    total: executions.length,
    passed: executions.filter(record => record.status === 'Dry Run Passed').length,
    blocked: executions.filter(record => record.status === 'Dry Run Blocked').length,
    needsApproval: executions.filter(record => record.status === 'Needs Approval').length,
    latest: executions[0],
  }
}

export function getLatestMockServerExecution(
  requestId: string,
  executions: MockServerExecutionRecord[],
) {
  return executions.find(record => record.requestId === requestId)
}

export function getMockServerExecutionStatusTone(status: MockServerExecutionStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Dry Run Passed' || status === 'Completed Snapshot') return 'ok'
  if (status === 'Dry Run Blocked') return 'danger'
  if (status === 'Needs Approval') return 'warn'
  return 'neutral'
}

export function getMockServerCheckTone(status: MockServerCheckStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'pass') return 'ok'
  if (status === 'warn') return 'warn'
  return 'danger'
}

function buildMockServerChecks(
  input: RunMockServerExecutionInput,
  handler: MockServerHandlerDefinition | undefined,
): MockServerExecutionCheck[] {
  const governanceBlockers = input.governance?.hardBlockers ?? []
  const domainRowCount = getDomainRowCount(input)
  return [
    {
      id: 'handler_registered',
      label: 'Handler Registered',
      status: handler ? 'pass' : 'fail',
      detail: handler
        ? `${handler.key} is present in the mock server registry.`
        : `${input.request.serverHandler.key} is not registered in the mock server registry.`,
    },
    {
      id: 'packet_blockers',
      label: 'Packet Blockers',
      status: input.packet.blockers.length ? 'fail' : 'pass',
      detail: input.packet.blockers[0] ?? 'No hard packet blockers found.',
    },
    {
      id: 'governance_blockers',
      label: 'Governance Blockers',
      status: governanceBlockers.length ? 'fail' : 'pass',
      detail: governanceBlockers[0] ?? 'Governance hard checks are clear.',
    },
    {
      id: 'approval_state',
      label: 'Approval State',
      status: input.request.status === 'Approved' || input.request.status === 'Running' || input.request.status === 'Completed' ? 'pass' : 'warn',
      detail: input.request.status === 'Approved' || input.request.status === 'Running' || input.request.status === 'Completed'
        ? `Request status is ${input.request.status}.`
        : `Request status is ${input.request.status}; dry run can preview response but cannot represent approval.`,
    },
    {
      id: 'domain_context',
      label: 'Domain Context',
      status: domainRowCount ? 'pass' : 'warn',
      detail: domainRowCount
        ? `${domainRowCount} relevant read-model record${domainRowCount === 1 ? '' : 's'} available for dry-run context.`
        : 'No domain-specific read-model records matched this scope; server handler must verify against production substrate.',
    },
    {
      id: 'dry_run_boundary',
      label: 'Dry-Run Boundary',
      status: 'pass',
      detail: 'mutationApplied=false. No customer, billing, module, permission, or support state is changed.',
    },
  ]
}

function getMockServerStatus(
  request: AdminActionRequest,
  checks: MockServerExecutionCheck[],
): MockServerExecutionStatus {
  if (request.status === 'Completed') return 'Completed Snapshot'
  if (checks.some(check => check.status === 'fail')) return 'Dry Run Blocked'
  if (request.status !== 'Approved' && request.status !== 'Running') return 'Needs Approval'
  return 'Dry Run Passed'
}

function getOutcomeSummary(status: MockServerExecutionStatus, title: string) {
  if (status === 'Dry Run Passed') return `Dry run passed for ${title}. Server response preview is ready.`
  if (status === 'Completed Snapshot') return `Completed request snapshot captured for ${title}.`
  if (status === 'Needs Approval') return `Dry run preview created for ${title}, but approval is still required.`
  return `Dry run blocked for ${title}. Review failed checks before execution.`
}

function buildResponsePreview(
  input: RunMockServerExecutionInput,
  handler: MockServerHandlerDefinition | undefined,
  status: MockServerExecutionStatus,
): Record<string, unknown> {
  return {
    ok: status === 'Dry Run Passed' || status === 'Completed Snapshot',
    dryRun: true,
    mutationApplied: false,
    requestId: input.request.id,
    actionType: input.request.actionType,
    handlerKey: input.request.serverHandler.key,
    scope: input.request.scope.label,
    simulatedWriteTarget: handler?.simulatedWriteTarget ?? 'unregistered_handler',
    responseShape: handler?.responseShape ?? [],
    domainChecks: handler?.domainChecks ?? [],
    idempotencyKey: input.packet.idempotencyKey,
    correlationId: input.packet.correlationId,
  }
}

function getDomainRowCount(input: RunMockServerExecutionInput) {
  const scope = input.request.scope
  if (input.request.actionType === 'billing_review_action') {
    return input.data.billingRisks.filter(risk => risk.organizationName === scope.organizationName || scope.label.includes(risk.organizationName)).length
  }
  if (input.request.actionType === 'module_activation_change') {
    return input.data.moduleActivations.filter(activation => (
      activation.scopeId === scope.organizationId
      || activation.scopeId === scope.propertyId
      || activation.scopeId === scope.venueId
    )).length
  }
  if (input.request.actionType === 'support_troubleshooting_action' || input.request.actionType === 'remediation_server_action') {
    return input.data.supportIssues.filter(issue => (
      issue.organizationName === scope.organizationName
      || issue.propertyName === scope.propertyName
      || issue.venueName === scope.venueName
      || scope.label.includes(issue.venueName)
    )).length
  }
  if (input.request.actionType === 'impersonation_start' || input.request.actionType === 'impersonation_end') {
    return input.data.impersonationTargets.filter(target => (
      target.organizationName === scope.organizationName
      || target.propertyName === scope.propertyName
      || target.venueName === scope.venueName
    )).length
  }
  if (input.request.actionType === 'feature_flag_change') return input.data.featureFlags.length
  if (input.request.actionType === 'admin_user_change') return input.data.internalAdminUsers.length
  if (input.request.actionType === 'agent_recommended_action') return input.data.agentEvents.length
  return 0
}

function emitMockServerExecutionChange() {
  listeners.forEach(listener => listener())
}
