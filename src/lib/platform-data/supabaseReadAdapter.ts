import type {
  ActivityEvent,
  AgentDefinition,
  AgentEventRecord,
  BillingRiskRecord,
  FeatureFlagRecord,
  ImpersonationSessionRecord,
  ImpersonationTarget,
  InternalAdminUser,
  ModuleActivationSnapshot,
  ModuleAdoptionRow,
  ModuleUsageGap,
  OrganizationSummary,
  PlatformHealthSignal,
  PropertySummary,
  RegistrationRecord,
  RevenueMetricRecord,
  SupportIssue,
  SupportNote,
  UsageAnalyticsRow,
  VenueSummary,
} from '../mock-data/mockPlatform'
import type { AuditEvent } from '../audit/auditLog'
import type { RunbookActionOutcome } from '../support/runbooks'
import { readOnlyViewNames, type ReadOnlySupabaseAdapter } from '../supabase/readContracts'

interface SupabaseReadOnlyConfig {
  url: string
  anonKey: string
}

export function createSupabaseReadOnlyAdapter(config: SupabaseReadOnlyConfig): ReadOnlySupabaseAdapter {
  const fetchView = createViewFetcher(config)

  return {
    async listOrganizations() {
      return fetchView<OrganizationSummary>('organizations')
    },
    async listProperties(organizationId?: string) {
      const rows = await fetchView<PropertySummary>('properties')
      return organizationId ? rows.filter(row => row.organizationId === organizationId) : rows
    },
    async listVenues(scope?: { organizationId?: string; propertyId?: string }) {
      const rows = await fetchView<VenueSummary>('venues')
      if (!scope?.organizationId && !scope?.propertyId) return rows
      return rows.filter(row => {
        const organizationMatch = scope.organizationId ? row.organizationId === scope.organizationId : true
        const propertyMatch = scope.propertyId ? row.propertyName === scope.propertyId : true
        return organizationMatch && propertyMatch
      })
    },
    async listModuleActivations(scope?: { organizationId?: string; venueId?: string }) {
      const rows = await fetchView<ModuleActivationSnapshot>('moduleActivations')
      if (!scope?.organizationId && !scope?.venueId) return rows
      return rows.filter(row => {
        if (scope.venueId && row.scopeType === 'venue') return row.scopeId === scope.venueId
        if (scope.organizationId && row.scopeType === 'organization') return row.scopeId === scope.organizationId
        return false
      })
    },
    async listModuleAdoption() {
      return fetchView<ModuleAdoptionRow>('moduleAdoption')
    },
    async listModuleUsageGaps() {
      return fetchView<ModuleUsageGap>('moduleUsageGaps')
    },
    async listRegistrations() {
      return fetchView<RegistrationRecord>('registrations')
    },
    async listRevenueMetrics() {
      return fetchView<RevenueMetricRecord>('revenueMetrics')
    },
    async listBillingRisks() {
      return fetchView<BillingRiskRecord>('billingRisks')
    },
    async listSupportIssues() {
      return fetchView<SupportIssue>('supportIssues')
    },
    async listRemediationPackets() {
      return fetchView<RunbookActionOutcome>('remediationPackets')
    },
    async listPlatformHealthSignals() {
      return fetchView<PlatformHealthSignal>('platformHealthSignals')
    },
    async listImpersonationTargets() {
      return fetchView<ImpersonationTarget>('impersonationTargets')
    },
    async listImpersonationSessions() {
      return fetchView<ImpersonationSessionRecord>('impersonationSessions')
    },
    async listAuditEvents() {
      return fetchView<AuditEvent>('auditEvents')
    },
    async listAgentDefinitions() {
      return fetchView<AgentDefinition>('agentDefinitions')
    },
    async listAgentEvents() {
      return fetchView<AgentEventRecord>('agentEvents')
    },
    async listInternalAdminUsers() {
      return fetchView<InternalAdminUser>('internalAdminUsers')
    },
    async listFeatureFlags() {
      return fetchView<FeatureFlagRecord>('featureFlags')
    },
    async listSupportNotes(scope?: { scopeType: SupportNote['scopeType']; scopeId: string }) {
      const rows = await fetchView<SupportNote>('supportNotes')
      if (!scope) return rows
      return rows.filter(row => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId)
    },
    async listActivityEvents(scope?: { scopeType: ActivityEvent['scopeType']; scopeId: string }) {
      const rows = await fetchView<ActivityEvent>('activityEvents')
      if (!scope) return rows
      return rows.filter(row => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId)
    },
    async listUsageAnalytics() {
      return fetchView<UsageAnalyticsRow>('usageAnalytics')
    },
  }
}

function createViewFetcher(config: SupabaseReadOnlyConfig) {
  return async function fetchView<T>(viewKey: keyof typeof readOnlyViewNames): Promise<T[]> {
    const viewName = readOnlyViewNames[viewKey]
    const baseUrl = config.url.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/rest/v1/${viewName}?select=*`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Prefer: 'count=estimated',
      },
    })

    if (!response.ok) {
      throw new Error(`Read-only Supabase view failed: ${viewName} (${response.status})`)
    }

    const rows = await response.json()
    return camelizeKeys(rows) as T[]
  }
}

function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => camelizeKeys(item))
  if (!value || typeof value !== 'object' || value instanceof Date) return value

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((next, [key, item]) => {
    next[toCamelCase(key)] = camelizeKeys(item)
    return next
  }, {})
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
