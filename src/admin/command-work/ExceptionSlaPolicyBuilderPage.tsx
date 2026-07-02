import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  GitBranch,
  ListChecks,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  Zap,
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
  exceptionSlaPolicyBoundaryRule,
  formatExceptionSlaMinutes,
  getExceptionSlaPolicyHealthTone,
  getExceptionSlaPolicyStatusTone,
  summarizeExceptionSlaPolicies,
  useLocalExceptionSlaPolicyStates,
  type ExceptionSlaPolicyItem,
  type ExceptionSlaPolicyLocalState,
  type ExceptionSlaPolicyStatus,
  type ExceptionSlaPolicyTargetPage,
} from '../../lib/command-work/exceptionSlaPolicies'
import {
  buildOperatingExceptions,
  getOperatingExceptionSeverityTone,
  getOperatingExceptionTypeTone,
  useLocalOperatingExceptionStates,
  type OperatingExceptionItem,
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

interface ExceptionSlaPolicyBuilderPageProps {
  session: AdminSession
  onOpenTarget?: (page: ExceptionSlaPolicyTargetPage) => void
}

const typeFilters: Array<'All' | OperatingExceptionType> = [
  'All',
  'Critical Command',
  'Blocked Handoff',
  'Overdue Owner Action',
  'Approval Gap',
  'Audit Gap',
  'Governance Blocker',
]
const statusFilters: Array<'All' | ExceptionSlaPolicyStatus> = ['All', 'Active', 'Needs Review', 'Draft', 'Paused']

export default function ExceptionSlaPolicyBuilderPage({ session, onOpenTarget }: ExceptionSlaPolicyBuilderPageProps) {
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
  const [localPolicyStates, setLocalPolicyStates] = useLocalExceptionSlaPolicyStates()
  const [selectedId, setSelectedId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | OperatingExceptionType>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | ExceptionSlaPolicyStatus>('All')
  const [notice, setNotice] = useState('')
  const canManagePolicies = hasPermission(session.role, 'notifications.manage')

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
  const policies = useMemo(() => buildExceptionSlaPolicies({
    exceptions,
    localStates: localPolicyStates,
  }), [exceptions, localPolicyStates])
  const summary = useMemo(() => summarizeExceptionSlaPolicies(policies), [policies])
  const filteredPolicies = useMemo(() => policies.filter(policy => {
    if (typeFilter !== 'All' && policy.exceptionType !== typeFilter) return false
    if (statusFilter !== 'All' && policy.status !== statusFilter) return false
    return true
  }), [policies, statusFilter, typeFilter])
  const selectedPolicy = filteredPolicies.find(policy => policy.id === selectedId)
    ?? policies.find(policy => policy.id === selectedId)
    ?? filteredPolicies[0]
    ?? policies[0]
  const canOpenSelected = selectedPolicy ? hasPermission(session.role, selectedPolicy.targetPermission) : false

  const updatePolicy = (
    policy: ExceptionSlaPolicyItem,
    patch: Partial<Omit<ExceptionSlaPolicyLocalState, 'policyId' | 'updatedAt'>>,
    label: string,
    noticeVerb: string,
  ) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: `Exception SLA / ${policy.name}`,
      actionKey: `exception_sla_policy.${sanitizeActionKey(policy.id)}.${sanitizeActionKey(label)}.mock`,
      actionLabel: `${label} exception SLA policy: ${policy.name}`,
      severity: patch.status === 'Paused' || policy.health === 'Breached' ? 'warning' : 'notice',
      metadata: buildPolicyMetadata(policy, {
        patch,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    const nextState: ExceptionSlaPolicyLocalState = {
      policyId: policy.id,
      status: patch.status ?? policy.status,
      ownerRole: patch.ownerRole ?? policy.ownerRole,
      escalationRole: patch.escalationRole ?? policy.escalationRole,
      responseMinutes: patch.responseMinutes ?? policy.responseMinutes,
      resolutionMinutes: patch.resolutionMinutes ?? policy.resolutionMinutes,
      reviewCadence: patch.reviewCadence ?? policy.reviewCadence,
      enforcementMode: patch.enforcementMode ?? policy.enforcementMode,
      humanConfirmationRequired: patch.humanConfirmationRequired ?? policy.humanConfirmationRequired,
      auditRequired: patch.auditRequired ?? policy.auditRequired,
      note: patch.note ?? `${label} recorded locally.`,
      updatedAt,
    }

    setLocalPolicyStates(current => [
      nextState,
      ...current.filter(state => state.policyId !== policy.id),
    ])
    setSelectedId(policy.id)
    setNotice(`${policy.name} ${noticeVerb} locally and recorded in Audit Logs.`)
  }

  const resetPolicy = (policy: ExceptionSlaPolicyItem) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: `Exception SLA / ${policy.name}`,
      actionKey: `exception_sla_policy.${sanitizeActionKey(policy.id)}.reset_local.mock`,
      actionLabel: `Reset local exception SLA policy: ${policy.name}`,
      severity: 'notice',
      metadata: buildPolicyMetadata(policy, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalPolicyStates(current => current.filter(state => state.policyId !== policy.id))
    setSelectedId(policy.id)
    setNotice(`${policy.name} restored to system policy and recorded in Audit Logs.`)
  }

  const openTarget = (policy: ExceptionSlaPolicyItem) => {
    const result = runAdminAction(session, {
      permission: policy.targetPermission,
      scope: `Exception SLA / ${policy.name}`,
      actionKey: `exception_sla_policy.${sanitizeActionKey(policy.id)}.opened_target.mock`,
      actionLabel: `Opened exception SLA target: ${policy.name}`,
      severity: policy.health === 'Breached' ? 'warning' : 'notice',
      metadata: buildPolicyMetadata(policy, {
        targetPage: policy.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${policy.name} target opened in ${targetPageLabels[policy.targetPage]}.`)
    onOpenTarget?.(policy.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Exception Governance"
        title="Exception SLA Policy Builder"
        description="Local-first policy workbench for response windows, owners, escalation paths, review cadence, and human-confirmed exception handling."
        action={<StatusPill label={canManagePolicies ? 'Local policy controls enabled' : 'Read only'} tone={canManagePolicies ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Policies" value={String(summary.total)} delta={`${summary.active} active / ${summary.needsReview} review`} tone="neutral" icon={<SlidersHorizontal size={16} />} />
        <MetricCard label="Covered Exceptions" value={String(summary.coveredExceptions)} delta={`${sourceLabel} plus local exception state`} tone={summary.coveredExceptions ? 'warn' : 'ok'} icon={<BellRing size={16} />} />
        <MetricCard label="Breached / At Risk" value={`${summary.breachedPolicies}/${summary.atRiskPolicies}`} delta={`${summary.breachedExceptions} exception breaches`} tone={summary.breachedPolicies ? 'danger' : summary.atRiskPolicies ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Avg Response SLA" value={formatExceptionSlaMinutes(summary.averageResponseMinutes)} delta={`${summary.localOverrides} local overrides`} tone={summary.localOverrides ? 'warn' : 'neutral'} icon={<Clock3 size={16} />} />
      </div>

      <section className="panel exception-sla-boundary-panel">
        <div>
          <p className="eyebrow">Policy Boundary</p>
          <h2>Preview exception policy here; production escalation stays server-side</h2>
          <span>{exceptionSlaPolicyBoundaryRule}</span>
        </div>
        <StatusPill label="Server policy pending" tone="warn" />
      </section>

      <div className="timeline-filter-bar" aria-label="Exception SLA type filters">
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
            <span>{type === 'All' ? policies.length : policies.filter(policy => policy.exceptionType === type).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Exception SLA status filters">
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
            <span>{status === 'All' ? policies.length : policies.filter(policy => policy.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="exception-sla-layout">
        <DataTable
          label="Exception SLA Policies"
          rows={filteredPolicies}
          pageSize={8}
          emptyTitle="No exception SLA policies match these filters."
          columns={[
            {
              key: 'policy',
              header: 'Policy',
              sortable: true,
              searchValue: row => `${row.name} ${row.description} ${row.exceptionType}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.name}</button>,
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.exceptionType,
              render: row => <StatusPill label={row.exceptionType} tone={getOperatingExceptionTypeTone(row.exceptionType)} />,
            },
            {
              key: 'health',
              header: 'Health',
              sortable: true,
              searchValue: row => `${healthSortValue(row.health)} ${row.health}`,
              render: row => <StatusPill label={row.health} tone={getExceptionSlaPolicyHealthTone(row.health)} />,
            },
            {
              key: 'response',
              header: 'Response',
              sortable: true,
              searchValue: row => String(row.responseMinutes).padStart(5, '0'),
              render: row => formatExceptionSlaMinutes(row.responseMinutes),
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => `${row.ownerRole} ${row.escalationRole}`,
              render: row => <div><strong>{row.ownerRole}</strong><span className="cell-subtext">Escalates to {row.escalationRole}</span></div>,
            },
            {
              key: 'load',
              header: 'Load',
              sortable: true,
              searchValue: row => String(row.activeExceptions).padStart(5, '0'),
              render: row => `${row.activeExceptions} active / ${row.breachedExceptions} breached`,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getExceptionSlaPolicyStatusTone(row.status)} />,
            },
          ]}
        />

        <aside className="detail-panel exception-sla-detail-panel">
          {selectedPolicy ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Policy Detail</p>
                  <h2>{selectedPolicy.name}</h2>
                </div>
                <StatusPill label={selectedPolicy.health} tone={getExceptionSlaPolicyHealthTone(selectedPolicy.health)} />
              </div>

              <div className="request-scope-list">
                <div><span>Type</span><strong>{selectedPolicy.exceptionType}</strong></div>
                <div><span>Minimum Severity</span><strong>{selectedPolicy.minimumSeverity}</strong></div>
                <div><span>Owner</span><strong>{selectedPolicy.ownerRole}</strong></div>
                <div><span>Escalates To</span><strong>{selectedPolicy.escalationRole}</strong></div>
                <div><span>Response SLA</span><strong>{formatExceptionSlaMinutes(selectedPolicy.responseMinutes)}</strong></div>
                <div><span>Resolution SLA</span><strong>{formatExceptionSlaMinutes(selectedPolicy.resolutionMinutes)}</strong></div>
                <div><span>Review</span><strong>{selectedPolicy.reviewCadence}</strong></div>
                <div><span>Mode</span><strong>{selectedPolicy.enforcementMode}</strong></div>
              </div>

              <section className={`panel exception-sla-status-panel tone-${getExceptionSlaPolicyHealthTone(selectedPolicy.health)}`}>
                <div>
                  <p className="eyebrow">Current Coverage</p>
                  <h2>{selectedPolicy.activeExceptions} active exceptions under this policy</h2>
                  <span>{selectedPolicy.description}</span>
                </div>
                <div className="exception-sla-status-meta">
                  <StatusPill label={selectedPolicy.source} tone={selectedPolicy.source === 'Local Override' ? 'warn' : 'neutral'} />
                  <strong>{selectedPolicy.breachedExceptions} breached / {selectedPolicy.dueSoonExceptions} at risk</strong>
                </div>
              </section>

              <div className="exception-sla-policy-grid">
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <span>Human Confirmation</span>
                  <strong>{selectedPolicy.humanConfirmationRequired ? 'Required' : 'Not required'}</strong>
                </div>
                <div>
                  <GitBranch size={16} strokeWidth={1.8} />
                  <span>Audit Evidence</span>
                  <strong>{selectedPolicy.auditRequired ? 'Required' : 'Optional'}</strong>
                </div>
                <div>
                  <TimerReset size={16} strokeWidth={1.8} />
                  <span>Oldest Open</span>
                  <strong>{formatAge(selectedPolicy.oldestOpenMinutes)}</strong>
                </div>
                <div>
                  <Zap size={16} strokeWidth={1.8} />
                  <span>Handler</span>
                  <strong>{selectedPolicy.serverHandler}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Local Policy Controls</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedPolicy)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, { status: 'Active', note: 'Policy activated locally.' }, 'Activate', 'activated')}
                  >
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Activate
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, { status: 'Paused', note: 'Policy paused locally.' }, 'Pause', 'paused')}
                  >
                    <PauseCircle size={15} strokeWidth={1.8} />
                    Pause
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, tightenedPolicyPatch(selectedPolicy), 'Tighten', 'tightened')}
                  >
                    <TimerReset size={15} strokeWidth={1.8} />
                    Tighten SLA
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, relaxedPolicyPatch(selectedPolicy), 'Relax', 'relaxed')}
                  >
                    <Clock3 size={15} strokeWidth={1.8} />
                    Relax SLA
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, {
                      status: 'Needs Review',
                      enforcementMode: 'Manual Escalation',
                      humanConfirmationRequired: true,
                      auditRequired: true,
                      note: 'Policy marked for human review locally.',
                    }, 'Require Review', 'marked for review')}
                  >
                    <ListChecks size={15} strokeWidth={1.8} />
                    Require Review
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePolicies}
                    onClick={() => updatePolicy(selectedPolicy, {
                      enforcementMode: 'Auto Escalation Candidate',
                      humanConfirmationRequired: true,
                      auditRequired: true,
                      note: 'Policy staged as an auto-escalation candidate locally.',
                    }, 'Stage Auto Candidate', 'staged as an auto-escalation candidate')}
                  >
                    <BellRing size={15} strokeWidth={1.8} />
                    Stage Auto Candidate
                  </button>
                  <button className="ghost-action" disabled={!canManagePolicies} onClick={() => resetPolicy(selectedPolicy)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('operating-exceptions')}>
                      <AlertTriangle size={15} strokeWidth={1.8} />
                      Exceptions Inbox
                    </button>
                  )}
                </div>
                {!canManagePolicies && <p className="warning-copy">Policy edits require notifications.manage.</p>}
              </div>

              <div className="detail-section">
                <h3>Escalation Ladder</h3>
                <div className="exception-sla-ladder">
                  {selectedPolicy.escalationSteps.map(step => (
                    <div key={step}>
                      <Clock3 size={16} strokeWidth={1.8} />
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence Required</h3>
                <div className="settings-rule-list">
                  {selectedPolicy.evidenceFields.map(field => (
                    <div key={field}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{field}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Current Exception Load</h3>
                {selectedPolicy.matchingExceptions.length ? (
                  <div className="exception-sla-load-list">
                    {selectedPolicy.matchingExceptions.slice(0, 5).map(exception => (
                      <button key={exception.id} onClick={() => onOpenTarget?.('operating-exceptions')}>
                        <div>
                          <strong>{exception.title}</strong>
                          <span>{exception.scope}</span>
                        </div>
                        <div>
                          <StatusPill label={exception.severity} tone={getOperatingExceptionSeverityTone(exception.severity)} />
                          <small>{formatExceptionAge(exception)}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact">No current exceptions match this policy.</div>
                )}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedPolicy.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No exception SLA policy selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function tightenedPolicyPatch(policy: ExceptionSlaPolicyItem): Partial<Omit<ExceptionSlaPolicyLocalState, 'policyId' | 'updatedAt'>> {
  return {
    status: policy.status === 'Paused' ? 'Needs Review' : policy.status,
    responseMinutes: Math.max(15, Math.round(policy.responseMinutes * 0.75)),
    resolutionMinutes: Math.max(60, Math.round(policy.resolutionMinutes * 0.8)),
    humanConfirmationRequired: true,
    auditRequired: true,
    note: 'SLA timing tightened locally.',
  }
}

function relaxedPolicyPatch(policy: ExceptionSlaPolicyItem): Partial<Omit<ExceptionSlaPolicyLocalState, 'policyId' | 'updatedAt'>> {
  return {
    responseMinutes: Math.round(policy.responseMinutes * 1.25),
    resolutionMinutes: Math.round(policy.resolutionMinutes * 1.25),
    note: 'SLA timing relaxed locally.',
  }
}

function buildPolicyMetadata(policy: ExceptionSlaPolicyItem, extra: Record<string, unknown>) {
  return {
    exceptionSlaPolicyId: policy.id,
    exceptionType: policy.exceptionType,
    minimumSeverity: policy.minimumSeverity,
    ownerRole: policy.ownerRole,
    escalationRole: policy.escalationRole,
    responseMinutes: policy.responseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
    enforcementMode: policy.enforcementMode,
    humanConfirmationRequired: policy.humanConfirmationRequired,
    auditRequired: policy.auditRequired,
    targetPage: policy.targetPage,
    activeExceptions: policy.activeExceptions,
    breachedExceptions: policy.breachedExceptions,
    serverHandler: policy.serverHandler,
    ...extra,
  }
}

function healthSortValue(health: ExceptionSlaPolicyItem['health']) {
  if (health === 'Breached') return '0'
  if (health === 'At Risk') return '1'
  if (health === 'Covered') return '2'
  if (health === 'Quiet') return '3'
  return '4'
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function formatAge(minutes: number) {
  if (!minutes) return 'No active age'
  return formatExceptionSlaMinutes(minutes)
}

function formatExceptionAge(exception: OperatingExceptionItem) {
  const detectedAt = new Date(exception.detectedAt)
  if (Number.isNaN(detectedAt.getTime())) return 'Age unavailable'
  const minutes = Math.max(0, Math.round((Date.now() - detectedAt.getTime()) / 60000))
  return `${formatExceptionSlaMinutes(minutes)} old`
}

const targetPageLabels: Record<ExceptionSlaPolicyTargetPage, string> = {
  'operating-exceptions': 'Operating Exceptions',
  'command-handoff-timeline': 'Handoff Timeline',
  'owner-action-calendar': 'Owner Calendar',
  'approval-center': 'Approval Center',
  'action-requests': 'Action Requests',
  audit: 'Audit Logs',
}
