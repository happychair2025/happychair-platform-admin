import { AlertTriangle, Flag, ListChecks, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import type { FeatureFlagRecord } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface FeatureFlagsPageProps {
  session: AdminSession
}

function statusTone(status: FeatureFlagRecord['status']): 'ok' | 'warn' | 'neutral' {
  if (status === 'Active') return 'ok'
  if (status === 'Paused') return 'warn'
  return 'neutral'
}

function blastTone(blastRadius: FeatureFlagRecord['blastRadius']): 'ok' | 'warn' | 'danger' {
  if (blastRadius === 'High') return 'danger'
  if (blastRadius === 'Medium') return 'warn'
  return 'ok'
}

export default function FeatureFlagsPage({ session }: FeatureFlagsPageProps) {
  const { data } = usePlatformData()
  const [flagState, setFlagState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.featureFlags.map(flag => [flag.key, flag.enabled])),
  )
  const [selectedKey, setSelectedKey] = useState(data.featureFlags[0]?.key ?? '')
  const [notice, setNotice] = useState('')
  const canManage = hasPermission(session.role, 'feature_flags.manage')
  const flags = data.featureFlags
  const selectedFlag = flags.find(flag => flag.key === selectedKey) ?? flags[0]
  const enabledCount = flags.filter(flag => flagState[flag.key]).length
  const highRiskCount = flags.filter(flag => flag.blastRadius === 'High').length
  const auditRequiredCount = flags.filter(flag => flag.requiresAudit).length

  const toggleFlag = (flag: FeatureFlagRecord) => {
    const nextValue = !flagState[flag.key]
    const result = queueAdminActionRequest(session, {
      actionType: 'feature_flag_change',
      title: `${nextValue ? 'Enable' : 'Disable'} ${flag.name}`,
      permission: 'feature_flags.manage',
      scope: createAdminActionScope({ label: flag.key }),
      reason: `${flag.name} was requested from the feature flag rollout controls. Production flag changes require the server handler and rollout audit notes.`,
      rollbackNotes: `Restore ${flag.key} to ${flag.enabled ? 'enabled' : 'disabled'} and return rollout to ${flag.rollout}% if validation fails.`,
      severity: flag.blastRadius === 'High' ? 'critical' : flag.requiresAudit ? 'warning' : 'notice',
      metadata: {
        flagKey: flag.key,
        flagName: flag.name,
        requestedEnabledState: nextValue,
        environment: flag.environment,
        blastRadius: flag.blastRadius,
        rollout: flag.rollout,
      },
    })
    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${flag.name} server action request queued.`)
  }

  const reviewedFlags = useMemo(() => flags.filter(flag => flag.requiresAudit || flag.blastRadius !== 'Low'), [flags])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Release Controls"
        title="Feature Flags"
        description="Internal rollout controls for platform features, data connections, support workflows, revenue integrations, and future agent hooks."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Total Flags" value={String(flags.length)} delta="Internal contracts" tone="neutral" icon={<Flag size={16} />} />
        <MetricCard label="Enabled" value={String(enabledCount)} delta="Read-only registry state" tone="ok" icon={<SlidersHorizontal size={16} />} />
        <MetricCard label="High Risk" value={String(highRiskCount)} delta="Needs owner review" tone={highRiskCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Audit Required" value={String(auditRequiredCount)} delta="Tracked before mutation" tone="warn" icon={<ListChecks size={16} />} />
      </div>

      <section className="panel agent-safety-panel">
        <div>
          <p className="eyebrow">Rollout Safety</p>
          <h2>Feature flags are review gates, not shortcuts</h2>
          <span>Production flag changes must be permission-checked server-side, tied to a rollout plan, and written to the audit log before customer state changes.</span>
        </div>
        <StatusPill label={canManage ? 'Manage Allowed' : 'Read Only'} tone={canManage ? 'ok' : 'warn'} />
      </section>

      <div className="feature-flag-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Flag Registry</h2>
              <span>Click a flag to inspect rollout and risk details</span>
            </div>
          </div>
          <div className="flag-card-list">
            {flags.map(flag => (
              <button
                key={flag.key}
                className={`flag-card${selectedFlag?.key === flag.key ? ' selected' : ''}`}
                onClick={() => setSelectedKey(flag.key)}
              >
                <span className="module-icon" aria-hidden="true">
                  <Flag size={17} strokeWidth={1.8} />
                </span>
                <span>
                  <strong>{flag.name}</strong>
                  <small>{flag.key}</small>
                </span>
                <StatusPill label={flagState[flag.key] ? 'Enabled' : 'Disabled'} tone={flagState[flag.key] ? 'ok' : 'neutral'} />
              </button>
            ))}
          </div>
        </section>

        {selectedFlag && (
          <aside className="detail-panel">
            <div className="detail-header">
              <div>
                <p className="eyebrow">Flag Detail</p>
                <h2>{selectedFlag.name}</h2>
              </div>
              <StatusPill label={selectedFlag.environment} tone={selectedFlag.environment === 'Production' ? 'danger' : selectedFlag.environment === 'Staging' ? 'warn' : 'info'} />
            </div>

            <p className="muted-copy">{selectedFlag.description}</p>

            <dl className="signal-list">
              <div><dt>Status</dt><dd><StatusPill label={selectedFlag.status} tone={statusTone(selectedFlag.status)} /></dd></div>
              <div><dt>Owner</dt><dd>{selectedFlag.owner}</dd></div>
              <div><dt>Blast Radius</dt><dd><StatusPill label={selectedFlag.blastRadius} tone={blastTone(selectedFlag.blastRadius)} /></dd></div>
              <div><dt>Rollout</dt><dd>{selectedFlag.rollout}%</dd></div>
            </dl>

            <div className="score-row">
              <div><span>Rollout Coverage</span><strong>{selectedFlag.rollout}%</strong></div>
              <div className="score-track"><span style={{ width: `${selectedFlag.rollout}%` }} /></div>
            </div>

            <div className="safety-rule-list">
              <div>
                <ShieldCheck size={16} strokeWidth={1.8} />
                <span>Requires permission check before production mutation.</span>
              </div>
              <div>
                <ListChecks size={16} strokeWidth={1.8} />
                <span>{selectedFlag.requiresAudit ? 'Audit entry required for every change.' : 'Audit optional for low-risk review events.'}</span>
              </div>
              <div>
                <AlertTriangle size={16} strokeWidth={1.8} />
                <span>High-risk flags require owner-approved rollout notes.</span>
              </div>
            </div>

            <button className="primary-action" disabled={!canManage} onClick={() => toggleFlag(selectedFlag)}>
              {flagState[selectedFlag.key] ? 'Queue Disable Request' : 'Queue Enable Request'}
            </button>
            {notice && <p className="warning-copy">{notice}</p>}
          </aside>
        )}
      </div>

      <DataTable
        label="Flags Needing Review"
        rows={reviewedFlags}
        columns={[
          {
            key: 'flag',
            header: 'Flag',
            sortable: true,
            searchValue: row => row.name,
            render: row => <strong>{row.name}</strong>,
          },
          {
            key: 'category',
            header: 'Category',
            sortable: true,
            searchValue: row => row.category,
            render: row => row.category,
          },
          {
            key: 'risk',
            header: 'Risk',
            sortable: true,
            searchValue: row => row.blastRadius,
            render: row => <StatusPill label={row.blastRadius} tone={blastTone(row.blastRadius)} />,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
          {
            key: 'audit',
            header: 'Audit',
            sortable: true,
            searchValue: row => row.requiresAudit ? 'Required' : 'Optional',
            render: row => <StatusPill label={row.requiresAudit ? 'Required' : 'Optional'} tone={row.requiresAudit ? 'warn' : 'neutral'} />,
          },
        ]}
      />
    </div>
  )
}
