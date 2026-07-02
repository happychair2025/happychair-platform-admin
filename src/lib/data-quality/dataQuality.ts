import type { PlatformReadViewDiagnostic } from '../platform-data/PlatformDataContext'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type DataQualityArea =
  | 'Read Model'
  | 'Hierarchy'
  | 'Usage'
  | 'Billing'
  | 'Support'
  | 'Registrations'
  | 'Modules'
  | 'Agents'
  | 'Security'

export type DataQualitySeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type DataQualityStatus = 'Passing' | 'Needs Review' | 'Blocked' | 'Monitoring'

export interface DataQualityCheck {
  id: string
  area: DataQualityArea
  title: string
  status: DataQualityStatus
  severity: DataQualitySeverity
  owner: 'Engineering' | 'Support' | 'Client Success' | 'Finance' | 'Marketing' | 'Owner'
  affectedRecords: number
  reason: string
  remediation: string
  auditRequired: boolean
  checkedAt: string
}

export interface DataQualityModel {
  checks: DataQualityCheck[]
  blockedCount: number
  reviewCount: number
  passingCount: number
  affectedRecords: number
}

export function buildDataQualityModel(data: PlatformAdminReadModel, readViewDiagnostics: PlatformReadViewDiagnostic[] = []): DataQualityModel {
  const now = new Date().toISOString()
  const organizationIds = new Set(data.organizations.map(org => org.id))
  const organizationNames = new Set(data.organizations.map(org => org.name))
  const propertyNames = new Set(data.properties.map(property => property.name))
  const venueNames = new Set(data.venues.map(venue => venue.name))
  const usageOrgIds = new Set(data.usageAnalytics.map(row => row.organizationId))
  const checks: DataQualityCheck[] = []
  const fallbackViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')
  const mockViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'mock')

  checks.push({
    id: 'read-view-connection',
    area: 'Read Model',
    title: 'Read-only view connection',
    status: fallbackViews.length ? 'Needs Review' : mockViews.length ? 'Monitoring' : 'Passing',
    severity: fallbackViews.length ? 'High' : mockViews.length ? 'Medium' : 'Low',
    owner: 'Engineering',
    affectedRecords: fallbackViews.length,
    reason: fallbackViews.length
      ? `${fallbackViews.length} read-only views are using mock fallback.`
      : mockViews.length
        ? 'The app is intentionally running in mock mode.'
        : `${readViewDiagnostics.length} read-only view contracts are connected.`,
    remediation: fallbackViews.length
      ? 'Open Admin Settings, inspect Read View Diagnostics, then repair missing views, policies, or column contracts before enabling production decision workflows.'
      : mockViews.length
        ? 'Set VITE_PLATFORM_DATA_SOURCE=supabase with Supabase URL and anon key when read-only views are ready.'
        : 'Keep read-only views monitored and do not enable browser writes.',
    auditRequired: Boolean(fallbackViews.length),
    checkedAt: now,
  })

  const missingUsage = data.organizations.filter(org => !usageOrgIds.has(org.id))
  checks.push({
    id: 'usage-coverage',
    area: 'Usage',
    title: 'Organization usage coverage',
    status: missingUsage.length ? 'Needs Review' : 'Passing',
    severity: missingUsage.length ? 'Medium' : 'Low',
    owner: 'Engineering',
    affectedRecords: missingUsage.length,
    reason: missingUsage.length
      ? `${missingUsage.length} organizations are missing usage analytics rows.`
      : 'Every organization has a usage analytics row.',
    remediation: 'Backfill usage summary rows from append-only usage events before enabling real-time usage alerts.',
    auditRequired: false,
    checkedAt: now,
  })

  const orphanProperties = data.properties.filter(property => !organizationIds.has(property.organizationId))
  checks.push({
    id: 'property-hierarchy',
    area: 'Hierarchy',
    title: 'Property organization links',
    status: orphanProperties.length ? 'Blocked' : 'Passing',
    severity: orphanProperties.length ? 'Critical' : 'Low',
    owner: 'Engineering',
    affectedRecords: orphanProperties.length,
    reason: orphanProperties.length
      ? `${orphanProperties.length} properties reference missing organizations.`
      : 'All properties reference known organizations.',
    remediation: 'Repair organization IDs in read views or source tables before allowing cross-tenant navigation.',
    auditRequired: true,
    checkedAt: now,
  })

  const orphanVenueProperties = data.venues.filter(venue => !propertyNames.has(venue.propertyName))
  checks.push({
    id: 'venue-property-links',
    area: 'Hierarchy',
    title: 'Venue property links',
    status: orphanVenueProperties.length ? 'Needs Review' : 'Passing',
    severity: orphanVenueProperties.length ? 'High' : 'Low',
    owner: 'Support',
    affectedRecords: orphanVenueProperties.length,
    reason: orphanVenueProperties.length
      ? `${orphanVenueProperties.length} venues do not match a known property name.`
      : 'All venues resolve to known property names.',
    remediation: 'Normalize venue/property mapping through IDs in the read model and keep display names as labels only.',
    auditRequired: true,
    checkedAt: now,
  })

  const supportScopeIssues = data.supportIssues.filter(issue => (
    !organizationNames.has(issue.organizationName)
    || !propertyNames.has(issue.propertyName)
    || !venueNames.has(issue.venueName)
  ))
  checks.push({
    id: 'support-scope',
    area: 'Support',
    title: 'Support issue scope integrity',
    status: supportScopeIssues.length ? 'Blocked' : 'Passing',
    severity: supportScopeIssues.length ? 'Critical' : 'Low',
    owner: 'Support',
    affectedRecords: supportScopeIssues.length,
    reason: supportScopeIssues.length
      ? `${supportScopeIssues.length} support issues cannot be scoped to a known client hierarchy.`
      : 'Support issues resolve to known organizations, properties, and venues.',
    remediation: 'Require support issues to carry immutable organization/property/venue IDs in addition to labels.',
    auditRequired: true,
    checkedAt: now,
  })

  const billingScopeIssues = data.billingRisks.filter(risk => !organizationNames.has(risk.organizationName))
  checks.push({
    id: 'billing-scope',
    area: 'Billing',
    title: 'Billing risk scope integrity',
    status: billingScopeIssues.length ? 'Needs Review' : 'Passing',
    severity: billingScopeIssues.length ? 'High' : 'Low',
    owner: 'Finance',
    affectedRecords: billingScopeIssues.length,
    reason: billingScopeIssues.length
      ? `${billingScopeIssues.length} billing risks do not resolve to active organizations.`
      : 'Billing risks resolve to known organizations.',
    remediation: 'Map provider customer IDs to platform organization IDs before provider-side finance actions are enabled.',
    auditRequired: true,
    checkedAt: now,
  })

  const convertedWithoutOrg = data.registrations.filter(registration => registration.status === 'Converted' && !organizationNames.has(registration.companyName))
  checks.push({
    id: 'converted-registration-link',
    area: 'Registrations',
    title: 'Converted registration handoff',
    status: convertedWithoutOrg.length ? 'Needs Review' : 'Passing',
    severity: convertedWithoutOrg.length ? 'Medium' : 'Low',
    owner: 'Marketing',
    affectedRecords: convertedWithoutOrg.length,
    reason: convertedWithoutOrg.length
      ? `${convertedWithoutOrg.length} converted registrations do not match an organization profile.`
      : 'Converted registrations match organization profiles.',
    remediation: 'Attach registration source IDs to organizations so acquisition attribution survives conversion.',
    auditRequired: false,
    checkedAt: now,
  })

  const orphanModuleActivations = data.moduleActivations.filter(activation => {
    if (activation.scopeType === 'organization') return !organizationIds.has(activation.scopeId)
    if (activation.scopeType === 'venue') return !data.venues.some(venue => venue.id === activation.scopeId)
    if (activation.scopeType === 'property') return !data.properties.some(property => property.id === activation.scopeId)
    return true
  })
  checks.push({
    id: 'module-activation-scope',
    area: 'Modules',
    title: 'Module activation scope integrity',
    status: orphanModuleActivations.length ? 'Blocked' : 'Passing',
    severity: orphanModuleActivations.length ? 'Critical' : 'Low',
    owner: 'Engineering',
    affectedRecords: orphanModuleActivations.length,
    reason: orphanModuleActivations.length
      ? `${orphanModuleActivations.length} module activations reference missing scopes.`
      : 'Module activations resolve to known scopes.',
    remediation: 'Block production activation changes until all activation records are scope-resolved and auditable.',
    auditRequired: true,
    checkedAt: now,
  })

  const agentEventsNeedingScope = data.agentEvents.filter(event => event.organizationName && !organizationNames.has(event.organizationName))
  checks.push({
    id: 'agent-event-scope',
    area: 'Agents',
    title: 'Agent event scope integrity',
    status: agentEventsNeedingScope.length ? 'Needs Review' : 'Passing',
    severity: agentEventsNeedingScope.length ? 'Medium' : 'Low',
    owner: 'Owner',
    affectedRecords: agentEventsNeedingScope.length,
    reason: agentEventsNeedingScope.length
      ? `${agentEventsNeedingScope.length} agent events reference unknown organizations.`
      : 'Scoped agent events resolve to known organizations.',
    remediation: 'Attach agent findings to immutable entity IDs before allowing approval workflows to mutate state.',
    auditRequired: true,
    checkedAt: now,
  })

  const highRiskActiveFlags = data.featureFlags.filter(flag => flag.enabled && flag.environment === 'Production' && flag.blastRadius === 'High')
  checks.push({
    id: 'high-risk-production-flags',
    area: 'Security',
    title: 'High-risk production flags',
    status: highRiskActiveFlags.length ? 'Monitoring' : 'Passing',
    severity: highRiskActiveFlags.length ? 'High' : 'Low',
    owner: 'Engineering',
    affectedRecords: highRiskActiveFlags.length,
    reason: highRiskActiveFlags.length
      ? `${highRiskActiveFlags.length} high-risk production flags are enabled and require review.`
      : 'No high-risk production flags are currently enabled.',
    remediation: 'Review rollout notes, blast radius, rollback path, and audit entries for every high-risk flag.',
    auditRequired: true,
    checkedAt: now,
  })

  const orderedChecks = checks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.affectedRecords - a.affectedRecords)

  return {
    checks: orderedChecks,
    blockedCount: orderedChecks.filter(check => check.status === 'Blocked').length,
    reviewCount: orderedChecks.filter(check => check.status === 'Needs Review' || check.status === 'Monitoring').length,
    passingCount: orderedChecks.filter(check => check.status === 'Passing').length,
    affectedRecords: orderedChecks.reduce((sum, check) => sum + check.affectedRecords, 0),
  }
}

export function getDataQualitySeverityTone(severity: DataQualitySeverity): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (severity === 'Critical') return 'danger'
  if (severity === 'High') return 'warn'
  if (severity === 'Medium') return 'info'
  return 'neutral'
}

export function getDataQualityStatusTone(status: DataQualityStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Review') return 'warn'
  if (status === 'Monitoring') return 'info'
  return 'ok'
}

function severityRank(severity: DataQualitySeverity) {
  if (severity === 'Critical') return 4
  if (severity === 'High') return 3
  if (severity === 'Medium') return 2
  return 1
}
