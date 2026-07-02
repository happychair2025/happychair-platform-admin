import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  GitBranch,
  ListChecks,
  RotateCcw,
  Send,
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
  buildExceptionSlaPolicies,
  useLocalExceptionSlaPolicyStates,
} from '../../lib/command-work/exceptionSlaPolicies'
import {
  buildExecutiveMorningReview,
  useLocalExecutiveMorningReviewStates,
} from '../../lib/command-work/executiveMorningReview'
import {
  buildOperatingExceptions,
  useLocalOperatingExceptionStates,
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
  buildOwnerCommitmentLedger,
  formatCommitmentDue,
  getOwnerCommitmentPriorityTone,
  getOwnerCommitmentSourceTone,
  getOwnerCommitmentStatusTone,
  ownerCommitmentLedgerBoundaryRule,
  summarizeOwnerCommitmentLedger,
  useLocalOwnerCommitmentStates,
  type OwnerCommitmentItem,
  type OwnerCommitmentSource,
  type OwnerCommitmentStatus,
  type OwnerCommitmentTargetPage,
} from '../../lib/command-work/ownerCommitmentLedger'
import {
  buildOwnerDecisionRoom,
  useLocalOwnerDecisionStates,
} from '../../lib/command-work/ownerDecisionRoom'
import { useLocalCommandBriefSnapshots } from '../../lib/command-digest/briefArchive'
import {
  buildCommandDigest,
  useLocalCommandDigestStates,
} from '../../lib/command-digest/commandDigest'
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

interface OwnerCommitmentLedgerPageProps {
  session: AdminSession
  onOpenTarget?: (page: OwnerCommitmentTargetPage) => void
}

const statusFilters: Array<'All' | OwnerCommitmentStatus> = [
  'All',
  'Overdue',
  'Blocked',
  'Due Soon',
  'Open',
  'In Progress',
  'Completed',
  'Dismissed',
]

const sourceFilters: Array<'All' | OwnerCommitmentSource> = ['All', 'Owner Decision', 'Follow-Up', 'Escalation', 'Closure']

