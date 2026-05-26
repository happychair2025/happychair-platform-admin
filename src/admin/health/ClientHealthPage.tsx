import { AlertTriangle, CheckCircle2, HeartPulse, TrendingUp, UsersRound } from 'lucide-react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { appendAuditEvent } from '../../lib/audit/auditLog'
import type { ClientHealthStatus } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { roleLabels } from '../../lib/permissions/permissions'

interface ClientHealthPageProps {
  session: AdminSession
}

function healthTone(status: ClientHealthStatus): 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'At Risk') return 'danger'
  if (status === 'Needs Attention') return 'warn'
  if (status === 'Expansion Candidate') return 'info'
  return 'ok'
}

export default function ClientHealthPage({ session }: ClientHealthPageProps) {
  const { data } = usePlatformData()
  const healthyClients = data.organizations.filter(org => org.healthStatus === 'Healthy' || org.healthStatus === 'Growing')
  const atRiskClients = data.organizations.filter(org => org.healthStatus === 'At Risk' || org.accountStatus === 'At Risk')
  const expansionCandidates = data.organizations.filter(org => org.healthStatus === 'Expansion Candidate' || org.expansionScore >= 80)
  const inactiveClients = data.usageAnalytics.filter(row => row.inactiveDays >= 7)
  const supportRiskClients = data.supportIssues.filter(issue => issue.severity === 'critical' || issue.severity === 'warning')

  const recordReview = (scope: string) => {
    appendAuditEvent({
      actor: session.name,
      actorRole: roleLabels[session.role],
      scope,
      actionKey: 'client_health.reviewed.mock',
      actionLabel: `Reviewed client health for ${scope}`,
      severity: 'notice',
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Client Success"
        title="Client Health"
        description="Health score, adoption, billing, support, setup, inactivity, and expansion signals across every client."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Healthy Clients" value={String(healthyClients.length)} delta="Healthy or growing" tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="At Risk" value={String(atRiskClients.length)} delta="Needs intervention" tone={atRiskClients.length ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Expansion Candidates" value={String(expansionCandidates.length)} delta="Strong usage or score" tone="ok" icon={<TrendingUp size={16} />} />
        <MetricCard label="Inactive 7d" value={String(inactiveClients.length)} delta="No meaningful usage" tone={inactiveClients.length ? 'warn' : 'ok'} icon={<UsersRound size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Health Segments</h2>
              <span>Client distribution by current status</span>
            </div>
            <HeartPulse size={18} strokeWidth={1.8} />
          </div>
          <div className="adoption-list">
            {['Healthy', 'Growing', 'Needs Attention', 'At Risk', 'Expansion Candidate'].map(status => {
              const count = data.organizations.filter(org => org.healthStatus === status).length
              const width = Math.max(8, Math.round((count / Math.max(1, data.organizations.length)) * 100))
              return (
                <article key={status} className="adoption-item">
                  <div>
                    <strong>{status}</strong>
                    <span>{count} clients in segment</span>
                  </div>
                  <div className="score-track"><span style={{ width: `${width}%` }} /></div>
                  <StatusPill label={`${width}%`} tone={status === 'At Risk' ? 'danger' : status === 'Needs Attention' ? 'warn' : 'ok'} />
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Risk Drivers</h2>
              <span>Signals that should create follow-up work</span>
            </div>
          </div>
          <div className="usage-gap-list">
            {supportRiskClients.slice(0, 4).map(issue => (
              <article key={issue.id} className="usage-gap-item">
                <div className="timeline-title">
                  <strong>{issue.organizationName}</strong>
                  <StatusPill label={issue.severity} tone={issue.severity === 'critical' ? 'danger' : 'warn'} />
                </div>
                <p>{issue.issueType} at {issue.venueName}.</p>
                <span>{issue.recommendedAction}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Expansion Watch</h2>
              <span>Clients with strong usage or premium module signals</span>
            </div>
          </div>
          <div className="queue-list">
            {expansionCandidates.map(org => (
              <div key={org.id}>
                <StatusPill label={org.healthStatus} tone={healthTone(org.healthStatus)} />
                <strong>{org.name}</strong>
                <span>{org.expansionScore} expansion score / {org.enabledModules.join(', ')}.</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Inactivity Watch</h2>
              <span>Clients that need support or success outreach</span>
            </div>
          </div>
          <div className="queue-list">
            {inactiveClients.length ? inactiveClients.map(row => (
              <div key={row.id}>
                <StatusPill label={row.usageTrend} tone={row.usageTrend === 'Declining' ? 'danger' : 'warn'} />
                <strong>{row.organizationName}</strong>
                <span>{row.inactiveDays} inactive days / {row.moduleUsage7d} module events.</span>
              </div>
            )) : <div><strong>No inactivity risk detected.</strong><span>All tracked clients have recent activity.</span></div>}
          </div>
        </section>
      </div>

      <DataTable
        label="Client Health Scores"
        rows={data.organizations}
        columns={[
          {
            key: 'client',
            header: 'Client',
            sortable: true,
            searchValue: row => row.name,
            render: row => <button className="table-link" onClick={() => recordReview(row.name)}>{row.name}</button>,
          },
          {
            key: 'health',
            header: 'Health',
            sortable: true,
            searchValue: row => row.healthStatus,
            render: row => <StatusPill label={row.healthStatus} tone={healthTone(row.healthStatus)} />,
          },
          {
            key: 'score',
            header: 'Score',
            sortable: true,
            searchValue: row => String(row.healthScore),
            render: row => row.healthScore,
          },
          {
            key: 'usage',
            header: 'Usage',
            sortable: true,
            searchValue: row => String(row.usageScore),
            render: row => `${row.usageScore}%`,
          },
          {
            key: 'billing',
            header: 'Billing',
            sortable: true,
            searchValue: row => row.billingStatus,
            render: row => <StatusPill label={row.billingStatus} tone={row.billingStatus === 'Failed Payment' ? 'danger' : row.billingStatus === 'Trial' ? 'warn' : 'ok'} />,
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
