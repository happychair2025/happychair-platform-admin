import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  GitBranch,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { buildActionRequestGovernance } from '../../lib/admin-actions/actionRequestGovernance'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import { buildCommandCadence } from '../../lib/command-cadence/commandCadence'
import {
  buildCommandWorkQueue,
  commandWorkQueueBoundaryRule,
  getCommandWorkDecisionTone,
  getCommandWorkLaneTone,
  getCommandWorkPriorityTone,
  getCommandWorkStatusTone,
  summarizeCommandWorkQueue,
  useLocalCommandWorkStates,
  type CommandWorkItem,
  type CommandWorkLane,
  type CommandWorkLocalState,
  type CommandWorkSource,
  type CommandWorkStatus,
  type CommandWorkTargetPage,
} from '../../lib/command-work/commandWorkQueue'
import {
  buildCommandDigest,
  useLocalCommandDigestStates,
} from '../../lib/command-digest/commandDigest'
import { useLocalCommandBriefSnapshots } from '../../lib/command-digest/briefArchive'
import {
  buildEscalationInbox,
  useLocalEscalationInboxStates,
} from '../../lib/command-digest/escalationInbox'
import { buildDigestReviewCadence, useLocalDigestReviewCadenceStates } from '../../lib/command-digest/reviewCadence'
import {
  buildCoverageLedger,
  useLocalCoverageLedgerStates,
} from '../../lib/ownership/coverageLedger'
import {
  buildNotificationRoutingCenter,
  useLocalNotificationRoutingStates,
} from '../../lib/ownership/notificationRouting'
import {
  buildOnCallSchedule,
  useLocalOnCallScheduleStates,
} from '../../lib/ownership/onCallSchedule'
import { buildOwnershipSlaQueue } from '../../lib/ownership/ownershipSla'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface CommandWorkQueuePageProps {
  session: AdminSession
  onOpenTarget?: (page: CommandWorkTargetPage) => void
}

const sourceFilters: Array<'All' | CommandWorkSource> = ['All', 'Escalation Inbox', 'Coverage Ledger', 'Approval Center', 'Ownership SLA']
const laneFilters: Array<'All' | CommandWorkLane> = ['All', 'Owner Review', 'Approval', 'Action Handoff', 'Coverage', 'SLA Breach']
const statusFilters: Array<'All' | CommandWorkStatus> = ['All', 'Open', 'Claimed', 'Snoozed', 'Follow-Up Queued', 'Done', 'Dismissed']

