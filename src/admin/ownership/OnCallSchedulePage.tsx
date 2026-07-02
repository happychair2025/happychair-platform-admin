import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  GitBranch,
  ListChecks,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  UserRoundCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useManagedInternalAdminUsers } from '../../lib/admin-users/internalAccess'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import {
  buildNotificationRoutingCenter,
  getRoutingLaneTone,
  useLocalNotificationRoutingStates,
  type RoutingLane,
} from '../../lib/ownership/notificationRouting'
import {
  buildOnCallSchedule,
  getOnCallHandoffTone,
  getOnCallShiftTone,
  onCallScheduleBoundaryRule,
  summarizeOnCallSchedule,
  useLocalOnCallScheduleStates,
  type OnCallLocalStatus,
  type OnCallShift,
} from '../../lib/ownership/onCallSchedule'
import {
  buildOwnershipSlaQueue,
  getOwnershipPriorityTone,
  getOwnershipSlaTone,
} from '../../lib/ownership/ownershipSla'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface OnCallSchedulePageProps {
  session: AdminSession
  onOpenRouting?: () => void
  onOpenActionRequests?: () => void
}

const laneFilters: Array<'All' | RoutingLane> = ['All', 'Executive', 'Support', 'Engineering', 'Finance', 'Client Success', 'Governance', 'Agents']
const localStatuses: OnCallLocalStatus[] = ['Active', 'Paused', 'Local Override', 'Acknowledged']

