import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, Radio, ShieldCheck, TabletSmartphone, UserRoundSearch, Users } from 'lucide-react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import HealthScorePanel from '../../components/admin/HealthScorePanel'
import InternalNotes from '../../components/admin/InternalNotes'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { healthChecks } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface VenueSupportPageProps {
  session: AdminSession
  initialVenueId?: string
}

export default function VenueSupportPage({ session, initialVenueId }: VenueSupportPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, moduleActivations, organizations, supportNotes, venues } = data
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId ?? venues[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const selectedVenue = venues.find(venue => venue.id === selectedVenueId) ?? venues[0]
  const organization = selectedVenue ? organizations.find(org => org.id === selectedVenue.organizationId) : undefined
  const venueActivity = selectedVenue ? activityEvents.filter(event => event.scopeId === selectedVenue.id || event.scopeId === selectedVenue.organizationId) : []
  const venueModules = selectedVenue ? moduleActivations.filter(activation => activation.scopeId === selectedVenue.id || activation.scopeId === selectedVenue.organizationId) : []
  const canImpersonate = hasPermission(session.role, 'impersonation.start')
  const canRunChecks = hasPermission(session.role, 'troubleshooting.run')

  useEffect(() => {
    if (initialVenueId && venues.some(venue => venue.id === initialVenueId)) {
      setSelectedVenueId(initialVenueId)
    }
  }, [initialVenueId, venues])

  const startImpersonation = () => {
    if (!reason.trim()) {
      setMessage('Reason is required before starting a support session.')
      return
    }
    const result = queueAdminActionRequest(session, {
      actionType: 'impersonation_start',
      title: `Request scoped view-as setup for ${selectedVenue?.name ?? 'selected venue'}`,
      permission: 'impersonation.start',
      scope: createAdminActionScope({
        organizationId: selectedVenue?.organizationId,
        organizationName: organization?.name,
        propertyName: selectedVenue?.propertyName,
        venueId: selectedVenue?.id,
        venueName: selectedVenue?.name,
      }),
      reason: reason.trim(),
      rollbackNotes: 'Do not create or expose a view-as session if user targeting, expiry, or permission checks fail.',
      severity: 'warning',
      metadata: {
        venueId: selectedVenue?.id,
        venueName: selectedVenue?.name,
        targetSelectionRequired: true,
      },
    })
    setMessage(result.ok ? 'View-as setup request added to Admin Action Requests.' : result.message)
    if (!result.ok) return
    setReason('')
  }

  const runHealthChecks = () => {
    const result = queueAdminActionRequest(session, {
      actionType: 'support_troubleshooting_action',
      title: `Run support health checks for ${selectedVenue?.name ?? 'selected venue'}`,
      permission: 'troubleshooting.run',
      scope: createAdminActionScope({
        organizationId: selectedVenue?.organizationId,
        organizationName: organization?.name,
        propertyName: selectedVenue?.propertyName,
        venueId: selectedVenue?.id,
        venueName: selectedVenue?.name,
      }),
      reason: 'Support requested a fresh venue health check run from the workbench.',
      rollbackNotes: 'Health checks should not mutate tenant state. If handler execution fails, preserve the existing support view and write a failed activity note.',
      severity: 'notice',
      metadata: {
        venueId: selectedVenue?.id,
        venueName: selectedVenue?.name,
        checkKeys: healthChecks.map(check => check.id),
      },
    })
    setMessage(result.ok ? 'Health check run added to Admin Action Requests.' : result.message)
  }

  if (!selectedVenue) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Support Workbench"
          title="Venue Support Workbench"
          description="Operational status, live support signals, health checks, troubleshooting, notes, and impersonation foundation."
        />
        <div className="empty-state compact">No venues are available yet.</div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Support Workbench"
        title="Venue Support Workbench"
        description="Operational status, live support signals, health checks, troubleshooting, notes, and impersonation foundation."
      />

      <div className="support-selector">
        {venues.map(venue => (
          <button
            key={venue.id}
            className={venue.id === selectedVenueId ? 'selected' : ''}
            onClick={() => setSelectedVenueId(venue.id)}
          >
            <StoreIcon />
            <span>{venue.name}</span>
            <StatusPill label={venue.status} tone={venue.status === 'Needs Attention' ? 'danger' : 'ok'} />
          </button>
        ))}
      </div>

      {selectedVenue && <section className="status-band">
        <div>
          <p className="eyebrow">{organization?.name} / {selectedVenue.propertyName}</p>
          <h2>{selectedVenue.name}</h2>
          <span>{selectedVenue.venueType} / Last activity {selectedVenue.lastActivity}</span>
        </div>
        <div className="status-band-actions">
          <StatusPill label={`Notifications: ${selectedVenue.notificationHealth}`} tone={selectedVenue.notificationHealth === 'Failing' ? 'danger' : selectedVenue.notificationHealth === 'Warning' ? 'warn' : 'ok'} />
          <StatusPill label={`${selectedVenue.openEscalations} escalations`} tone={selectedVenue.openEscalations > 0 ? 'warn' : 'ok'} />
        </div>
      </section>}

      {!selectedVenue && <div className="empty-state compact">No venues are available yet.</div>}

      {selectedVenue && <div className="metrics-grid compact">
        <MetricCard label="Active Requests" value={String(selectedVenue.activeRequests)} tone={selectedVenue.activeRequests > 5 ? 'warn' : 'ok'} icon={<Radio size={16} />} />
        <MetricCard label="Staff Online" value={String(selectedVenue.staffOnline)} tone={selectedVenue.staffOnline ? 'ok' : 'danger'} icon={<Users size={16} />} />
        <MetricCard label="Devices Offline" value={String(selectedVenue.devicesOffline)} tone={selectedVenue.devicesOffline ? 'warn' : 'ok'} icon={<TabletSmartphone size={16} />} />
        <MetricCard label="Avg Response" value={selectedVenue.averageResponseSeconds ? `${selectedVenue.averageResponseSeconds}s` : 'N/A'} tone={selectedVenue.averageResponseSeconds > 120 ? 'warn' : 'ok'} icon={<Clock size={16} />} />
      </div>}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Troubleshooting Panel</h2>
              <span>Server-requested health checks</span>
            </div>
            <button className="ghost-action" disabled={!canRunChecks} onClick={runHealthChecks}>
              <ShieldCheck size={16} strokeWidth={1.8} />
              Run Checks
            </button>
          </div>
          <div className="health-list">
            {healthChecks.map(check => (
              <article key={check.id} className={`health-item tone-${check.severity}`}>
                <div>
                  <StatusPill label={check.status} tone={check.status === 'Failing' ? 'danger' : check.status === 'Warning' ? 'warn' : 'ok'} />
                  <h3>{check.check}</h3>
                  <p>{check.message}</p>
                  <span>{check.recommendedAction}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Secure Impersonation</h2>
              <span>Reason-required support foundation</span>
            </div>
            <UserRoundSearch size={18} strokeWidth={1.8} />
          </div>
          <div className="impersonation-box">
            <label className="field">
              <span>Reason</span>
              <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Describe the support need." />
            </label>
            <button className="primary-action" disabled={!canImpersonate} onClick={startImpersonation}>
              Request View-As Session
            </button>
            {!canImpersonate && <p className="warning-copy">Your role cannot start impersonation sessions.</p>}
            {message && <p className="muted-copy">{message}</p>}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <HealthScorePanel
          score={organization?.healthScore ?? 70}
          status={organization?.healthStatus ?? 'Needs Attention'}
          usageScore={organization?.usageScore ?? 50}
          adoptionScore={selectedVenue.staffOnline ? 82 : 18}
          billingScore={organization?.billingStatus === 'Failed Payment' ? 18 : 94}
          supportScore={selectedVenue.openEscalations > 1 ? 34 : 77}
          setupScore={selectedVenue.status === 'Setup' ? 62 : 91}
        />

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Module Snapshot</h2>
              <span>Activation and usage context</span>
            </div>
            <AlertTriangle size={18} strokeWidth={1.8} />
          </div>
          <div className="module-adoption-list">
            {venueModules.length ? venueModules.map(activation => (
              <div key={activation.id}>
                <strong>{activation.moduleName}</strong>
                <span>{activation.activationLevel} / {activation.usageLast7Days} uses in 7 days</span>
              </div>
            )) : <p className="muted-copy">No activation records found for this venue.</p>}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <ActivityTimeline title="Recent Support Signals" events={venueActivity} />
        <InternalNotes
          scopeType="venue"
          scopeId={selectedVenue.id}
          scopeLabel={selectedVenue.name}
          notes={supportNotes}
          actor={session.name}
          actorRole={session.role}
        />
      </div>
    </div>
  )
}

function StoreIcon() {
  return <span className="store-dot" aria-hidden="true" />
}
