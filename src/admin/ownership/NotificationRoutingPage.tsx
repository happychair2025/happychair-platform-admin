import {
  BellRing,
  CheckCircle2,
  GitBranch,
  ListChecks,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  UserRoundCheck,
  UsersRound,
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
  getRoutingCoverageTone,
  getRoutingLaneTone,
  getRoutingStatusTone,
  notificationRoutingBoundaryRule,
  summarizeNotificationRouting,
  useLocalNotificationRoutingStates,
  type NotificationRoutePolicy,
  type RoutingLane,
  type RoutingPolicyStatus,
} from '../../lib/ownership/notificationRouting'
import {
  buildOwnershipSlaQueue,
  getOwnershipPriorityTone,
  getOwnershipSlaTone,
} from '../../lib/ownership/ownershipSla'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface NotificationRoutingPageProps {
  session: AdminSession
  onOpenOwnership?: () => void
  onOpenActionRequests?: () => void
}

const laneFilters: Array<'All' | RoutingLane> = ['All', 'Executive', 'Support', 'Engineering', 'Finance', 'Client Success', 'Governance', 'Agents']
const routingStatuses: RoutingPolicyStatus[] = ['Active', 'Needs Review', 'Local Override', 'Paused']

export default function NotificationRoutingPage({ session, onOpenOwnership, onOpenActionRequests }: NotificationRoutingPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const users = useManagedInternalAdminUsers(data.internalAdminUsers)
  const [localRoutingStates, setLocalRoutingStates] = useLocalNotificationRoutingStates()
  const [selectedId, setSelectedId] = useState('')
  const [laneFilter, setLaneFilter] = useState<'All' | RoutingLane>('All')
  const [notice, setNotice] = useState('')
  const [draftPrimaryUserId, setDraftPrimaryUserId] = useState('')
  const [draftBackupUserId, setDraftBackupUserId] = useState('')
  const [draftStatus, setDraftStatus] = useState<RoutingPolicyStatus>('Active')
  const [draftNote, setDraftNote] = useState('')
  const canManageRouting = hasPermission(session.role, 'notifications.manage')

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
  const summary = useMemo(() => summarizeNotificationRouting(routes), [routes])
  const filteredRoutes = useMemo(() => laneFilter === 'All'
    ? routes
    : routes.filter(route => route.lane === laneFilter),
  [laneFilter, routes])
  const selectedRoute = filteredRoutes.find(route => route.id === selectedId)
    ?? routes.find(route => route.id === selectedId)
    ?? filteredRoutes[0]
    ?? routes[0]
  const activeUsers = useMemo(() => users.filter(user => user.status === 'Active'), [users])
  const canQueueCoverage = selectedRoute ? hasPermission(session.role, getCoverageFollowUpPermission(selectedRoute)) : false

  useEffect(() => {
    if (!selectedRoute) return
    setDraftPrimaryUserId(selectedRoute.primaryUser?.id ?? '')
    setDraftBackupUserId(selectedRoute.backupUser?.id ?? '')
    setDraftStatus(selectedRoute.status)
    setDraftNote(selectedRoute.localState?.note ?? '')
  }, [selectedRoute?.id, selectedRoute?.primaryUser?.id, selectedRoute?.backupUser?.id, selectedRoute?.status, selectedRoute?.localState?.note])

  const applyLocalRouting = (route: NotificationRoutePolicy) => {
    const primaryUser = users.find(user => user.id === draftPrimaryUserId)
    const backupUser = users.find(user => user.id === draftBackupUserId)
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: route.name,
      actionKey: `notification_routing.${sanitizeActionKey(route.id)}.local_assignment.mock`,
      actionLabel: `Updated local routing assignment: ${route.name}`,
      severity: route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited' ? 'warning' : 'notice',
      metadata: buildRoutingMetadata(route, {
        localOnly: true,
        mutationApplied: false,
        primaryUserId: primaryUser?.id,
        primaryUserName: primaryUser?.name,
        backupUserId: backupUser?.id,
        backupUserName: backupUser?.name,
        nextStatus: draftStatus,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalRoutingStates(current => [
      {
        routeId: route.id,
        primaryUserId: draftPrimaryUserId || undefined,
        backupUserId: draftBackupUserId || undefined,
        status: draftStatus,
        note: draftNote.trim() || 'Local routing assignment updated.',
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.routeId !== route.id),
    ])
    setNotice(`${route.name} routing assignment saved locally and recorded in Audit Logs.`)
  }

  const resetLocalRouting = (route: NotificationRoutePolicy) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: route.name,
      actionKey: `notification_routing.${sanitizeActionKey(route.id)}.reset_local.mock`,
      actionLabel: `Reset local routing assignment: ${route.name}`,
      severity: 'notice',
      metadata: buildRoutingMetadata(route, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalRoutingStates(current => current.filter(state => state.routeId !== route.id))
    setNotice(`${route.name} local routing override reset and recorded in Audit Logs.`)
  }

  const queueCoverageFix = (route: NotificationRoutePolicy) => {
    const actionType = getCoverageFollowUpActionType(route)
    const permission = getCoverageFollowUpPermission(route)
    const result = queueAdminActionRequest(session, {
      actionType,
      title: `Routing coverage follow-up: ${route.name}`,
      permission,
      scope: createAdminActionScope({ label: route.name }),
      reason: `${route.name} is ${route.coverageStatus}. Primary: ${route.primaryUser?.name ?? 'None'} / Backup: ${route.backupUser?.name ?? 'None'}.`,
      rollbackNotes: 'Do not change production alert delivery from the browser. Coverage corrections must remain server-side, permissioned, and audit-recorded.',
      severity: route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited' ? 'warning' : 'notice',
      metadata: buildRoutingMetadata(route, {
        source: 'notification_routing_center',
        coverageStatus: route.coverageStatus,
      }),
      handlerKey: actionType === 'admin_user_change'
        ? `server.internal_access.routing_coverage.${route.id}`
        : `server.notification_routing.${route.id}`,
      handlerLabel: `${route.lane} routing coverage handler`,
      handlerDescription: `Server-side placeholder for routing coverage correction: ${route.name}.`,
    })

    setNotice(result.ok ? `${route.name} coverage follow-up queued in Action Requests.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Routing Control"
        title="Notification Routing Center"
        description="Internal owner, backup, and delivery coverage for every escalation lane before work reaches the SLA queue or Action Requests."
        action={<StatusPill label={canManageRouting ? 'Local routing enabled' : 'Read only'} tone={canManageRouting ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Covered Routes" value={`${summary.covered}/${summary.total}`} delta={`${sourceLabel} plus local assignments`} tone={summary.covered === summary.total ? 'ok' : 'warn'} icon={<RadioTower size={16} />} />
        <MetricCard label="Needs Review" value={String(summary.needsReview)} delta={`${summary.noActiveOwner} owner gaps`} tone={summary.needsReview ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Workload Routed" value={String(summary.workload)} delta={`${summary.breached} breached / ${summary.critical} critical`} tone={summary.breached || summary.critical ? 'danger' : 'ok'} icon={<TimerReset size={16} />} />
        <MetricCard label="Local Overrides" value={String(summary.localOverrides)} delta={`${summary.needsBackup} backup gaps`} tone={summary.localOverrides ? 'warn' : 'neutral'} icon={<GitBranch size={16} />} />
      </div>

      <section className="panel routing-boundary-panel">
        <div>
          <p className="eyebrow">Routing Boundary</p>
          <h2>Assignments guide internal response; server handlers control delivery</h2>
          <span>{notificationRoutingBoundaryRule}</span>
        </div>
        <StatusPill label={`${activeUsers.length} active users`} tone={activeUsers.length ? 'ok' : 'danger'} />
      </section>

      <section className="routing-owner-grid" aria-label="Routing coverage cards">
        {routes.map(route => (
          <button
            key={route.id}
            className={selectedRoute?.id === route.id ? 'selected' : ''}
            onClick={() => setSelectedId(route.id)}
          >
            <StatusPill label={route.coverageStatus} tone={getRoutingCoverageTone(route.coverageStatus)} />
            <strong>{route.name}</strong>
            <span>{route.primaryUser?.name ?? roleLabels[route.primaryRole]}</span>
            <small>{route.workload} work items / {route.breached} breached</small>
          </button>
        ))}
      </section>

      <div className="timeline-filter-bar" aria-label="Routing lane filters">
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
            <span>{lane === 'All' ? routes.length : routes.filter(route => route.lane === lane).length}</span>
          </button>
        ))}
      </div>

      <div className="notification-routing-layout">
        <DataTable
          label="Routing Policies"
          rows={filteredRoutes}
          pageSize={8}
          emptyTitle="No routing policies match this lane."
          columns={[
            {
              key: 'coverage',
              header: 'Coverage',
              sortable: true,
              searchValue: row => coverageSortValue(row),
              render: row => <StatusPill label={row.coverageStatus} tone={getRoutingCoverageTone(row.coverageStatus)} />,
            },
            {
              key: 'route',
              header: 'Route',
              sortable: true,
              searchValue: row => `${row.name} ${row.description} ${row.lane}`,
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
              key: 'load',
              header: 'Load',
              sortable: true,
              searchValue: row => `${1000 - row.workload} ${row.workload}`,
              render: row => <div><strong>{row.workload}</strong><span className="cell-subtext">{row.breached} breached / {row.critical} critical</span></div>,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getRoutingStatusTone(row.status)} />,
            },
          ]}
        />

        <aside className="detail-panel notification-routing-detail-panel">
          {selectedRoute ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Route Detail</p>
                  <h2>{selectedRoute.name}</h2>
                </div>
                <StatusPill label={selectedRoute.coverageStatus} tone={getRoutingCoverageTone(selectedRoute.coverageStatus)} />
              </div>

              <div className="request-scope-list">
                <div><span>Lane</span><strong>{selectedRoute.lane}</strong></div>
                <div><span>Delivery</span><strong>{selectedRoute.deliveryMode}</strong></div>
                <div><span>Primary</span><strong>{selectedRoute.primaryUser?.name ?? 'Unassigned'}</strong></div>
                <div><span>Backup</span><strong>{selectedRoute.backupUser?.name ?? 'Missing'}</strong></div>
                <div><span>Escalation</span><strong>{formatRoutingDuration(selectedRoute.escalationMinutes)}</strong></div>
                <div><span>Next Due</span><strong>{selectedRoute.nextDueAt ? formatDateTime(selectedRoute.nextDueAt) : 'No active work'}</strong></div>
              </div>

              <section className={`panel routing-status-panel tone-${getRoutingCoverageTone(selectedRoute.coverageStatus)}`}>
                <div>
                  <p className="eyebrow">Coverage Posture</p>
                  <h2>{selectedRoute.description}</h2>
                  <span>{selectedRoute.workload} routed work items / {selectedRoute.breached} breached / {selectedRoute.dueSoon} due soon.</span>
                </div>
                <div className="routing-status-meta">
                  <StatusPill label={selectedRoute.status} tone={getRoutingStatusTone(selectedRoute.status)} />
                  <strong>{selectedRoute.critical} critical</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Assignment</h3>
                <div className="routing-assignment-grid">
                  <label>
                    <span>Primary owner</span>
                    <select value={draftPrimaryUserId} disabled={!canManageRouting} onChange={event => setDraftPrimaryUserId(event.target.value)}>
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]} / {user.status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Backup owner</span>
                    <select value={draftBackupUserId} disabled={!canManageRouting} onChange={event => setDraftBackupUserId(event.target.value)}>
                      <option value="">Missing</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]} / {user.status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Route status</span>
                    <select value={draftStatus} disabled={!canManageRouting} onChange={event => setDraftStatus(event.target.value as RoutingPolicyStatus)}>
                      {routingStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Local note</span>
                    <input value={draftNote} disabled={!canManageRouting} onChange={event => setDraftNote(event.target.value)} placeholder="Reason for local routing change" />
                  </label>
                </div>
              </div>

              <div className="detail-section">
                <h3>Routing Evidence</h3>
                <div className="settings-rule-list">
                  {selectedRoute.evidence.map(evidence => (
                    <div key={evidence}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{evidence}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Routed Work</h3>
                <div className="routing-work-list">
                  {selectedRoute.routedItems.slice(0, 5).map(item => (
                    <div key={item.id}>
                      <StatusPill label={item.slaStatus} tone={getOwnershipSlaTone(item.slaStatus)} />
                      <strong>{item.title}</strong>
                      <span>{item.owner} / {item.scope}</span>
                      <StatusPill label={item.priority} tone={getOwnershipPriorityTone(item.priority)} />
                    </div>
                  ))}
                  {!selectedRoute.routedItems.length && <p className="muted-copy">No active work is routed through this policy right now.</p>}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canManageRouting} onClick={() => applyLocalRouting(selectedRoute)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Apply Local Routing
                  </button>
                  <button className="ghost-action" disabled={!canManageRouting} onClick={() => resetLocalRouting(selectedRoute)}>
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset Local
                  </button>
                  <button className="ghost-action" disabled={!canQueueCoverage} onClick={() => queueCoverageFix(selectedRoute)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Coverage Fix
                  </button>
                  {onOpenOwnership && (
                    <button className="ghost-action" onClick={onOpenOwnership}>
                      <UsersRound size={15} strokeWidth={1.8} />
                      Ownership SLA
                    </button>
                  )}
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
                {!canManageRouting && <p className="warning-copy">Local routing updates require notifications.manage.</p>}
                {!canQueueCoverage && <p className="warning-copy">Coverage fix queueing requires {selectedRoute ? getCoverageFollowUpPermission(selectedRoute) : 'admin_actions.manage'}.</p>}
              </div>
            </>
          ) : (
            <div className="empty-state compact">No routing policy selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildRoutingMetadata(route: NotificationRoutePolicy, extra: Record<string, unknown>) {
  return {
    routeId: route.id,
    routeName: route.name,
    lane: route.lane,
    coverageStatus: route.coverageStatus,
    routeStatus: route.status,
    primaryRole: route.primaryRole,
    backupRole: route.backupRole,
    primaryUserId: route.primaryUser?.id,
    backupUserId: route.backupUser?.id,
    workload: route.workload,
    breached: route.breached,
    critical: route.critical,
    ...extra,
  }
}

function getCoverageFollowUpActionType(route: NotificationRoutePolicy) {
  if (route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited') return 'admin_user_change' as const
  return route.followUpActionType
}

function getCoverageFollowUpPermission(route: NotificationRoutePolicy) {
  if (route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited') return 'admin_users.manage' as const
  return route.followUpPermission
}

function coverageSortValue(route: NotificationRoutePolicy) {
  if (route.coverageStatus === 'No Active Owner' || route.coverageStatus === 'Owner Invited') return `0 ${route.coverageStatus}`
  if (route.coverageStatus === 'Backup Only' || route.coverageStatus === 'Needs Backup') return `1 ${route.coverageStatus}`
  return `2 ${route.coverageStatus}`
}

function formatRoutingDuration(minutes: number) {
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

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
