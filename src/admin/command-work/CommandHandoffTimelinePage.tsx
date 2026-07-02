import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  GitBranch,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { buildActionRequestGovernance } from '../../lib/admin-actions/actionRequestGovernance'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import {
  buildActionTimeline,
  getActionTimelineEventTone,
} from '../../lib/admin-actions/actionTimeline'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import { buildCommandCadence } from '../../lib/command-cadence/commandCadence'
import {
  buildCommandWorkQueue,
  getCommandWorkPriorityTone,
  useLocalCommandWorkStates,
} from '../../lib/command-work/commandWorkQueue'
import {
  buildDecisionBriefs,
  useLocalDecisionBriefStates,
} from '../../lib/command-work/decisionBriefs'
import {
  buildCommandHandoffTimeline,
  commandHandoffTimelineBoundaryRule,
  getCommandHandoffMilestoneTone,
  getCommandHandoffTimelineStatusTone,
  summarizeCommandHandoffTimeline,
  useLocalCommandHandoffTimelineStates,
  type CommandHandoffTimelineItem,
  type CommandHandoffTimelineStage,
  type CommandHandoffTimelineStatus,
  type CommandHandoffTimelineTargetPage,
} from '../../lib/command-work/commandHandoffTimeline'
import {
  buildOperatorDailyBrief,
  getOperatorDailyLaneTone,
  useLocalOperatorDailyBriefStates,
} from '../../lib/command-work/operatorDailyBrief'
import {
  buildOwnerActionCalendar,
  useLocalOwnerActionCalendarStates,
} from '../../lib/command-work/ownerActionCalendar'
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
import { hasPermission, type PermissionKey } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface CommandHandoffTimelinePageProps {
  session: AdminSession
  onOpenTarget?: (page: CommandHandoffTimelineTargetPage) => void
}

const stageFilters: Array<'All' | CommandHandoffTimelineStage> = ['All', 'Signal', 'Owner Action', 'Approval', 'Execution Handoff', 'Audit Trail']
const statusFilters: Array<'All' | CommandHandoffTimelineStatus> = [
  'All',
  'Needs Owner',
  'Owner Scheduled',
  'Owner Confirmed',
  'Follow-Up Queued',
  'Approval Pending',
  'Ready For Handoff',
  'Audit Linked',
  'Closed',
  'Blocked',
]

