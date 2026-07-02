import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { AuditEvent } from '../audit/auditLog'
import type {
  ActivityEvent,
  AgentEventRecord,
  BillingRiskRecord,
  ModuleActivationSnapshot,
  ModuleUsageGap,
  OrganizationSummary,
  PlatformHealthSignal,
  PropertySummary,
  RevenueMetricRecord,
  SupportIssue,
  SupportNote,
  UsageAnalyticsRow,
  VenueSummary,
} from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type Client360NodeType = 'Organization' | 'Property' | 'Venue' | 'Module' | 'Support' | 'Billing' | 'Action' | 'Agent'
export type Client360Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

export interface Client360GraphNode {
  id: string
  type: Client360NodeType
  label: string
  detail: string
  tone: Client360Tone
}

export interface Client360GraphEdge {
  id: string
  from: string
  to: string
  label: string
}

export interface Client360WorkItem {
  id: string
  type: 'Support' | 'Billing' | 'Action Request' | 'Agent' | 'Usage Gap' | 'Health'
  title: string
  owner: string
  status: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  priorityScore: number
  source: string
  createdAt: string
  nextAction: string
}

export interface Client360NextAction {
  id: string
  title: string
  owner: string
  reason: string
  tone: Client360Tone
}

export interface Client360Profile {
  organization: OrganizationSummary
  properties: PropertySummary[]
  venues: VenueSummary[]
  modules: ModuleActivationSnapshot[]
  usage?: UsageAnalyticsRow
  revenueMetrics: RevenueMetricRecord[]
  billingRisks: BillingRiskRecord[]
  supportIssues: SupportIssue[]
  moduleUsageGaps: ModuleUsageGap[]
  platformHealthSignals: PlatformHealthSignal[]
  supportNotes: SupportNote[]
  activityEvents: ActivityEvent[]
  actionRequests: AdminActionRequest[]
  agentEvents: AgentEventRecord[]
  auditEvents: AuditEvent[]
  workItems: Client360WorkItem[]
  nextActions: Client360NextAction[]
  graph: {
    nodes: Client360GraphNode[]
    edges: Client360GraphEdge[]
  }
}

const openRequestStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildClient360Profile(
  data: PlatformAdminReadModel,
  organizationId: string,
  actionRequests: AdminActionRequest[] = data.adminActionRequests,
  auditEvents: AuditEvent[] = data.auditEvents,
  agentEvents: AgentEventRecord[] = data.agentEvents,
): Client360Profile | undefined {
  const organization = data.organizations.find(org => org.id === organizationId)
  if (!organization) return undefined

  const properties = data.properties.filter(property => property.organizationId === organization.id)
  const venues = data.venues.filter(venue => venue.organizationId === organization.id)
  const propertyIds = new Set(properties.map(property => property.id))
  const propertyNames = new Set(properties.map(property => property.name))
  const venueIds = new Set(venues.map(venue => venue.id))
  const venueNames = new Set(venues.map(venue => venue.name))
  const scopeLabels = new Set([organization.name, ...properties.map(property => property.name), ...venues.map(venue => venue.name)])

  const modules = data.moduleActivations.filter(activation => (
    activation.scopeId === organization.id
    || propertyIds.has(activation.scopeId)
    || venueIds.has(activation.scopeId)
  ))
  const usage = data.usageAnalytics.find(row => row.organizationId === organization.id || row.organizationName === organization.name)
  const revenueMetrics = data.revenueMetrics.filter(row => row.organizationName === organization.name)
  const billingRisks = data.billingRisks.filter(row => row.organizationName === organization.name)
  const supportIssues = data.supportIssues.filter(issue => issue.organizationName === organization.name)
  const moduleUsageGaps = data.moduleUsageGaps.filter(gap => gap.organizationName === organization.name)
  const platformHealthSignals = data.platformHealthSignals.filter(signal => (
    signal.status !== 'Passing'
    && supportIssues.some(issue => issue.relatedSignal.toLowerCase().includes(signal.label.toLowerCase().split(' ')[0] ?? ''))
  ))
  const supportNotes = data.supportNotes.filter(note => (
    note.scopeId === organization.id
    || propertyIds.has(note.scopeId)
    || venueIds.has(note.scopeId)
  ))
  const activityEvents = data.activityEvents.filter(event => (
    event.scopeId === organization.id
    || propertyIds.has(event.scopeId)
    || venueIds.has(event.scopeId)
  ))
  const scopedActionRequests = actionRequests.filter(request => (
    request.scope.organizationId === organization.id
    || request.scope.organizationName === organization.name
    || Boolean(request.scope.propertyId && propertyIds.has(request.scope.propertyId))
    || Boolean(request.scope.propertyName && propertyNames.has(request.scope.propertyName))
    || Boolean(request.scope.venueId && venueIds.has(request.scope.venueId))
    || Boolean(request.scope.venueName && venueNames.has(request.scope.venueName))
    || scopeLabels.has(request.scope.label)
  ))
  const scopedAgentEvents = agentEvents.filter(event => (
    event.organizationName === organization.name
    || Boolean(event.propertyName && propertyNames.has(event.propertyName))
    || Boolean(event.venueName && venueNames.has(event.venueName))
  ))
  const scopedAuditEvents = auditEvents.filter(event => (
    scopeLabels.has(event.scope)
    || event.scope.includes(organization.name)
    || [...venueNames].some(venueName => event.scope.includes(venueName))
  ))

  const workItems = buildWorkItems({
    supportIssues,
    billingRisks,
    moduleUsageGaps,
    platformHealthSignals,
    actionRequests: scopedActionRequests,
    agentEvents: scopedAgentEvents,
  })
  const graph = buildEntityGraph({
    organization,
    properties,
    venues,
    modules,
    supportIssues,
    billingRisks,
    actionRequests: scopedActionRequests,
    agentEvents: scopedAgentEvents,
  })
  const nextActions = buildNextActions({
    organization,
    usage,
    supportIssues,
    billingRisks,
    moduleUsageGaps,
    actionRequests: scopedActionRequests,
    agentEvents: scopedAgentEvents,
  })

  return {
    organization,
    properties,
    venues,
    modules,
    usage,
    revenueMetrics,
    billingRisks,
    supportIssues,
    moduleUsageGaps,
    platformHealthSignals,
    supportNotes,
    activityEvents,
    actionRequests: scopedActionRequests,
    agentEvents: scopedAgentEvents,
    auditEvents: scopedAuditEvents,
    workItems,
    nextActions,
    graph,
  }
}

