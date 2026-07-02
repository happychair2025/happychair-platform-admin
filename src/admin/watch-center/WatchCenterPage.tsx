import { BellRing, Clock3, Eye, FolderOpen, ListChecks, PauseCircle, RotateCcw, ShieldAlert, ShieldCheck, Siren } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { hasPermission } from '../../lib/permissions/permissions'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import {
  buildWatchSignals,
  getWatchPriorityTone,
  getWatchSensitivityTone,
  getWatchSourceTone,
  getWatchStatusTone,
  summarizeWatchSignals,
  useLocalWatchSignalStates,
  watchCenterBoundaryRule,
  type WatchSignal,
  type WatchSignalSource,
  type WatchSignalStatus,
  type WatchTargetPage,
} from '../../lib/watch-center/watchCenter'

interface WatchCenterPageProps {
  session: AdminSession
  onOpenTarget?: (page: WatchTargetPage) => void
}

const sourceFilters: Array<'All' | WatchSignalSource> = ['All', 'Support', 'Billing', 'Health', 'Action Requests', 'Audit', 'Saved Views', 'Usage']

export default function WatchCenterPage({ session, onOpenTarget }: WatchCenterPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAuditEvents = useLocalAuditEvents()
  const [localSavedViews] = useLocalSavedViews()
  const [localStates, setLocalStates] = useLocalWatchSignalStates()
  const [selectedId, setSelectedId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | WatchSignalSource>('All')
  const [notice, setNotice] = useState('')
  const canManageWatch = hasPermission(session.role, 'notifications.manage')

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
    localStates,
  }), [actionRequests, auditEvents, data, localStates, savedViews])
  const summary = useMemo(() => summarizeWatchSignals(signals), [signals])
  const sourceCounts = useMemo(() => {
    const counts = new Map<WatchSignalSource, number>()
    signals.forEach(signal => counts.set(signal.source, (counts.get(signal.source) ?? 0) + 1))
    return counts
  }, [signals])
  const filteredSignals = useMemo(() => sourceFilter === 'All'
    ? signals
    : signals.filter(signal => signal.source === sourceFilter),
  [signals, sourceFilter])
  const selectedSignal = filteredSignals.find(signal => signal.id === selectedId)
    ?? signals.find(signal => signal.id === selectedId)
    ?? filteredSignals[0]
    ?? signals[0]
  const canOpenSelected = selectedSignal ? hasPermission(session.role, selectedSignal.permission) : false

  const updateSignalState = (signal: WatchSignal, status: WatchSignalStatus, note: string, snoozeHours?: number) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: signal.scope,
      actionKey: `watch_center.${sanitizeActionKey(signal.id)}.${status.toLowerCase()}.mock`,
      actionLabel: `${status} watch signal: ${signal.title}`,
      severity: signal.priority === 'Critical' ? 'warning' : 'notice',
      metadata: buildWatchSignalMetadata(signal, {
        watchStatus: status,
        note,
        snoozeHours,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => [
      {
        signalId: signal.id,
        status,
        note,
        snoozedUntil: snoozeHours ? new Date(Date.now() + snoozeHours * 60 * 60 * 1000).toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.signalId !== signal.id),
    ])
    setNotice(`${signal.title} marked ${status.toLowerCase()} and recorded in Audit Logs.`)
  }

  const resetSignalState = (signal: WatchSignal) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: signal.scope,
      actionKey: `watch_center.${sanitizeActionKey(signal.id)}.reset_local.mock`,
      actionLabel: `Reset local watch state: ${signal.title}`,
      severity: 'notice',
      metadata: buildWatchSignalMetadata(signal, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => current.filter(state => state.signalId !== signal.id))
    setNotice(`${signal.title} reset to new and recorded in Audit Logs.`)
  }

  const openWorkspace = (signal: WatchSignal) => {
    const result = runAdminAction(session, {
      permission: signal.permission,
      scope: signal.scope,
      actionKey: `watch_center.${sanitizeActionKey(signal.id)}.opened.mock`,
      actionLabel: `Opened watch signal workspace: ${signal.title}`,
      severity: signal.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildWatchSignalMetadata(signal, {
        targetPage: signal.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${signal.title} opened in ${targetPageLabels[signal.targetPage]}.`)
    onOpenTarget?.(signal.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Command Inbox"
        title="Watch Center"
        description="Unified operating inbox for support, billing, health, action requests, audit activity, saved views, and usage watches."
        action={<StatusPill label={canManageWatch ? 'Local watch state enabled' : 'Read only'} tone={canManageWatch ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Watch Items" value={String(summary.total)} delta={`${sourceLabel} plus local ledgers`} tone="neutral" icon={<BellRing size={16} />} />
        <MetricCard label="Critical" value={String(summary.critical)} delta="Needs owner review" tone={summary.critical ? 'danger' : 'ok'} icon={<Siren size={16} />} />
        <MetricCard label="High" value={String(summary.high)} delta="Operational urgency" tone={summary.high ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="New" value={String(summary.new)} delta="No local action yet" tone={summary.new ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Acknowledged" value={String(summary.acknowledged)} delta="Reviewed locally" tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Snoozed" value={String(summary.snoozed)} delta="Temporarily hidden urgency" tone={summary.snoozed ? 'neutral' : 'ok'} icon={<PauseCircle size={16} />} />
        <MetricCard label="Restricted" value={String(summary.restricted)} delta="Sensitive operating context" tone={summary.restricted ? 'warn' : 'ok'} icon={<Eye size={16} />} />
        <MetricCard label="Overdue" value={String(summary.overdue)} delta="Past review window" tone={summary.overdue ? 'danger' : 'ok'} icon={<Clock3 size={16} />} />
      </div>

      <section className="panel watch-boundary-panel">
        <div>
          <p className="eyebrow">Watch Boundary</p>
          <h2>Watch Center coordinates attention, not production state</h2>
          <span>{watchCenterBoundaryRule}</span>
        </div>
        <StatusPill label="Local state only" tone="ok" />
      </section>

      <div className="timeline-filter-bar" aria-label="Watch signal sources">
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
            <span>{source === 'All' ? signals.length : sourceCounts.get(source) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="watch-center-layout">
        <DataTable
          label="Watch Queue"
          rows={filteredSignals}
          pageSize={10}
          emptyTitle="No watch items match this source."
          columns={[
            {
              key: 'signal',
              header: 'Signal',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope}`,
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
              render: row => <StatusPill label={row.source} tone={getWatchSourceTone(row.source)} />,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getWatchPriorityTone(row.priority)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getWatchStatusTone(row.status)} />,
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
              render: row => (
                <span className={isOverdue(row) && row.status !== 'Snoozed' ? 'danger-copy' : undefined}>
                  {formatDateTime(row.dueAt)}
                </span>
              ),
            },
            {
              key: 'sensitivity',
              header: 'Sensitivity',
              sortable: true,
              searchValue: row => row.sensitivity,
              render: row => <StatusPill label={row.sensitivity} tone={getWatchSensitivityTone(row.sensitivity)} />,
            },
          ]}
        />

        <aside className="detail-panel watch-detail-panel">
          {selectedSignal ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Watch Detail</p>
                  <h2>{selectedSignal.title}</h2>
                </div>
                <StatusPill label={selectedSignal.priority} tone={getWatchPriorityTone(selectedSignal.priority)} />
              </div>

              <div className="request-scope-list">
                <div><span>Source</span><strong>{selectedSignal.source}</strong></div>
                <div><span>Owner</span><strong>{selectedSignal.owner}</strong></div>
                <div><span>Scope</span><strong>{selectedSignal.scope}</strong></div>
                <div><span>Status</span><strong>{selectedSignal.status}</strong></div>
                <div><span>Detected</span><strong>{formatDateTime(selectedSignal.detectedAt)}</strong></div>
                <div><span>Target</span><strong>{targetPageLabels[selectedSignal.targetPage]}</strong></div>
              </div>

              <section className={`panel watch-status-panel tone-${isOverdue(selectedSignal) && selectedSignal.status !== 'Snoozed' ? 'danger' : selectedSignal.status === 'New' ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Operating Signal</p>
                  <h2>{selectedSignal.description}</h2>
                  <span>{selectedSignal.recommendedAction}</span>
                </div>
                <div className="watch-status-meta">
                  <StatusPill label={selectedSignal.status} tone={getWatchStatusTone(selectedSignal.status)} />
                  <strong>{selectedSignal.snoozedUntil ? `Snoozed until ${formatDateTime(selectedSignal.snoozedUntil)}` : `Due ${formatDateTime(selectedSignal.dueAt)}`}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedSignal.evidence.map(item => (
                    <div key={item}>
                      <FolderOpen size={16} strokeWidth={1.8} />
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSignal.localNote && (
                <div className="detail-section">
                  <h3>Local Note</h3>
                  <p className="muted-copy">{selectedSignal.localNote}</p>
                </div>
              )}

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canOpenSelected}
                    onClick={() => openWorkspace(selectedSignal)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Open Workspace
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageWatch}
                    onClick={() => updateSignalState(selectedSignal, 'Acknowledged', 'Reviewed from Watch Center.')}
                  >
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Acknowledge
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageWatch}
                    onClick={() => updateSignalState(selectedSignal, 'Snoozed', 'Snoozed for 24 hours from Watch Center.', 24)}
                  >
                    <PauseCircle size={15} strokeWidth={1.8} />
                    Snooze 24h
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageWatch}
                    onClick={() => resetSignalState(selectedSignal)}
                  >
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset
                  </button>
                  <span className="muted-copy">Actions record audit events and update local watch state only.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No watch signal selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

const targetPageLabels: Record<WatchTargetPage, string> = {
  attention: 'Attention Queue',
  support: 'Support Center',
  revenue: 'Revenue',
  health: 'Client Health',
  'action-requests': 'Action Requests',
  audit: 'Audit Logs',
  'saved-views': 'Saved Views',
  'data-quality': 'Data Quality',
  usage: 'Usage Analytics',
}

function buildWatchSignalMetadata(signal: WatchSignal, extra: Record<string, unknown>) {
  return {
    watchSignalId: signal.id,
    source: signal.source,
    priority: signal.priority,
    status: signal.status,
    owner: signal.owner,
    scope: signal.scope,
    targetPage: signal.targetPage,
    sourceRecordId: signal.sourceRecordId,
    sensitivity: signal.sensitivity,
    recommendedAction: signal.recommendedAction,
    ...extra,
  }
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_')
}

function prioritySortValue(priority: WatchSignal['priority']) {
  if (priority === 'Critical') return '0 Critical'
  if (priority === 'High') return '1 High'
  if (priority === 'Medium') return '2 Medium'
  return '3 Low'
}

function isOverdue(signal: WatchSignal) {
  const dueTime = new Date(signal.dueAt).getTime()
  return !Number.isNaN(dueTime) && dueTime < Date.now()
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
