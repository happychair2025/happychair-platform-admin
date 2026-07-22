import type { PermissionKey } from '../permissions/permissions'
import type { AdminActionRequestType } from './actionRequests'

export type TrustedServerAdapterMode = 'dry_run' | 'execute'
export type TrustedServerAdapterStatus = 'accepted' | 'completed' | 'blocked' | 'rejected' | 'dry_run_passed' | 'dry_run_blocked'
export type TrustedServerAdapterGateSeverity = 'critical' | 'required'

export interface TrustedServerAdapterHeader {
  key: string
  purpose: string
}

export interface TrustedServerAdapterEnvelopeSection {
  key: string
  label: string
  requiredFields: string[]
}

export interface TrustedServerAdapterPreflightGate {
  id: string
  label: string
  severity: TrustedServerAdapterGateSeverity
  passCondition: string
  rejectionCode: string
}

export interface TrustedServerAdapterResponseState {
  status: TrustedServerAdapterStatus
  label: string
  meaning: string
  mutationApplied: boolean
}

export interface TrustedServerAdapterSpec {
  actionType: AdminActionRequestType
  handlerKey: string
  requiredPermission: PermissionKey
  writeTarget: string
  supportedModes: TrustedServerAdapterMode[]
  browserMutationAllowed: false
  serverMutationBoundary: string
  requiredHeaders: TrustedServerAdapterHeader[]
  requestEnvelope: TrustedServerAdapterEnvelopeSection[]
  preflightGates: TrustedServerAdapterPreflightGate[]
  responseStates: TrustedServerAdapterResponseState[]
  requiredAuditKeys: string[]
  rejectionCodes: string[]
  responseFields: string[]
}

export const trustedServerAdapterBoundaryRule =
  'Trusted server adapters receive reviewed browser packets, verify the internal actor and tenant scope server-side, write audit records, enforce idempotency, and only then perform allowlisted mutations.'

export function buildTrustedServerAdapterSpec(input: {
  actionType: AdminActionRequestType
  handlerKey: string
  requiredPermission: PermissionKey
  writeTarget: string
  requestFields: string[]
  responseFields: string[]
  auditEvents: string[]
}): TrustedServerAdapterSpec {
  const preflightGates = buildPreflightGates(input)

  return {
    actionType: input.actionType,
    handlerKey: input.handlerKey,
    requiredPermission: input.requiredPermission,
    writeTarget: input.writeTarget,
    supportedModes: ['dry_run', 'execute'],
    browserMutationAllowed: false,
    serverMutationBoundary: 'Only a trusted server runtime may use service-role credentials or write platform_admin mutation tables.',
    requiredHeaders: trustedServerAdapterHeaders,
    requestEnvelope: buildRequestEnvelope(input),
    preflightGates,
    responseStates: trustedServerAdapterResponseStates,
    requiredAuditKeys: input.auditEvents,
    rejectionCodes: preflightGates.map(gate => gate.rejectionCode),
    responseFields: input.responseFields,
  }
}

const trustedServerAdapterHeaders: TrustedServerAdapterHeader[] = [
  {
    key: 'Authorization',
    purpose: 'Carries the verified internal admin session token. Never use a customer session as platform authority.',
  },
  {
    key: 'Idempotency-Key',
    purpose: 'Prevents duplicate mutation when an operator retries a queued action.',
  },
  {
    key: 'X-HC-Correlation-Id',
    purpose: 'Links request, audit, server logs, support activity, and read-view refresh evidence.',
  },
]

