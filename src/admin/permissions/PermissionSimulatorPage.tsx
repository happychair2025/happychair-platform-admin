import { ArrowRightLeft, Eye, KeyRound, LockKeyhole, ShieldCheck, UserCog, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import {
  buildPermissionSimulation,
  comparePermissions,
  riskTone,
  roleOptionLabel,
  type PermissionSimulationRow,
} from '../../lib/permissions/permissionSimulator'
import { roleLabels, type AdminRole } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'

interface PermissionSimulatorPageProps {
  session: AdminSession
}

const roleOrder: AdminRole[] = ['owner', 'admin', 'support_lead', 'support_agent', 'client_success', 'finance', 'marketing', 'engineering', 'read_only']

function accessTone(allowed: boolean): 'ok' | 'danger' {
  return allowed ? 'ok' : 'danger'
}

export default function PermissionSimulatorPage({ session }: PermissionSimulatorPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const managedAdminUsers = useManagedInternalAdminUsers(data.internalAdminUsers)
  const [selectedRole, setSelectedRole] = useState<AdminRole>(session.role)
  const [compareRole, setCompareRole] = useState<AdminRole>('read_only')
  const [selectedCapabilityId, setSelectedCapabilityId] = useState('')
  const [notice, setNotice] = useState('')
  const simulation = useMemo(() => buildPermissionSimulation(selectedRole), [selectedRole])
  const comparison = useMemo(() => comparePermissions(selectedRole, compareRole), [compareRole, selectedRole])
  const selectedCapability = simulation.rows.find(row => row.id === selectedCapabilityId) ?? simulation.rows[0]
  const selectedRoleUsers = managedAdminUsers.filter(user => user.role === selectedRole)

  const recordSimulation = () => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Permission Simulator',
      actionKey: 'permission_simulator.reviewed.mock',
      actionLabel: `Reviewed ${roleLabels[selectedRole]} permission simulation`,
      severity: simulation.sensitiveAllowedCount > 4 ? 'warning' : 'notice',
      metadata: {
        simulatedRole: selectedRole,
        comparedRole: compareRole,
        allowedCapabilities: simulation.allowedCount,
        blockedCapabilities: simulation.blockedCount,
        sensitiveAllowed: simulation.sensitiveAllowedCount,
        comparisonAdded: comparison.added,
        comparisonRemoved: comparison.removed,
      },
    })
    setNotice(result.ok ? `Permission simulation recorded for ${roleLabels[selectedRole]}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Internal Controls"
        title="Permission Simulator"
        description="Preview what each internal role can see and do before changing permissions, approvals, impersonation access, or admin action authority."
        action={(
          <button className="ghost-action" onClick={recordSimulation}>
            <ShieldCheck size={16} strokeWidth={1.8} />
            Record Simulation
          </button>
        )}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <section className="panel simulator-control-panel">
        <label className="field compact-field">
          <span>Simulated role</span>
          <select value={selectedRole} onChange={event => setSelectedRole(event.target.value as AdminRole)}>
            {roleOrder.map(role => <option key={role} value={role}>{roleOptionLabel(role)}</option>)}
          </select>
        </label>
        <ArrowRightLeft size={18} strokeWidth={1.8} />
        <label className="field compact-field">
          <span>Compare against</span>
          <select value={compareRole} onChange={event => setCompareRole(event.target.value as AdminRole)}>
            {roleOrder.map(role => <option key={role} value={role}>{roleOptionLabel(role)}</option>)}
          </select>
        </label>
        <StatusPill label={`${sourceLabel} contract`} tone="info" />
      </section>

      <div className="metrics-grid compact">
        <MetricCard label="Allowed" value={String(simulation.allowedCount)} delta="Simulated capabilities" tone="ok" icon={<Eye size={16} />} />
        <MetricCard label="Blocked" value={String(simulation.blockedCount)} delta="Denied by role contract" tone={simulation.blockedCount ? 'warn' : 'ok'} icon={<LockKeyhole size={16} />} />
        <MetricCard label="Sensitive Allowed" value={String(simulation.sensitiveAllowedCount)} delta="High or critical risk" tone={simulation.sensitiveAllowedCount ? 'warn' : 'ok'} icon={<KeyRound size={16} />} />
        <MetricCard label="Users In Role" value={String(selectedRoleUsers.length)} delta={selectedRoleUsers.map(user => user.name).join(', ') || 'No assigned users'} tone="neutral" icon={<UsersRound size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Permission Safety Rule</p>
          <h2>Preview access before changing internal roles</h2>
          <span>The simulator is read-only. Permission changes still need explicit approval, server-side enforcement, and audit records before production use.</span>
        </div>
        <StatusPill label={`${comparison.added.length} gained / ${comparison.removed.length} lost`} tone={comparison.added.length || comparison.removed.length ? 'warn' : 'ok'} />
      </section>

      <div className="permission-simulator-layout">
        <DataTable
          label="Capability Preview"
          rows={simulation.rows}
          pageSize={9}
          emptyTitle="No permission capabilities are configured."
          columns={[
            {
              key: 'access',
              header: 'Access',
              sortable: true,
              searchValue: row => row.allowed ? 'Allowed' : 'Blocked',
              render: row => <StatusPill label={row.allowed ? 'Allowed' : 'Blocked'} tone={accessTone(row.allowed)} />,
            },
            {
              key: 'capability',
              header: 'Capability',
              sortable: true,
              searchValue: row => `${row.label} ${row.description}`,
              render: row => <button className="table-link" onClick={() => setSelectedCapabilityId(row.id)}>{row.label}</button>,
            },
            {
              key: 'area',
              header: 'Area',
              sortable: true,
              searchValue: row => row.area,
              render: row => row.area,
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => row.risk,
              render: row => <StatusPill label={row.risk} tone={riskTone(row.risk)} />,
            },
            {
              key: 'permission',
              header: 'Permission',
              sortable: true,
              searchValue: row => row.permission,
              render: row => <code>{row.permission}</code>,
            },
          ]}
        />

        <aside className="detail-panel permission-simulator-detail-panel">
          {selectedCapability ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Capability Detail</p>
                  <h2>{selectedCapability.label}</h2>
                </div>
                <StatusPill label={selectedCapability.allowed ? 'Allowed' : 'Blocked'} tone={accessTone(selectedCapability.allowed)} />
              </div>

              <div className="request-scope-list">
                <div><span>Role</span><strong>{roleLabels[selectedRole]}</strong></div>
                <div><span>Area</span><strong>{selectedCapability.area}</strong></div>
                <div><span>Risk</span><strong>{selectedCapability.risk}</strong></div>
                <div><span>Permission</span><strong>{selectedCapability.permission}</strong></div>
              </div>

              <div className="detail-section">
                <h3>What This Allows</h3>
                <p className="muted-copy">{selectedCapability.description}</p>
              </div>

              <div className="detail-section">
                <h3>Audit Expectation</h3>
                <p className="muted-copy">{selectedCapability.auditExpectation}</p>
              </div>

              <div className="settings-rule-list">
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>{selectedCapability.allowed ? `${roleLabels[selectedRole]} has this permission.` : `${roleLabels[selectedRole]} is blocked from this capability.`}</strong>
                </div>
                <div>
                  <UserCog size={16} strokeWidth={1.8} />
                  <strong>{selectedRoleUsers.length} internal user{selectedRoleUsers.length === 1 ? '' : 's'} currently assigned to {roleLabels[selectedRole]}.</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Role Comparison</h3>
                <div className="permission-diff-grid">
                  <div>
                    <StatusPill label="Gained" tone={comparison.added.length ? 'warn' : 'ok'} />
                    <strong>{comparison.added.length} permissions</strong>
                    <span>{comparison.added.slice(0, 6).join(', ') || 'No gained permissions.'}</span>
                  </div>
                  <div>
                    <StatusPill label="Lost" tone={comparison.removed.length ? 'danger' : 'ok'} />
                    <strong>{comparison.removed.length} permissions</strong>
                    <span>{comparison.removed.slice(0, 6).join(', ') || 'No removed permissions.'}</span>
                  </div>
                  <div>
                    <StatusPill label="Shared" tone="info" />
                    <strong>{comparison.shared.length} permissions</strong>
                    <span>Compared with {roleLabels[compareRole]}.</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No capability selected.</div>
          )}
        </aside>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Assigned Users</h2>
            <span>Current internal users for the simulated role</span>
          </div>
        </div>
        <div className="queue-list">
          {selectedRoleUsers.length ? selectedRoleUsers.map(user => (
            <div key={user.id}>
              <StatusPill label={user.status} tone={user.status === 'Active' ? 'ok' : user.status === 'Invited' ? 'warn' : 'danger'} />
              <strong>{user.name}</strong>
              <span>{user.email} / last login {user.lastLoginAt === 'Pending' ? 'Pending' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(user.lastLoginAt))}</span>
            </div>
          )) : (
            <div>
              <StatusPill label="No users" tone="neutral" />
              <strong>No internal users currently have this role.</strong>
              <span>Use this role only after approval and onboarding are ready.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
