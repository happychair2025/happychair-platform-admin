import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  GitBranch,
  ListChecks,
  Send,
  ServerCog,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import {
  queueAdminActionRequest,
  runAdminAction,
} from '../../lib/admin-actions/actionGateway'
import {
  actionRequestLaunchpadBoundaryRule,
  buildActionRequestLaunchpad,
  getLaunchpadActionTypeTone,
  getLaunchpadLaneTone,
  getLaunchpadPriorityTone,
  getLaunchpadRiskTone,
  summarizeActionRequestLaunchpad,
  type ActionRequestLaunchpadCandidate,
  type ActionRequestLaunchpadLane,
} from '../../lib/admin-actions/actionRequestLaunchpad'
import { buildActionRequestGovernance } from '../../lib/admin-actions/actionRequestGovernance'
import {
  updateAdminActionRequestStatus,
  useLocalAdminActionRequests,
  type AdminActionRequestStatus,
} from '../../lib/admin-actions/actionRequests'
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
  getOwnerCommitmentStatusTone,
  useLocalOwnerCommitmentStates,
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

type ActionRequestLaunchpadTargetPage = OwnerCommitmentTargetPage | 'action-request-launchpad'

interface ActionRequestLaunchpadPageProps {
  session: AdminSession
  onOpenTarget?: (page: ActionRequestLaunchpadTargetPage) => void
}

const laneFilters: Array<'All' | ActionRequestLaunchpadLane> = [
  'All',
  'Draft Needed',
  'Drafted',
  'Queued For Approval',
  'Approved',
  'Blocked',
  'Completed',
]

