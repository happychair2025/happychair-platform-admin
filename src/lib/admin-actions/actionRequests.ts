import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { PermissionKey } from '../permissions/permissions'
import { createLedgerPersistencePlan } from '../platform-ledger/durableLedger'

export type AdminActionRequestType =
  | 'module_activation_change'
  | 'remediation_server_action'
  | 'support_troubleshooting_action'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'admin_user_change'
  | 'feature_flag_change'
  | 'billing_review_action'
  | 'agent_recommended_action'

export type AdminActionRequestStatus =
  | 'Draft'
  | 'Queued'
  | 'Approved'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Blocked'

export type AdminActionRequestPersistenceStatus = 'local_durable' | 'server_recorded' | 'server_pending'
export type AdminActionRequestPersistenceTarget = 'local_storage' | 'platform_admin.admin_action_requests'

export interface AdminActionScope {
  clientId?: string
  clientName?: string
  organizationId?: string
  organizationName?: string
  propertyId?: string
  propertyName?: string
  venueId?: string
  venueName?: string
  label: string
}

export interface AdminActionRequestedBy {
  name: string
  email?: string
  role: string
}

export interface ServerActionHandlerPlaceholder {
  key: string
  label: string
  description: string
  status: 'placeholder_only'
}

export interface AdminActionRequest {
  id: string
  actionType: AdminActionRequestType
  title: string
  requestedBy: AdminActionRequestedBy
  permissionRequired: PermissionKey
  scope: AdminActionScope
  status: AdminActionRequestStatus
  reason: string
  auditEventId: string
  rollbackNotes: string
  serverHandler: ServerActionHandlerPlaceholder
  statusReason?: string
  transitionAuditEventId?: string
  metadata?: Record<string, unknown>
  persistenceStatus?: AdminActionRequestPersistenceStatus
  persistenceTarget?: AdminActionRequestPersistenceTarget
  createdAt: string
  updatedAt?: string
}

export interface AdminActionRequestStatusPatch {
  statusReason?: string
  transitionAuditEventId?: string
  metadata?: Record<string, unknown>
}

const storageKey = 'hc_platform_admin_action_requests'
const listeners = new Set<() => void>()
let cachedRawRequests = ''
let cachedRequests: AdminActionRequest[] = []

export const actionRequestStatusOrder: AdminActionRequestStatus[] = [
  'Draft',
  'Queued',
  'Approved',
  'Running',
  'Completed',
  'Failed',
  'Blocked',
]

export const actionTypeLabels: Record<AdminActionRequestType, string> = {
  module_activation_change: 'Module Enable / Disable',
  remediation_server_action: 'Remediation Server Action',
  support_troubleshooting_action: 'Support Troubleshooting Action',
  impersonation_start: 'Impersonation Start',
  impersonation_end: 'Impersonation End',
  admin_user_change: 'Internal Admin User Change',
  feature_flag_change: 'Feature Flag Change',
  billing_review_action: 'Billing Review Action',
  agent_recommended_action: 'Agent-Recommended Action',
}

export const adminActionRequestConnectionRule =
  'Admin Action Requests are the only browser-facing bridge for future production mutations. Real execution must happen in server-side handlers after permission checks, audit writes, human approval where required, and rollback metadata capture.'

export const serverActionHandlerPlaceholders: Record<AdminActionRequestType, ServerActionHandlerPlaceholder> = {
  module_activation_change: {
    key: 'server.modules.activation_change',
    label: 'Module activation handler',
    description: 'Placeholder for dependency checks, entitlement writes, audit entry, and activation rollback capture.',
    status: 'placeholder_only',
  },
  remediation_server_action: {
    key: 'server.support.remediation_action',
    label: 'Remediation handler',
    description: 'Placeholder for scoped queue repair, module setup repair, and support-safe remediation execution.',
    status: 'placeholder_only',
  },
  support_troubleshooting_action: {
    key: 'server.support.troubleshooting_lifecycle',
    label: 'Support lifecycle handler',
    description: 'Placeholder for support issue status updates, escalation records, and visible activity entries.',
    status: 'placeholder_only',
  },
  impersonation_start: {
    key: 'server.impersonation.start',
    label: 'Impersonation start handler',
    description: 'Placeholder for secure view-as session creation with expiry, scope, permission, and audit controls.',
    status: 'placeholder_only',
  },
  impersonation_end: {
    key: 'server.impersonation.end',
    label: 'Impersonation end handler',
    description: 'Placeholder for secure view-as session shutdown, expiry handling, and audit finalization.',
    status: 'placeholder_only',
  },
  admin_user_change: {
    key: 'server.internal_access.admin_user_change',
    label: 'Internal admin user handler',
    description: 'Placeholder for internal invite, role assignment, suspension, reactivation, permission review, and audit recording.',
    status: 'placeholder_only',
  },
  feature_flag_change: {
    key: 'server.feature_flags.change',
    label: 'Feature flag handler',
    description: 'Placeholder for rollout validation, blast-radius checks, audit writes, and rollback notes.',
    status: 'placeholder_only',
  },
  billing_review_action: {
    key: 'server.billing.review_action',
    label: 'Billing review handler',
    description: 'Placeholder for finance-owned provider review, credit/refund/discount gates, and audit recording.',
    status: 'placeholder_only',
  },
  agent_recommended_action: {
    key: 'server.agents.approved_recommendation',
    label: 'Agent approval handler',
    description: 'Placeholder for human-approved agent recommendations that may later change client state.',
    status: 'placeholder_only',
  },
}

