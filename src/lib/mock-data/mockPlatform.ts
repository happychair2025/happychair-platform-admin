import type { AuditEvent } from '../audit/auditLog'

export type ClientHealthStatus = 'Healthy' | 'Growing' | 'Needs Attention' | 'At Risk' | 'Expansion Candidate'
export type BillingStatus = 'Current' | 'Past Due' | 'Trial' | 'Failed Payment'
export type AccountStatus = 'Active' | 'Trial' | 'Paused' | 'At Risk'

export interface OrganizationSummary {
  id: string
  name: string
  accountStatus: AccountStatus
  plan: 'Starter' | 'Growth' | 'Premium' | 'Enterprise'
  billingStatus: BillingStatus
  marketType: string
  mrr: number
  properties: number
  venues: number
  users: number
  staff: number
  healthScore: number
  healthStatus: ClientHealthStatus
  usageScore: number
  expansionScore: number
  lastActive: string
  enabledModules: string[]
}

export interface VenueSummary {
  id: string
  organizationId: string
  propertyName: string
  name: string
  venueType: string
  status: 'Live' | 'Setup' | 'Needs Attention'
  activeRequests: number
  staffOnline: number
  devicesOnline: number
  devicesOffline: number
  qrScansToday: number
  sessionsToday: number
  openEscalations: number
  notificationHealth: 'Passing' | 'Warning' | 'Failing'
  lastActivity: string
  averageResponseSeconds: number
  enabledModules: string[]
}

export interface HealthCheckItem {
  id: string
  check: string
  status: 'Passing' | 'Warning' | 'Failing' | 'Unknown'
  severity: 'info' | 'notice' | 'warning' | 'critical'
  message: string
  recommendedAction: string
}

export interface PropertySummary {
  id: string
  organizationId: string
  name: string
  location: string
  status: 'Active' | 'Setup' | 'Needs Attention'
  venues: number
  staff: number
  healthScore: number
  lastActive: string
}

export interface SupportNote {
  id: string
  scopeType: 'organization' | 'property' | 'venue'
  scopeId: string
  author: string
  authorRole: string
  body: string
  createdAt: string
}

export interface ActivityEvent {
  id: string
  scopeType: 'organization' | 'property' | 'venue'
  scopeId: string
  type: 'usage' | 'support' | 'billing' | 'module' | 'health'
  label: string
  detail: string
  createdAt: string
}

export interface ModuleActivationSnapshot {
  id: string
  scopeType: 'organization' | 'property' | 'venue'
  scopeId: string
  moduleName: string
  enabled: boolean
  activationLevel: 'Organization' | 'Property' | 'Venue'
  usageLast7Days: number
  revenueAttributed: number
  activatedAt: string
}

export interface UsageAnalyticsRow {
  id: string
  organizationId: string
  organizationName: string
  marketType: string
  status: 'Active' | 'Trial' | 'At Risk'
  activeUsers7d: number
  staffAdoption: number
  managerLogins7d: number
  guestInteractions7d: number
  qrScans7d: number
  serviceRequests7d: number
  resolvedRequests7d: number
  ignoredRequests7d: number
  averageResponseSeconds: number
  escalations7d: number
  reportsViewed7d: number
  moduleUsage7d: number
  usageTrend: 'Growing' | 'Flat' | 'Declining'
  lastActive: string
  inactiveDays: number
}

export interface ModuleUsageGap {
  id: string
  organizationName: string
  moduleName: string
  enabledAt: string
  usageLast7Days: number
  recommendedAction: string
  owner: 'Support' | 'Client Success' | 'Marketing'
}

export interface ModuleAdoptionRow {
  moduleName: string
  enabledClients: number
  activeClients7d: number
  usageEvents7d: number
  revenueAttributed: number
  adoptionRate: number
}

export type PropertyType = 'Restaurant' | 'Hotel' | 'Casino' | 'Stadium' | 'Resort' | 'Senior Living' | 'Healthcare' | 'Private Club' | 'Event Venue' | 'Other'

export interface RegistrationRecord {
  id: string
  email: string
  companyName: string
  source: string
  campaign: string
  marketType: string
  selectedPlan: 'Starter' | 'Growth' | 'Premium' | 'Enterprise'
  propertyType: PropertyType
  status: 'Demo Requested' | 'Trial Started' | 'Converted' | 'Abandoned' | 'Setup Incomplete'
  createdAt: string
  setupCompletion: number
  projectedMrr: number
}

export interface RevenueMetricRecord {
  id: string
  organizationName: string
  metricType: 'mrr' | 'new_mrr' | 'expansion_mrr' | 'churned_mrr' | 'reactivated_mrr'
  amount: number
  currency: 'USD'
  source: 'internal_mock' | 'stripe_pending' | 'quickbooks_pending'
  periodStart: string
  periodEnd: string
  plan: 'Starter' | 'Growth' | 'Premium' | 'Enterprise'
  moduleName?: string
  marketType: string
  acquisitionChannel: string
}

export interface BillingRiskRecord {
  id: string
  organizationName: string
  billingStatus: 'Failed Payment' | 'Past Due' | 'Discount Review' | 'Credit Review'
  amountAtRisk: number
  mrr: number
  lastPaymentAttempt: string
  nextAction: string
  owner: 'Finance' | 'Client Success' | 'Owner'
}

export interface SupportIssue {
  id: string
  organizationName: string
  propertyName: string
  venueName: string
  issueType: 'Notification Delivery' | 'Device Offline' | 'Inactive Venue' | 'High Escalations' | 'Module Configuration' | 'QR Scan Failure' | 'Stalled Queue'
  severity: 'info' | 'notice' | 'warning' | 'critical'
  status: 'Open' | 'Investigating' | 'Escalated' | 'Resolved'
  detectedAt: string
  affectedUsers: number
  probableCause: string
  recommendedAction: string
  relatedSignal: string
  owner: 'Support' | 'Engineering' | 'Client Success'
}

