import { AlertTriangle, BellRing, Clock3, ListChecks, ShieldCheck, TimerReset, UserRoundCheck, UsersRound } from 'lucide-react'
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
  buildOwnershipSlaQueue,
  getOwnershipPriorityTone,
  getOwnershipSlaTone,
  type OwnerSlaSummary,
  type OwnershipSlaStatus,
  type OwnershipWorkItem,
} from '../../lib/ownership/ownershipSla'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface OwnershipSlaPageProps {
  session: AdminSession
  onOpenActionRequests: () => void
}

const statusFilters: Array<'All' | OwnershipSlaStatus> = ['All', 'Breached', 'Due Soon', 'On Track', 'Monitoring']

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function sourceTone(sourceType: OwnershipWorkItem['sourceType']): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (sourceType === 'Support' || sourceType === 'Health') return 'danger'
  if (sourceType === 'Billing') return 'warn'
  if (sourceType === 'Action Request' || sourceType === 'Agent') return 'info'
  return 'neutral'
}

function ownerTone(summary: OwnerSlaSummary): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (summary.breached) return 'danger'
  if (summary.dueSoon || summary.critical) return 'warn'
  return 'ok'
}

function dueSortValue(item: OwnershipWorkItem) {
  return `${item.dueAt} ${item.slaStatus}`
}

