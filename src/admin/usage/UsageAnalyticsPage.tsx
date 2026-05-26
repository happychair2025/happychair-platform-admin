import { Activity, AlertTriangle, BarChart3, QrCode, Users } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function trendTone(trend: string) {
  if (trend === 'Declining') return 'danger'
  if (trend === 'Flat') return 'warn'
  return 'ok'
}

export default function UsageAnalyticsPage() {
  const { data } = usePlatformData()
  const { moduleAdoption, moduleUsageGaps, usageAnalytics } = data
  const totalActiveUsers = usageAnalytics.reduce((sum, row) => sum + row.activeUsers7d, 0)
  const totalQrScans = usageAnalytics.reduce((sum, row) => sum + row.qrScans7d, 0)
  const totalRequests = usageAnalytics.reduce((sum, row) => sum + row.serviceRequests7d, 0)
  const inactiveClients = usageAnalytics.filter(row => row.inactiveDays >= 7).length
  const leastActive = [...usageAnalytics].sort((a, b) => a.moduleUsage7d - b.moduleUsage7d).slice(0, 3)
  const strongestGrowth = usageAnalytics.filter(row => row.usageTrend === 'Growing')

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Adoption Intelligence"
        title="Usage Analytics"
        description="Client activity, module adoption, unused modules, inactive trials, usage decline, and growth signals."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Active Users 7d" value={String(totalActiveUsers)} delta="Across tracked clients" tone="ok" icon={<Users size={16} />} />
        <MetricCard label="QR Scans 7d" value={totalQrScans.toLocaleString()} delta="Guest entry signal" tone="ok" icon={<QrCode size={16} />} />
        <MetricCard label="Requests 7d" value={totalRequests.toLocaleString()} delta="Service workflow volume" tone="ok" icon={<Activity size={16} />} />
        <MetricCard label="Inactive Clients" value={String(inactiveClients)} delta="No activity in 7 days" tone={inactiveClients ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Module Adoption</h2>
              <span>Enabled clients, active clients, usage, and attributed revenue</span>
            </div>
            <BarChart3 size={18} strokeWidth={1.8} />
          </div>
          <div className="adoption-list">
            {moduleAdoption.map(module => (
              <article key={module.moduleName} className="adoption-item">
                <div>
                  <strong>{module.moduleName}</strong>
                  <span>{module.activeClients7d} of {module.enabledClients} clients active / {currency.format(module.revenueAttributed)}</span>
                </div>
                <div className="score-track">
                  <span style={{ width: `${module.adoptionRate}%` }} />
                </div>
                <StatusPill label={`${module.adoptionRate}% adoption`} tone={module.adoptionRate < 45 ? 'danger' : module.adoptionRate < 70 ? 'warn' : 'ok'} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Not Using Enabled Modules</h2>
              <span>Success and support follow-up queue</span>
            </div>
            <AlertTriangle size={18} strokeWidth={1.8} />
          </div>
          <div className="usage-gap-list">
            {moduleUsageGaps.map(gap => (
              <article key={gap.id} className="usage-gap-item">
                <div className="timeline-title">
                  <strong>{gap.organizationName}</strong>
                  <StatusPill label={gap.owner} tone={gap.owner === 'Support' ? 'warn' : 'info'} />
                </div>
                <p>{gap.moduleName} has {gap.usageLast7Days} uses in the last 7 days.</p>
                <span>{gap.recommendedAction}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Least Active Clients</h2>
              <span>Lowest module activity in the last 7 days</span>
            </div>
          </div>
          <div className="queue-list">
            {leastActive.map(row => (
              <div key={row.id}>
                <StatusPill label={row.usageTrend} tone={trendTone(row.usageTrend)} />
                <strong>{row.organizationName}</strong>
                <span>{row.moduleUsage7d} module events / last active {row.lastActive}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Strong Usage Growth</h2>
              <span>Likely expansion or conversion candidates</span>
            </div>
          </div>
          <div className="queue-list">
            {strongestGrowth.map(row => (
              <div key={row.id}>
                <StatusPill label={row.status} tone={row.status === 'Trial' ? 'info' : 'ok'} />
                <strong>{row.organizationName}</strong>
                <span>{row.staffAdoption}% staff adoption / {row.serviceRequests7d} service requests.</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <DataTable
        label="Client Usage"
        rows={usageAnalytics}
        columns={[
          {
            key: 'organization',
            header: 'Client',
            sortable: true,
            searchValue: row => row.organizationName,
            render: row => <strong>{row.organizationName}</strong>,
          },
          {
            key: 'trend',
            header: 'Trend',
            sortable: true,
            searchValue: row => row.usageTrend,
            render: row => <StatusPill label={row.usageTrend} tone={trendTone(row.usageTrend)} />,
          },
          {
            key: 'staff',
            header: 'Staff Adoption',
            sortable: true,
            searchValue: row => String(row.staffAdoption),
            render: row => `${row.staffAdoption}%`,
          },
          {
            key: 'requests',
            header: 'Requests',
            sortable: true,
            searchValue: row => String(row.serviceRequests7d),
            render: row => row.serviceRequests7d.toLocaleString(),
          },
          {
            key: 'response',
            header: 'Avg Response',
            sortable: true,
            searchValue: row => String(row.averageResponseSeconds),
            render: row => row.averageResponseSeconds ? `${row.averageResponseSeconds}s` : 'N/A',
          },
          {
            key: 'lastActive',
            header: 'Last Active',
            sortable: true,
            searchValue: row => row.lastActive,
            render: row => row.lastActive,
          },
        ]}
      />
    </div>
  )
}
