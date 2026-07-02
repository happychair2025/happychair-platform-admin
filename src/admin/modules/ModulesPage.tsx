import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck, ShieldCheck, X } from 'lucide-react'
import type { AdminSession } from '../../App'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { moduleRegistry, type PlatformModule } from '../../lib/modules/registry'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface ModulesPageProps {
  session: AdminSession
  initialSelectedKey?: string
}

interface ModuleScopeOption {
  key: string
  scopeType: 'organization' | 'property' | 'venue'
  scopeId: string
  label: string
  detail: string
  organizationId?: string
  organizationName?: string
  propertyId?: string
  propertyName?: string
  venueId?: string
  venueName?: string
}

export default function ModulesPage({ session, initialSelectedKey }: ModulesPageProps) {
  const { data } = usePlatformData()
  const { moduleActivations, moduleAdoption, moduleUsageGaps, organizations, properties, venues } = data
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(moduleRegistry.map(module => [module.key, module.status === 'active'])))
  const [selectedKey, setSelectedKey] = useState(initialSelectedKey ?? moduleRegistry[0]?.key ?? '')
  const [selectedScopeKey, setSelectedScopeKey] = useState('')
  const [pendingModule, setPendingModule] = useState<PlatformModule | null>(null)
  const [notice, setNotice] = useState('')
  const canManage = hasPermission(session.role, 'modules.manage')
  const selectedModule = moduleRegistry.find(module => module.key === selectedKey) ?? moduleRegistry[0]
  const selectedAdoption = moduleAdoption.find(row => row.moduleName === selectedModule.name)
  const selectedGaps = moduleUsageGaps.filter(gap => gap.moduleName === selectedModule.name)
  const getMissingDependencies = (module: PlatformModule) => module.dependencies.filter(dependencyKey => !enabled[dependencyKey])
  const missingDependencies = getMissingDependencies(selectedModule)
  const pendingMissingDependencies = pendingModule ? getMissingDependencies(pendingModule) : []
  const scopeOptions = useMemo<ModuleScopeOption[]>(() => {
    const organizationOptions = organizations.map(organization => ({
      key: `organization:${organization.id}`,
      scopeType: 'organization' as const,
      scopeId: organization.id,
      label: organization.name,
      detail: `${organization.accountStatus} / ${organization.plan}`,
      organizationId: organization.id,
      organizationName: organization.name,
    }))
    const propertyOptions = properties.map(property => {
      const organization = organizations.find(row => row.id === property.organizationId)
      return {
        key: `property:${property.id}`,
        scopeType: 'property' as const,
        scopeId: property.id,
        label: property.name,
        detail: `${organization?.name ?? 'Unknown organization'} / ${property.status}`,
        organizationId: property.organizationId,
        organizationName: organization?.name,
        propertyId: property.id,
        propertyName: property.name,
      }
    })
    const venueOptions = venues.map(venue => {
      const organization = organizations.find(row => row.id === venue.organizationId)
      const property = properties.find(row => row.organizationId === venue.organizationId && row.name === venue.propertyName)
      return {
        key: `venue:${venue.id}`,
        scopeType: 'venue' as const,
        scopeId: venue.id,
        label: venue.name,
        detail: `${organization?.name ?? 'Unknown organization'} / ${venue.propertyName} / ${venue.status}`,
        organizationId: venue.organizationId,
        organizationName: organization?.name,
        propertyId: property?.id,
        propertyName: venue.propertyName,
        venueId: venue.id,
        venueName: venue.name,
      }
    })
    return [...organizationOptions, ...propertyOptions, ...venueOptions]
  }, [organizations, properties, venues])
  const selectedScope = scopeOptions.find(scope => scope.key === selectedScopeKey) ?? scopeOptions[0]
  const selectedScopeActivation = selectedScope
    ? moduleActivations.find(activation => activation.moduleName === selectedModule.name && activation.scopeType === selectedScope.scopeType && activation.scopeId === selectedScope.scopeId)
    : undefined
  const inheritedScopeActivation = selectedScope && !selectedScopeActivation
    ? moduleActivations.find(activation => {
        if (activation.moduleName !== selectedModule.name) return false
        if (selectedScope.scopeType === 'organization') return false
        if (selectedScope.scopeType === 'property') {
          return activation.scopeType === 'organization' && activation.scopeId === selectedScope.organizationId
        }
        return (
          (activation.scopeType === 'property' && activation.scopeId === selectedScope.propertyId)
          || (activation.scopeType === 'organization' && activation.scopeId === selectedScope.organizationId)
        )
      })
    : undefined
  const effectiveScopeActivation = selectedScopeActivation ?? inheritedScopeActivation
  const effectiveScopeEnabled = effectiveScopeActivation?.enabled ?? false
  const scopeActivationSource = selectedScopeActivation
    ? `Explicit ${selectedScopeActivation.activationLevel}`
    : inheritedScopeActivation
      ? `Inherited from ${inheritedScopeActivation.activationLevel}`
      : 'No activation record'

  useEffect(() => {
    if (initialSelectedKey && moduleRegistry.some(module => module.key === initialSelectedKey)) {
      setSelectedKey(initialSelectedKey)
    }
  }, [initialSelectedKey])

  useEffect(() => {
    if (!scopeOptions.length) return
    if (!selectedScopeKey || !scopeOptions.some(scope => scope.key === selectedScopeKey)) {
      setSelectedScopeKey(scopeOptions[0].key)
    }
  }, [scopeOptions, selectedScopeKey])

  const confirmToggle = () => {
    if (!pendingModule) return
    const nextValue = !enabled[pendingModule.key]
    const result = queueAdminActionRequest(session, {
      actionType: 'module_activation_change',
      title: `${nextValue ? 'Enable' : 'Disable'} ${pendingModule.name}`,
      permission: 'modules.manage',
      scope: createAdminActionScope({ label: 'Module Registry' }),
      reason: `${pendingModule.name} was requested from the module activation safety review. The browser only queues this request; production entitlement changes require the server handler.`,
      rollbackNotes: `Restore the previous ${pendingModule.name} activation state and dependency snapshot if the server handler fails.`,
      severity: pendingMissingDependencies.length ? 'warning' : 'notice',
      metadata: {
        moduleKey: pendingModule.key,
        moduleName: pendingModule.name,
        requestedEnabledState: nextValue,
        missingDependencies: pendingMissingDependencies,
      },
    })
    setNotice(result.ok ? `${pendingModule.name} server action request queued.` : result.message)
    if (!result.ok) return
    setPendingModule(null)
  }

  const queueScopedActivationChange = () => {
    if (!selectedScope) return
    const requestedEnabledState = !effectiveScopeEnabled
    const result = queueAdminActionRequest(session, {
      actionType: 'module_activation_change',
      title: `${requestedEnabledState ? 'Enable' : 'Disable'} ${selectedModule.name} for ${selectedScope.label}`,
      permission: 'modules.manage',
      scope: createAdminActionScope({
        organizationId: selectedScope.organizationId,
        organizationName: selectedScope.organizationName,
        propertyId: selectedScope.propertyId,
        propertyName: selectedScope.propertyName,
        venueId: selectedScope.venueId,
        venueName: selectedScope.venueName,
        label: selectedScope.label,
      }),
      reason: `${selectedModule.name} was requested for ${selectedScope.label}. Production entitlement changes must validate inheritance, dependencies, and audit history server-side.`,
      rollbackNotes: `Restore the prior ${selectedModule.name} activation state for ${selectedScope.label}; preserve inherited records and dependency snapshots if execution fails.`,
      severity: requestedEnabledState && missingDependencies.length ? 'warning' : 'notice',
      metadata: {
        moduleKey: selectedModule.key,
        moduleName: selectedModule.name,
        scopeType: selectedScope.scopeType,
        scopeId: selectedScope.scopeId,
        activationSource: scopeActivationSource,
        currentEnabledState: effectiveScopeEnabled,
        requestedEnabledState,
        missingDependencies,
      },
    })
    setNotice(result.ok ? `${selectedModule.name} ${requestedEnabledState ? 'enable' : 'disable'} request queued for ${selectedScope.label}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Entitlements"
        title="Module Activation System"
        description="Registry-driven module management with dependency, visibility, beta, and revenue attribution fields."
      />
      {notice && <p className="warning-copy">{notice}</p>}

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
            <h3>Activation Scope</h3>
            <label className="field compact-field">
              <span>Review scope</span>
              <select value={selectedScope?.key ?? ''} onChange={event => setSelectedScopeKey(event.target.value)}>
                {scopeOptions.map(scope => (
                  <option key={scope.key} value={scope.key}>{scope.label} ({scope.scopeType})</option>
                ))}
              </select>
            </label>
            {selectedScope && (
              <>
                <dl className="signal-list">
                  <div><dt>Current State</dt><dd>{effectiveScopeEnabled ? 'Enabled' : 'Disabled'}</dd></div>
                  <div><dt>Source</dt><dd>{scopeActivationSource}</dd></div>
                  <div><dt>Usage 7d</dt><dd>{effectiveScopeActivation?.usageLast7Days ?? 0}</dd></div>
                  <div><dt>Revenue</dt><dd>${effectiveScopeActivation?.revenueAttributed.toLocaleString() ?? 0}</dd></div>
                </dl>
                <p className="muted-copy">{selectedScope.detail}</p>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canManage} onClick={queueScopedActivationChange}>
                    <PackageCheck size={15} strokeWidth={1.8} />
                    Queue {effectiveScopeEnabled ? 'Disable' : 'Enable'} For Scope
                  </button>
                </div>
              </>
            )}
          </div>

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
            <p className="muted-copy">This request will be queued for a future server-side handler. The browser does not change production module entitlements.</p>

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
                <strong>Audit and action request</strong>
              </div>
            </div>

            {pendingMissingDependencies.length > 0 && (
              <div className="warning-box">
                <strong>Missing dependencies</strong>
                <span>{pendingMissingDependencies.map(key => moduleRegistry.find(module => module.key === key)?.name ?? key).join(', ')}</span>
              </div>
            )}

            <button className="primary-action" disabled={!canManage} onClick={confirmToggle}>
              Queue Server Action
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