export default function ActionRequestLaunchpadPage({ session, onOpenTarget }: ActionRequestLaunchpadPageProps) {
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
  const [localCommitmentStates] = useLocalOwnerCommitmentStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | ActionRequestLaunchpadLane>('All')
  const [notice, setNotice] = useState('')
  const canManageLaunchpad = hasPermission(session.role, 'admin_actions.manage')

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
  const candidates = useMemo(() => buildActionRequestLaunchpad({
    commitments,
    requests: actionRequests,
    data,
  }), [actionRequests, commitments, data])
  const summary = useMemo(() => summarizeActionRequestLaunchpad(candidates), [candidates])
  const filteredCandidates = useMemo(() => laneFilter === 'All'
    ? candidates
    : candidates.filter(candidate => candidate.lane === laneFilter),
  [candidates, laneFilter])
  const selectedCandidate = filteredCandidates.find(candidate => candidate.id === selectedId)
    ?? candidates.find(candidate => candidate.id === selectedId)
    ?? filteredCandidates[0]
    ?? candidates[0]
  const canLaunchSelected = selectedCandidate
    ? canManageLaunchpad && hasPermission(session.role, selectedCandidate.permissionRequired)
    : false

  const createRequest = (candidate: ActionRequestLaunchpadCandidate, status: AdminActionRequestStatus) => {
    if (!canManageLaunchpad) {
      setNotice('Creating launchpad requests requires admin_actions.manage.')
      return
    }
    if (!hasPermission(session.role, candidate.permissionRequired)) {
      setNotice(`Creating this request requires ${candidate.permissionRequired}.`)
      return
    }
    if (candidate.existingRequest) {
      setNotice(`${candidate.commitmentTitle} already has action request ${candidate.existingRequest.id}.`)
      return
    }

    const result = queueAdminActionRequest(session, {
      actionType: candidate.actionType,
      title: candidate.requestTitle,
      permission: candidate.permissionRequired,
      scope: candidate.scope,
      reason: candidate.reason,
      rollbackNotes: candidate.rollbackNotes,
      status,
      severity: candidate.riskLevel === 'Critical' || candidate.riskLevel === 'High' ? 'warning' : 'notice',
      auditActionKey: `action_request_launchpad.${sanitizeActionKey(candidate.commitmentId)}.${status.toLowerCase()}.mock`,
      auditActionLabel: `${status === 'Draft' ? 'Drafted' : 'Queued'} action request from commitment: ${candidate.commitmentTitle}`,
      handlerKey: candidate.serverHandler.key,
      handlerLabel: candidate.serverHandler.label,
      handlerDescription: candidate.serverHandler.description,
      metadata: {
        source: 'owner_commitment_ledger',
        sourceCommitmentId: candidate.commitmentId,
        ownerCommitmentId: candidate.commitmentId,
        commitmentStatus: candidate.commitmentStatus,
        commitmentSource: candidate.commitmentSource,
        relatedTargetPage: candidate.targetPage,
        targetPermission: candidate.targetPermission,
        riskLevel: candidate.riskLevel,
        requiredApprovers: candidate.requiredApprovers,
        humanConfirmationRequired: candidate.humanConfirmationRequired,
        evidence: candidate.evidence.slice(0, 8),
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedId(candidate.id)
    setNotice(`${candidate.requestTitle} created as ${status.toLowerCase()} and recorded in Audit Logs.`)
  }

  const queueExistingDraft = (candidate: ActionRequestLaunchpadCandidate) => {
    if (!candidate.existingRequest) return
    if (candidate.existingRequest.status !== 'Draft') {
      setNotice('Only draft action requests can be moved to queued from the launchpad.')
      return
    }
    if (!canLaunchSelected) {
      setNotice(`Queueing this request requires admin_actions.manage and ${candidate.permissionRequired}.`)
      return
    }

    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: candidate.scope.label,
      actionKey: `action_request_launchpad.${sanitizeActionKey(candidate.commitmentId)}.queue_existing_draft.mock`,
      actionLabel: `Queued launchpad draft: ${candidate.requestTitle}`,
      severity: candidate.riskLevel === 'Critical' || candidate.riskLevel === 'High' ? 'warning' : 'notice',
      metadata: {
        actionRequestId: candidate.existingRequest.id,
        sourceCommitmentId: candidate.commitmentId,
        previousStatus: candidate.existingRequest.status,
        nextStatus: 'Queued',
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    updateAdminActionRequestStatus(candidate.existingRequest, 'Queued', {
      transitionAuditEventId: result.auditEvent.id,
      statusReason: 'launchpad_draft_queued_for_approval',
      metadata: {
        launchpadQueuedBy: session.email,
        sourceCommitmentId: candidate.commitmentId,
      },
    })
    setSelectedId(candidate.id)
    setNotice(`${candidate.requestTitle} moved from draft to queued for approval.`)
  }

  const openTarget = (candidate: ActionRequestLaunchpadCandidate, targetPage: ActionRequestLaunchpadTargetPage, permission: ActionRequestLaunchpadCandidate['targetPermission']) => {
    const result = runAdminAction(session, {
      permission,
      scope: candidate.scope.label,
      actionKey: `action_request_launchpad.${sanitizeActionKey(candidate.commitmentId)}.opened_target.mock`,
      actionLabel: `Opened launchpad target for ${candidate.commitmentTitle}`,
      severity: candidate.riskLevel === 'Critical' ? 'warning' : 'notice',
      metadata: {
        sourceCommitmentId: candidate.commitmentId,
        targetPage,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    onOpenTarget?.(targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Governed Actions"
        title="Action Request Launchpad"
        description="Convert owner commitments into governed Admin Action Request drafts with scope, permission, rollback, approval, and server-handler contracts already attached."
        action={<StatusPill label={canManageLaunchpad ? 'Launch controls enabled' : 'Review only'} tone={canManageLaunchpad ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Draft Needed" value={String(summary.draftNeeded)} delta={`${summary.total} commitment candidates`} tone={summary.draftNeeded ? 'warn' : 'ok'} icon={<Send size={16} />} />
        <MetricCard label="Drafted / Queued" value={`${summary.drafted}/${summary.queued}`} delta={`${sourceLabel} plus local queue`} tone={summary.queued ? 'warn' : summary.drafted ? 'neutral' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Human-Gated" value={String(summary.humanGated)} delta={`${summary.criticalOrHigh} critical or high risk`} tone={summary.criticalOrHigh ? 'danger' : summary.humanGated ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Approved / Blocked" value={`${summary.approved}/${summary.blocked}`} delta={`${summary.completed} completed`} tone={summary.blocked ? 'danger' : summary.approved ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel action-launchpad-boundary-panel">
        <div>
          <p className="eyebrow">Launch Boundary</p>
          <h2>Draft or queue requests here; execution remains server-governed</h2>
          <span>{actionRequestLaunchpadBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.existingRequests} linked requests`} tone={summary.blocked ? 'danger' : summary.draftNeeded ? 'warn' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Action request launchpad lane filters">
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
            <span>{lane === 'All' ? candidates.length : candidates.filter(candidate => candidate.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="action-launchpad-layout">
        <DataTable
          label="Launchpad Candidates"
          rows={filteredCandidates}
          pageSize={10}
          emptyTitle="No launchpad candidates match this lane."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getLaunchpadPriorityTone(row.priority)} />,
            },
            {
              key: 'request',
              header: 'Request Draft',
              sortable: true,
              searchValue: row => `${row.requestTitle} ${row.commitmentTitle} ${row.reason}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.requestTitle}</button>,
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.actionTypeLabel,
              render: row => <StatusPill label={row.actionTypeLabel} tone={getLaunchpadActionTypeTone(row.actionType)} />,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => laneSortValue(row.lane),
              render: row => <StatusPill label={row.lane} tone={getLaunchpadLaneTone(row.lane)} />,
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => riskSortValue(row.riskLevel),
              render: row => <StatusPill label={row.riskLevel} tone={getLaunchpadRiskTone(row.riskLevel)} />,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.scope.label,
              render: row => row.scope.label,
            },
          ]}
        />

        <aside className="detail-panel action-launchpad-detail-panel">
          {selectedCandidate ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Launch Candidate</p>
                  <h2>{selectedCandidate.requestTitle}</h2>
                </div>
                <StatusPill label={selectedCandidate.lane} tone={getLaunchpadLaneTone(selectedCandidate.lane)} />
              </div>

              <div className="request-scope-list">
                <div><span>Action Type</span><strong>{selectedCandidate.actionTypeLabel}</strong></div>
                <div><span>Permission</span><strong>{selectedCandidate.permissionRequired}</strong></div>
                <div><span>Risk</span><strong>{selectedCandidate.riskLevel}</strong></div>
                <div><span>Scope</span><strong>{selectedCandidate.scope.label}</strong></div>
                <div><span>Commitment Status</span><strong>{selectedCandidate.commitmentStatus}</strong></div>
                <div><span>Due</span><strong>{formatCommitmentDue(commitments.find(item => item.id === selectedCandidate.commitmentId)?.dueAt ?? new Date().toISOString())}</strong></div>
              </div>

              <section className={`panel action-launchpad-status-panel tone-${getLaunchpadLaneTone(selectedCandidate.lane)}`}>
                <div>
                  <p className="eyebrow">Request Package</p>
                  <h2>{selectedCandidate.requestDescription}</h2>
                  <span>{selectedCandidate.reason}</span>
                </div>
                <div className="action-launchpad-status-meta">
                  <StatusPill label={selectedCandidate.actionTypeLabel} tone={getLaunchpadActionTypeTone(selectedCandidate.actionType)} />
                  <strong>{selectedCandidate.existingRequest?.status ?? 'No request yet'}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Policy Gate</h3>
                <div className="action-launchpad-policy-grid">
                  <div>
                    <ShieldCheck size={16} strokeWidth={1.8} />
                    <span>Approvers</span>
                    <strong>{selectedCandidate.requiredApprovers.join(', ')}</strong>
                  </div>
                  <div>
                    <AlertTriangle size={16} strokeWidth={1.8} />
                    <span>Human Confirmation</span>
                    <strong>{selectedCandidate.humanConfirmationRequired ? 'Required' : 'Not required'}</strong>
                  </div>
                  <div>
                    <ServerCog size={16} strokeWidth={1.8} />
                    <span>Server Handler</span>
                    <strong>{selectedCandidate.serverHandler.key}</strong>
                  </div>
                  <div>
                    <FileCheck2 size={16} strokeWidth={1.8} />
                    <span>Existing Request</span>
                    <strong>{selectedCandidate.existingRequest?.id ?? 'Not created'}</strong>
                  </div>
                </div>
                <p className="muted-copy">{selectedCandidate.governancePolicy.policyReason}</p>
              </div>

              <div className="detail-section">
                <h3>Commitment Source</h3>
                <section className="panel action-launchpad-commitment-panel">
                  <div>
                    <p className="eyebrow">{selectedCandidate.commitmentSource}</p>
                    <h2>{selectedCandidate.commitmentTitle}</h2>
                    <span>Target: {targetPageLabels[selectedCandidate.targetPage]}</span>
                  </div>
                  <StatusPill label={selectedCandidate.commitmentStatus} tone={getOwnerCommitmentStatusTone(selectedCandidate.commitmentStatus)} />
                </section>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedCandidate.evidence.map(evidence => (
                    <div key={evidence}>
                      <Eye size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedCandidate.rollbackNotes}</p>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canLaunchSelected || Boolean(selectedCandidate.existingRequest)}
                    onClick={() => createRequest(selectedCandidate, 'Draft')}
                  >
                    <FileCheck2 size={15} strokeWidth={1.8} />
                    Create Draft
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canLaunchSelected || Boolean(selectedCandidate.existingRequest)}
                    onClick={() => createRequest(selectedCandidate, 'Queued')}
                  >
                    <Send size={15} strokeWidth={1.8} />
                    Queue For Approval
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canLaunchSelected || selectedCandidate.existingRequest?.status !== 'Draft'}
                    onClick={() => queueExistingDraft(selectedCandidate)}
                  >
                    <Clock3 size={15} strokeWidth={1.8} />
                    Queue Draft
                  </button>
                  {onOpenTarget && (
                    <>
                      <button className="ghost-action" onClick={() => onOpenTarget('action-requests')}>
                        <ListChecks size={15} strokeWidth={1.8} />
                        Action Requests
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('approval-center')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Approval Center
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('owner-commitment-ledger')}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Commitments
                      </button>
                    </>
                  )}
                  <button
                    className="ghost-action"
                    disabled={!hasPermission(session.role, selectedCandidate.targetPermission)}
                    onClick={() => openTarget(selectedCandidate, selectedCandidate.targetPage, selectedCandidate.targetPermission)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                </div>
                {!canLaunchSelected && <p className="warning-copy">Creating or queueing this request requires admin_actions.manage and {selectedCandidate.permissionRequired}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launchpad candidate selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function prioritySortValue(priority: ActionRequestLaunchpadCandidate['priority']) {
  if (priority === 'Critical') return '0'
  if (priority === 'High') return '1'
  if (priority === 'Medium') return '2'
  return '3'
}

function laneSortValue(lane: ActionRequestLaunchpadLane) {
  if (lane === 'Draft Needed') return '0'
  if (lane === 'Blocked') return '1'
  if (lane === 'Queued For Approval') return '2'
  if (lane === 'Drafted') return '3'
  if (lane === 'Approved') return '4'
  return '5'
}

function riskSortValue(riskLevel: ActionRequestLaunchpadCandidate['riskLevel']) {
  if (riskLevel === 'Critical') return '0'
  if (riskLevel === 'High') return '1'
  if (riskLevel === 'Medium') return '2'
  return '3'
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const targetPageLabels: Record<ActionRequestLaunchpadTargetPage, string> = {
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