function buildRequestEnvelope(input: {
  actionType: AdminActionRequestType
  handlerKey: string
  requiredPermission: PermissionKey
  requestFields: string[]
}): TrustedServerAdapterEnvelopeSection[] {
  return [
    {
      key: 'actor',
      label: 'Internal Actor',
      requiredFields: ['adminUserId', 'adminEmail', 'adminRole', 'sessionId'],
    },
    {
      key: 'authorization',
      label: 'Authorization',
      requiredFields: ['permissionRequired', input.requiredPermission, 'approvalDecision', 'humanConfirmedAt'],
    },
    {
      key: 'request',
      label: 'Action Request',
      requiredFields: ['requestId', 'actionType', input.actionType, 'handlerKey', input.handlerKey],
    },
    {
      key: 'scope',
      label: 'Tenant Scope',
      requiredFields: ['organizationId', 'propertyId', 'venueId', 'scopeLabel'],
    },
    {
      key: 'execution',
      label: 'Execution Controls',
      requiredFields: ['mode', 'idempotencyKey', 'correlationId', 'dryRun', 'rollbackNotes'],
    },
    {
      key: 'domainPayload',
      label: 'Domain Payload',
      requiredFields: input.requestFields,
    },
  ]
}

function buildPreflightGates(input: {
  requiredPermission: PermissionKey
  writeTarget: string
}): TrustedServerAdapterPreflightGate[] {
  return [
    {
      id: 'internal_session',
      label: 'Internal Session Verified',
      severity: 'critical',
      passCondition: 'Token resolves to an active internal_admin_users record.',
      rejectionCode: 'internal_session_invalid',
    },
    {
      id: 'permission',
      label: 'Permission Verified',
      severity: 'critical',
      passCondition: `Actor role grants ${input.requiredPermission}.`,
      rejectionCode: 'permission_denied',
    },
    {
      id: 'tenant_scope',
      label: 'Tenant Scope Verified',
      severity: 'critical',
      passCondition: 'Organization, property, and venue IDs match the requested action scope.',
      rejectionCode: 'tenant_scope_mismatch',
    },
    {
      id: 'approval',
      label: 'Human Approval Verified',
      severity: 'required',
      passCondition: 'Approval state satisfies the action policy or the action is allowlisted as support-safe.',
      rejectionCode: 'approval_required',
    },
    {
      id: 'idempotency',
      label: 'Idempotency Verified',
      severity: 'critical',
      passCondition: 'Idempotency key has not already completed with a conflicting payload.',
      rejectionCode: 'idempotency_conflict',
    },
    {
      id: 'audit_opened',
      label: 'Audit Opened',
      severity: 'critical',
      passCondition: 'Server writes a started audit event before mutation.',
      rejectionCode: 'audit_start_failed',
    },
    {
      id: 'write_target_allowlisted',
      label: 'Write Target Allowlisted',
      severity: 'critical',
      passCondition: `${input.writeTarget} is allowlisted for this handler only.`,
      rejectionCode: 'write_target_not_allowlisted',
    },
    {
      id: 'rollback_capture',
      label: 'Rollback Captured',
      severity: 'required',
      passCondition: 'Previous state or explicit rollback note is captured before mutation.',
      rejectionCode: 'rollback_missing',
    },
  ]
}

const trustedServerAdapterResponseStates: TrustedServerAdapterResponseState[] = [
  {
    status: 'accepted',
    label: 'Accepted',
    meaning: 'Server accepted the packet and queued or started execution.',
    mutationApplied: false,
  },
  {
    status: 'dry_run_passed',
    label: 'Dry Run Passed',
    meaning: 'Server validated the packet and returned a preview without changing production state.',
    mutationApplied: false,
  },
  {
    status: 'dry_run_blocked',
    label: 'Dry Run Blocked',
    meaning: 'Server found a preflight or domain blocker during dry run.',
    mutationApplied: false,
  },
  {
    status: 'completed',
    label: 'Completed',
    meaning: 'Server completed an allowlisted mutation and wrote completion audit evidence.',
    mutationApplied: true,
  },
  {
    status: 'blocked',
    label: 'Blocked',
    meaning: 'Server stopped execution after a domain, rollback, or provider check failed.',
    mutationApplied: false,
  },
  {
    status: 'rejected',
    label: 'Rejected',
    meaning: 'Server rejected the packet before execution because authorization or envelope validation failed.',
    mutationApplied: false,
  },
]
