import { AlertTriangle, CheckCircle2, HeartHandshake, ListChecks, Target, TrendingUp, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import {
  buildClientSuccessWorkspace,
  getClientSuccessPriorityTone,
  getClientSuccessSegmentTone,
  type ClientSuccessPortfolioRow,
  type ClientSuccessSegment,
} from '../../lib/client-success/clientSuccessWorkspace'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ClientSuccessWorkspacePageProps {
  session: AdminSession
  onOpenClient360: (organizationId: string) => void
}

const segmentFilters: Array<'All' | ClientSuccessSegment> = ['All', 'At Risk', 'Expansion', 'Onboarding', 'Adoption Gap', 'Healthy']
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function planStepTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Review') return 'warn'
  if (status === 'Ready') return 'ok'
  return 'neutral'
}

export default function ClientSuccessWorkspacePage({ session, onOpenClient360 }: ClientSuccessWorkspacePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const [selectedSegment, setSelectedSegment] = useState<'All' | ClientSuccessSegment>('All')
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const actionRequests = useMemo(() => {
    return [
      ...localRequests,
      ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
    ]
  }, [data.adminActionRequests, localRequests])
  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])
  const workspace = useMemo(() => buildClientSuccessWorkspace(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const rows = useMemo(() => workspace.rows.filter(row => selectedSegment === 'All' || row.segment === selectedSegment), [selectedSegment, workspace.rows])
  const selectedRow = rows.find(row => row.id === selectedId) ?? rows[0] ?? workspace.rows[0]

  const recordPlanReview = (row: ClientSuccessPortfolioRow) => {
    const result = runAdminAction(session, {
      permission: 'health.view',
      scope: row.organization.name,
      actionKey: 'client_success.plan_reviewed.mock',
      actionLabel: `Reviewed client success plan for ${row.organization.name}`,
      severity: row.priority === 'Critical' || row.priority === 'High' ? 'warning' : 'notice',
      metadata: {
        organizationId: row.organization.id,
        segment: row.segment,
        priority: row.priority,
        owner: row.owner,
        revenueAtRisk: row.revenueAtRisk,
        planSteps: row.successPlanSteps.map(step => step.id),
      },
    })
    setNotice(result.ok ? `Client success plan reviewed for ${row.organization.name}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Client Success"
        title="Client Success Workspace"
        description="Book-of-business command for retention risk, onboarding, adoption gaps, expansion readiness, next best actions, and success-plan review."
        action={<StatusPill label={`${sourceLabel} signals`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="At Risk" value={String(workspace.atRiskCount)} delta="Needs intervention" tone={workspace.atRiskCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Expansion" value={String(workspace.expansionCount)} delta="Ready for growth motion" tone="ok" icon={<TrendingUp size={16} />} />
        <MetricCard label="Onboarding" value={String(workspace.onboardingCount)} delta="Trial or setup motion" tone={workspace.onboardingCount ? 'warn' : 'ok'} icon={<UsersRound size={16} />} />
        <MetricCard label="Revenue At Risk" value={currency.format(workspace.revenueAtRisk)} delta={`${workspace.adoptionGapCount} adoption gap clients`} tone={workspace.revenueAtRisk ? 'danger' : 'ok'} icon={<Target size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Success Operating Loop</p>
          <h2>Retention, adoption, onboarding, and expansion in one view</h2>
          <span>This workspace records success-plan reviews only. Outreach, module, billing, and support mutations still require their own permissioned flows.</span>
        </div>
        <StatusPill label={`${workspace.rows.length} accounts`} tone="info" />
      </section>

      <div className="support-selector" aria-label="Client success segment filters">
        {segmentFilters.map(segment => (
          <button key={segment} className={selectedSegment === segment ? 'selected' : ''} onClick={() => setSelectedSegment(segment)}>
            <HeartHandshake size={15} strokeWidth={1.8} />
            {segment}
          </button>
        ))}
      </div>

      <div className="client-success-layout">
        <DataTable
          label="Success Portfolio"
          rows={rows}
          pageSize={8}
          emptyTitle="No accounts match the selected segment."
          columns={[
            {
              key: 'segment',
              header: 'Segment',
              sortable: true,
              searchValue: row => row.segment,
              render: row => <StatusPill label={row.segment} tone={getClientSuccessSegmentTone(row.segment)} />,
            },
            {
              key: 'client',
              header: 'Client',
              sortable: true,
              searchValue: row => `${row.organization.name} ${row.reason} ${row.nextAction}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.organization.name}</button>,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => row.priority,
              render: row => <StatusPill label={row.priority} tone={getClientSuccessPriorityTone(row.priority)} />,
            },
            {
              key: 'health',
              header: 'Health',
              sortable: true,
              searchValue: row => String(row.healthScore),
              render: row => `${row.healthScore}`,
            },
            {
              key: 'usage',
              header: 'Usage',
              sortable: true,
              searchValue: row => String(row.usageScore),
              render: row => `${row.usageScore}%`,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => <strong>{row.owner}</strong>,
            },
            {
              key: 'next',
              header: 'Next Action',
              sortable: true,
              searchValue: row => row.nextAction,
              render: row => row.nextAction,
            },
          ]}
        />

        <aside className="detail-panel client-success-detail-panel">
          {selectedRow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Success Plan</p>
                  <h2>{selectedRow.organization.name}</h2>
                </div>
                <StatusPill label={selectedRow.segment} tone={getClientSuccessSegmentTone(selectedRow.segment)} />
              </div>

              <div className="request-scope-list">
                <div><span>Owner</span><strong>{selectedRow.owner}</strong></div>
                <div><span>Priority</span><strong>{selectedRow.priority}</strong></div>
                <div><span>Health</span><strong>{selectedRow.healthScore}</strong></div>
                <div><span>Usage</span><strong>{selectedRow.usageScore}%</strong></div>
                <div><span>Expansion</span><strong>{selectedRow.expansionScore}</strong></div>
                <div><span>At Risk</span><strong>{currency.format(selectedRow.revenueAtRisk)}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Next Best Action</h3>
                <p className="muted-copy">{selectedRow.nextAction}</p>
                <p className="warning-copy">{selectedRow.reason}</p>
              </div>

              <div className="detail-section">
                <h3>Plan Steps</h3>
                <div className="success-plan-list">
                  {selectedRow.successPlanSteps.map(step => (
                    <article key={step.id} className="success-plan-step">
                      <div>
                        <strong>{step.label}</strong>
                        <StatusPill label={step.status} tone={planStepTone(step.status)} />
                      </div>
                      <span>{step.owner}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Account Signals</h3>
                <div className="request-scope-list">
                  <div><span>Open Issues</span><strong>{selectedRow.openIssues.length}</strong></div>
                  <div><span>Billing Risks</span><strong>{selectedRow.billingRisks.length}</strong></div>
                  <div><span>Usage Gaps</span><strong>{selectedRow.moduleUsageGaps.length}</strong></div>
                  <div><span>Action Requests</span><strong>{selectedRow.actionRequests.length}</strong></div>
                  <div><span>Agent Findings</span><strong>{selectedRow.agentEvents.length}</strong></div>
                  <div><span>Last Active</span><strong>{selectedRow.organization.lastActive}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Linked Work</h3>
                <div className="settings-rule-list">
                  {selectedRow.actionRequests.slice(0, 4).map(request => (
                    <div key={request.id}>
                      <ListChecks size={16} strokeWidth={1.8} />
                      <strong>{request.title} / {request.status}</strong>
                    </div>
                  ))}
                  {selectedRow.moduleUsageGaps.slice(0, 2).map(gap => (
                    <div key={gap.id}>
                      <Target size={16} strokeWidth={1.8} />
                      <strong>{gap.moduleName}: {gap.usageLast7Days} uses in 7 days</strong>
                    </div>
                  ))}
                  {!selectedRow.actionRequests.length && !selectedRow.moduleUsageGaps.length && (
                    <div>
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      <strong>No linked action request or module adoption gap.</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordPlanReview(selectedRow)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" onClick={() => onOpenClient360(selectedRow.organization.id)}>
                    <Target size={15} strokeWidth={1.8} />
                    Client 360
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No client selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
