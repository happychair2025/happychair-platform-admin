import { CheckCircle2, MousePointerClick, UserPlus, UsersRound } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { registrations } from '../../lib/mock-data/mockPlatform'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function statusTone(status: string) {
  if (status === 'Converted') return 'ok'
  if (status === 'Abandoned' || status === 'Setup Incomplete') return 'warn'
  return 'info'
}

function countStatus(status: string) {
  return registrations.filter(row => row.status === status).length
}

function groupBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})
}

export default function RegistrationsPage() {
  const projectedPipeline = registrations
    .filter(row => row.status !== 'Converted' && row.status !== 'Abandoned')
    .reduce((sum, row) => sum + row.projectedMrr, 0)
  const sourceCounts = groupBy(registrations.map(row => row.source))
  const propertyCounts = groupBy(registrations.map(row => row.propertyType))
  const conversionRate = Math.round((countStatus('Converted') / registrations.length) * 100)
  const setupIncomplete = registrations.filter(row => row.status === 'Setup Incomplete' || row.setupCompletion < 50)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Growth Intake"
        title="Registrations"
        description="Signups, demo requests, trial starts, conversions, abandoned signups, source quality, and market-type demand."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Total Signups" value={String(registrations.length)} delta="Mock intake records" tone="ok" icon={<UserPlus size={16} />} />
        <MetricCard label="Trial Starts" value={String(countStatus('Trial Started'))} delta="Setup in progress" tone="neutral" icon={<UsersRound size={16} />} />
        <MetricCard label="Conversions" value={String(countStatus('Converted'))} delta={`${conversionRate}% conversion`} tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Pipeline MRR" value={currency.format(projectedPipeline)} delta="Projected from open signups" tone="warn" icon={<MousePointerClick size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Signup Funnel</h2>
              <span>Current mock funnel by status</span>
            </div>
          </div>
          <div className="funnel-list">
            {['Demo Requested', 'Trial Started', 'Setup Incomplete', 'Converted', 'Abandoned'].map(status => {
              const count = countStatus(status)
              const width = Math.max(10, Math.round((count / registrations.length) * 100))
              return (
                <div key={status} className="funnel-row">
                  <div>
                    <strong>{status}</strong>
                    <StatusPill label={`${count} accounts`} tone={statusTone(status)} />
                  </div>
                  <div className="score-track"><span style={{ width: `${width}%` }} /></div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Setup Risk</h2>
              <span>Accounts likely to need outreach</span>
            </div>
          </div>
          <div className="queue-list">
            {setupIncomplete.map(row => (
              <div key={row.id}>
                <StatusPill label={`${row.setupCompletion}% setup`} tone={row.setupCompletion < 50 ? 'warn' : 'info'} />
                <strong>{row.companyName}</strong>
                <span>{row.status} / {currency.format(row.projectedMrr)} projected MRR.</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Signup Source</h2>
              <span>Where demand is coming from</span>
            </div>
          </div>
          <div className="segment-list">
            {Object.entries(sourceCounts).map(([source, count]) => (
              <div key={source}>
                <strong>{source}</strong>
                <span>{count} registrations</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Property Type</h2>
              <span>Market-type demand signal</span>
            </div>
          </div>
          <div className="segment-list">
            {Object.entries(propertyCounts).map(([type, count]) => (
              <div key={type}>
                <strong>{type}</strong>
                <span>{count} registrations</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <DataTable
        label="Registration Records"
        rows={registrations}
        columns={[
          {
            key: 'company',
            header: 'Company',
            sortable: true,
            searchValue: row => row.companyName,
            render: row => <strong>{row.companyName}</strong>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
          },
          {
            key: 'source',
            header: 'Source',
            sortable: true,
            searchValue: row => row.source,
            render: row => row.source,
          },
          {
            key: 'market',
            header: 'Market',
            sortable: true,
            searchValue: row => row.marketType,
            render: row => row.marketType,
          },
          {
            key: 'plan',
            header: 'Plan',
            sortable: true,
            searchValue: row => row.selectedPlan,
            render: row => row.selectedPlan,
          },
          {
            key: 'mrr',
            header: 'Projected MRR',
            sortable: true,
            searchValue: row => String(row.projectedMrr),
            render: row => currency.format(row.projectedMrr),
          },
        ]}
      />
    </div>
  )
}
