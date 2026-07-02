import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  GitBranch,
  ListChecks,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import {
  buildCoverageLedger,
  coverageLedgerBoundaryRule,
  getCoverageLedgerSeverityTone,
  getCoverageLedgerStatusTone,
  getCoverageLedgerTypeTone,
  summarizeCoverageLedger,
  useLocalCoverageLedgerStates,
  type CoverageLedgerEntry,
  type CoverageLedgerEntryType,
  type CoverageLedgerLocalState,
  type CoverageLedgerStatus,
} from '../../lib/ownership/coverageLedger'
import {
  buildNotificationRoutingCenter,
  getRoutingLaneTone,
  useLocalNotificationRoutingStates,
  type RoutingLane,
} from '../../lib/ownership/notificationRouting'
import {
  buildOnCallSchedule,
  useLocalOnCallScheduleStates,
} from '../../lib/ownership/onCallSchedule'
import {
  buildOwnershipSlaQueue,
} from '../../lib/ownership/ownershipSla'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface CoverageLedgerPageProps {
  session: AdminSession
  onOpenRouting?: () => void
  onOpenOnCall?: () => void
  onOpenActionRequests?: () => void
}

const typeFilters: Array<'All' | CoverageLedgerEntryType> = [
  'All',
  'Coverage Gap',
  'Handoff Due',
  'Backup Missing',
  'Routed Work',
  'Action Queue',
  'Local Override',
  'Audit Event',
]
const laneFilters: Array<'All' | RoutingLane> = ['All', 'Executive', 'Support', 'Engineering', 'Finance', 'Client Success', 'Governance', 'Agents']
const statusFilters: Array<'All' | CoverageLedgerStatus> = ['All', 'Open', 'Follow-Up Queued', 'Reviewed', 'Dismissed']

