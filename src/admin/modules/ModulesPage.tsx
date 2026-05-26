import { useState } from 'react'
import { AlertTriangle, PackageCheck, ShieldCheck, X } from 'lucide-react'
import type { AdminSession } from '../../App'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { appendAuditEvent } from '../../lib/audit/auditLog'
import { moduleRegistry, type PlatformModule } from '../../lib/modules/registry'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'

interface ModulesPageProps {
  session: AdminSession
}

export default function ModulesPage({ session }: ModulesPageProps) {
  const { data } = usePlatformData()
  const { moduleAdoption, moduleUsageGaps } = data
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(moduleRegistry.map(module => [module.key, module.status === 'active'])))
  const [selectedKey, setSelectedKey] = useState(moduleRegistry[0]?.key ?? '')
  const [pendingModule, setPendingModule] = useState<PlatformModule | null>(null)
  const canManage = hasPermission(session.role, 'modules.manage')
  const selectedModule = moduleRegistry.find(module => module.key === selectedKey) ?? moduleRegistry[0]
  const selectedAdoption = moduleAdoption.find(row => row.moduleName === selectedModule.name)
  const selectedGaps = moduleUsageGaps.filter(gap => gap.moduleName === selectedModule.name)
  const getMissingDependencies = (module: PlatformModule) => module.dependencies.filter(dependencyKey => !enabled[dependencyKey])
  const missingDependencies = getMissingDependencies(selectedModule)
  const pendingMissingDependencies = pendingModule ? getMissingDependencies(pendingModule) : []

  const confirmToggle = () => {
    if (!pendingModule) return
    setEnabled(current => {
      const nextValue = !current[pendingModule.key]
      appendAuditEvent({
        actor: session.name,
        actorRole: roleLabels[session.role],
        scope: 'Module Registry',
        actionKey: 'module.activation.changed.mock',
        actionLabel: `${nextValue ? 'Enabled' : 'Disabled'} ${pendingModule.name} after mock safety review`,
        severity: pendingMissingDependencies.length ? 'warning' : 'notice',
      })
      return { ...current, [pendingModule.key]: nextValue }
    })
    setPendingModule(null)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Entitlements"
        title="Module Activation System"
        description="Registry-driven module management with dependency, visibility, beta, and revenue attribution fields."
      />

      <div className="module-management-layout">
        <div className="module-grid">
          {moduleRegistry.map(module => (
            <article key={module.key} className={`module-card selectable${selectedModule.key === module.key ? ' selected' : ''}`}>
              <button className="module-select-button" onClick={() => setSelectedKey(module.key)} aria-label={`View ${module.name}`}>
                <span className="module-icon" aria-hidden="true">
                  <PackageCheck size={18} strokeWidth={1.8} />
                </span>
                <span className="module-main">
                  <span className="module-title-row">
                    <h2>{module.name}</h2>
                    <StatusPill label={enabled[module.key] ? 'Enabled' : 'Disabled'} tone={enabled[module.key] ? 'ok' : 'neutral'} />
                  </span>
                  <span className="module-description">{module.description}</span>
                  <span className="pill-row">
                    <StatusPill label={module.category} tone="info" />
                    <StatusPill label={module.status} tone={module.status === 'planned' ? 'neutral' : module.status === 'beta' ? 'warn' : 'ok'} />
                    <StatusPill label={module.planRequired} tone="neutral" />
                  </span>
                </span>
              </button>
              <button className="ghost-action" disabled={!canManage} onClick={() => setPendingModule(module)}>
                {enabled[module.key] ? 'Disable' : 'Enable'}
              </button>
            </article>
          ))}
        </div>

        <aside className="detail-panel module-detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Module Detail</p>
              <h2>{selectedModule.name}</h2>
            </div>
            <StatusPill label={enabled[selectedModule.key] ? 'Enabled' : 'Disabled'} tone={enabled[selectedModule.key] ? 'ok' : 'neutral'} />
          </div>

          <p className="muted-copy">{selectedModule.description}</p>

          <div className="detail-section">
            <h3>Configuration Flags</h3>
            <div className="pill-row">
              <StatusPill label={selectedModule.category} tone="info" />
              <StatusPill label={selectedModule.status} tone={selectedModule.status === 'planned' ? 'neutral' : selectedModule.status === 'beta' ? 'warn' : 'ok'} />
              <StatusPill label={selectedModule.planRequired} tone="neutral" />
              <StatusPill label={selectedModule.clientVisible ? 'Client Visible' : 'Client Hidden'} tone={selectedModule.clientVisible ? 'ok' : 'neutral'} />
              {selectedModule.internalOnly && <StatusPill label="Internal Only" tone="warn" />}
            </div>
          </div>

          <div className="detail-section">
            <h3>Dependencies</h3>
            {selectedModule.dependencies.length ? (
              <div className="dependency-check-list">
                {selectedModule.dependencies.map(dependencyKey => {
                  const dependency = moduleRegistry.find(module => module.key === dependencyKey)
                  const ready = enabled[dependencyKey]
                  return (
                    <div key={dependencyKey}>
                      <StatusPill label={ready ? 'Ready' : 'Missing'} tone={ready ? 'ok' : 'danger'} />
                      <strong>{dependency?.name ?? dependencyKey}</strong>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="muted-copy">No dependencies.</p>
            )}
          </div>

          <div className="detail-section">
            <h3>Usage And Revenue</h3>
            <dl className="signal-list">
              <div><dt>Enabled Clients</dt><dd>{selectedAdoption?.enabledClients ?? 0}</dd></div>
              <div><dt>Active Clients</dt><dd>{selectedAdoption?.activeClients7d ?? 0}</dd></div>
              <div><dt>Usage Events</dt><dd>{selectedAdoption?.usageEvents7d.toLocaleString() ?? 0}</dd></div>
              <div><dt>Revenue</dt><dd>${selectedAdoption?.revenueAttributed.toLocaleString() ?? 0}</dd></div>
            </dl>
          </div>

          <div className="detail-section">
            <h3>Usage Gaps</h3>
            <div className="usage-gap-list">
              {selectedGaps.length ? selectedGaps.map(gap => (
                <article key={gap.id} className="usage-gap-item">
                  <strong>{gap.organizationName}</strong>
                  <p>{gap.usageLast7Days} uses in the last 7 days.</p>
                  <span>{gap.recommendedAction}</span>
                </article>
              )) : <p className="muted-copy">No usage gaps detected for this module.</p>}
            </div>
          </div>
        </aside>
      </div>

      {pendingModule && (
        <div className="modal-backdrop" role="presentation">
          <section className="safety-modal" role="dialog" aria-modal="true" aria-labelledby="module-modal-title">
            <button className="icon-button modal-close" onClick={() => setPendingModule(null)} aria-label="Close activation review">
              <X size={16} strokeWidth={1.8} />
            </button>
            <div className="module-icon" aria-hidden="true">
              {missingDependencies.length ? <AlertTriangle size={18} strokeWidth={1.8} /> : <ShieldCheck size={18} strokeWidth={1.8} />}
            </div>
            <p className="eyebrow">Activation Safety Review</p>
            <h2 id="module-modal-title">{enabled[pendingModule.key] ? 'Disable' : 'Enable'} {pendingModule.name}</h2>
            <p className="muted-copy">This is a mock workflow. Real module changes will require server-side permission checks, dependency validation, and immutable audit logging.</p>

            <div className="safety-check-list">
              <div>
                <StatusPill label={canManage ? 'Passed' : 'Blocked'} tone={canManage ? 'ok' : 'danger'} />
                <strong>Permission check</strong>
              </div>
              <div>
                <StatusPill label={pendingMissingDependencies.length ? 'Warning' : 'Passed'} tone={pendingMissingDependencies.length ? 'warn' : 'ok'} />
                <strong>Dependency check</strong>
              </div>
              <div>
                <StatusPill label="Required" tone="info" />
                <strong>Audit log entry</strong>
              </div>
            </div>

            {pendingMissingDependencies.length > 0 && (
              <div className="warning-box">
                <strong>Missing dependencies</strong>
                <span>{pendingMissingDependencies.map(key => moduleRegistry.find(module => module.key === key)?.name ?? key).join(', ')}</span>
              </div>
            )}

            <button className="primary-action" disabled={!canManage} onClick={confirmToggle}>
              Confirm Mock Change
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
