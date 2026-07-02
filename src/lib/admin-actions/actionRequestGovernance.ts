import { moduleRegistry } from '../modules/registry'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { AdminActionRequest, AdminActionRequestType } from './actionRequests'

export type ActionRequestRiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'
export type ActionRequestReadiness = 'Draft' | 'Needs Approval' | 'Ready' | 'Executing' | 'Completed' | 'Blocked'
export type GovernanceCheckStatus = 'pass' | 'warn' | 'fail'

export interface ActionRequestGovernancePolicy {
  actionType: AdminActionRequestType
  riskLevel: ActionRequestRiskLevel
  requiredApprovers: string[]
  humanConfirmationRequired: boolean
  policyReason: string
}

export interface ActionRequestGovernanceCheck {
  id: string
  label: string
  status: GovernanceCheckStatus
  detail: string
}

export interface ActionRequestGovernanceRecord {
  requestId: string
  readiness: ActionRequestReadiness
  riskLevel: ActionRequestRiskLevel
  requiredApprovers: string[]
  humanConfirmationRequired: boolean
  policyReason: string
  checks: ActionRequestGovernanceCheck[]
  hardBlockers: string[]
  warningCount: number
  passCount: number
}

const approvedStatuses = new Set(['Approved', 'Running', 'Completed'])

const policyByActionType: Record<AdminActionRequestType, ActionRequestGovernancePolicy> = {
  module_activation_change: {
    actionType: 'module_activation_change',
    riskLevel: 'High',
    requiredApprovers: ['Owner', 'Admin', 'Client Success'],
    humanConfirmationRequired: true,
    policyReason: 'Module state can change client entitlements, visible product surface, billing expectations, and support scope.',
  },
  remediation_server_action: {
    actionType: 'remediation_server_action',
    riskLevel: 'High',
    requiredApprovers: ['Support Lead', 'Engineering'],
    humanConfirmationRequired: true,
    policyReason: 'Remediation may touch operational state and must preserve evidence, rollback notes, and tenant scope.',
  },
  support_troubleshooting_action: {
    actionType: 'support_troubleshooting_action',
    riskLevel: 'Medium',
    requiredApprovers: ['Support Lead', 'Engineering'],
    humanConfirmationRequired: true,
    policyReason: 'Support lifecycle changes affect visible activity and escalation history.',
  },
  impersonation_start: {
    actionType: 'impersonation_start',
    riskLevel: 'Critical',
    requiredApprovers: ['Owner', 'Admin', 'Support Lead'],
    humanConfirmationRequired: true,
    policyReason: 'Impersonation is sensitive cross-tenant access and requires explicit scope, expiry, reason, and audit.',
  },
  impersonation_end: {
    actionType: 'impersonation_end',
    riskLevel: 'High',
    requiredApprovers: ['Owner', 'Admin', 'Support Lead'],
    humanConfirmationRequired: false,
    policyReason: 'Ending or expiring impersonation is a safety action, but it still needs audit closure.',
  },
  admin_user_change: {
    actionType: 'admin_user_change',
    riskLevel: 'Critical',
    requiredApprovers: ['Owner', 'Admin'],
    humanConfirmationRequired: true,
    policyReason: 'Internal admin access controls who can see cross-tenant data and perform privileged platform actions.',
  },
  feature_flag_change: {
    actionType: 'feature_flag_change',
    riskLevel: 'Critical',
    requiredApprovers: ['Owner', 'Engineering'],
    humanConfirmationRequired: true,
    policyReason: 'Feature flags can change broad platform behavior and require blast-radius and rollback review.',
  },
  billing_review_action: {
    actionType: 'billing_review_action',
    riskLevel: 'High',
    requiredApprovers: ['Finance', 'Owner'],
    humanConfirmationRequired: true,
    policyReason: 'Billing review can affect discounts, credits, provider reconciliation, and revenue reporting.',
  },
  agent_recommended_action: {
    actionType: 'agent_recommended_action',
    riskLevel: 'High',
    requiredApprovers: ['Owner', 'Domain Owner'],
    humanConfirmationRequired: true,
    policyReason: 'Agent recommendations must stay human-reviewed before customer state, billing, modules, messaging, or permissions change.',
  },
}

export function buildActionRequestGovernance(
  requests: AdminActionRequest[],
  data: PlatformAdminReadModel,
): ActionRequestGovernanceRecord[] {
  return requests.map(request => buildActionRequestGovernanceRecord(request, data))
}

export function getActionRequestGovernancePolicy(actionType: AdminActionRequestType): ActionRequestGovernancePolicy {
  return policyByActionType[actionType]
}