export default function OwnershipSlaPage({ session, onOpenActionRequests }: OwnershipSlaPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const [selectedId, setSelectedId] = useState('')
  const [selectedOwner, setSelectedOwner] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState<'All' | OwnershipSlaStatus>('All')
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
  const { ownerSummaries, workItems } = useMemo(() => buildOwnershipSlaQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const filteredItems = useMemo(() => {
    return workItems.filter(item => (
      (selectedOwner === 'All' || item.owner === selectedOwner)
      && (selectedStatus === 'All' || item.slaStatus === selectedStatus)
    ))
  }, [selectedOwner, selectedStatus, workItems])
  const selectedItem = filteredItems.find(item => item.id === selectedId) ?? filteredItems[0] ?? workItems[0]
  const breachedCount = workItems.filter(item => item.slaStatus === 'Breached').length
  const dueSoonCount = workItems.filter(item => item.slaStatus === 'Due Soon').length
  const criticalCount = workItems.filter(item => item.priority === 'Critical').length
  const actionRequestCount = workItems.filter(item => item.sourceType === 'Action Request').length

  const recordOwnershipReview = (item: OwnershipWorkItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: 'ownership_sla.reviewed.mock',
      actionLabel: `Reviewed ownership and SLA for ${item.title}`,
      severity: item.slaStatus === 'Breached' || item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        workItemId: item.id,
        sourceType: item.sourceType,
        owner: item.owner,
        priority: item.priority,
        slaStatus: item.slaStatus,
        dueAt: item.dueAt,
        escalationTarget: item.escalationTarget,
        sourceRecordId: item.sourceRecordId,
      },
    })
    setNotice(result.ok ? `Ownership review recorded for ${item.title}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operating Discipline"
        title="Ownership / SLA Command"
        description="A single owner, due window, escalation path, and review trail for every important platform signal."
        action={<StatusPill label={`${sourceLabel} plus local queues`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Breached" value={String(breachedCount)} delta="Past due work" tone={breachedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Due Soon" value={String(dueSoonCount)} delta="Due inside 6 hours" tone={dueSoonCount ? 'warn' : 'ok'} icon={<BellRing size={16} />} />
        <MetricCard label="Critical" value={String(criticalCount)} delta="Highest priority items" tone={criticalCount ? 'danger' : 'ok'} icon={<TimerReset size={16} />} />
        <MetricCard label="Action Requests" value={String(actionRequestCount)} delta="Server-action queue items" tone="neutral" icon={<ListChecks size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">SLA Rule</p>
          <h2>Nothing important is allowed to be ownerless</h2>
          <span>Signals stay read-only here. Reviews are audit-style local records; production-changing work still goes through Admin Action Requests.</span>
        </div>
        <StatusPill label={`${ownerSummaries.length} owners`} tone="info" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Owner Load</h2>
            <span>Current workload, breach pressure, and next due item</span>
          </div>
          <UsersRound size={18} strokeWidth={1.8} />
        </div>
        <div className="owner-load-grid">
          <button className={`owner-load-card${selectedOwner === 'All' ? ' selected' : ''}`} onClick={() => setSelectedOwner('All')}>
            <div>
              <strong>All Owners</strong>
              <StatusPill label={`${workItems.length} items`} tone="neutral" />
            </div>
            <span>{breachedCount} breached / {dueSoonCount} due soon</span>
          </button>
          {ownerSummaries.map(summary => (
            <button key={summary.owner} className={`owner-load-card tone-${ownerTone(summary)}${selectedOwner === summary.owner ? ' selected' : ''}`} onClick={() => setSelectedOwner(summary.owner)}>
              <div>
                <strong>{summary.owner}</strong>
                <StatusPill label={`${summary.total} items`} tone={ownerTone(summary)} />
              </div>
              <span>{summary.breached} breached / {summary.dueSoon} due soon / {summary.critical} critical</span>
              {summary.nextDueAt && <small>Next due {formatDateTime(summary.nextDueAt)}</small>}
            </button>
          ))}
        </div>
      </section>

      <div className="support-selector" aria-label="SLA status filters">
        {statusFilters.map(status => (
          <button key={status} className={selectedStatus === status ? 'selected' : ''} onClick={() => setSelectedStatus(status)}>
            <Clock3 size={15} strokeWidth={1.8} />
            {status}
          </button>
        ))}
      </div>

      <div className="ownership-layout">
        <DataTable
          label="SLA Work Queue"
          rows={filteredItems}
          pageSize={9}
          emptyTitle="No work matches the current owner or SLA filter."
          columns={[
            {
              key: 'sla',
              header: 'SLA',
              sortable: true,
              searchValue: row => `${row.slaStatus} ${dueSortValue(row)}`,
              render: row => <StatusPill label={row.slaStatus} tone={getOwnershipSlaTone(row.slaStatus)} />,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => `${100 - row.priorityScore} ${row.priority}`,
              render: row => <StatusPill label={row.priority} tone={getOwnershipPriorityTone(row.priority)} />,
            },
            {
              key: 'work',
              header: 'Work',
              sortable: true,
              searchValue: row => `${row.title} ${row.client} ${row.scope} ${row.nextAction}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => <strong>{row.owner}</strong>,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.sourceType} ${row.sourceStatus}`,
              render: row => <div><StatusPill label={row.sourceType} tone={sourceTone(row.sourceType)} /><span className="cell-subtext">{row.sourceStatus}</span></div>,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: dueSortValue,
              render: row => <div><strong>{formatDateTime(row.dueAt)}</strong><span className="cell-subtext">{row.ageHours}h old</span></div>,
            },
          ]}
        />

        <aside className="detail-panel ownership-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Work Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.slaStatus} tone={getOwnershipSlaTone(selectedItem.slaStatus)} />
              </div>

              <div className="request-scope-list">
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Priority</span><strong>{selectedItem.priority}</strong></div>
                <div><span>Client</span><strong>{selectedItem.client}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Created</span><strong>{formatDateTime(selectedItem.createdAt)}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Next Action</h3>
                <p className="muted-copy">{selectedItem.nextAction}</p>
              </div>

              <div className="detail-section">
                <h3>Escalation Path</h3>
                <div className="settings-rule-list">
                  <div>
                    <UserRoundCheck size={16} strokeWidth={1.8} />
                    <strong>{selectedItem.escalationTarget}</strong>
                  </div>
                  <div>
                    <TimerReset size={16} strokeWidth={1.8} />
                    <strong>{selectedItem.slaStatus} / {selectedItem.ageHours} hours old</strong>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedItem.evidence.map(evidence => (
                    <div key={evidence}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordOwnershipReview(selectedItem)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Record Review
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
            <div className="empty-state compact">No SLA work item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
