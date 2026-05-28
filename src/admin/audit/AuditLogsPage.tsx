import { useMemo } from 'react'
import { Database, HardDrive, ShieldAlert, ShieldCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { useLocalAuditEvents, type AuditEvent } from '../../lib/audit/auditLog'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

export default function AuditLogsPage() {
  const localEvents = useLocalAuditEvents()
  const { data, sourceLabel } = usePlatformData()
  const rows = useMemo<AuditRow[]>(() => {
    const liveRows = localEvents.map(event => ({ ...event, source: 'Live Action Ledger' as const }))
    const readRows = data.auditEvents
      .filter(event => !localEvents.some(localEvent => localEvent.id === event.id))
      .map(event => ({ ...event, source: 'Read-only Audit View' as const }))
    return [...liveRows, ...readRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data.auditEvents, localEvents])

  const blockedCount = rows.filter(row => row.outcome === 'blocked' || row.actionKey.includes('blocked')).length
  const serverRecordedCount = rows.filter(row => row.persistenceStatus === 'server_recorded' || row.source === 'Read-only Audit View').length

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Audit"
        title="Audit Logs"
        description="Immutable activity trail foundation for support, modules, impersonation, billing, feature flags, exports, and future agent actions."
      />
      <div className="metrics-grid compact">
        <MetricCard label="Audit Events" value={String(rows.length)} delta={`${sourceLabel} plus live ledger`} tone="neutral" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Live Actions" value={String(localEvents.length)} delta="Persisted in browser ledger for this build" tone="neutral" icon={<HardDrive size={16} />} />
        <MetricCard label="Server Records" value={String(serverRecordedCount)} delta="Read-only audit view contract" tone="ok" icon={<Database size={16} />} />
        <MetricCard label="Blocked Actions" value={String(blockedCount)} delta="Permission denials preserved" tone={blockedCount ? 'danger' : 'ok'} icon={<ShieldAlert size={16} />} />
      </div>

      <section className="panel agent-safety-panel">
        <div>
          <p className="eyebrow">Action Persistence Rule</p>
          <h2>Every meaningful admin action must enter this ledger before customer state changes</h2>
          <span>The current build keeps a durable local action ledger and a read-only Supabase audit view contract. Production mutations still require server-side permission checks and immutable `platform_admin.audit_logs` writes.</span>
        </div>
        <StatusPill label="Server write path required" tone="warn" />
      </section>

      <DataTable
        label="Audit Events"
        rows={rows}
        columns={[
          {
            key: 'createdAt',
            header: 'Date',
            sortable: true,
            searchValue: row => row.createdAt,
            render: row => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: 'actor',
            header: 'Actor',
            sortable: true,
            searchValue: row => `${row.actor} ${row.actorEmail ?? ''} ${row.actorRole}`,
            render: row => <div><strong>{row.actor}</strong><span className="cell-subtext">{row.actorRole}</span></div>,
          },
          {
            key: 'permission',
            header: 'Permission',
            sortable: true,
            searchValue: row => row.permission ?? '',
            render: row => row.permission ? <code>{row.permission}</code> : <span className="muted-copy">Legacy event</span>,
          },
          {
            key: 'scope',
            header: 'Scope',
            sortable: true,
            searchValue: row => row.scope,
            render: row => row.scope,
          },
          {
            key: 'action',
            header: 'Action',
            sortable: true,
            searchValue: row => `${row.actionKey} ${row.actionLabel}`,
            render: row => row.actionLabel,
          },
          {
            key: 'outcome',
            header: 'Outcome',
            sortable: true,
            searchValue: row => row.outcome ?? 'recorded',
            render: row => <StatusPill label={row.outcome ?? 'recorded'} tone={outcomeTone(row)} />,
          },
          {
            key: 'severity',
            header: 'Severity',
            sortable: true,
            searchValue: row => row.severity,
            render: row => <StatusPill label={row.severity} tone={row.severity === 'critical' ? 'danger' : row.severity === 'warning' ? 'warn' : 'info'} />,
          },
          {
            key: 'persistence',
            header: 'Persistence',
            sortable: true,
            searchValue: row => `${row.persistenceStatus ?? ''} ${row.source}`,
            render: row => <StatusPill label={persistenceLabel(row)} tone={row.source === 'Read-only Audit View' ? 'ok' : 'info'} />,
          },
        ]}
        pageSize={8}
      />
    </div>
  )
}

type AuditRow = AuditEvent & {
  source: 'Live Action Ledger' | 'Read-only Audit View'
}

function outcomeTone(row: AuditRow): 'ok' | 'warn' | 'info' | 'danger' {
  if (row.outcome === 'blocked') return 'danger'
  if (row.severity === 'critical') return 'danger'
  if (row.severity === 'warning') return 'warn'
  if (row.outcome === 'allowed') return 'ok'
  return 'info'
}

function persistenceLabel(row: AuditRow) {
  if (row.persistenceStatus === 'server_recorded') return 'Server Recorded'
  if (row.persistenceStatus === 'server_pending') return 'Server Pending'
  if (row.persistenceStatus === 'local_durable') return 'Local Ledger'
  return row.source
}
