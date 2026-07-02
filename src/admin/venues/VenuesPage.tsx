import { AlertTriangle, Clock, HeartPulse, Radio, Store, TabletSmartphone, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import DataTable from '../../components/admin/DataTable'
import HealthScorePanel from '../../components/admin/HealthScorePanel'
import InternalNotes from '../../components/admin/InternalNotes'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import type { VenueSummary } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface VenuesPageProps {
  session: AdminSession
  initialVenueId?: string
  onOpenSupportWorkbench?: (venueId: string) => void
}

function venueTone(status: VenueSummary['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'Needs Attention') return 'danger'
  if (status === 'Setup') return 'warn'
  return 'ok'
}

function notificationTone(status: VenueSummary['notificationHealth']): 'ok' | 'warn' | 'danger' {
  if (status === 'Failing') return 'danger'
  if (status === 'Warning') return 'warn'
  return 'ok'
}

export default function VenuesPage({ session, initialVenueId, onOpenSupportWorkbench }: VenuesPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, moduleActivations, organizations, supportIssues, supportNotes, venues } = data
  const [selectedId, setSelectedId] = useState(initialVenueId ?? venues[0]?.id ?? '')
  const [notice, setNotice] = useState('')
  const selectedVenue = venues.find(venue => venue.id === selectedId) ?? venues[0]
  const organization = selectedVenue
    ? organizations.find(org => org.id === selectedVenue.organizationId)
    : undefined
  const venueActivity = selectedVenue
    ? activityEvents.filter(event => event.scopeId === selectedVenue.id || event.scopeId === selectedVenue.organizationId)
    : []
  const venueModules = selectedVenue
    ? moduleActivations.filter(activation => activation.scopeId === selectedVenue.id || activation.scopeId === selectedVenue.organizationId)
    : []
  const venueIssues = selectedVenue
    ? supportIssues.filter(issue => issue.venueName === selectedVenue.name)
    : []
  const liveVenues = venues.filter(venue => venue.status === 'Live').length
  const attentionVenues = venues.filter(venue => venue.status === 'Needs Attention').length
  const failedNotifications = venues.filter(venue => venue.notificationHealth === 'Failing').length
  const offlineDevices = venues.reduce((sum, venue) => sum + venue.devicesOffline, 0)

  useEffect(() => {
    if (initialVenueId && venues.some(venue => venue.id === initialVenueId)) {
      setSelectedId(initialVenueId)
    }
  }, [initialVenueId, venues])

  const recordVenueReview = () => {
    if (!selectedVenue) return
    const result = runAdminAction(session, {
      permission: 'venues.view',
      scope: selectedVenue.name,
      actionKey: 'venue.reviewed.mock',
      actionLabel: `Reviewed venue operations for ${selectedVenue.name}`,
      severity: selectedVenue.status === 'Needs Attention' ? 'warning' : 'notice',
      metadata: {
        venueId: selectedVenue.id,
        organizationId: selectedVenue.organizationId,
        openIssueCount: venueIssues.length,
        notificationHealth: selectedVenue.notificationHealth,
      },
    })
    setNotice(result.ok ? `${selectedVenue.name} review recorded in Audit Logs.` : result.message)
  }

  if (!selectedVenue) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Venue Operations"
          title="Venues / Outlets"
          description="Venue directory, live operating status, support context, module usage, health score, notes, and recent activity."
        />
        <div className="empty-state compact">No venues are available yet.</div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Venue Operations"
        title="Venues / Outlets"
        description="Venue directory, live operating status, support context, module usage, health score, notes, and recent activity."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Live Venues" value={String(liveVenues)} delta="Ready for operations" tone="ok" icon={<Store size={16} />} />
        <MetricCard label="Need Attention" value={String(attentionVenues)} delta="Venue status risk" tone={attentionVenues ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Failed Notifications" value={String(failedNotifications)} delta="Delivery health" tone={failedNotifications ? 'danger' : 'ok'} icon={<Radio size={16} />} />
        <MetricCard label="Offline Devices" value={String(offlineDevices)} delta="Across all venues" tone={offlineDevices ? 'warn' : 'ok'} icon={<TabletSmartphone size={16} />} />
      </div>

      <div className="split-layout">
        <DataTable
          label="Venue Directory"
          rows={venues}
          pageSize={8}
          emptyTitle="No venues have been recorded yet."
          columns={[
            {
              key: 'venue',
              header: 'Venue',
              sortable: true,
              searchValue: row => `${row.name} ${row.propertyName} ${organizations.find(org => org.id === row.organizationId)?.name ?? ''}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.name}
                </button>
              ),
            },
            {
              key: 'organization',
              header: 'Organization',
              sortable: true,
              searchValue: row => organizations.find(org => org.id === row.organizationId)?.name ?? '',
              render: row => organizations.find(org => org.id === row.organizationId)?.name ?? 'Unknown',
            },
            {
              key: 'property',
              header: 'Property',
              sortable: true,
              searchValue: row => row.propertyName,
              render: row => row.propertyName,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={venueTone(row.status)} />,
            },
            {
              key: 'notifications',
              header: 'Notifications',
              sortable: true,
              searchValue: row => row.notificationHealth,
              render: row => <StatusPill label={row.notificationHealth} tone={notificationTone(row.notificationHealth)} />,
            },
            {
              key: 'lastActive',
              header: 'Last Active',
              sortable: true,
              searchValue: row => row.lastActivity,
              render: row => row.lastActivity,
            },
          ]}
        />

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">{organization?.name ?? 'Unknown Organization'} / {selectedVenue.propertyName}</p>
              <h2>{selectedVenue.name}</h2>
            </div>
            <StatusPill label={selectedVenue.status} tone={venueTone(selectedVenue.status)} />
          </div>

          <div className="mini-metrics">
            <MetricCard label="Active Requests" value={String(selectedVenue.activeRequests)} tone={selectedVenue.activeRequests > 5 ? 'warn' : 'ok'} icon={<Radio size={16} />} />
            <MetricCard label="Staff Online" value={String(selectedVenue.staffOnline)} tone={selectedVenue.staffOnline ? 'ok' : 'danger'} icon={<Users size={16} />} />
            <MetricCard label="Devices Offline" value={String(selectedVenue.devicesOffline)} tone={selectedVenue.devicesOffline ? 'warn' : 'ok'} icon={<TabletSmartphone size={16} />} />
            <MetricCard label="Avg Response" value={selectedVenue.averageResponseSeconds ? `${selectedVenue.averageResponseSeconds}s` : 'N/A'} tone={selectedVenue.averageResponseSeconds > 120 ? 'warn' : 'ok'} icon={<Clock size={16} />} />
          </div>

          <div className="detail-section">
            <h3>Operational Signals</h3>
            <dl className="signal-list">
              <div><dt>Venue Type</dt><dd>{selectedVenue.venueType}</dd></div>
              <div><dt>QR Scans</dt><dd>{selectedVenue.qrScansToday}</dd></div>
              <div><dt>Sessions</dt><dd>{selectedVenue.sessionsToday}</dd></div>
              <div><dt>Escalations</dt><dd>{selectedVenue.openEscalations}</dd></div>
              <div><dt>Notifications</dt><dd>{selectedVenue.notificationHealth}</dd></div>
              <div><dt>Last Activity</dt><dd>{selectedVenue.lastActivity}</dd></div>
            </dl>
          </div>

          <div className="detail-section">
            <h3>Action Panel</h3>
            <div className="support-actions">
              <button className="ghost-action" onClick={() => onOpenSupportWorkbench?.(selectedVenue.id)}>
                <Store size={15} strokeWidth={1.8} />
                Open Workbench
              </button>
              <button className="ghost-action" onClick={recordVenueReview}>
                <HeartPulse size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </div>
        </aside>
      </div>

      <section className="status-band">
        <div>
          <p className="eyebrow">Support Workbench Context</p>
          <h2>{selectedVenue.name}</h2>
          <span>{selectedVenue.enabledModules.length ? selectedVenue.enabledModules.join(', ') : 'No enabled modules recorded'} / {venueIssues.length} support issues</span>
        </div>
        <div className="status-band-actions">
          <StatusPill label={`Notifications: ${selectedVenue.notificationHealth}`} tone={notificationTone(selectedVenue.notificationHealth)} />
          <StatusPill label={`${selectedVenue.openEscalations} escalations`} tone={selectedVenue.openEscalations ? 'warn' : 'ok'} />
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Module Snapshot</h2>
              <span>Activation and recent usage context</span>
            </div>
          </div>
          <div className="module-adoption-list">
            {venueModules.length ? venueModules.map(activation => (
              <div key={activation.id}>
                <strong>{activation.moduleName}</strong>
                <span>{activation.activationLevel} / {activation.usageLast7Days} uses in 7 days / ${activation.revenueAttributed.toLocaleString()} attributed</span>
              </div>
            )) : <p className="muted-copy">No activation records found for this venue.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Support Issues</h2>
              <span>{venueIssues.length} issue records for this venue</span>
            </div>
          </div>
          <div className="queue-list">
            {venueIssues.length ? venueIssues.map(issue => (
              <div key={issue.id}>
                <StatusPill label={issue.severity} tone={issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warn' : 'info'} />
                <strong>{issue.issueType} / {issue.status}</strong>
                <span>{issue.probableCause} {issue.recommendedAction}</span>
              </div>
            )) : <div><strong>No venue support issues.</strong><span>Current support signals are clear for the selected venue.</span></div>}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <HealthScorePanel
          score={organization?.healthScore ?? 70}
          status={organization?.healthStatus ?? selectedVenue.status}
          usageScore={organization?.usageScore ?? 50}
          adoptionScore={selectedVenue.staffOnline ? 82 : 18}
          billingScore={organization?.billingStatus === 'Failed Payment' ? 18 : 94}
          supportScore={venueIssues.length || selectedVenue.openEscalations > 1 ? 42 : 86}
          setupScore={selectedVenue.status === 'Setup' ? 62 : 91}
        />
        <InternalNotes
          scopeType="venue"
          scopeId={selectedVenue.id}
          scopeLabel={selectedVenue.name}
          notes={supportNotes}
          actor={session.name}
          actorRole={session.role}
        />
      </div>

      <ActivityTimeline title="Venue Activity" events={venueActivity} />
    </div>
  )
}
