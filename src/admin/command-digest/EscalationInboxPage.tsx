import {
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  GitBranch,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  XCircle,
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
  useLocalCommandDigestStates,
} from '../../lib/command-digest/commandDigest'
import { useLocalCommandBriefSnapshots } from '../../lib/command-digest/briefArchive'
import {
  buildEscalationInbox,
  escalationInboxBoundaryRule,
  getEscalationDecisionTone,
  getEscalationSeverityTone,
  getEscalationSourceTone,
  getEscalationStatusTone,
  summarizeEscalationInbox,
  useLocalEscalationInboxStates,
  type EscalationInboxItem,
  type EscalationInboxLocalStatus,
  type EscalationInboxSource,
  type EscalationInboxTargetPage,
} from '../../lib/command-digest/escalationInbox'
import { buildDigestReviewCadence, useLocalDigestReviewCadenceStates } from '../../lib/command-digest/reviewCadence'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface EscalationInboxPageProps {
  session: AdminSession
  onOpenTarget?: (page: EscalationInboxTargetPage) => void
  onOpenActionRequests?: () => void
}

const sourceFilters: Array<'All' | EscalationInboxSource> = ['All', 'Review Cadence', 'SLA Board', 'Action Request', 'Command Digest', 'Watch Center']
const ownerFilters = ['All', 'Owner', 'Admin', 'Admin Ops', 'Support', 'Support Lead', 'Engineering', 'Finance', 'Client Success', 'Security'] as const

