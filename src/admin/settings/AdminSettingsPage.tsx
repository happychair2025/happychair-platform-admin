import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Database,
  KeyRound,
  ListChecks,
  LockKeyhole,
  MailPlus,
  PauseCircle,
  RotateCcw,
  Save,
  ServerCog,
  ShieldCheck,
  UserCheck,
  UserCog,
  UsersRound,
  UserX,
} from 'lucide-react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import {
  buildInternalAuthReadiness,
  getInternalAuthCheckTone,
  getInternalAuthReadinessTone,
} from '../../lib/admin-users/internalAuthReadiness'
import {
  buildInternalAuthAdapterStatus,
  getInternalAuthConfig,
  internalAuthAdapterRule,
  type InternalAuthGuardrailStatus,
} from '../../lib/admin-users/internalAuthAdapter'
import {
  createInternalAdminInvite,
  getRoleRisk,
  isInternalAdminEmailAvailable,
  saveInternalAccessChange,
  saveInternalAdminUser,
  useInternalAccessChanges,
  useManagedInternalAdminUsers,
} from '../../lib/admin-users/internalAccess'
import { usePlatformData, type PlatformReadViewStatus } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission, roleLabels, rolePermissions, type AdminRole, type PermissionKey } from '../../lib/permissions/permissions'

interface AdminSettingsPageProps {
  session: AdminSession
}

const roleOrder: AdminRole[] = ['owner', 'admin', 'support_lead', 'support_agent', 'client_success', 'finance', 'marketing', 'engineering', 'read_only']

const permissionGroups: Array<{ label: string; permissions: PermissionKey[] }> = [
  { label: 'Command', permissions: ['dashboard.view', 'registrations.view', 'revenue.view', 'revenue.manage'] },
  { label: 'Clients', permissions: ['clients.view', 'clients.manage', 'organizations.view', 'properties.view', 'venues.view'] },
  { label: 'Operations', permissions: ['modules.view', 'modules.manage', 'usage.view', 'health.view', 'support.view', 'support.manage', 'troubleshooting.view', 'troubleshooting.run'] },
  { label: 'Security', permissions: ['impersonation.start', 'impersonation.destructive_actions', 'impersonation.end_any', 'audit.view', 'audit.export'] },
  { label: 'Company', permissions: ['agents.view', 'agents.manage', 'reports.view', 'reports.export', 'billing.view', 'billing.manage', 'feature_flags.view', 'feature_flags.manage', 'admin_users.view', 'admin_users.manage', 'settings.view', 'settings.manage'] },
]

function roleLabel(role: AdminRole) {
  return roleLabels[role]
}

function userStatusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'Disabled') return 'danger'
  if (status === 'Invited') return 'warn'
  return 'ok'
}

function readViewStatusTone(status: PlatformReadViewStatus): 'ok' | 'warn' | 'info' | 'neutral' {
  if (status === 'ready') return 'ok'
  if (status === 'fallback') return 'warn'
  if (status === 'loading') return 'info'
  return 'neutral'
}

function accessStatusTone(status: 'Queued' | 'Recorded' | 'Blocked'): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Queued') return 'warn'
  return 'ok'
}

function authGuardrailTone(status: InternalAuthGuardrailStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'ok'
}

function roleRiskTone(role: AdminRole): 'ok' | 'warn' | 'danger' | 'neutral' {
  const risk = getRoleRisk(role)
  if (risk === 'Critical' || risk === 'High') return 'danger'
  if (risk === 'Medium') return 'warn'
  if (risk === 'Low') return 'ok'
  return 'neutral'
}

