import type { ActivityEvent, ModuleActivationSnapshot, SupportNote, VenueSummary } from '../mock-data/mockPlatform'
import type { ReadOnlySupabaseAdapter } from '../supabase/readContracts'
import { mockReadModel } from './mockReadModel'

export const mockReadAdapter: ReadOnlySupabaseAdapter = {
  async listOrganizations() {
    return mockReadModel.organizations
  },
  async listProperties(organizationId?: string) {
    return organizationId
      ? mockReadModel.properties.filter(property => property.organizationId === organizationId)
      : mockReadModel.properties
  },
  async listVenues(scope?: { organizationId?: string; propertyId?: string }) {
    return filterVenues(mockReadModel.venues, scope)
  },
  async listModuleActivations(scope?: { organizationId?: string; venueId?: string }) {
    return filterModuleActivations(mockReadModel.moduleActivations, scope)
  },
  async listModuleAdoption() {
    return mockReadModel.moduleAdoption
  },
  async listModuleUsageGaps() {
    return mockReadModel.moduleUsageGaps
  },
  async listRegistrations() {
    return mockReadModel.registrations
  },
  async listRevenueMetrics() {
    return mockReadModel.revenueMetrics
  },
  async listBillingRisks() {
    return mockReadModel.billingRisks
  },
  async listSupportIssues() {
    return mockReadModel.supportIssues
  },
  async listRemediationPackets() {
    return mockReadModel.remediationPackets
  },
  async listAdminActionRequests() {
    return mockReadModel.adminActionRequests
  },
  async listPlatformHealthSignals() {
    return mockReadModel.platformHealthSignals
  },
  async listImpersonationTargets() {
    return mockReadModel.impersonationTargets
  },
  async listImpersonationSessions() {
    return mockReadModel.impersonationSessions
  },
  async listAuditEvents() {
    return mockReadModel.auditEvents
  },
  async listAgentDefinitions() {
    return mockReadModel.agentDefinitions
  },
  async listAgentEvents() {
    return mockReadModel.agentEvents
  },
  async listInternalAdminUsers() {
    return mockReadModel.internalAdminUsers
  },
  async listFeatureFlags() {
    return mockReadModel.featureFlags
  },
  async listSupportNotes(scope?: { scopeType: SupportNote['scopeType']; scopeId: string }) {
    if (!scope) return mockReadModel.supportNotes
    return mockReadModel.supportNotes.filter(note => note.scopeType === scope.scopeType && note.scopeId === scope.scopeId)
  },
  async listActivityEvents(scope?: { scopeType: ActivityEvent['scopeType']; scopeId: string }) {
    if (!scope) return mockReadModel.activityEvents
    return mockReadModel.activityEvents.filter(event => event.scopeType === scope.scopeType && event.scopeId === scope.scopeId)
  },
  async listUsageAnalytics() {
    return mockReadModel.usageAnalytics
  },
}

function filterVenues(venues: VenueSummary[], scope?: { organizationId?: string; propertyId?: string }) {
  if (!scope?.organizationId && !scope?.propertyId) return venues
  return venues.filter(venue => {
    const organizationMatch = scope.organizationId ? venue.organizationId === scope.organizationId : true
    const propertyMatch = scope.propertyId ? venue.propertyId === scope.propertyId : true
    return organizationMatch && propertyMatch
  })
}

function filterModuleActivations(activations: ModuleActivationSnapshot[], scope?: { organizationId?: string; venueId?: string }) {
  if (!scope?.organizationId && !scope?.venueId) return activations
  return activations.filter(activation => {
    if (scope.venueId && activation.scopeType === 'venue') return activation.scopeId === scope.venueId
    if (scope.organizationId && activation.scopeType === 'organization') return activation.scopeId === scope.organizationId
    return false
  })
}
