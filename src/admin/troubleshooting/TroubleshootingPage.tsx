import { useState } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, FileSearch, Wrench } from 'lucide-react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface TroubleshootingPageProps {
  session: AdminSession
}

function severityTone(severity: string) {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warn'
  if (severity === 'notice') return 'info'
  return 'ok'
}

export default function TroubleshootingPage({ session }: TroubleshootingPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, platformHealthSignals, supportIssues } = data
  const [selectedIssueId, setSelectedIssueId] = useState(supportIssues[0]?.id ?? '')
  const [notice, setNotice] = useState('')
  const canRun = hasPermission(session.role, 'troubleshooting.run')
  const selectedIssue = supportIssues.find(issue => issue.id === selectedIssueId) ?? supportIssues[0]
  const relatedHealth = selectedIssue ? platformHealthSignals.filter(signal => {
    if (selectedIssue.issueType === 'Notification Delivery') return signal.checkKey === 'notification_delivery'
    if (selectedIssue.issueType === 'Device Offline') return signal.checkKey === 'device_presence'
    if (selectedIssue.issueType === 'QR Scan Failure') return signal.checkKey === 'qr_scans'
    if (selectedIssue.issueType === 'Module Configuration') return signal.checkKey === 'module_configuration'
    if (selectedIssue.issueType === 'Stalled Queue' || selectedIssue.issueType === 'High Escalations') return signal.checkKey === 'service_queue'
    return signal.status !== 'Passing'
  }) : []

  const auditAction = (action: string) => {
    const result = runAdminAction(session, {
      permission: 'troubleshooting.run',
      scope: selectedIssue?.venueName ?? 'Troubleshooting',
      actionKey: `troubleshooting.${action}.mock`,
      actionLabel: `${action} troubleshooting action for ${selectedIssue?.venueName ?? 'selected issue'}`,
      severity: action === 'escalated' ? 'warning' : 'notice',
    })
    setNotice(result.ok ? `Troubleshooting action recorded for ${selectedIssue?.venueName ?? 'selected issue'}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Issue Diagnosis"
        title="Troubleshooting"
        description="Detected issue, severity, affected venue, probable cause, recommended action, related logs, and escalation path."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="troubleshooting-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Detected Issues</h2>
              <span>{supportIssues.length} mock issues</span>
            </div>
            <FileSearch size={18} strokeWidth={1.8} />
          </div>
          <div className="issue-picker-list">
            {supportIssues.map(issue => (
              <button
                key={issue.id}
                className={issue.id === selectedIssue?.id ? 'selected' : ''}
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <div>
                  <strong>{issue.venueName}</strong>
                  <span>{issue.issueType}</span>
                </div>
                <StatusPill label={issue.severity} tone={severityTone(issue.severity)} />
              </button>
            ))}
          </div>
        </section>

        {selectedIssue ? <section className="detail-panel issue-detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">{selectedIssue.organizationName} / {selectedIssue.propertyName}</p>
              <h2>{selectedIssue.issueType}</h2>
            </div>
            <StatusPill label={selectedIssue.status} tone={selectedIssue.status === 'Escalated' ? 'danger' : selectedIssue.status === 'Resolved' ? 'ok' : 'warn'} />
          </div>

          <div className="issue-summary-grid">
            <div><span>Venue</span><strong>{selectedIssue.venueName}</strong></div>
            <div><span>Severity</span><strong>{selectedIssue.severity}</strong></div>
            <div><span>Affected Users</span><strong>{selectedIssue.affectedUsers}</strong></div>
            <div><span>Owner</span><strong>{selectedIssue.owner}</strong></div>
          </div>

          <div className="diagnosis-block">
            <AlertTriangle size={18} strokeWidth={1.8} />
            <div>
              <h3>Probable Cause</h3>
              <p>{selectedIssue.probableCause}</p>
            </div>
          </div>

          <div className="diagnosis-block">
            <Wrench size={18} strokeWidth={1.8} />
            <div>
              <h3>Recommended Action</h3>
              <p>{selectedIssue.recommendedAction}</p>
            </div>
          </div>

          <div className="support-actions">
            <button className="ghost-action" disabled={!canRun} onClick={() => auditAction('investigating')}>
              <FileSearch size={15} strokeWidth={1.8} />
              Mark Investigating
            </button>
            <button className="ghost-action" disabled={!canRun} onClick={() => auditAction('escalated')}>
              <ArrowUpRight size={15} strokeWidth={1.8} />
              Open Escalation
            </button>
            <button className="ghost-action" disabled={!canRun} onClick={() => auditAction('resolved')}>
              <CheckCircle2 size={15} strokeWidth={1.8} />
              Mark Resolved
            </button>
          </div>
        </section> : <section className="detail-panel"><div className="empty-state compact">No troubleshooting issues are available yet.</div></section>}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Related Health Signals</h2>
              <span>Signals connected to the selected issue</span>
            </div>
          </div>
          <div className="health-list">
            {relatedHealth.map(signal => (
              <article key={signal.id} className="health-item">
                <StatusPill label={signal.status} tone={signal.status === 'Failing' ? 'danger' : signal.status === 'Warning' ? 'warn' : 'ok'} />
                <h3>{signal.label}</h3>
                <p>{signal.message}</p>
                <span>{signal.recommendedAction}</span>
              </article>
            ))}
          </div>
        </section>

        <ActivityTimeline title="Related Logs / Events" events={activityEvents.filter(event => event.type === 'health' || event.type === 'support')} />
      </div>
    </div>
  )
}
