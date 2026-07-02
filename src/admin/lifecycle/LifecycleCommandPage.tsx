import { AlertTriangle, CheckCircle2, CircleDollarSign, MailCheck, Send, ShieldCheck, Target, UsersRound, Workflow } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import {
  buildLifecycleCommand,
  getLifecyclePriorityTone,
  getLifecycleStatusTone,
  getLifecycleTriggerTone,
  type LifecycleCommandRow,
  type LifecycleOwner,
} from '../../lib/lifecycle/lifecycleCommand'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface LifecycleCommandPageProps {
  session: AdminSession
}

const ownerFilters: Array<'All' | LifecycleOwner> = ['All', 'Client Success', 'Marketing', 'Sales', 'Support', 'Finance', 'Owner']
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function LifecycleCommandPage({ session }: LifecycleCommandPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localAgentRuns = useLocalAgentRuns()
  const [selectedOwner, setSelectedOwner] = useState<'All' | LifecycleOwner>('All')
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const canQueue = hasPermission(session.role, 'admin_actions.manage')
  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])
  const model = useMemo(() => buildLifecycleCommand(data, agentEvents), [agentEvents, data])
  const rows = useMemo(() => model.rows.filter(row => selectedOwner === 'All' || row.owner === selectedOwner), [model.rows, selectedOwner])
  const selectedRow = rows.find(row => row.id === selectedId) ?? rows[0] ?? model.rows[0]

  const recordReview = (row: LifecycleCommandRow) => {
    const result = runAdminAction(session, {
      permission: 'registrations.view',
      scope: row.organizationName,
      actionKey: 'lifecycle.command_reviewed.mock',
      actionLabel: `Reviewed lifecycle recommendation for ${row.organizationName}`,
      severity: row.priority === 'Critical' || row.priority === 'High' ? 'warning' : 'notice',
      metadata: {
        lifecycleTrigger: row.trigger,
        owner: row.owner,
        confidence: row.confidence,
        revenueImpact: row.revenueImpact,
        source: row.source,
      },
    })
    setNotice(result.ok ? `Lifecycle review recorded for ${row.organizationName}.` : result.message)
  }

  const queueFollowUp = (row: LifecycleCommandRow) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `${row.trigger}: ${row.organizationName}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({
        organizationId: row.organization?.id,
        organizationName: row.organizationName,
        label: row.organizationName,
      }),
      reason: row.recommendedAction,
      rollbackNotes: 'Keep lifecycle recommendation in review state. Do not send outreach, change billing, change modules, or alter customer state from the browser.',
      severity: row.priority === 'Critical' ? 'critical' : row.priority === 'High' ? 'warning' : 'notice',
      metadata: {
        lifecycleRowId: row.id,
        lifecycleTrigger: row.trigger,
        owner: row.owner,
        source: row.source,
        humanApprovalRequired: row.humanApprovalRequired,
        contactEmail: row.contactEmail,
        revenueImpact: row.revenueImpact,
      },
    })
    setNotice(result.ok ? `Human follow-up request queued for ${row.organizationName}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Growth And Retention"
        title="Lifecycle Command"
        description="Human-reviewed lifecycle triggers for demo follow-up, trial conversion, setup rescue, module adoption, billing save motions, expansion, and agent handoffs."
        action={<StatusPill label={`${sourceLabel} lifecycle signals`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Triggers" value={String(model.rows.length)} delta="Cross-functional motions" tone="neutral" icon={<Workflow size={16} />} />
        <MetricCard label="Critical" value={String(model.criticalCount)} delta="Needs owner attention" tone={model.criticalCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Approval Required" value={String(model.approvalRequiredCount)} delta="No silent automation" tone="warn" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Pipeline Impact" value={currency.format(model.pipelineMrr)} delta={`${model.agentHandoffCount} agent handoffs`} tone="ok" icon={<CircleDollarSign size={16} />} />
      </div>

      <section className="panel lifecycle-safety-panel">
        <div>
          <p className="eyebrow">Lifecycle Safety</p>
          <h2>Draft, classify, and queue; never silently mutate client state</h2>
          <span>Outreach, billing, module, and support changes stay behind permissioned workflows. This page creates reviewed recommendations and action requests only.</span>
        </div>
        <StatusPill label={canQueue ? 'Action Queue Ready' : 'Review Only'} tone={canQueue ? 'ok' : 'warn'} />
      </section>

      <div className="support-selector" aria-label="Lifecycle owner filters">
        {ownerFilters.map(owner => (
          <button key={owner} className={selectedOwner === owner ? 'selected' : ''} onClick={() => setSelectedOwner(owner)}>
            <UsersRound size={15} strokeWidth={1.8} />
            {owner}
          </button>
        ))}
      </div>

      <div className="lifecycle-layout">
        <DataTable
          label="Lifecycle Queue"
          rows={rows}
          pageSize={8}
          emptyTitle="No lifecycle triggers match this owner."
          columns={[
            {
              key: 'trigger',
              header: 'Trigger',
              sortable: true,
              searchValue: row => row.trigger,
              render: row => <StatusPill label={row.trigger} tone={getLifecycleTriggerTone(row.trigger)} />,
            },
            {
              key: 'client',
              header: 'Client',
              sortable: true,
              searchValue: row => `${row.organizationName} ${row.contactEmail ?? ''} ${row.title}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.organizationName}</button>,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => row.priority,
              render: row => <StatusPill label={row.priority} tone={getLifecyclePriorityTone(row.priority)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'impact',
              header: 'Impact',
              sortable: true,
              searchValue: row => String(row.revenueImpact),
              render: row => currency.format(row.revenueImpact),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getLifecycleStatusTone(row.status)} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => row.source,
              render: row => row.source,
            },
          ]}
        />

        <aside className="detail-panel lifecycle-detail-panel">
          {selectedRow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Lifecycle Detail</p>
                  <h2>{selectedRow.title}</h2>
                </div>
                <StatusPill label={selectedRow.priority} tone={getLifecyclePriorityTone(selectedRow.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Owner</span><strong>{selectedRow.owner}</strong></div>
                <div><span>Status</span><strong>{selectedRow.status}</strong></div>
                <div><span>Impact</span><strong>{currency.format(selectedRow.revenueImpact)}</strong></div>
                <div><span>Confidence</span><strong>{selectedRow.confidence}%</strong></div>
                <div><span>Contact</span><strong>{selectedRow.contactEmail ?? 'Not attached'}</strong></div>
                <div><span>Source</span><strong>{selectedRow.source}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Recommended Action</h3>
                <p className="muted-copy">{selectedRow.recommendedAction}</p>
                <p className="warning-copy">{selectedRow.reason}</p>
              </div>

              <div className="detail-section">
                <h3>Review Gates</h3>
                <div className="settings-rule-list">
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>{selectedRow.humanApprovalRequired ? 'Human approval required before action.' : 'Review can be recorded without queueing a mutation.'}</strong></div>
                  <div><MailCheck size={16} strokeWidth={1.8} /><strong>No customer email or outreach is sent from this page.</strong></div>
                  <div><Target size={16} strokeWidth={1.8} /><strong>{selectedRow.auditRequired ? 'Audit required for follow-up.' : 'Audit optional for low-risk review.'}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordReview(selectedRow)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" disabled={!canQueue} onClick={() => queueFollowUp(selectedRow)}>
                    <Send size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No lifecycle trigger selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