export interface PlatformHealthSignal {
  id: string
  checkKey: 'notification_delivery' | 'websocket_sessions' | 'api_errors' | 'database_sync' | 'qr_scans' | 'device_presence' | 'service_queue' | 'module_configuration'
  label: string
  status: 'Passing' | 'Warning' | 'Failing' | 'Unknown'
  severity: 'info' | 'notice' | 'warning' | 'critical'
  affectedClients: number
  affectedVenues: number
  message: string
  probableCause: string
  recommendedAction: string
  checkedAt: string
}

export type ImpersonationTargetRole = 'Organization Admin' | 'Property Admin' | 'Venue Manager' | 'Staff User'

export interface ImpersonationTarget {
  id: string
  userId: string
  name: string
  email: string
  role: ImpersonationTargetRole
  organizationId: string
  organizationName: string
  propertyId?: string
  propertyName?: string
  venueId?: string
  venueName?: string
  scopeLabel: string
  accountStatus: AccountStatus
  lastActive: string
}

export interface ImpersonationSessionRecord {
  id: string
  adminName: string
  adminRole: string
  targetName: string
  targetRole: ImpersonationTargetRole
  organizationName: string
  propertyName?: string
  venueName?: string
  reason: string
  startedAt: string
  endedAt: string
  status: 'Completed' | 'Expired' | 'Active'
  destructiveActionsBlocked: number
}

export type AgentKey = 'marketing' | 'email' | 'support' | 'finance' | 'client_success'

export interface AgentDefinition {
  key: AgentKey
  name: string
  owner: 'Marketing' | 'Client Success' | 'Support' | 'Finance' | 'Owner'
  status: 'Monitoring Ready' | 'Draft Only' | 'Planned'
  purpose: string
  monitors: string[]
  allowedActions: string[]
  blockedActions: string[]
}

export interface AgentEventRecord {
  id: string
  agentKey: AgentKey
  agentName: string
  organizationName?: string
  propertyName?: string
  venueName?: string
  eventType: 'Trigger Detected' | 'Summary Drafted' | 'Risk Flagged' | 'Recommendation Created' | 'Lifecycle Drafted'
  status: 'Queued' | 'Needs Review' | 'Reviewed' | 'Draft Only'
  inputSummary: string
  outputSummary: string
  auditRequired: boolean
  createdAt: string
}

export const executiveMetrics = [
  { label: 'MRR', value: '$42,780', delta: '+8.2%', tone: 'ok' },
  { label: 'ARR', value: '$513,360', delta: '+$39.4k', tone: 'ok' },
  { label: 'Active Clients', value: '38', delta: '+4 this month', tone: 'ok' },
  { label: 'Paid Conversions', value: '7', delta: '+2 today', tone: 'ok' },
  { label: 'Failed Payments', value: '$2,140', delta: '3 accounts', tone: 'danger' },
  { label: 'At-Risk Clients', value: '5', delta: '-1 from last week', tone: 'warn' },
] as const

export const insightCards = [
  {
    title: 'Usage gap',
    detail: '12 clients have not used Service Signal in 7 days.',
    owner: 'Client Success',
    tone: 'warning',
  },
  {
    title: 'Likely conversions',
    detail: '4 trials are likely to convert based on setup completion.',
    owner: 'Marketing',
    tone: 'ok',
  },
  {
    title: 'Payment risk',
    detail: 'Failed payments represent $2,140 in at-risk MRR.',
    owner: 'Finance',
    tone: 'critical',
  },
  {
    title: 'Upsell candidates',
    detail: '3 venues show high usage and are strong premium module candidates.',
    owner: 'Owner',
    tone: 'ok',
  },
] as const

export const organizations: OrganizationSummary[] = [
  {
    id: 'org-happy-bistro',
    name: 'Happy Bistro Group',
    accountStatus: 'Active',
    plan: 'Premium',
    billingStatus: 'Current',
    marketType: 'Restaurant',
    mrr: 1299,
    properties: 1,
    venues: 1,
    users: 11,
    staff: 28,
    healthScore: 91,
    healthStatus: 'Expansion Candidate',
    usageScore: 88,
    expansionScore: 94,
    lastActive: '8 minutes ago',
    enabledModules: ['Service Requests', 'Guest Sentiment', 'Allergy Shield'],
  },
  {
    id: 'org-bayfront-resort',
    name: 'Bayfront Resort Collection',
    accountStatus: 'Trial',
    plan: 'Enterprise',
    billingStatus: 'Trial',
    marketType: 'Resort',
    mrr: 0,
    properties: 2,
    venues: 6,
    users: 18,
    staff: 112,
    healthScore: 77,
    healthStatus: 'Growing',
    usageScore: 69,
    expansionScore: 82,
    lastActive: '31 minutes ago',
    enabledModules: ['Service Requests', 'Service Signal / Paging'],
  },
  {
    id: 'org-copper-club',
    name: 'Copper Club Hospitality',
    accountStatus: 'At Risk',
    plan: 'Growth',
    billingStatus: 'Failed Payment',
    marketType: 'Private Club',
    mrr: 749,
    properties: 1,
    venues: 3,
    users: 8,
    staff: 46,
    healthScore: 38,
    healthStatus: 'At Risk',
    usageScore: 29,
    expansionScore: 21,
    lastActive: '9 days ago',
    enabledModules: ['Service Requests'],
  },
  {
    id: 'org-stadium-north',
    name: 'Stadium North Operations',
    accountStatus: 'Active',
    plan: 'Enterprise',
    billingStatus: 'Current',
    marketType: 'Stadium',
    mrr: 6400,
    properties: 1,
    venues: 14,
    users: 74,
    staff: 390,
    healthScore: 83,
    healthStatus: 'Healthy',
    usageScore: 79,
    expansionScore: 76,
    lastActive: '4 minutes ago',
    enabledModules: ['Service Requests', 'Escalations', 'Executive Reporting'],
  },
]

