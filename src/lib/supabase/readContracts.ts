import type {
  ActivityEvent,
  AgentDefinition,
  AgentEventRecord,
  BillingRiskRecord,
  ImpersonationSessionRecord,
  ImpersonationTarget,
  ModuleActivationSnapshot,
  ModuleAdoptionRow,
  ModuleUsageGap,
  OrganizationSummary,
  PropertySummary,
  RegistrationRecord,
  RevenueMetricRecord,
  PlatformHealthSignal,
  SupportNote,
  SupportIssue,
  UsageAnalyticsRow,
  VenueSummary,
} from '../mock-data/mockPlatform'

export const readOnlyViewNames = {
  organizations: 'platform_admin_organizations_read',
  properties: 'platform_admin_properties_read',
  venues: 'platform_admin_venues_read',
  moduleActivations: 'platform_admin_module_activations_read',
  moduleAdoption: 'platform_admin_module_adoption_read',
  moduleUsageGaps: 'platform_admin_module_usage_gaps_read',
  registrations: 'platform_admin_registrations_read',
  revenueMetrics: 'platform_admin_revenue_metrics_read',
  billingRisks: 'platform_admin_billing_risks_read',
  supportIssues: 'platform_admin_support_issues_read',
  platformHealthSignals: 'platform_admin_health_signals_read',
  impersonationTargets: 'platform_admin_impersonation_targets_read',
  impersonationSessions: 'platform_admin_impersonation_sessions_read',
  agentDefinitions: 'platform_admin_agent_definitions_read',
  agentEvents: 'platform_admin_agent_events_read',
  supportNotes: 'platform_admin_support_notes_read',
  activityEvents: 'platform_admin_activity_events_read',
  usageAnalytics: 'platform_admin_usage_analytics_read',
} as const

export interface PlatformAdminReadModel {
  organizations: OrganizationSummary[]
  properties: PropertySummary[]
  venues: VenueSummary[]
  moduleActivations: ModuleActivationSnapshot[]
  moduleAdoption: ModuleAdoptionRow[]
  moduleUsageGaps: ModuleUsageGap[]
  registrations: RegistrationRecord[]
  revenueMetrics: RevenueMetricRecord[]
  billingRisks: BillingRiskRecord[]
  supportIssues: SupportIssue[]
  platformHealthSignals: PlatformHealthSignal[]
  impersonationTargets: ImpersonationTarget[]
  impersonationSessions: ImpersonationSessionRecord[]
  agentDefinitions: AgentDefinition[]
  agentEvents: AgentEventRecord[]
  supportNotes: SupportNote[]
  activityEvents: ActivityEvent[]
  usageAnalytics: UsageAnalyticsRow[]
}

export interface ReadOnlySupabaseAdapter {
  listOrganizations(): Promise<OrganizationSummary[]>
  listProperties(organizationId?: string): Promise<PropertySummary[]>
  listVenues(scope?: { organizationId?: string; propertyId?: string }): Promise<VenueSummary[]>
  listModuleActivations(scope?: { organizationId?: string; venueId?: string }): Promise<ModuleActivationSnapshot[]>
  listModuleAdoption(): Promise<ModuleAdoptionRow[]>
  listModuleUsageGaps(): Promise<ModuleUsageGap[]>
  listRegistrations(): Promise<RegistrationRecord[]>
  listRevenueMetrics(): Promise<RevenueMetricRecord[]>
  listBillingRisks(): Promise<BillingRiskRecord[]>
  listSupportIssues(): Promise<SupportIssue[]>
  listPlatformHealthSignals(): Promise<PlatformHealthSignal[]>
  listImpersonationTargets(): Promise<ImpersonationTarget[]>
  listImpersonationSessions(): Promise<ImpersonationSessionRecord[]>
  listAgentDefinitions(): Promise<AgentDefinition[]>
  listAgentEvents(): Promise<AgentEventRecord[]>
  listSupportNotes(scope: { scopeType: SupportNote['scopeType']; scopeId: string }): Promise<SupportNote[]>
  listActivityEvents(scope: { scopeType: ActivityEvent['scopeType']; scopeId: string }): Promise<ActivityEvent[]>
  listUsageAnalytics(): Promise<UsageAnalyticsRow[]>
}

export const readOnlyConnectionRule =
  'Connect Platform Admin to read-only Supabase views first. Do not weaken tenant RLS or enable mutations until permissions, contracts, and audit behavior are stable.'