export function buildActionRequestGovernanceRecord(
  request: AdminActionRequest,
  data: PlatformAdminReadModel,
): ActionRequestGovernanceRecord {
  const policy = policyByActionType[request.actionType]
  const checks = [
    createStatusCheck(request),
    createScopeCheck(request),
    createPermissionCheck(request),
    createAuditCheck(request),
    createRollbackCheck(request),
    createApprovalCheck(request, policy),
    createHandlerCheck(request),
    ...createTypeSpecificChecks(request, data),
  ]
  const hardBlockers = checks.filter(check => check.status === 'fail').map(check => check.detail)
  const warningCount = checks.filter(check => check.status === 'warn').length
  const passCount = checks.filter(check => check.status === 'pass').length

  return {
    requestId: request.id,
    readiness: getReadiness(request, hardBlockers),
    riskLevel: policy.riskLevel,
    requiredApprovers: policy.requiredApprovers,
    humanConfirmationRequired: policy.humanConfirmationRequired,
    policyReason: policy.policyReason,
    checks,
    hardBlockers,
    warningCount,
    passCount,
  }
}

export function getGovernanceReadinessTone(readiness: ActionRequestReadiness): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (readiness === 'Ready' || readiness === 'Completed') return 'ok'
  if (readiness === 'Executing') return 'info'
  if (readiness === 'Blocked') return 'danger'
  if (readiness === 'Needs Approval') return 'warn'
  return 'neutral'
}

export function getGovernanceRiskTone(riskLevel: ActionRequestRiskLevel): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (riskLevel === 'Critical') return 'danger'
  if (riskLevel === 'High') return 'warn'
  if (riskLevel === 'Medium') return 'info'
  return 'neutral'
}

export function getGovernanceCheckTone(status: GovernanceCheckStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'pass') return 'ok'
  if (status === 'warn') return 'warn'
  return 'danger'
}

function createStatusCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  if (request.status === 'Failed' || request.status === 'Blocked') {
    return {
      id: 'status',
      label: 'Queue Status',
      status: 'fail',
      detail: `Request is ${request.status}${request.statusReason ? `: ${request.statusReason}` : ''}.`,
    }
  }
  if (request.status === 'Draft') {
    return {
      id: 'status',
      label: 'Queue Status',
      status: 'warn',
      detail: 'Request is still a draft and cannot execute until it is queued and approved.',
    }
  }
  return {
    id: 'status',
    label: 'Queue Status',
    status: 'pass',
    detail: `Request is ${request.status}.`,
  }
}

function createScopeCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  const hasScope = Boolean(request.scope.label)
  const hasTenantScope = Boolean(
    request.scope.organizationId
    || request.scope.organizationName
    || request.scope.propertyId
    || request.scope.propertyName
    || request.scope.venueId
    || request.scope.venueName
    || request.scope.label === 'Platform'
    || request.scope.label.startsWith('platform_admin.'),
  )

  if (!hasScope) {
    return {
      id: 'scope',
      label: 'Scope',
      status: 'fail',
      detail: 'No action scope label is attached.',
    }
  }

  return {
    id: 'scope',
    label: 'Scope',
    status: hasTenantScope ? 'pass' : 'warn',
    detail: hasTenantScope
      ? `Scoped to ${request.scope.label}.`
      : `Scope label is ${request.scope.label}, but tenant/entity identifiers are sparse.`,
  }
}

function createPermissionCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  return {
    id: 'permission',
    label: 'Permission Gate',
    status: request.permissionRequired ? 'pass' : 'fail',
    detail: request.permissionRequired
      ? `Requires ${request.permissionRequired}.`
      : 'No permission gate is attached.',
  }
}

function createAuditCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  return {
    id: 'audit',
    label: 'Audit Anchor',
    status: request.auditEventId ? 'pass' : 'fail',
    detail: request.auditEventId
      ? `Request is anchored to audit event ${request.auditEventId}.`
      : 'No audit event is attached to this request.',
  }
}

function createRollbackCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  const hasRollback = request.rollbackNotes.trim().length >= 24
  return {
    id: 'rollback',
    label: 'Rollback Plan',
    status: hasRollback ? 'pass' : 'fail',
    detail: hasRollback
      ? request.rollbackNotes
      : 'Rollback notes must be captured before execution.',
  }
}

function createApprovalCheck(
  request: AdminActionRequest,
  policy: ActionRequestGovernancePolicy,
): ActionRequestGovernanceCheck {
  if (!policy.humanConfirmationRequired) {
    return {
      id: 'human_approval',
      label: 'Human Approval',
      status: 'pass',
      detail: 'Human approval is not required for this safety-oriented action type.',
    }
  }

  if (approvedStatuses.has(request.status)) {
    return {
      id: 'human_approval',
      label: 'Human Approval',
      status: 'pass',
      detail: `Approval state is represented by ${request.status}. Required reviewers: ${policy.requiredApprovers.join(', ')}.`,
    }
  }

  return {
    id: 'human_approval',
    label: 'Human Approval',
    status: request.status === 'Queued' ? 'warn' : 'fail',
    detail: `Needs approval from ${policy.requiredApprovers.join(', ')} before server execution.`,
  }
}

function createHandlerCheck(request: AdminActionRequest): ActionRequestGovernanceCheck {
  if (!request.serverHandler?.key) {
    return {
      id: 'server_handler',
      label: 'Server Handler',
      status: 'fail',
      detail: 'No server-side handler contract is attached.',
    }
  }

  return {
    id: 'server_handler',
    label: 'Server Handler',
    status: request.serverHandler.status === 'placeholder_only' ? 'warn' : 'pass',
    detail: `${request.serverHandler.key}: ${request.serverHandler.description}`,
  }
}

