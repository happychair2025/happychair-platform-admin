import type { AdminSession } from '../../App'
import { appendAuditEvent, type AuditEvent, type AuditSeverity } from '../audit/auditLog'
import { hasPermission, roleLabels, type PermissionKey } from '../permissions/permissions'

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

export const adminActionConnectionRule =
  'Production admin actions must run through server-side permission checks, write immutable audit logs, and never mutate customer state directly from the browser.'

export function runAdminAction(session: AdminSession, input: AdminActionInput): AdminActionResult {
  const actorRole = roleLabels[session.role]
  const allowed = hasPermission(session.role, input.permission)

  if (!allowed) {
    const auditEvent = appendAuditEvent({
      actor: session.name,
      actorRole,
      scope: input.scope,
      actionKey: input.blockedActionKey ?? 'admin_action.blocked.mock',
      actionLabel: `Blocked ${input.actionLabel}`,
      severity: 'critical',
    })

    return {
      ok: false,
      message: `Blocked. ${actorRole} does not have ${input.permission}.`,
      auditEvent,
    }
  }

  const auditEvent = appendAuditEvent({
    actor: session.name,
    actorRole,
    scope: input.scope,
    actionKey: input.actionKey,
    actionLabel: input.actionLabel,
    severity: input.severity ?? 'notice',
  })

  return {
    ok: true,
    message: 'Action recorded in the local audit trail.',
    auditEvent,
  }
}
