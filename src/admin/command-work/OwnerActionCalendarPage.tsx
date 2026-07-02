import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
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
  getCommandWorkPriorityTone,
  useLocalCommandWorkStates,
} from '../../lib/command-work/commandWorkQueue'
import {
  buildDecisionBriefs,
  useLocalDecisionBriefStates,
} from '../../lib/command-work/decisionBriefs'
import {
  buildOperatorDailyBrief,
  getOperatorDailyLaneTone,
  useLocalOperatorDailyBriefStates,
} from '../../lib/command-work/operatorDailyBrief'
import {
  buildOwnerActionCalendar,
  getOwnerActionCalendarStatusTone,
  getOwnerActionCalendarWindowTone,
  ownerActionCalendarBoundaryRule,
  summarizeOwnerActionCalendar,
  summarizeOwnerLoads,
  useLocalOwnerActionCalendarStates,
  type OwnerActionCalendarItem,
  type OwnerActionCalendarLocalState,
  type OwnerActionCalendarStatus,
  type OwnerActionCalendarTargetPage,
  type OwnerActionCalendarWindow,
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

interface OwnerActionCalendarPageProps {
  session: AdminSession
  onOpenTarget?: (page: OwnerActionCalendarTargetPage) => void
}

const windowFilters: Array<'All' | OwnerActionCalendarWindow> = ['All', 'Overdue', 'Today', 'Tomorrow', 'This Week', 'Next Week', 'Backlog']
const statusFilters: Array<'All' | OwnerActionCalendarStatus> = ['All', 'Open', 'Scheduled', 'Confirmed', 'Done', 'Snoozed', 'Skipped']

export default function OwnerActionCalendarPage({ session, onOpenTarget }: OwnerActionCalendarPageProps) {
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
  const [localCommandWorkStates] = useLocalCommandWorkStates()
  const [localDecisionBriefStates] = useLocalDecisionBriefStates()
  const [localDailyBriefStates] = useLocalOperatorDailyBriefStates()
  const [localCalendarStates, setLocalCalendarStates] = useLocalOwnerActionCalendarStates()
  const [selectedId, setSelectedId] = useState('')
  const [windowFilter, setWindowFilter] = useState<'All' | OwnerActionCalendarWindow>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | OwnerActionCalendarStatus>('All')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [notice, setNotice] = useState('')
  const canManageCalendar = hasPermission(session.role, 'dashboard.view')

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
  const brief = useMemo(() => buildOperatorDailyBrief({
    data,
    commandWorkItems,
    decisionBriefs,
    coverageEntries,
    localStates: localDailyBriefStates,
  }), [commandWorkItems, coverageEntries, data, decisionBriefs, localDailyBriefStates])
  const calendarItems = useMemo(() => buildOwnerActionCalendar({
    brief,
    localStates: localCalendarStates,
  }), [brief, localCalendarStates])
  const summary = useMemo(() => summarizeOwnerActionCalendar(calendarItems), [calendarItems])
  const ownerLoads = useMemo(() => summarizeOwnerLoads(calendarItems), [calendarItems])
  const filteredItems = useMemo(() => calendarItems.filter(item => {
    if (windowFilter !== 'All' && item.window !== windowFilter) return false
    if (statusFilter !== 'All' && item.status !== statusFilter) return false
    if (ownerFilter !== 'All' && item.owner !== ownerFilter) return false
    return true
  }), [calendarItems, ownerFilter, statusFilter, windowFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? calendarItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? calendarItems[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, getTargetPermission(selectedItem.targetPage)) : false
  const canQueueSelected = selectedItem ? hasPermission(session.role, selectedItem.followUpPermission) : false

  const recordCalendarState = (
    item: OwnerActionCalendarItem,
    status: OwnerActionCalendarStatus,
    note: string,
    extra: Partial<Pick<OwnerActionCalendarLocalState, 'scheduledAt' | 'snoozedUntil' | 'followUpRequestId'>> = {},
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `owner_action_calendar.${sanitizeActionKey(item.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} owner action: ${item.title}`,
      severity: item.priority === 'Critical' || item.window === 'Overdue' ? 'warning' : 'notice',
      metadata: buildCalendarItemMetadata(item, {
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

    const updatedAt = new Date().toISOString()
    setLocalCalendarStates(current => [
      {
        itemId: item.id,
        status,
        note,
        scheduledAt: extra.scheduledAt ?? item.localState?.scheduledAt ?? item.scheduledAt,
        snoozedUntil: extra.snoozedUntil,
        followUpRequestId: extra.followUpRequestId ?? item.localState?.followUpRequestId,
        updatedAt,
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setSelectedId(item.id)
    setNotice(`${item.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetCalendarState = (item: OwnerActionCalendarItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `owner_action_calendar.${sanitizeActionKey(item.id)}.reset_local.mock`,
      actionLabel: `Reset local owner action state: ${item.title}`,
      severity: 'notice',
      metadata: buildCalendarItemMetadata(item, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalCalendarStates(current => current.filter(state => state.itemId !== item.id))
    setSelectedId(item.id)
    setNotice(`${item.title} reset to open owner action state and recorded in Audit Logs.`)
  }

  const openTarget = (item: OwnerActionCalendarItem) => {
    const permission = getTargetPermission(item.targetPage)
    const result = runAdminAction(session, {
      permission,
      scope: item.scope,
      actionKey: `owner_action_calendar.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened owner action target: ${item.title}`,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildCalendarItemMetadata(item, {
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

  const queueFollowUp = (item: OwnerActionCalendarItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Owner calendar follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.recommendedAction} Scheduled owner: ${item.owner}. Source: ${item.sourceLabel}. ${item.detail}`,
      rollbackNotes: item.rollbackNotes,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildCalendarItemMetadata(item, {
        source: 'owner_action_calendar',
      }),
      handlerKey: item.handlerKey,
      handlerLabel: `${item.sourceLabel} owner calendar follow-up handler`,
      handlerDescription: `Server-side placeholder for Owner Action Calendar follow-up: ${item.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    recordCalendarState(item, 'Scheduled', `Follow-up queued as ${result.request.id}.`, {
      followUpRequestId: result.request.id,
      scheduledAt: item.scheduledAt,
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Command"
        title="Owner Action Calendar"
        description="A dated operating calendar for Daily Brief work, owner accountability, overdue decisions, and governed follow-up handoffs."
        action={<StatusPill label={canManageCalendar ? 'Local calendar controls enabled' : 'Read only'} tone={canManageCalendar ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Due Today" value={String(summary.today)} delta={`${summary.overdue} overdue owner actions`} tone={summary.overdue ? 'danger' : summary.today ? 'warn' : 'ok'} icon={<CalendarClock size={16} />} />
        <MetricCard label="Open Actions" value={String(summary.open)} delta={`${summary.critical} critical from Daily Brief`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Scheduled / Confirmed" value={`${summary.scheduled}/${summary.confirmed}`} delta={`${summary.followUps} governed follow-ups queued`} tone={summary.scheduled || summary.confirmed ? 'warn' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Owners" value={String(summary.owners)} delta={`${sourceLabel} plus local calendar state`} tone="neutral" icon={<TimerReset size={16} />} />
      </div>

      <section className="panel owner-action-boundary-panel">
        <div>
          <p className="eyebrow">Calendar Boundary</p>
          <h2>Schedule accountability here; execute changes through governed handlers</h2>
          <span>{ownerActionCalendarBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} owner actions`} tone={summary.overdue ? 'danger' : summary.today ? 'warn' : 'ok'} />
      </section>

      <section className="owner-action-owner-grid" aria-label="Owner workload filters">
        {ownerLoads.slice(0, 6).map(load => (
          <button
            key={load.owner}
            className={ownerFilter === load.owner ? 'selected' : ''}
            onClick={() => {
              setOwnerFilter(ownerFilter === load.owner ? 'All' : load.owner)
              setSelectedId('')
            }}
          >
            <strong>{load.owner}</strong>
            <span>{load.total} active / {load.today} today</span>
            <small>{load.overdue} overdue / {load.critical} critical</small>
            <em>{load.nextAction}</em>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Owner action date filters">
        {windowFilters.map(window => (
          <button
            key={window}
            className={windowFilter === window ? 'selected' : ''}
            onClick={() => {
              setWindowFilter(window)
              setSelectedId('')
            }}
          >
            {window}
            <span>{window === 'All' ? calendarItems.length : calendarItems.filter(item => item.window === window).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Owner action status filters">
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
            <span>{status === 'All' ? calendarItems.length : calendarItems.filter(item => item.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="owner-action-layout">
        <DataTable
          label="Owner Actions"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No owner actions match these filters."
          columns={[
            {
              key: 'window',
              header: 'Window',
              sortable: true,
              searchValue: row => windowSortValue(row),
              render: row => <StatusPill label={row.window} tone={getOwnerActionCalendarWindowTone(row.window)} />,
            },
            {
              key: 'action',
              header: 'Action',
              sortable: true,
              searchValue: row => `${row.title} ${row.detail} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
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
              key: 'status',
              header: 'Local',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getOwnerActionCalendarStatusTone(row.status)} />,
            },
            {
              key: 'scheduled',
              header: 'Scheduled',
              sortable: true,
              searchValue: row => row.scheduledAt,
              render: row => formatDateTime(row.scheduledAt),
            },
          ]}
        />

        <aside className="detail-panel owner-action-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Owner Action</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.window} tone={getOwnerActionCalendarWindowTone(selectedItem.window)} />
              </div>

              <div className="request-scope-list">
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Priority</span><strong>{selectedItem.priority}</strong></div>
                <div><span>Status</span><strong>{selectedItem.status}</strong></div>
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <section className={`panel owner-action-status-panel tone-${getOwnerActionCalendarWindowTone(selectedItem.window)}`}>
                <div>
                  <p className="eyebrow">Next Owner Move</p>
                  <h2>{selectedItem.recommendedAction}</h2>
                  <span>{selectedItem.detail}</span>
                </div>
                <div className="owner-action-status-meta">
                  <StatusPill label={selectedItem.sourceLabel} tone={selectedItem.priority === 'Critical' ? 'danger' : 'info'} />
                  <strong>{formatWindowAge(selectedItem.minutesUntilDue)}</strong>
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
                <h3>Calendar Guardrails</h3>
                <div className="owner-action-related-grid">
                  <div><span>Target</span><strong>{getTargetLabel(selectedItem.targetPage)}</strong></div>
                  <div><span>Record</span><strong>{selectedItem.relatedRecordId}</strong></div>
                  <div><span>Open Permission</span><strong>{getTargetPermission(selectedItem.targetPage)}</strong></div>
                  <div><span>Follow-Up Permission</span><strong>{selectedItem.followUpPermission}</strong></div>
                  <div><span>Action Type</span><strong>{selectedItem.followUpActionType}</strong></div>
                  <div><span>Handler</span><strong>{selectedItem.handlerKey ?? 'Server placeholder required'}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => recordCalendarState(selectedItem, 'Scheduled', 'Owner action scheduled locally.', { scheduledAt: scheduleInMinutes(30) })}>
                    <CalendarClock size={15} strokeWidth={1.8} />
                    Schedule Today
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => recordCalendarState(selectedItem, 'Confirmed', 'Owner confirmed locally.', { scheduledAt: selectedItem.scheduledAt })}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Confirm Owner
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => recordCalendarState(selectedItem, 'Done', 'Owner action marked done locally.', { scheduledAt: selectedItem.scheduledAt })}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Done
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => recordCalendarState(selectedItem, 'Snoozed', 'Owner action snoozed locally for one day.', { scheduledAt: scheduleInHours(24), snoozedUntil: scheduleInHours(24) })}>
                    <Clock3 size={15} strokeWidth={1.8} />
                    Snooze 24h
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => recordCalendarState(selectedItem, 'Skipped', 'Owner action skipped locally.', { scheduledAt: selectedItem.scheduledAt })}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Skip
                  </button>
                  <button className="ghost-action" disabled={!canManageCalendar} onClick={() => resetCalendarState(selectedItem)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('operator-daily-brief')}>
                      <GitBranch size={15} strokeWidth={1.8} />
                      Daily Brief
                    </button>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {getTargetPermission(selectedItem.targetPage)}.</p>}
                {!canQueueSelected && <p className="warning-copy">Follow-up queueing requires {selectedItem.followUpPermission}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedItem.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No owner action selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildCalendarItemMetadata(item: OwnerActionCalendarItem, extra: Record<string, unknown>) {
  return {
    ownerActionCalendarItemId: item.id,
    lane: item.lane,
    priority: item.priority,
    window: item.window,
    status: item.status,
    owner: item.owner,
    source: item.sourceLabel,
    scope: item.scope,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    followUpActionType: item.followUpActionType,
    ...extra,
  }
}

function getTargetPermission(page: OwnerActionCalendarTargetPage): PermissionKey {
  if (page === 'revenue') return 'revenue.view'
  if (page === 'support') return 'support.view'
  if (page === 'registrations') return 'registrations.view'
  if (page === 'usage') return 'usage.view'
  if (page === 'health') return 'health.view'
  if (page === 'audit') return 'audit.view'
  if (page === 'saved-views') return 'saved_views.view'
  if (page === 'agents') return 'agents.view'
  if (page === 'client-success') return 'clients.view'
  if (page === 'data-quality') return 'health.view'
  if (page === 'action-requests' || page === 'approval-center') return 'admin_actions.view'
  if (page === 'coverage-ledger' || page === 'notification-routing' || page === 'on-call-schedule' || page === 'watch-center' || page === 'sla-board') return 'notifications.view'
  return 'dashboard.view'
}

function getTargetLabel(page: OwnerActionCalendarTargetPage) {
  const labels: Partial<Record<OwnerActionCalendarTargetPage, string>> = {
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

function prioritySortValue(item: OwnerActionCalendarItem) {
  if (item.priority === 'Critical') return `0 ${item.priority}`
  if (item.priority === 'High') return `1 ${item.priority}`
  if (item.priority === 'Medium') return `2 ${item.priority}`
  return `3 ${item.priority}`
}

function windowSortValue(item: OwnerActionCalendarItem) {
  if (item.window === 'Overdue') return `0 ${item.window}`
  if (item.window === 'Today') return `1 ${item.window}`
  if (item.window === 'Tomorrow') return `2 ${item.window}`
  if (item.window === 'This Week') return `3 ${item.window}`
  if (item.window === 'Next Week') return `4 ${item.window}`
  return `5 ${item.window}`
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

function formatWindowAge(minutesUntilDue: number) {
  if (minutesUntilDue < 0) {
    const minutesLate = Math.abs(minutesUntilDue)
    if (minutesLate < 60) return `${minutesLate} minutes overdue`
    if (minutesLate < 1440) return `${Math.round(minutesLate / 60)} hours overdue`
    return `${Math.round(minutesLate / 1440)} days overdue`
  }
  if (minutesUntilDue < 60) return `${minutesUntilDue} minutes left`
  if (minutesUntilDue < 1440) return `${Math.round(minutesUntilDue / 60)} hours left`
  return `${Math.round(minutesUntilDue / 1440)} days left`
}

function scheduleInMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function scheduleInHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
