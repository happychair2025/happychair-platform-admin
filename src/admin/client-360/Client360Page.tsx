import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CircleDollarSign,
  GitBranch,
  HeartPulse,
  ListChecks,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import DataTable from '../../components/admin/DataTable'
import InternalNotes from '../../components/admin/InternalNotes'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import {
  buildClient360Profile,
  type Client360GraphNode,
  type Client360Profile,
  type Client360Tone,
  type Client360WorkItem,
} from '../../lib/client-360/client360'
import type { OrganizationSummary } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface Client360PageProps {
  session: AdminSession
  initialOrganizationId?: string
  onOpenActionRequests: () => void
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function statusTone(status: OrganizationSummary['healthStatus'] | OrganizationSummary['accountStatus'] | string): Client360Tone {
  if (status === 'At Risk' || status === 'Failed Payment' || status === 'Critical') return 'danger'
  if (status === 'Needs Attention' || status === 'Trial' || status === 'High') return 'warn'
  if (status === 'Expansion Candidate' || status === 'Growing') return 'info'
  return 'ok'
}

function priorityTone(priority: Client360WorkItem['priority']): Client360Tone {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'neutral'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatReadable(value: string) {
  return value.split('_').join(' ')
}

function nodeTypeIcon(type: Client360GraphNode['type']) {
  if (type === 'Organization') return <Building2 size={15} strokeWidth={1.8} />
  if (type === 'Property') return <MapPinned size={15} strokeWidth={1.8} />
  if (type === 'Venue') return <Store size={15} strokeWidth={1.8} />
  if (type === 'Module') return <PackageCheck size={15} strokeWidth={1.8} />
  if (type === 'Support') return <AlertTriangle size={15} strokeWidth={1.8} />
  if (type === 'Billing') return <CircleDollarSign size={15} strokeWidth={1.8} />
  if (type === 'Agent') return <Bot size={15} strokeWidth={1.8} />
  return <ListChecks size={15} strokeWidth={1.8} />
}

function graphColumns(profile: Client360Profile) {
  const order: Client360GraphNode['type'][] = ['Organization', 'Property', 'Venue', 'Module', 'Support', 'Billing', 'Action', 'Agent']
  return order
    .map(type => ({
      type,
      nodes: profile.graph.nodes.filter(node => node.type === type),
    }))
    .filter(column => column.nodes.length)
}

export default function Client360Page({ session, initialOrganizationId, onOpenActionRequests }: Client360PageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const [selectedId, setSelectedId] = useState(initialOrganizationId ?? data.organizations[0]?.id ?? '')
  const [notice, setNotice] = useState('')

  const actionRequests = useMemo(() => {
    return [
      ...localRequests,
      ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
    ]
  }, [data.adminActionRequests, localRequests])
  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])
  const auditEvents = useMemo(() => {
    return [
      ...localAuditEvents,
      ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.auditEvents, localAuditEvents])
  const profile = useMemo(() => buildClient360Profile(data, selectedId, actionRequests, auditEvents, agentEvents), [actionRequests, agentEvents, auditEvents, data, selectedId])

  useEffect(() => {
    if (initialOrganizationId && data.organizations.some(org => org.id === initialOrganizationId)) {
      setSelectedId(initialOrganizationId)
    }
  }, [data.organizations, initialOrganizationId])

  const recordReview = () => {
    if (!profile) return
    const result = runAdminAction(session, {
      permission: 'clients.view',
      scope: profile.organization.name,
      actionKey: 'client_360.reviewed.mock',
      actionLabel: `Reviewed Client 360 for ${profile.organization.name}`,
      severity: profile.organization.accountStatus === 'At Risk' ? 'warning' : 'notice',
      metadata: {
        organizationId: profile.organization.id,
        openWorkItems: profile.workItems.length,
        supportIssues: profile.supportIssues.length,
        actionRequests: profile.actionRequests.length,
      },
    })
    setNotice(result.ok ? `Client 360 review recorded for ${profile.organization.name}.` : result.message)
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="Client Command" title="Client 360" description="No organization is available in the current read model." />
      </div>
    )
  }

  const openWorkCount = profile.workItems.length
  const atRiskAmount = profile.billingRisks.reduce((sum, risk) => sum + risk.amountAtRisk, 0)
  const moduleRevenue = profile.modules.reduce((sum, module) => sum + module.revenueAttributed, 0)
  const graphNodeColumns = graphColumns(profile)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Client Command"
        title="Client 360"
        description="One operating view for a client relationship: account, revenue, properties, venues, modules, risk, work, activity, and audit context."
        action={(
          <label className="field compact-field client360-switcher">
            <span>Client</span>
            <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
              {data.organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
        )}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <section className="status-band client360-status-band">
        <div>
          <p className="eyebrow">Account Header</p>
          <h2>{profile.organization.name}</h2>
          <span>{profile.organization.marketType} / {profile.organization.plan} / {sourceLabel}</span>
        </div>
        <div className="status-band-actions">
          <StatusPill label={profile.organization.accountStatus} tone={statusTone(profile.organization.accountStatus)} />
          <StatusPill label={profile.organization.healthStatus} tone={statusTone(profile.organization.healthStatus)} />
          <button className="ghost-action" onClick={recordReview}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Review
          </button>
          <button className="ghost-action" onClick={onOpenActionRequests}>
            <ListChecks size={15} strokeWidth={1.8} />
            Action Requests
          </button>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard label="MRR" value={currency.format(profile.organization.mrr)} delta={profile.organization.billingStatus} tone={profile.organization.billingStatus === 'Failed Payment' ? 'danger' : 'ok'} icon={<CircleDollarSign size={16} />} />
        <MetricCard label="Health Score" value={String(profile.organization.healthScore)} delta={profile.organization.healthStatus} tone={profile.organization.healthStatus === 'At Risk' ? 'danger' : profile.organization.healthStatus === 'Needs Attention' ? 'warn' : 'ok'} icon={<HeartPulse size={16} />} />
        <MetricCard label="Usage Score" value={`${profile.organization.usageScore}%`} delta={profile.usage?.usageTrend ?? 'No usage row'} tone={profile.organization.usageScore < 50 ? 'danger' : profile.organization.usageScore < 70 ? 'warn' : 'ok'} icon={<Activity size={16} />} />
        <MetricCard label="Properties" value={String(profile.properties.length)} delta={`${profile.venues.length} venues`} tone="neutral" icon={<MapPinned size={16} />} />
        <MetricCard label="Open Work" value={String(openWorkCount)} delta="Risks, requests, findings" tone={openWorkCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="At-Risk $" value={currency.format(atRiskAmount)} delta={`${currency.format(moduleRevenue)} module attribution`} tone={atRiskAmount ? 'danger' : 'ok'} icon={<TrendingUp size={16} />} />
      </div>

      <div className="client360-layout">
        <div className="page-stack">
          <section className="panel client360-graph-panel">
            <div className="panel-header">
              <div>
                <h2>Entity Graph</h2>
                <span>{profile.graph.nodes.length} nodes / {profile.graph.edges.length} relationships</span>
              </div>
              <GitBranch size={18} strokeWidth={1.8} />
            </div>

            <div className="entity-graph">
              {graphNodeColumns.map(column => (
                <div key={column.type} className="entity-column">
                  <span>{column.type}</span>
                  {column.nodes.map(node => (
                    <article key={node.id} className={`entity-node tone-${node.tone}`}>
                      <div className="entity-node-icon">{nodeTypeIcon(node.type)}</div>
                      <div>
                        <strong>{node.label}</strong>
                        <small>{node.detail}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>

            <div className="entity-edge-list">
              {profile.graph.edges.slice(0, 12).map(edge => {
                const from = profile.graph.nodes.find(node => node.id === edge.from)
                const to = profile.graph.nodes.find(node => node.id === edge.to)
                return (
                  <div key={edge.id}>
                    <strong>{from?.label ?? edge.from}</strong>
                    <span>{edge.label}</span>
                    <strong>{to?.label ?? edge.to}</strong>
                  </div>
                )
              })}
            </div>
          </section>

          <DataTable
            label="Connected Workstream"
            rows={profile.workItems}
            pageSize={6}
            emptyTitle="No connected work for this client."
            columns={[
              {
                key: 'priority',
                header: 'Priority',
                sortable: true,
                searchValue: row => `${100 - row.priorityScore} ${row.priority}`,
                render: row => <StatusPill label={row.priority} tone={priorityTone(row.priority)} />,
              },
              {
                key: 'title',
                header: 'Work',
                sortable: true,
                searchValue: row => `${row.title} ${row.nextAction}`,
                render: row => <strong>{row.title}</strong>,
              },
              {
                key: 'type',
                header: 'Type',
                sortable: true,
                searchValue: row => row.type,
                render: row => <StatusPill label={row.type} tone={row.type === 'Billing' ? 'warn' : row.type === 'Support' || row.type === 'Health' ? 'danger' : 'info'} />,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => row.status,
              },
              {
                key: 'source',
                header: 'Source',
                sortable: true,
                searchValue: row => `${row.source} ${row.createdAt}`,
                render: row => <div><strong>{row.source}</strong><span className="cell-subtext">{formatDateTime(row.createdAt)}</span></div>,
              },
            ]}
          />

          <div className="hierarchy-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Module Footprint</h2>
                  <span>{profile.modules.length} activation records</span>
                </div>
                <PackageCheck size={18} strokeWidth={1.8} />
              </div>
              <div className="module-adoption-list">
                {profile.modules.length ? profile.modules.map(module => (
                  <div key={module.id}>
                    <strong>{module.moduleName}</strong>
                    <span>{module.activationLevel} / {module.usageLast7Days} uses / {currency.format(module.revenueAttributed)} attributed</span>
                  </div>
                )) : <p className="muted-copy">No module activation records for this client yet.</p>}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Venue Operating State</h2>
                  <span>{profile.venues.length} venues tracked</span>
                </div>
                <Store size={18} strokeWidth={1.8} />
              </div>
              <div className="module-adoption-list">
                {profile.venues.length ? profile.venues.map(venue => (
                  <div key={venue.id}>
                    <strong>{venue.name}</strong>
                    <span>{venue.status} / {venue.notificationHealth} / {venue.sessionsToday} sessions today</span>
                  </div>
                )) : <p className="muted-copy">No venues are connected to this organization.</p>}
              </div>
            </section>
          </div>

          <ActivityTimeline title="Client Activity" events={profile.activityEvents} />
          <InternalNotes
            scopeType="organization"
            scopeId={profile.organization.id}
            scopeLabel={profile.organization.name}
            notes={profile.supportNotes}
            actor={session.name}
            actorRole={session.role}
          />
        </div>

        <aside className="detail-panel client360-detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Command Brief</p>
              <h2>Next Best Actions</h2>
            </div>
            <StatusPill label={`${profile.nextActions.length} actions`} tone={profile.nextActions.some(action => action.tone === 'danger') ? 'danger' : 'info'} />
          </div>

          <div className="client360-action-list">
            {profile.nextActions.map(action => (
              <article key={action.id} className={`client360-action-card tone-${action.tone}`}>
                <div>
                  <strong>{action.title}</strong>
                  <StatusPill label={action.owner} tone={action.tone} />
                </div>
                <p>{action.reason}</p>
              </article>
            ))}
          </div>

          <div className="detail-section">
            <h3>Usage Snapshot</h3>
            <div className="request-scope-list">
              <div><span>Active Users 7d</span><strong>{profile.usage?.activeUsers7d ?? 0}</strong></div>
              <div><span>Staff Adoption</span><strong>{profile.usage?.staffAdoption ?? 0}%</strong></div>
              <div><span>Guest Interactions</span><strong>{profile.usage?.guestInteractions7d ?? 0}</strong></div>
              <div><span>Avg Response</span><strong>{profile.usage?.averageResponseSeconds ?? 0}s</strong></div>
              <div><span>Escalations</span><strong>{profile.usage?.escalations7d ?? 0}</strong></div>
              <div><span>Reports Viewed</span><strong>{profile.usage?.reportsViewed7d ?? 0}</strong></div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Revenue Records</h3>
            <div className="settings-rule-list">
              {profile.revenueMetrics.length ? profile.revenueMetrics.slice(0, 4).map(record => (
                <div key={record.id}>
                  <CircleDollarSign size={16} strokeWidth={1.8} />
                  <strong>{formatReadable(record.metricType)} / {currency.format(record.amount)} / {record.source}</strong>
                </div>
              )) : (
                <div>
                  <CircleDollarSign size={16} strokeWidth={1.8} />
                  <strong>No revenue records attached yet.</strong>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Audit / History</h3>
            <div className="settings-rule-list">
              {profile.auditEvents.length ? profile.auditEvents.slice(0, 5).map(event => (
                <div key={event.id}>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>{event.actionLabel} / {event.actorRole} / {formatDateTime(event.createdAt)}</strong>
                </div>
              )) : (
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>No scoped audit events yet.</strong>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Account Signals</h3>
            <div className="request-scope-list">
              <div><span>Users</span><strong>{profile.organization.users}</strong></div>
              <div><span>Staff</span><strong>{profile.organization.staff}</strong></div>
              <div><span>Expansion</span><strong>{profile.organization.expansionScore}</strong></div>
              <div><span>Last Active</span><strong>{profile.organization.lastActive}</strong></div>
            </div>
          </div>

          <div className="settings-rule-list">
            <div>
              <UsersRound size={16} strokeWidth={1.8} />
              <strong>{profile.properties.length} properties and {profile.venues.length} venues are connected to this account.</strong>
            </div>
            <div>
              <GitBranch size={16} strokeWidth={1.8} />
              <strong>Entity graph is read-only and generated from platform read-model contracts.</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
