import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { InternalAdminUser } from '../mock-data/mockPlatform'
import type { PlatformReadViewDiagnostic } from '../platform-data/PlatformDataContext'
import type { AdminRole } from '../permissions/permissions'
import type { InternalAccessChange } from './internalAccess'

export type InternalAuthReadinessStatus = 'Ready For Auth Wiring' | 'Needs Review' | 'Blocked'
export type InternalAuthCheckStatus = 'Pass' | 'Watch' | 'Fail'
export type InternalAuthCheckArea = 'Roster' | 'Permissions' | 'Read Views' | 'Server Actions' | 'Audit'

export interface InternalAuthReadinessCheck {
  id: string
  area: InternalAuthCheckArea
  label: string
  status: InternalAuthCheckStatus
  owner: string
  detail: string
}

export interface InternalAuthHandoffStep {
  id: string
  phase: string
  owner: string
  status: InternalAuthCheckStatus
  nextStep: string
}

export interface InternalAuthReadinessModel {
  status: InternalAuthReadinessStatus
  score: number
  checks: InternalAuthReadinessCheck[]
  handoffSteps: InternalAuthHandoffStep[]
  blockers: string[]
  warningCount: number
  passCount: number
}

const requiredRoles: AdminRole[] = ['owner', 'admin', 'support_lead', 'engineering', 'read_only']
const elevatedRoles = new Set<AdminRole>(['owner', 'admin'])