export const properties: PropertySummary[] = [
  {
    id: 'property-cape-coral',
    organizationId: 'org-happy-bistro',
    name: 'Cape Coral Property',
    location: 'Cape Coral, FL',
    status: 'Active',
    venues: 1,
    staff: 28,
    healthScore: 91,
    lastActive: '2 minutes ago',
  },
  {
    id: 'property-bayfront-main',
    organizationId: 'org-bayfront-resort',
    name: 'Bayfront Main Resort',
    location: 'Naples, FL',
    status: 'Setup',
    venues: 4,
    staff: 78,
    healthScore: 74,
    lastActive: '31 minutes ago',
  },
  {
    id: 'property-bayfront-marina',
    organizationId: 'org-bayfront-resort',
    name: 'Bayfront Marina Club',
    location: 'Naples, FL',
    status: 'Setup',
    venues: 2,
    staff: 34,
    healthScore: 69,
    lastActive: '1 hour ago',
  },
  {
    id: 'property-copper-main',
    organizationId: 'org-copper-club',
    name: 'Copper Club Main',
    location: 'Sarasota, FL',
    status: 'Needs Attention',
    venues: 3,
    staff: 46,
    healthScore: 38,
    lastActive: '9 days ago',
  },
  {
    id: 'property-stadium-north',
    organizationId: 'org-stadium-north',
    name: 'Stadium North Campus',
    location: 'Tampa, FL',
    status: 'Active',
    venues: 14,
    staff: 390,
    healthScore: 83,
    lastActive: '4 minutes ago',
  },
]

export const venues: VenueSummary[] = [
  {
    id: 'venue-happy-bistro',
    organizationId: 'org-happy-bistro',
    propertyName: 'Cape Coral Property',
    name: 'Happy Bistro',
    venueType: 'Restaurant',
    status: 'Live',
    activeRequests: 7,
    staffOnline: 9,
    devicesOnline: 5,
    devicesOffline: 1,
    qrScansToday: 146,
    sessionsToday: 92,
    openEscalations: 1,
    notificationHealth: 'Passing',
    lastActivity: '2 minutes ago',
    averageResponseSeconds: 86,
    enabledModules: ['Service Requests', 'Guest Sentiment', 'Allergy Shield'],
  },
  {
    id: 'venue-copper-main',
    organizationId: 'org-copper-club',
    propertyName: 'Copper Club Main',
    name: 'Copper Club Dining',
    venueType: 'Private Club',
    status: 'Needs Attention',
    activeRequests: 0,
    staffOnline: 0,
    devicesOnline: 1,
    devicesOffline: 4,
    qrScansToday: 3,
    sessionsToday: 1,
    openEscalations: 2,
    notificationHealth: 'Failing',
    lastActivity: '9 days ago',
    averageResponseSeconds: 0,
    enabledModules: ['Service Requests'],
  },
]

export const moduleActivations: ModuleActivationSnapshot[] = [
  {
    id: 'activation-1',
    scopeType: 'organization',
    scopeId: 'org-happy-bistro',
    moduleName: 'Service Requests',
    enabled: true,
    activationLevel: 'Organization',
    usageLast7Days: 842,
    revenueAttributed: 399,
    activatedAt: '2026-05-04',
  },
  {
    id: 'activation-2',
    scopeType: 'venue',
    scopeId: 'venue-happy-bistro',
    moduleName: 'Guest Sentiment',
    enabled: true,
    activationLevel: 'Venue',
    usageLast7Days: 144,
    revenueAttributed: 199,
    activatedAt: '2026-05-12',
  },
  {
    id: 'activation-3',
    scopeType: 'venue',
    scopeId: 'venue-happy-bistro',
    moduleName: 'Allergy Shield',
    enabled: true,
    activationLevel: 'Venue',
    usageLast7Days: 37,
    revenueAttributed: 349,
    activatedAt: '2026-05-15',
  },
  {
    id: 'activation-4',
    scopeType: 'organization',
    scopeId: 'org-copper-club',
    moduleName: 'Service Requests',
    enabled: true,
    activationLevel: 'Organization',
    usageLast7Days: 3,
    revenueAttributed: 399,
    activatedAt: '2026-04-29',
  },
]

export const healthChecks: HealthCheckItem[] = [
  {
    id: 'notifications',
    check: 'Notification Delivery',
    status: 'Passing',
    severity: 'info',
    message: 'Recent staff alert delivery is within expected range.',
    recommendedAction: 'No action required.',
  },
  {
    id: 'devices',
    check: 'Device Presence',
    status: 'Warning',
    severity: 'warning',
    message: 'One service tablet has been offline for 41 minutes.',
    recommendedAction: 'Ask the venue to verify tablet power and network connection.',
  },
  {
    id: 'queue',
    check: 'Service Queue',
    status: 'Warning',
    severity: 'warning',
    message: 'One request has been open longer than the target response window.',
    recommendedAction: 'Escalate to the floor manager if still unresolved.',
  },
  {
    id: 'qr',
    check: 'QR Activity',
    status: 'Passing',
    severity: 'info',
    message: 'QR scan and session activity are aligned.',
    recommendedAction: 'No action required.',
  },
]

