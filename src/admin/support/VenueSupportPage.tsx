import { useState } from 'react'
import { AlertTriangle, Clock, Radio, ShieldCheck, TabletSmartphone, UserRoundSearch, Users } from 'lucide-react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import HealthScorePanel from '../../components/admin/HealthScorePanel'
import InternalNotes from '../../components/admin/InternalNotes'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { appendAuditEvent } from '../../lib/audit/auditLog'
import { activityEvents, healthChecks, moduleActivations, organizations, supportNotes, venues } from '../../lib/mock-data/mockPlatform'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'

interface VenueSupportPageProps {
  session: AdminSession
}

export default function VenueSupportPage({ session }: VenueSupportPageProps) {
  const [selectedVenueId, setSelectedVenueId] = useState(venues[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const selectedVenue = venues.find(venue => venue.id === selectedVenueId) ?? venues[0]
  const organization = organizations.find(org => org.id === selectedVenue.organizationId)
  const venueActivity = activityEvents.filter(event => event.scopeId === selectedVenue.id || event.scopeId === selectedVenue.organizationId)
  const venueModules = moduleActivations.filter(activation => activation.scopeId === selectedVenue.id || activation.scopeId === selectedVenue.organizationId)
  const canImpersonate = hasPermission(session.role, 'impersonation.start')
  const canRunChecks = hasPermission(session.role, 'troubleshooting.run')

  const startImpersonation = () => {
    if (!reason.trim()) {
      setMessage('Reason is required before starting a support session.')
      return
    }
    appendAuditEvent({
      actor: session.name,
      actorRole: roleLabels[session.role],
      scope: selectedVenue.name,
      actionKey: 'impersonation.requested.mock',
      actionLabel: `Requested view-as support session: ${reason.trim()}`,
      severity: 'warning',
    })
    setMessage('Support session request captured in the local audit trail.')
    setReason('')
  }

  const runHealthChecks = () => {
    appendAuditEvent({
      actor: session.name,
      actorRole: roleLabels[session.role],
      scope: selectedVenue.name,
      actionKey: 'health.check.run.mock',
      actionLabel: 'Ran mock venue health checks',
      severity: 'notice',
    })
    setMessage('Mock health check run captured in the local audit trail.')
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Support Workbench"
        title="Venue Support Detail"
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

      <section className="status-band">
        <div>
          <p className="eyebrow">{organization?.name} / {selectedVenue.propertyName}</p>
          <h2>{selectedVenue.name}</h2>
          <span>{selectedVenue.venueType} / Last activity {selectedVenue.lastActivity}</span>
        </div>
        <div className="status-band-actions">
          <StatusPill label={`Notifications: ${selectedVenue.notificationHealth}`} tone={selectedVenue.notificationHealth === 'Failing' ? 'danger' : selectedVenue.notificationHealth === 'Warning' ? 'warn' : 'ok'} />
          <StatusPill label={`${selectedVenue.openEscalations} escalations`} tone={selectedVenue.openEscalations > 0 ? 'warn' : 'ok'} />
        </div>
      </section>

      <div className="metrics-grid compact">
        <MetricCard label="Active Requests" value={String(selectedVenue.activeRequests)} tone={selectedVenue.activeRequests > 5 ? 'warn' : 'ok'} icon={<Radio size={16} />} />
        <MetricCard label="Staff Online" value={String(selectedVenue.staffOnline)} tone={selectedVenue.staffOnline ? 'ok' : 'danger'} icon={<Users size={16} />} />
        <MetricCard label="Devices Offline" value={String(selectedVenue.devicesOffline)} tone={selectedVenue.devicesOffline ? 'warn' : 'ok'} icon={<TabletSmartphone size={16} />} />
        <MetricCard label="Avg Response" value={selectedVenue.averageResponseSeconds ? `${selectedVenue.averageResponseSeconds}s` : 'N/A'} tone={selectedVenue.averageResponseSeconds > 120 ? 'warn' : 'ok'} icon={<Clock size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Troubleshooting Panel</h2>
              <span>Mock health checks</span>
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