function createTypeSpecificChecks(
  request: AdminActionRequest,
  data: PlatformAdminReadModel,
): ActionRequestGovernanceCheck[] {
  const checks: ActionRequestGovernanceCheck[] = []

  const scopedBillingRisk = data.billingRisks.find(risk => (
    risk.organizationName === request.scope.organizationName
    || request.scope.label.includes(risk.organizationName)
  ))

  if (scopedBillingRisk && request.actionType !== 'billing_review_action') {
    checks.push({
      id: 'billing_hold',
      label: 'Billing Hold',
      status: scopedBillingRisk.billingStatus === 'Failed Payment' ? 'fail' : 'warn',
      detail: `${scopedBillingRisk.organizationName} has ${scopedBillingRisk.billingStatus}. Resolve or acknowledge billing risk before changing customer state.`,
    })
  }

  if (request.actionType === 'module_activation_change') {
    checks.push(createModuleDependencyCheck(request, data))
  }

  if (request.actionType === 'feature_flag_change') {
    checks.push({
      id: 'blast_radius',
      label: 'Blast Radius',
      status: request.status === 'Blocked' ? 'fail' : 'warn',
      detail: 'Feature flag changes require rollout scope, owner approval, monitoring window, and rollback notes.',
    })
  }

  if (request.actionType === 'billing_review_action') {
    checks.push({
      id: 'provider_reconciliation',
      label: 'Provider Reconciliation',
      status: 'warn',
      detail: 'Stripe/QuickBooks provider adapters are pending, so billing execution must remain review-only.',
    })
  }

  if (request.actionType === 'impersonation_start') {
    checks.push({
      id: 'impersonation_expiry',
      label: 'Session Expiry',
      status: request.metadata?.expiresAt ? 'pass' : 'warn',
      detail: request.metadata?.expiresAt
        ? `Session expiry captured: ${String(request.metadata.expiresAt)}.`
        : 'Impersonation start requests must capture an expiry timestamp before server execution.',
    })
  }

  if (request.actionType === 'admin_user_change') {
    checks.push({
      id: 'internal_access_review',
      label: 'Internal Access Review',
      status: approvedStatuses.has(request.status) ? 'pass' : 'warn',
      detail: 'Internal admin-user changes require owner/admin approval, server-side auth provider sync, and immutable audit evidence.',
    })
  }

  if (request.actionType === 'agent_recommended_action') {
    checks.push({
      id: 'agent_human_gate',
      label: 'Agent Human Gate',
      status: approvedStatuses.has(request.status) ? 'pass' : 'warn',
      detail: 'Agent-suggested changes must be reviewed by a human domain owner before mutating customer state.',
    })
  }

  return checks
}

function createModuleDependencyCheck(
  request: AdminActionRequest,
  data: PlatformAdminReadModel,
): ActionRequestGovernanceCheck {
  const requestedModule = moduleRegistry.find(module => normalize(request.title).includes(normalize(module.name)))
  if (!requestedModule) {
    return {
      id: 'module_dependencies',
      label: 'Module Dependencies',
      status: 'warn',
      detail: 'Could not infer module from request title. Server handler must validate registry dependencies.',
    }
  }

  if (!requestedModule.dependencies.length) {
    return {
      id: 'module_dependencies',
      label: 'Module Dependencies',
      status: 'pass',
      detail: `${requestedModule.name} has no registry dependencies.`,
    }
  }

  const dependencyNames = requestedModule.dependencies.map(dependencyKey => (
    moduleRegistry.find(module => module.key === dependencyKey)?.name ?? dependencyKey
  ))
  const activeModuleNames = new Set([
    ...data.organizations
      .filter(org => org.id === request.scope.organizationId || org.name === request.scope.organizationName)
      .flatMap(org => org.enabledModules),
    ...data.moduleActivations
      .filter(activation => activation.enabled)
      .filter(activation => (
        activation.scopeId === request.scope.organizationId
        || activation.scopeId === request.scope.propertyId
        || activation.scopeId === request.scope.venueId
      ))
      .map(activation => activation.moduleName),
  ].map(normalize))

  const missingDependencies = dependencyNames.filter(dependencyName => !activeModuleNames.has(normalize(dependencyName)))

  return {
    id: 'module_dependencies',
    label: 'Module Dependencies',
    status: missingDependencies.length ? 'fail' : 'pass',
    detail: missingDependencies.length
      ? `Missing dependencies for ${requestedModule.name}: ${missingDependencies.join(', ')}.`
      : `${requestedModule.name} dependencies are present: ${dependencyNames.join(', ')}.`,
  }
}

function getReadiness(request: AdminActionRequest, hardBlockers: string[]): ActionRequestReadiness {
  if (request.status === 'Completed') return 'Completed'
  if (request.status === 'Running') return hardBlockers.length ? 'Blocked' : 'Executing'
  if (request.status === 'Failed' || request.status === 'Blocked' || hardBlockers.length) return 'Blocked'
  if (request.status === 'Draft') return 'Draft'
  if (!approvedStatuses.has(request.status)) return 'Needs Approval'
  return 'Ready'
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
