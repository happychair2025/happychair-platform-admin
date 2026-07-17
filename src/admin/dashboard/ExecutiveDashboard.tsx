import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Compass,
  DatabaseZap,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { executiveMetrics, insightCards } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import type { AdminRole } from '../../lib/permissions/permissions'

interface ExecutiveDashboardProps {
  session: AdminSession
  onOpenPage: (page: string) => void
  canOpenPage: (page: string) => boolean
}

interface CommandLink {
  label: string
  page: string
  detail: string
}

interface RoleCommand {
  title: string
  focus: string
  firstMove: string
  links: CommandLink[]
}

type ReadinessTone = 'ok' | 'warn' | 'danger' | 'info'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const roleCommands: Record<AdminRole, RoleCommand> = {
  owner: {
    title: 'Owner command path',
    focus: 'Decide what matters today, protect revenue, and unblock the team.',
    firstMove: 'Review decisions, client risk, failed payments, and launch blockers before opening deeper workspaces.',
    links: [
      { label: 'Decision Room', page: 'owner-decision-room', detail: 'Owner calls and priority decisions.' },
      { label: 'Action Queue', page: 'command-work', detail: 'Work waiting for review or handoff.' },
      { label: 'Launch Gate', page: 'launch-readiness', detail: 'Production readiness and release blockers.' },
    ],
  },
  admin: {
    title: 'Admin operations path',
    focus: 'Control access, approvals, action requests, and platform setup.',
    firstMove: 'Start with pending approvals and server-adapter readiness before changing platform configuration.',
    links: [
      { label: 'Approval Center', page: 'approval-center', detail: 'Human approval before sensitive changes.' },
      { label: 'Action Requests', page: 'action-requests', detail: 'Queued admin actions and status.' },
      { label: 'Internal Access', page: 'settings', detail: 'Admin users, roles, and auth readiness.' },
    ],
  },
  support_lead: {
    title: 'Support lead path',
    focus: 'See what is broken, who owns it, and what can be safely fixed.',
    firstMove: 'Open the support workbench, then decide whether the issue is tenant-specific or a shared platform incident.',
    links: [
      { label: 'Support Center', page: 'support', detail: 'Open issues and support workload.' },
      { label: 'Venue Workbench', page: 'venue-support', detail: 'Venue-specific health and support context.' },
      { label: 'Troubleshooting', page: 'troubleshooting', detail: 'Runbooks, impact scope, and escalation path.' },
    ],
  },
  support_agent: {
    title: 'Support agent path',
    focus: 'Help the customer quickly without crossing safety boundaries.',
    firstMove: 'Start with the affected venue, capture a reason for any view-as request, and queue server actions when needed.',
    links: [
      { label: 'Venue Workbench', page: 'venue-support', detail: 'Current operational status by venue.' },
      { label: 'Troubleshooting', page: 'troubleshooting', detail: 'Support-safe runbooks and incident packets.' },
      { label: 'Support Center', page: 'support', detail: 'Open support queue and client context.' },
    ],
  },
  client_success: {
    title: 'Client success path',
    focus: 'Find adoption risk, expansion candidates, and clients that need a human touch.',
    firstMove: 'Review declining usage, inactive clients, and expansion candidates before opening client detail.',
    links: [
      { label: 'Client Success', page: 'client-success', detail: 'Success queue and outreach context.' },
      { label: 'Client 360', page: 'client-360', detail: 'Full organization health and activity.' },
      { label: 'Client Health', page: 'health', detail: 'Health score, adoption, and risk status.' },
    ],
  },
  finance: {
    title: 'Finance path',
    focus: 'Protect MRR, review billing risk, and keep financial actions auditable.',
    firstMove: 'Start with failed payments and past-due accounts, then review revenue movement by client and plan.',
    links: [
      { label: 'Revenue', page: 'revenue', detail: 'MRR, ARR, expansion, churn, and reactivation.' },
      { label: 'Billing', page: 'billing', detail: 'Failed payments, credits, discounts, and risk.' },
      { label: 'Reports', page: 'reports', detail: 'Finance-ready reporting views.' },
    ],
  },
  marketing: {
    title: 'Growth path',
    focus: 'Understand demand, campaign signals, and safe agent recommendations.',
    firstMove: 'Review registrations and agent findings before changing messaging, spend, or outreach.',
    links: [
      { label: 'Registrations', page: 'registrations', detail: 'Signup, trial, source, and market signals.' },
      { label: 'Lifecycle Command', page: 'lifecycle', detail: 'Trial and setup lifecycle opportunities.' },
      { label: 'Agent Foundation', page: 'agents', detail: 'Marketing, content, SEO, SEM, SDR, and success agents.' },
    ],
  },
  engineering: {
    title: 'Engineering path',
    focus: 'Protect platform reliability and separate support fixes from shared code defects.',
    firstMove: 'Check system health and server-adapter readiness before enabling any production mutation path.',
    links: [
      { label: 'System Health', page: 'system-health', detail: 'Platform-wide health and reliability signals.' },
      { label: 'Server Adapters', page: 'server-adapters', detail: 'Trusted handler readiness.' },
      { label: 'Troubleshooting', page: 'troubleshooting', detail: 'Impact scope and universal-code incident path.' },
    ],
  },
  read_only: {
    title: 'Read-only path',
    focus: 'Observe platform state without changing internal or customer records.',
    firstMove: 'Use Today for context, then inspect audit, reports, and health without taking actions.',
    links: [
      { label: 'Audit Logs', page: 'audit', detail: 'Review internal activity history.' },
      { label: 'Reports', page: 'reports', detail: 'View operating reports.' },
      { label: 'System Health', page: 'system-health', detail: 'Inspect platform health.' },
    ],
  },
}

