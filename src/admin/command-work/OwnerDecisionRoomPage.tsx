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
  getExecutiveMorningReviewLaneTone,
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
  buildOwnerDecisionRoom,
  getOwnerDecisionOptionTone,
  getOwnerDecisionPriorityTone,
  getOwnerDecisionStatusTone,
  ownerDecisionRoomBoundaryRule,
  summarizeOwnerDecisionRoom,
  useLocalOwnerDecisionStates,
  type OwnerDecisionOption,
  type OwnerDecisionRecord,
  type OwnerDecisionStatus,
  type OwnerDecisionTargetPage,
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

interface OwnerDecisionRoomPageProps {
  session: AdminSession
  onOpenTarget?: (page: OwnerDecisionTargetPage) => void
}

const statusFilters: Array<'All' | OwnerDecisionStatus> = ['All', 'Open', 'Option Selected', 'Follow-Up Needed', 'Deferred', 'Escalated', 'Closed']

export default function OwnerDecisionRoomPage({ session, onOpenTarget }: OwnerDecisionRoomPageProps) {
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
  const [localOwnerDecisionStates, setLocalOwnerDecisionStates] = useLocalOwnerDecisionStates()
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | OwnerDecisionStatus>('All')
  const [notice, setNotice] = useState('')
  const canDecide = hasPermission(session.role, 'dashboard.view')

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
  const summary = useMemo(() => summarizeOwnerDecisionRoom(decisions), [decisions])
  const filteredDecisions = useMemo(() => statusFilter === 'All'
    ? decisions
    : decisions.filter(decision => decision.status === statusFilter),
  [decisions, statusFilter])
  const selectedDecision = filteredDecisions.find(decision => decision.id === selectedId)
    ?? decisions.find(decision => decision.id === selectedId)
    ?? filteredDecisions[0]
    ?? decisions[0]
  const canOpenSelected = selectedDecision ? hasPermission(session.role, selectedDecision.targetPermission) : false
  const recommendedOption = selectedDecision?.options.find(option => option.kind === 'Recommended')

  const recordDecision = (
    decision: OwnerDecisionRecord,
    status: OwnerDecisionStatus,
    option: OwnerDecisionOption | undefined,
    note: string,
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: decision.scope,
      actionKey: `owner_decision_room.${sanitizeActionKey(decision.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} owner decision: ${decision.title}`,
      severity: status === 'Escalated' || decision.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        decisionId: decision.id,
        morningReviewId: decision.reviewId,
        lane: decision.lane,
        priority: decision.priority,
        selectedOptionId: option?.id,
        selectedOptionKind: option?.kind,
        requiresApproval: option?.requiresApproval,
        targetPage: option?.targetPage ?? decision.targetPage,
        relatedRecordId: decision.relatedRecordId,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalOwnerDecisionStates(current => [
      {
        decisionId: decision.id,
        status,
        selectedOptionId: option?.id ?? decision.selectedOption?.id,
        note,
        decidedBy: session.email,
        decidedAt: status === 'Option Selected' || status === 'Closed' || status === 'Escalated' ? updatedAt : decision.localState?.decidedAt,
        followUpDueAt: status === 'Follow-Up Needed' ? getFollowUpDueAt() : decision.localState?.followUpDueAt,
        updatedAt,
      },
      ...current.filter(state => state.decisionId !== decision.id),
    ])
    setSelectedId(decision.id)
    setNotice(`${decision.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetDecision = (decision: OwnerDecisionRecord) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: decision.scope,
      actionKey: `owner_decision_room.${sanitizeActionKey(decision.id)}.reset_local.mock`,
      actionLabel: `Reset local owner decision: ${decision.title}`,
      severity: 'notice',
      metadata: {
        decisionId: decision.id,
        morningReviewId: decision.reviewId,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalOwnerDecisionStates(current => current.filter(state => state.decisionId !== decision.id))
    setSelectedId(decision.id)
    setNotice(`${decision.title} reset to open decision state and recorded in Audit Logs.`)
  }

  const openTarget = (decision: OwnerDecisionRecord) => {
    const result = runAdminAction(session, {
      permission: decision.targetPermission,
      scope: decision.scope,
      actionKey: `owner_decision_room.${sanitizeActionKey(decision.id)}.opened_target.mock`,
      actionLabel: `Opened owner decision target: ${decision.title}`,
      severity: decision.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        decisionId: decision.id,
        targetPage: decision.targetPage,
        relatedRecordId: decision.relatedRecordId,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${decision.title} opened in ${targetPageLabels[decision.targetPage]}.`)
    onOpenTarget?.(decision.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Command"
        title="Owner Decision Room"
        description="Structured owner decisions for the morning review: options, impact, risk, required approval, evidence, and local follow-up state."
        action={<StatusPill label={canDecide ? 'Local decision controls enabled' : 'Read only'} tone={canDecide ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Decisions" value={String(summary.open)} delta={`${summary.critical} critical`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<FileCheck2 size={16} />} />
        <MetricCard label="Follow-Up / Escalated" value={`${summary.followUps}/${summary.escalated}`} delta="Local owner decision state" tone={summary.escalated ? 'danger' : summary.followUps ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
        <MetricCard label="Approvals Required" value={String(summary.approvalsRequired)} delta={`${sourceLabel} plus local review state`} tone={summary.approvalsRequired ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Recorded / Closed" value={`${summary.selected}/${summary.closed}`} delta={`${summary.deferred} deferred`} tone={summary.selected || summary.closed ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel owner-decision-boundary-panel">
        <div>
          <p className="eyebrow">Decision Boundary</p>
          <h2>Record intent here; approval and execution remain governed paths</h2>
          <span>{ownerDecisionRoomBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} decision packets`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Owner decision status filters">
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
            <span>{status === 'All' ? decisions.length : decisions.filter(decision => decision.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="owner-decision-layout">
        <DataTable
          label="Owner Decision Queue"
          rows={filteredDecisions}
          pageSize={10}
          emptyTitle="No owner decisions match this status."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getOwnerDecisionPriorityTone(row.priority)} />,
            },
            {
              key: 'decision',
              header: 'Decision',
              sortable: true,
              searchValue: row => `${row.title} ${row.context} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getExecutiveMorningReviewLaneTone(row.lane)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getOwnerDecisionStatusTone(row.status)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'option',
              header: 'Selected Option',
              sortable: true,
              searchValue: row => row.selectedOption?.label ?? 'None',
              render: row => row.selectedOption ? <StatusPill label={row.selectedOption.kind} tone={getOwnerDecisionOptionTone(row.selectedOption.kind)} /> : 'Not selected',
            },
          ]}
        />

        <aside className="detail-panel owner-decision-detail-panel">
          {selectedDecision ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Decision Packet</p>
                  <h2>{selectedDecision.title}</h2>
                </div>
                <StatusPill label={selectedDecision.status} tone={getOwnerDecisionStatusTone(selectedDecision.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedDecision.lane}</strong></div>
                <div><span>Priority</span><strong>{selectedDecision.priority}</strong></div>
                <div><span>Owner</span><strong>{selectedDecision.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedDecision.scope}</strong></div>
                <div><span>Source</span><strong>{selectedDecision.sourceLabel}</strong></div>
                <div><span>Target</span><strong>{targetPageLabels[selectedDecision.targetPage]}</strong></div>
              </div>

              <section className={`panel owner-decision-status-panel tone-${getOwnerDecisionPriorityTone(selectedDecision.priority)}`}>
                <div>
                  <p className="eyebrow">Recommendation</p>
                  <h2>{selectedDecision.recommendation}</h2>
                  <span>{selectedDecision.context}</span>
                </div>
                <div className="owner-decision-status-meta">
                  <StatusPill label={selectedDecision.lane} tone={getExecutiveMorningReviewLaneTone(selectedDecision.lane)} />
                  <strong>{selectedDecision.targetPermission}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Decision Options</h3>
                <div className="owner-decision-option-grid">
                  {selectedDecision.options.map(option => (
                    <button
                      key={option.id}
                      className={selectedDecision.selectedOption?.id === option.id ? 'selected' : ''}
                      disabled={!canDecide}
                      onClick={() => recordDecision(selectedDecision, statusFromOption(option), option, `${option.label} selected locally.`)}
                    >
                      <div>
                        <StatusPill label={option.kind} tone={getOwnerDecisionOptionTone(option.kind)} />
                        {option.requiresApproval && <StatusPill label="Approval required" tone="warn" />}
                      </div>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                      <small>{option.impact}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Approval Path</h3>
                <div className="settings-rule-list">
                  {selectedDecision.approvalPath.map(step => (
                    <div key={step}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedDecision.evidence.map(evidence => (
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
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedDecision)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canDecide || !recommendedOption} onClick={() => recordDecision(selectedDecision, 'Option Selected', recommendedOption, 'Recommended option recorded locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Recommended
                  </button>
                  <button className="ghost-action" disabled={!canDecide} onClick={() => recordDecision(selectedDecision, 'Follow-Up Needed', followUpOption(selectedDecision), 'Follow-up path required locally.')}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Need Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canDecide} onClick={() => recordDecision(selectedDecision, 'Escalated', escalationOption(selectedDecision), 'Decision escalated locally.')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Escalate
                  </button>
                  <button className="ghost-action" disabled={!canDecide} onClick={() => recordDecision(selectedDecision, 'Deferred', deferOption(selectedDecision), 'Decision deferred locally.')}>
                    <Clock3 size={15} strokeWidth={1.8} />
                    Defer
                  </button>
                  <button className="ghost-action" disabled={!canDecide} onClick={() => recordDecision(selectedDecision, 'Closed', selectedDecision.selectedOption ?? recommendedOption, 'Decision packet closed locally.')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Close
                  </button>
                  <button className="ghost-action" disabled={!canDecide} onClick={() => resetDecision(selectedDecision)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <>
                      <button className="ghost-action" onClick={() => onOpenTarget('owner-commitment-ledger')}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Commitments
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('executive-morning-review')}>
                        <ListChecks size={15} strokeWidth={1.8} />
                        Morning Review
                      </button>
                    </>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {selectedDecision.targetPermission}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedDecision.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No owner decision selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function statusFromOption(option: OwnerDecisionOption): OwnerDecisionStatus {
  if (option.kind === 'Follow-Up') return 'Follow-Up Needed'
  if (option.kind === 'Escalate') return 'Escalated'
  if (option.kind === 'Defer') return 'Deferred'
  return 'Option Selected'
}

function followUpOption(decision: OwnerDecisionRecord) {
  return decision.options.find(option => option.kind === 'Follow-Up')
}

function escalationOption(decision: OwnerDecisionRecord) {
  return decision.options.find(option => option.kind === 'Escalate')
}

function deferOption(decision: OwnerDecisionRecord) {
  return decision.options.find(option => option.kind === 'Defer')
}

function getFollowUpDueAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

function prioritySortValue(priority: OwnerDecisionRecord['priority']) {
  if (priority === 'Critical') return '0'
  if (priority === 'High') return '1'
  if (priority === 'Medium') return '2'
  return '3'
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const targetPageLabels: Record<OwnerDecisionTargetPage, string> = {
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