export const supportNotes: SupportNote[] = [
  {
    id: 'note-1',
    scopeType: 'organization',
    scopeId: 'org-happy-bistro',
    author: 'Team Happy Chair',
    authorRole: 'Owner',
    body: 'Strong premium module candidate. Review Guest Sentiment and Executive Reporting expansion after pilot service weekend.',
    createdAt: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
  },
  {
    id: 'note-2',
    scopeType: 'venue',
    scopeId: 'venue-happy-bistro',
    author: 'Support Lead',
    authorRole: 'Support Lead',
    body: 'Tablet 3 reported intermittent Wi-Fi. Ask manager to confirm placement before Friday dinner service.',
    createdAt: new Date(Date.now() - 1000 * 60 * 83).toISOString(),
  },
  {
    id: 'note-3',
    scopeType: 'organization',
    scopeId: 'org-copper-club',
    author: 'Finance',
    authorRole: 'Finance',
    body: 'Failed payment follow-up needed before module expansion conversation.',
    createdAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
  },
  {
    id: 'note-4',
    scopeType: 'venue',
    scopeId: 'venue-copper-main',
    author: 'Support Agent',
    authorRole: 'Support Agent',
    body: 'Client reports staff stopped using dashboard after QR code placement changed.',
    createdAt: new Date(Date.now() - 1000 * 60 * 412).toISOString(),
  },
]

export const activityEvents: ActivityEvent[] = [
  {
    id: 'activity-1',
    scopeType: 'organization',
    scopeId: 'org-happy-bistro',
    type: 'usage',
    label: 'High module usage',
    detail: 'Service Requests usage is 21% above the 7-day baseline.',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'activity-2',
    scopeType: 'venue',
    scopeId: 'venue-happy-bistro',
    type: 'health',
    label: 'Device warning',
    detail: 'One service tablet has been offline for 41 minutes.',
    createdAt: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
  },
  {
    id: 'activity-3',
    scopeType: 'organization',
    scopeId: 'org-copper-club',
    type: 'billing',
    label: 'Payment failed',
    detail: 'Current invoice payment failed and moved account into risk state.',
    createdAt: new Date(Date.now() - 1000 * 60 * 128).toISOString(),
  },
  {
    id: 'activity-4',
    scopeType: 'venue',
    scopeId: 'venue-copper-main',
    type: 'support',
    label: 'Inactivity detected',
    detail: 'Venue has no meaningful staff activity in 9 days.',
    createdAt: new Date(Date.now() - 1000 * 60 * 780).toISOString(),
  },
  {
    id: 'activity-5',
    scopeType: 'organization',
    scopeId: 'org-bayfront-resort',
    type: 'module',
    label: 'Setup milestone',
    detail: 'Trial account completed 78% of setup checklist.',
    createdAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
  },
]

export const usageAnalytics: UsageAnalyticsRow[] = [
  {
    id: 'usage-happy-bistro',
    organizationId: 'org-happy-bistro',
    organizationName: 'Happy Bistro Group',
    marketType: 'Restaurant',
    status: 'Active',
    activeUsers7d: 17,
    staffAdoption: 86,
    managerLogins7d: 24,
    guestInteractions7d: 842,
    qrScans7d: 1180,
    serviceRequests7d: 388,
    resolvedRequests7d: 372,
    ignoredRequests7d: 4,
    averageResponseSeconds: 86,
    escalations7d: 8,
    reportsViewed7d: 14,
    moduleUsage7d: 1023,
    usageTrend: 'Growing',
    lastActive: '8 minutes ago',
    inactiveDays: 0,
  },
  {
    id: 'usage-bayfront',
    organizationId: 'org-bayfront-resort',
    organizationName: 'Bayfront Resort Collection',
    marketType: 'Resort',
    status: 'Trial',
    activeUsers7d: 9,
    staffAdoption: 54,
    managerLogins7d: 12,
    guestInteractions7d: 271,
    qrScans7d: 398,
    serviceRequests7d: 141,
    resolvedRequests7d: 132,
    ignoredRequests7d: 7,
    averageResponseSeconds: 118,
    escalations7d: 6,
    reportsViewed7d: 5,
    moduleUsage7d: 305,
    usageTrend: 'Growing',
    lastActive: '31 minutes ago',
    inactiveDays: 0,
  },
  {
    id: 'usage-copper',
    organizationId: 'org-copper-club',
    organizationName: 'Copper Club Hospitality',
    marketType: 'Private Club',
    status: 'At Risk',
    activeUsers7d: 1,
    staffAdoption: 9,
    managerLogins7d: 1,
    guestInteractions7d: 3,
    qrScans7d: 11,
    serviceRequests7d: 3,
    resolvedRequests7d: 1,
    ignoredRequests7d: 2,
    averageResponseSeconds: 0,
    escalations7d: 2,
    reportsViewed7d: 0,
    moduleUsage7d: 3,
    usageTrend: 'Declining',
    lastActive: '9 days ago',
    inactiveDays: 9,
  },
  {
    id: 'usage-stadium',
    organizationId: 'org-stadium-north',
    organizationName: 'Stadium North Operations',
    marketType: 'Stadium',
    status: 'Active',
    activeUsers7d: 88,
    staffAdoption: 74,
    managerLogins7d: 63,
    guestInteractions7d: 2480,
    qrScans7d: 3940,
    serviceRequests7d: 1194,
    resolvedRequests7d: 1122,
    ignoredRequests7d: 18,
    averageResponseSeconds: 92,
    escalations7d: 34,
    reportsViewed7d: 28,
    moduleUsage7d: 2960,
    usageTrend: 'Flat',
    lastActive: '4 minutes ago',
    inactiveDays: 0,
  },
]

