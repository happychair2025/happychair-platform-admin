import { AlertTriangle, BellRing, Bot, CheckCircle2, CircleDollarSign, Clock3, HeartPulse, ListChecks, ShieldCheck } from 'lucide-react'
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
  buildAttentionQueue,
  getAttentionPriorityTone,
  getAttentionStatusTone,
  type AttentionCategory,
  type AttentionQueueItem,
} from '../../lib/attention/attentionQueue'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface AttentionQueuePageProps {
  session: AdminSession
  onOpenActionRequests: () => void
}

function categoryTone(category: AttentionCategory): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (category === 'Support' || category === 'Health') return 'danger'
  if (category === 'Billing') return 'warn'
  if (category === 'Usage' || category === 'Agent') return 'info'
  return 'neutral'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function sortValue(item: AttentionQueueItem) {
  return `${String(100 - item.priorityScore).padStart(3, '0')} ${item.createdAt}`
}

export default function AttentionQueuePage({ session, onOpenActionRequests }: AttentionQueuePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
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

  const items = useMemo(() => buildAttentionQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const selectedItem = items.find(item => item.id === selectedId) ?? items[0]
  const criticalCount = items.filter(item => item.priority === 'Critical').length
  const highPriorityCount = items.filter(item => item.priority === 'Critical' || item.priority === 'High').length
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const actionRequestCount = items.filter(item => item.category === 'Action Request').length
  const agentFindingCount = items.filter(item => item.category === 'Agent').length

  const recordTriage = (item: AttentionQueueItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: 'attention_queue.triage_reviewed.mock',
      actionLabel: `Reviewed attention item: ${item.title}`,
      severity: item.priority === 'Critical' || item.priority === 'High' ? 'warning' : 'notice',
      metadata: {
        attentionItemId: item.id,
        category: item.category,
        priority: item.priority,
        status: item.status,
        source: item.source,
        relatedRecordId: item.relatedRecordId,
        actionRequestId: item.actionRequestId,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`Triage review recorded for ${item.title}.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Command Loop"
        title="Unified Attention Queue"
        description="One prioritized operating queue for support risk, billing risk, usage gaps, platform health, agent findings, and action requests."
        action={<StatusPill label={`${sourceLabel} signals`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Critical" value={String(criticalCount)} delta="Immediate owner review" tone={criticalCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="High Priority" value={String(highPriorityCount)} delta="Critical plus high signals" tone={highPriorityCount ? 'warn' : 'ok'} icon={<BellRing size={16} />} />
        <MetricCard label="Action Requests" value={String(actionRequestCount)} delta="Human-approved server queue" tone="neutral" icon={<ListChecks size={16} />} />
        <MetricCard label="Agent Findings" value={String(agentFindingCount)} delta="Read-only recommendations" tone="neutral" icon={<Bot size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Operating Boundary</p>
          <h2>Decide, assign, approve, execute, audit</h2>
          <span>This page ranks cross-functional signals and records triage. Production-changing work still flows through permissioned Admin Action Requests.</span>
        </div>
        <StatusPill label={`${blockedCount} blocked`} tone={blockedCount ? 'danger' : 'ok'} />
      </section>

      <div className="attention-queue-layout">
        <DataTable
          label="Attention Queue"
          rows={items}
          pageSize={9}
          emptyTitle="No attention signals need review."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: sortValue,
              render: row => <StatusPill label={row.priority} tone={getAttentionPriorityTone(row.priority)} />,
            },
            {
              key: 'signal',
              header: 'Signal',
              sortable: true,
              searchValue: row => `${row.title} ${row.category} ${row.source} ${row.recommendedAction}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              searchValue: row => row.category,
              render: row => <StatusPill label={row.category} tone={categoryTone(row.category)} />,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.scope,
              render: row => <strong>{row.scope}</strong>,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getAttentionStatusTone(row.status)} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.source} ${row.createdAt}`,
              render: row => <div><strong>{row.source}</strong><span className="cell-subtext">{formatDateTime(row.createdAt)}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel attention-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Signal Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.priority} tone={getAttentionPriorityTone(selectedItem.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Category</span><strong>{selectedItem.category}</strong></div>
                <div><span>Status</span><strong>{selectedItem.status}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Source</span><strong>{selectedItem.source}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Scope</h3>
                <p className="muted-copy">{selectedItem.scope}</p>
              </div>

              <div className="detail-section">
                <h3>Recommended Next Action</h3>
                <p className="muted-copy">{selectedItem.recommendedAction}</p>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedItem.evidence.map(evidence => (
                    <div key={evidence}>
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-rule-list">
                <div>
                  <Clock3 size={16} strokeWidth={1.8} />
                  <strong>Detected {formatDateTime(selectedItem.createdAt)}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Record id: {selectedItem.relatedRecordId}</strong>
                </div>
                {selectedItem.category === 'Billing' && (
                  <div>
                    <CircleDollarSign size={16} strokeWidth={1.8} />
                    <strong>Finance review required before billing-affecting action.</strong>
                  </div>
                )}
                {selectedItem.category === 'Health' && (
                  <div>
                    <HeartPulse size={16} strokeWidth={1.8} />
                    <strong>System health signal. Coordinate through troubleshooting before remediation.</strong>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordTriage(selectedItem)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Record Triage
                  </button>
                  {selectedItem.actionRequestId && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Open Request
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">The command loop is quiet.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
