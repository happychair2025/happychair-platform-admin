import { Building2, HeartPulse, MapPinned, Store } from 'lucide-react'
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
import type { PropertySummary } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface PropertiesPageProps {
  session: AdminSession
  initialPropertyId?: string
}

function propertyTone(status: PropertySummary['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'Needs Attention') return 'danger'
  if (status === 'Setup') return 'warn'
  return 'ok'
}

export default function PropertiesPage({ session, initialPropertyId }: PropertiesPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, organizations, properties, supportIssues, supportNotes, venues } = data
  const [selectedId, setSelectedId] = useState(initialPropertyId ?? properties[0]?.id ?? '')
  const [notice, setNotice] = useState('')
  const selectedProperty = properties.find(property => property.id === selectedId) ?? properties[0]
  const organization = selectedProperty
    ? organizations.find(org => org.id === selectedProperty.organizationId)
    : undefined
  const propertyVenues = selectedProperty
    ? venues.filter(venue => venue.propertyName === selectedProperty.name)
    : []
  const propertyIssues = selectedProperty
    ? supportIssues.filter(issue => issue.propertyName === selectedProperty.name)
    : []
  const propertyActivity = selectedProperty
    ? activityEvents.filter(event => event.scopeId === selectedProperty.id || propertyVenues.some(venue => venue.id === event.scopeId))
    : []
  const attentionProperties = properties.filter(property => property.status === 'Needs Attention').length
  const setupProperties = properties.filter(property => property.status === 'Setup').length
  const averageHealth = properties.length
    ? Math.round(properties.reduce((sum, property) => sum + property.healthScore, 0) / properties.length)
    : 0

  useEffect(() => {
    if (initialPropertyId && properties.some(property => property.id === initialPropertyId)) {
      setSelectedId(initialPropertyId)
    }
  }, [initialPropertyId, properties])

  const recordPropertyReview = () => {
    if (!selectedProperty) return
    const result = runAdminAction(session, {
      permission: 'properties.view',
      scope: selectedProperty.name,
      actionKey: 'property.reviewed.mock',
      actionLabel: `Reviewed property operations for ${selectedProperty.name}`,
      severity: selectedProperty.status === 'Needs Attention' ? 'warning' : 'notice',
      metadata: {
        propertyId: selectedProperty.id,
        organizationId: selectedProperty.organizationId,
        openIssueCount: propertyIssues.length,
      },
    })
    setNotice(result.ok ? `${selectedProperty.name} review recorded in Audit Logs.` : result.message)
  }

  if (!selectedProperty) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Property Operations"
          title="Properties"
          description="Property-level status, venue coverage, support context, health score, notes, and recent activity."
        />
        <div className="empty-state compact">No properties are available yet.</div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Property Operations"
        title="Properties"
        description="Property-level status, venue coverage, support context, health score, notes, and recent activity."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Properties" value={String(properties.length)} delta="Across all clients" tone="neutral" icon={<MapPinned size={16} />} />
        <MetricCard label="Needs Attention" value={String(attentionProperties)} delta="Property status risk" tone={attentionProperties ? 'danger' : 'ok'} icon={<HeartPulse size={16} />} />
        <MetricCard label="Setup" value={String(setupProperties)} delta="Onboarding properties" tone={setupProperties ? 'warn' : 'ok'} icon={<Building2 size={16} />} />
        <MetricCard label="Avg Health" value={String(averageHealth)} delta="Property placeholder score" tone={averageHealth < 60 ? 'warn' : 'ok'} icon={<Store size={16} />} />
      </div>

      <div className="split-layout">
        <DataTable
          label="Property Directory"
          rows={properties}
          pageSize={8}
          emptyTitle="No properties have been recorded yet."
          columns={[
            {
              key: 'property',
              header: 'Property',
              sortable: true,
              searchValue: row => `${row.name} ${organizations.find(org => org.id === row.organizationId)?.name ?? ''}`,
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
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={propertyTone(row.status)} />,
            },
            {
              key: 'venues',
              header: 'Venues',
              sortable: true,
              searchValue: row => String(row.venues),
              render: row => row.venues,
            },
            {
              key: 'health',
              header: 'Health',
              sortable: true,
              searchValue: row => String(row.healthScore),
              render: row => row.healthScore,
            },
            {
              key: 'lastActive',
              header: 'Last Active',
              sortable: true,
              searchValue: row => row.lastActive,
              render: row => row.lastActive,
            },
          ]}
        />

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">{organization?.name ?? 'Unknown Organization'}</p>
              <h2>{selectedProperty.name}</h2>
            </div>
            <StatusPill label={selectedProperty.status} tone={propertyTone(selectedProperty.status)} />
          </div>

          <div className="mini-metrics">
            <MetricCard label="Venues" value={String(selectedProperty.venues)} tone="neutral" icon={<Store size={16} />} />
            <MetricCard label="Staff" value={String(selectedProperty.staff)} tone="neutral" icon={<Building2 size={16} />} />
            <MetricCard label="Health" value={String(selectedProperty.healthScore)} tone={selectedProperty.healthScore < 60 ? 'warn' : 'ok'} icon={<HeartPulse size={16} />} />
            <MetricCard label="Open Issues" value={String(propertyIssues.length)} tone={propertyIssues.length ? 'warn' : 'ok'} icon={<MapPinned size={16} />} />
          </div>

          <div className="detail-section">
            <h3>Property Signals</h3>
            <dl className="signal-list">
              <div><dt>Location</dt><dd>{selectedProperty.location}</dd></div>
              <div><dt>Last Active</dt><dd>{selectedProperty.lastActive}</dd></div>
              <div><dt>Organization</dt><dd>{organization?.name ?? 'Unknown'}</dd></div>
              <div><dt>Status</dt><dd>{selectedProperty.status}</dd></div>
            </dl>
          </div>

          <div className="detail-section">
            <h3>Action Panel</h3>
            <div className="support-actions">
              <button className="ghost-action" onClick={recordPropertyReview}>
                <HeartPulse size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Venue Detail Records</h2>
              <span>{propertyVenues.length} loaded / {selectedProperty.venues} summarized</span>
            </div>
          </div>
          <div className="module-adoption-list">
            {propertyVenues.length ? propertyVenues.map(venue => (
              <div key={venue.id}>
                <strong>{venue.name}</strong>
                <span>{venue.status} / Notifications {venue.notificationHealth} / Last activity {venue.lastActivity}</span>
              </div>
            )) : <p className="muted-copy">{selectedProperty.venues} venues are summarized for this property, but detailed venue rows are not loaded yet.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Support Context</h2>
              <span>{propertyIssues.length} issues tied to this property</span>
            </div>
          </div>
          <div className="queue-list">
            {propertyIssues.length ? propertyIssues.map(issue => (
              <div key={issue.id}>
                <StatusPill label={issue.severity} tone={issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warn' : 'info'} />
                <strong>{issue.venueName}: {issue.issueType}</strong>
                <span>{issue.recommendedAction}</span>
              </div>
            )) : <div><strong>No open property issues.</strong><span>Support signals are clear for the selected property.</span></div>}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <HealthScorePanel
          score={selectedProperty.healthScore}
          status={selectedProperty.status}
          usageScore={Math.min(100, selectedProperty.healthScore + 4)}
          adoptionScore={propertyVenues.length ? 82 : 20}
          billingScore={organization?.billingStatus === 'Failed Payment' ? 18 : 94}
          supportScore={propertyIssues.length ? 48 : 86}
          setupScore={selectedProperty.status === 'Setup' ? 62 : 91}
        />
        <InternalNotes
          scopeType="property"
          scopeId={selectedProperty.id}
          scopeLabel={selectedProperty.name}
          notes={supportNotes}
          actor={session.name}
          actorRole={session.role}
        />
      </div>

      <ActivityTimeline title="Property Activity" events={propertyActivity} />
    </div>
  )
}
