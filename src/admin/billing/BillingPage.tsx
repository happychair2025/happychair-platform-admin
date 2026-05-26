import { AlertTriangle, CheckCircle2, CreditCard, FileText, RefreshCcw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface BillingPageProps {
  session: AdminSession
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function billingTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'Failed Payment') return 'danger'
  if (status === 'Past Due' || status === 'Trial') return 'warn'
  return 'ok'
}

export default function BillingPage({ session }: BillingPageProps) {
  const { data } = usePlatformData()
  const [notice, setNotice] = useState('')
  const canManage = hasPermission(session.role, 'billing.manage')
  const currentAccounts = data.organizations.filter(org => org.billingStatus === 'Current')
  const trialAccounts = data.organizations.filter(org => org.billingStatus === 'Trial')
  const failedAccounts = data.organizations.filter(org => org.billingStatus === 'Failed Payment')
  const atRiskMrr = data.billingRisks.reduce((sum, row) => sum + row.amountAtRisk, 0)
  const totalMrr = data.organizations.reduce((sum, row) => sum + row.mrr, 0)

  const recordBillingReview = (scope: string, severity: 'notice' | 'warning' = 'notice') => {
    const result = runAdminAction(session, {
      permission: 'billing.manage',
      scope,
      actionKey: 'billing.reviewed.mock',
      actionLabel: `Reviewed billing account for ${scope}`,
      severity,
    })
    setNotice(result.ok ? `Billing review for ${scope} recorded in Audit Logs.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Finance Operations"
        title="Billing"
        description="Billing status, payment risk, provider readiness, credits, discounts, and account-level finance action queues."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Current Accounts" value={String(currentAccounts.length)} delta="Billing healthy" tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Trials" value={String(trialAccounts.length)} delta="Conversion watch" tone="warn" icon={<RefreshCcw size={16} />} />
        <MetricCard label="Failed Payments" value={String(failedAccounts.length)} delta="Immediate risk" tone={failedAccounts.length ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="At-Risk MRR" value={currency.format(atRiskMrr)} delta={`${currency.format(totalMrr)} tracked MRR`} tone={atRiskMrr ? 'warn' : 'ok'} icon={<CreditCard size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Billing Provider Readiness</h2>
              <span>Structured for Stripe, QuickBooks, or future provider sync</span>
            </div>
            <ShieldCheck size={18} strokeWidth={1.8} />
          </div>
          <div className="settings-rule-list">
            <div><CheckCircle2 size={16} strokeWidth={1.8} /><strong>Provider-agnostic revenue metrics are modeled.</strong></div>
            <div><CheckCircle2 size={16} strokeWidth={1.8} /><strong>Failed payment and past-due queues are separated from revenue reporting.</strong></div>
            <div><AlertTriangle size={16} strokeWidth={1.8} /><strong>Real refunds, discounts, and credits still need server-side provider actions.</strong></div>
            <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>All future billing mutations must require finance permission and audit logs.</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Finance Action Queue</h2>
              <span>Payment and commercial risks needing follow-up</span>
            </div>
          </div>
          <div className="usage-gap-list">
            {data.billingRisks.map(risk => (
              <article key={risk.id} className="usage-gap-item">
                <div className="timeline-title">
                  <strong>{risk.organizationName}</strong>
                  <StatusPill label={risk.billingStatus} tone={risk.billingStatus === 'Failed Payment' ? 'danger' : 'warn'} />
                </div>
                <p>{currency.format(risk.amountAtRisk)} at risk / {currency.format(risk.mrr)} MRR.</p>
                <span>{risk.nextAction}</span>
                <button className="ghost-action" disabled={!canManage} onClick={() => recordBillingReview(risk.organizationName, 'warning')}>
                  <FileText size={15} strokeWidth={1.8} />
                  Record Review
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <DataTable
        label="Billing Accounts"
        rows={data.organizations}
        columns={[
          {
            key: 'client',
            header: 'Client',
            sortable: true,
            searchValue: row => row.name,
            render: row => <button className="table-link" onClick={() => recordBillingReview(row.name)}>{row.name}</button>,
          },
          {
            key: 'plan',
            header: 'Plan',
            sortable: true,
            searchValue: row => row.plan,
            render: row => row.plan,
          },
          {
            key: 'billing',
            header: 'Billing',
            sortable: true,
            searchValue: row => row.billingStatus,
            render: row => <StatusPill label={row.billingStatus} tone={billingTone(row.billingStatus)} />,
          },
          {
            key: 'mrr',
            header: 'MRR',
            sortable: true,
            searchValue: row => String(row.mrr),
            render: row => currency.format(row.mrr),
          },
          {
            key: 'market',
            header: 'Market',
            sortable: true,
            searchValue: row => row.marketType,
            render: row => row.marketType,
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