export const moduleUsageGaps: ModuleUsageGap[] = [
  {
    id: 'gap-service-signal',
    organizationName: 'Copper Club Hospitality',
    moduleName: 'Service Signal / Paging',
    enabledAt: '2026-05-03',
    usageLast7Days: 0,
    recommendedAction: 'Schedule enablement call and verify staff notification routing.',
    owner: 'Client Success',
  },
  {
    id: 'gap-guest-sentiment',
    organizationName: 'Bayfront Resort Collection',
    moduleName: 'Guest Sentiment',
    enabledAt: '2026-05-18',
    usageLast7Days: 2,
    recommendedAction: 'Confirm QR placement and manager report expectations.',
    owner: 'Support',
  },
  {
    id: 'gap-executive-reporting',
    organizationName: 'Stadium North Operations',
    moduleName: 'Executive Reporting',
    enabledAt: '2026-05-11',
    usageLast7Days: 1,
    recommendedAction: 'Show ownership weekly report value during next business review.',
    owner: 'Client Success',
  },
]

export const moduleAdoption: ModuleAdoptionRow[] = [
  {
    moduleName: 'Service Requests',
    enabledClients: 38,
    activeClients7d: 34,
    usageEvents7d: 4820,
    revenueAttributed: 15162,
    adoptionRate: 89,
  },
  {
    moduleName: 'Service Signal / Paging',
    enabledClients: 19,
    activeClients7d: 13,
    usageEvents7d: 1720,
    revenueAttributed: 5681,
    adoptionRate: 68,
  },
  {
    moduleName: 'Guest Sentiment',
    enabledClients: 11,
    activeClients7d: 7,
    usageEvents7d: 482,
    revenueAttributed: 2189,
    adoptionRate: 64,
  },
  {
    moduleName: 'Allergy Shield',
    enabledClients: 7,
    activeClients7d: 5,
    usageEvents7d: 196,
    revenueAttributed: 2443,
    adoptionRate: 71,
  },
  {
    moduleName: 'Executive Reporting',
    enabledClients: 6,
    activeClients7d: 2,
    usageEvents7d: 39,
    revenueAttributed: 1800,
    adoptionRate: 33,
  },
]

export const registrations: RegistrationRecord[] = [
  {
    id: 'reg-1',
    email: 'ops@bayfront.example',
    companyName: 'Bayfront Resort Collection',
    source: 'Website',
    campaign: 'resort-ops-q2',
    marketType: 'Resort',
    selectedPlan: 'Enterprise',
    propertyType: 'Resort',
    status: 'Trial Started',
    createdAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    setupCompletion: 78,
    projectedMrr: 3200,
  },
  {
    id: 'reg-2',
    email: 'owner@marina-table.example',
    companyName: 'Marina Table Group',
    source: 'Demo Request',
    campaign: 'restaurant-pilot',
    marketType: 'Restaurant',
    selectedPlan: 'Premium',
    propertyType: 'Restaurant',
    status: 'Demo Requested',
    createdAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    setupCompletion: 0,
    projectedMrr: 1299,
  },
  {
    id: 'reg-3',
    email: 'admin@stadiumnorth.example',
    companyName: 'Stadium North Operations',
    source: 'Founder Outreach',
    campaign: 'enterprise-venues',
    marketType: 'Stadium',
    selectedPlan: 'Enterprise',
    propertyType: 'Stadium',
    status: 'Converted',
    createdAt: new Date(Date.now() - 1000 * 60 * 620).toISOString(),
    setupCompletion: 100,
    projectedMrr: 6400,
  },
  {
    id: 'reg-4',
    email: 'gm@copperclub.example',
    companyName: 'Copper Club Hospitality',
    source: 'Referral',
    campaign: 'private-club-intro',
    marketType: 'Private Club',
    selectedPlan: 'Growth',
    propertyType: 'Private Club',
    status: 'Setup Incomplete',
    createdAt: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
    setupCompletion: 42,
    projectedMrr: 749,
  },
  {
    id: 'reg-5',
    email: 'events@skyline.example',
    companyName: 'Skyline Events',
    source: 'Paid Search',
    campaign: 'event-venue-service',
    marketType: 'Event Venue',
    selectedPlan: 'Growth',
    propertyType: 'Event Venue',
    status: 'Abandoned',
    createdAt: new Date(Date.now() - 1000 * 60 * 1320).toISOString(),
    setupCompletion: 18,
    projectedMrr: 899,
  },
]

export const revenueMetrics: RevenueMetricRecord[] = [
  {
    id: 'rev-1',
    organizationName: 'Happy Bistro Group',
    metricType: 'mrr',
    amount: 1299,
    currency: 'USD',
    source: 'internal_mock',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Premium',
    moduleName: 'Guest Sentiment',
    marketType: 'Restaurant',
    acquisitionChannel: 'Founder Outreach',
  },
  {
    id: 'rev-2',
    organizationName: 'Stadium North Operations',
    metricType: 'mrr',
    amount: 6400,
    currency: 'USD',
    source: 'internal_mock',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Enterprise',
    moduleName: 'Executive Reporting',
    marketType: 'Stadium',
    acquisitionChannel: 'Founder Outreach',
  },
  {
    id: 'rev-3',
    organizationName: 'Copper Club Hospitality',
    metricType: 'mrr',
    amount: 749,
    currency: 'USD',
    source: 'internal_mock',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Growth',
    moduleName: 'Service Requests',
    marketType: 'Private Club',
    acquisitionChannel: 'Referral',
  },
  {
    id: 'rev-4',
    organizationName: 'Happy Bistro Group',
    metricType: 'expansion_mrr',
    amount: 349,
    currency: 'USD',
    source: 'internal_mock',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Premium',
    moduleName: 'Allergy Shield',
    marketType: 'Restaurant',
    acquisitionChannel: 'Founder Outreach',
  },
  {
    id: 'rev-5',
    organizationName: 'Bayfront Resort Collection',
    metricType: 'new_mrr',
    amount: 3200,
    currency: 'USD',
    source: 'stripe_pending',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Enterprise',
    moduleName: 'Multi-Property Management',
    marketType: 'Resort',
    acquisitionChannel: 'Website',
  },
  {
    id: 'rev-6',
    organizationName: 'Skyline Events',
    metricType: 'churned_mrr',
    amount: 899,
    currency: 'USD',
    source: 'stripe_pending',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    plan: 'Growth',
    marketType: 'Event Venue',
    acquisitionChannel: 'Paid Search',
  },
]

