import type { PermissionKey } from '../permissions/permissions'
import type { ActionExecutionConfig } from './actionExecutionContract'
import {
  actionTypeLabels,
  serverActionHandlerPlaceholders,
  type AdminActionRequestType,
} from './actionRequests'
import { mockServerHandlerRegistry, type MockServerHandlerDefinition } from './mockServerExecutor'

export type ServerAdapterReadinessStatus = 'Ready For Wiring' | 'Review Only' | 'Blocked'
export type ServerAdapterCheckStatus = 'pass' | 'warn' | 'fail'

export interface ServerAdapterCheck {
  id: string
  label: string
  status: ServerAdapterCheckStatus
  detail: string
}

export interface ServerAdapterContract {
  key: string
  label: string
  actionType: AdminActionRequestType
  actionLabel: string
  requiredPermission: PermissionKey
  route: string
  method: 'POST'
  simulatedWriteTarget: string
  requestSchema: string[]
  responseSchema: string[]
  requiredServerControls: string[]
  auditEvents: string[]
  rollbackStrategy: string
  dryRunRegistered: boolean
  endpointConfigured: boolean
  status: ServerAdapterReadinessStatus
  checks: ServerAdapterCheck[]
  blockers: string[]
  warnings: string[]
}

export interface ServerAdapterReadinessSummary {
  total: number
  readyForWiring: number
  reviewOnly: number
  blocked: number
  endpointConfigured: boolean
  dryRunRegistered: number
}

export const serverAdapterBoundaryRule =
  'Server adapters are contracts for future trusted backend handlers. Platform Admin may inspect adapter readiness and dry-run request shapes, but browser code must not hold secrets, bypass RLS, or mutate production state.'

const permissionByActionType: Record<AdminActionRequestType, PermissionKey> = {
  module_activation_change: 'modules.manage',
  remediation_server_action: 'troubleshooting.run',
  support_troubleshooting_action: 'troubleshooting.run',
  impersonation_start: 'impersonation.start',
  impersonation_end: 'impersonation.start',
  admin_user_change: 'admin_users.manage',
  feature_flag_change: 'feature_flags.manage',
  billing_review_action: 'billing.manage',
  agent_recommended_action: 'agents.manage',
}

const rollbackStrategyByActionType: Record<AdminActionRequestType, string> = {
  module_activation_change: 'Persist an activation request, capture previous entitlement snapshot, and disable or restore the prior record if validation fails.',
  remediation_server_action: 'Keep remediation packet evidence immutable, preserve previous operational state, and leave the support issue open when handler validation fails.',
  support_troubleshooting_action: 'Append a visible support activity record only after validation; preserve previous issue status and escalation owner for rollback.',
  impersonation_start: 'Create a scoped, expiring session only after permission and reason checks; expire the session immediately if finalization fails.',
  impersonation_end: 'Close the scoped session, write an audit closure, and keep access revoked even if downstream notification fails.',
  admin_user_change: 'Stage internal access changes, sync the auth provider server-side, and preserve prior role/status for rollback.',
  feature_flag_change: 'Persist rollout scope, monitoring window, and rollback window; revert rollout to the previous value if post-checks fail.',
  billing_review_action: 'Record finance review separately from provider mutation, reconcile provider state, and preserve prior discount or credit state.',
  agent_recommended_action: 'Keep agent recommendation in review state until a human-approved server handler creates downstream work.',
}

const baseRequestSchema = [
  'requestId',
  'actionType',
  'scope',
  'permissionRequired',
  'requestedBy',
  'approvalDecision',
  'auditEventId',
  'rollbackNotes',
  'idempotencyKey',
  'correlationId',
]

const baseServerControls = [
  'Server-side role and permission check',
  'Immutable platform_admin.audit_logs write',
  'Idempotency key enforcement',
  'Tenant scope validation',
  'Rollback metadata capture',
  'Human confirmation verification where required',
]

export function buildServerAdapterReadiness(config: ActionExecutionConfig) {
  return Object.entries(serverActionHandlerPlaceholders)
    .map(([actionType, handler]) => buildServerAdapterContract(handler.key, actionType as AdminActionRequestType, config))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function summarizeServerAdapterReadiness(contracts: ServerAdapterContract[]): ServerAdapterReadinessSummary {
  return {
    total: contracts.length,
    readyForWiring: contracts.filter(contract => contract.status === 'Ready For Wiring').length,
    reviewOnly: contracts.filter(contract => contract.status === 'Review Only').length,
    blocked: contracts.filter(contract => contract.status === 'Blocked').length,
    endpointConfigured: contracts.some(contract => contract.endpointConfigured),
    dryRunRegistered: contracts.filter(contract => contract.dryRunRegistered).length,
  }
}

export function getServerAdapterReadinessTone(status: ServerAdapterReadinessStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Ready For Wiring') return 'ok'
  if (status === 'Blocked') return 'danger'
  return 'warn'
}

export function getServerAdapterCheckTone(status: ServerAdapterCheckStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'pass') return 'ok'
  if (status === 'warn') return 'warn'
  return 'danger'
}

