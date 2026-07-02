import { AlarmClock, CheckCircle2, Clock3, Eye, GitBranch, ListChecks, RotateCcw, ShieldAlert, TimerReset, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import {
  buildSlaEscalationBoard,
  formatSlaDuration,
  getSlaLevelTone,
  getSlaReviewTone,
  getSlaStatusTone,
  slaEscalationBoundaryRule,
  summarizeSlaEscalationBoard,
  useLocalSlaEscalationStates,
  type SlaEscalationItem,
  type SlaEscalationReviewStatus,
} from '../../lib/watch-center/slaEscalations'
import {
  buildWatchSignals,
  getWatchPriorityTone,
  getWatchSensitivityTone,
  type WatchSignalOwner,
  type WatchTargetPage,
} from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'
import { useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'

interface SlaEscalationBoardPageProps {
  session: AdminSession
  onOpenTarget?: (page: WatchTargetPage) => void
  onOpenActionRequests?: () => void
}

const ownerFilters: Array<'All' | WatchSignalOwner> = ['All', 'Owner', 'Admin Ops', 'Support', 'Engineering', 'Finance', 'Client Success', 'Security']

export default function SlaEscalationBoardPage({ session, onOpenTarget, onOpenActionRequests }: SlaEscalationBoardPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAuditEvents = useLocalAuditEvents()
  const [localSavedViews] = useLocalSavedViews()
  const [localWatchStates] = useLocalWatchSignalStates()
  const [localRuleStates] = useLocalWatchRuleStates()
  const [localPlaybookStates] = useLocalResponsePlaybookStates()
  const [localSlaStates, setLocalSlaStates] = useLocalSlaEscalationStates()
  const [selectedId, setSelectedId] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'All' | WatchSignalOwner>('All')
  const [notice, setNotice] = useState('')
  const canManageSla = hasPermission(session.role, 'notifications.manage')

  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const savedViews = useMemo(() => [
    ...localSavedViews,
    ...savedViewTemplates.filter(template => !localSavedViews.some(localView => localView.id === template.id)),
  ], [localSavedViews])

  const signals = useMemo(() => buildWatchSignals({
    data,
    actionRequests,
    auditEvents,
    savedViews,
    localStates: localWatchStates,
  }), [actionRequests, auditEvents, data, localWatchStates, savedViews])
  const rules = useMemo(() => buildWatchRules(localRuleStates), [localRuleStates])
  const playbooks = useMemo(() => buildResponsePlaybooks(localPlaybookStates), [localPlaybookStates])
  const items = useMemo(() => buildSlaEscalationBoard({
    signals,
    rules,
    playbooks,
    localStates: localSlaStates,
  }), [localPlaybookStates, localRuleStates, localSlaStates, playbooks, rules, signals])
  const summary = useMemo(() => summarizeSlaEscalationBoard(items), [items])
  const ownerCounts = useMemo(() => {
    const counts = new Map<WatchSignalOwner, number>()
    items.forEach(item => counts.set(item.owner, (counts.get(item.owner) ?? 0) + 1))
    return counts
  }, [items])
  const filteredItems = useMemo(() => ownerFilter === 'All'
    ? items
    : items.filter(item => item.owner === ownerFilter),
  [items, ownerFilter])
  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? items.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? items[0]
  const canOpenSelected = selectedItem ? hasPermission(session.role, selectedItem.permission) : false
  const canQueueSelected = Boolean(selectedItem?.handoffActionType && selectedItem.handoffPermission && hasPermission(session.role, selectedItem.handoffPermission))

  const updateReviewState = (item: SlaEscalationItem, reviewStatus: SlaEscalationReviewStatus, note: string) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: item.title,
      actionKey: `sla_board.${sanitizeActionKey(item.id)}.${reviewStatus.toLowerCase()}.mock`,
      actionLabel: `${reviewStatus} SLA item: ${item.title}`,
      severity: reviewStatus === 'Escalated' || item.status === 'Overdue' ? 'warning' : 'notice',
      metadata: buildSlaMetadata(item, {
        reviewStatus,
        note,
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalSlaStates(current => [
      {
        itemId: item.id,
        reviewStatus,
        note,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.itemId !== item.id),
    ])
    setNotice(`${item.title} marked ${reviewStatus.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetReviewState = (item: SlaEscalationItem) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: item.title,
      actionKey: `sla_board.${sanitizeActionKey(item.id)}.reset_local.mock`,
      actionLabel: `Reset local SLA item review: ${item.title}`,
      severity: 'notice',
      metadata: buildSlaMetadata(item, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalSlaStates(current => current.filter(state => state.itemId !== item.id))
    setNotice(`${item.title} reset to open review state and recorded in Audit Logs.`)
  }

  const openTargetWorkspace = (item: SlaEscalationItem) => {
    const result = runAdminAction(session, {
      permission: item.permission,
      scope: item.title,
      actionKey: `sla_board.${sanitizeActionKey(item.id)}.opened_target.mock`,
      actionLabel: `Opened target workspace for SLA item: ${item.title}`,
      severity: item.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildSlaMetadata(item, {
        targetPage: item.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${item.title} target opened in ${item.targetLabel}.`)
    onOpenTarget?.(item.targetPage)
  }

  const queueHandoff = (item: SlaEscalationItem) => {
    if (!item.handoffActionType || !item.handoffPermission) {
      setNotice(`${item.title} does not have an action-request handoff contract.`)
      return
    }

    const result = queueAdminActionRequest(session, {
      actionType: item.handoffActionType,
      title: `${item.title} SLA escalation handoff`,
      permission: item.handoffPermission,
      scope: createAdminActionScope({ label: item.title }),
      reason: `${item.title} requires governed escalation from the SLA Board. Production changes must run through the server-side handler with audit and rollback metadata.`,
      rollbackNotes: item.rollbackNotes ?? 'Keep the source item unchanged if escalation handoff cannot be completed.',
      severity: item.sensitivity === 'Restricted' || item.status === 'Overdue' ? 'warning' : 'notice',
      metadata: buildSlaMetadata(item, {
        handoffRequired: item.actionHandoffRequired,
        source: 'sla_board',
      }),
      handlerKey: item.handoffHandlerKey,
      handlerLabel: `${item.title} SLA handler`,
      handlerDescription: `Server-side placeholder for SLA escalation: ${item.title}.`,
    })

    setNotice(result.ok ? `${item.title} handoff queued in Action Requests.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="SLA Command"
        title="SLA & Escalation Board"
        description="Owner, due-time, escalation, and handoff view across watch items, rules, and response playbooks."
        action={<StatusPill label={canManageSla ? 'Local review enabled' : 'Read only'} tone={canManageSla ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="SLA Items" value={String(summary.total)} delta={`${sourceLabel} plus local policy`} tone="neutral" icon={<TimerReset size={16} />} />
        <MetricCard label="Overdue" value={String(summary.overdue)} delta="Past review window" tone={summary.overdue ? 'danger' : 'ok'} icon={<AlarmClock size={16} />} />
        <MetricCard label="Due Soon" value={String(summary.dueSoon)} delta="Inside warning window" tone={summary.dueSoon ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Needs Review" value={String(summary.needsReview)} delta="Policy or playbook review" tone={summary.needsReview ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Action Handoffs" value={String(summary.actionHandoffs)} delta="Can queue requests" tone={summary.actionHandoffs ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
        <MetricCard label="Executive Review" value={String(summary.executiveReview)} delta="Owner-visible escalations" tone={summary.executiveReview ? 'danger' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Reviewed" value={String(summary.reviewed)} delta="Local operator review" tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Paused" value={String(summary.paused)} delta="Snoozed or locally paused" tone={summary.paused ? 'neutral' : 'ok'} icon={<UsersRound size={16} />} />
      </div>

      <section className="panel sla-board-boundary-panel">
        <div>
          <p className="eyebrow">SLA Boundary</p>
          <h2>The board coordinates ownership and handoff readiness</h2>
          <span>{slaEscalationBoundaryRule}</span>
        </div>
        <StatusPill label="No production mutation" tone="ok" />
      </section>

      <div className="timeline-filter-bar" aria-label="SLA owner filters">
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
            <span>{owner === 'All' ? items.length : ownerCounts.get(owner) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sla-board-layout">
        <DataTable
          label="SLA Queue"
          rows={filteredItems}
          pageSize={10}
          emptyTitle="No SLA items match this owner."
          columns={[
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.itemType,
              render: row => <StatusPill label={row.itemType} tone={itemTypeTone(row.itemType)} />,
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
              header: 'SLA',
              sortable: true,
              searchValue: row => statusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getSlaStatusTone(row.status)} />,
            },
            {
              key: 'level',
              header: 'Level',
              sortable: true,
              searchValue: row => row.level,
              render: row => <StatusPill label={row.level} tone={getSlaLevelTone(row.level)} />,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => row.dueAt,
              render: row => <span className={row.status === 'Overdue' ? 'danger-copy' : undefined}>{formatDateTime(row.dueAt)}</span>,
            },
            {
              key: 'review',
              header: 'Review',
              sortable: true,
              searchValue: row => row.reviewStatus,
              render: row => <StatusPill label={row.reviewStatus} tone={getSlaReviewTone(row.reviewStatus)} />,
            },
          ]}
        />

        <aside className="detail-panel sla-board-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">SLA Detail</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <StatusPill label={selectedItem.status} tone={getSlaStatusTone(selectedItem.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Type</span><strong>{selectedItem.itemType}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Priority</span><strong>{selectedItem.priority}</strong></div>
                <div><span>Level</span><strong>{selectedItem.level}</strong></div>
                <div><span>SLA</span><strong>{formatSlaDuration(selectedItem.slaMinutes)}</strong></div>
                <div><span>Target</span><strong>{selectedItem.targetLabel}</strong></div>
              </div>

              <section className={`panel sla-board-status-panel tone-${selectedItem.status === 'Overdue' ? 'danger' : selectedItem.status === 'Due Soon' || selectedItem.status === 'Needs Review' ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">SLA Progress</p>
                  <h2>{selectedItem.description}</h2>
                  <span>{formatRemaining(selectedItem.minutesRemaining)} / {selectedItem.scope}</span>
                </div>
                <div className="sla-board-status-meta">
                  <StatusPill label={selectedItem.sensitivity} tone={getWatchSensitivityTone(selectedItem.sensitivity)} />
                  <strong>{selectedItem.progress}% elapsed</strong>
                </div>
              </section>

              <div className="sla-progress-shell" aria-label="SLA progress">
                <span style={{ width: `${selectedItem.progress}%` }} />
              </div>

              <div className="detail-section">
                <h3>Escalation Path</h3>
                <div className="watch-rule-escalation-list">
                  {selectedItem.escalationSteps.map(step => (
                    <div key={`${step.label}-${step.owner}-${step.dueAt}`}>
                      <span>{formatDateTime(step.dueAt)}</span>
                      <strong>{step.owner} / {step.label}</strong>
                      <p>{step.action}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedItem.evidence.map(item => (
                    <div key={item}><Eye size={16} strokeWidth={1.8} /><strong>{item}</strong></div>
                  ))}
                </div>
              </div>

              {selectedItem.localNote && (
                <div className="detail-section">
                  <h3>Local Note</h3>
                  <p className="muted-copy">{selectedItem.localNote}</p>
                </div>
              )}

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canOpenSelected}
                    onClick={() => openTargetWorkspace(selectedItem)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageSla}
                    onClick={() => updateReviewState(selectedItem, 'Reviewed', 'Reviewed from SLA Board.')}
                  >
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageSla}
                    onClick={() => updateReviewState(selectedItem, 'Escalated', 'Escalated for owner review from SLA Board.')}
                  >
                    <ShieldAlert size={15} strokeWidth={1.8} />
                    Escalate Owner
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageSla}
                    onClick={() => resetReviewState(selectedItem)}
                  >
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canQueueSelected}
                    onClick={() => queueHandoff(selectedItem)}
                  >
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Handoff
                  </button>
                  <button className="ghost-action" onClick={onOpenActionRequests}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Action Requests
                  </button>
                  <span className="muted-copy">Reviews and handoffs are audit-recorded. Production changes still require server-side handlers.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No SLA item selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildSlaMetadata(item: SlaEscalationItem, extra: Record<string, unknown>) {
  return {
    slaItemId: item.id,
    title: item.title,
    itemType: item.itemType,
    owner: item.owner,
    priority: item.priority,
    status: item.status,
    level: item.level,
    targetPage: item.targetPage,
    sourceId: item.sourceId,
    slaMinutes: item.slaMinutes,
    dueAt: item.dueAt,
    actionHandoffRequired: item.actionHandoffRequired,
    ...extra,
  }
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_')
}

function itemTypeTone(type: SlaEscalationItem['itemType']) {
  if (type === 'Watch Signal') return 'warn' as const
  if (type === 'Watch Rule') return 'info' as const
  return 'ok' as const
}

function statusSortValue(status: SlaEscalationItem['status']) {
  if (status === 'Overdue') return '0 Overdue'
  if (status === 'Due Soon') return '1 Due Soon'
  if (status === 'Needs Review') return '2 Needs Review'
  if (status === 'On Track') return '3 On Track'
  if (status === 'Acknowledged') return '4 Acknowledged'
  return '5 Paused'
}

function formatRemaining(minutes: number) {
  if (minutes < 0) return `${formatSlaDuration(Math.abs(minutes))} overdue`
  if (minutes === 0) return 'Due now'
  return `${formatSlaDuration(minutes)} remaining`
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