function buildWorkItems(input: {
  supportIssues: SupportIssue[]
  billingRisks: BillingRiskRecord[]
  moduleUsageGaps: ModuleUsageGap[]
  platformHealthSignals: PlatformHealthSignal[]
  actionRequests: AdminActionRequest[]
  agentEvents: AgentEventRecord[]
}): Client360WorkItem[] {
  return [
    ...input.supportIssues
      .filter(issue => issue.status !== 'Resolved')
      .map(issue => ({
        id: `support-${issue.id}`,
        type: 'Support' as const,
        title: `${issue.issueType} at ${issue.venueName}`,
        owner: issue.owner,
        status: issue.status,
        priority: priorityFromScore(severityScore(issue.severity)),
        priorityScore: severityScore(issue.severity),
        source: 'Support Signals',
        createdAt: issue.detectedAt,
        nextAction: issue.recommendedAction,
      })),
    ...input.billingRisks.map(risk => {
      const score = risk.billingStatus === 'Failed Payment' ? 94 : risk.billingStatus === 'Past Due' ? 84 : 68
      return {
        id: `billing-${risk.id}`,
        type: 'Billing' as const,
        title: risk.billingStatus,
        owner: risk.owner,
        status: risk.billingStatus,
        priority: priorityFromScore(score),
        priorityScore: score,
        source: 'Finance Signals',
        createdAt: risk.lastPaymentAttempt,
        nextAction: risk.nextAction,
      }
    }),
    ...input.moduleUsageGaps.map(gap => {
      const score = gap.usageLast7Days === 0 ? 82 : 66
      return {
        id: `usage-gap-${gap.id}`,
        type: 'Usage Gap' as const,
        title: `${gap.moduleName} adoption gap`,
        owner: gap.owner,
        status: `${gap.usageLast7Days} uses / 7d`,
        priority: priorityFromScore(score),
        priorityScore: score,
        source: 'Usage Analytics',
        createdAt: gap.enabledAt,
        nextAction: gap.recommendedAction,
      }
    }),
    ...input.platformHealthSignals.map(signal => {
      const score = severityScore(signal.severity)
      return {
        id: `health-${signal.id}`,
        type: 'Health' as const,
        title: signal.label,
        owner: signal.severity === 'critical' ? 'Engineering' : 'Support',
        status: signal.status,
        priority: priorityFromScore(score),
        priorityScore: score,
        source: 'System Health',
        createdAt: signal.checkedAt,
        nextAction: signal.recommendedAction,
      }
    }),
    ...input.actionRequests
      .filter(request => openRequestStatuses.has(request.status))
      .map(request => {
        const score = request.status === 'Blocked' || request.status === 'Failed' ? 88 : request.status === 'Approved' || request.status === 'Running' ? 78 : 62
        return {
          id: `action-${request.id}`,
          type: 'Action Request' as const,
          title: request.title,
          owner: request.requestedBy.role,
          status: request.status,
          priority: priorityFromScore(score),
          priorityScore: score,
          source: 'Admin Action Requests',
          createdAt: request.createdAt,
          nextAction: request.reason,
        }
      }),
    ...input.agentEvents
      .filter(event => event.status !== 'Reviewed')
      .map(event => {
        const score = event.status === 'Needs Review' ? 76 : event.status === 'Queued' ? 64 : 48
        return {
          id: `agent-${event.id}`,
          type: 'Agent' as const,
          title: `${event.agentName}: ${event.eventType}`,
          owner: 'Agent Review',
          status: event.status,
          priority: priorityFromScore(score),
          priorityScore: score,
          source: 'Agent Foundation',
          createdAt: event.createdAt,
          nextAction: event.outputSummary,
        }
      }),
  ].sort((a, b) => {
    const scoreDiff = b.priorityScore - a.priorityScore
    if (scoreDiff !== 0) return scoreDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function buildEntityGraph(input: {
  organization: OrganizationSummary
  properties: PropertySummary[]
  venues: VenueSummary[]
  modules: ModuleActivationSnapshot[]
  supportIssues: SupportIssue[]
  billingRisks: BillingRiskRecord[]
  actionRequests: AdminActionRequest[]
  agentEvents: AgentEventRecord[]
}) {
  const nodes: Client360GraphNode[] = [{
    id: `org-${input.organization.id}`,
    type: 'Organization',
    label: input.organization.name,
    detail: `${input.organization.plan} / ${input.organization.accountStatus}`,
    tone: input.organization.accountStatus === 'At Risk' ? 'danger' : input.organization.accountStatus === 'Trial' ? 'info' : 'ok',
  }]
  const edges: Client360GraphEdge[] = []

  input.properties.forEach(property => {
    const propertyNodeId = `property-${property.id}`
    nodes.push({
      id: propertyNodeId,
      type: 'Property',
      label: property.name,
      detail: `${property.status} / ${property.venues} venues`,
      tone: property.status === 'Needs Attention' ? 'danger' : property.status === 'Setup' ? 'warn' : 'ok',
    })
    edges.push({ id: `edge-org-${property.id}`, from: `org-${input.organization.id}`, to: propertyNodeId, label: 'owns' })
  })

  input.venues.forEach(venue => {
    const venueNodeId = `venue-${venue.id}`
    const property = input.properties.find(item => item.name === venue.propertyName)
    nodes.push({
      id: venueNodeId,
      type: 'Venue',
      label: venue.name,
      detail: `${venue.status} / ${venue.notificationHealth}`,
      tone: venue.status === 'Needs Attention' || venue.notificationHealth === 'Failing' ? 'danger' : venue.notificationHealth === 'Warning' ? 'warn' : 'ok',
    })
    edges.push({
      id: `edge-${property?.id ?? input.organization.id}-${venue.id}`,
      from: property ? `property-${property.id}` : `org-${input.organization.id}`,
      to: venueNodeId,
      label: 'contains',
    })
  })

  input.modules.forEach(module => {
    const moduleNodeId = `module-${module.id}`
    nodes.push({
      id: moduleNodeId,
      type: 'Module',
      label: module.moduleName,
      detail: `${module.activationLevel} / ${module.usageLast7Days} uses`,
      tone: module.enabled ? 'info' : 'neutral',
    })
    edges.push({
      id: `edge-module-${module.id}`,
      from: module.scopeType === 'venue' ? `venue-${module.scopeId}` : module.scopeType === 'property' ? `property-${module.scopeId}` : `org-${input.organization.id}`,
      to: moduleNodeId,
      label: 'enabled',
    })
  })

  input.supportIssues.filter(issue => issue.status !== 'Resolved').forEach(issue => {
    const issueNodeId = `support-${issue.id}`
    const venue = input.venues.find(item => item.name === issue.venueName)
    nodes.push({
      id: issueNodeId,
      type: 'Support',
      label: issue.issueType,
      detail: `${issue.severity} / ${issue.status}`,
      tone: issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warn' : 'info',
    })
    edges.push({
      id: `edge-support-${issue.id}`,
      from: venue ? `venue-${venue.id}` : `org-${input.organization.id}`,
      to: issueNodeId,
      label: 'has issue',
    })
  })

  input.billingRisks.forEach(risk => {
    const riskNodeId = `billing-${risk.id}`
    nodes.push({
      id: riskNodeId,
      type: 'Billing',
      label: risk.billingStatus,
      detail: `${formatCurrency(risk.amountAtRisk)} at risk`,
      tone: risk.billingStatus === 'Failed Payment' ? 'danger' : 'warn',
    })
    edges.push({ id: `edge-billing-${risk.id}`, from: `org-${input.organization.id}`, to: riskNodeId, label: 'billing risk' })
  })

  input.actionRequests.filter(request => openRequestStatuses.has(request.status)).forEach(request => {
    const actionNodeId = `action-${request.id}`
    nodes.push({
      id: actionNodeId,
      type: 'Action',
      label: request.title,
      detail: request.status,
      tone: request.status === 'Blocked' || request.status === 'Failed' ? 'danger' : request.status === 'Approved' || request.status === 'Running' ? 'info' : 'warn',
    })
    edges.push({ id: `edge-action-${request.id}`, from: `org-${input.organization.id}`, to: actionNodeId, label: 'queued work' })
  })

  input.agentEvents.filter(event => event.status !== 'Reviewed').slice(0, 4).forEach(event => {
    const agentNodeId = `agent-${event.id}`
    nodes.push({
      id: agentNodeId,
      type: 'Agent',
      label: event.eventType,
      detail: event.agentName,
      tone: event.status === 'Needs Review' ? 'warn' : 'neutral',
    })
    edges.push({ id: `edge-agent-${event.id}`, from: `org-${input.organization.id}`, to: agentNodeId, label: 'finding' })
  })

  return { nodes, edges }
}

function buildNextActions(input: {
  organization: OrganizationSummary
  usage?: UsageAnalyticsRow
  supportIssues: SupportIssue[]
  billingRisks: BillingRiskRecord[]
  moduleUsageGaps: ModuleUsageGap[]
  actionRequests: AdminActionRequest[]
  agentEvents: AgentEventRecord[]
}): Client360NextAction[] {
  const actions: Client360NextAction[] = []
  const failedPayment = input.billingRisks.find(risk => risk.billingStatus === 'Failed Payment')
  if (failedPayment) {
    actions.push({
      id: `billing-${failedPayment.id}`,
      title: 'Resolve billing hold',
      owner: failedPayment.owner,
      reason: failedPayment.nextAction,
      tone: 'danger',
    })
  }

  const criticalIssue = input.supportIssues.find(issue => issue.severity === 'critical' && issue.status !== 'Resolved')
  if (criticalIssue) {
    actions.push({
      id: `support-${criticalIssue.id}`,
      title: 'Assign recovery owner',
      owner: criticalIssue.owner,
      reason: criticalIssue.recommendedAction,
      tone: 'danger',
    })
  }

  const blockedAction = input.actionRequests.find(request => request.status === 'Blocked' || request.status === 'Failed')
  if (blockedAction) {
    actions.push({
      id: `action-${blockedAction.id}`,
      title: 'Unblock action request',
      owner: blockedAction.requestedBy.role,
      reason: blockedAction.reason,
      tone: 'warn',
    })
  }

  const usageGap = input.moduleUsageGaps[0]
  if (usageGap) {
    actions.push({
      id: `usage-${usageGap.id}`,
      title: 'Close adoption gap',
      owner: usageGap.owner,
      reason: usageGap.recommendedAction,
      tone: 'warn',
    })
  }

  const agentFinding = input.agentEvents.find(event => event.status === 'Needs Review' || event.status === 'Queued')
  if (agentFinding) {
    actions.push({
      id: `agent-${agentFinding.id}`,
      title: 'Review agent finding',
      owner: 'Agent Review',
      reason: agentFinding.outputSummary,
      tone: 'info',
    })
  }

  if (input.organization.expansionScore >= 80 && !failedPayment && input.organization.healthStatus !== 'At Risk') {
    actions.push({
      id: `expansion-${input.organization.id}`,
      title: 'Prepare expansion review',
      owner: 'Client Success',
      reason: `${input.organization.name} has ${input.organization.expansionScore} expansion score and ${input.usage?.usageTrend.toLowerCase() ?? 'active'} usage.`,
      tone: 'ok',
    })
  }

  if (!actions.length) {
    actions.push({
      id: `monitor-${input.organization.id}`,
      title: 'Monitor account health',
      owner: 'Client Success',
      reason: 'No immediate blocking signal is attached to this account.',
      tone: 'neutral',
    })
  }

  return actions.slice(0, 5)
}

function severityScore(severity: string) {
  if (severity === 'critical') return 96
  if (severity === 'warning') return 82
  if (severity === 'notice') return 58
  return 34
}

function priorityFromScore(score: number): Client360WorkItem['priority'] {
  if (score >= 90) return 'Critical'
  if (score >= 75) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