export default function EscalationInboxPage({ session, onOpenTarget, onOpenActionRequests }: EscalationInboxPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const [localSavedViews] = useLocalSavedViews()
  const [localWatchStates] = useLocalWatchSignalStates()
  const [localRuleStates] = useLocalWatchRuleStates()
  const [localPlaybookStates] = useLocalResponsePlaybookStates()
  const [localSlaStates] = useLocalSlaEscalationStates()
  const [localDigestStates] = useLocalCommandDigestStates()
  const [localReviewStates] = useLocalDigestReviewCadenceStates()
  const [snapshots] = useLocalCommandBriefSnapshots()
  const [localInboxStates, setLocalInboxStates] = useLocalEscalationInboxStates()
  const [selectedId, setSelectedId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | EscalationInboxSource>('All')
  const [ownerFilter, setOwnerFilter] = useState<typeof ownerFilters[number]>('All')
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
  const reviewWindows = useMemo(() => buildDigestReviewCadence({
    snapshots,
    localStates: localReviewStates,
  }), [localReviewStates, snapshots])
  const items = useMemo(() => buildEscalationInbox({
    reviewWindows,
    slaItems,
    digestItems,
    watchSignals,
    actionRequests,
    localStates: localInboxStates,
  }), [actionRequests, digestItems, localInboxStates, reviewWindows, slaItems, watchSignals])
  const summary = useMemo(() => summarizeEscalationInbox(items), [items])
  const sourceSummaries = useMemo(() => sourceFilters
    .filter(source => source !== 'All')
    .map(source => {
      const sourceItems = items.filter(item => item.source === source)
      return {
        source,
        total: sourceItems.length,
        critical: sourceItems.filter(item => item.severity === 'Critical').length,
        nextDecision: sourceItems[0]?.decision ?? 'Monitor',
      }
    }), [items])
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach(item => counts.set(item.owner, (counts.get(item.owner) ?? 0) + 1))
    return counts
  }, [items])
  const filteredItems = useMemo(() => items.filter(item => {
    const matchesSource = sourceFilter === 'All' || item.source === sourceFilter
    const matchesOwner = ownerFilter === 'All' || item.owner === ownerFilter || item.owner.includes(ownerFilter)
    return matchesSource && matchesOwner
  }), [items, ownerFilter, sourceFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? items.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? items[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, selectedItem.permission) : false
  const canQueueSelected = selectedItem ? hasPermission(session.role, selectedItem.followUpPermission) : false

  const upsertLocalState = (item: EscalationInboxItem, status: EscalationInboxLocalStatus, note: string) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `escalation_inbox.${sanitizeActionKey(item.id)}.${status.toLowerCase()}.mock`,
      actionLabel: `${status} escalation inbox item: ${item.title}`,
      severity: status === 'Escalated' || item.severity === 'Critical' ? 'warning' : 'notice',
      metadata: buildInboxMetadata(item, {
        localStatus: status,
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalInboxStates(current => [
      {
        itemId: item.id,
        status,
        note,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setSelectedId(item.id)
    setNotice(`${item.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetLocalState = (item: EscalationInboxItem) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: item.scope,
      actionKey: `escalation_inbox.${sanitizeActionKey(item.id)}.reset_local.mock`,
      actionLabel: `Reset local escalation inbox state: ${item.title}`,
      severity: 'notice',
      metadata: buildInboxMetadata(item, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalInboxStates(current => current.filter(state => state.itemId !== item.id))
    setSelectedId(item.id)
    setNotice(`${item.title} reset to open inbox state and recorded in Audit Logs.`)
  }

  const openTargetWorkspace = (item: EscalationInboxItem) => {
    const result = runAdminAction(session, {
      permission: item.permission,
      scope: item.scope,
      actionKey: `escalation_inbox.${sanitizeActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened escalation source workspace: ${item.title}`,
      severity: item.severity === 'Critical' ? 'warning' : 'notice',
      metadata: buildInboxMetadata(item, {
        targetPage: item.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} opened in ${item.targetLabel}.`)
    onOpenTarget?.(item.targetPage)
  }

  const queueFollowUp = (item: EscalationInboxItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: item.followUpActionType,
      title: `Escalation inbox follow-up: ${item.title}`,
      permission: item.followUpPermission,
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.decision} requested from Escalation Inbox. Source: ${item.source}. ${item.description}`,
      rollbackNotes: item.rollbackNotes,
      severity: item.severity === 'Critical' || item.decision === 'Escalate' ? 'warning' : 'notice',
      metadata: buildInboxMetadata(item, {
        source: 'escalation_inbox',
      }),
      handlerKey: item.handlerKey,
      handlerLabel: `${item.source} escalation follow-up handler`,
      handlerDescription: `Server-side placeholder for escalation inbox follow-up: ${item.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalInboxStates(current => [
      {
        itemId: item.id,
        status: 'Escalated',
        note: `Follow-up queued as ${result.request.id}.`,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setSelectedId(item.id)
    setNotice(`${item.title} follow-up queued in Action Requests.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Owner Exceptions"
        title="Escalation Inbox"
        description="One decision queue for missed reviews, SLA breaches, blocked actions, urgent watch signals, and owner-level exceptions that need attention today."
        action={<StatusPill label={`${summary.open} open decisions`} tone={summary.open ? 'warn' : 'ok'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Critical" value={String(summary.critical)} delta={`${sourceLabel} exception posture`} tone={summary.critical ? 'danger' : 'ok'} icon={<Siren size={16} />} />
        <MetricCard label="Escalation Ready" value={String(summary.escalationReady)} delta="Ready for owner or approval handoff" tone={summary.escalationReady ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Blocked / Failed" value={String(summary.blockedOrFailed)} delta="Action requests need intervention" tone={summary.blockedOrFailed ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
        <MetricCard label="Overdue" value={String(summary.overdue)} delta={`${summary.dueToday} due today or soon`} tone={summary.overdue ? 'danger' : summary.dueToday ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
      </div>

      <section className="panel escalation-inbox-boundary-panel">
        <div>
          <p className="eyebrow">Decision Boundary</p>
          <h2>Inbox prioritizes decisions; Action Requests control execution</h2>
          <span>{escalationInboxBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.queueable} queueable follow-ups`} tone={summary.queueable ? 'warn' : 'ok'} />
      </section>

      <section className="escalation-inbox-source-grid" aria-label="Escalation source status">
        {sourceSummaries.map(source => (
          <button
            key={source.source}
            className={sourceFilter === source.source ? 'selected' : ''}
            onClick={() => {
              setSourceFilter(source.source)
              setSelectedId('')
            }}
          >
            <StatusPill label={source.source} tone={getEscalationSourceTone(source.source)} />
            <strong>{source.total}</strong>
            <span>{source.critical} critical</span>
            <small>{source.nextDecision}</small>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Escalation inbox filters">
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
            <span>{source === 'All' ? items.length : items.filter(item => item.source === source).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Escalation owner filters">
        {ownerFilters.map(owner => (
          <button
            key={owner}
            className={ownerFilter === owner ? 'selected' : ''}
            onClick={() => {
              setOwnerFilter(owner)
              setSelectedId('')
            }}
          >
            {owner}
            <span>{owner === 'All' ? items.length : ownerCounts.get(owner) ?? items.filter(item => item.owner.includes(owner)).length}</span>
          </button>
        ))}
      </div>

      <div className="escalation-inbox-layout">
        <DataTable
          label="Escalation Queue"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No escalation inbox items match these filters."
          columns={[
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope} ${row.owner}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => row.source,
              render: row => <StatusPill label={row.source} tone={getEscalationSourceTone(row.source)} />,
            },
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => severitySortValue(row),
              render: row => <StatusPill label={row.severity} tone={getEscalationSeverityTone(row.severity)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => statusSortValue(row),
              render: row => <StatusPill label={row.status} tone={getEscalationStatusTone(row.status)} />,
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
              render: row => <span className={row.minutesLate ? 'danger-copy' : undefined}>{formatDateTime(row.dueAt)}</span>,
            },
            {
              key: 'local',
              header: 'Local',
              sortable: true,
              searchValue: row => row.localStatus,
              render: row => <StatusPill label={row.localStatus} tone={row.localStatus === 'Open' ? 'neutral' : row.localStatus === 'Dismissed' ? 'neutral' : 'ok'} />,
            },
          ]}
        />

        <aside className="detail-panel escalation-inbox-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Decision Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.status} tone={getEscalationStatusTone(selectedItem.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Source</span><strong>{selectedItem.source}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Decision</span><strong>{selectedItem.decision}</strong></div>
                <div><span>Target</span><strong>{selectedItem.targetLabel}</strong></div>
                <div><span>Scope</span><strong>{selectedItem.scope}</strong></div>
                <div><span>Due</span><strong>{formatDateTime(selectedItem.dueAt)}</strong></div>
              </div>

              <section className={`panel escalation-inbox-status-panel tone-${getEscalationSeverityTone(selectedItem.severity)}`}>
                <div>
                  <p className="eyebrow">Recommended Decision</p>
                  <h2>{selectedItem.description}</h2>
                  <span>{formatLateText(selectedItem.minutesLate)} / {selectedItem.rollbackNotes}</span>
                </div>
                <div className="escalation-inbox-status-meta">
                  <StatusPill label={selectedItem.decision} tone={getEscalationDecisionTone(selectedItem.decision)} />
                  <strong>{selectedItem.score.toFixed(0)} priority score</strong>
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

              {selectedItem.localNote && (
                <div className="detail-section">
                  <h3>Local Note</h3>
                  <p className="muted-copy">{selectedItem.localNote}</p>
                </div>
              )}

              <div className="settings-rule-list">
                <div>
                  <GitBranch size={16} strokeWidth={1.8} />
                  <strong>Follow-up contract: {selectedItem.followUpActionType}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Required permission: {selectedItem.followUpPermission}</strong>
                </div>
                <div>
                  <BellRing size={16} strokeWidth={1.8} />
                  <strong>Source record: {selectedItem.relatedRecordId}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canOpenSelected} onClick={() => openTargetWorkspace(selectedItem)}>
                    <Eye size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                  <button className="ghost-action" onClick={() => upsertLocalState(selectedItem, 'Acknowledged', 'Acknowledged from Escalation Inbox.')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Acknowledge
                  </button>
                  <button className="ghost-action" onClick={() => upsertLocalState(selectedItem, 'Escalated', 'Marked escalated from Escalation Inbox.')}>
                    <ShieldAlert size={15} strokeWidth={1.8} />
                    Mark Escalated
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueFollowUp(selectedItem)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" onClick={() => upsertLocalState(selectedItem, 'Dismissed', 'Dismissed from Escalation Inbox local queue.')}>
                    <XCircle size={15} strokeWidth={1.8} />
                    Dismiss Local
                  </button>
                  <button className="ghost-action" onClick={() => resetLocalState(selectedItem)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canQueueSelected && <p className="warning-copy">Follow-up queueing requires {selectedItem.followUpPermission}.</p>}
                {!canOpenSelected && <p className="warning-copy">Opening the source requires {selectedItem.permission}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No escalation item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildInboxMetadata(item: EscalationInboxItem, extra: Record<string, unknown>) {
  return {
    escalationInboxItemId: item.id,
    source: item.source,
    severity: item.severity,
    status: item.status,
    decision: item.decision,
    owner: item.owner,
    scope: item.scope,
    targetPage: item.targetPage,
    relatedRecordId: item.relatedRecordId,
    followUpActionType: item.followUpActionType,
    ...extra,
  }
}

function severitySortValue(item: EscalationInboxItem) {
  if (item.severity === 'Critical') return `0 ${item.severity}`
  if (item.severity === 'High') return `1 ${item.severity}`
  if (item.severity === 'Medium') return `2 ${item.severity}`
  return `3 ${item.severity}`
}

function statusSortValue(item: EscalationInboxItem) {
  if (item.status === 'Blocked' || item.status === 'Failed') return `0 ${item.status}`
  if (item.status === 'Overdue' || item.status === 'Escalation Ready') return `1 ${item.status}`
  if (item.status === 'Action Handoff' || item.status === 'Approved') return `2 ${item.status}`
  if (item.status === 'Due Today' || item.status === 'Due Soon' || item.status === 'Running') return `3 ${item.status}`
  if (item.status === 'Needs Review' || item.status === 'New') return `4 ${item.status}`
  if (item.status === 'Acknowledged' || item.status === 'Escalated') return `5 ${item.status}`
  return `6 ${item.status}`
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function formatLateText(minutesLate: number) {
  if (minutesLate <= 0) return 'Inside active decision window'
  if (minutesLate < 60) return `${minutesLate} minutes overdue`
  if (minutesLate % 1440 === 0) return `${minutesLate / 1440} days overdue`
  if (minutesLate % 60 === 0) return `${minutesLate / 60} hours overdue`
  return `${Math.round(minutesLate / 60)} hours overdue`
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