function buildServerAdapterContract(
  handlerKey: string,
  actionType: AdminActionRequestType,
  config: ActionExecutionConfig,
): ServerAdapterContract {
  const placeholder = serverActionHandlerPlaceholders[actionType]
  const mockHandler = mockServerHandlerRegistry[handlerKey]
  const endpointConfigured = Boolean(config.endpoint)
  const route = endpointConfigured
    ? config.endpoint
    : `/platform-admin/actions/${handlerKey}`
  const checks = buildAdapterChecks(handlerKey, actionType, config, mockHandler)
  const blockers = checks.filter(check => check.status === 'fail').map(check => check.detail)
  const warnings = checks.filter(check => check.status === 'warn').map(check => check.detail)
  const status = blockers.length
    ? 'Blocked'
    : endpointConfigured
      ? 'Ready For Wiring'
      : 'Review Only'

  return {
    key: handlerKey,
    label: placeholder.label,
    actionType,
    actionLabel: actionTypeLabels[actionType],
    requiredPermission: permissionByActionType[actionType],
    route,
    method: 'POST',
    simulatedWriteTarget: mockHandler?.simulatedWriteTarget ?? 'unregistered_handler',
    requestSchema: [
      ...baseRequestSchema,
      ...getDomainRequestFields(actionType),
    ],
    responseSchema: mockHandler?.responseShape ?? ['status', 'audit_event_id', 'error'],
    requiredServerControls: baseServerControls,
    auditEvents: getAuditEvents(actionType),
    rollbackStrategy: rollbackStrategyByActionType[actionType],
    dryRunRegistered: Boolean(mockHandler),
    endpointConfigured,
    status,
    checks,
    blockers,
    warnings,
  }
}

function buildAdapterChecks(
  handlerKey: string,
  actionType: AdminActionRequestType,
  config: ActionExecutionConfig,
  mockHandler: MockServerHandlerDefinition | undefined,
): ServerAdapterCheck[] {
  return [
    {
      id: 'handler_placeholder',
      label: 'Handler Placeholder',
      status: serverActionHandlerPlaceholders[actionType]?.key === handlerKey ? 'pass' : 'fail',
      detail: serverActionHandlerPlaceholders[actionType]?.key === handlerKey
        ? `${handlerKey} is registered as the browser-visible handler placeholder.`
        : `${handlerKey} does not match the action-type handler placeholder.`,
    },
    {
      id: 'dry_run_registry',
      label: 'Dry-Run Registry',
      status: mockHandler ? 'pass' : 'fail',
      detail: mockHandler
        ? `${handlerKey} has a dry-run registry entry and response preview shape.`
        : `${handlerKey} has no dry-run registry entry.`,
    },
    {
      id: 'endpoint',
      label: 'Server Endpoint',
      status: config.endpoint ? 'pass' : 'warn',
      detail: config.endpoint
        ? `Future server actions can target ${config.endpoint}.`
        : 'VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT is unset, so adapters stay review-only.',
    },
    {
      id: 'permission',
      label: 'Permission Contract',
      status: permissionByActionType[actionType] ? 'pass' : 'fail',
      detail: `Requires ${permissionByActionType[actionType]} before the handler can run.`,
    },
    {
      id: 'audit',
      label: 'Audit Contract',
      status: 'pass',
      detail: 'Handler must write an immutable audit entry before and after meaningful state changes.',
    },
    {
      id: 'mutation_boundary',
      label: 'Mutation Boundary',
      status: 'pass',
      detail: 'Browser code cannot hold server secrets or mutate production data directly.',
    },
    {
      id: 'rollback',
      label: 'Rollback Strategy',
      status: rollbackStrategyByActionType[actionType] ? 'pass' : 'fail',
      detail: rollbackStrategyByActionType[actionType],
    },
  ]
}

function getDomainRequestFields(actionType: AdminActionRequestType) {
  if (actionType === 'module_activation_change') return ['moduleKey', 'activationScope', 'dependencySnapshot']
  if (actionType === 'remediation_server_action') return ['runbookId', 'supportIssueId', 'evidenceAnchor']
  if (actionType === 'support_troubleshooting_action') return ['supportIssueId', 'nextStatus', 'activityNote']
  if (actionType === 'impersonation_start') return ['targetUserId', 'scopeLabel', 'expiresAt', 'reason']
  if (actionType === 'impersonation_end') return ['sessionId', 'closureReason']
  if (actionType === 'admin_user_change') return ['adminUserId', 'role', 'status', 'authProviderAction']
  if (actionType === 'feature_flag_change') return ['flagKey', 'rolloutScope', 'previousValue', 'nextValue']
  if (actionType === 'billing_review_action') return ['billingReviewId', 'providerReference', 'financeOwner']
  return ['agentRecommendationId', 'domainOwner', 'approvedActionScope']
}

function getAuditEvents(actionType: AdminActionRequestType) {
  return [
    `admin_action_request.${actionType}.queued`,
    `approval_center.${actionType}.approved`,
    `execution_handoff.${actionType}.reviewed`,
    `server_adapter.${actionType}.started`,
    `server_adapter.${actionType}.completed_or_blocked`,
  ]
}