export const billingRisks: BillingRiskRecord[] = [
  {
    id: 'risk-1',
    organizationName: 'Copper Club Hospitality',
    billingStatus: 'Failed Payment',
    amountAtRisk: 749,
    mrr: 749,
    lastPaymentAttempt: '2026-05-24',
    nextAction: 'Confirm payment method and pause expansion conversation until resolved.',
    owner: 'Finance',
  },
  {
    id: 'risk-2',
    organizationName: 'Skyline Events',
    billingStatus: 'Past Due',
    amountAtRisk: 899,
    mrr: 899,
    lastPaymentAttempt: '2026-05-22',
    nextAction: 'Send trial recovery note and offer setup assistance.',
    owner: 'Client Success',
  },
  {
    id: 'risk-3',
    organizationName: 'Bayfront Resort Collection',
    billingStatus: 'Discount Review',
    amountAtRisk: 640,
    mrr: 3200,
    lastPaymentAttempt: '2026-05-20',
    nextAction: 'Review enterprise pilot discount before conversion.',
    owner: 'Owner',
  },
]

export const supportIssues: SupportIssue[] = [
  {
    id: 'support-1',
    organizationName: 'Copper Club Hospitality',
    propertyName: 'Copper Club Main',
    venueName: 'Copper Club Dining',
    issueType: 'Inactive Venue',
    severity: 'critical',
    status: 'Open',
    detectedAt: new Date(Date.now() - 1000 * 60 * 780).toISOString(),
    affectedUsers: 46,
    probableCause: 'Staff adoption dropped after QR code placement changed.',
    recommendedAction: 'Assign support owner, confirm QR placement, and schedule staff enablement call.',
    relatedSignal: 'No meaningful staff or guest activity in 9 days.',
    owner: 'Client Success',
  },
  {
    id: 'support-2',
    organizationName: 'Happy Bistro Group',
    propertyName: 'Cape Coral Property',
    venueName: 'Happy Bistro',
    issueType: 'Device Offline',
    severity: 'warning',
    status: 'Investigating',
    detectedAt: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
    affectedUsers: 9,
    probableCause: 'One service tablet may have weak Wi-Fi or low power.',
    recommendedAction: 'Ask manager to verify tablet power, Wi-Fi, and placement before dinner service.',
    relatedSignal: 'Tablet 3 offline for 41 minutes.',
    owner: 'Support',
  },
  {
    id: 'support-3',
    organizationName: 'Bayfront Resort Collection',
    propertyName: 'Bayfront Main Resort',
    venueName: 'Pool Service Deck',
    issueType: 'Module Configuration',
    severity: 'notice',
    status: 'Open',
    detectedAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
    affectedUsers: 18,
    probableCause: 'Trial account has Service Signal enabled but routing is incomplete.',
    recommendedAction: 'Review module setup checklist and confirm staff alert routing.',
    relatedSignal: 'Setup completion is 78% with low module usage.',
    owner: 'Support',
  },
  {
    id: 'support-4',
    organizationName: 'Stadium North Operations',
    propertyName: 'Stadium North Campus',
    venueName: 'Concourse A',
    issueType: 'High Escalations',
    severity: 'warning',
    status: 'Escalated',
    detectedAt: new Date(Date.now() - 1000 * 60 * 64).toISOString(),
    affectedUsers: 88,
    probableCause: 'Request volume exceeded staffing coverage during event rush.',
    recommendedAction: 'Review staffing pattern and escalation thresholds before next event.',
    relatedSignal: '34 escalations in the last 7 days.',
    owner: 'Client Success',
  },
]

