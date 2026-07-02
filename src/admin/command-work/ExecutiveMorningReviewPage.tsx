import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Eye,
  FileCheck2,
  Newspaper,
  RotateCcw,
  Send,
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
  executiveMorningReviewBoundaryRule,
  getExecutiveMorningReviewLaneTone,
  getExecutiveMorningReviewPostureTone,
  getExecutiveMorningReviewPriorityTone,
  getExecutiveMorningReviewStatusTone,
  summarizeExecutiveMorningReview,
  useLocalExecutiveMorningReviewStates,
  type ExecutiveMorningReviewItem,
  type ExecutiveMorningReviewLane,
  type ExecutiveMorningReviewStatus,
  type ExecutiveMorningReviewTargetPage,
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

interface ExecutiveMorningReviewPageProps {
  session: AdminSession
  onOpenTarget?: (page: ExecutiveMorningReviewTargetPage) => void
}

const laneFilters: Array<'All' | ExecutiveMorningReviewLane> = ['All', 'Decisions', 'Exceptions', 'SLA', 'Handoffs', 'Revenue', 'Support', 'Growth']

export default function ExecutiveMorningReviewPage({ session, onOpenTarget }: ExecutiveMorningReviewPageProps) {
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
  const [localMorningStates, setLocalMorningStates] = useLocalExecutiveMorningReviewStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | ExecutiveMorningReviewLane>('All')
  const [notice, setNotice] = useState('')
  const canReview = hasPermission(session.role, 'dashboard.view')

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
  const summary = useMemo(() => summarizeExecutiveMorningReview(morningReview), [morningReview])
  const filteredItems = useMemo(() => laneFilter === 'All'
    ? morningReview.reviewItems
    : morningReview.reviewItems.filter(item => item.lane === laneFilter),
  [laneFilter, morningReview.reviewItems])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? morningReview.reviewItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? morningReview.reviewItems[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, selectedItem.targetPermission) : false

  const recordReviewState = (status: ExecutiveMorningReviewStatus, note: string) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: morningReview.title,
      actionKey: `executive_morning_review.${sanitizeActionKey(morningReview.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} executive morning review`,
      severity: status === 'Shared' || morningReview.posture === 'Critical' ? 'warning' : 'notice',
      metadata: {
        reviewId: morningReview.id,
        posture: morningReview.posture,
        status,
        totalItems: morningReview.reviewItems.length,
        criticalItems: summary.critical,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalMorningStates(current => [
      {
        reviewId: morningReview.id,
        status,
        note,
        reviewedAt: status === 'Reviewed' || status === 'Shared' ? updatedAt : morningReview.localState?.reviewedAt,
        sharedAt: status === 'Shared' ? updatedAt : morningReview.localState?.sharedAt,
        updatedAt,
      },
      ...current.filter(state => state.reviewId !== morningReview.id),
    ])
    setNotice(`${morningReview.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetReviewState = () => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: morningReview.title,
      actionKey: `executive_morning_review.${sanitizeActionKey(morningReview.id)}.reset_local.mock`,
      actionLabel: 'Reset local executive morning review state',
      severity: 'notice',
      metadata: {
        reviewId: morningReview.id,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalMorningStates(current => current.filter(state => state.reviewId !== morningReview.id))
    setNotice(`${morningReview.title} restored to draft review state and recorded in Audit Logs.`)
  }

  const openTarget = (item: ExecutiveMorningReviewItem) => {
    const result = runAdminAction(session, {
      permission: item.targetPermission,
      scope: item.scope,
      actionKey: `executive_morning_review.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened morning review target: ${item.title}`,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: {
        reviewId: morningReview.id,
        reviewItemId: item.id,
        lane: item.lane,
        targetPage: item.targetPage,
        relatedRecordId: item.relatedRecordId,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} opened in ${targetPageLabels[item.targetPage]}.`)
    onOpenTarget?.(item.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Command"
        title="Executive Morning Review"
        description="A single owner-facing command review for today's decisions, exception pressure, SLA breaches, handoff blockers, and market-facing risks."
        action={<StatusPill label={morningReview.status} tone={getExecutiveMorningReviewStatusTone(morningReview.status)} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        {morningReview.metrics.map(metric => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            delta={metric.detail}
            tone={metric.tone}
            icon={metricIcon(metric.label)}
          />
        ))}
      </div>

      <section className={`panel executive-morning-brief-panel tone-${getExecutiveMorningReviewPostureTone(morningReview.posture)}`}>
        <div>
          <p className="eyebrow">Morning Posture</p>
          <h2>{morningReview.posture}</h2>
          <span>{morningReview.summary}</span>
        </div>
        <div className="executive-morning-brief-meta">
          <StatusPill label={`${summary.totalItems} review items`} tone={summary.totalItems ? 'warn' : 'ok'} />
          <strong>{sourceLabel} plus local command state</strong>
        </div>
      </section>

      <section className="panel executive-morning-boundary-panel">
        <div>
          <p className="eyebrow">Review Boundary</p>
          <h2>Review and share operating posture; production actions stay governed</h2>
          <span>{executiveMorningReviewBoundaryRule}</span>
        </div>
        <StatusPill label={canReview ? 'Local review controls enabled' : 'Read only'} tone={canReview ? 'ok' : 'warn'} />
      </section>

      <div className="executive-morning-section-grid">
        <MorningSection title="Top Decisions" count={morningReview.topDecisions.length} items={morningReview.topDecisions} onSelect={setSelectedId} />
        <MorningSection title="Exceptions" count={morningReview.exceptionWatch.length} items={morningReview.exceptionWatch} onSelect={setSelectedId} />
        <MorningSection title="SLA Watch" count={morningReview.slaWatch.length} items={morningReview.slaWatch} onSelect={setSelectedId} />
        <MorningSection title="Market Watch" count={morningReview.marketWatch.length} items={morningReview.marketWatch} onSelect={setSelectedId} />
      </div>

      <div className="timeline-filter-bar" aria-label="Morning review lane filters">
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
            <span>{lane === 'All' ? morningReview.reviewItems.length : morningReview.reviewItems.filter(item => item.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="executive-morning-layout">
        <DataTable
          label="Morning Decision Stack"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No morning review items match this lane."
          columns={[
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getExecutiveMorningReviewPriorityTone(row.priority)} />,
            },
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.detail} ${row.scope} ${row.owner}`,
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
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.statusLabel,
              render: row => row.statusLabel,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.sourceLabel} ${row.targetPage}`,
              render: row => <div><strong>{row.sourceLabel}</strong><span className="cell-subtext">{targetPageLabels[row.targetPage]}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel executive-morning-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Review Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.priority} tone={getExecutiveMorningReviewPriorityTone(selectedItem.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Status</span><strong>{selectedItem.statusLabel}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Source</span><strong>{selectedItem.sourceLabel}</strong></div>
                <div><span>Target</span><strong>{targetPageLabels[selectedItem.targetPage]}</strong></div>
              </div>

              <section className={`panel executive-morning-status-panel tone-${getExecutiveMorningReviewPriorityTone(selectedItem.priority)}`}>
                <div>
                  <p className="eyebrow">Recommended Decision</p>
                  <h2>{selectedItem.recommendedAction}</h2>
                  <span>{selectedItem.detail}</span>
                </div>
                <div className="executive-morning-status-meta">
                  <StatusPill label={selectedItem.lane} tone={getExecutiveMorningReviewLaneTone(selectedItem.lane)} />
                  <strong>{selectedItem.targetPermission}</strong>
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
                <h3>Review Actions</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canReview} onClick={() => recordReviewState('Reviewed', 'Executive morning review marked reviewed locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Reviewed
                  </button>
                  <button className="ghost-action" disabled={!canReview} onClick={() => recordReviewState('Shared', 'Executive morning review marked shared locally.')}>
                    <Send size={15} strokeWidth={1.8} />
                    Share Summary
                  </button>
                  <button className="ghost-action" disabled={!canReview} onClick={resetReviewState}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('owner-decision-room')}>
                      <FileCheck2 size={15} strokeWidth={1.8} />
                      Decision Room
                    </button>
                  )}
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('operator-daily-brief')}>
                      <Newspaper size={15} strokeWidth={1.8} />
                      Daily Brief
                    </button>
                  )}
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('operating-exceptions')}>
                      <AlertTriangle size={15} strokeWidth={1.8} />
                      Exceptions
                    </button>
                  )}
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('exception-sla-policies')}>
                      <TimerReset size={15} strokeWidth={1.8} />
                      SLA Policies
                    </button>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening this target requires {selectedItem.targetPermission}.</p>}
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedItem.rollbackNotes}</p>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No morning review item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function MorningSection({
  title,
  count,
  items,
  onSelect,
}: {
  title: string
  count: number
  items: ExecutiveMorningReviewItem[]
  onSelect: (itemId: string) => void
}) {
  return (
    <section className="executive-morning-mini-card">
      <div className="executive-morning-mini-header">
        <span>{title}</span>
        <StatusPill label={String(count)} tone={count ? 'warn' : 'ok'} />
      </div>
      <div className="executive-morning-mini-list">
        {items.slice(0, 4).map(item => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <strong>{item.title}</strong>
            <small>{item.owner} / {item.statusLabel}</small>
          </button>
        ))}
        {!items.length && <p className="muted-copy">No items in this lane.</p>}
      </div>
    </section>
  )
}

function metricIcon(label: string) {
  if (label === 'Decision Stack') return <FileCheck2 size={16} />
  if (label === 'Exceptions') return <AlertTriangle size={16} />
  if (label === 'SLA Breaches') return <TimerReset size={16} />
  return <BellRing size={16} />
}

function prioritySortValue(priority: ExecutiveMorningReviewItem['priority']) {
  if (priority === 'Critical') return '0'
  if (priority === 'High') return '1'
  if (priority === 'Medium') return '2'
  return '3'
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const targetPageLabels: Record<ExecutiveMorningReviewTargetPage, string> = {
  'executive-morning-review': 'Morning Review',
  'owner-decision-room': 'Owner Decision Room',
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