export function getLocalAdminActionRequests(): AdminActionRequest[] {
  if (typeof localStorage === 'undefined') return []
  const rawRequests = localStorage.getItem(storageKey) ?? '[]'
  if (rawRequests === cachedRawRequests) return cachedRequests

  try {
    cachedRawRequests = rawRequests
    cachedRequests = JSON.parse(rawRequests) as AdminActionRequest[]
    return cachedRequests
  } catch {
    cachedRawRequests = rawRequests
    cachedRequests = []
    return []
  }
}

export function saveAdminActionRequest(request: AdminActionRequest) {
  const nextRequest = withLocalPersistence(request)
  const existing = getLocalAdminActionRequests()
  const requests = [
    nextRequest,
    ...existing.filter(item => item.id !== nextRequest.id),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 80)

  cachedRequests = requests
  cachedRawRequests = JSON.stringify(requests)
  localStorage.setItem(storageKey, cachedRawRequests)
  emitAdminActionRequestChange()
  return nextRequest
}

export function updateAdminActionRequestStatus(
  request: AdminActionRequest,
  status: AdminActionRequestStatus,
  patch: AdminActionRequestStatusPatch = {},
) {
  const persistence = getActionRequestPersistencePatch(request.persistenceStatus)

  return saveAdminActionRequest({
    ...request,
    status,
    statusReason: patch.statusReason ?? request.statusReason,
    transitionAuditEventId: patch.transitionAuditEventId ?? request.transitionAuditEventId,
    persistenceStatus: persistence.persistenceStatus,
    persistenceTarget: persistence.persistenceTarget,
    metadata: {
      ...request.metadata,
      ...patch.metadata,
      ledgerEndpointLabel: persistence.endpointLabel,
      ledgerSyncRequired: persistence.syncRequired,
    },
    updatedAt: new Date().toISOString(),
  })
}

export function subscribeToAdminActionRequests(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLocalAdminActionRequests() {
  return useSyncExternalStore(subscribeToAdminActionRequests, getLocalAdminActionRequests, () => [])
}

export function createAdminActionRequestId(actionType: AdminActionRequestType) {
  return `${actionType}-${crypto.randomUUID()}`
}

export function createAdminActionScope(scope: Omit<AdminActionScope, 'label'> & { label?: string }): AdminActionScope {
  return {
    ...scope,
    label: scope.label
      ?? scope.venueName
      ?? scope.propertyName
      ?? scope.organizationName
      ?? scope.clientName
      ?? 'Platform',
  }
}

export function getServerActionHandlerPlaceholder(
  actionType: AdminActionRequestType,
  override: Partial<Omit<ServerActionHandlerPlaceholder, 'status'>> = {},
): ServerActionHandlerPlaceholder {
  const base = serverActionHandlerPlaceholders[actionType]
  return {
    key: override.key ?? base.key,
    label: override.label ?? base.label,
    description: override.description ?? base.description,
    status: 'placeholder_only',
  }
}

export function getRequestedBy(session: AdminSession, roleLabel: string): AdminActionRequestedBy {
  return {
    name: session.name,
    email: session.email,
    role: roleLabel,
  }
}

export function formatAdminActionType(actionType: AdminActionRequestType) {
  return actionTypeLabels[actionType]
}

function withLocalPersistence(request: AdminActionRequest): AdminActionRequest {
  const persistence = getActionRequestPersistencePatch(request.persistenceStatus)
  return {
    ...request,
    updatedAt: new Date().toISOString(),
    persistenceStatus: request.persistenceStatus ?? persistence.persistenceStatus,
    persistenceTarget: request.persistenceTarget ?? persistence.persistenceTarget,
    metadata: {
      ...request.metadata,
      ledgerEndpointLabel: request.metadata?.ledgerEndpointLabel ?? persistence.endpointLabel,
      ledgerSyncRequired: request.metadata?.ledgerSyncRequired ?? persistence.syncRequired,
    },
  }
}

function getActionRequestPersistencePatch(currentStatus?: AdminActionRequestPersistenceStatus) {
  if (currentStatus === 'server_recorded') {
    return {
      persistenceStatus: 'server_recorded' as const,
      persistenceTarget: 'platform_admin.admin_action_requests' as const,
      syncRequired: false,
      endpointLabel: 'Read-only server record',
    }
  }

  return createLedgerPersistencePlan('platform_admin.admin_action_requests')
}

function emitAdminActionRequestChange() {
  listeners.forEach(listener => listener())
}