function readinessTone(status: string): ReadinessTone {
  if (status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Live') return 'info'
  return 'warn'
}

function healthTone(value: number): 'ok' | 'warn' | 'danger' {
  if (value >= 80) return 'ok'
  if (value >= 60) return 'warn'
  return 'danger'
}

export default function ExecutiveDashboard({ session, onOpenPage, canOpenPage }: ExecutiveDashboardProps) {
  const { data, sourceLabel, status } = usePlatformData()
  const { organizations, supportIssues, billingRisks, usageAnalytics, agentDefinitions } = data
  const roleCommand = roleCommands[session.role]
  const availableRoleLinks = roleCommand.links.filter(link => canOpenPage(link.page))
  const openSupportIssues = supportIssues.filter(issue => issue.status !== 'Resolved')
  const urgentSupportIssues = openSupportIssues.filter(issue => issue.severity === 'critical' || issue.severity === 'warning')
  const atRiskMrr = billingRisks.reduce((total, risk) => total + risk.amountAtRisk, 0)
  const quietClients = usageAnalytics.filter(row => row.inactiveDays >= 7 || row.usageTrend === 'Declining')
  const expansionCandidates = organizations.filter(org => org.healthStatus === 'Expansion Candidate' || org.expansionScore >= 80)
  const readyAgents = agentDefinitions.filter(agent => agent.status === 'Monitoring Ready').length
  const averageHealth = Math.round(organizations.reduce((total, org) => total + org.healthScore, 0) / Math.max(organizations.length, 1))
  const productionReadiness = [
    {
      label: 'Internal auth',
      status: session.accessMode === 'managed_internal_preview' ? 'Review' : 'Ready',
      detail: session.accessMode === 'managed_internal_preview'
        ? 'Preview roster is active. Real internal auth must be connected before production.'
        : 'Verified internal auth session is active.',
      page: 'settings',
      icon: ShieldCheck,
    },
    {
      label: 'Read-only data',
      status: status === 'ready' ? 'Ready' : status === 'partial' ? 'Review' : 'Blocked',
      detail: status === 'ready'
        ? 'Supabase read-only views are serving this command center.'
        : `${sourceLabel} is active. Connect and verify read-only views before production use.`,
      page: 'data-quality',
      icon: DatabaseZap,
    },
    {
      label: 'Server actions',
      status: 'Review',
      detail: 'Sensitive changes are still queued for trusted server handlers and approval flow.',
      page: 'server-adapters',
      icon: ServerCog,
    },
    {
      label: 'Durable audit',
      status: 'Review',
      detail: 'Browser ledgers are useful for preview, but production needs server-recorded immutable audit.',
      page: 'audit',
      icon: LockKeyhole,
    },
  ]

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Today"
        title="Command Center"
        description="The shortest path to what needs attention, what is safe to do, and what still blocks production readiness."
      />

      <section className="today-command-panel" aria-label="Role command path">
        <div className="today-command-copy">
          <div className="module-icon" aria-hidden="true">
            <Compass size={20} strokeWidth={1.8} />
          </div>
          <div>
            <p className="eyebrow">{roleCommand.title}</p>
            <h2>{roleCommand.focus}</h2>
            <span>{roleCommand.firstMove}</span>
          </div>
        </div>
        <div className="today-command-actions">
          {availableRoleLinks.map(link => (
            <button key={link.page} className="today-command-link" onClick={() => onOpenPage(link.page)}>
              <span>
                <strong>{link.label}</strong>
                <small>{link.detail}</small>
              </span>
              <ArrowRight size={15} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </section>

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

      <section className="today-signal-grid" aria-label="Today signals">
        <article className="today-signal-card tone-warn">
          <StatusPill label="Support" tone={urgentSupportIssues.length ? 'warn' : 'ok'} />
          <strong>{urgentSupportIssues.length}</strong>
          <span>urgent support issue{urgentSupportIssues.length === 1 ? '' : 's'} open.</span>
        </article>
        <article className="today-signal-card tone-danger">
          <StatusPill label="Finance" tone={atRiskMrr ? 'danger' : 'ok'} />
          <strong>{currency.format(atRiskMrr)}</strong>
          <span>MRR currently at billing risk.</span>
        </article>
        <article className="today-signal-card tone-warn">
          <StatusPill label="Success" tone={quietClients.length ? 'warn' : 'ok'} />
          <strong>{quietClients.length}</strong>
          <span>client{quietClients.length === 1 ? '' : 's'} quiet or declining.</span>
        </article>
        <article className="today-signal-card tone-ok">
          <StatusPill label="Expansion" tone="ok" />
          <strong>{expansionCandidates.length}</strong>
          <span>client{expansionCandidates.length === 1 ? '' : 's'} ready for premium review.</span>
        </article>
        <article className="today-signal-card tone-info">
          <StatusPill label="Agents" tone="info" />
          <strong>{readyAgents}</strong>
          <span>read-only agent workflow{readyAgents === 1 ? '' : 's'} monitoring.</span>
        </article>
        <article className="today-signal-card tone-ok">
          <StatusPill label="Health" tone={healthTone(averageHealth)} />
          <strong>{averageHealth}%</strong>
          <span>average client health score.</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Production Readiness Spine</h2>
            <span>Keep these four items visible until Platform Admin is truly production-safe.</span>
          </div>
          <StatusPill label="Do No Harm" tone="warn" />
        </div>
        <div className="readiness-spine-grid">
          {productionReadiness.map(item => {
            const Icon = item.icon
            const tone = readinessTone(item.status)
            return (
              <button
                key={item.label}
                className={`readiness-spine-item tone-${tone}`}
                disabled={!canOpenPage(item.page)}
                onClick={() => onOpenPage(item.page)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <StatusPill label={item.status} tone={tone === 'danger' ? 'danger' : tone === 'ok' ? 'ok' : 'warn'} />
              </button>
            )
          })}
        </div>
      </section>

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
              <span>{billingRisks.length} account{billingRisks.length === 1 ? '' : 's'} need payment follow-up.</span>
            </div>
            <div>
              <StatusPill label="Success" tone="warn" />
              <strong>Reactivate quiet clients</strong>
              <span>{quietClients.length} account{quietClients.length === 1 ? '' : 's'} have declining or inactive usage.</span>
            </div>
            <div>
              <StatusPill label="Owner" tone="ok" />
              <strong>Review expansion candidates</strong>
              <span>{expansionCandidates.length} client{expansionCandidates.length === 1 ? '' : 's'} are ready for premium module review.</span>
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