export default function CoverageLedgerPage({
  session,
  onOpenRouting,
  onOpenOnCall,
  onOpenActionRequests,
}: CoverageLedgerPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const users = useManagedInternalAdminUsers(data.internalAdminUsers)
  const [localRoutingStates] = useLocalNotificationRoutingStates()
  const [localOnCallStates] = useLocalOnCallScheduleStates()
  const [localLedgerStates, setLocalLedgerStates] = useLocalCoverageLedgerStates()
  const [selectedId, setSelectedId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | CoverageLedgerEntryType>('All')
  const [laneFilter, setLaneFilter] = useState<'All' | RoutingLane>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | CoverageLedgerStatus>('All')
  const [notice, setNotice] = useState('')
  const canManageLedger = hasPermission(session.role, 'notifications.manage')

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
  const entries = useMemo(() => buildCoverageLedger({
    routes,
    shifts,
    workItems,
    actionRequests,
    auditEvents,
    localStates: localLedgerStates,
  }), [actionRequests, auditEvents, localLedgerStates, routes, shifts, workItems])
  const summary = useMemo(() => summarizeCoverageLedger(entries), [entries])
  const filteredEntries = useMemo(() => entries.filter(entry => {
    if (typeFilter !== 'All' && entry.type !== typeFilter) return false
    if (laneFilter !== 'All' && entry.lane !== laneFilter) return false
    if (statusFilter !== 'All' && entry.status !== statusFilter) return false
    return true
  }), [entries, laneFilter, statusFilter, typeFilter])
  const selectedEntry = filteredEntries.find(entry => entry.id === selectedId)
    ?? entries.find(entry => entry.id === selectedId)
    ?? filteredEntries[0]
    ?? entries[0]
  const canQueueFollowUp = selectedEntry ? hasPermission(session.role, selectedEntry.followUpPermission) : false

  const recordReview = (entry: CoverageLedgerEntry) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: entry.scope,
      actionKey: `coverage_ledger.${sanitizeActionKey(entry.id)}.reviewed.mock`,
      actionLabel: `Reviewed coverage ledger entry: ${entry.title}`,
      severity: severityForAudit(entry),
      metadata: buildLedgerMetadata(entry, {
        localOnly: true,
        mutationApplied: false,
        reviewStatus: 'Reviewed',
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(entry, {
      status: 'Reviewed',
      note: 'Coverage entry reviewed from Coverage Evidence Ledger.',
      reviewedAt: new Date().toISOString(),
    })
    setNotice(`${entry.title} reviewed locally and recorded in Audit Logs.`)
  }

  const queueFollowUp = (entry: CoverageLedgerEntry) => {
    const result = queueAdminActionRequest(session, {
      actionType: entry.followUpActionType,
      title: `Coverage ledger follow-up: ${entry.title}`,
      permission: entry.followUpPermission,
      scope: createAdminActionScope({ label: entry.scope }),
      reason: `${entry.description} Next action: ${entry.nextAction}`,
      rollbackNotes: 'Do not change production alert delivery, customer data, billing, modules, permissions, or client state from the browser. Coverage follow-up must stay server-side, permissioned, and audit-recorded.',
      severity: severityForAudit(entry),
      metadata: buildLedgerMetadata(entry, {
        source: 'coverage_evidence_ledger',
      }),
      handlerKey: `server.coverage_ledger.${sanitizeActionKey(entry.id)}`,
      handlerLabel: `${entry.lane} coverage follow-up handler`,
      handlerDescription: `Server-side placeholder for Coverage Evidence Ledger follow-up: ${entry.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(entry, {
      status: 'Follow-Up Queued',
      note: 'Governed follow-up queued from Coverage Evidence Ledger.',
      followUpRequestId: result.request.id,
    })
    setNotice(`${entry.title} follow-up queued in Action Requests.`)
  }

  const dismissEntry = (entry: CoverageLedgerEntry) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: entry.scope,
      actionKey: `coverage_ledger.${sanitizeActionKey(entry.id)}.dismissed.mock`,
      actionLabel: `Dismissed coverage ledger entry: ${entry.title}`,
      severity: 'notice',
      metadata: buildLedgerMetadata(entry, {
        localOnly: true,
        mutationApplied: false,
        reviewStatus: 'Dismissed',
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(entry, {
      status: 'Dismissed',
      note: 'Coverage entry dismissed locally after review.',
    })
    setNotice(`${entry.title} dismissed locally and recorded in Audit Logs.`)
  }

  const resetEntry = (entry: CoverageLedgerEntry) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: entry.scope,
      actionKey: `coverage_ledger.${sanitizeActionKey(entry.id)}.reset_local.mock`,
      actionLabel: `Reset local coverage ledger state: ${entry.title}`,
      severity: 'notice',
      metadata: buildLedgerMetadata(entry, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalLedgerStates(current => current.filter(state => state.entryId !== entry.id))
    setNotice(`${entry.title} local ledger state reset and recorded in Audit Logs.`)
  }

  const upsertLocalState = (
    entry: CoverageLedgerEntry,
    patch: Omit<CoverageLedgerLocalState, 'entryId' | 'updatedAt'>,
  ) => {
    setLocalLedgerStates(current => [
      {
        entryId: entry.id,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.entryId !== entry.id),
    ])
    setSelectedId(entry.id)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coverage Record"
        title="Coverage Evidence Ledger"
        description="A single operating record for handoffs, routing gaps, owner coverage, action queue pressure, and review evidence."
        action={<StatusPill label={canManageLedger ? 'Local review enabled' : 'Read only'} tone={canManageLedger ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Entries" value={String(summary.open)} delta={`${sourceLabel} plus local review state`} tone={summary.critical ? 'danger' : summary.open ? 'warn' : 'ok'} icon={<BookOpenCheck size={16} />} />
        <MetricCard label="Coverage Gaps" value={String(summary.coverageGaps)} delta={`${summary.backupMissing} backup gaps`} tone={summary.coverageGaps ? 'danger' : summary.backupMissing ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Handoffs Due" value={String(summary.handoffsDue)} delta={`${summary.critical} critical entries`} tone={summary.handoffsDue ? 'warn' : 'neutral'} icon={<Clock3 size={16} />} />
        <MetricCard label="Follow-Ups" value={String(summary.followUps)} delta={`${summary.reviewed} reviewed / ${summary.dismissed} dismissed`} tone={summary.followUps ? 'warn' : 'neutral'} icon={<ListChecks size={16} />} />
      </div>

      <section className="panel coverage-ledger-boundary-panel">
        <div>
          <p className="eyebrow">Evidence Boundary</p>
          <h2>Coverage evidence is visible here; production mutation remains server-side</h2>
          <span>{coverageLedgerBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.total} evidence records`} tone={summary.open ? 'warn' : 'ok'} />
      </section>

      <section className="coverage-ledger-source-grid" aria-label="Coverage ledger type filters">
        {typeFilters.map(type => (
          <button
            key={type}
            className={typeFilter === type ? 'selected' : ''}
            onClick={() => {
              setTypeFilter(type)
              setSelectedId('')
            }}
          >
            <StatusPill label={type} tone={type === 'All' ? 'neutral' : getCoverageLedgerTypeTone(type)} />
            <strong>{type === 'All' ? 'All Evidence' : type}</strong>
            <span>{type === 'All' ? entries.length : entries.filter(entry => entry.type === type).length} records</span>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Coverage ledger filters">
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
            <span>{lane === 'All' ? entries.length : entries.filter(entry => entry.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="timeline-filter-bar" aria-label="Coverage review status filters">
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
            <span>{status === 'All' ? entries.length : entries.filter(entry => entry.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="coverage-ledger-layout">
        <DataTable
          label="Coverage Ledger"
          rows={filteredEntries}
          pageSize={8}
          emptyTitle="No coverage evidence matches the current filters."
          columns={[
            {
              key: 'status',
              header: 'Review',
              sortable: true,
              searchValue: row => reviewSortValue(row),
              render: row => <StatusPill label={row.status} tone={getCoverageLedgerStatusTone(row.status)} />,
            },
            {
              key: 'entry',
              header: 'Evidence',
              sortable: true,
              searchValue: row => `${row.title} ${row.description} ${row.scope}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.type,
              render: row => <StatusPill label={row.type} tone={getCoverageLedgerTypeTone(row.type)} />,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getRoutingLaneTone(row.lane)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => `${row.owner} ${row.backup ?? ''}`,
              render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.backup ? `Backup: ${row.backup}` : 'No backup recorded'}</span></div>,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => `${row.sourceLabel} ${row.sourceStatus}`,
              render: row => <div><strong>{row.sourceLabel}</strong><span className="cell-subtext">{row.sourceStatus}</span></div>,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => `${row.dueAt ?? row.createdAt}`,
              render: row => <div><strong>{row.dueAt ? formatDateTime(row.dueAt) : 'Review'}</strong><span className="cell-subtext">{formatAge(row.createdAt)}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel coverage-ledger-detail-panel">
          {selectedEntry ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Ledger Detail</p>
                  <h2>{selectedEntry.title}</h2>
                </div>
                <StatusPill label={selectedEntry.severity} tone={getCoverageLedgerSeverityTone(selectedEntry.severity)} />
              </div>

              <div className="request-scope-list">
                <div><span>Review</span><strong>{selectedEntry.status}</strong></div>
                <div><span>Type</span><strong>{selectedEntry.type}</strong></div>
                <div><span>Lane</span><strong>{selectedEntry.lane}</strong></div>
                <div><span>Owner</span><strong>{selectedEntry.owner}</strong></div>
                <div><span>Source</span><strong>{selectedEntry.sourceLabel}</strong></div>
                <div><span>Due</span><strong>{selectedEntry.dueAt ? formatDateTime(selectedEntry.dueAt) : 'Review queue'}</strong></div>
              </div>

              <section className={`panel coverage-ledger-status-panel tone-${getCoverageLedgerSeverityTone(selectedEntry.severity)}`}>
                <div>
                  <p className="eyebrow">Next Action</p>
                  <h2>{selectedEntry.nextAction}</h2>
                  <span>{selectedEntry.description}</span>
                </div>
                <div className="coverage-ledger-status-meta">
                  <StatusPill label={selectedEntry.status} tone={getCoverageLedgerStatusTone(selectedEntry.status)} />
                  <strong>{selectedEntry.sourceStatus}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Evidence</h3>
                <div className="settings-rule-list">
                  {selectedEntry.evidence.map(evidence => (
                    <div key={evidence}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Related Record</h3>
                <div className="coverage-ledger-related-grid">
                  <div><span>Route</span><strong>{selectedEntry.routeId ?? 'None'}</strong></div>
                  <div><span>Shift</span><strong>{selectedEntry.shiftId ?? 'None'}</strong></div>
                  <div><span>Work Item</span><strong>{selectedEntry.workItemId ?? 'None'}</strong></div>
                  <div><span>Action Request</span><strong>{selectedEntry.actionRequestId ?? 'None'}</strong></div>
                  <div><span>Audit Event</span><strong>{selectedEntry.auditEventId ?? 'None'}</strong></div>
                  <div><span>Local Review</span><strong>{selectedEntry.localState?.updatedAt ? formatDateTime(selectedEntry.localState.updatedAt) : 'None'}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canManageLedger} onClick={() => recordReview(selectedEntry)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" disabled={!canQueueFollowUp} onClick={() => queueFollowUp(selectedEntry)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canManageLedger} onClick={() => dismissEntry(selectedEntry)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Dismiss Entry
                  </button>
                  <button className="ghost-action" disabled={!canManageLedger} onClick={() => resetEntry(selectedEntry)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenOnCall && (
                    <button className="ghost-action" onClick={onOpenOnCall}>
                      <TimerReset size={15} strokeWidth={1.8} />
                      On-Call Schedule
                    </button>
                  )}
                  {onOpenRouting && (
                    <button className="ghost-action" onClick={onOpenRouting}>
                      <RadioTower size={15} strokeWidth={1.8} />
                      Routing Center
                    </button>
                  )}
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <GitBranch size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canManageLedger && <p className="warning-copy">Coverage ledger review requires notifications.manage.</p>}
                {!canQueueFollowUp && <p className="warning-copy">Follow-up queueing requires {selectedEntry.followUpPermission}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No coverage evidence selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildLedgerMetadata(entry: CoverageLedgerEntry, extra: Record<string, unknown>) {
  return {
    entryId: entry.id,
    entryType: entry.type,
    lane: entry.lane,
    severity: entry.severity,
    reviewStatus: entry.status,
    scope: entry.scope,
    sourceLabel: entry.sourceLabel,
    sourceStatus: entry.sourceStatus,
    routeId: entry.routeId,
    shiftId: entry.shiftId,
    workItemId: entry.workItemId,
    actionRequestId: entry.actionRequestId,
    auditEventId: entry.auditEventId,
    ...extra,
  }
}

function severityForAudit(entry: CoverageLedgerEntry) {
  if (entry.severity === 'Critical') return 'critical' as const
  if (entry.severity === 'Warning') return 'warning' as const
  return 'notice' as const
}

function reviewSortValue(entry: CoverageLedgerEntry) {
  if (entry.status === 'Open') return `0 ${entry.status}`
  if (entry.status === 'Follow-Up Queued') return `1 ${entry.status}`
  if (entry.status === 'Reviewed') return `2 ${entry.status}`
  return `3 ${entry.status}`
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

function formatAge(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown age'
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 60) return `${minutes}m old`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h old`
  return `${Math.round(hours / 24)}d old`
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
