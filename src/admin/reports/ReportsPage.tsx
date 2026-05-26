import { BarChart3, CalendarClock, Download, FileBarChart, ShieldCheck, TableProperties } from 'lucide-react'
import { useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface ReportsPageProps {
  session: AdminSession
}

interface ReportDefinition {
  id: string
  name: string
  owner: 'Owner' | 'Finance' | 'Client Success' | 'Support' | 'Marketing'
  cadence: 'Daily' | 'Weekly' | 'Monthly' | 'On Demand'
  status: 'Ready' | 'Needs Data' | 'Draft'
  sourceViews: string[]
  description: string
}

const reportDefinitions: ReportDefinition[] = [
  {
    id: 'executive-weekly',
    name: 'Executive Weekly Operating Report',
    owner: 'Owner',
    cadence: 'Weekly',
    status: 'Ready',
    sourceViews: ['organizations', 'usageAnalytics', 'revenueMetrics'],
    description: 'Weekly rollup of signups, revenue, client health, usage, and expansion signals.',
  },
  {
    id: 'finance-mrr',
    name: 'MRR And Payment Risk Report',
    owner: 'Finance',
    cadence: 'Weekly',
    status: 'Ready',
    sourceViews: ['revenueMetrics', 'billingRisks'],
    description: 'MRR, ARR, expansion, churn, failed payments, discounts, and revenue segmentation.',
  },
  {
    id: 'support-health',
    name: 'Support And Health Report',
    owner: 'Support',
    cadence: 'Daily',
    status: 'Ready',
    sourceViews: ['supportIssues', 'platformHealthSignals', 'activityEvents'],
    description: 'Critical support issues, health checks, troubleshooting history, and escalation trends.',
  },
  {
    id: 'success-adoption',
    name: 'Client Success Adoption Report',
    owner: 'Client Success',
    cadence: 'Weekly',
    status: 'Ready',
    sourceViews: ['usageAnalytics', 'moduleAdoption', 'moduleUsageGaps'],
    description: 'Usage growth, inactive clients, module adoption, underconfigured clients, and upsell candidates.',
  },
  {
    id: 'marketing-conversion',
    name: 'Marketing Conversion Report',
    owner: 'Marketing',
    cadence: 'Monthly',
    status: 'Draft',
    sourceViews: ['registrations', 'agentEvents'],
    description: 'Signup source quality, campaign conversion, property type demand, and lifecycle triggers.',
  },
]

function statusTone(status: ReportDefinition['status']): 'ok' | 'warn' | 'neutral' {
  if (status === 'Ready') return 'ok'
  if (status === 'Needs Data') return 'warn'
  return 'neutral'
}

export default function ReportsPage({ session }: ReportsPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const [notice, setNotice] = useState('')
  const canExport = hasPermission(session.role, 'reports.export')
  const readyReports = reportDefinitions.filter(report => report.status === 'Ready')
  const scheduledReports = reportDefinitions.filter(report => report.cadence !== 'On Demand')
  const exportReadyViews = [
    data.organizations.length,
    data.usageAnalytics.length,
    data.revenueMetrics.length,
    data.supportIssues.length,
    data.registrations.length,
  ].filter(count => count > 0).length

  const recordExportReview = (report: ReportDefinition) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: report.name,
      actionKey: 'reports.export_reviewed.mock',
      actionLabel: `Reviewed export readiness for ${report.name}`,
      severity: 'notice',
    })
    setNotice(result.ok ? `${report.name} export review recorded in Audit Logs.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operating Reports"
        title="Reports"
        description="Export-ready reporting structure for ownership, finance, support, client success, marketing, and future AI-agent summaries."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Report Templates" value={String(reportDefinitions.length)} delta="Role-specific outputs" tone="neutral" icon={<FileBarChart size={16} />} />
        <MetricCard label="Ready" value={String(readyReports.length)} delta="Can be reviewed today" tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Scheduled" value={String(scheduledReports.length)} delta="Cadence placeholders" tone="ok" icon={<CalendarClock size={16} />} />
        <MetricCard label="Data Sources" value={`${exportReadyViews}/5`} delta={sourceLabel} tone="ok" icon={<TableProperties size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Report Catalog</h2>
              <span>Role-specific operating reports</span>
            </div>
            <BarChart3 size={18} strokeWidth={1.8} />
          </div>
          <div className="usage-gap-list">
            {reportDefinitions.map(report => (
              <article key={report.id} className="usage-gap-item">
                <div className="timeline-title">
                  <strong>{report.name}</strong>
                  <StatusPill label={report.status} tone={statusTone(report.status)} />
                </div>
                <p>{report.description}</p>
                <span>{report.owner} / {report.cadence} / {report.sourceViews.join(', ')}</span>
                <button className="ghost-action" disabled={!canExport} onClick={() => recordExportReview(report)}>
                  <Download size={15} strokeWidth={1.8} />
                  Review Export
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Export Guardrails</h2>
              <span>Production report exports must be auditable</span>
            </div>
          </div>
          <div className="settings-rule-list">
            <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Exports require role permission and audit records.</strong></div>
            <div><TableProperties size={16} strokeWidth={1.8} /><strong>Reports should read from reviewed views, not ad hoc table queries.</strong></div>
            <div><CalendarClock size={16} strokeWidth={1.8} /><strong>Scheduled delivery remains disabled until email/provider permissions exist.</strong></div>
            <div><Download size={16} strokeWidth={1.8} /><strong>CSV and PDF actions need server-side export workers before production.</strong></div>
          </div>
        </section>
      </div>

      <DataTable
        label="Report Readiness"
        rows={reportDefinitions}
        columns={[
          {
            key: 'name',
            header: 'Report',
            sortable: true,
            searchValue: row => row.name,
            render: row => <strong>{row.name}</strong>,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
          {
            key: 'cadence',
            header: 'Cadence',
            sortable: true,
            searchValue: row => row.cadence,
            render: row => row.cadence,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
          },
          {
            key: 'sources',
            header: 'Sources',
            searchValue: row => row.sourceViews.join(' '),
            render: row => row.sourceViews.join(', '),
          },
        ]}
      />
    </div>
  )
}
