import { AlertTriangle, CircleDollarSign, CreditCard, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import type { RevenueMetricRecord } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const readable = (value: string) => value.split('_').join(' ')

function sumMetric(revenueMetrics: RevenueMetricRecord[], type: string) {
  return revenueMetrics.filter(row => row.metricType === type).reduce((sum, row) => sum + row.amount, 0)
}

function groupRevenueBy(revenueMetrics: RevenueMetricRecord[], key: 'plan' | 'moduleName' | 'marketType' | 'acquisitionChannel') {
  return revenueMetrics.reduce<Record<string, number>>((acc, row) => {
    const label = row[key] ?? 'Unattributed'
    acc[label] = (acc[label] ?? 0) + row.amount
    return acc
  }, {})
}

export default function RevenuePage() {
  const { data } = usePlatformData()
  const { billingRisks, revenueMetrics } = data
  const mrr = sumMetric(revenueMetrics, 'mrr') + sumMetric(revenueMetrics, 'new_mrr') + sumMetric(revenueMetrics, 'expansion_mrr') - sumMetric(revenueMetrics, 'churned_mrr')
  const arr = mrr * 12
  const newMrr = sumMetric(revenueMetrics, 'new_mrr')
  const expansionMrr = sumMetric(revenueMetrics, 'expansion_mrr')
  const churnedMrr = sumMetric(revenueMetrics, 'churned_mrr')
  const failedPayments = billingRisks.reduce((sum, row) => sum + row.amountAtRisk, 0)
  const revenueByPlan = groupRevenueBy(revenueMetrics, 'plan')
  const revenueByModule = groupRevenueBy(revenueMetrics, 'moduleName')
  const revenueByMarket = groupRevenueBy(revenueMetrics, 'marketType')
  const arpa = Math.round(mrr / Math.max(1, new Set(revenueMetrics.map(row => row.organizationName)).size))

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Finance Command"
        title="Revenue"
        description="MRR, ARR, new MRR, expansion, churn, failed payments, revenue segmentation, and finance risk."
      />

      <div className="metrics-grid">
        <MetricCard label="MRR" value={currency.format(mrr)} delta="Provider-agnostic model" tone="ok" icon={<CircleDollarSign size={16} />} />
        <MetricCard label="ARR" value={currency.format(arr)} delta="MRR x 12" tone="ok" icon={<TrendingUp size={16} />} />
        <MetricCard label="New MRR" value={currency.format(newMrr)} delta="Trial conversion path" tone="ok" icon={<TrendingUp size={16} />} />
        <MetricCard label="Expansion MRR" value={currency.format(expansionMrr)} delta="Module expansion" tone="ok" icon={<RefreshCcw size={16} />} />
        <MetricCard label="Churned MRR" value={currency.format(churnedMrr)} delta="Recovery watch" tone="danger" icon={<TrendingDown size={16} />} />
        <MetricCard label="At-Risk MRR" value={currency.format(failedPayments)} delta={`${billingRisks.length} billing risks`} tone="warn" icon={<AlertTriangle size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Revenue By Plan</h2>
              <span>Plan-level SaaS performance</span>
            </div>
          </div>
          <SegmentRevenueList rows={revenueByPlan} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Finance Action Queue</h2>
              <span>Failed payments, past due, discounts, credits</span>
            </div>
            <CreditCard size={18} strokeWidth={1.8} />
          </div>
          <div className="usage-gap-list">
            {billingRisks.map(risk => (
              <article key={risk.id} className="usage-gap-item">
                <div className="timeline-title">
                  <strong>{risk.organizationName}</strong>
                  <StatusPill label={risk.billingStatus} tone={risk.billingStatus === 'Failed Payment' ? 'danger' : 'warn'} />
                </div>
                <p>{currency.format(risk.amountAtRisk)} at risk / {currency.format(risk.mrr)} MRR.</p>
                <span>{risk.nextAction}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Revenue By Module</h2>
              <span>Module attribution placeholder</span>
            </div>
          </div>
          <SegmentRevenueList rows={revenueByModule} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Revenue By Market</h2>
              <span>Segment performance</span>
            </div>
          </div>
          <SegmentRevenueList rows={revenueByMarket} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Finance Summary</h2>
            <span>ARPA and conversion-ready placeholders</span>
          </div>
        </div>
        <div className="finance-summary-grid">
          <div><strong>{currency.format(arpa)}</strong><span>Average revenue per account</span></div>
          <div><strong>42%</strong><span>Trial-to-paid conversion placeholder</span></div>
          <div><strong>{currency.format(expansionMrr)}</strong><span>Expansion from premium modules</span></div>
          <div><strong>{currency.format(failedPayments)}</strong><span>Failed and past-due exposure</span></div>
        </div>
      </section>

      <DataTable
        label="Revenue Records"
        rows={revenueMetrics}
        columns={[
          {
            key: 'organization',
            header: 'Client',
            sortable: true,
            searchValue: row => row.organizationName,
            render: row => <strong>{row.organizationName}</strong>,
          },
          {
            key: 'metric',
            header: 'Metric',
            sortable: true,
            searchValue: row => row.metricType,
            render: row => <StatusPill label={readable(row.metricType)} tone={row.metricType === 'churned_mrr' ? 'danger' : row.metricType === 'expansion_mrr' ? 'ok' : 'info'} />,
          },
          {
            key: 'amount',
            header: 'Amount',
            sortable: true,
            searchValue: row => String(row.amount),
            render: row => currency.format(row.amount),
          },
          {
            key: 'plan',
            header: 'Plan',
            sortable: true,
            searchValue: row => row.plan,
            render: row => row.plan,
          },
          {
            key: 'module',
            header: 'Module',
            sortable: true,
            searchValue: row => row.moduleName ?? 'Unattributed',
            render: row => row.moduleName ?? 'Unattributed',
          },
          {
            key: 'source',
            header: 'Source',
            sortable: true,
            searchValue: row => row.source,
            render: row => readable(row.source),
          },
        ]}
      />
    </div>
  )
}

function SegmentRevenueList({ rows }: { rows: Record<string, number> }) {
  const max = Math.max(...Object.values(rows), 1)

  return (
    <div className="segment-revenue-list">
      {Object.entries(rows).map(([label, value]) => (
        <div key={label} className="segment-revenue-row">
          <div>
            <strong>{label}</strong>
            <span>{currency.format(value)}</span>
          </div>
          <div className="score-track">
            <span style={{ width: `${Math.max(8, Math.round((value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