export const platformHealthSignals: PlatformHealthSignal[] = [
  {
    id: 'health-notifications',
    checkKey: 'notification_delivery',
    label: 'Notification Delivery',
    status: 'Warning',
    severity: 'warning',
    affectedClients: 1,
    affectedVenues: 1,
    message: 'One venue has delayed staff alert delivery.',
    probableCause: 'Offline tablet or incomplete staff alert routing.',
    recommendedAction: 'Verify device presence and staff routing configuration.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: 'health-websocket',
    checkKey: 'websocket_sessions',
    label: 'Websocket / Session Status',
    status: 'Passing',
    severity: 'info',
    affectedClients: 0,
    affectedVenues: 0,
    message: 'Realtime session activity is within expected range.',
    probableCause: 'No issue detected.',
    recommendedAction: 'No action required.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: 'health-api',
    checkKey: 'api_errors',
    label: 'API Error Rate',
    status: 'Passing',
    severity: 'info',
    affectedClients: 0,
    affectedVenues: 0,
    message: 'API errors remain below alert threshold.',
    probableCause: 'No issue detected.',
    recommendedAction: 'No action required.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: 'health-sync',
    checkKey: 'database_sync',
    label: 'Database Sync',
    status: 'Passing',
    severity: 'info',
    affectedClients: 0,
    affectedVenues: 0,
    message: 'Recent read/write sync checks are passing.',
    probableCause: 'No issue detected.',
    recommendedAction: 'No action required.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'health-qr',
    checkKey: 'qr_scans',
    label: 'QR Scan Failures',
    status: 'Warning',
    severity: 'warning',
    affectedClients: 2,
    affectedVenues: 3,
    message: 'A small number of venues show low QR conversion after scan.',
    probableCause: 'QR placement, guest network, or incomplete venue setup.',
    recommendedAction: 'Compare scan volume to session starts and confirm signage placement.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 'health-devices',
    checkKey: 'device_presence',
    label: 'Device Presence',
    status: 'Warning',
    severity: 'warning',
    affectedClients: 1,
    affectedVenues: 1,
    message: 'One venue has multiple offline devices.',
    probableCause: 'Tablet power, Wi-Fi, or staff process issue.',
    recommendedAction: 'Ask venue manager to check device power and network connection.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: 'health-queue',
    checkKey: 'service_queue',
    label: 'Stalled Service Queues',
    status: 'Failing',
    severity: 'critical',
    affectedClients: 1,
    affectedVenues: 1,
    message: 'One venue has unresolved service queues beyond the target window.',
    probableCause: 'Understaffed shift or staff not acknowledging requests.',
    recommendedAction: 'Open escalation and contact support lead.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'health-modules',
    checkKey: 'module_configuration',
    label: 'Module Configuration',
    status: 'Warning',
    severity: 'notice',
    affectedClients: 1,
    affectedVenues: 2,
    message: 'Enabled modules have incomplete configuration in trial accounts.',
    probableCause: 'Setup checklist not complete.',
    recommendedAction: 'Review module configuration before conversion call.',
    checkedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
]

export const impersonationTargets: ImpersonationTarget[] = [
  {
    id: 'target-happy-bistro-org-admin',
    userId: 'user-happy-bistro-owner',
    name: 'Avery Patel',
    email: 'avery@happybistro.example',
    role: 'Organization Admin',
    organizationId: 'org-happy-bistro',
    organizationName: 'Happy Bistro Group',
    propertyId: 'property-cape-coral',
    propertyName: 'Cape Coral Property',
    venueId: 'venue-happy-bistro',
    venueName: 'Happy Bistro',
    scopeLabel: 'Organization / Property / Venue',
    accountStatus: 'Active',
    lastActive: '8 minutes ago',
  },
  {
    id: 'target-happy-bistro-venue-manager',
    userId: 'user-happy-bistro-manager',
    name: 'Maria Garcia',
    email: 'maria@happybistro.example',
    role: 'Venue Manager',
    organizationId: 'org-happy-bistro',
    organizationName: 'Happy Bistro Group',
    propertyId: 'property-cape-coral',
    propertyName: 'Cape Coral Property',
    venueId: 'venue-happy-bistro',
    venueName: 'Happy Bistro',
    scopeLabel: 'Venue',
    accountStatus: 'Active',
    lastActive: '12 minutes ago',
  },
  {
    id: 'target-bayfront-property-admin',
    userId: 'user-bayfront-property-admin',
    name: 'Jordan Miles',
    email: 'jordan@bayfront.example',
    role: 'Property Admin',
    organizationId: 'org-bayfront-resort',
    organizationName: 'Bayfront Resort Collection',
    propertyId: 'property-bayfront-main',
    propertyName: 'Bayfront Main Resort',
    scopeLabel: 'Property',
    accountStatus: 'Trial',
    lastActive: '31 minutes ago',
  },
  {
    id: 'target-copper-staff',
    userId: 'user-copper-staff',
    name: 'Sam Lee',
    email: 'sam@copperclub.example',
    role: 'Staff User',
    organizationId: 'org-copper-club',
    organizationName: 'Copper Club Hospitality',
    propertyId: 'property-copper-main',
    propertyName: 'Copper Club Main',
    venueId: 'venue-copper-main',
    venueName: 'Copper Club Dining',
    scopeLabel: 'Venue Staff',
    accountStatus: 'At Risk',
    lastActive: '9 days ago',
  },
]

export const impersonationSessions: ImpersonationSessionRecord[] = [
  {
    id: 'impersonation-session-1',
    adminName: 'Support Lead',
    adminRole: 'Support Lead',
    targetName: 'Maria Garcia',
    targetRole: 'Venue Manager',
    organizationName: 'Happy Bistro Group',
    propertyName: 'Cape Coral Property',
    venueName: 'Happy Bistro',
    reason: 'Verified notification routing during support call.',
    startedAt: new Date(Date.now() - 1000 * 60 * 340).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 326).toISOString(),
    status: 'Completed',
    destructiveActionsBlocked: 1,
  },
  {
    id: 'impersonation-session-2',
    adminName: 'Engineering',
    adminRole: 'Engineering',
    targetName: 'Sam Lee',
    targetRole: 'Staff User',
    organizationName: 'Copper Club Hospitality',
    propertyName: 'Copper Club Main',
    venueName: 'Copper Club Dining',
    reason: 'Reproduced staff dashboard inactivity report.',
    startedAt: new Date(Date.now() - 1000 * 60 * 920).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 905).toISOString(),
    status: 'Expired',
    destructiveActionsBlocked: 0,
  },
  {
    id: 'impersonation-session-3',
    adminName: 'Client Success',
    adminRole: 'Client Success',
    targetName: 'Jordan Miles',
    targetRole: 'Property Admin',
    organizationName: 'Bayfront Resort Collection',
    propertyName: 'Bayfront Main Resort',
    reason: 'Reviewed incomplete setup checklist before conversion call.',
    startedAt: new Date(Date.now() - 1000 * 60 * 1280).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 1267).toISOString(),
    status: 'Completed',
    destructiveActionsBlocked: 2,
  },
]

