import {
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  GitBranch,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
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
  getCommandWorkDecisionTone,
  getCommandWorkLaneTone,
  getCommandWorkPriorityTone,
  type CommandWorkSource,
  type CommandWorkTargetPage,
} from '../../lib/command-work/commandWorkQueue'
import {
  buildDecisionBriefs,
  decisionBriefBoundaryRule,
  getDecisionBriefReadinessTone,
  getDecisionBriefStatusTone,
  summarizeDecisionBriefs,
  useLocalDecisionBriefStates,
  type DecisionBriefReadiness,
  type DecisionBriefRecord,
  type DecisionBriefStatus,
} from '../../lib/command-work/decisionBriefs'
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

interface DecisionBriefBuilderPageProps {
  session: AdminSession
  onOpenTarget?: (page: CommandWorkTargetPage | 'command-work' | 'action-requests') => void
}

const sourceFilters: Array<'All' | CommandWorkSource> = ['All', 'Escalation Inbox', 'Coverage Ledger', 'Approval Center', 'Ownership SLA']
const readinessFilters: Array<'All' | DecisionBriefReadiness> = ['All', 'Blocked', 'Needs Approval', 'Needs Evidence', 'Ready']
const statusFilters: Array<'All' | DecisionBriefStatus> = ['All', 'Draft', 'Saved', 'Reviewed', 'Follow-Up Queued', 'Archived']

