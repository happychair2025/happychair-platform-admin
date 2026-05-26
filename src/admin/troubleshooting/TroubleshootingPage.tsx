import { useState } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardList, Code2, FileSearch, RotateCw, ShieldAlert, Wrench } from 'lucide-react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { getRunbooksForIssue, type RunbookCategory, type SupportRunbook } from '../../lib/support/runbooks'
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

function categoryTone(category: RunbookCategory): 'ok' | 'warn' | 'danger' {
  if (category === 'Universal Code Issue') return 'danger'
  if (category === 'Data / Queue Repair') return 'warn'
  return 'ok'
}

export default function TroubleshootingPage({ session }: TroubleshootingPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, platformHealthSignals, supportIssues } = data
  const [selectedIssueId, setSelectedIssueId] = useState(supportIssues[0]?.id ?? '')
  const [selectedRunbookId, setSelectedRunbookId] = useState('')
  const [notice, setNotice] = useState('')
  const canRun = hasPermission(session.role, 'troubleshooting.run')
  const selectedIssue = supportIssues.find(issue => issue.id === selectedIssueId) ?? supportIssues[0]
  const matchingRunbooks = getRunbooksForIssue(selectedIssue?.issueType)
  const selectedRunbook = matchingRunbooks.find(runbook => runbook.id === selectedRunbookId) ?? matchingRunbooks[0]
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

  const recordRunbookAction = (runbook: SupportRunbook, action: 'safe_fix' | 'incident_packet') => {
    if (action === 'safe_fix' && !runbook.supportCanApply) {
      setNotice(`${runbook.title} requires ${runbook.owner} review before support can apply a fix.`)
      return
    }

    const result = runAdminAction(session, {
      permission: 'troubleshooting.run',
      scope: selectedIssue?.venueName ?? runbook.scope,
      actionKey: action === 'safe_fix' ? runbook.auditActionKey : 'runbook.engineering_incident_packet.mock',
      actionLabel: `${action === 'safe_fix' ? 'Applied safe runbook' : 'Created incident packet'}: ${runbook.title}`,
      severity: runbook.category === 'Universal Code Issue' || action === 'incident_packet' ? 'warning' : 'notice',
    })

    setNotice(result.ok
      ? `${action === 'safe_fix' ? 'Safe fix recorded' : 'Incident packet recorded'} for ${runbook.title}.`
      : result.message)
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
                onClick={() => {
                  setSelectedIssueId(issue.id)
                  setSelectedRunbookId('')
                }}
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

          {selectedRunbook && (
            <div className="runbook-panel">
              <div className="panel-header">
                <div>
                  <h2>Diagnose + Remediate</h2>
                  <span>Support-safe fixes stay scoped; universal code issues become engineering incidents.</span>
                </div>
                <StatusPill label={selectedRunbook.category} tone={categoryTone(selectedRunbook.category)} />
              </div>

              <div className="runbook-card-list">
                {matchingRunbooks.map(runbook => (
                  <button
                    key={runbook.id}
                    className={`runbook-card${runbook.id === selectedRunbook.id ? ' selected' : ''}`}
                    onClick={() => setSelectedRunbookId(runbook.id)}
                  >
                    <span className="module-icon" aria-hidden="true">
                      {runbook.category === 'Universal Code Issue' ? <Code2 size={17} strokeWidth={1.8} /> : <ClipboardList size={17} strokeWidth={1.8} />}
                    </span>
                    <span>
                      <strong>{runbook.title}</strong>
                      <small>{runbook.scope} / {runbook.owner}</small>
                    </span>
                    <StatusPill label={runbook.supportCanApply ? 'Support Fix' : 'Escalate'} tone={runbook.supportCanApply ? 'ok' : 'warn'} />
                  </button>
                ))}
              </div>

              <div className="runbook-meta-grid">
                <div><span>Scope</span><strong>{selectedRunbook.scope}</strong></div>
                <div><span>Confidence</span><strong>{selectedRunbook.confidence}</strong></div>
                <div><span>Execution</span><strong>{selectedRunbook.serverSideRequired ? 'Server-side' : 'Support workflow'}</strong></div>
                <div><span>Owner</span><strong>{selectedRunbook.owner}</strong></div>
              </div>

              <div className="runbook-columns">
                <div>
                  <h3>Diagnosis Signals</h3>
                  {selectedRunbook.diagnosisSignals.map(signal => <p key={signal}><FileSearch size={15} strokeWidth={1.8} />{signal}</p>)}
                </div>
                <div>
                  <h3>Safe Actions</h3>
                  {selectedRunbook.safeActions.map(action => <p key={action}><CheckCircle2 size={15} strokeWidth={1.8} />{action}</p>)}
                </div>
                <div>
                  <h3>Blocked</h3>
                  {selectedRunbook.blockedActions.map(action => <p key={action}><ShieldAlert size={15} strokeWidth={1.8} />{action}</p>)}
                </div>
              </div>

              <div className="diagnosis-block universal-boundary">
                <Code2 size={18} strokeWidth={1.8} />
                <div>
                  <h3>Universal Code Boundary</h3>
                  <p>{selectedRunbook.engineeringPath}</p>
                </div>
              </div>

              <div className="support-actions">
                <button className="ghost-action" disabled={!canRun || !selectedRunbook.supportCanApply} onClick={() => recordRunbookAction(selectedRunbook, 'safe_fix')}>
                  <RotateCw size={15} strokeWidth={1.8} />
                  Apply Safe Fix
                </button>
                <button className="ghost-action" disabled={!canRun} onClick={() => recordRunbookAction(selectedRunbook, 'incident_packet')}>
                  <ArrowUpRight size={15} strokeWidth={1.8} />
                  Create Incident Packet
                </button>
              </div>
            </div>
          )}
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