export default function OwnerCommitmentLedgerPage({ session, onOpenTarget }: OwnerCommitmentLedgerPageProps) {
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
  const [localExceptionStates] = useLocalOperatingExceptionStates()
  const [localPolicyStates] = useLocalExceptionSlaPolicyStates()
  const [localMorningStates] = useLocalExecutiveMorningReviewStates()
  const [localOwnerDecisionStates] = useLocalOwnerDecisionStates()
  const [localCommitmentStates, setLocalCommitmentStates] = useLocalOwnerCommitmentStates()
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | OwnerCommitmentStatus>('All')
  const [sourceFilter, setSourceFilter] = useState<'All' | OwnerCommitmentSource>('All')
  const [notice, setNotice] = useState('')
  const canTrack = hasPermission(session.role, 'dashboard.view')

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
  const slaPolicies = useMemo(() => buildExceptionSlaPolicies({
    exceptions,
    localStates: localPolicyStates,
  }), [exceptions, localPolicyStates])
  const morningReview = useMemo(() => buildExecutiveMorningReview({
    dailyBrief,
    commandWorkItems,
    decisionBriefs,
    exceptions,
    slaPolicies,
    handoffItems,
    localStates: localMorningStates,
  }), [commandWorkItems, dailyBrief, decisionBriefs, exceptions, handoffItems, localMorningStates, slaPolicies])
  const decisions = useMemo(() => buildOwnerDecisionRoom({
    morningReview,
    localStates: localOwnerDecisionStates,
  }), [localOwnerDecisionStates, morningReview])
  const commitments = useMemo(() => buildOwnerCommitmentLedger({
    decisions,
    localStates: localCommitmentStates,
  }), [decisions, localCommitmentStates])
  const summary = useMemo(() => summarizeOwnerCommitmentLedger(commitments), [commitments])
  const filteredCommitments = useMemo(() => commitments.filter(commitment => {
    const statusMatches = statusFilter === 'All' || commitment.status === statusFilter
    const sourceMatches = sourceFilter === 'All' || commitment.source === sourceFilter
    return statusMatches && sourceMatches
  }), [commitments, sourceFilter, statusFilter])
  const selectedCommitment = filteredCommitments.find(commitment => commitment.id === selectedId)
    ?? commitments.find(commitment => commitment.id === selectedId)
    ?? filteredCommitments[0]
    ?? commitments[0]
  const canOpenSelected = selectedCommitment ? hasPermission(session.role, selectedCommitment.targetPermission) : false

  const recordCommitment = (
    commitment: OwnerCommitmentItem,
    status: OwnerCommitmentStatus,
    note: string,
    blockedReason?: string,
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: commitment.scope,
      actionKey: `owner_commitment_ledger.${sanitizeActionKey(commitment.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} owner commitment: ${commitment.title}`,
      severity: status === 'Blocked' || status === 'Overdue' || commitment.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        commitmentId: commitment.id,
        relatedDecisionId: commitment.relatedDecisionId,
        source: commitment.source,
        sourceStatus: commitment.sourceStatus,
        priority: commitment.priority,
        targetPage: commitment.targetPage,
        relatedRecordId: commitment.relatedRecordId,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalCommitmentStates(current => [
      {
        commitmentId: commitment.id,
        status,
        owner: commitment.owner,
        note,
        blockedReason: status === 'Blocked'
          ? blockedReason ?? 'Owner blocker recorded locally.'
          : commitment.localState?.blockedReason,
        dueAt: commitment.dueAt,
        completedAt: status === 'Completed' ? updatedAt : commitment.localState?.completedAt,
        updatedAt,
      },
      ...current.filter(state => state.commitmentId !== commitment.id),
    ])
    setSelectedId(commitment.id)
    setNotice(`${commitment.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetCommitment = (commitment: OwnerCommitmentItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: commitment.scope,
      actionKey: `owner_commitment_ledger.${sanitizeActionKey(commitment.id)}.reset_local.mock`,
      actionLabel: `Reset local owner commitment: ${commitment.title}`,
      severity: 'notice',
      metadata: {
        commitmentId: commitment.id,
        relatedDecisionId: commitment.relatedDecisionId,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalCommitmentStates(current => current.filter(state => state.commitmentId !== commitment.id))
    setSelectedId(commitment.id)
    setNotice(`${commitment.title} reset to generated commitment state and recorded in Audit Logs.`)
  }

  const openTarget = (commitment: OwnerCommitmentItem) => {
    const result = runAdminAction(session, {
      permission: commitment.targetPermission,
      scope: commitment.scope,
      actionKey: `owner_commitment_ledger.${sanitizeActionKey(commitment.id)}.opened_target.mock`,
      actionLabel: `Opened owner commitment target: ${commitment.title}`,
      severity: commitment.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        commitmentId: commitment.id,
        targetPage: commitment.targetPage,
        relatedDecisionId: commitment.relatedDecisionId,
        relatedRecordId: commitment.relatedRecordId,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${commitment.title} opened in ${targetPageLabels[commitment.targetPage]}.`)
    onOpenTarget?.(commitment.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Command"
        title="Owner Commitment Ledger"
        description="Accountability layer for owner decisions: commitments, owners, due state, blockers, evidence, and local closure tracking."
        action={<StatusPill label={canTrack ? 'Local commitment controls enabled' : 'Read only'} tone={canTrack ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Commitments" value={String(summary.open)} delta={`${summary.critical} critical active`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Blocked / Overdue" value={`${summary.blocked}/${summary.overdue}`} delta="Needs owner attention" tone={summary.blocked || summary.overdue ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Due Soon / In Progress" value={`${summary.dueSoon}/${summary.inProgress}`} delta={`${sourceLabel} plus local decision state`} tone={summary.dueSoon ? 'warn' : summary.inProgress ? 'neutral' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Completed / Dismissed" value={`${summary.completed}/${summary.dismissed}`} delta={`${summary.followUps} follow-up commitments`} tone={summary.completed ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel owner-commitment-boundary-panel">
        <div>
          <p className="eyebrow">Commitment Boundary</p>
          <h2>Track owner promises here; governed execution still happens elsewhere</h2>
          <span>{ownerCommitmentLedgerBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} commitment records`} tone={summary.overdue || summary.blocked ? 'danger' : summary.open || summary.dueSoon ? 'warn' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Owner commitment status filters">
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
            <span>{status === 'All' ? commitments.length : commitments.filter(commitment => commitment.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Owner commitment source filters">
        {sourceFilters.map(source => (
          <button
            key={source}
            className={sourceFilter === source ? 'selected' : ''}
            onClick={() => {
              setSourceFilter(source)
              setSelectedId('')
            }}
          >
            {source}
            <span>{source === 'All' ? commitments.length : commitments.filter(commitment => commitment.source === source).length}</span>
          </button>
        ))}
      </div>

      <div className="owner-commitment-layout">
        <DataTable
          label="Owner Commitments"
          rows={filteredCommitments}
          pageSize={10}
          emptyTitle="No owner commitments match these filters."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getOwnerCommitmentPriorityTone(row.priority)} />,
            },
            {
              key: 'commitment',
              header: 'Commitment',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.source} ${row.sourceStatus}`,
              render: row => <div><StatusPill label={row.source} tone={getOwnerCommitmentSourceTone(row.source)} /><span className="cell-subtext">{row.sourceStatus}</span></div>,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => statusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getOwnerCommitmentStatusTone(row.status)} />,
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
              render: row => <span className={row.status === 'Overdue' ? 'danger-copy' : undefined}>{formatCommitmentDue(row.dueAt)}</span>,
            },
          ]}
        />

        <aside className="detail-panel owner-commitment-detail-panel">
          {selectedCommitment ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Commitment Record</p>
                  <h2>{selectedCommitment.title}</h2>
                </div>
                <StatusPill label={selectedCommitment.status} tone={getOwnerCommitmentStatusTone(selectedCommitment.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Source</span><strong>{selectedCommitment.source}</strong></div>
                <div><span>Source Status</span><strong>{selectedCommitment.sourceStatus}</strong></div>
                <div><span>Owner</span><strong>{selectedCommitment.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedCommitment.scope}</strong></div>
                <div><span>Priority</span><strong>{selectedCommitment.priority}</strong></div>
                <div><span>Due</span><strong>{formatCommitmentDue(selectedCommitment.dueAt)}</strong></div>
                <div><span>Target</span><strong>{targetPageLabels[selectedCommitment.targetPage]}</strong></div>
              </div>

              <section className={`panel owner-commitment-status-panel tone-${getOwnerCommitmentStatusTone(selectedCommitment.status)}`}>
                <div>
                  <p className="eyebrow">Recommended Next Step</p>
                  <h2>{selectedCommitment.recommendedAction}</h2>
                  <span>{selectedCommitment.description}</span>
                </div>
                <div className="owner-commitment-status-meta">
                  <StatusPill label={selectedCommitment.source} tone={getOwnerCommitmentSourceTone(selectedCommitment.source)} />
                  <strong>{selectedCommitment.targetPermission}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Governed Path</h3>
                <div className="owner-commitment-path-grid">
                  <div>
                    <FileCheck2 size={16} strokeWidth={1.8} />
                    <span>Decision</span>
                    <strong>{selectedCommitment.relatedDecisionId}</strong>
                  </div>
                  <div>
                    <GitBranch size={16} strokeWidth={1.8} />
                    <span>Selected Path</span>
                    <strong>{selectedCommitment.selectedOptionLabel ?? 'Not selected'}</strong>
                  </div>
                  <div>
                    <ShieldCheck size={16} strokeWidth={1.8} />
                    <span>Required Permission</span>
                    <strong>{selectedCommitment.targetPermission}</strong>
                  </div>
                  <div>
                    <TimerReset size={16} strokeWidth={1.8} />
                    <span>Completed</span>
                    <strong>{selectedCommitment.completedAt ? formatCommitmentDue(selectedCommitment.completedAt) : 'Not completed'}</strong>
                  </div>
                </div>
              </div>

              {selectedCommitment.blockedReason && (
                <section className="panel owner-commitment-blocker-panel">
                  <div>
                    <p className="eyebrow">Blocker</p>
                    <h2>{selectedCommitment.blockedReason}</h2>
                    <span>Blocker is local tracking state only. It does not pause production workflows by itself.</span>
                  </div>
                  <StatusPill label="Blocked" tone="danger" />
                </section>
              )}

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedCommitment.evidence.map(evidence => (
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
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedCommitment)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canTrack} onClick={() => recordCommitment(selectedCommitment, 'In Progress', 'Commitment started locally.')}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Start Work
                  </button>
                  <button className="ghost-action" disabled={!canTrack} onClick={() => recordCommitment(selectedCommitment, 'Blocked', 'Commitment blocker recorded locally.', 'Needs owner clarification before governed execution.')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Mark Blocked
                  </button>
                  <button className="ghost-action" disabled={!canTrack} onClick={() => recordCommitment(selectedCommitment, 'Completed', 'Commitment completed locally after evidence review.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Complete
                  </button>
                  <button className="ghost-action" disabled={!canTrack} onClick={() => recordCommitment(selectedCommitment, 'Dismissed', 'Commitment dismissed locally as no longer actionable.')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Dismiss
                  </button>
                  <button className="ghost-action" disabled={!canTrack} onClick={() => resetCommitment(selectedCommitment)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <>
                      <button className="ghost-action" onClick={() => onOpenTarget('owner-decision-room')}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Decision Room
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('action-request-launchpad')}>
                        <Send size={15} strokeWidth={1.8} />
                        Action Launchpad
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('executive-morning-review')}>
                        <Clock3 size={15} strokeWidth={1.8} />
                        Morning Review
                      </button>
                    </>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {selectedCommitment.targetPermission}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedCommitment.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No owner commitment selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function prioritySortValue(priority: OwnerCommitmentItem['priority']) {
  if (priority === 'Critical') return '0'
  if (priority === 'High') return '1'
  if (priority === 'Medium') return '2'
  return '3'
}

function statusSortValue(status: OwnerCommitmentStatus) {
  if (status === 'Overdue') return '0'
  if (status === 'Blocked') return '1'
  if (status === 'Due Soon') return '2'
  if (status === 'Open') return '3'
  if (status === 'In Progress') return '4'
  if (status === 'Completed') return '5'
  return '6'
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const targetPageLabels: Record<OwnerCommitmentTargetPage, string> = {
  'action-request-launchpad': 'Action Request Launchpad',
  'owner-commitment-ledger': 'Owner Commitment Ledger',
  'owner-decision-room': 'Owner Decision Room',
  'executive-morning-review': 'Morning Review',
  'operator-daily-brief': 'Daily Brief',
  'operating-exceptions': 'Operating Exceptions',
  'exception-sla-policies': 'Exception SLA Policies',
  'command-handoff-timeline': 'Handoff Timeline',
  'decision-briefs': 'Decision Briefs',
  'command-work': 'Command Queue',
  revenue: 'Revenue',
  support: 'Support Center',
  registrations: 'Registrations',
  usage: 'Usage Analytics',
  health: 'Client Health',
  'approval-center': 'Approval Center',
  'action-requests': 'Action Requests',
  audit: 'Audit Logs',
}