export default function OnCallSchedulePage({ session, onOpenRouting, onOpenActionRequests }: OnCallSchedulePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const users = useManagedInternalAdminUsers(data.internalAdminUsers)
  const [localRoutingStates] = useLocalNotificationRoutingStates()
  const [localOnCallStates, setLocalOnCallStates] = useLocalOnCallScheduleStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | RoutingLane>('All')
  const [notice, setNotice] = useState('')
  const [draftPrimaryUserId, setDraftPrimaryUserId] = useState('')
  const [draftBackupUserId, setDraftBackupUserId] = useState('')
  const [draftStatus, setDraftStatus] = useState<OnCallLocalStatus>('Active')
  const [draftNote, setDraftNote] = useState('')
  const canManageSchedule = hasPermission(session.role, 'notifications.manage')

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
  const summary = useMemo(() => summarizeOnCallSchedule(shifts), [shifts])
  const filteredShifts = useMemo(() => laneFilter === 'All'
    ? shifts
    : shifts.filter(shift => shift.lane === laneFilter),
  [laneFilter, shifts])
  const selectedShift = filteredShifts.find(shift => shift.id === selectedId)
    ?? shifts.find(shift => shift.id === selectedId)
    ?? filteredShifts[0]
    ?? shifts[0]
  const canQueueCoverage = selectedShift ? hasPermission(session.role, getCoverageFollowUpPermission(selectedShift)) : false

  useEffect(() => {
    if (!selectedShift) return
    setDraftPrimaryUserId(selectedShift.primaryUser?.id ?? '')
    setDraftBackupUserId(selectedShift.backupUser?.id ?? '')
    setDraftStatus(selectedShift.localState?.status ?? 'Active')
    setDraftNote(selectedShift.localState?.note ?? '')
  }, [selectedShift?.id, selectedShift?.primaryUser?.id, selectedShift?.backupUser?.id, selectedShift?.localState?.status, selectedShift?.localState?.note])

  const applyLocalCoverage = (shift: OnCallShift) => {
    const primaryUser = users.find(user => user.id === draftPrimaryUserId)
    const backupUser = users.find(user => user.id === draftBackupUserId)
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: shift.name,
      actionKey: `on_call_schedule.${sanitizeActionKey(shift.id)}.local_coverage.mock`,
      actionLabel: `Updated local on-call coverage: ${shift.name}`,
      severity: shift.status === 'Coverage Gap' || shift.handoffStatus === 'No Active Owner' ? 'warning' : 'notice',
      metadata: buildOnCallMetadata(shift, {
        localOnly: true,
        mutationApplied: false,
        primaryUserId: primaryUser?.id,
        primaryUserName: primaryUser?.name,
        backupUserId: backupUser?.id,
        backupUserName: backupUser?.name,
        localStatus: draftStatus,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalOnCallStates(current => [
      {
        shiftId: shift.id,
        primaryUserId: draftPrimaryUserId || undefined,
        backupUserId: draftBackupUserId || undefined,
        status: draftStatus,
        note: draftNote.trim() || 'Local on-call coverage updated.',
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.shiftId !== shift.id),
    ])
    setSelectedId(shift.id)
    setNotice(`${shift.name} on-call coverage saved locally and recorded in Audit Logs.`)
  }

  const acknowledgeHandoff = (shift: OnCallShift) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: shift.name,
      actionKey: `on_call_schedule.${sanitizeActionKey(shift.id)}.handoff_acknowledged.mock`,
      actionLabel: `Acknowledged on-call handoff: ${shift.name}`,
      severity: shift.handoffStatus === 'Overdue' || shift.handoffStatus === 'No Active Owner' ? 'warning' : 'notice',
      metadata: buildOnCallMetadata(shift, {
        localOnly: true,
        mutationApplied: false,
        handoffStatus: shift.handoffStatus,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalOnCallStates(current => [
      {
        shiftId: shift.id,
        primaryUserId: shift.primaryUser?.id,
        backupUserId: shift.backupUser?.id,
        status: 'Acknowledged',
        acknowledgedAt: new Date().toISOString(),
        note: 'Handoff acknowledged from On-Call Schedule.',
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.shiftId !== shift.id),
    ])
    setSelectedId(shift.id)
    setNotice(`${shift.name} handoff acknowledged locally and recorded in Audit Logs.`)
  }

  const resetLocalCoverage = (shift: OnCallShift) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: shift.name,
      actionKey: `on_call_schedule.${sanitizeActionKey(shift.id)}.reset_local.mock`,
      actionLabel: `Reset local on-call coverage: ${shift.name}`,
      severity: 'notice',
      metadata: buildOnCallMetadata(shift, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalOnCallStates(current => current.filter(state => state.shiftId !== shift.id))
    setSelectedId(shift.id)
    setNotice(`${shift.name} local on-call coverage reset and recorded in Audit Logs.`)
  }

  const queueCoverageFix = (shift: OnCallShift) => {
    const actionType = getCoverageFollowUpActionType(shift)
    const permission = getCoverageFollowUpPermission(shift)
    const result = queueAdminActionRequest(session, {
      actionType,
      title: `On-call coverage follow-up: ${shift.name}`,
      permission,
      scope: createAdminActionScope({ label: shift.name }),
      reason: `${shift.name} is ${shift.status}. Handoff: ${shift.handoffStatus}. ${shift.coverageNote}`,
      rollbackNotes: 'Do not change production alert delivery from the browser. On-call corrections must remain server-side, permissioned, and audit-recorded.',
      severity: shift.status === 'Coverage Gap' || shift.handoffStatus === 'No Active Owner' ? 'warning' : 'notice',
      metadata: buildOnCallMetadata(shift, {
        source: 'on_call_schedule',
      }),
      handlerKey: actionType === 'admin_user_change'
        ? `server.internal_access.on_call_coverage.${shift.id}`
        : `server.on_call_schedule.${shift.id}`,
      handlerLabel: `${shift.lane} on-call coverage handler`,
      handlerDescription: `Server-side placeholder for on-call coverage correction: ${shift.name}.`,
    })

    setNotice(result.ok ? `${shift.name} coverage follow-up queued in Action Requests.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coverage Command"
        title="On-Call & Escalation Schedule"
        description="Active and upcoming internal coverage windows for owner review, support, engineering, finance, client success, governance, and agent review."
        action={<StatusPill label={canManageSchedule ? 'Local schedule enabled' : 'Read only'} tone={canManageSchedule ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Active Coverage" value={String(summary.active)} delta={`${sourceLabel} plus local schedule`} tone={summary.gaps ? 'warn' : 'ok'} icon={<RadioTower size={16} />} />
        <MetricCard label="Coverage Gaps" value={String(summary.gaps)} delta={`${summary.backupGaps} backup gaps`} tone={summary.gaps ? 'danger' : summary.backupGaps ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Handoffs Due" value={String(summary.handoffsDue)} delta={summary.nextHandoffAt ? `Next ${formatDateTime(summary.nextHandoffAt)}` : 'No upcoming handoff'} tone={summary.handoffsDue ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Routed Workload" value={String(summary.activeWorkload)} delta={`${summary.critical} critical signals`} tone={summary.critical ? 'danger' : 'neutral'} icon={<TimerReset size={16} />} />
      </div>

      <section className="panel on-call-boundary-panel">
        <div>
          <p className="eyebrow">Schedule Boundary</p>
          <h2>Coverage windows coordinate handoffs; server handlers control delivery</h2>
          <span>{onCallScheduleBoundaryRule}</span>
        </div>
        <StatusPill label={`${summary.localOverrides} local overrides`} tone={summary.localOverrides ? 'info' : 'ok'} />
      </section>

      <section className="on-call-shift-grid" aria-label="On-call shift cards">
        {shifts.map(shift => (
          <button
            key={shift.id}
            className={selectedShift?.id === shift.id ? 'selected' : ''}
            onClick={() => setSelectedId(shift.id)}
          >
            <StatusPill label={shift.status} tone={getOnCallShiftTone(shift.status)} />
            <strong>{shift.name}</strong>
            <span>{shift.primaryUser?.name ?? roleLabels[shift.primaryRole]}</span>
            <small>{formatShiftWindow(shift)} / {shift.handoffStatus}</small>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="On-call lane filters">
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
            <span>{lane === 'All' ? shifts.length : shifts.filter(shift => shift.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="on-call-layout">
        <DataTable
          label="Coverage Windows"
          rows={filteredShifts}
          pageSize={8}
          emptyTitle="No on-call shifts match this lane."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => shiftSortValue(row),
              render: row => <StatusPill label={row.status} tone={getOnCallShiftTone(row.status)} />,
            },
            {
              key: 'shift',
              header: 'Shift',
              sortable: true,
              searchValue: row => `${row.name} ${row.lane} ${row.frequency}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.name}</button>,
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={getRoutingLaneTone(row.lane)} />,
            },
            {
              key: 'primary',
              header: 'Primary',
              sortable: true,
              searchValue: row => `${row.primaryUser?.name ?? ''} ${roleLabels[row.primaryRole]}`,
              render: row => <div><strong>{row.primaryUser?.name ?? 'Unassigned'}</strong><span className="cell-subtext">{roleLabels[row.primaryRole]}</span></div>,
            },
            {
              key: 'backup',
              header: 'Backup',
              sortable: true,
              searchValue: row => `${row.backupUser?.name ?? ''} ${roleLabels[row.backupRole]}`,
              render: row => <div><strong>{row.backupUser?.name ?? 'Missing'}</strong><span className="cell-subtext">{roleLabels[row.backupRole]}</span></div>,
            },
            {
              key: 'handoff',
              header: 'Handoff',
              sortable: true,
              searchValue: row => `${handoffSortValue(row)} ${row.handoffStatus}`,
              render: row => <StatusPill label={row.handoffStatus} tone={getOnCallHandoffTone(row.handoffStatus)} />,
            },
            {
              key: 'work',
              header: 'Work',
              sortable: true,
              searchValue: row => `${1000 - row.activeWorkload} ${row.activeWorkload}`,
              render: row => <div><strong>{row.activeWorkload}</strong><span className="cell-subtext">{row.breached} breached / {row.critical} critical</span></div>,
            },
          ]}
        />

        <aside className="detail-panel on-call-detail-panel">
          {selectedShift ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Coverage Detail</p>
                  <h2>{selectedShift.name}</h2>
                </div>
                <StatusPill label={selectedShift.status} tone={getOnCallShiftTone(selectedShift.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedShift.lane}</strong></div>
                <div><span>Frequency</span><strong>{selectedShift.frequency}</strong></div>
                <div><span>Primary</span><strong>{selectedShift.primaryUser?.name ?? 'Unassigned'}</strong></div>
                <div><span>Backup</span><strong>{selectedShift.backupUser?.name ?? 'Missing'}</strong></div>
                <div><span>Starts</span><strong>{formatDateTime(selectedShift.startsAt)}</strong></div>
                <div><span>Ends</span><strong>{formatDateTime(selectedShift.endsAt)}</strong></div>
              </div>

              <section className={`panel on-call-status-panel tone-${getOnCallShiftTone(selectedShift.status)}`}>
                <div>
                  <p className="eyebrow">Handoff Posture</p>
                  <h2>{selectedShift.coverageNote}</h2>
                  <span>{formatRelativeWindow(selectedShift)} / {selectedShift.activeWorkload} routed work items.</span>
                </div>
                <div className="on-call-status-meta">
                  <StatusPill label={selectedShift.handoffStatus} tone={getOnCallHandoffTone(selectedShift.handoffStatus)} />
                  <strong>{selectedShift.critical} critical</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Coverage Assignment</h3>
                <div className="on-call-assignment-grid">
                  <label>
                    <span>Primary owner</span>
                    <select value={draftPrimaryUserId} disabled={!canManageSchedule} onChange={event => setDraftPrimaryUserId(event.target.value)}>
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]} / {user.status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Backup owner</span>
                    <select value={draftBackupUserId} disabled={!canManageSchedule} onChange={event => setDraftBackupUserId(event.target.value)}>
                      <option value="">Missing</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]} / {user.status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Local status</span>
                    <select value={draftStatus} disabled={!canManageSchedule} onChange={event => setDraftStatus(event.target.value as OnCallLocalStatus)}>
                      {localStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Local note</span>
                    <input value={draftNote} disabled={!canManageSchedule} onChange={event => setDraftNote(event.target.value)} placeholder="Reason for schedule update" />
                  </label>
                </div>
              </div>

              <div className="detail-section">
                <h3>Schedule Evidence</h3>
                <div className="settings-rule-list">
                  {selectedShift.evidence.map(evidence => (
                    <div key={evidence}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Routed Work</h3>
                <div className="on-call-work-list">
                  {selectedShift.routedItems.slice(0, 5).map(item => (
                    <div key={item.id}>
                      <StatusPill label={item.slaStatus} tone={getOwnershipSlaTone(item.slaStatus)} />
                      <strong>{item.title}</strong>
                      <span>{item.owner} / {item.scope}</span>
                      <StatusPill label={item.priority} tone={getOwnershipPriorityTone(item.priority)} />
                    </div>
                  ))}
                  {!selectedShift.routedItems.length && <p className="muted-copy">No active routed work is waiting in this coverage lane.</p>}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canManageSchedule} onClick={() => acknowledgeHandoff(selectedShift)}>
                    <UserRoundCheck size={15} strokeWidth={1.8} />
                    Acknowledge Handoff
                  </button>
                  <button className="ghost-action" disabled={!canManageSchedule} onClick={() => applyLocalCoverage(selectedShift)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Apply Local Coverage
                  </button>
                  <button className="ghost-action" disabled={!canManageSchedule} onClick={() => resetLocalCoverage(selectedShift)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  <button className="ghost-action" disabled={!canQueueCoverage} onClick={() => queueCoverageFix(selectedShift)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Coverage Fix
                  </button>
                  {onOpenRouting && (
                    <button className="ghost-action" onClick={onOpenRouting}>
                      <GitBranch size={15} strokeWidth={1.8} />
                      Routing Center
                    </button>
                  )}
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canManageSchedule && <p className="warning-copy">Local on-call coverage updates require notifications.manage.</p>}
                {!canQueueCoverage && <p className="warning-copy">Coverage fix queueing requires {selectedShift ? getCoverageFollowUpPermission(selectedShift) : 'admin_actions.manage'}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No on-call shift selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildOnCallMetadata(shift: OnCallShift, extra: Record<string, unknown>) {
  return {
    shiftId: shift.id,
    routeId: shift.routeId,
    lane: shift.lane,
    status: shift.status,
    handoffStatus: shift.handoffStatus,
    primaryRole: shift.primaryRole,
    backupRole: shift.backupRole,
    primaryUserId: shift.primaryUser?.id,
    backupUserId: shift.backupUser?.id,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    activeWorkload: shift.activeWorkload,
    breached: shift.breached,
    critical: shift.critical,
    ...extra,
  }
}

function getCoverageFollowUpActionType(shift: OnCallShift) {
  if (shift.status === 'Coverage Gap' || shift.handoffStatus === 'No Active Owner') return 'admin_user_change' as const
  return shift.followUpActionType
}

function getCoverageFollowUpPermission(shift: OnCallShift) {
  if (shift.status === 'Coverage Gap' || shift.handoffStatus === 'No Active Owner') return 'admin_users.manage' as const
  return shift.followUpPermission
}

function shiftSortValue(shift: OnCallShift) {
  if (shift.status === 'Coverage Gap') return `0 ${shift.status}`
  if (shift.status === 'Backup Only') return `1 ${shift.status}`
  if (shift.status === 'Active') return `2 ${shift.status}`
  if (shift.status === 'Upcoming') return `3 ${shift.status}`
  if (shift.status === 'Paused') return `4 ${shift.status}`
  return `5 ${shift.status}`
}

function handoffSortValue(shift: OnCallShift) {
  if (shift.handoffStatus === 'No Active Owner' || shift.handoffStatus === 'Overdue') return '0'
  if (shift.handoffStatus === 'No Backup' || shift.handoffStatus === 'Due Soon') return '1'
  return '2'
}

function formatShiftWindow(shift: OnCallShift) {
  return `${formatTime(shift.startsAt)}-${formatTime(shift.endsAt)}`
}

function formatRelativeWindow(shift: OnCallShift) {
  if (shift.status === 'Upcoming') return `Starts in ${formatMinutes(Math.max(0, shift.minutesUntilStart))}`
  if (shift.status === 'Active' || shift.status === 'Backup Only') return `Ends in ${formatMinutes(Math.max(0, shift.minutesUntilEnd))}`
  if (shift.status === 'Ended') return `Ended ${formatMinutes(Math.abs(shift.minutesUntilEnd))} ago`
  return 'Coverage needs review'
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.round(minutes / 60)}h`
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

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
