import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileCheck2,
  GitBranch,
  ListChecks,
  Newspaper,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
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
  getOperatorDailyPostureTone,
  getOperatorDailyStatusTone,
  operatorDailyBriefBoundaryRule,
  summarizeOperatorDailyBrief,
  useLocalOperatorDailyBriefStates,
  type OperatorDailyBriefFocusItem,
  type OperatorDailyBriefRecord,
  type OperatorDailyBriefStatus,
  type OperatorDailyFocusLane,
  type OperatorDailyTargetPage,
} from '../../lib/command-work/operatorDailyBrief'
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

interface OperatorDailyBriefPageProps {
  session: AdminSession
  onOpenTarget?: (page: OperatorDailyTargetPage) => void
}

const laneFilters: Array<'All' | OperatorDailyFocusLane> = [
  'All',
  'Do First',
  'Approve',
  'Cover',
  'Support',
  'Revenue',
  'Growth',
  'Watch',
]

export default function OperatorDailyBriefPage({ session, onOpenTarget }: OperatorDailyBriefPageProps) {
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
  const [localDailyBriefStates, setLocalDailyBriefStates] = useLocalOperatorDailyBriefStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | OperatorDailyFocusLane>('All')
  const [notice, setNotice] = useState('')
  const canManageBrief = hasPermission(session.role, 'dashboard.view')

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
  const summary = useMemo(() => summarizeOperatorDailyBrief(brief), [brief])
  const filteredItems = useMemo(() => brief.focusItems.filter(item => laneFilter === 'All' || item.lane === laneFilter), [brief.focusItems, laneFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? brief.focusItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? brief.focusItems[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, getTargetPermission(selectedItem.targetPage)) : false
  const canQueueSelected = selectedItem ? hasPermission(session.role, selectedItem.followUpPermission) : false

  const recordBriefState = (
    nextBrief: OperatorDailyBriefRecord,
    status: OperatorDailyBriefStatus,
    note: string,
    followUpRequestId?: string,
  ) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: nextBrief.title,
      actionKey: `operator_daily_brief.${sanitizeActionKey(nextBrief.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} operator daily brief: ${nextBrief.businessDate}`,
      severity: nextBrief.posture === 'Critical' || nextBrief.posture === 'At Risk' ? 'warning' : 'notice',
      metadata: buildDailyBriefMetadata(nextBrief, {
        localStatus: status,
        localOnly: true,
        mutationApplied: false,
        followUpRequestId,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalDailyBriefStates(current => [
      {
        briefId: nextBrief.id,
        status,
        note,
        reviewedAt: status === 'Reviewed' ? updatedAt : nextBrief.localState?.reviewedAt,
        sharedAt: status === 'Shared' ? updatedAt : nextBrief.localState?.sharedAt,
        followUpRequestId: followUpRequestId ?? nextBrief.localState?.followUpRequestId,
        updatedAt,
      },
      ...current.filter(state => state.briefId !== nextBrief.id),
    ])
    setNotice(`Operator Daily Brief marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetBriefState = (nextBrief: OperatorDailyBriefRecord) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: nextBrief.title,
      actionKey: `operator_daily_brief.${sanitizeActionKey(nextBrief.id)}.reset_local.mock`,
      actionLabel: `Reset local operator daily brief state: ${nextBrief.businessDate}`,
      severity: 'notice',
      metadata: buildDailyBriefMetadata(nextBrief, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalDailyBriefStates(current => current.filter(state => state.briefId !== nextBrief.id))
    setNotice('Operator Daily Brief reset to draft locally and recorded in Audit Logs.')
  }

  const openTarget = (item: OperatorDailyBriefFocusItem) => {
    const permission = getTargetPermission(item.targetPage)
    const result = runAdminAction(session, {
      permission,
      scope: item.scope,
      actionKey: `operator_daily_brief.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened daily brief target: ${item.title}`,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildFocusItemMetadata(item, {
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

  const queueFollowUp = (item: OperatorDailyBriefFocusItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Daily brief follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.recommendedAction} Source: ${item.sourceLabel}. ${item.detail}`,
      rollbackNotes: item.rollbackNotes,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildFocusItemMetadata(item, {
        source: 'operator_daily_brief',
        businessDate: brief.businessDate,
      }),
      handlerKey: item.handlerKey,
      handlerLabel: `${item.sourceLabel} daily brief follow-up handler`,
      handlerDescription: `Server-side placeholder for Operator Daily Brief follow-up: ${item.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedId(item.id)
    recordBriefState(brief, 'Shared', `Follow-up queued as ${result.request.id}.`, result.request.id)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Daily Command"
        title="Operator Daily Brief"
        description="A one-page operating brief for today's owner decisions, coverage gaps, approvals, support risks, revenue pressure, and growth follow-up."
        action={<StatusPill label={canManageBrief ? 'Local brief controls enabled' : 'Read only'} tone={canManageBrief ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Posture" value={summary.posture} delta={`${summary.critical} critical focus items`} tone={postureMetricTone(summary.posture)} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Focus Items" value={String(summary.totalFocus)} delta={`${sourceLabel} plus local operating state`} tone={summary.critical ? 'danger' : summary.totalFocus ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Approvals / Coverage" value={`${summary.approvals}/${summary.coverage}`} delta={`${brief.status} brief status`} tone={summary.approvals || summary.coverage ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Revenue At Risk" value={formatCurrency(summary.revenueAtRisk)} delta={`${summary.supportRisks} support risks / ${summary.growthSignals} growth signals`} tone={summary.revenueAtRisk ? 'warn' : 'neutral'} icon={<CircleDollarSign size={16} />} />
      </div>

      <section className="panel operator-daily-boundary-panel">
        <div>
          <p className="eyebrow">Operating Boundary</p>
          <h2>Daily command can decide and route; governed handlers still control execution</h2>
          <span>{operatorDailyBriefBoundaryRule}</span>
        </div>
        <StatusPill label={brief.status} tone={getOperatorDailyStatusTone(brief.status)} />
      </section>

      <section className={`panel operator-daily-status-panel tone-${getOperatorDailyPostureTone(brief.posture)}`}>
        <div>
          <p className="eyebrow">Today&apos;s Readout</p>
          <h2>{brief.summary}</h2>
          <span>Generated {formatDateTime(brief.generatedAt)} from command, support, revenue, usage, health, and registration signals.</span>
        </div>
        <div className="operator-daily-status-meta">
          <StatusPill label={brief.posture} tone={getOperatorDailyPostureTone(brief.posture)} />
          <strong>{brief.businessDate}</strong>
        </div>
      </section>

      <section className="operator-daily-brief-grid" aria-label="Daily brief highlights">
        <DailyBriefMiniList title="Command Highlights" icon={<Newspaper size={16} />} items={brief.commandHighlights} onSelect={setSelectedId} />
        <DailyBriefMiniList title="Revenue Risks" icon={<CircleDollarSign size={16} />} items={brief.revenueRisks} onSelect={setSelectedId} />
        <DailyBriefMiniList title="Support Risks" icon={<Activity size={16} />} items={brief.supportRisks} onSelect={setSelectedId} />
        <DailyBriefMiniList title="Growth Signals" icon={<TrendingUp size={16} />} items={brief.growthSignals} onSelect={setSelectedId} />
      </section>

      <div className="timeline-filter-bar" aria-label="Daily brief lane filters">
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
            <span>{lane === 'All' ? brief.focusItems.length : brief.focusItems.filter(item => item.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="operator-daily-layout">
        <DataTable
          label="What To Do Next"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No daily focus items match this lane."
          columns={[
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => laneSortValue(row),
              render: row => <StatusPill label={row.lane} tone={getOperatorDailyLaneTone(row.lane)} />,
            },
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.detail} ${row.scope} ${row.owner}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row),
              render: row => <StatusPill label={row.priority} tone={getCommandWorkPriorityTone(row.priority)} />,
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

        <aside className="detail-panel operator-daily-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Daily Focus</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.priority} tone={getCommandWorkPriorityTone(selectedItem.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Source</span><strong>{selectedItem.sourceLabel}</strong></div>
                <div><span>Target</span><strong>{getTargetLabel(selectedItem.targetPage)}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <section className={`panel operator-daily-item-panel tone-${getCommandWorkPriorityTone(selectedItem.priority)}`}>
                <div>
                  <p className="eyebrow">Recommended Next Move</p>
                  <h2>{selectedItem.recommendedAction}</h2>
                  <span>{selectedItem.detail}</span>
                </div>
                <div className="operator-daily-status-meta">
                  <StatusPill label={selectedItem.lane} tone={getOperatorDailyLaneTone(selectedItem.lane)} />
                  <strong>{selectedItem.followUpPermission}</strong>
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
                <h3>Execution Guardrails</h3>
                <div className="operator-daily-related-grid">
                  <div><span>Record</span><strong>{selectedItem.relatedRecordId}</strong></div>
                  <div><span>Target</span><strong>{selectedItem.targetPage}</strong></div>
                  <div><span>Action Type</span><strong>{selectedItem.followUpActionType}</strong></div>
                  <div><span>Handler</span><strong>{selectedItem.handlerKey ?? 'Server placeholder required'}</strong></div>
                  <div><span>Open Permission</span><strong>{getTargetPermission(selectedItem.targetPage)}</strong></div>
                  <div><span>Follow-Up Permission</span><strong>{selectedItem.followUpPermission}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTarget(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button className="ghost-action" disabled={!canManageBrief} onClick={() => recordBriefState(brief, 'Reviewed', 'Operator Daily Brief reviewed locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Review Brief
                  </button>
                  <button className="ghost-action" disabled={!canManageBrief} onClick={() => recordBriefState(brief, 'Shared', 'Operator Daily Brief shared locally with the operating team.')}>
                    <FileCheck2 size={15} strokeWidth={1.8} />
                    Share Brief
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canManageBrief} onClick={() => recordBriefState(brief, 'Archived', 'Operator Daily Brief archived locally.')}>
                    <Archive size={15} strokeWidth={1.8} />
                    Archive
                  </button>
                  <button className="ghost-action" disabled={!canManageBrief} onClick={() => resetBriefState(brief)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <>
                      <button className="ghost-action" onClick={() => onOpenTarget('command-work')}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Command Queue
                      </button>
                      <button className="ghost-action" onClick={() => onOpenTarget('decision-briefs')}>
                        <Newspaper size={15} strokeWidth={1.8} />
                        Decision Briefs
                      </button>
                    </>
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
            <div className="empty-state compact">No daily focus item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function DailyBriefMiniList({
  title,
  icon,
  items,
  onSelect,
}: {
  title: string
  icon: ReactNode
  items: OperatorDailyBriefFocusItem[]
  onSelect: (id: string) => void
}) {
  return (
    <section className="panel operator-daily-mini-card">
      <div className="operator-daily-mini-header">
        <span>{icon}</span>
        <strong>{title}</strong>
        <StatusPill label={String(items.length)} tone={items.some(item => item.priority === 'Critical') ? 'danger' : items.length ? 'warn' : 'ok'} />
      </div>
      <div className="operator-daily-mini-list">
        {items.slice(0, 4).map(item => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.title}</strong>
              <small>{item.owner} / {item.scope}</small>
            </span>
            <StatusPill label={item.lane} tone={getOperatorDailyLaneTone(item.lane)} />
          </button>
        ))}
        {!items.length && <div className="empty-state compact">No signals in this lane.</div>}
      </div>
    </section>
  )
}

function buildDailyBriefMetadata(brief: OperatorDailyBriefRecord, extra: Record<string, unknown>) {
  return {
    operatorDailyBriefId: brief.id,
    businessDate: brief.businessDate,
    status: brief.status,
    posture: brief.posture,
    focusItems: brief.focusItems.length,
    criticalItems: brief.focusItems.filter(item => item.priority === 'Critical').length,
    ...extra,
  }
}

function buildFocusItemMetadata(item: OperatorDailyBriefFocusItem, extra: Record<string, unknown>) {
  return {
    operatorDailyFocusItemId: item.id,
    lane: item.lane,
    priority: item.priority,
    source: item.sourceLabel,
    scope: item.scope,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    followUpActionType: item.followUpActionType,
    ...extra,
  }
}

function getTargetPermission(page: OperatorDailyTargetPage): PermissionKey {
  if (page === 'revenue') return 'revenue.view'
  if (page === 'support') return 'support.view'
  if (page === 'registrations') return 'registrations.view'
  if (page === 'usage') return 'usage.view'
  if (page === 'health' || page === 'data-quality') return 'health.view'
  if (page === 'audit') return 'audit.view'
  if (page === 'saved-views') return 'saved_views.view'
  if (page === 'agents') return 'agents.view'
  if (page === 'client-success') return 'clients.view'
  if (page === 'action-requests' || page === 'approval-center') return 'admin_actions.view'
  if (page === 'coverage-ledger' || page === 'notification-routing' || page === 'on-call-schedule' || page === 'watch-center' || page === 'sla-board') return 'notifications.view'
  return 'dashboard.view'
}

function getTargetLabel(page: OperatorDailyTargetPage) {
  const labels: Partial<Record<OperatorDailyTargetPage, string>> = {
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

function postureMetricTone(posture: OperatorDailyBriefRecord['posture']) {
  if (posture === 'Critical') return 'danger' as const
  if (posture === 'At Risk' || posture === 'Watch') return 'warn' as const
  return 'ok' as const
}

function prioritySortValue(item: OperatorDailyBriefFocusItem) {
  if (item.priority === 'Critical') return `0 ${item.priority}`
  if (item.priority === 'High') return `1 ${item.priority}`
  if (item.priority === 'Medium') return `2 ${item.priority}`
  return `3 ${item.priority}`
}

function laneSortValue(item: OperatorDailyBriefFocusItem) {
  if (item.lane === 'Do First') return `0 ${item.lane}`
  if (item.lane === 'Approve') return `1 ${item.lane}`
  if (item.lane === 'Cover') return `2 ${item.lane}`
  if (item.lane === 'Support') return `3 ${item.lane}`
  if (item.lane === 'Revenue') return `4 ${item.lane}`
  if (item.lane === 'Growth') return `5 ${item.lane}`
  return `6 ${item.lane}`
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
