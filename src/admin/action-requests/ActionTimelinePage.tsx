import { Activity, CalendarClock, Database, FileClock, FileText, GitBranch, ListChecks, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import {
  buildActionTimeline,
  getActionTimelineEventTone,
  getActionTimelineTypeTone,
  summarizeActionTimeline,
  type ActionTimelineEvent,
} from '../../lib/admin-actions/actionTimeline'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

export default function ActionTimelinePage() {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAuditEvents = useLocalAuditEvents()
  const localMockExecutions = useLocalMockServerExecutions()
  const [selectedId, setSelectedId] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<'All' | ActionTimelineEvent['eventType']>('All')

  const requests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const timelineEvents = useMemo(() => buildActionTimeline({
    requests,
    auditEvents,
    mockExecutions: localMockExecutions,
  }), [auditEvents, localMockExecutions, requests])

  const filteredEvents = useMemo(() => eventTypeFilter === 'All'
    ? timelineEvents
    : timelineEvents.filter(event => event.eventType === eventTypeFilter),
  [eventTypeFilter, timelineEvents])

  const summary = useMemo(() => summarizeActionTimeline(timelineEvents), [timelineEvents])
  const selectedEvent = filteredEvents.find(event => event.id === selectedId)
    ?? timelineEvents.find(event => event.id === selectedId)
    ?? filteredEvents[0]
    ?? timelineEvents[0]
  const typeCounts = useMemo(() => {
    const counts = new Map<ActionTimelineEvent['eventType'], number>()
    timelineEvents.forEach(event => counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1))
    return counts
  }, [timelineEvents])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operating History"
        title="Action Timeline"
        description="Chronological operating history for action requests, approvals, handoffs, adapter reviews, mock dry-runs, and audit events."
      />

      <div className="metrics-grid compact">
        <MetricCard label="Timeline Events" value={String(summary.total)} delta={`${sourceLabel} plus local ledgers`} tone="neutral" icon={<Activity size={16} />} />
        <MetricCard label="Requests" value={String(summary.requests)} delta="Action request lineage" tone="neutral" icon={<ListChecks size={16} />} />
        <MetricCard label="Approvals" value={String(summary.approvals)} delta="Human decision records" tone={summary.approvals ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Handoffs" value={String(summary.handoffs)} delta="Execution review records" tone={summary.handoffs ? 'ok' : 'neutral'} icon={<GitBranch size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Dry Runs" value={String(summary.dryRuns)} delta="Mock server previews" tone={summary.dryRuns ? 'ok' : 'neutral'} icon={<FileClock size={16} />} />
        <MetricCard label="Adapter Reviews" value={String(summary.adapterReviews)} delta="Backend contract reviews" tone={summary.adapterReviews ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
        <MetricCard label="Blocked / Critical" value={String(summary.blockedOrCritical)} delta="Needs attention" tone={summary.blockedOrCritical ? 'danger' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Latest Event" value={summary.latest ? formatDateTime(summary.latest.occurredAt) : 'None'} delta="Most recent operating signal" tone="neutral" icon={<CalendarClock size={16} />} />
      </div>

      <section className="panel timeline-boundary-panel">
        <div>
          <p className="eyebrow">Activity Boundary</p>
          <h2>Timeline is an operating history, not an execution surface</h2>
          <span>Events are assembled from local action ledgers, mock dry-run records, and read-only audit views. The timeline does not approve, execute, or mutate production data.</span>
        </div>
        <StatusPill label="Read only" tone="ok" />
      </section>

      <div className="timeline-filter-bar">
        {(['All', 'Request', 'Approval', 'Handoff', 'Adapter Review', 'Dry Run', 'Audit'] as const).map(type => (
          <button
            key={type}
            className={eventTypeFilter === type ? 'selected' : ''}
            onClick={() => {
              setEventTypeFilter(type)
              setSelectedId('')
            }}
          >
            {type}
            <span>{type === 'All' ? timelineEvents.length : typeCounts.get(type) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="action-timeline-layout">
        <DataTable
          label="Action Timeline"
          rows={filteredEvents}
          pageSize={10}
          emptyTitle="No timeline events match this filter."
          columns={[
            {
              key: 'time',
              header: 'Time',
              sortable: true,
              searchValue: row => row.occurredAt,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {formatDateTime(row.occurredAt)}
                </button>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => row.eventType,
              render: row => <StatusPill label={row.eventType} tone={getActionTimelineTypeTone(row.eventType)} />,
            },
            {
              key: 'title',
              header: 'Event',
              sortable: true,
              searchValue: row => `${row.title} ${row.detail}`,
              render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.detail}</span></div>,
            },
            {
              key: 'actor',
              header: 'Actor',
              sortable: true,
              searchValue: row => `${row.actor} ${row.actorRole ?? ''}`,
              render: row => <div><strong>{row.actor}</strong><span className="cell-subtext">{row.actorRole ?? row.source}</span></div>,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.scope,
              render: row => row.scope,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.statusLabel,
              render: row => <StatusPill label={row.statusLabel} tone={getActionTimelineEventTone(row)} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => row.source,
              render: row => row.source,
            },
          ]}
        />

        <aside className="detail-panel action-timeline-detail-panel">
          {selectedEvent ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Timeline Detail</p>
                  <h2>{selectedEvent.title}</h2>
                </div>
                <StatusPill label={selectedEvent.eventType} tone={getActionTimelineTypeTone(selectedEvent.eventType)} />
              </div>

              <div className="request-scope-list">
                <div><span>Time</span><strong>{formatDateTime(selectedEvent.occurredAt)}</strong></div>
                <div><span>Status</span><strong>{selectedEvent.statusLabel}</strong></div>
                <div><span>Actor</span><strong>{selectedEvent.actor}</strong></div>
                <div><span>Role</span><strong>{selectedEvent.actorRole ?? 'Unknown'}</strong></div>
                <div><span>Scope</span><strong>{selectedEvent.scope}</strong></div>
                <div><span>Source</span><strong>{selectedEvent.source}</strong></div>
              </div>

              <section className={`panel timeline-event-panel tone-${getActionTimelineEventTone(selectedEvent)}`}>
                <div>
                  <p className="eyebrow">Event Summary</p>
                  <h2>{selectedEvent.statusLabel}</h2>
                  <span>{selectedEvent.detail}</span>
                </div>
                <div className="timeline-event-meta">
                  <StatusPill label={selectedEvent.severity} tone={getActionTimelineEventTone(selectedEvent)} />
                  <strong>{selectedEvent.persistenceLabel ?? 'local/read model'}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Lineage</h3>
                <div className="settings-rule-list">
                  <div>
                    <ListChecks size={16} strokeWidth={1.8} />
                    <strong>Action request: {selectedEvent.actionRequestId ?? 'Not linked'}</strong>
                  </div>
                  <div>
                    <ShieldCheck size={16} strokeWidth={1.8} />
                    <strong>Audit event: {selectedEvent.auditEventId ?? 'Not linked'}</strong>
                  </div>
                  <div>
                    <Database size={16} strokeWidth={1.8} />
                    <strong>Handler: {selectedEvent.handlerKey ?? 'Not linked'}</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No timeline event selected.</div>
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
