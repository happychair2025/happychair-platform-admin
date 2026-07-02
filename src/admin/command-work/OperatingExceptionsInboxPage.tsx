import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  UserCheck,
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
import { buildActionTimeline } from '../../lib/admin-actions/actionTimeline'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import { buildCommandCadence } from '../../lib/command-cadence/commandCadence'
import {
  buildCommandHandoffTimeline,
  useLocalCommandHandoffTimelineStates,
} from '../../lib/command-work/commandHandoffTimeline'
import {
  buildCommandWorkQueue,
  useLocalCommandWorkStates,
} from '../../lib/command-work/commandWorkQueue'
import {
  buildDecisionBriefs,
  useLocalDecisionBriefStates,
} from '../../lib/command-work/decisionBriefs'
import {
  buildOperatingExceptions,
  getOperatingExceptionSeverityTone,
  getOperatingExceptionStatusTone,
  getOperatingExceptionTypeTone,
  operatingExceptionsBoundaryRule,
  summarizeOperatingExceptions,
  useLocalOperatingExceptionStates,
  type OperatingExceptionItem,
  type OperatingExceptionStatus,
  type OperatingExceptionTargetPage,
  type OperatingExceptionType,
} from '../../lib/command-work/operatingExceptionsInbox'
import {
  buildOperatorDailyBrief,
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
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface OperatingExceptionsInboxPageProps {
  session: AdminSession
  onOpenTarget?: (page: OperatingExceptionTargetPage) => void
}

const typeFilters: Array<'All' | OperatingExceptionType> = [
  'All',
  'Blocked Handoff',
  'Overdue Owner Action',
  'Approval Gap',
  'Audit Gap',
  'Critical Command',
  'Governance Blocker',
]
const statusFilters: Array<'All' | OperatingExceptionStatus> = ['All', 'Open', 'Acknowledged', 'Assigned', 'Escalated', 'Resolved', 'Dismissed']

export default function OperatingExceptionsInboxPage({ session, onOpenTarget }: OperatingExceptionsInboxPageProps) {
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
  const [localHandoffStates] = useLocalCommandHandoffTimelineStates()
  const [localExceptionStates, setLocalExceptionStates] = useLocalOperatingExceptionStates()
  const [selectedId, setSelectedId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | OperatingExceptionType>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | OperatingExceptionStatus>('All')
  const [notice, setNotice] = useState('')
  const canManageExceptions = hasPermission(session.role, 'dashboard.view')

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
  const handoffItems = useMemo(() => buildCommandHandoffTimeline({
    calendarItems,
    actionRequests,
    actionTimelineEvents,
    auditEvents,
    localStates: localHandoffStates,
  }), [actionRequests, actionTimelineEvents, auditEvents, calendarItems, localHandoffStates])
  const exceptions = useMemo(() => buildOperatingExceptions({
    calendarItems,
    handoffItems,
    actionRequests,
    governanceRecords,
    localStates: localExceptionStates,
  }), [actionRequests, calendarItems, governanceRecords, handoffItems, localExceptionStates])
  const summary = useMemo(() => summarizeOperatingExceptions(exceptions), [exceptions])
  const filteredExceptions = useMemo(() => exceptions.filter(item => {
    if (typeFilter !== 'All' && item.type !== typeFilter) return false
    if (statusFilter !== 'All' && item.status !== statusFilter) return false
    return true
  }), [exceptions, statusFilter, typeFilter])
  const selectedException = filteredExceptions.find(item => item.id === selectedId)
    ?? exceptions.find(item => item.id === selectedId)
    ?? filteredExceptions[0]
    ?? exceptions[0]
  const canOpenSelected = selectedException ? hasPermission(session.role, selectedException.targetPermission) : false

  const recordExceptionState = (
    exception: OperatingExceptionItem,
    status: OperatingExceptionStatus,
    note: string,
    owner = exception.owner,
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: exception.scope,
      actionKey: `operating_exceptions.${sanitizeActionKey(exception.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} operating exception: ${exception.title}`,
      severity: exception.severity === 'Critical' || status === 'Escalated' ? 'warning' : 'notice',
      metadata: buildExceptionMetadata(exception, {
        localStatus: status,
        localOnly: true,
        mutationApplied: false,
        owner,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalExceptionStates(current => [
      {
        exceptionId: exception.id,
        status,
        owner,
        note,
        acknowledgedAt: status === 'Acknowledged' || status === 'Assigned' || status === 'Escalated' ? updatedAt : exception.localState?.acknowledgedAt,
        resolvedAt: status === 'Resolved' ? updatedAt : exception.localState?.resolvedAt,
        updatedAt,
      },
      ...current.filter(state => state.exceptionId !== exception.id),
    ])
    setSelectedId(exception.id)
    setNotice(`${exception.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetExceptionState = (exception: OperatingExceptionItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: exception.scope,
      actionKey: `operating_exceptions.${sanitizeActionKey(exception.id)}.reset_local.mock`,
      actionLabel: `Reset local operating exception state: ${exception.title}`,
      severity: 'notice',
      metadata: buildExceptionMetadata(exception, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalExceptionStates(current => current.filter(state => state.exceptionId !== exception.id))
    setSelectedId(exception.id)
    setNotice(`${exception.title} reset to open exception state and recorded in Audit Logs.`)
  }

  const openTarget = (exception: OperatingExceptionItem) => {
    const result = runAdminAction(session, {
      permission: exception.targetPermission,
      scope: exception.scope,
      actionKey: `operating_exceptions.${sanitizeActionKey(exception.id)}.opened_target.mock`,
      actionLabel: `Opened operating exception target: ${exception.title}`,
      severity: exception.severity === 'Critical' ? 'warning' : 'notice',
      metadata: buildExceptionMetadata(exception, {
        targetPage: exception.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${exception.title} opened in ${getTargetLabel(exception.targetPage)}.`)
    onOpenTarget?.(exception.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Exception Command"
        title="Operating Exceptions Inbox"
        description="A daily triage inbox for blocked handoffs, overdue owner actions, approval gaps, missing audit evidence, and unresolved critical command lines."
        action={<StatusPill label={canManageExceptions ? 'Local exception controls enabled' : 'Read only'} tone={canManageExceptions ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Exceptions" value={String(summary.open)} delta={`${summary.critical} critical`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Blocked / Overdue" value={`${summary.blocked}/${summary.overdue}`} delta="Needs operating owner attention" tone={summary.blocked || summary.overdue ? 'danger' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Approval / Audit Gaps" value={`${summary.approvalGaps}/${summary.auditGaps}`} delta={`${sourceLabel} plus local lifecycle state`} tone={summary.approvalGaps || summary.auditGaps ? 'warn' : 'neutral'} icon={<GitBranch size={16} />} />
        <MetricCard label="Resolved" value={String(summary.resolved)} delta={`${summary.assigned} assigned / ${summary.escalated} escalated`} tone={summary.resolved ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel operating-exceptions-boundary-panel">
        <div>
          <p className="eyebrow">Exception Boundary</p>
          <h2>Triage exceptions here; approval and execution remain governed paths</h2>
          <span>{operatingExceptionsBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} exceptions`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Operating exception type filters">
        {typeFilters.map(type => (
          <button
            key={type}
            className={typeFilter === type ? 'selected' : ''}
            onClick={() => {
              setTypeFilter(type)
              setSelectedId('')
            }}
          >
            {type}
            <span>{type === 'All' ? exceptions.length : exceptions.filter(exception => exception.type === type).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Operating exception status filters">
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
            <span>{status === 'All' ? exceptions.length : exceptions.filter(exception => exception.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="operating-exceptions-layout">
        <DataTable
          label="Operating Exceptions"
          rows={filteredExceptions}
          pageSize={10}
          emptyTitle="No operating exceptions match these filters."
          columns={[
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => severitySortValue(row),
              render: row => <StatusPill label={row.severity} tone={getOperatingExceptionSeverityTone(row.severity)} />,
            },
            {
              key: 'exception',
              header: 'Exception',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.type,
              render: row => <StatusPill label={row.type} tone={getOperatingExceptionTypeTone(row.type)} />,
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
              header: 'Local',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getOperatingExceptionStatusTone(row.status)} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.sourceLabel} ${row.targetPage}`,
              render: row => <div><strong>{row.sourceLabel}</strong><span className="cell-subtext">{getTargetLabel(row.targetPage)}</span></div>,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => row.dueAt,
              render: row => formatDateTime(row.dueAt),
            },
          ]}
        />

        <aside className="detail-panel operating-exceptions-detail-panel">
          {selectedException ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Exception Detail</p>
                  <h2>{selectedException.title}</h2>
                </div>
                <StatusPill label={selectedException.severity} tone={getOperatingExceptionSeverityTone(selectedException.severity)} />
              </div>

              <div className="request-scope-list">
                <div><span>Type</span><strong>{selectedException.type}</strong></div>
                <div><span>Status</span><strong>{selectedException.status}</strong></div>
                <div><span>Owner</span><strong>{selectedException.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedException.scope}</strong></div>
                <div><span>Target</span><strong>{getTargetLabel(selectedException.targetPage)}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedException.dueAt)}</strong></div>
              </div>

              <section className={`panel operating-exceptions-status-panel tone-${getOperatingExceptionSeverityTone(selectedException.severity)}`}>
                <div>
                  <p className="eyebrow">Recommended Triage</p>
                  <h2>{selectedException.recommendedAction}</h2>
                  <span>{selectedException.description}</span>
                </div>
                <div className="operating-exceptions-status-meta">
                  <StatusPill label={selectedException.type} tone={getOperatingExceptionTypeTone(selectedException.type)} />
                  <strong>{selectedException.targetPermission}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedException.evidence.map(evidence => (
                    <div key={evidence}>
                      <Eye size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Lineage</h3>
                <div className="operating-exceptions-related-grid">
                  <div><span>Record</span><strong>{selectedException.relatedRecordId}</strong></div>
                  <div><span>Action Request</span><strong>{selectedException.linkedActionRequestId ?? 'Not linked'}</strong></div>
                  <div><span>Audit Event</span><strong>{selectedException.linkedAuditEventId ?? 'Not linked'}</strong></div>
                  <div><span>Detected</span><strong>{formatDateTime(selectedException.detectedAt)}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedException)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => recordExceptionState(selectedException, 'Acknowledged', 'Operating exception acknowledged locally.')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Acknowledge
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => recordExceptionState(selectedException, 'Assigned', `Assigned locally to ${session.email}.`, session.email)}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Assign To Me
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => recordExceptionState(selectedException, 'Escalated', 'Operating exception escalated locally.')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Escalate
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => recordExceptionState(selectedException, 'Resolved', 'Operating exception resolved locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Resolve
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => recordExceptionState(selectedException, 'Dismissed', 'Operating exception dismissed locally.')}>
                    <ShieldAlert size={15} strokeWidth={1.8} />
                    Dismiss
                  </button>
                  <button className="ghost-action" disabled={!canManageExceptions} onClick={() => resetExceptionState(selectedException)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('command-handoff-timeline')}>
                      <GitBranch size={15} strokeWidth={1.8} />
                      Handoff Timeline
                    </button>
                  )}
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('exception-sla-policies')}>
                      <TimerReset size={15} strokeWidth={1.8} />
                      SLA Policies
                    </button>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {selectedException.targetPermission}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedException.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No operating exception selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildExceptionMetadata(exception: OperatingExceptionItem, extra: Record<string, unknown>) {
  return {
    operatingExceptionId: exception.id,
    operatingExceptionType: exception.type,
    severity: exception.severity,
    status: exception.status,
    source: exception.sourceLabel,
    scope: exception.scope,
    targetPage: exception.targetPage,
    relatedRecordId: exception.relatedRecordId,
    actionRequestId: exception.linkedActionRequestId,
    auditEventId: exception.linkedAuditEventId,
    ...extra,
  }
}

function getTargetLabel(page: OperatingExceptionTargetPage) {
  const labels: Partial<Record<OperatingExceptionTargetPage, string>> = {
    'operating-exceptions': 'Operating Exceptions',
    'exception-sla-policies': 'Exception SLA Policies',
    'command-handoff-timeline': 'Handoff Timeline',
    'owner-action-calendar': 'Owner Calendar',
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

function severitySortValue(item: OperatingExceptionItem) {
  if (item.severity === 'Critical') return `0 ${item.severity}`
  if (item.severity === 'High') return `1 ${item.severity}`
  if (item.severity === 'Medium') return `2 ${item.severity}`
  return `3 ${item.severity}`
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
