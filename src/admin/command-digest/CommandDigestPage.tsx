import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  GitBranch,
  ListChecks,
  Newspaper,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { buildCommandCadence } from '../../lib/command-cadence/commandCadence'
import {
  buildCommandDigest,
  buildCommandDigestHeadlines,
  buildCommandDigestNarrative,
  commandDigestBoundaryRule,
  commandDigestLanes,
  formatDigestCurrency,
  getDigestDecisionTone,
  getDigestLaneTone,
  getDigestPostureTone,
  getDigestReviewTone,
  getDigestSeverityTone,
  summarizeCommandDigest,
  summarizeCommandDigestLanes,
  useLocalCommandDigestStates,
  type CommandDigestItem,
  type CommandDigestLane,
  type CommandDigestReviewStatus,
  type CommandDigestTargetPage,
} from '../../lib/command-digest/commandDigest'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface CommandDigestPageProps {
  session: AdminSession
  onOpenTarget?: (page: CommandDigestTargetPage) => void
  onOpenActionRequests?: () => void
}

const laneFilters: Array<'All' | CommandDigestLane> = ['All', ...commandDigestLanes]

export default function CommandDigestPage({ session, onOpenTarget, onOpenActionRequests }: CommandDigestPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const [localSavedViews] = useLocalSavedViews()
  const [localWatchStates] = useLocalWatchSignalStates()
  const [localRuleStates] = useLocalWatchRuleStates()
  const [localPlaybookStates] = useLocalResponsePlaybookStates()
  const [localSlaStates] = useLocalSlaEscalationStates()
  const [localDigestStates, setLocalDigestStates] = useLocalCommandDigestStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | CommandDigestLane>('All')
  const [notice, setNotice] = useState('')

  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

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
  const summary = useMemo(() => summarizeCommandDigest(digestItems, data), [data, digestItems])
  const headlines = useMemo(() => buildCommandDigestHeadlines(summary, digestItems), [digestItems, summary])
  const laneSummaries = useMemo(() => summarizeCommandDigestLanes(digestItems), [digestItems])
  const narrative = useMemo(() => buildCommandDigestNarrative(summary, digestItems), [digestItems, summary])
  const filteredItems = useMemo(() => laneFilter === 'All'
    ? digestItems
    : digestItems.filter(item => item.lane === laneFilter),
  [digestItems, laneFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? digestItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? digestItems[0]
  const canQueueSelected = selectedItem ? hasPermission(session.role, selectedItem.followUpPermission) : false

  const setReviewState = (item: CommandDigestItem, reviewStatus: CommandDigestReviewStatus, note: string) => {
    setLocalDigestStates(current => [
      {
        itemId: item.id,
        reviewStatus,
        note,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
  }

  const recordDigestReview = (item: CommandDigestItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `command_digest.${sanitizeActionKey(item.id)}.reviewed.mock`,
      actionLabel: `Reviewed command digest item: ${item.title}`,
      severity: item.severity === 'Critical' ? 'warning' : 'notice',
      metadata: buildDigestMetadata(item, {
        reviewStatus: 'Reviewed',
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setReviewState(item, 'Reviewed', 'Executive digest review recorded locally.')
    setNotice(`${item.title} marked reviewed and recorded in Audit Logs.`)
  }

  const queueDigestFollowUp = (item: CommandDigestItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Command digest follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.decision} requested from Command Digest. Recommended action: ${item.recommendedAction}`,
      rollbackNotes: 'No production state is changed from Command Digest. Server handler must validate scope, permission, approval, audit, and rollback metadata before execution.',
      severity: item.severity === 'Critical' || item.decision === 'Escalate' ? 'warning' : 'notice',
      metadata: buildDigestMetadata(item, {
        source: 'command_digest',
      }),
      handlerKey: `server.command_digest.${item.followUpActionType}`,
      handlerLabel: `${item.lane} digest follow-up handler`,
      handlerDescription: `Server-side placeholder for digest follow-up: ${item.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setReviewState(item, 'Follow-Up Queued', `Queued ${result.request.id}.`)
    setNotice(`${item.title} follow-up queued in Action Requests.`)
  }

  const openTargetWorkspace = (item: CommandDigestItem) => {
    const result = runAdminAction(session, {
      permission: item.permission,
      scope: item.scope,
      actionKey: `command_digest.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened target workspace for digest item: ${item.title}`,
      severity: item.severity === 'Critical' ? 'warning' : 'notice',
      metadata: buildDigestMetadata(item, {
        targetPage: item.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} opened in its source workspace.`)
    onOpenTarget?.(item.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Executive Briefing"
        title="Command Digest"
        description="Owner-ready operating brief across SLA pressure, urgent watch items, revenue risk, support escalation, platform health, action handoffs, and agent recommendations."
        action={<StatusPill label={`${summary.posture} posture`} tone={getDigestPostureTone(summary.posture)} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Readiness" value={`${summary.readinessScore}%`} delta={`${sourceLabel} command posture`} tone={summary.readinessScore < 72 ? 'danger' : summary.readinessScore < 86 ? 'warn' : 'ok'} icon={<Activity size={16} />} />
        <MetricCard label="Critical" value={String(summary.critical)} delta="Owner-level decisions" tone={summary.critical ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Decisions" value={String(summary.decisionsNeeded)} delta="Review, assign, approve, escalate" tone={summary.decisionsNeeded ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
        <MetricCard label="Revenue Risk" value={formatDigestCurrency(summary.revenueAtRisk)} delta="Billing exposure in brief" tone={summary.revenueAtRisk ? 'warn' : 'ok'} icon={<CircleDollarSign size={16} />} />
      </div>

      <section className={`panel command-digest-brief-panel tone-${getDigestPostureTone(summary.posture)}`}>
        <div>
          <p className="eyebrow">Today's Brief</p>
          <h2>{narrative}</h2>
          <span>{commandDigestBoundaryRule}</span>
        </div>
        <div className="command-digest-brief-meta">
          <strong>{summary.total} brief items</strong>
          <span>{summary.supportEscalations} support escalation{summary.supportEscalations === 1 ? '' : 's'}</span>
          <StatusPill label={`${summary.handoffsReady} handoffs`} tone={summary.handoffsReady ? 'warn' : 'ok'} />
        </div>
      </section>

      <section className="command-digest-headline-grid" aria-label="Digest headlines">
        {headlines.map(headline => (
          <article key={headline.id} className="command-digest-headline-card">
            <div>
              <span>{headline.label}</span>
              <strong>{headline.value}</strong>
            </div>
            <p>{headline.detail}</p>
            <StatusPill label={headline.tone === 'danger' ? 'urgent' : headline.tone === 'warn' ? 'watch' : 'steady'} tone={headline.tone} />
          </article>
        ))}
      </section>

      <section className="command-digest-lane-grid" aria-label="Digest lanes">
        {laneSummaries.map(lane => (
          <button
            key={lane.lane}
            className={laneFilter === lane.lane ? 'selected' : ''}
            onClick={() => {
              setLaneFilter(lane.lane)
              setSelectedId('')
            }}
          >
            <StatusPill label={lane.lane} tone={getDigestLaneTone(lane.lane)} />
            <strong>{lane.total}</strong>
            <span>{lane.topOwner}</span>
            <small>{lane.critical} critical / {lane.nextDecision}</small>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Digest filters">
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
            <span>{lane === 'All' ? digestItems.length : laneSummaries.find(summary => summary.lane === lane)?.total ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="command-digest-layout">
        <DataTable
          label="Executive Decision Queue"
          rows={filteredItems}
          pageSize={8}
          emptyTitle="No digest items match this lane."
          columns={[
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => severitySortValue(row),
              render: row => <StatusPill label={row.severity} tone={getDigestSeverityTone(row.severity)} />,
            },
            {
              key: 'decision',
              header: 'Decision',
              sortable: true,
              searchValue: row => row.decision,
              render: row => <StatusPill label={row.decision} tone={getDigestDecisionTone(row.decision)} />,
            },
            {
              key: 'brief',
              header: 'Brief',
              sortable: true,
              searchValue: row => `${row.title} ${row.brief} ${row.scope} ${row.owner}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getDigestLaneTone(row.lane)} />,
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
              render: row => <div><strong>{formatDateTime(row.dueAt)}</strong><span className="cell-subtext">{row.source}</span></div>,
            },
            {
              key: 'review',
              header: 'Review',
              sortable: true,
              searchValue: row => row.reviewStatus,
              render: row => <StatusPill label={row.reviewStatus} tone={getDigestReviewTone(row.reviewStatus)} />,
            },
          ]}
        />

        <aside className="detail-panel command-digest-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Brief Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.severity} tone={getDigestSeverityTone(selectedItem.severity)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedItem.lane}</strong></div>
                <div><span>Decision</span><strong>{selectedItem.decision}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <section className={`panel command-digest-status-panel tone-${getDigestSeverityTone(selectedItem.severity)}`}>
                <div>
                  <p className="eyebrow">Executive Signal</p>
                  <h2>{selectedItem.brief}</h2>
                  <span>{selectedItem.scope}</span>
                </div>
                <div className="command-digest-status-meta">
                  <StatusPill label={selectedItem.sourceStatus} tone={getDigestSeverityTone(selectedItem.severity)} />
                  <strong>Score {selectedItem.score}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Recommended Action</h3>
                <p className="muted-copy">{selectedItem.recommendedAction}</p>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedItem.evidence.map(evidence => (
                    <div key={evidence}>
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-rule-list">
                <div>
                  <Newspaper size={16} strokeWidth={1.8} />
                  <strong>Source: {selectedItem.source}</strong>
                </div>
                <div>
                  <Clock3 size={16} strokeWidth={1.8} />
                  <strong>Detected {formatDateTime(selectedItem.createdAt)}</strong>
                </div>
                <div>
                  <UserRoundCheck size={16} strokeWidth={1.8} />
                  <strong>Review status: {selectedItem.reviewStatus}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Record id: {selectedItem.relatedRecordId}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordDigestReview(selectedItem)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" onClick={() => openTargetWorkspace(selectedItem)}>
                    <Send size={15} strokeWidth={1.8} />
                    Open Workspace
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueDigestFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Open Action Requests
                    </button>
                  )}
                </div>
                {!canQueueSelected && <p className="warning-copy">Follow-up requires a narrower operational permission for this lane.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state">The executive brief is clear.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function severitySortValue(item: CommandDigestItem) {
  const severityWeight = item.severity === 'Critical' ? 0 : item.severity === 'High' ? 1 : item.severity === 'Moderate' ? 2 : 3
  return `${severityWeight} ${String(100 - item.score).padStart(3, '0')} ${item.dueAt}`
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function buildDigestMetadata(item: CommandDigestItem, metadata: Record<string, unknown> = {}) {
  return {
    digestItemId: item.id,
    lane: item.lane,
    severity: item.severity,
    decision: item.decision,
    source: item.source,
    sourceStatus: item.sourceStatus,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    followUpActionType: item.followUpActionType,
    ...metadata,
  }
}
