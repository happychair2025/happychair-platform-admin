import { useState } from 'react'
import { Building2, HeartPulse, MapPinned, Store } from 'lucide-react'
import type { AdminSession } from '../../App'
import ActivityTimeline from '../../components/admin/ActivityTimeline'
import DataTable from '../../components/admin/DataTable'
import HealthScorePanel from '../../components/admin/HealthScorePanel'
import InternalNotes from '../../components/admin/InternalNotes'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import type { OrganizationSummary } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function statusTone(status: OrganizationSummary['healthStatus']) {
  if (status === 'At Risk') return 'danger'
  if (status === 'Needs Attention') return 'warn'
  return 'ok'
}

interface ClientsPageProps {
  session: AdminSession
}

export default function ClientsPage({ session }: ClientsPageProps) {
  const { data } = usePlatformData()
  const { activityEvents, moduleActivations, organizations, properties, supportNotes, venues } = data
  const [selectedId, setSelectedId] = useState(organizations[0]?.id ?? '')
  const selected = organizations.find(org => org.id === selectedId) ?? organizations[0]
  const selectedProperties = selected ? properties.filter(property => property.organizationId === selected.id) : []
  const selectedVenues = selected ? venues.filter(venue => venue.organizationId === selected.id) : []
  const selectedActivity = selected ? activityEvents.filter(event => event.scopeId === selected.id) : []
  const selectedModules = selected ? moduleActivations.filter(activation => activation.scopeId === selected.id || selectedVenues.some(venue => venue.id === activation.scopeId)) : []

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Client Operations"
        title="Client / Organization Dashboard"
        description="Organization, property, venue, billing, health, usage, and support context."
      />

      <div className="split-layout">
        <div className="page-stack">
          <DataTable
            label="Organizations"
            rows={organizations}
            pageSize={5}
            columns={[
              {
                key: 'name',
                header: 'Organization',
                sortable: true,
                searchValue: row => row.name,
                render: row => (
                  <button className="table-link" onClick={() => setSelectedId(row.id)}>
                    {row.name}
                  </button>
                ),
              },
              {
                key: 'plan',
                header: 'Plan',
                sortable: true,
                searchValue: row => row.plan,
                render: row => row.plan,
              },
              {
                key: 'billing',
                header: 'Billing',
                sortable: true,
                searchValue: row => row.billingStatus,
                render: row => <StatusPill label={row.billingStatus} tone={row.billingStatus === 'Failed Payment' ? 'danger' : row.billingStatus === 'Trial' ? 'info' : 'ok'} />,
              },
              {
                key: 'health',
                header: 'Health',
                sortable: true,
                searchValue: row => row.healthStatus,
                render: row => <StatusPill label={row.healthStatus} tone={statusTone(row.healthStatus)} />,
              },
            ]}
          />

          <div className="hierarchy-grid">
            <DataTable
              label="Properties"
              rows={selectedProperties}
              pageSize={4}
              emptyTitle="No properties for this organization."
              columns={[
                {
                  key: 'name',
                  header: 'Property',
                  sortable: true,
                  searchValue: row => row.name,
                  render: row => <strong>{row.name}</strong>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={row.status === 'Needs Attention' ? 'danger' : row.status === 'Setup' ? 'warn' : 'ok'} />,
                },
                {
                  key: 'venues',
                  header: 'Venues',
                  sortable: true,
                  searchValue: row => String(row.venues),
                  render: row => row.venues,
                },
              ]}
            />

            <DataTable
              label="Venues / Outlets"
              rows={selectedVenues}
              pageSize={4}
              emptyTitle="No venues for this organization."
              columns={[
                {
                  key: 'name',
                  header: 'Venue',
                  sortable: true,
                  searchValue: row => row.name,
                  render: row => <strong>{row.name}</strong>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={row.status === 'Needs Attention' ? 'danger' : row.status === 'Setup' ? 'warn' : 'ok'} />,
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
          </div>
        </div>

        {selected && (
          <section className="detail-panel">
            <div className="detail-header">
              <div>
                <p className="eyebrow">Selected Organization</p>
                <h2>{selected.name}</h2>
              </div>
              <StatusPill label={selected.accountStatus} tone={selected.accountStatus === 'At Risk' ? 'danger' : selected.accountStatus === 'Trial' ? 'info' : 'ok'} />
            </div>

            <div className="mini-metrics">
              <MetricCard label="MRR" value={currency.format(selected.mrr)} tone={selected.billingStatus === 'Failed Payment' ? 'danger' : 'ok'} icon={<Building2 size={16} />} />
              <MetricCard label="Health" value={`${selected.healthScore}`} delta={selected.healthStatus} tone={statusTone(selected.healthStatus)} icon={<HeartPulse size={16} />} />
              <MetricCard label="Properties" value={String(selected.properties)} tone="neutral" icon={<MapPinned size={16} />} />
              <MetricCard label="Venues" value={String(selected.venues)} tone="neutral" icon={<Store size={16} />} />
            </div>

            <div className="detail-section">
              <h3>Enabled Modules</h3>
              <div className="pill-row">
                {selected.enabledModules.map(module => <StatusPill key={module} label={module} tone="info" />)}
              </div>
            </div>

            <div className="detail-section">
              <h3>Module Adoption</h3>
              <div className="module-adoption-list">
                {selectedModules.length ? selectedModules.map(activation => (
                  <div key={activation.id}>
                    <strong>{activation.moduleName}</strong>
                    <span>{activation.usageLast7Days} uses / {currency.format(activation.revenueAttributed)} attributed</span>
                  </div>
                )) : <p className="muted-copy">No module activation records for this organization yet.</p>}
              </div>
            </div>

            <div className="detail-section">
              <h3>Account Signals</h3>
              <dl className="signal-list">
                <div><dt>Market Type</dt><dd>{selected.marketType}</dd></div>
                <div><dt>Total Users</dt><dd>{selected.users}</dd></div>
                <div><dt>Staff Count</dt><dd>{selected.staff}</dd></div>
                <div><dt>Usage Score</dt><dd>{selected.usageScore}</dd></div>
                <div><dt>Expansion Score</dt><dd>{selected.expansionScore}</dd></div>
                <div><dt>Last Active</dt><dd>{selected.lastActive}</dd></div>
              </dl>
            </div>

          </section>
        )}
      </div>

      {selected && (
        <div className="dashboard-grid">
          <HealthScorePanel
            score={selected.healthScore}
            status={selected.healthStatus}
            usageScore={selected.usageScore}
            adoptionScore={Math.min(100, selected.usageScore + 4)}
            billingScore={selected.billingStatus === 'Failed Payment' ? 18 : 96}
            supportScore={selected.accountStatus === 'At Risk' ? 32 : 84}
            setupScore={selected.accountStatus === 'Trial' ? 78 : 93}
          />
          <InternalNotes
            scopeType="organization"
            scopeId={selected.id}
            scopeLabel={selected.name}
            notes={supportNotes}
            actor={session.name}
            actorRole={session.role}
          />
        </div>
      )}

      <ActivityTimeline title="Client Activity" events={selectedActivity} />
    </div>
  )
}