export function buildInternalAuthReadiness(input: {
  users: InternalAdminUser[]
  accessChanges: InternalAccessChange[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  adminActionRequests: AdminActionRequest[]
}): InternalAuthReadinessModel {
  const checks = buildChecks(input)
  const blockers = checks.filter(check => check.status === 'Fail').map(check => check.detail)
  const warningCount = checks.filter(check => check.status === 'Watch').length
  const passCount = checks.filter(check => check.status === 'Pass').length
  const score = Math.round((passCount / Math.max(1, checks.length)) * 100)
  const status: InternalAuthReadinessStatus = blockers.length
    ? 'Blocked'
    : warningCount
      ? 'Needs Review'
      : 'Ready For Auth Wiring'

  return {
    status,
    score,
    checks,
    handoffSteps: buildHandoffSteps(status, input),
    blockers,
    warningCount,
    passCount,
  }
}

export function getInternalAuthReadinessTone(status: InternalAuthReadinessStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Ready For Auth Wiring') return 'ok'
  if (status === 'Blocked') return 'danger'
  return 'warn'
}

export function getInternalAuthCheckTone(status: InternalAuthCheckStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Pass') return 'ok'
  if (status === 'Fail') return 'danger'
  return 'warn'
}

function buildChecks(input: {
  users: InternalAdminUser[]
  accessChanges: InternalAccessChange[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  adminActionRequests: AdminActionRequest[]
}): InternalAuthReadinessCheck[] {
  const activeUsers = input.users.filter(user => user.status === 'Active')
  const invitedUsers = input.users.filter(user => user.status === 'Invited')
  const disabledUsers = input.users.filter(user => user.status === 'Disabled')
  const activeOwners = activeUsers.filter(user => user.role === 'owner')
  const activeAdmins = activeUsers.filter(user => user.role === 'admin')
  const duplicateEmails = getDuplicateEmails(input.users)
  const missingRoles = requiredRoles.filter(role => !input.users.some(user => user.role === role))
  const elevatedActiveCount = activeUsers.filter(user => elevatedRoles.has(user.role as AdminRole)).length
  const internalAdminReadView = input.readViewDiagnostics.find(view => view.key === 'internalAdminUsers')
  const adminUserRequests = input.adminActionRequests.filter(request => request.actionType === 'admin_user_change')
  const blockedAccessChanges = input.accessChanges.filter(change => change.status === 'Blocked')

  return [
    {
      id: 'active_owner',
      area: 'Roster',
      label: 'Active owner exists',
      status: activeOwners.length ? 'Pass' : 'Fail',
      owner: 'Owner',
      detail: activeOwners.length
        ? `${activeOwners.length} active owner record${activeOwners.length === 1 ? '' : 's'} available for internal auth bootstrap.`
        : 'No active owner record exists. Real internal auth cannot launch without an owner bootstrap account.',
    },
    {
      id: 'active_admin',
      area: 'Roster',
      label: 'Admin backup exists',
      status: activeAdmins.length ? 'Pass' : 'Watch',
      owner: 'Owner',
      detail: activeAdmins.length
        ? `${activeAdmins.length} active admin backup${activeAdmins.length === 1 ? '' : 's'} available.`
        : 'No active admin backup exists. Owner access would be a single point of operational failure.',
    },
    {
      id: 'duplicate_emails',
      area: 'Roster',
      label: 'Unique emails',
      status: duplicateEmails.length ? 'Fail' : 'Pass',
      owner: 'Engineering',
      detail: duplicateEmails.length
        ? `Duplicate internal emails found: ${duplicateEmails.join(', ')}.`
        : 'Every internal admin email is unique after local roster overlays are applied.',
    },
    {
      id: 'required_roles',
      area: 'Permissions',
      label: 'Required roles represented',
      status: missingRoles.length ? 'Watch' : 'Pass',
      owner: 'Owner',
      detail: missingRoles.length
        ? `Missing test users for: ${missingRoles.join(', ')}. Add before final permission QA.`
        : 'Owner, admin, support lead, engineering, and read-only roles are represented for permission QA.',
    },
    {
      id: 'elevated_access',
      area: 'Permissions',
      label: 'Elevated access bounded',
      status: elevatedActiveCount > 3 ? 'Watch' : 'Pass',
      owner: 'Owner',
      detail: elevatedActiveCount > 3
        ? `${elevatedActiveCount} active owner/admin users exist. Review least-privilege before auth cutover.`
        : `${elevatedActiveCount} active owner/admin users keeps elevated access bounded for the preview roster.`,
    },
    {
      id: 'invites_reviewed',
      area: 'Audit',
      label: 'Invites have evidence',
      status: invitedUsers.length && !input.accessChanges.some(change => change.changeType === 'invite') ? 'Watch' : 'Pass',
      owner: 'Admin',
      detail: invitedUsers.length
        ? `${invitedUsers.length} pending invite${invitedUsers.length === 1 ? '' : 's'} visible; invite changes should be queued before production onboarding.`
        : 'No pending invites are waiting for production onboarding.',
    },
    {
      id: 'disabled_blocking',
      area: 'Roster',
      label: 'Disabled users blocked',
      status: 'Pass',
      owner: 'Engineering',
      detail: disabledUsers.length
        ? `${disabledUsers.length} disabled user${disabledUsers.length === 1 ? ' is' : 's are'} blocked from entering the managed access preview.`
        : 'No disabled internal users are currently in the managed roster.',
    },
    {
      id: 'read_view_contract',
      area: 'Read Views',
      label: 'Internal admin read view',
      status: internalAdminReadView?.status === 'ready' ? 'Pass' : internalAdminReadView?.status === 'fallback' ? 'Fail' : 'Watch',
      owner: 'Engineering',
      detail: internalAdminReadView
        ? `${internalAdminReadView.viewName} is ${internalAdminReadView.status} with ${internalAdminReadView.records} record${internalAdminReadView.records === 1 ? '' : 's'}.`
        : 'Internal admin read-view diagnostic is missing.',
    },
    {
      id: 'server_action_contract',
      area: 'Server Actions',
      label: 'Admin-user action handler',
      status: adminUserRequests.length ? 'Pass' : 'Watch',
      owner: 'Engineering',
      detail: adminUserRequests.length
        ? `${adminUserRequests.length} internal admin-user action request${adminUserRequests.length === 1 ? '' : 's'} recorded against the server-action boundary.`
        : 'No internal admin-user action requests exist yet. Queue an invite or role change to test the handler path.',
    },
    {
      id: 'blocked_changes',
      area: 'Audit',
      label: 'Blocked access attempts visible',
      status: blockedAccessChanges.length ? 'Watch' : 'Pass',
      owner: 'Admin',
      detail: blockedAccessChanges.length
        ? `${blockedAccessChanges.length} blocked access change${blockedAccessChanges.length === 1 ? '' : 's'} recorded. Review before auth cutover.`
        : 'No blocked internal access changes are unresolved in the local ledger.',
    },
  ]
}

function buildHandoffSteps(
  status: InternalAuthReadinessStatus,
  input: {
    users: InternalAdminUser[]
    accessChanges: InternalAccessChange[]
    readViewDiagnostics: PlatformReadViewDiagnostic[]
    adminActionRequests: AdminActionRequest[]
  },
): InternalAuthHandoffStep[] {
  const internalAdminReadView = input.readViewDiagnostics.find(view => view.key === 'internalAdminUsers')
  const hasAdminUserRequest = input.adminActionRequests.some(request => request.actionType === 'admin_user_change')
  const hasAccessEvidence = input.accessChanges.length > 0

  return [
    {
      id: 'preview_roster',
      phase: 'Preview roster',
      owner: 'Owner',
      status: input.users.some(user => user.status === 'Active' && user.role === 'owner') ? 'Pass' : 'Fail',
      nextStep: 'Confirm owner, admin, support, engineering, and read-only users before production auth mapping.',
    },
    {
      id: 'read_view_contract',
      phase: 'Read-view contract',
      owner: 'Engineering',
      status: internalAdminReadView?.status === 'ready' ? 'Pass' : 'Watch',
      nextStep: 'Verify platform_admin_internal_admin_users_read against the reviewed internal admin table.',
    },
    {
      id: 'server_handler',
      phase: 'Server handler',
      owner: 'Engineering',
      status: hasAdminUserRequest ? 'Pass' : 'Watch',
      nextStep: 'Wire admin_user_change requests to a server-side handler with audit and rollback metadata.',
    },
    {
      id: 'audit_evidence',
      phase: 'Audit evidence',
      owner: 'Admin',
      status: hasAccessEvidence ? 'Pass' : 'Watch',
      nextStep: 'Record an access review and queue at least one non-production invite or role-change request.',
    },
    {
      id: 'auth_cutover',
      phase: 'Auth cutover',
      owner: 'Owner / Engineering',
      status: status === 'Ready For Auth Wiring' ? 'Pass' : 'Watch',
      nextStep: 'Replace preview login only after auth provider, read views, permissions, and server action gates are verified.',
    },
  ]
}

function getDuplicateEmails(users: InternalAdminUser[]) {
  const counts = new Map<string, number>()
  users.forEach(user => counts.set(user.email.toLowerCase(), (counts.get(user.email.toLowerCase()) ?? 0) + 1))
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([email]) => email)
}
