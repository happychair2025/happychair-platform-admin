import { AlertTriangle, BellRing, FileCheck2, ListChecks, Megaphone, Radio, ShieldCheck, Siren, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import {
  buildIncidentCommandCenter,
  getIncidentSeverityTone,
  getIncidentStatusTone,
  type IncidentCommandRecord,
  type IncidentSeverity,
} from '../../lib/incidents/incidentCommand'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface IncidentCommandPageProps {
  session: AdminSession
  onOpenActionRequests: () => void
}

const severityFilters: Array<'All' | IncidentSeverity> = ['All', 'SEV1', 'SEV2', 'SEV3', 'SEV4']

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function commsTone(status: IncidentCommandRecord['commsStatus']): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Draft Needed') return 'warn'
  if (status === 'Ready To Send') return 'info'
  if (status === 'Sent') return 'ok'
  return 'neutral'
}

function postmortemTone(status: IncidentCommandRecord['postmortemStatus']): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Required') return 'danger'
  if (status === 'Draft Needed') return 'warn'
  return 'neutral'
}

function timelineTone(source: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (source === 'Health') return 'danger'
  if (source === 'Support') return 'warn'
  if (source === 'Action Request') return 'info'
  return 'neutral'
}

export default function IncidentCommandPage({ session, onOpenActionRequests }: IncidentCommandPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const [selectedId, setSelectedId] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState<'All' | IncidentSeverity>('All')
  const [notice, setNotice] = useState('')

  const actionRequests = useMemo(() => {
    return [
      ...localRequests,
      ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
    ]
  }, [data.adminActionRequests, localRequests])
  const incidents = useMemo(() => buildIncidentCommandCenter(data, actionRequests), [actionRequests, data])
  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => selectedSeverity === 'All' || incident.severity === selectedSeverity)
  }, [incidents, selectedSeverity])
  const selectedIncident = filteredIncidents.find(incident => incident.id === selectedId) ?? filteredIncidents[0] ?? incidents[0]
  const activeCount = incidents.filter(incident => incident.status !== 'Resolved').length
  const severeCount = incidents.filter(incident => incident.severity === 'SEV1' || incident.severity === 'SEV2').length
  const affectedClients = incidents.reduce((sum, incident) => sum + incident.affectedClients, 0)
  const postmortemsDue = incidents.filter(incident => incident.postmortemStatus === 'Required' || incident.postmortemStatus === 'Draft Needed').length

  const recordIncidentReview = (incident: IncidentCommandRecord) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: incident.title,
      actionKey: 'incident_command.reviewed.mock',
      actionLabel: `Reviewed incident command packet for ${incident.title}`,
      severity: incident.severity === 'SEV1' || incident.severity === 'SEV2' ? 'warning' : 'notice',
      metadata: {
        incidentId: incident.id,
        severity: incident.severity,
        status: incident.status,
        commander: incident.commander,
        affectedClients: incident.affectedClients,
        affectedVenues: incident.affectedVenues,
        commsStatus: incident.commsStatus,
        postmortemStatus: incident.postmortemStatus,
        linkedSupportIssues: incident.linkedSupportIssues.map(issue => issue.id),
        linkedHealthSignals: incident.linkedHealthSignals.map(signal => signal.id),
        linkedActionRequests: incident.linkedActionRequests.map(request => request.id),
      },
    })
    setNotice(result.ok ? `Incident review recorded for ${incident.title}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Reliability Operations"
        title="Incident Command"
        description="Client-impacting failures, platform health incidents, support escalations, comms readiness, and postmortem discipline."
        action={<StatusPill label={`${sourceLabel} signals`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Active Incidents" value={String(activeCount)} delta="Open reliability work" tone={activeCount ? 'warn' : 'ok'} icon={<Siren size={16} />} />
        <MetricCard label="SEV1 / SEV2" value={String(severeCount)} delta="Customer-impacting" tone={severeCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Affected Clients" value={String(affectedClients)} delta="Summed across incidents" tone={affectedClients ? 'warn' : 'ok'} icon={<UsersRound size={16} />} />
        <MetricCard label="Postmortems" value={String(postmortemsDue)} delta="Required or draft needed" tone={postmortemsDue ? 'warn' : 'ok'} icon={<FileCheck2 size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Incident Boundary</p>
          <h2>Coordinate response here, execute changes through approved paths</h2>
          <span>Incident Command gathers impact, timeline, communications, and follow-up. Any production-changing mitigation still goes through server-side action requests.</span>
        </div>
        <StatusPill label={`${incidents.length} incident packets`} tone="info" />
      </section>

      <div className="support-selector" aria-label="Incident severity filters">
        {severityFilters.map(severity => (
          <button key={severity} className={selectedSeverity === severity ? 'selected' : ''} onClick={() => setSelectedSeverity(severity)}>
            <Radio size={15} strokeWidth={1.8} />
            {severity}
          </button>
        ))}
      </div>

      <div className="incident-layout">
        <DataTable
          label="Incident Packets"
          rows={filteredIncidents}
          pageSize={8}
          emptyTitle="No incidents match the current severity filter."
          columns={[
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => row.severity,
              render: row => <StatusPill label={row.severity} tone={getIncidentSeverityTone(row.severity)} />,
            },
            {
              key: 'incident',
              header: 'Incident',
              sortable: true,
              searchValue: row => `${row.title} ${row.customerImpact} ${row.currentMitigation}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getIncidentStatusTone(row.status)} />,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.scope,
              render: row => row.scope,
            },
            {
              key: 'commander',
              header: 'Commander',
              sortable: true,
              searchValue: row => row.commander,
              render: row => <strong>{row.commander}</strong>,
            },
            {
              key: 'impact',
              header: 'Impact',
              sortable: true,
              searchValue: row => `${row.affectedClients} ${row.affectedVenues}`,
              render: row => `${row.affectedClients} clients / ${row.affectedVenues} venues`,
            },
            {
              key: 'updated',
              header: 'Updated',
              sortable: true,
              searchValue: row => row.updatedAt,
              render: row => formatDateTime(row.updatedAt),
            },
          ]}
        />

        <aside className="detail-panel incident-detail-panel">
          {selectedIncident ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Incident Detail</p>
                  <h2>{selectedIncident.title}</h2>
                </div>
                <StatusPill label={selectedIncident.severity} tone={getIncidentSeverityTone(selectedIncident.severity)} />
              </div>

              <div className="request-scope-list">
                <div><span>Status</span><strong>{selectedIncident.status}</strong></div>
                <div><span>Commander</span><strong>{selectedIncident.commander}</strong></div>
                <div><span>Scope</span><strong>{selectedIncident.scope}</strong></div>
                <div><span>Impact</span><strong>{selectedIncident.affectedClients} clients / {selectedIncident.affectedVenues} venues</strong></div>
                <div><span>Comms</span><strong>{selectedIncident.commsStatus}</strong></div>
                <div><span>Postmortem</span><strong>{selectedIncident.postmortemStatus}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Customer Impact</h3>
                <p className="muted-copy">{selectedIncident.customerImpact}</p>
              </div>

              <div className="detail-section">
                <h3>Current Mitigation</h3>
                <p className="muted-copy">{selectedIncident.currentMitigation}</p>
              </div>

              <div className="incident-readiness-grid">
                <div>
                  <Megaphone size={16} strokeWidth={1.8} />
                  <strong>Client Comms</strong>
                  <StatusPill label={selectedIncident.commsStatus} tone={commsTone(selectedIncident.commsStatus)} />
                </div>
                <div>
                  <FileCheck2 size={16} strokeWidth={1.8} />
                  <strong>Postmortem</strong>
                  <StatusPill label={selectedIncident.postmortemStatus} tone={postmortemTone(selectedIncident.postmortemStatus)} />
                </div>
              </div>

              <div className="detail-section">
                <h3>Timeline</h3>
                <div className="incident-timeline-list">
                  {selectedIncident.timeline.map(event => (
                    <article key={event.id} className="incident-timeline-item">
                      <div>
                        <strong>{event.label}</strong>
                        <StatusPill label={event.source} tone={timelineTone(event.source)} />
                      </div>
                      <p>{event.detail}</p>
                      <span>{formatDateTime(event.createdAt)}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Linked Signals</h3>
                <div className="settings-rule-list">
                  {selectedIncident.linkedHealthSignals.map(signal => (
                    <div key={signal.id}>
                      <BellRing size={16} strokeWidth={1.8} />
                      <strong>{signal.label}: {signal.message}</strong>
                    </div>
                  ))}
                  {selectedIncident.linkedSupportIssues.map(issue => (
                    <div key={issue.id}>
                      <Siren size={16} strokeWidth={1.8} />
                      <strong>{issue.issueType} / {issue.venueName}: {issue.status}</strong>
                    </div>
                  ))}
                  {!selectedIncident.linkedHealthSignals.length && !selectedIncident.linkedSupportIssues.length && (
                    <div>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>No linked health or support signal.</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordIncidentReview(selectedIncident)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  {selectedIncident.linkedActionRequests.length > 0 && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <ListChecks size={15} strokeWidth={1.8} />
                      Open Requests
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No incident selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
