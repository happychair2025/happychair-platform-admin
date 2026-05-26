import { Database, KeyRound, LockKeyhole, ShieldCheck, UserCog, UsersRound } from 'lucide-react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
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
  { label: 'Company', permissions: ['agents.view', 'agents.manage', 'reports.view', 'reports.export', 'billing.view', 'billing.manage', 'feature_flags.view', 'feature_flags.manage', 'settings.view', 'settings.manage'] },
]

function roleLabel(role: AdminRole) {
  return roleLabels[role]
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'Disabled') return 'danger'
  if (status === 'Invited') return 'warn'
  return 'ok'
}

export default function AdminSettingsPage({ session }: AdminSettingsPageProps) {
  const { data, sourceLabel, status, error } = usePlatformData()
  const canManage = hasPermission(session.role, 'settings.manage')
  const activeAdmins = data.internalAdminUsers.filter(user => user.status === 'Active')
  const invitedAdmins = data.internalAdminUsers.filter(user => user.status === 'Invited')
  const activeFlags = data.featureFlags.filter(flag => flag.enabled)
  const highRiskFlags = data.featureFlags.filter(flag => flag.blastRadius === 'High')

  const auditSettingsReview = (action: string) => {
    runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Admin Settings',
      actionKey: `settings.${action}.mock`,
      actionLabel: `${action.replace(/_/g, ' ')} reviewed`,
      severity: 'notice',
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Internal Controls"
        title="Admin Settings"
        description="Internal users, roles, permissions, data-source state, safety checks, and deployment controls for Team Happy Chair."
        action={
          <button className="ghost-action" onClick={() => auditSettingsReview('settings_access')}>
            <ShieldCheck size={16} strokeWidth={1.8} />
            Record Review
          </button>
        }
      />

      <div className="metrics-grid compact">
        <MetricCard label="Admin Users" value={String(data.internalAdminUsers.length)} delta={`${activeAdmins.length} active`} tone="ok" icon={<UsersRound size={16} />} />
        <MetricCard label="Invites" value={String(invitedAdmins.length)} delta="Pending setup" tone={invitedAdmins.length ? 'warn' : 'ok'} icon={<UserCog size={16} />} />
        <MetricCard label="Active Flags" value={String(activeFlags.length)} delta={`${highRiskFlags.length} high-risk flags`} tone={highRiskFlags.length ? 'warn' : 'ok'} icon={<LockKeyhole size={16} />} />
        <MetricCard label="Data Source" value={sourceLabel} delta={status === 'fallback' ? error ?? 'Fallback active' : 'Provider state'} tone={status === 'fallback' ? 'warn' : 'ok'} icon={<Database size={16} />} />
      </div>

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
            <StatusPill label={sourceLabel} tone={status === 'fallback' ? 'warn' : 'info'} />
          </div>
          <dl className="signal-list">
            <div><dt>Mode</dt><dd>{sourceLabel}</dd></div>
            <div><dt>Status</dt><dd>{status}</dd></div>
            <div><dt>Fallback</dt><dd>{status === 'fallback' ? 'Active' : 'Ready'}</dd></div>
            <div><dt>Views</dt><dd>20 contracts</dd></div>
          </dl>
          {error && <p className="warning-copy">{error}</p>}
        </section>
      </div>

      <DataTable
        label="Internal Admin Users"
        rows={data.internalAdminUsers}
        columns={[
          {
            key: 'name',
            header: 'User',
            sortable: true,
            searchValue: row => row.name,
            render: row => <strong>{row.name}</strong>,
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
            render: row => roleLabel(row.role),
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
          },
          {
            key: 'lastLogin',
            header: 'Last Login',
            sortable: true,
            searchValue: row => row.lastLoginAt,
            render: row => row.lastLoginAt === 'Pending' ? 'Pending' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(row.lastLoginAt)),
          },
        ]}
      />

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
