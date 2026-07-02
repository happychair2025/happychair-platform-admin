import { AlertTriangle, CheckCircle2, Clock, LifeBuoy, Radio, Store, UserCheck } from 'lucide-react'
import { useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import type { SupportIssue } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface SupportCenterPageProps {
  session: AdminSession
  onOpenVenueSupport?: (venueId: string) => void
}

function severityTone(severity: string) {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warn'
  if (severity === 'notice') return 'info'
  return 'ok'
}

export default function SupportCenterPage({ session, onOpenVenueSupport }: SupportCenterPageProps) {
  const { data } = usePlatformData()
  const [notice, setNotice] = useState('')
  const { organizations, supportIssues, venues } = data
  const canManage = hasPermission(session.role, 'support.manage')
  const openIssues = supportIssues.filter(issue => issue.status !== 'Resolved')
  const criticalIssues = supportIssues.filter(issue => issue.severity === 'critical')
  const inactiveVenues = venues.filter(venue => venue.lastActivity.includes('days'))
  const failedNotifications = venues.filter(venue => venue.notificationHealth === 'Failing')
  const atRiskClients = organizations.filter(org => org.accountStatus === 'At Risk')

  const openVenueSupport = (venueName: string) => {
    const venue = venues.find(row => row.name === venueName)
    if (!venue) {
      setNotice(`No venue detail row is loaded for ${venueName}.`)
      return
    }
    onOpenVenueSupport?.(venue.id)
  }

  const queueSupportAction = (action: string, issue: SupportIssue) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'support_troubleshooting_action',
      title: `${action.replace(/_/g, ' ')} for ${issue.venueName}`,
      permission: 'support.manage',
      scope: createAdminActionScope({
        organizationName: issue.organizationName,
        propertyName: issue.propertyName,
        venueName: issue.venueName,
      }),
      reason: `${action.replace(/_/g, ' ')} was requested from Support Center. Production support lifecycle changes must run through the server-side handler.`,
      rollbackNotes: 'Leave the support issue unchanged and append a failed activity note if the server handler cannot write the lifecycle event.',
      severity: 'notice',
      metadata: {
        supportIssueId: issue.id,
        supportIssueType: issue.issueType,
        previousStatus: issue.status,
        requestedLifecycleAction: action,
      },
    })
    setNotice(result.ok ? `Support action for ${issue.venueName} queued.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Support Operations"
        title="Support Center"
        description="Open issues, at-risk venues, inactive accounts, failed notification signals, and escalation workflow foundation."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Issues" value={String(openIssues.length)} delta="Support workload" tone={openIssues.length ? 'warn' : 'ok'} icon={<LifeBuoy size={16} />} />
        <MetricCard label="Critical Issues" value={String(criticalIssues.length)} delta="Needs action now" tone={criticalIssues.length ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Inactive Venues" value={String(inactiveVenues.length)} delta="No activity in days" tone={inactiveVenues.length ? 'warn' : 'ok'} icon={<Clock size={16} />} />
        <MetricCard label="Failed Notifications" value={String(failedNotifications.length)} delta="Delivery health risk" tone={failedNotifications.length ? 'danger' : 'ok'} icon={<Radio size={16} />} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Support Action Queue</h2>
              <span>Highest priority work for Team Happy Chair</span>
            </div>
          </div>
          <div className="support-issue-list">
            {openIssues.map(issue => (
              <article key={issue.id} className={`support-issue-card tone-${issue.severity}`}>
                <div className="timeline-title">
                  <strong>{issue.venueName}</strong>
                  <StatusPill label={issue.severity} tone={severityTone(issue.severity)} />
                </div>
                <p>{issue.issueType} / {issue.relatedSignal}</p>
                <span>{issue.recommendedAction}</span>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => openVenueSupport(issue.venueName)}>
                    <Store size={15} strokeWidth={1.8} />
                    Workbench
                  </button>
                  <button className="ghost-action" disabled={!canManage} onClick={() => queueSupportAction('assigned_owner', issue)}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Assign Owner
                  </button>
                  <button className="ghost-action" disabled={!canManage} onClick={() => queueSupportAction('marked_investigating', issue)}>
                    <LifeBuoy size={15} strokeWidth={1.8} />
                    Investigating
                  </button>
                  <button className="ghost-action" disabled={!canManage} onClick={() => queueSupportAction('marked_resolved', issue)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Resolve
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Support Watchlists</h2>
              <span>Signals that need human follow-up</span>
            </div>
          </div>
          <div className="queue-list">
            <div>
              <StatusPill label="At Risk" tone="danger" />
              <strong>{atRiskClients.length} at-risk clients</strong>
              <span>{atRiskClients.map(client => client.name).join(', ')}</span>
            </div>
            <div>
              <StatusPill label="Inactive" tone="warn" />
              <strong>{inactiveVenues.length} inactive venues</strong>
              <span>{inactiveVenues.map(venue => venue.name).join(', ') || 'No inactive venues.'}</span>
            </div>
            <div>
              <StatusPill label="Notifications" tone={failedNotifications.length ? 'danger' : 'ok'} />
              <strong>{failedNotifications.length} failed notification venues</strong>
              <span>{failedNotifications.map(venue => venue.name).join(', ') || 'Notification delivery is healthy.'}</span>
            </div>
          </div>
        </section>
      </div>

      <DataTable
        label="Support Issues"
        rows={supportIssues}
        columns={[
          {
            key: 'venue',
            header: 'Venue',
            sortable: true,
            searchValue: row => row.venueName,
            render: row => <button className="table-link" onClick={() => openVenueSupport(row.venueName)}>{row.venueName}</button>,
          },
          {
            key: 'issue',
            header: 'Issue',
            sortable: true,
            searchValue: row => row.issueType,
            render: row => row.issueType,
          },
          {
            key: 'severity',
            header: 'Severity',
            sortable: true,
            searchValue: row => row.severity,
            render: row => <StatusPill label={row.severity} tone={severityTone(row.severity)} />,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={row.status === 'Resolved' ? 'ok' : row.status === 'Escalated' ? 'danger' : 'warn'} />,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
        ]}
      />
    </div>
  )
}
