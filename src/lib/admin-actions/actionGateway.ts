import type { AdminSession } from '../../App'
import { appendAuditEvent, type AuditEvent, type AuditSeverity } from '../audit/auditLog'
import { hasPermission, roleLabels, type PermissionKey } from '../permissions/permissions'
import {
  createAdminActionRequestId,
  getRequestedBy,
  getServerActionHandlerPlaceholder,
  saveAdminActionRequest,
  type AdminActionRequest,
  type AdminActionRequestStatus,
  type AdminActionRequestType,
  type AdminActionScope,
} from './actionRequests'

export interface AdminActionInput {
  permission: PermissionKey
  scope: string
  actionKey: string
  actionLabel: string
  severity?: AuditSeverity
  metadata?: Record<string, unknown>
  blockedActionKey?: string
}

export interface AdminActionResult {
  ok: boolean
  message: string
  auditEvent: AuditEvent
}

export interface QueueAdminActionRequestInput {
  actionType: AdminActionRequestType
  title: string
  permission: PermissionKey
  scope: AdminActionScope
  reason: string
  rollbackNotes?: string
  status?: AdminActionRequestStatus
  severity?: AuditSeverity
  metadata?: Record<string, unknown>
  auditActionKey?: string
  auditActionLabel?: string
  blockedActionKey?: string
  handlerKey?: string
  handlerLabel?: string
  handlerDescription?: string
}

export interface QueueAdminActionRequestResult extends AdminActionResult {
  request: AdminActionRequest
}

export const adminActionConnectionRule =
  'Production admin actions must run through server-side permission checks, write immutable audit logs, and never mutate customer state directly from the browser.'

export function runAdminAction(session: AdminSession, input: AdminActionInput): AdminActionResult {
  const actorRole = roleLabels[session.role]
  const allowed = hasPermission(session.role, input.permission)

  if (!allowed) {
    const auditEvent = appendAuditEvent({
      actor: session.name,
      actorEmail: session.email,
      actorRole,
      scope: input.scope,
      actionKey: input.blockedActionKey ?? 'admin_action.blocked.mock',
      actionLabel: `Blocked ${input.actionLabel}`,
      severity: 'critical',
      permission: input.permission,
      outcome: 'blocked',
      metadata: {
        ...input.metadata,
        requiredPermission: input.permission,
        blockedReason: 'role_permission_denied',
        productionWritePath: 'server_action_required',
      },
    })

    return {
      ok: false,
      message: `Blocked. ${actorRole} does not have ${input.permission}.`,
      auditEvent,
    }
  }

  const auditEvent = appendAuditEvent({
    actor: session.name,
    actorEmail: session.email,
    actorRole,
    scope: input.scope,
    actionKey: input.actionKey,
    actionLabel: input.actionLabel,
    severity: input.severity ?? 'notice',
    permission: input.permission,
    outcome: 'allowed',
    metadata: {
      ...input.metadata,
      requiredPermission: input.permission,
      productionWritePath: 'server_action_required',
    },
  })

  return {
    ok: true,
    message: 'Action recorded in the audit action ledger.',
    auditEvent,
  }
}

export function queueAdminActionRequest(
  session: AdminSession,
  input: QueueAdminActionRequestInput,
): QueueAdminActionRequestResult {
  const handler = getServerActionHandlerPlaceholder(input.actionType, {
    key: input.handlerKey,
    label: input.handlerLabel,
    description: input.handlerDescription,
  })
  const result = runAdminAction(session, {
    permission: input.permission,
    scope: input.scope.label,
    actionKey: input.auditActionKey ?? `admin_action_request.${input.actionType}.queued.mock`,
    actionLabel: input.auditActionLabel ?? `Queued server action request: ${input.title}`,
    severity: input.severity ?? 'warning',
    blockedActionKey: input.blockedActionKey ?? `admin_action_request.${input.actionType}.blocked.mock`,
    metadata: {
      ...input.metadata,
      actionRequestType: input.actionType,
      serverHandlerKey: handler.key,
      serverHandlerStatus: handler.status,
      scope: input.scope,
      rollbackNotes: input.rollbackNotes,
    },
  })

  const request: AdminActionRequest = {
    id: createAdminActionRequestId(input.actionType),
    actionType: input.actionType,
    title: input.title,
    requestedBy: getRequestedBy(session, roleLabels[session.role]),
    permissionRequired: input.permission,
    scope: input.scope,
    status: result.ok ? input.status ?? 'Queued' : 'Blocked',
    reason: input.reason,
    auditEventId: result.auditEvent.id,
    rollbackNotes: input.rollbackNotes ?? 'Server-side handler must capture rollback notes before production execution.',
    serverHandler: handler,
    statusReason: result.ok ? undefined : 'role_permission_denied',
    metadata: {
      ...input.metadata,
      auditOutcome: result.auditEvent.outcome,
    },
    createdAt: new Date().toISOString(),
  }

  const savedRequest = saveAdminActionRequest(request)

  return {
    ...result,
    message: result.ok ? `Action request queued: ${input.title}.` : result.message,
    request: savedRequest,
  }
}
