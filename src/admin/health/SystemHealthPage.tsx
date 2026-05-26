import { Activity, AlertTriangle, BellRing, Database, QrCode, Radio, ServerCog, TabletSmartphone, Wifi } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

function statusTone(status: string) {
  if (status === 'Failing') return 'danger'
  if (status === 'Warning') return 'warn'
  if (status === 'Unknown') return 'neutral'
  return 'ok'
}

const iconMap = {
  notification_delivery: BellRing,
  websocket_sessions: Wifi,
  api_errors: ServerCog,
  database_sync: Database,
  qr_scans: QrCode,
  device_presence: TabletSmartphone,
  service_queue: Radio,
  module_configuration: Activity,
}

export default function SystemHealthPage() {
  const { data } = usePlatformData()
  const { platformHealthSignals } = data
  const failing = platformHealthSignals.filter(signal => signal.status === 'Failing')
  const warnings = platformHealthSignals.filter(signal => signal.status === 'Warning')
  const passing = platformHealthSignals.filter(signal => signal.status === 'Passing')
  const affectedClients = platformHealthSignals.reduce((sum, signal) => sum + signal.affectedClients, 0)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Platform Health"
        title="System Health"
        description="Notification delivery, websocket/session status, API errors, database sync, QR scan failures, device presence, service queues, and module configuration."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Passing Checks" value={String(passing.length)} delta="Healthy signals" tone="ok" icon={<ServerCog size={16} />} />
        <MetricCard label="Warnings" value={String(warnings.length)} delta="Needs review" tone={warnings.length ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Failing Checks" value={String(failing.length)} delta="Immediate support risk" tone={failing.length ? 'danger' : 'ok'} icon={<Radio size={16} />} />
        <MetricCard label="Affected Clients" value={String(affectedClients)} delta="Across health checks" tone={affectedClients ? 'warn' : 'ok'} icon={<Activity size={16} />} />
      </div>

      <section className="health-signal-grid" aria-label="Platform health signals">
        {platformHealthSignals.map(signal => {
          const Icon = iconMap[signal.checkKey]
          return (
            <article key={signal.id} className={`health-signal-card tone-${signal.severity}`}>
              <div className="health-signal-icon">
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div>
                <div className="timeline-title">
                  <strong>{signal.label}</strong>
                  <StatusPill label={signal.status} tone={statusTone(signal.status)} />
                </div>
                <p>{signal.message}</p>
                <span>{signal.affectedClients} clients / {signal.affectedVenues} venues affected.</span>
              </div>
            </article>
          )
        })}
      </section>

      <DataTable
        label="Health Check Details"
        rows={platformHealthSignals}
        columns={[
          {
            key: 'label',
            header: 'Check',
            sortable: true,
            searchValue: row => row.label,
            render: row => <strong>{row.label}</strong>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
          },
          {
            key: 'clients',
            header: 'Clients',
            sortable: true,
            searchValue: row => String(row.affectedClients),
            render: row => row.affectedClients,
          },
          {
            key: 'cause',
            header: 'Probable Cause',
            sortable: true,
            searchValue: row => row.probableCause,
            render: row => row.probableCause,
          },
          {
            key: 'action',
            header: 'Recommended Action',
            sortable: true,
            searchValue: row => row.recommendedAction,
            render: row => row.recommendedAction,
          },
        ]}
      />
    </div>
  )
}