function formatDateTime(value: string) {
  if (value === 'Pending') return 'Pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function AdminSettingsPage({ session }: AdminSettingsPageProps) {
  const { data, dataSourceKind, sourceLabel, status, error, readViewDiagnostics } = usePlatformData()
  const managedAdminUsers = useManagedInternalAdminUsers(data.internalAdminUsers)
  const accessChanges = useInternalAccessChanges()
  const localActionRequests = useLocalAdminActionRequests()
  const authConfig = getInternalAuthConfig(import.meta.env)
  const authAdapterStatus = buildInternalAuthAdapterStatus(authConfig, managedAdminUsers)
  const canManage = hasPermission(session.role, 'settings.manage')
  const canViewUsers = hasPermission(session.role, 'admin_users.view')
  const canManageUsers = hasPermission(session.role, 'admin_users.manage')
  const activeAdmins = managedAdminUsers.filter(user => user.status === 'Active')
  const invitedAdmins = managedAdminUsers.filter(user => user.status === 'Invited')
  const disabledAdmins = managedAdminUsers.filter(user => user.status === 'Disabled')
  const elevatedAdmins = managedAdminUsers.filter(user => user.status === 'Active' && (user.role === 'owner' || user.role === 'admin'))
  const readyViews = readViewDiagnostics.filter(view => view.status === 'ready').length
  const fallbackViews = readViewDiagnostics.filter(view => view.status === 'fallback').length
  const mockViews = readViewDiagnostics.filter(view => view.status === 'mock').length
  const adminActionRequests = useMemo(() => {
    return [
      ...localActionRequests,
      ...data.adminActionRequests.filter(request => !localActionRequests.some(localRequest => localRequest.id === request.id)),
    ]
  }, [data.adminActionRequests, localActionRequests])
  const authReadiness = useMemo(() => buildInternalAuthReadiness({
    users: managedAdminUsers,
    accessChanges,
    readViewDiagnostics,
    adminActionRequests,
  }), [accessChanges, adminActionRequests, managedAdminUsers, readViewDiagnostics])
  const authActionRequestCount = adminActionRequests.filter(request => request.actionType === 'admin_user_change').length
  const authAdapterBlockedCount = authAdapterStatus.guardrails.filter(guardrail => guardrail.status === 'Blocked').length
  const [selectedUserId, setSelectedUserId] = useState(managedAdminUsers[0]?.id ?? '')
  const selectedUser = useMemo(
    () => managedAdminUsers.find(user => user.id === selectedUserId) ?? managedAdminUsers[0],
    [managedAdminUsers, selectedUserId],
  )
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AdminRole>('read_only')
  const [inviteReason, setInviteReason] = useState('Grant scoped internal Platform Admin access.')
  const [targetRole, setTargetRole] = useState<AdminRole>(selectedUser?.role ?? 'read_only')
  const [changeReason, setChangeReason] = useState('Access change reviewed for internal operating needs.')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!selectedUser && managedAdminUsers.length) {
      setSelectedUserId(managedAdminUsers[0].id)
    }
  }, [managedAdminUsers, selectedUser])

  useEffect(() => {
    if (selectedUser) {
      setTargetRole(selectedUser.role)
    }
  }, [selectedUser?.id])

  const auditSettingsReview = (action: string) => {
    runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Admin Settings',
      actionKey: `settings.${action}.mock`,
      actionLabel: `${action.replace(/_/g, ' ')} reviewed`,
      severity: 'notice',
    })
  }

  const recordAccessReview = () => {
    const result = runAdminAction(session, {
      permission: 'admin_users.view',
      scope: 'Internal Access',
      actionKey: 'internal_access.reviewed.mock',
      actionLabel: 'Reviewed internal access roster',
      severity: elevatedAdmins.length > 2 ? 'warning' : 'notice',
      metadata: {
        activeAdmins: activeAdmins.length,
        invitedAdmins: invitedAdmins.length,
        disabledAdmins: disabledAdmins.length,
        elevatedAdmins: elevatedAdmins.length,
        sourceLabel,
      },
    })
    saveInternalAccessChange({
      changeType: 'access_review',
      userId: session.adminUserId ?? 'session-user',
      userName: session.name,
      userEmail: session.email,
      requestedBy: session.name,
      requestedByEmail: session.email,
      reason: 'Internal access roster review recorded from Admin Settings.',
      status: result.ok ? 'Recorded' : 'Blocked',
      auditEventId: result.auditEvent.id,
    })
    setNotice(result.ok ? 'Internal access review recorded in Audit Logs.' : result.message)
  }

  const recordAuthReadinessReview = () => {
    const result = runAdminAction(session, {
      permission: 'admin_users.view',
      scope: 'Internal Auth Readiness',
      actionKey: 'internal_auth.readiness.reviewed.mock',
      actionLabel: 'Reviewed internal auth readiness',
      severity: authReadiness.status === 'Blocked' ? 'critical' : authReadiness.status === 'Needs Review' ? 'warning' : 'notice',
      metadata: {
        authReadinessStatus: authReadiness.status,
        authReadinessScore: authReadiness.score,
        blockers: authReadiness.blockers,
        warningCount: authReadiness.warningCount,
        passCount: authReadiness.passCount,
        adminUserActionRequests: authActionRequestCount,
        sourceLabel,
      },
    })
    saveInternalAccessChange({
      changeType: 'access_review',
      userId: session.adminUserId ?? 'session-user',
      userName: session.name,
      userEmail: session.email,
      requestedBy: session.name,
      requestedByEmail: session.email,
      reason: `Internal auth readiness reviewed: ${authReadiness.status} at ${authReadiness.score}%.`,
      status: result.ok ? 'Recorded' : 'Blocked',
      auditEventId: result.auditEvent.id,
    })
    setNotice(result.ok ? `Internal auth readiness recorded: ${authReadiness.status}.` : result.message)
  }

  const inviteInternalAdmin = () => {
    const trimmedName = inviteName.trim()
    const trimmedEmail = inviteEmail.trim()
    if (!trimmedName || !trimmedEmail) {
      setNotice('Add a name and email before inviting an internal admin.')
      return
    }
    if (!isInternalAdminEmailAvailable(managedAdminUsers, trimmedEmail)) {
      setNotice('That internal admin email already exists.')
      return
    }

    const nextUser = createInternalAdminInvite({ name: trimmedName, email: trimmedEmail, role: inviteRole })
    const result = queueAdminActionRequest(session, {
      actionType: 'admin_user_change',
      title: `Invite internal admin: ${nextUser.name}`,
      permission: 'admin_users.manage',
      scope: createAdminActionScope({ label: `Internal Access / ${nextUser.email}` }),
      reason: inviteReason.trim() || 'Internal admin invite requested.',
      rollbackNotes: 'Revoke the invite, expire any invite token, and keep the audit trail if onboarding is not approved.',
      status: 'Queued',
      severity: getRoleRisk(inviteRole) === 'Critical' || getRoleRisk(inviteRole) === 'High' ? 'warning' : 'notice',
      metadata: {
        changeType: 'invite',
        userId: nextUser.id,
        userEmail: nextUser.email,
        nextRole: inviteRole,
        nextStatus: nextUser.status,
        roleRisk: getRoleRisk(inviteRole),
      },
    })

    if (result.ok) {
      saveInternalAdminUser(nextUser)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('read_only')
      setSelectedUserId(nextUser.id)
    }

    saveInternalAccessChange({
      changeType: 'invite',
      userId: nextUser.id,
      userName: nextUser.name,
      userEmail: nextUser.email,
      nextRole: inviteRole,
      nextStatus: nextUser.status,
      requestedBy: session.name,
      requestedByEmail: session.email,
      reason: inviteReason.trim() || 'Internal admin invite requested.',
      status: result.ok ? 'Queued' : 'Blocked',
      auditEventId: result.auditEvent.id,
      actionRequestId: result.request.id,
    })
    setNotice(result.ok ? `${nextUser.name} invite queued and added to the local access roster.` : result.message)
  }

  const queueRoleChange = () => {
    if (!selectedUser) return
    if (selectedUser.role === targetRole) {
      setNotice('Choose a different role before queueing a role change.')
      return
    }
    const nextUser = { ...selectedUser, role: targetRole }
    const result = queueAdminActionRequest(session, {
      actionType: 'admin_user_change',
      title: `Change role for ${selectedUser.name}`,
      permission: 'admin_users.manage',
      scope: createAdminActionScope({ label: `Internal Access / ${selectedUser.email}` }),
      reason: changeReason.trim() || 'Internal admin role change requested.',
      rollbackNotes: `Restore ${selectedUser.name} to ${roleLabels[selectedUser.role]} and preserve the audit trail if the role change is rejected.`,
      status: 'Queued',
      severity: getRoleRisk(targetRole) === 'Critical' || getRoleRisk(targetRole) === 'High' ? 'warning' : 'notice',
      metadata: {
        changeType: 'role_change',
        userId: selectedUser.id,
        userEmail: selectedUser.email,
        previousRole: selectedUser.role,
        nextRole: targetRole,
        roleRisk: getRoleRisk(targetRole),
      },
    })

    if (result.ok) saveInternalAdminUser(nextUser)
    saveInternalAccessChange({
      changeType: 'role_change',
      userId: selectedUser.id,
      userName: selectedUser.name,
      userEmail: selectedUser.email,
      previousRole: selectedUser.role,
      nextRole: targetRole,
      previousStatus: selectedUser.status,
      nextStatus: nextUser.status,
      requestedBy: session.name,
      requestedByEmail: session.email,
      reason: changeReason.trim() || 'Internal admin role change requested.',
      status: result.ok ? 'Queued' : 'Blocked',
      auditEventId: result.auditEvent.id,
      actionRequestId: result.request.id,
    })
    setNotice(result.ok ? `${selectedUser.name} role change queued for server review.` : result.message)
  }

  const queueStatusChange = (nextStatus: 'Active' | 'Disabled') => {
    if (!selectedUser) return
    if (selectedUser.status === nextStatus) {
      setNotice(`${selectedUser.name} is already ${nextStatus.toLowerCase()}.`)
      return
    }
    const nextUser = {
      ...selectedUser,
      status: nextStatus,
      lastLoginAt: nextStatus === 'Active' && selectedUser.lastLoginAt === 'Pending'
        ? new Date().toISOString()
        : selectedUser.lastLoginAt,
    }
    const actionVerb = nextStatus === 'Disabled' ? 'Suspend' : 'Reactivate'
    const result = queueAdminActionRequest(session, {
      actionType: 'admin_user_change',
      title: `${actionVerb} internal admin: ${selectedUser.name}`,
      permission: 'admin_users.manage',
      scope: createAdminActionScope({ label: `Internal Access / ${selectedUser.email}` }),
      reason: changeReason.trim() || `${actionVerb} internal admin requested.`,
      rollbackNotes: `Restore ${selectedUser.name} to ${selectedUser.status} if the access status change is not approved.`,
      status: 'Queued',
      severity: nextStatus === 'Disabled' ? 'warning' : 'notice',
      metadata: {
        changeType: 'status_change',
        userId: selectedUser.id,
        userEmail: selectedUser.email,
        previousStatus: selectedUser.status,
        nextStatus,
      },
    })

    if (result.ok) saveInternalAdminUser(nextUser)
    saveInternalAccessChange({
      changeType: 'status_change',
      userId: selectedUser.id,
      userName: selectedUser.name,
      userEmail: selectedUser.email,
      previousRole: selectedUser.role,
      nextRole: nextUser.role,
      previousStatus: selectedUser.status,
      nextStatus,
      requestedBy: session.name,
      requestedByEmail: session.email,
      reason: changeReason.trim() || `${actionVerb} internal admin requested.`,
      status: result.ok ? 'Queued' : 'Blocked',
      auditEventId: result.auditEvent.id,
      actionRequestId: result.request.id,
    })
    setNotice(result.ok ? `${selectedUser.name} ${actionVerb.toLowerCase()} request queued.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Internal Controls"
        title="Internal Access & Settings"
        description="Internal users, roles, permissions, data-source state, safety checks, and deployment controls for Team Happy Chair."
        action={
          <button className="ghost-action" onClick={canViewUsers ? recordAccessReview : () => auditSettingsReview('settings_access')}>
            <ShieldCheck size={16} strokeWidth={1.8} />
            Record Access Review
          </button>
        }
      />

      <div className="metrics-grid compact">
        <MetricCard label="Admin Users" value={String(managedAdminUsers.length)} delta={`${activeAdmins.length} active`} tone="ok" icon={<UsersRound size={16} />} />
        <MetricCard label="Invites" value={String(invitedAdmins.length)} delta="Pending setup" tone={invitedAdmins.length ? 'warn' : 'ok'} icon={<UserCog size={16} />} />
        <MetricCard label="Elevated Access" value={String(elevatedAdmins.length)} delta={`${disabledAdmins.length} disabled users`} tone={elevatedAdmins.length > 2 ? 'warn' : 'ok'} icon={<LockKeyhole size={16} />} />
        <MetricCard label="Data Source" value={sourceLabel} delta={status === 'fallback' || status === 'partial' ? error ?? 'Fallback active' : 'Provider state'} tone={status === 'fallback' || status === 'partial' ? 'warn' : 'ok'} icon={<Database size={16} />} />
      </div>

      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Auth Readiness" value={authReadiness.status} delta="Internal auth cutover" tone={getInternalAuthReadinessTone(authReadiness.status)} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Readiness Score" value={`${authReadiness.score}%`} delta={`${authReadiness.passCount} checks passing`} tone={getInternalAuthReadinessTone(authReadiness.status)} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Auth Blockers" value={String(authReadiness.blockers.length)} delta={`${authReadiness.warningCount} watch items`} tone={authReadiness.blockers.length ? 'danger' : authReadiness.warningCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Access Requests" value={String(authActionRequestCount)} delta="admin_user_change queue" tone={authActionRequestCount ? 'ok' : 'warn'} icon={<ServerCog size={16} />} />
      </div>

      <section className={`panel action-request-boundary-panel tone-${getInternalAuthReadinessTone(authReadiness.status)}`}>
        <div>
          <p className="eyebrow">Internal Auth Readiness</p>
          <h2>{authReadiness.status}</h2>
          <span>Real auth should only replace the preview login after owner/admin coverage, read views, permission contracts, server-action handlers, and audit evidence are all verified.</span>
        </div>
        <button className="ghost-action" disabled={!canViewUsers} onClick={recordAuthReadinessReview}>
          <ShieldCheck size={16} strokeWidth={1.8} />
          Record Auth Review
        </button>
      </section>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Auth Adapter Contract</p>
          <h2>{authAdapterStatus.providerLabel}</h2>
          <span>{internalAuthAdapterRule}</span>
        </div>
        <div className="status-band-actions">
          <StatusPill label={authAdapterStatus.source} tone={authAdapterStatus.source === 'supabase' ? 'ok' : 'warn'} />
          <StatusPill label={authAdapterBlockedCount ? `${authAdapterBlockedCount} blocked` : 'No blocked guardrails'} tone={authAdapterBlockedCount ? 'danger' : 'ok'} />
        </div>
      </section>

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Session Verification</h2>
              <span>How Platform Admin will verify internal identity</span>
            </div>
            <StatusPill label={authAdapterStatus.source} tone={authAdapterStatus.source === 'supabase' ? 'ok' : 'warn'} />
          </div>
          <dl className="signal-list">
            <div><dt>Provider</dt><dd>{authAdapterStatus.providerLabel}</dd></div>
            <div><dt>Verification</dt><dd>{authAdapterStatus.sessionVerification}</dd></div>
            <div><dt>User Mutations</dt><dd>{authAdapterStatus.userMutationPath}</dd></div>
            <div><dt>Browser Writes</dt><dd>{authAdapterStatus.browserMutationsAllowed ? 'Allowed' : 'Blocked'}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Server Boundary</h2>
              <span>Trusted path required for Admin API operations</span>
            </div>
            <StatusPill label={authAdapterStatus.serverEndpointLabel} tone={authAdapterStatus.serverEndpointLabel.includes('configured') ? 'ok' : 'warn'} />
          </div>
          <div className="settings-rule-list">
            <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Verify sessions before mapping to internal admin roles.</strong></div>
            <div><ServerCog size={16} strokeWidth={1.8} /><strong>Run invites, role changes, and suspensions through trusted server handlers.</strong></div>
            <div><LockKeyhole size={16} strokeWidth={1.8} /><strong>Never expose service-role or secret keys in the browser.</strong></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Auth Provider Handoff</h2>
            <span>Path from managed preview access to real internal auth</span>
          </div>
          <StatusPill label={`${authReadiness.score}% ready`} tone={getInternalAuthReadinessTone(authReadiness.status)} />
        </div>
        <div className="queue-list">
          {authReadiness.handoffSteps.map(step => (
            <div key={step.id}>
              <StatusPill label={step.status} tone={getInternalAuthCheckTone(step.status)} />
              <strong>{step.phase} / {step.owner}</strong>
              <span>{step.nextStep}</span>
            </div>
          ))}
        </div>
      </section>

      {canViewUsers ? (
        <div className="internal-access-layout">
          <section className="panel internal-access-form-panel">
            <div className="panel-header">
              <div>
                <h2>Invite Internal Admin</h2>
                <span>Queue access for human/server approval before production auth setup</span>
              </div>
              <StatusPill label={canManageUsers ? 'Manage Allowed' : 'Read Only'} tone={canManageUsers ? 'ok' : 'warn'} />
            </div>

            <label className="field compact-field">
              <span>Name</span>
              <input value={inviteName} onChange={event => setInviteName(event.target.value)} placeholder="Internal user name" />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@happychair.internal" autoComplete="email" />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={inviteRole} onChange={event => setInviteRole(event.target.value as AdminRole)}>
                {roleOrder.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Access reason</span>
              <textarea value={inviteReason} onChange={event => setInviteReason(event.target.value)} />
            </label>

            <div className="access-risk-strip">
              <StatusPill label={`${getRoleRisk(inviteRole)} risk`} tone={roleRiskTone(inviteRole)} />
              <span>Invites are local preview records until the server-side internal access handler approves them.</span>
            </div>

            <button className="primary-action" disabled={!canManageUsers} onClick={inviteInternalAdmin}>
              <MailPlus size={16} strokeWidth={1.8} />
              Queue Invite
            </button>
          </section>

          <aside className="detail-panel internal-access-detail-panel">
            {selectedUser ? (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">Selected Access Record</p>
                    <h2>{selectedUser.name}</h2>
                  </div>
                  <StatusPill label={selectedUser.status} tone={userStatusTone(selectedUser.status)} />
                </div>

                <label className="field compact-field">
                  <span>Internal admin</span>
                  <select value={selectedUser.id} onChange={event => setSelectedUserId(event.target.value)}>
                    {managedAdminUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]} / {user.status}</option>
                    ))}
                  </select>
                </label>

                <div className="request-scope-list">
                  <div><span>Email</span><strong>{selectedUser.email}</strong></div>
                  <div><span>Current role</span><strong>{roleLabels[selectedUser.role]}</strong></div>
                  <div><span>Last login</span><strong>{formatDateTime(selectedUser.lastLoginAt)}</strong></div>
                  <div><span>Created</span><strong>{formatDateTime(selectedUser.createdAt)}</strong></div>
                </div>

                <label className="field">
                  <span>Target role</span>
                  <select value={targetRole} onChange={event => setTargetRole(event.target.value as AdminRole)}>
                    {roleOrder.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Change reason</span>
                  <textarea value={changeReason} onChange={event => setChangeReason(event.target.value)} />
                </label>

                <div className="access-action-row">
                  <button className="ghost-action" disabled={!canManageUsers || selectedUser.role === targetRole} onClick={queueRoleChange}>
                    <Save size={16} strokeWidth={1.8} />
                    Queue Role
                  </button>
                  <button className="ghost-action" disabled={!canManageUsers || selectedUser.status === 'Disabled'} onClick={() => queueStatusChange('Disabled')}>
                    <PauseCircle size={16} strokeWidth={1.8} />
                    Suspend
                  </button>
                  <button className="ghost-action" disabled={!canManageUsers || selectedUser.status === 'Active'} onClick={() => queueStatusChange('Active')}>
                    <RotateCcw size={16} strokeWidth={1.8} />
                    Reactivate
                  </button>
                </div>

                <div className="settings-rule-list">
                  <div><UserCheck size={16} strokeWidth={1.8} /><strong>Role changes require admin_users.manage and create Admin Action Requests.</strong></div>
                  <div><UserX size={16} strokeWidth={1.8} /><strong>Disabled or invited users are blocked from entering the managed access preview.</strong></div>
                </div>
              </>
            ) : (
              <div className="empty-state compact">No internal admin user selected.</div>
            )}
          </aside>
        </div>
      ) : (
        <section className="panel action-request-boundary-panel">
          <div>
            <p className="eyebrow">Internal Access Restricted</p>
            <h2>Admin-user details require explicit permission</h2>
            <span>This role can review general settings but cannot inspect or manage the internal user roster.</span>
          </div>
          <StatusPill label="admin_users.view required" tone="warn" />
        </section>
      )}

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Security Rules</h2>
              <span>Controls that must stay true in production</span>
            </div>
            <StatusPill label={canManage ? 'Manage Allowed' : 'Read Only'} tone={canManage ? 'ok' : 'warn'} />
          </div>
          <div className="settings-rule-list">
            <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Separate internal auth from client and venue auth.</strong></div>
            <div><KeyRound size={16} strokeWidth={1.8} /><strong>Permission-check every sensitive admin action server-side.</strong></div>
            <div><LockKeyhole size={16} strokeWidth={1.8} /><strong>Cross-tenant access must be explicit, audited, and scoped.</strong></div>
            <div><Database size={16} strokeWidth={1.8} /><strong>Use read-only views before enabling mutations.</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Data Connection</h2>
              <span>Current provider contract</span>
            </div>
            <StatusPill label={sourceLabel} tone={status === 'fallback' || status === 'partial' ? 'warn' : 'info'} />
          </div>
          <dl className="signal-list">
            <div><dt>Mode</dt><dd>{dataSourceKind}</dd></div>
            <div><dt>Status</dt><dd>{status}</dd></div>
            <div><dt>Live Views</dt><dd>{readyViews}</dd></div>
            <div><dt>Fallback Views</dt><dd>{fallbackViews}</dd></div>
            <div><dt>Mock Views</dt><dd>{mockViews}</dd></div>
            <div><dt>Contracts</dt><dd>{readViewDiagnostics.length}</dd></div>
          </dl>
          {error && <p className="warning-copy">{error}</p>}
        </section>
      </div>

      <DataTable
        label="Read View Diagnostics"
        rows={readViewDiagnostics}
        pageSize={8}
        columns={[
          {
            key: 'view',
            header: 'View',
            sortable: true,
            searchValue: row => `${row.key} ${row.viewName}`,
            render: row => <div><strong>{row.key}</strong><span className="cell-subtext">{row.viewName}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={readViewStatusTone(row.status)} />,
          },
          {
            key: 'records',
            header: 'Records',
            sortable: true,
            searchValue: row => String(row.records),
            render: row => row.records,
          },
          {
            key: 'loaded',
            header: 'Loaded',
            sortable: true,
            searchValue: row => row.loadedAt ?? '',
            render: row => row.loadedAt ? new Date(row.loadedAt).toLocaleTimeString() : 'Pending',
          },
          {
            key: 'error',
            header: 'Error',
            searchValue: row => row.error ?? '',
            render: row => row.error ? <span className="warning-copy">{row.error}</span> : <span className="muted-copy">None</span>,
          },
        ]}
      />

      <DataTable
        label="Internal Auth Adapter Guardrails"
        rows={authAdapterStatus.guardrails}
        pageSize={6}
        columns={[
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={authGuardrailTone(row.status)} />,
          },
          {
            key: 'guardrail',
            header: 'Guardrail',
            sortable: true,
            searchValue: row => `${row.label} ${row.detail}`,
            render: row => <div><strong>{row.label}</strong><span className="cell-subtext">{row.detail}</span></div>,
          },
        ]}
      />

      <DataTable
        label="Internal Auth Readiness Checks"
        rows={authReadiness.checks}
        pageSize={8}
        columns={[
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={getInternalAuthCheckTone(row.status)} />,
          },
          {
            key: 'check',
            header: 'Check',
            sortable: true,
            searchValue: row => `${row.label} ${row.detail}`,
            render: row => <div><strong>{row.label}</strong><span className="cell-subtext">{row.detail}</span></div>,
          },
          {
            key: 'area',
            header: 'Area',
            sortable: true,
            searchValue: row => row.area,
            render: row => row.area,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
        ]}
      />

      {canViewUsers && (
        <DataTable
          label="Internal Admin Users"
          rows={managedAdminUsers}
          columns={[
            {
              key: 'name',
              header: 'User',
              sortable: true,
              searchValue: row => row.name,
              render: row => <button className="table-link" onClick={() => setSelectedUserId(row.id)}>{row.name}</button>,
            },
            {
              key: 'email',
              header: 'Email',
              sortable: true,
              searchValue: row => row.email,
              render: row => row.email,
            },
            {
              key: 'role',
              header: 'Role',
              sortable: true,
              searchValue: row => row.role,
              render: row => (
                <div>
                  <strong>{roleLabel(row.role)}</strong>
                  <span className="cell-subtext">{getRoleRisk(row.role)} access risk</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={userStatusTone(row.status)} />,
            },
            {
              key: 'lastLogin',
              header: 'Last Login',
              sortable: true,
              searchValue: row => row.lastLoginAt,
              render: row => formatDateTime(row.lastLoginAt),
            },
          ]}
        />
      )}

      {canViewUsers && (
        <DataTable
          label="Internal Access Change Ledger"
          rows={accessChanges}
          pageSize={6}
          emptyTitle="No local internal access changes have been recorded."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={accessStatusTone(row.status)} />,
            },
            {
              key: 'change',
              header: 'Change',
              sortable: true,
              searchValue: row => `${row.changeType} ${row.userName} ${row.userEmail}`,
              render: row => <div><strong>{row.changeType.replace(/_/g, ' ')}</strong><span className="cell-subtext">{row.userName} / {row.userEmail}</span></div>,
            },
            {
              key: 'role',
              header: 'Role',
              sortable: true,
              searchValue: row => `${row.previousRole ?? ''} ${row.nextRole ?? ''}`,
              render: row => row.nextRole ? `${row.previousRole ? roleLabels[row.previousRole] : 'None'} -> ${roleLabels[row.nextRole]}` : 'No role change',
            },
            {
              key: 'access',
              header: 'Access',
              sortable: true,
              searchValue: row => `${row.previousStatus ?? ''} ${row.nextStatus ?? ''}`,
              render: row => row.nextStatus ? `${row.previousStatus ?? 'None'} -> ${row.nextStatus}` : 'Review only',
            },
            {
              key: 'requestedBy',
              header: 'Requested By',
              sortable: true,
              searchValue: row => row.requestedBy,
              render: row => <div><strong>{row.requestedBy}</strong><span className="cell-subtext">{formatDateTime(row.createdAt)}</span></div>,
            },
          ]}
        />
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Role Permission Matrix</h2>
            <span>Read-only permission contract used by the admin shell</span>
          </div>
        </div>

        <div className="permission-matrix">
          {permissionGroups.map(group => (
            <article key={group.label} className="permission-group">
              <h3>{group.label}</h3>
              <div className="permission-grid">
                {group.permissions.map(permission => (
                  <div key={permission} className="permission-row">
                    <strong>{permission}</strong>
                    <span>
                      {roleOrder.map(role => (
                        <span key={role} className={`permission-dot${rolePermissions[role].includes(permission) ? ' allowed' : ''}`} title={`${roleLabel(role)} ${permission}`} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
