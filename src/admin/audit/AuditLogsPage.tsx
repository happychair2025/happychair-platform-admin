import { useMemo } from 'react'
import DataTable from '../../components/admin/DataTable'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { getLocalAuditEvents } from '../../lib/audit/auditLog'
import { mockAuditEvents } from '../../lib/mock-data/mockPlatform'

export default function AuditLogsPage() {
  const rows = useMemo(() => [...getLocalAuditEvents(), ...mockAuditEvents], [])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Audit"
        title="Audit Logs"
        description="Immutable activity trail foundation for support, modules, impersonation, billing, feature flags, exports, and future agent actions."
      />
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
            searchValue: row => row.actor,
            render: row => <strong>{row.actor}</strong>,
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
            key: 'severity',
            header: 'Severity',
            sortable: true,
            searchValue: row => row.severity,
            render: row => <StatusPill label={row.severity} tone={row.severity === 'critical' ? 'danger' : row.severity === 'warning' ? 'warn' : 'info'} />,
          },
        ]}
      />
    </div>
  )
}