export default function CommandWorkQueuePage({ session, onOpenTarget }: CommandWorkQueuePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const users = useManagedInternalAdminUsers(data.internalAdminUsers)
  const [localSavedViews] = useLocalSavedViews()
  const [localWatchStates] = useLocalWatchSignalStates()
  const [localRuleStates] = useLocalWatchRuleStates()
  const [localPlaybookStates] = useLocalResponsePlaybookStates()
  const [localSlaStates] = useLocalSlaEscalationStates()
  const [localDigestStates] = useLocalCommandDigestStates()
  const [localReviewStates] = useLocalDigestReviewCadenceStates()
  const [snapshots] = useLocalCommandBriefSnapshots()
  const [localInboxStates] = useLocalEscalationInboxStates()
  const [localRoutingStates] = useLocalNotificationRoutingStates()
  const [localOnCallStates] = useLocalOnCallScheduleStates()
  const [localCoverageStates] = useLocalCoverageLedgerStates()
  const [localCommandWorkStates, setLocalCommandWorkStates] = useLocalCommandWorkStates()
  const [selectedId, setSelectedId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | CommandWorkSource>('All')
  const [laneFilter, setLaneFilter] = useState<'All' | CommandWorkLane>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | CommandWorkStatus>('All')
  const [notice, setNotice] = useState('')
  const canManageWork = hasPermission(session.role, 'dashboard.view')

  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])

  const savedViews = useMemo(() => [
    ...localSavedViews,
    ...savedViewTemplates.filter(template => !localSavedViews.some(localView => localView.id === template.id)),
  ], [localSavedViews])

  const attentionItems = useMemo(() => buildAttentionQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const cadenceItems = useMemo(() => buildCommandCadence(attentionItems), [attentionItems])
  const watchSignals = useMemo(() => buildWatchSignals({
    data,
    actionRequests,
    auditEvents,
    savedViews,
    localStates: localWatchStates,
  }), [actionRequests, auditEvents, data, localWatchStates, savedViews])
  const watchRules = useMemo(() => buildWatchRules(localRuleStates), [localRuleStates])
  const responsePlaybooks = useMemo(() => buildResponsePlaybooks(localPlaybookStates), [localPlaybookStates])
  const slaItems = useMemo(() => buildSlaEscalationBoard({
    signals: watchSignals,
    rules: watchRules,
    playbooks: responsePlaybooks,
    localStates: localSlaStates,
  }), [localSlaStates, responsePlaybooks, watchRules, watchSignals])
  const digestItems = useMemo(() => buildCommandDigest({
    data,
    attentionItems,
    cadenceItems,
    slaItems,
    localStates: localDigestStates,
  }), [attentionItems, cadenceItems, data, localDigestStates, slaItems])
  const reviewWindows = useMemo(() => buildDigestReviewCadence({
    snapshots,
    localStates: localReviewStates,
  }), [localReviewStates, snapshots])
  const escalations = useMemo(() => buildEscalationInbox({
    reviewWindows,
    slaItems,
    digestItems,
    watchSignals,
    actionRequests,
    localStates: localInboxStates,
  }), [actionRequests, digestItems, localInboxStates, reviewWindows, slaItems, watchSignals])
  const { workItems } = useMemo(() => buildOwnershipSlaQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const routes = useMemo(() => buildNotificationRoutingCenter({
    workItems,
    users,
    localStates: localRoutingStates,
  }), [localRoutingStates, users, workItems])
  const shifts = useMemo(() => buildOnCallSchedule({
    routes,
    users,
    localStates: localOnCallStates,
  }), [localOnCallStates, routes, users])
  const coverageEntries = useMemo(() => buildCoverageLedger({
    routes,
    shifts,
    workItems,
    actionRequests,
    auditEvents,
    localStates: localCoverageStates,
  }), [actionRequests, auditEvents, localCoverageStates, routes, shifts, workItems])
  const governanceRecords = useMemo(() => buildActionRequestGovernance(actionRequests, data), [actionRequests, data])
  const items = useMemo(() => buildCommandWorkQueue({
    escalations,
    coverageEntries,
    ownershipWorkItems: workItems,
    actionRequests,
    governanceRecords,
    localStates: localCommandWorkStates,
  }), [actionRequests, coverageEntries, escalations, governanceRecords, localCommandWorkStates, workItems])
  const summary = useMemo(() => summarizeCommandWorkQueue(items), [items])
  const filteredItems = useMemo(() => items.filter(item => {
    if (sourceFilter !== 'All' && item.source !== sourceFilter) return false
    if (laneFilter !== 'All' && item.lane !== laneFilter) return false
    if (statusFilter !== 'All' && item.status !== statusFilter) return false
    return true
  }), [items, laneFilter, sourceFilter, statusFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? items.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? items[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, selectedItem.permission) : false
  const canQueueSelected = selectedItem ? hasPermission(session.role, selectedItem.followUpPermission) : false

  const recordLocalWorkState = (
    item: CommandWorkItem,
    status: CommandWorkStatus,
    note: string,
    extra: Partial<Pick<CommandWorkLocalState, 'snoozedUntil' | 'followUpRequestId'>> = {},
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `command_work_queue.${sanitizeActionKey(item.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} command work item: ${item.title}`,
      severity: item.priority === 'Critical' || status === 'Follow-Up Queued' ? 'warning' : 'notice',
      metadata: buildCommandWorkMetadata(item, {
        localStatus: status,
        localOnly: true,
        mutationApplied: false,
        ...extra,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalCommandWorkStates(current => [
      {
        itemId: item.id,
        status,
        claimedBy: status === 'Claimed' ? session.email : item.localState?.claimedBy,
        note,
        snoozedUntil: extra.snoozedUntil,
        followUpRequestId: extra.followUpRequestId,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setSelectedId(item.id)
    setNotice(`${item.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetLocalWorkState = (item: CommandWorkItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `command_work_queue.${sanitizeActionKey(item.id)}.reset_local.mock`,
      actionLabel: `Reset local command work state: ${item.title}`,
      severity: 'notice',
      metadata: buildCommandWorkMetadata(item, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalCommandWorkStates(current => current.filter(state => state.itemId !== item.id))
    setSelectedId(item.id)
    setNotice(`${item.title} reset to open command work state and recorded in Audit Logs.`)
  }

  const openSource = (item: CommandWorkItem) => {
    const result = runAdminAction(session, {
      permission: item.permission,
      scope: item.scope,
      actionKey: `command_work_queue.${sanitizeActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened command work source: ${item.title}`,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildCommandWorkMetadata(item, {
        targetPage: item.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} opened in ${item.targetLabel}.`)
    onOpenTarget?.(item.targetPage)
  }

  const queueFollowUp = (item: CommandWorkItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Command work follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.decision} requested from Command Work Queue. Source: ${item.source}. ${item.description}`,
      rollbackNotes: item.rollbackNotes,
      severity: item.priority === 'Critical' || item.decision === 'Escalate' ? 'warning' : 'notice',
      metadata: buildCommandWorkMetadata(item, {
        source: 'command_work_queue',
      }),
      handlerKey: item.handlerKey,
      handlerLabel: `${item.source} command work follow-up handler`,
      handlerDescription: `Server-side placeholder for Command Work Queue follow-up: ${item.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    recordLocalWorkState(item, 'Follow-Up Queued', `Follow-up queued as ${result.request.id}.`, {
      followUpRequestId: result.request.id,
    })
  }

  const snoozeUntil = (hours: number) => {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000)
    return until.toISOString()
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Command Queue"
        title="Command Work Queue"
        description="One owner-facing queue for escalations, coverage evidence, approval pressure, and SLA breaches that need an operating decision."
        action={<StatusPill label={canManageWork ? 'Local work controls enabled' : 'Read only'} tone={canManageWork ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Work" value={String(summary.open)} delta={`${sourceLabel} plus local command state`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<BellRing size={16} />} />
        <MetricCard label="Critical" value={String(summary.critical)} delta={`${summary.overdue} overdue decisions`} tone={summary.critical ? 'danger' : summary.overdue ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Approvals" value={String(summary.approvals)} delta={`${summary.followUps} follow-ups queued`} tone={summary.approvals ? 'warn' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Coverage / SLA" value={`${summary.coverage}/${summary.slaBreaches}`} delta={`${summary.claimed} claimed / ${summary.snoozed} snoozed`} tone={summary.coverage || summary.slaBreaches ? 'warn' : 'ok'} icon={<TimerReset size={16} />} />
      </div>

      <section className="panel command-work-boundary-panel">
        <div>
          <p className="eyebrow">Command Boundary</p>
          <h2>Work is coordinated here; execution still routes through governed handlers</h2>
          <span>{commandWorkQueueBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} work records`} tone={summary.open ? 'warn' : 'ok'} />
      </section>

      <section className="command-work-source-grid" aria-label="Command work source filters">
        {sourceFilters.filter(source => source !== 'All').map(source => {
          const sourceItems = items.filter(item => item.source === source)
          return (
            <button
              key={source}
              className={sourceFilter === source ? 'selected' : ''}
              onClick={() => {
                setSourceFilter(source)
                setSelectedId('')
              }}
            >
              <StatusPill label={source} tone={sourceTone(source)} />
              <strong>{sourceItems.length}</strong>
              <span>{sourceItems.filter(item => item.priority === 'Critical').length} critical</span>
              <small>{sourceItems.filter(item => item.status === 'Open').length} open</small>
            </button>
          )
        })}
      </section>

      <div className="timeline-filter-bar" aria-label="Command work lane filters">
        {laneFilters.map(lane => (
          <button
            key={lane}
            className={laneFilter === lane ? 'selected' : ''}
            onClick={() => {
              setLaneFilter(lane)
              setSelectedId('')
            }}
          >
            {lane}
            <span>{lane === 'All' ? items.length : items.filter(item => item.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Command work status filters">
        {statusFilters.map(status => (
          <button
            key={status}
            className={statusFilter === status ? 'selected' : ''}
            onClick={() => {
              setStatusFilter(status)
              setSelectedId('')
            }}
          >
            {status}
            <span>{status === 'All' ? items.length : items.filter(item => item.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="command-work-layout">
        <DataTable
          label="Command Work"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No command work items match these filters."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row),
              render: row => <StatusPill label={row.priority} tone={getCommandWorkPriorityTone(row.priority)} />,
            },
            {
              key: 'work',
              header: 'Work',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getCommandWorkLaneTone(row.lane)} />,
            },
            {
              key: 'decision',
              header: 'Decision',
              sortable: true,
              searchValue: row => row.decision,
              render: row => <StatusPill label={row.decision} tone={getCommandWorkDecisionTone(row.decision)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.source} ${row.sourceStatus}`,
              render: row => <div><strong>{row.source}</strong><span className="cell-subtext">{row.sourceStatus}</span></div>,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => row.dueAt,
              render: row => <span className={row.minutesLate ? 'danger-copy' : undefined}>{formatDateTime(row.dueAt)}</span>,
            },
            {
              key: 'local',
              header: 'Local',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getCommandWorkStatusTone(row.status)} />,
            },
          ]}
        />

        <aside className="detail-panel command-work-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Work Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.priority} tone={getCommandWorkPriorityTone(selectedItem.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Decision</span><strong>{selectedItem.decision}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Status</span><strong>{selectedItem.status}</strong></div>
                <div><span>Target</span><strong>{selectedItem.targetLabel}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <section className={`panel command-work-status-panel tone-${getCommandWorkPriorityTone(selectedItem.priority)}`}>
                <div>
                  <p className="eyebrow">Decision Brief</p>
                  <h2>{selectedItem.description}</h2>
                  <span>{formatLateText(selectedItem.minutesLate)} / {selectedItem.rollbackNotes}</span>
                </div>
                <div className="command-work-status-meta">
                  <StatusPill label={selectedItem.source} tone={sourceTone(selectedItem.source)} />
                  <strong>{Math.round(selectedItem.priorityScore)} score</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedItem.evidence.map(evidence => (
                    <div key={evidence}>
                      <Eye size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Related Record</h3>
                <div className="command-work-related-grid">
                  <div><span>Source</span><strong>{selectedItem.sourceStatus}</strong></div>
                  <div><span>Record</span><strong>{selectedItem.relatedRecordId}</strong></div>
                  <div><span>Action Request</span><strong>{selectedItem.actionRequestId ?? 'None'}</strong></div>
                  <div><span>Handler</span><strong>{selectedItem.handlerKey ?? 'Server placeholder required'}</strong></div>
                  <div><span>Permission</span><strong>{selectedItem.followUpPermission}</strong></div>
                  <div><span>Local Note</span><strong>{selectedItem.localState?.note ?? 'None'}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openSource(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                  <button className="ghost-action" disabled={!canManageWork} onClick={() => recordLocalWorkState(selectedItem, 'Claimed', 'Claimed from Command Work Queue.')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Claim
                  </button>
                  <button className="ghost-action" disabled={!canManageWork} onClick={() => recordLocalWorkState(selectedItem, 'Done', 'Marked done from Command Work Queue.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Done
                  </button>
                  <button className="ghost-action" disabled={!canManageWork} onClick={() => recordLocalWorkState(selectedItem, 'Snoozed', 'Snoozed for two hours from Command Work Queue.', { snoozedUntil: snoozeUntil(2) })}>
                    <Clock3 size={15} strokeWidth={1.8} />
                    Snooze 2h
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canManageWork} onClick={() => recordLocalWorkState(selectedItem, 'Dismissed', 'Dismissed from Command Work Queue local state.')}>
                    <ShieldAlert size={15} strokeWidth={1.8} />
                    Dismiss
                  </button>
                  <button className="ghost-action" disabled={!canManageWork} onClick={() => resetLocalWorkState(selectedItem)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {selectedItem.actionRequestId && onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('action-requests')}>
                      <GitBranch size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening the source requires {selectedItem.permission}.</p>}
                {!canQueueSelected && <p className="warning-copy">Follow-up queueing requires {selectedItem.followUpPermission}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No command work item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildCommandWorkMetadata(item: CommandWorkItem, extra: Record<string, unknown>) {
  return {
    commandWorkItemId: item.id,
    source: item.source,
    lane: item.lane,
    priority: item.priority,
    decision: item.decision,
    status: item.status,
    scope: item.scope,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    actionRequestId: item.actionRequestId,
    followUpActionType: item.followUpActionType,
    ...extra,
  }
}

function sourceTone(source: CommandWorkSource) {
  if (source === 'Escalation Inbox' || source === 'Approval Center') return 'danger' as const
  if (source === 'Coverage Ledger') return 'warn' as const
  return 'info' as const
}

function prioritySortValue(item: CommandWorkItem) {
  if (item.priority === 'Critical') return `0 ${item.priority}`
  if (item.priority === 'High') return `1 ${item.priority}`
  if (item.priority === 'Medium') return `2 ${item.priority}`
  return `3 ${item.priority}`
}

function formatLateText(minutesLate: number) {
  if (minutesLate <= 0) return 'Inside active decision window'
  if (minutesLate < 60) return `${minutesLate} minutes overdue`
  if (minutesLate % 1440 === 0) return `${minutesLate / 1440} days overdue`
  if (minutesLate % 60 === 0) return `${minutesLate / 60} hours overdue`
  return `${Math.round(minutesLate / 60)} hours overdue`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