export default function CommandHandoffTimelinePage({ session, onOpenTarget }: CommandHandoffTimelinePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localMockExecutions = useLocalMockServerExecutions()
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
  const [localCommandWorkStates] = useLocalCommandWorkStates()
  const [localDecisionBriefStates] = useLocalDecisionBriefStates()
  const [localDailyBriefStates] = useLocalOperatorDailyBriefStates()
  const [localCalendarStates] = useLocalOwnerActionCalendarStates()
  const [localTimelineStates, setLocalTimelineStates] = useLocalCommandHandoffTimelineStates()
  const [selectedId, setSelectedId] = useState('')
  const [stageFilter, setStageFilter] = useState<'All' | CommandHandoffTimelineStage>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | CommandHandoffTimelineStatus>('All')
  const [notice, setNotice] = useState('')
  const canManageTimeline = hasPermission(session.role, 'dashboard.view')

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
  const commandWorkItems = useMemo(() => buildCommandWorkQueue({
    escalations,
    coverageEntries,
    ownershipWorkItems: workItems,
    actionRequests,
    governanceRecords,
    localStates: localCommandWorkStates,
  }), [actionRequests, coverageEntries, escalations, governanceRecords, localCommandWorkStates, workItems])
  const decisionBriefs = useMemo(() => buildDecisionBriefs({
    workItems: commandWorkItems,
    actionRequests,
    governanceRecords,
    auditEvents,
    localStates: localDecisionBriefStates,
  }), [actionRequests, auditEvents, commandWorkItems, governanceRecords, localDecisionBriefStates])
  const dailyBrief = useMemo(() => buildOperatorDailyBrief({
    data,
    commandWorkItems,
    decisionBriefs,
    coverageEntries,
    localStates: localDailyBriefStates,
  }), [commandWorkItems, coverageEntries, data, decisionBriefs, localDailyBriefStates])
  const calendarItems = useMemo(() => buildOwnerActionCalendar({
    brief: dailyBrief,
    localStates: localCalendarStates,
  }), [dailyBrief, localCalendarStates])
  const actionTimelineEvents = useMemo(() => buildActionTimeline({
    requests: actionRequests,
    auditEvents,
    mockExecutions: localMockExecutions,
  }), [actionRequests, auditEvents, localMockExecutions])
  const timelineItems = useMemo(() => buildCommandHandoffTimeline({
    calendarItems,
    actionRequests,
    actionTimelineEvents,
    auditEvents,
    localStates: localTimelineStates,
  }), [actionRequests, actionTimelineEvents, auditEvents, calendarItems, localTimelineStates])
  const summary = useMemo(() => summarizeCommandHandoffTimeline(timelineItems), [timelineItems])
  const filteredItems = useMemo(() => timelineItems.filter(item => {
    if (stageFilter !== 'All' && item.currentStage !== stageFilter) return false
    if (statusFilter !== 'All' && item.status !== statusFilter) return false
    return true
  }), [stageFilter, statusFilter, timelineItems])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? timelineItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? timelineItems[0]
  const selectedActionEvent = selectedItem?.linkedAuditEventId
    ? actionTimelineEvents.find(event => event.auditEventId === selectedItem.linkedAuditEventId)
    : undefined
  const canOpenSelected = selectedItem ? hasPermission(session.role, getTargetPermission(selectedItem.targetPage)) : false

  const recordTimelineState = (
    item: CommandHandoffTimelineItem,
    status: CommandHandoffTimelineStatus,
    note: string,
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `command_handoff_timeline.${sanitizeActionKey(item.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} command handoff: ${item.title}`,
      severity: item.priority === 'Critical' || status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildTimelineMetadata(item, {
        localStatus: status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalTimelineStates(current => [
      {
        itemId: item.id,
        status,
        note,
        auditEventId: result.auditEvent.id,
        handoffReadyAt: status === 'Ready For Handoff' ? updatedAt : item.localState?.handoffReadyAt,
        closedAt: status === 'Closed' ? updatedAt : item.localState?.closedAt,
        updatedAt,
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setSelectedId(item.id)
    setNotice(`${item.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetTimelineState = (item: CommandHandoffTimelineItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `command_handoff_timeline.${sanitizeActionKey(item.id)}.reset_local.mock`,
      actionLabel: `Reset local command handoff state: ${item.title}`,
      severity: 'notice',
      metadata: buildTimelineMetadata(item, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalTimelineStates(current => current.filter(state => state.itemId !== item.id))
    setSelectedId(item.id)
    setNotice(`${item.title} reset to generated handoff timeline state and recorded in Audit Logs.`)
  }

  const openTarget = (item: CommandHandoffTimelineItem) => {
    const permission = getTargetPermission(item.targetPage)
    const result = runAdminAction(session, {
      permission,
      scope: item.scope,
      actionKey: `command_handoff_timeline.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened command handoff target: ${item.title}`,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildTimelineMetadata(item, {
        targetPage: item.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} opened in ${getTargetLabel(item.targetPage)}.`)
    onOpenTarget?.(item.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Command Lifecycle"
        title="Command Handoff Timeline"
        description="A lifecycle view for each operating issue from signal capture to owner action, approval, handoff readiness, and audit evidence."
        action={<StatusPill label={canManageTimeline ? 'Local handoff controls enabled' : 'Read only'} tone={canManageTimeline ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Loops" value={String(summary.needsOwner + summary.approvalPending + summary.readyForHandoff)} delta={`${summary.needsOwner} need owner action`} tone={summary.blocked ? 'danger' : summary.needsOwner ? 'warn' : 'neutral'} icon={<ListChecks size={16} />} />
        <MetricCard label="Handoff Ready" value={String(summary.readyForHandoff)} delta="Ready for packet review" tone={summary.readyForHandoff ? 'warn' : 'neutral'} icon={<GitBranch size={16} />} />
        <MetricCard label="Audit Linked / Closed" value={`${summary.auditLinked}/${summary.closed}`} delta={`${summary.avgCompletion}% average completion`} tone={summary.auditLinked || summary.closed ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Blocked" value={String(summary.blocked)} delta={`${sourceLabel} plus local lifecycle state`} tone={summary.blocked ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <section className="panel command-handoff-boundary-panel">
        <div>
          <p className="eyebrow">Timeline Boundary</p>
          <h2>Timeline records lifecycle evidence; execution remains governed elsewhere</h2>
          <span>{commandHandoffTimelineBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} handoff lines`} tone={summary.blocked ? 'danger' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Command handoff stage filters">
        {stageFilters.map(stage => (
          <button
            key={stage}
            className={stageFilter === stage ? 'selected' : ''}
            onClick={() => {
              setStageFilter(stage)
              setSelectedId('')
            }}
          >
            {stage}
            <span>{stage === 'All' ? timelineItems.length : timelineItems.filter(item => item.currentStage === stage).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Command handoff status filters">
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
            <span>{status === 'All' ? timelineItems.length : timelineItems.filter(item => item.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="command-handoff-layout">
        <DataTable
          label="Handoff Lines"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No command handoff lines match these filters."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => statusSortValue(row),
              render: row => <StatusPill label={row.status} tone={getCommandHandoffTimelineStatusTone(row.status)} />,
            },
            {
              key: 'line',
              header: 'Line',
              sortable: true,
              searchValue: row => `${row.title} ${row.detail} ${row.owner} ${row.scope}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'stage',
              header: 'Stage',
              sortable: true,
              searchValue: row => stageSortValue(row),
              render: row => row.currentStage,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row),
              render: row => <StatusPill label={row.priority} tone={getCommandWorkPriorityTone(row.priority)} />,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getOperatorDailyLaneTone(row.lane)} />,
            },
            {
              key: 'completion',
              header: 'Done',
              sortable: true,
              searchValue: row => String(row.completion).padStart(3, '0'),
              render: row => `${row.completion}%`,
            },
          ]}
        />

        <aside className="detail-panel command-handoff-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Handoff Line</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.status} tone={getCommandHandoffTimelineStatusTone(selectedItem.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Current Stage</span><strong>{selectedItem.currentStage}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Completion</span><strong>{selectedItem.completion}%</strong></div>
                <div><span>Priority</span><strong>{selectedItem.priority}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Last Event</span><strong>{formatDateTime(selectedItem.lastEventAt)}</strong></div>
              </div>

              <section className={`panel command-handoff-status-panel tone-${getCommandHandoffTimelineStatusTone(selectedItem.status)}`}>
                <div>
                  <p className="eyebrow">Lifecycle Readout</p>
                  <h2>{selectedItem.recommendedAction}</h2>
                  <span>{selectedItem.detail}</span>
                </div>
                <div className="command-handoff-status-meta">
                  <StatusPill label={selectedItem.sourceLabel} tone={selectedItem.priority === 'Critical' ? 'danger' : 'info'} />
                  <strong>{selectedItem.linkedActionRequestId ?? 'No action request'}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Lifecycle Milestones</h3>
                <div className="command-handoff-milestone-list">
                  {selectedItem.milestones.map(milestone => (
                    <article key={milestone.stage} className={`command-handoff-milestone tone-${milestone.status}`}>
                      <div>
                        <strong>{milestone.stage}</strong>
                        <StatusPill label={milestone.status} tone={getCommandHandoffMilestoneTone(milestone.status)} />
                      </div>
                      <p>{milestone.label}</p>
                      <span>{milestone.detail}</span>
                      {milestone.occurredAt && <small>{formatDateTime(milestone.occurredAt)}</small>}
                    </article>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Lineage</h3>
                <div className="command-handoff-related-grid">
                  <div><span>Target</span><strong>{getTargetLabel(selectedItem.targetPage)}</strong></div>
                  <div><span>Record</span><strong>{selectedItem.relatedRecordId}</strong></div>
                  <div><span>Action Request</span><strong>{selectedItem.linkedActionRequestId ?? 'Not linked'}</strong></div>
                  <div><span>Audit Event</span><strong>{selectedItem.linkedAuditEventId ?? 'Not linked'}</strong></div>
                  <div><span>Handler</span><strong>{selectedItem.linkedHandlerKey ?? 'Server placeholder required'}</strong></div>
                  <div><span>Permission</span><strong>{selectedItem.followUpPermission}</strong></div>
                </div>
              </div>

              {selectedActionEvent && (
                <div className="detail-section">
                  <h3>Latest Action Timeline Event</h3>
                  <section className={`panel command-handoff-event-panel tone-${getActionTimelineEventTone(selectedActionEvent)}`}>
                    <div>
                      <p className="eyebrow">{selectedActionEvent.eventType}</p>
                      <h2>{selectedActionEvent.title}</h2>
                      <span>{selectedActionEvent.detail}</span>
                    </div>
                    <div className="command-handoff-status-meta">
                      <StatusPill label={selectedActionEvent.statusLabel} tone={getActionTimelineEventTone(selectedActionEvent)} />
                      <strong>{selectedActionEvent.source}</strong>
                    </div>
                  </section>
                </div>
              )}

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
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canManageTimeline} onClick={() => recordTimelineState(selectedItem, 'Ready For Handoff', 'Command handoff marked ready locally for packet review.')}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Record Handoff Ready
                  </button>
                  <button className="ghost-action" disabled={!canManageTimeline} onClick={() => recordTimelineState(selectedItem, 'Audit Linked', 'Audit evidence linked locally for command handoff.')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Link Audit Trail
                  </button>
                  <button className="ghost-action" disabled={!canManageTimeline} onClick={() => recordTimelineState(selectedItem, 'Closed', 'Command handoff loop closed locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Close Loop
                  </button>
                  <button className="ghost-action" disabled={!canManageTimeline} onClick={() => recordTimelineState(selectedItem, 'Blocked', 'Command handoff blocked locally pending owner review.')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block
                  </button>
                  <button className="ghost-action" disabled={!canManageTimeline} onClick={() => resetTimelineState(selectedItem)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <>
                      <button className="ghost-action" onClick={() => onOpenTarget('owner-action-calendar')}>
                        <Clock3 size={15} strokeWidth={1.8} />
                        Owner Calendar
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('action-timeline')}>
                        <TimerReset size={15} strokeWidth={1.8} />
                        Action Timeline
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('execution-handoff')}>
                        <FileCheck2 size={15} strokeWidth={1.8} />
                        Execution Handoff
                      </button>
                    </>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {getTargetPermission(selectedItem.targetPage)}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedItem.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No command handoff line selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildTimelineMetadata(item: CommandHandoffTimelineItem, extra: Record<string, unknown>) {
  return {
    commandHandoffTimelineItemId: item.id,
    ownerActionCalendarItemId: item.id,
    lane: item.lane,
    priority: item.priority,
    status: item.status,
    currentStage: item.currentStage,
    scope: item.scope,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    actionRequestId: item.linkedActionRequestId,
    auditEventId: item.linkedAuditEventId,
    ...extra,
  }
}

function getTargetPermission(page: CommandHandoffTimelineTargetPage): PermissionKey {
  if (page === 'revenue') return 'revenue.view'
  if (page === 'support') return 'support.view'
  if (page === 'registrations') return 'registrations.view'
  if (page === 'usage') return 'usage.view'
  if (page === 'health' || page === 'data-quality') return 'health.view'
  if (page === 'audit') return 'audit.view'
  if (page === 'saved-views') return 'saved_views.view'
  if (page === 'agents') return 'agents.view'
  if (page === 'client-success') return 'clients.view'
  if (page === 'action-requests' || page === 'approval-center' || page === 'action-timeline' || page === 'execution-handoff') return 'admin_actions.view'
  if (page === 'coverage-ledger' || page === 'notification-routing' || page === 'on-call-schedule' || page === 'watch-center' || page === 'sla-board') return 'notifications.view'
  return 'dashboard.view'
}

function getTargetLabel(page: CommandHandoffTimelineTargetPage) {
  const labels: Partial<Record<CommandHandoffTimelineTargetPage, string>> = {
    'command-handoff-timeline': 'Command Handoff Timeline',
    'owner-action-calendar': 'Owner Action Calendar',
    'operator-daily-brief': 'Operator Daily Brief',
    'command-work': 'Command Queue',
    'decision-briefs': 'Decision Briefs',
    'command-digest': 'Command Digest',
    'brief-archive': 'Brief Archive',
    'digest-cadence': 'Review Cadence',
    'coverage-ledger': 'Coverage Ledger',
    'approval-center': 'Approval Center',
    'ownership-sla': 'Ownership / SLA',
    'action-requests': 'Action Requests',
    'action-timeline': 'Action Timeline',
    'execution-handoff': 'Execution Handoff',
    'notification-routing': 'Routing Center',
    'on-call-schedule': 'On-Call Schedule',
    'watch-center': 'Watch Center',
    'sla-board': 'SLA Board',
    'attention': 'Attention Queue',
    'command-cadence': 'Command Cadence',
    'client-success': 'Client Success',
    agents: 'Agent Foundation',
    revenue: 'Revenue',
    support: 'Support Center',
    registrations: 'Registrations',
    usage: 'Usage Analytics',
    health: 'Client Health',
    audit: 'Audit Logs',
    'saved-views': 'Saved Views',
    'data-quality': 'Data Quality',
  }
  return labels[page] ?? page
}

function statusSortValue(item: CommandHandoffTimelineItem) {
  const order: Record<CommandHandoffTimelineStatus, number> = {
    Blocked: 0,
    'Needs Owner': 1,
    'Owner Scheduled': 2,
    'Owner Confirmed': 3,
    'Follow-Up Queued': 4,
    'Approval Pending': 5,
    'Ready For Handoff': 6,
    'Audit Linked': 7,
    Closed: 8,
  }
  return `${order[item.status]} ${item.status}`
}

function stageSortValue(item: CommandHandoffTimelineItem) {
  const order: Record<CommandHandoffTimelineStage, number> = {
    Signal: 0,
    'Owner Action': 1,
    Approval: 2,
    'Execution Handoff': 3,
    'Audit Trail': 4,
  }
  return `${order[item.currentStage]} ${item.currentStage}`
}

function prioritySortValue(item: CommandHandoffTimelineItem) {
  if (item.priority === 'Critical') return `0 ${item.priority}`
  if (item.priority === 'High') return `1 ${item.priority}`
  if (item.priority === 'Medium') return `2 ${item.priority}`
  return `3 ${item.priority}`
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
