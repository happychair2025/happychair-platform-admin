import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListChecks,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import {
  buildCommandCadence,
  getCadenceDecisionTone,
  getCadenceLaneTone,
  getCadenceSlaTone,
  summarizeCommandCadence,
  summarizeCommandCadenceLanes,
  type CommandCadenceItem,
} from '../../lib/command-cadence/commandCadence'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface CommandCadencePageProps {
  session: AdminSession
  onOpenActionRequests: () => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function sortByCadenceRisk(item: CommandCadenceItem) {
  const slaWeight = item.slaStatus === 'Blocked' ? 0 : item.slaStatus === 'Overdue' ? 1 : item.slaStatus === 'Due Today' ? 2 : 3
  return `${slaWeight} ${String(100 - item.priorityScore).padStart(3, '0')} ${item.dueAt}`
}

export default function CommandCadencePage({ session, onOpenActionRequests }: CommandCadencePageProps) {
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

  const attentionItems = useMemo(() => buildAttentionQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const cadenceItems = useMemo(() => buildCommandCadence(attentionItems), [attentionItems])
  const laneSummaries = useMemo(() => summarizeCommandCadenceLanes(cadenceItems), [cadenceItems])
  const summary = useMemo(() => summarizeCommandCadence(cadenceItems), [cadenceItems])
  const selectedItem = cadenceItems.find(item => item.id === selectedId) ?? cadenceItems[0]

  const recordCadenceReview = (item: CommandCadenceItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: 'command_cadence.review_recorded.mock',
      actionLabel: `Recorded cadence review for ${item.title}`,
      severity: item.slaStatus === 'Blocked' || item.slaStatus === 'Overdue' ? 'warning' : 'notice',
      metadata: {
        cadenceItemId: item.id,
        lane: item.lane,
        decision: item.decision,
        slaStatus: item.slaStatus,
        relatedAttentionId: item.relatedAttentionId,
        actionRequestId: item.actionRequestId,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`Cadence review recorded for ${item.title}.`)
  }

  const queueCadenceFollowUp = (item: CommandCadenceItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Cadence follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.decision} requested from Operating Cadence. Recommended action: ${item.recommendedAction}`,
      rollbackNotes: 'No production state changes from the browser. Server handler must confirm scope, permission, approval, audit entry, and rollback metadata before execution.',
      severity: item.slaStatus === 'Blocked' || item.slaStatus === 'Overdue' ? 'warning' : 'notice',
      metadata: {
        cadenceItemId: item.id,
        lane: item.lane,
        decision: item.decision,
        slaStatus: item.slaStatus,
        relatedAttentionId: item.relatedAttentionId,
      },
    })

    setSelectedId(item.id)
    setNotice(result.ok ? `Follow-up queued for ${item.title}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operating Cadence"
        title="Command Cadence"
        description="Daily command loop for deciding what Happy Chair reviews, assigns, approves, escalates, and monitors across clients, revenue, support, engineering, and agents."
        action={<StatusPill label={`${sourceLabel} cadence`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Cadence Items" value={String(summary.total)} delta="Prioritized from attention signals" tone="neutral" icon={<CalendarClock size={16} />} />
        <MetricCard label="Blocked / Overdue" value={String(summary.blocked + summary.overdue)} delta="Needs escalation path" tone={summary.blocked + summary.overdue ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Due Today" value={String(summary.dueToday)} delta="Review before close" tone={summary.dueToday ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Ready Approval" value={String(summary.readyForApproval)} delta="Action requests waiting" tone={summary.readyForApproval ? 'warn' : 'neutral'} icon={<ListChecks size={16} />} />
      </div>

      <section className="panel cadence-boundary-panel">
        <div>
          <p className="eyebrow">Command Rule</p>
          <h2>Cadence decides priority; Action Requests control execution</h2>
          <span>Reviews are audit-only. Follow-ups become permissioned Admin Action Requests and still require server-side handlers before any production mutation.</span>
        </div>
        <StatusPill label={`${summary.ownerReview} owner review`} tone={summary.ownerReview ? 'warn' : 'ok'} />
      </section>

      <section className="cadence-lane-grid" aria-label="Cadence lanes">
        {laneSummaries.map(lane => (
          <article key={lane.lane} className="cadence-lane-card">
            <div className="cadence-lane-top">
              <StatusPill label={lane.lane} tone={getCadenceLaneTone(lane.lane)} />
              <strong>{lane.total}</strong>
            </div>
            <span>{lane.topOwner}</span>
            <div className="cadence-lane-footer">
              <small>{lane.blocked} blocked</small>
              <small>{lane.overdue} overdue</small>
              <StatusPill label={lane.nextDecision} tone={getCadenceDecisionTone(lane.nextDecision)} />
            </div>
          </article>
        ))}
      </section>

      <div className="cadence-layout">
        <DataTable
          label="Cadence Worklist"
          rows={cadenceItems}
          pageSize={8}
          emptyTitle="No cadence items need review."
          columns={[
            {
              key: 'risk',
              header: 'SLA',
              sortable: true,
              searchValue: sortByCadenceRisk,
              render: row => <StatusPill label={row.slaStatus} tone={getCadenceSlaTone(row.slaStatus)} />,
            },
            {
              key: 'decision',
              header: 'Decision',
              sortable: true,
              searchValue: row => row.decision,
              render: row => <StatusPill label={row.decision} tone={getCadenceDecisionTone(row.decision)} />,
            },
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.scope} ${row.source}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getCadenceLaneTone(row.lane)} />,
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
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => row.dueAt,
              render: row => <div><strong>{row.cadenceWindow}</strong><span className="cell-subtext">{formatDateTime(row.dueAt)}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel cadence-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Cadence Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.slaStatus} tone={getCadenceSlaTone(selectedItem.slaStatus)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Decision</span><strong>{selectedItem.decision}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Recommended Action</h3>
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
                  <UsersRound size={16} strokeWidth={1.8} />
                  <strong>Scope: {selectedItem.scope}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Source: {selectedItem.source}</strong>
                </div>
                <div>
                  <Clock3 size={16} strokeWidth={1.8} />
                  <strong>Detected {formatDateTime(selectedItem.createdAt)}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordCadenceReview(selectedItem)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" onClick={() => queueCadenceFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" onClick={onOpenActionRequests}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Open Action Requests
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Select a cadence item.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