export const agentDefinitions: AgentDefinition[] = [
  {
    key: 'marketing',
    name: 'Marketing Agent',
    owner: 'Marketing',
    status: 'Monitoring Ready',
    purpose: 'Monitors signup sources, conversion trends, channel performance, and campaign opportunities.',
    monitors: ['Signup source', 'Campaign conversion', 'Demo requests', 'Abandoned signups'],
    allowedActions: ['Recommend campaign ideas', 'Draft lifecycle copy', 'Flag high-performing channels'],
    blockedActions: ['Send campaigns', 'Change pricing', 'Mutate signup records'],
  },
  {
    key: 'email',
    name: 'Email Agent',
    owner: 'Client Success',
    status: 'Draft Only',
    purpose: 'Watches lifecycle triggers and prepares internal or customer-facing messaging for review.',
    monitors: ['New signup', 'Inactive trial', 'Setup incomplete', 'Trial ending', 'Module unused'],
    allowedActions: ['Draft outreach', 'Classify lifecycle trigger', 'Summarize context for reviewer'],
    blockedActions: ['Send email silently', 'Change account status', 'Update billing state'],
  },
  {
    key: 'support',
    name: 'Support Agent',
    owner: 'Support',
    status: 'Monitoring Ready',
    purpose: 'Reviews errors, support history, venue health, logs, and audit trails for likely next action.',
    monitors: ['Health checks', 'Support issues', 'Device offline signals', 'Notification delivery'],
    allowedActions: ['Recommend probable cause', 'Draft escalation notes', 'Suggest client response'],
    blockedActions: ['Resolve tickets', 'Start impersonation', 'Modify venue settings'],
  },
  {
    key: 'finance',
    name: 'Finance Agent',
    owner: 'Finance',
    status: 'Planned',
    purpose: 'Monitors MRR, ARR, failed payments, churn, discounts, refunds, and forecasts.',
    monitors: ['MRR', 'ARR', 'Failed payments', 'Discounts', 'Churn risk'],
    allowedActions: ['Draft revenue summary', 'Flag payment risk', 'Prepare finance alert'],
    blockedActions: ['Issue refunds', 'Change plan', 'Update payment method'],
  },
  {
    key: 'client_success',
    name: 'Client Success Agent',
    owner: 'Client Success',
    status: 'Monitoring Ready',
    purpose: 'Finds adoption risks, usage decline, expansion signals, incomplete setup, and testimonial candidates.',
    monitors: ['Usage decline', 'Expansion score', 'Setup completion', 'Module adoption', 'Health score'],
    allowedActions: ['Recommend outreach', 'Draft account action', 'Flag expansion candidate'],
    blockedActions: ['Enable modules', 'Change permissions', 'Send customer messages silently'],
  },
]

export const agentEvents: AgentEventRecord[] = [
  {
    id: 'agent-event-1',
    agentKey: 'client_success',
    agentName: 'Client Success Agent',
    organizationName: 'Happy Bistro Group',
    venueName: 'Happy Bistro',
    eventType: 'Recommendation Created',
    status: 'Needs Review',
    inputSummary: 'High usage, strong health score, and premium module readiness.',
    outputSummary: 'Recommend Executive Reporting upsell review after Friday service.',
    auditRequired: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'agent-event-2',
    agentKey: 'support',
    agentName: 'Support Agent',
    organizationName: 'Copper Club Hospitality',
    venueName: 'Copper Club Dining',
    eventType: 'Risk Flagged',
    status: 'Queued',
    inputSummary: 'No meaningful venue activity in 9 days with device offline history.',
    outputSummary: 'Likely adoption and QR placement issue. Assign support owner before churn risk increases.',
    auditRequired: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: 'agent-event-3',
    agentKey: 'email',
    agentName: 'Email Agent',
    organizationName: 'Bayfront Resort Collection',
    propertyName: 'Bayfront Main Resort',
    eventType: 'Lifecycle Drafted',
    status: 'Draft Only',
    inputSummary: 'Trial account is 78% configured with incomplete module routing.',
    outputSummary: 'Draft setup-completion nudge for client success review.',
    auditRequired: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
  },
  {
    id: 'agent-event-4',
    agentKey: 'finance',
    agentName: 'Finance Agent',
    organizationName: 'Copper Club Hospitality',
    eventType: 'Trigger Detected',
    status: 'Needs Review',
    inputSummary: 'Failed payment places $749 MRR at risk.',
    outputSummary: 'Prepare finance follow-up and hold expansion workflow.',
    auditRequired: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 126).toISOString(),
  },
  {
    id: 'agent-event-5',
    agentKey: 'marketing',
    agentName: 'Marketing Agent',
    organizationName: 'Marina Table Group',
    eventType: 'Summary Drafted',
    status: 'Reviewed',
    inputSummary: 'Restaurant demo request from pilot campaign.',
    outputSummary: 'Founder outreach channel is producing qualified restaurant demand.',
    auditRequired: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
  },
]

export const mockAuditEvents: AuditEvent[] = [
  {
    id: 'audit-1',
    actor: 'Team Happy Chair',
    actorRole: 'Owner',
    scope: 'Happy Bistro',
    actionKey: 'module.activation.previewed',
    actionLabel: 'Reviewed module activation readiness',
    severity: 'notice',
    createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    id: 'audit-2',
    actor: 'Support Lead',
    actorRole: 'Support Lead',
    scope: 'Copper Club Dining',
    actionKey: 'health.check.reviewed',
    actionLabel: 'Reviewed failed notification health check',
    severity: 'warning',
    createdAt: new Date(Date.now() - 1000 * 60 * 61).toISOString(),
  },
  {
    id: 'audit-3',
    actor: 'Finance',
    actorRole: 'Finance',
    scope: 'Copper Club Hospitality',
    actionKey: 'billing.payment_failed.viewed',
    actionLabel: 'Viewed failed payment account',
    severity: 'warning',
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
]
