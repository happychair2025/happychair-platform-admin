import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  PauseCircle,
  PlayCircle,
  RotateCcw,
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
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { useLocalCommandBriefSnapshots } from '../../lib/command-digest/briefArchive'
import {
  buildDigestReviewCadence,
  digestReviewCadenceBoundaryRule,
  formatDigestReviewTime,
  formatDigestReviewWindow,
  getDigestReviewFrequencyTone,
  getDigestReviewRequirementTone,
  getDigestReviewWindowTone,
  summarizeDigestReviewCadence,
  useLocalDigestReviewCadenceStates,
  type DigestReviewCadenceLocalState,
  type DigestReviewWindow,
} from '../../lib/command-digest/reviewCadence'
import { hasPermission } from '../../lib/permissions/permissions'

interface DigestReviewCadencePageProps {
  session: AdminSession
  onOpenBriefArchive?: () => void
  onOpenActionRequests?: () => void
}

const ownerFilters = ['All', 'Owner', 'Admin', 'Finance', 'Support Lead', 'Engineering', 'Admin Ops'] as const

export default function DigestReviewCadencePage({ session, onOpenBriefArchive, onOpenActionRequests }: DigestReviewCadencePageProps) {
  const [snapshots] = useLocalCommandBriefSnapshots()
  const [localStates, setLocalStates] = useLocalDigestReviewCadenceStates()
  const [selectedId, setSelectedId] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<typeof ownerFilters[number]>('All')
  const [notice, setNotice] = useState('')

  const windows = useMemo(() => buildDigestReviewCadence({ snapshots, localStates }), [localStates, snapshots])
  const summary = useMemo(() => summarizeDigestReviewCadence(windows), [windows])
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    windows.forEach(window => counts.set(window.rule.owner, (counts.get(window.rule.owner) ?? 0) + 1))
    return counts
  }, [windows])
  const filteredWindows = useMemo(() => ownerFilter === 'All'
    ? windows
    : windows.filter(window => window.rule.owner === ownerFilter || window.rule.backupOwner === ownerFilter),
  [ownerFilter, windows])
  const selectedWindow = filteredWindows.find(window => window.id === selectedId)
    ?? windows.find(window => window.id === selectedId)
    ?? filteredWindows[0]
    ?? windows[0]
  const canQueueSelected = selectedWindow ? hasPermission(session.role, selectedWindow.rule.followUpPermission) : false

  const upsertLocalState = (ruleId: string, patch: Partial<DigestReviewCadenceLocalState>) => {
    setLocalStates(current => [
      {
        ruleId,
        updatedAt: new Date().toISOString(),
        ...current.find(state => state.ruleId === ruleId),
        ...patch,
      },
      ...current.filter(state => state.ruleId !== ruleId),
    ])
  }

  const acknowledgeWindow = (window: DigestReviewWindow) => {
    const result = runAdminAction(session, {
      permission: window.rule.permission,
      scope: window.rule.name,
      actionKey: `digest_review_cadence.${sanitizeActionKey(window.rule.id)}.acknowledged.mock`,
      actionLabel: `Acknowledged digest review cadence: ${window.rule.name}`,
      severity: window.status === 'Escalation Ready' || window.status === 'Missed' ? 'warning' : 'notice',
      metadata: buildCadenceMetadata(window, {
        reviewStatus: 'Acknowledged',
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(window.rule.id, {
      lastAcknowledgedAt: new Date().toISOString(),
      lastSnapshotId: window.latestSnapshot?.id,
      note: 'Review acknowledged locally.',
    })
    setSelectedId(window.id)
    setNotice(`${window.rule.name} acknowledged locally and recorded in Audit Logs.`)
  }

  const toggleRuleStatus = (window: DigestReviewWindow) => {
    const nextStatus = window.rule.status === 'Paused' ? 'Active' : 'Paused'
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: window.rule.name,
      actionKey: `digest_review_cadence.${sanitizeActionKey(window.rule.id)}.${nextStatus.toLowerCase()}.mock`,
      actionLabel: `${nextStatus} local digest review cadence: ${window.rule.name}`,
      severity: nextStatus === 'Paused' ? 'warning' : 'notice',
      metadata: buildCadenceMetadata(window, {
        nextStatus,
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(window.rule.id, {
      status: nextStatus,
      note: `${nextStatus} locally from Review Cadence.`,
    })
    setSelectedId(window.id)
    setNotice(`${window.rule.name} ${nextStatus.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetRuleState = (window: DigestReviewWindow) => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: window.rule.name,
      actionKey: `digest_review_cadence.${sanitizeActionKey(window.rule.id)}.reset_local.mock`,
      actionLabel: `Reset local digest review cadence state: ${window.rule.name}`,
      severity: 'notice',
      metadata: buildCadenceMetadata(window, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => current.filter(state => state.ruleId !== window.rule.id))
    setSelectedId(window.id)
    setNotice(`${window.rule.name} local cadence state reset and recorded in Audit Logs.`)
  }

  const queueEscalation = (window: DigestReviewWindow) => {
    const result = queueAdminActionRequest(session, {
      actionType: window.rule.followUpActionType,
      title: `Digest review cadence escalation: ${window.rule.name}`,
      permission: window.rule.followUpPermission,
      scope: createAdminActionScope({ label: window.rule.name }),
      reason: `${window.rule.name} is ${window.status}. Required action: ${window.requiredAction}`,
      rollbackNotes: 'No production state changes from Review Cadence. The follow-up must remain governed by Admin Action Request approval and server-side handler validation.',
      severity: window.status === 'Escalation Ready' || window.status === 'Missed' ? 'warning' : 'notice',
      metadata: buildCadenceMetadata(window, {
        source: 'digest_review_cadence',
      }),
      handlerKey: `server.digest_review_cadence.${window.rule.id}`,
      handlerLabel: `${window.rule.owner} cadence escalation handler`,
      handlerDescription: `Server-side placeholder for missed digest review cadence: ${window.rule.name}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    upsertLocalState(window.rule.id, {
      note: `Escalation queued as ${result.request.id}.`,
    })
    setSelectedId(window.id)
    setNotice(`${window.rule.name} escalation queued in Action Requests.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Review Cadence"
        title="Digest Review Cadence"
        description="Daily and weekly review windows for Command Digest ownership, acknowledgement, missed-review escalation, and executive archive discipline."
        action={<StatusPill label={`${summary.active} active windows`} tone={summary.active ? 'info' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Due Today" value={String(summary.dueToday)} delta="Inside active review window" tone={summary.dueToday ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Escalation Ready" value={String(summary.escalationReady)} delta="Missed beyond escalation buffer" tone={summary.escalationReady ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Acknowledged" value={String(summary.acknowledged)} delta="Satisfied by snapshot or local review" tone={summary.acknowledged ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Next Review" value={summary.nextReviewAt ? formatDigestReviewTime(summary.nextReviewAt) : 'None'} delta={`${summary.exportReadyRequired} export-ready requirements`} tone="neutral" icon={<CalendarClock size={16} />} />
      </div>

      <section className="panel digest-cadence-boundary-panel">
        <div>
          <p className="eyebrow">Scheduler Boundary</p>
          <h2>Cadence schedules review; Action Requests control escalation</h2>
          <span>{digestReviewCadenceBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.paused} paused`} tone={summary.paused ? 'warn' : 'ok'} />
      </section>

      <section className="digest-cadence-window-grid" aria-label="Review cadence status">
        {windows.map(window => (
          <button
            key={window.id}
            className={selectedWindow?.id === window.id ? 'selected' : ''}
            onClick={() => setSelectedId(window.id)}
          >
            <StatusPill label={window.status} tone={getDigestReviewWindowTone(window.status)} />
            <strong>{window.rule.name}</strong>
            <span>{window.rule.owner}</span>
            <small>{formatDigestReviewWindow(window.rule)}</small>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Cadence owner filters">
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
            <span>{owner === 'All' ? windows.length : ownerCounts.get(owner) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="digest-cadence-layout">
        <DataTable
          label="Review Windows"
          rows={filteredWindows}
          pageSize={8}
          emptyTitle="No review windows match this owner."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => cadenceSortValue(row),
              render: row => <StatusPill label={row.status} tone={getDigestReviewWindowTone(row.status)} />,
            },
            {
              key: 'window',
              header: 'Window',
              sortable: true,
              searchValue: row => `${row.rule.name} ${row.rule.description}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.rule.name}
                </button>
              ),
            },
            {
              key: 'frequency',
              header: 'Cadence',
              sortable: true,
              searchValue: row => row.rule.frequency,
              render: row => <StatusPill label={row.rule.frequency} tone={getDigestReviewFrequencyTone(row.rule.frequency)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => `${row.rule.owner} ${row.rule.backupOwner}`,
              render: row => <div><strong>{row.rule.owner}</strong><span className="cell-subtext">Backup: {row.rule.backupOwner}</span></div>,
            },
            {
              key: 'requirement',
              header: 'Required',
              sortable: true,
              searchValue: row => row.rule.requiredSnapshotStatus,
              render: row => <StatusPill label={row.rule.requiredSnapshotStatus} tone={getDigestReviewRequirementTone(row.rule.requiredSnapshotStatus)} />,
            },
            {
              key: 'due',
              header: 'Due',
              sortable: true,
              searchValue: row => row.dueAt,
              render: row => <div><strong>{formatDigestReviewTime(row.dueAt)}</strong><span className="cell-subtext">{row.satisfiedBy}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel digest-cadence-detail-panel">
          {selectedWindow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Cadence Detail</p>
                  <h2>{selectedWindow.rule.name}</h2>
                </div>
                <StatusPill label={selectedWindow.status} tone={getDigestReviewWindowTone(selectedWindow.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Owner</span><strong>{selectedWindow.rule.owner}</strong></div>
                <div><span>Backup</span><strong>{selectedWindow.rule.backupOwner}</strong></div>
                <div><span>Due</span><strong>{formatDigestReviewTime(selectedWindow.dueAt)}</strong></div>
                <div><span>Next</span><strong>{formatDigestReviewTime(selectedWindow.nextWindowAt)}</strong></div>
              </div>

              <section className={`panel digest-cadence-status-panel tone-${getDigestReviewWindowTone(selectedWindow.status)}`}>
                <div>
                  <p className="eyebrow">Review Requirement</p>
                  <h2>{selectedWindow.requiredAction}</h2>
                  <span>{selectedWindow.rule.description}</span>
                </div>
                <div className="digest-cadence-status-meta">
                  <StatusPill label={selectedWindow.rule.requiredSnapshotStatus} tone={getDigestReviewRequirementTone(selectedWindow.rule.requiredSnapshotStatus)} />
                  <strong>{formatDigestReviewWindow(selectedWindow.rule)}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Cadence Evidence</h3>
                <div className="settings-rule-list">
                  {selectedWindow.rule.evidence.map(evidence => (
                    <div key={evidence}>
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-rule-list">
                <div>
                  <FileText size={16} strokeWidth={1.8} />
                  <strong>Latest qualifying snapshot: {selectedWindow.latestSnapshot?.title ?? 'None for this window'}</strong>
                </div>
                <div>
                  <UserRoundCheck size={16} strokeWidth={1.8} />
                  <strong>Satisfied by: {selectedWindow.satisfiedBy}</strong>
                </div>
                <div>
                  <Clock3 size={16} strokeWidth={1.8} />
                  <strong>{selectedWindow.minutesLate ? `${selectedWindow.minutesLate} minutes late` : `${Math.max(selectedWindow.minutesUntilDue, 0)} minutes until due`}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Permission: {selectedWindow.rule.permission}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => acknowledgeWindow(selectedWindow)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Acknowledge
                  </button>
                  <button className="ghost-action" disabled={!canQueueSelected} onClick={() => queueEscalation(selectedWindow)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Escalation
                  </button>
                  <button className="ghost-action" onClick={() => toggleRuleStatus(selectedWindow)}>
                    {selectedWindow.rule.status === 'Paused' ? <PlayCircle size={15} strokeWidth={1.8} /> : <PauseCircle size={15} strokeWidth={1.8} />}
                    {selectedWindow.rule.status === 'Paused' ? 'Resume' : 'Pause'}
                  </button>
                  <button className="ghost-action" onClick={() => resetRuleState(selectedWindow)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  {onOpenBriefArchive && (
                    <button className="ghost-action" onClick={onOpenBriefArchive}>
                      <FileText size={15} strokeWidth={1.8} />
                      Open Archive
                    </button>
                  )}
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canQueueSelected && <p className="warning-copy">Escalation requires {selectedWindow.rule.followUpPermission}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No digest review cadence windows are configured.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function cadenceSortValue(window: DigestReviewWindow) {
  const weight = window.status === 'Escalation Ready' ? 0
    : window.status === 'Missed' ? 1
      : window.status === 'Due Today' ? 2
        : window.status === 'Needs Setup' ? 3
          : window.status === 'On Track' ? 4
            : window.status === 'Acknowledged' ? 5
              : 6
  return `${weight} ${window.dueAt}`
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function buildCadenceMetadata(window: DigestReviewWindow, metadata: Record<string, unknown> = {}) {
  return {
    cadenceRuleId: window.rule.id,
    cadenceName: window.rule.name,
    status: window.status,
    owner: window.rule.owner,
    backupOwner: window.rule.backupOwner,
    frequency: window.rule.frequency,
    requiredSnapshotStatus: window.rule.requiredSnapshotStatus,
    dueAt: window.dueAt,
    nextWindowAt: window.nextWindowAt,
    latestSnapshotId: window.latestSnapshot?.id,
    ...metadata,
  }
}