export default function DecisionBriefBuilderPage({ session, onOpenTarget }: DecisionBriefBuilderPageProps) {
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
  const [localBriefStates, setLocalBriefStates] = useLocalDecisionBriefStates()
  const [selectedId, setSelectedId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | CommandWorkSource>('All')
  const [readinessFilter, setReadinessFilter] = useState<'All' | DecisionBriefReadiness>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | DecisionBriefStatus>('All')
  const [notice, setNotice] = useState('')
  const canManageBriefs = hasPermission(session.role, 'dashboard.view')

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
  }), [actionRequests, coverageEntries, escalations, governanceRecords, workItems])
  const briefs = useMemo(() => buildDecisionBriefs({
    workItems: commandWorkItems,
    actionRequests,
    governanceRecords,
    auditEvents,
    localStates: localBriefStates,
  }), [actionRequests, auditEvents, commandWorkItems, governanceRecords, localBriefStates])
  const summary = useMemo(() => summarizeDecisionBriefs(briefs), [briefs])
  const filteredBriefs = useMemo(() => briefs.filter(brief => {
    if (sourceFilter !== 'All' && brief.source !== sourceFilter) return false
    if (readinessFilter !== 'All' && brief.readiness !== readinessFilter) return false
    if (statusFilter !== 'All' && brief.status !== statusFilter) return false
    return true
  }), [briefs, readinessFilter, sourceFilter, statusFilter])
  const selectedBrief = filteredBriefs.find(brief => brief.id === selectedId)
    ?? briefs.find(brief => brief.id === selectedId)
    ?? filteredBriefs[0]
    ?? briefs[0]
  const canOpenSelected = selectedBrief ? hasPermission(session.role, selectedBrief.workItem.permission) : false
  const canQueueSelected = selectedBrief ? hasPermission(session.role, selectedBrief.workItem.followUpPermission) : false

  const recordBriefState = (brief: DecisionBriefRecord, status: DecisionBriefStatus, note: string, followUpRequestId?: string) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: brief.scope,
      actionKey: `decision_brief.${sanitizeActionKey(brief.id)}.${sanitizeActionKey(status)}.mock`,
      actionLabel: `${status} decision brief: ${brief.title}`,
      severity: brief.priority === 'Critical' || brief.readiness === 'Blocked' ? 'warning' : 'notice',
      metadata: buildBriefMetadata(brief, {
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

    setLocalBriefStates(current => [
      {
        briefId: brief.id,
        status,
        note,
        reviewedAt: status === 'Reviewed' ? new Date().toISOString() : brief.localState?.reviewedAt,
        followUpRequestId,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.briefId !== brief.id),
    ])
    setSelectedId(brief.id)
    setNotice(`${brief.title} brief marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetBriefState = (brief: DecisionBriefRecord) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: brief.scope,
      actionKey: `decision_brief.${sanitizeActionKey(brief.id)}.reset_local.mock`,
      actionLabel: `Reset local decision brief state: ${brief.title}`,
      severity: 'notice',
      metadata: buildBriefMetadata(brief, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalBriefStates(current => current.filter(state => state.briefId !== brief.id))
    setSelectedId(brief.id)
    setNotice(`${brief.title} brief reset to draft and recorded in Audit Logs.`)
  }

  const queueFollowUp = (brief: DecisionBriefRecord) => {
    const item = brief.workItem
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Decision brief follow-up: ${brief.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${brief.recommendedAction} Summary: ${brief.executiveSummary}`,
      rollbackNotes: brief.rollbackPlan,
      severity: brief.priority === 'Critical' || brief.readiness === 'Blocked' ? 'warning' : 'notice',
      metadata: buildBriefMetadata(brief, {
        source: 'decision_brief_builder',
      }),
      handlerKey: item.handlerKey,
      handlerLabel: `${brief.source} decision brief follow-up handler`,
      handlerDescription: `Server-side placeholder for Decision Brief follow-up: ${brief.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    recordBriefState(brief, 'Follow-Up Queued', `Follow-up queued as ${result.request.id}.`, result.request.id)
  }

  const openSource = (brief: DecisionBriefRecord) => {
    const result = runAdminAction(session, {
      permission: brief.workItem.permission,
      scope: brief.scope,
      actionKey: `decision_brief.${sanitizeActionKey(brief.id)}.opened_source.mock`,
      actionLabel: `Opened decision brief source: ${brief.title}`,
      severity: brief.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildBriefMetadata(brief, {
        targetPage: brief.workItem.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${brief.title} opened in ${brief.targetLabel}.`)
    onOpenTarget?.(brief.workItem.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Decision Support"
        title="Decision Brief Builder"
        description="Owner-ready briefs generated from command work, evidence, approvals, rollback notes, and audit history."
        action={<StatusPill label={canManageBriefs ? 'Local brief controls enabled' : 'Read only'} tone={canManageBriefs ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Ready Briefs" value={String(summary.ready)} delta={`${sourceLabel} plus local brief state`} tone={summary.ready ? 'ok' : 'neutral'} icon={<FileCheck2 size={16} />} />
        <MetricCard label="Needs Approval" value={String(summary.needsApproval)} delta={`${summary.blocked} blocked`} tone={summary.blocked ? 'danger' : summary.needsApproval ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="High Priority" value={String(summary.highPriority)} delta={`${summary.needsEvidence} need evidence`} tone={summary.highPriority ? 'warn' : 'neutral'} icon={<Clock3 size={16} />} />
        <MetricCard label="Saved / Reviewed" value={`${summary.saved}/${summary.reviewed}`} delta={`${summary.followUps} follow-ups queued`} tone={summary.followUps ? 'warn' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel decision-brief-boundary-panel">
        <div>
          <p className="eyebrow">Brief Boundary</p>
          <h2>Briefs support owner decisions; governed handlers control execution</h2>
          <span>{decisionBriefBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} generated briefs`} tone={summary.blocked ? 'danger' : 'ok'} />
      </section>

      <div className="timeline-filter-bar" aria-label="Decision brief source filters">
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
            <span>{source === 'All' ? briefs.length : briefs.filter(brief => brief.source === source).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Decision brief readiness filters">
        {readinessFilters.map(readiness => (
          <button
            key={readiness}
            className={readinessFilter === readiness ? 'selected' : ''}
            onClick={() => {
              setReadinessFilter(readiness)
              setSelectedId('')
            }}
          >
            {readiness}
            <span>{readiness === 'All' ? briefs.length : briefs.filter(brief => brief.readiness === readiness).length}</span>
          </button>
        ))}
      </div>

      <div className="decision-brief-layout">
        <DataTable
          label="Decision Briefs"
          rows={filteredBriefs}
          pageSize={9}
          emptyTitle="No decision briefs match these filters."
          columns={[
            {
              key: 'readiness',
              header: 'Readiness',
              sortable: true,
              searchValue: row => readinessSortValue(row),
              render: row => <StatusPill label={row.readiness} tone={getDecisionBriefReadinessTone(row.readiness)} />,
            },
            {
              key: 'brief',
              header: 'Brief',
              sortable: true,
              searchValue: row => `${row.title} ${row.executiveSummary} ${row.scope}`,
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
              key: 'decision',
              header: 'Decision',
              sortable: true,
              searchValue: row => row.decision,
              render: row => <StatusPill label={row.decision} tone={getCommandWorkDecisionTone(row.decision)} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.source} ${row.targetLabel}`,
              render: row => <div><strong>{row.source}</strong><span className="cell-subtext">{row.targetLabel}</span></div>,
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
              render: row => <StatusPill label={row.status} tone={getDecisionBriefStatusTone(row.status)} />,
            },
          ]}
        />

        <aside className="detail-panel decision-brief-detail-panel">
          {selectedBrief ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Generated Brief</p>
                  <h2>{selectedBrief.title}</h2>
                </div>
                <StatusPill label={selectedBrief.readiness} tone={getDecisionBriefReadinessTone(selectedBrief.readiness)} />
              </div>

              <div className="request-scope-list">
                <div><span>Priority</span><strong>{selectedBrief.priority}</strong></div>
                <div><span>Decision</span><strong>{selectedBrief.decision}</strong></div>
                <div><span>Owner</span><strong>{selectedBrief.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedBrief.scope}</strong></div>
                <div><span>Source</span><strong>{selectedBrief.source}</strong></div>
                <div><span>Local</span><strong>{selectedBrief.status}</strong></div>
              </div>

              <section className={`panel decision-brief-status-panel tone-${getDecisionBriefReadinessTone(selectedBrief.readiness)}`}>
                <div>
                  <p className="eyebrow">Executive Summary</p>
                  <h2>{selectedBrief.executiveSummary}</h2>
                  <span>{selectedBrief.recommendedAction}</span>
                </div>
                <div className="decision-brief-status-meta">
                  <StatusPill label={selectedBrief.workItem.lane} tone={getCommandWorkLaneTone(selectedBrief.workItem.lane)} />
                  <strong>{formatDateTime(selectedBrief.dueAt)}</strong>
                </div>
              </section>

              <div className="decision-brief-section-list">
                {selectedBrief.sections.map(section => (
                  <section key={section.heading} className="panel decision-brief-section">
                    <h3>{section.heading}</h3>
                    <p>{section.body}</p>
                    <div className="settings-rule-list">
                      {section.items.map(item => (
                        <div key={item}>
                          <ShieldCheck size={16} strokeWidth={1.8} />
                          <strong>{item}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="detail-section">
                <h3>Risk Notes</h3>
                <div className="settings-rule-list">
                  {selectedBrief.riskNotes.map(note => (
                    <div key={note}>
                      <ShieldAlert size={16} strokeWidth={1.8} />
                      <strong>{note}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Audit Trail</h3>
                <div className="settings-rule-list">
                  {selectedBrief.auditTrail.map(event => (
                    <div key={event}>
                      <GitBranch size={16} strokeWidth={1.8} />
                      <strong>{event}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openSource(selectedBrief)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                  <button className="ghost-action" disabled={!canManageBriefs} onClick={() => recordBriefState(selectedBrief, 'Saved', 'Decision brief saved locally for owner review.')}>
                    <FileCheck2 size={15} strokeWidth={1.8} />
                    Save Brief
                  </button>
                  <button className="ghost-action" disabled={!canManageBriefs} onClick={() => recordBriefState(selectedBrief, 'Reviewed', 'Decision brief reviewed locally.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueFollowUp(selectedBrief)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canManageBriefs} onClick={() => recordBriefState(selectedBrief, 'Archived', 'Decision brief archived locally.')}>
                    <Archive size={15} strokeWidth={1.8} />
                    Archive
                  </button>
                  <button className="ghost-action" disabled={!canManageBriefs} onClick={() => resetBriefState(selectedBrief)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenTarget && (
                    <button className="ghost-action" onClick={() => onOpenTarget('command-work')}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Command Queue
                    </button>
                  )}
                </div>
                {!canOpenSelected && <p className="warning-copy">Opening the source requires {selectedBrief.workItem.permission}.</p>}
                {!canQueueSelected && <p className="warning-copy">Follow-up queueing requires {selectedBrief.workItem.followUpPermission}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No decision brief selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildBriefMetadata(brief: DecisionBriefRecord, extra: Record<string, unknown>) {
  return {
    decisionBriefId: brief.id,
    commandWorkItemId: brief.workItemId,
    readiness: brief.readiness,
    priority: brief.priority,
    decision: brief.decision,
    source: brief.source,
    scope: brief.scope,
    targetPage: brief.workItem.targetPage,
    actionRequestId: brief.actionRequest?.id,
    ...extra,
  }
}

function readinessSortValue(brief: DecisionBriefRecord) {
  if (brief.readiness === 'Blocked') return `0 ${brief.readiness}`
  if (brief.readiness === 'Needs Approval') return `1 ${brief.readiness}`
  if (brief.readiness === 'Needs Evidence') return `2 ${brief.readiness}`
  return `3 ${brief.readiness}`
}

function prioritySortValue(brief: DecisionBriefRecord) {
  if (brief.priority === 'Critical') return `0 ${brief.priority}`
  if (brief.priority === 'High') return `1 ${brief.priority}`
  if (brief.priority === 'Medium') return `2 ${brief.priority}`
  return `3 ${brief.priority}`
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
