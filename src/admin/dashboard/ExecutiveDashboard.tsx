import { Activity, AlertTriangle, CircleDollarSign, TrendingUp } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { executiveMetrics, insightCards, organizations } from '../../lib/mock-data/mockPlatform'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function ExecutiveDashboard() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Command"
        title="Executive Dashboard"
        description="Daily signups, revenue, client health, usage signals, and recommended action."
      />

      <div className="metrics-grid">
        {executiveMetrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            tone={metric.tone}
            icon={index < 2 ? <CircleDollarSign size={17} /> : index < 4 ? <TrendingUp size={17} /> : <AlertTriangle size={17} />}
          />
        ))}
      </div>

      <section className="insight-grid" aria-label="Decision cards">
        {insightCards.map(card => (
          <article key={card.title} className={`insight-card tone-${card.tone}`}>
            <div className="insight-top">
              <Activity size={17} strokeWidth={1.8} />
              <StatusPill label={card.owner} tone={card.tone === 'critical' ? 'danger' : card.tone === 'warning' ? 'warn' : 'ok'} />
            </div>
            <h2>{card.title}</h2>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Platform Usage Trend</h2>
              <span>Last 7 days</span>
            </div>
          </div>
          <div className="usage-bars" aria-label="Platform usage trend">
            {[62, 74, 69, 81, 88, 77, 92].map((height, index) => (
              <div key={index} className="usage-bar">
                <span style={{ height: `${height}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel action-queue">
          <div className="panel-header">
            <div>
              <h2>Action Queue</h2>
              <span>Highest-signal follow-ups</span>
            </div>
          </div>
          <div className="queue-list">
            <div>
              <StatusPill label="Finance" tone="danger" />
              <strong>Recover failed payments</strong>
              <span>Copper Club and two trial accounts need payment follow-up.</span>
            </div>
            <div>
              <StatusPill label="Success" tone="warn" />
              <strong>Reactivate quiet clients</strong>
              <span>Five accounts have no meaningful activity in 7 days.</span>
            </div>
            <div>
              <StatusPill label="Owner" tone="ok" />
              <strong>Review expansion candidates</strong>
              <span>Happy Bistro and Stadium North are ready for premium module review.</span>
            </div>
          </div>
        </section>
      </div>

      <DataTable
        label="Client Health Snapshot"
        rows={organizations}
        columns={[
          {
            key: 'name',
            header: 'Client',
            sortable: true,
            searchValue: row => row.name,
            render: row => <strong>{row.name}</strong>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.healthStatus,
            render: row => <StatusPill label={row.healthStatus} tone={row.healthStatus === 'At Risk' ? 'danger' : row.healthStatus === 'Needs Attention' ? 'warn' : 'ok'} />,
          },
          {
            key: 'usage',
            header: 'Usage',
            sortable: true,
            searchValue: row => String(row.usageScore),
            render: row => `${row.usageScore}%`,
          },
          {
            key: 'mrr',
            header: 'MRR',
            sortable: true,
            searchValue: row => String(row.mrr),
            render: row => currency.format(row.mrr),
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

