import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type {
  AgentEventRecord,
  BillingRiskRecord,
  ModuleUsageGap,
  OrganizationSummary,
  RegistrationRecord,
  SupportIssue,
  UsageAnalyticsRow,
} from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type ClientSuccessSegment = 'At Risk' | 'Expansion' | 'Onboarding' | 'Adoption Gap' | 'Healthy'
export type ClientSuccessPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface ClientSuccessPlanStep {
  id: string
  label: string
  owner: string
  status: 'Ready' | 'Needs Review' | 'Blocked' | 'Monitoring'
}

export interface ClientSuccessPortfolioRow {
  id: string
  organization: OrganizationSummary
  segment: ClientSuccessSegment
  priority: ClientSuccessPriority
  owner: string
  healthScore: number
  usageScore: number
  expansionScore: number
  revenueAtRisk: number
  openIssues: SupportIssue[]
  billingRisks: BillingRiskRecord[]
  moduleUsageGaps: ModuleUsageGap[]
  actionRequests: AdminActionRequest[]
  agentEvents: AgentEventRecord[]
  usage?: UsageAnalyticsRow
  registration?: RegistrationRecord
  nextAction: string
  reason: string
  successPlanSteps: ClientSuccessPlanStep[]
}

export interface ClientSuccessWorkspaceModel {
  rows: ClientSuccessPortfolioRow[]
  atRiskCount: number
  expansionCount: number
  onboardingCount: number
  adoptionGapCount: number
  revenueAtRisk: number
}

export function buildClientSuccessWorkspace(
  data: PlatformAdminReadModel,
  actionRequests: AdminActionRequest[],
  agentEvents: AgentEventRecord[],
): ClientSuccessWorkspaceModel {
  const rows = data.organizations.map(org => buildPortfolioRow(org, data, actionRequests, agentEvents))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.revenueAtRisk - a.revenueAtRisk || b.expansionScore - a.expansionScore)

  return {
    rows,
    atRiskCount: rows.filter(row => row.segment === 'At Risk').length,
    expansionCount: rows.filter(row => row.segment === 'Expansion').length,
    onboardingCount: rows.filter(row => row.segment === 'Onboarding').length,
    adoptionGapCount: rows.filter(row => row.moduleUsageGaps.length > 0).length,
    revenueAtRisk: rows.reduce((sum, row) => sum + row.revenueAtRisk, 0),
  }
}

export function getClientSuccessSegmentTone(segment: ClientSuccessSegment): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (segment === 'At Risk') return 'danger'
  if (segment === 'Adoption Gap' || segment === 'Onboarding') return 'warn'
  if (segment === 'Expansion') return 'info'
  return 'ok'
}

export function getClientSuccessPriorityTone(priority: ClientSuccessPriority): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'neutral'
}

function buildPortfolioRow(
  organization: OrganizationSummary,
  data: PlatformAdminReadModel,
  actionRequests: AdminActionRequest[],
  agentEvents: AgentEventRecord[],
): ClientSuccessPortfolioRow {
  const usage = data.usageAnalytics.find(row => row.organizationId === organization.id || row.organizationName === organization.name)
  const registration = data.registrations.find(row => row.companyName === organization.name)
  const openIssues = data.supportIssues.filter(issue => issue.organizationName === organization.name && issue.status !== 'Resolved')
  const billingRisks = data.billingRisks.filter(risk => risk.organizationName === organization.name)
  const moduleUsageGaps = data.moduleUsageGaps.filter(gap => gap.organizationName === organization.name)
  const scopedActionRequests = actionRequests.filter(request => (
    request.scope.organizationId === organization.id
    || request.scope.organizationName === organization.name
    || request.scope.label === organization.name
  ))
  const scopedAgentEvents = agentEvents.filter(event => event.organizationName === organization.name && event.status !== 'Reviewed')
  const revenueAtRisk = billingRisks.reduce((sum, risk) => sum + risk.amountAtRisk, 0)
  const segment = getSegment(organization, usage, registration, openIssues, billingRisks, moduleUsageGaps)
  const priority = getPriority(segment, openIssues, billingRisks, usage)
  const owner = getOwner(segment, openIssues, billingRisks, moduleUsageGaps)
  const { nextAction, reason } = getNextAction({
    organization,
    usage,
    registration,
    openIssues,
    billingRisks,
    moduleUsageGaps,
    scopedAgentEvents,
  })

  return {
    id: organization.id,
    organization,
    segment,
    priority,
    owner,
    healthScore: organization.healthScore,
    usageScore: organization.usageScore,
    expansionScore: organization.expansionScore,
    revenueAtRisk,
    openIssues,
    billingRisks,
    moduleUsageGaps,
    actionRequests: scopedActionRequests,
    agentEvents: scopedAgentEvents,
    usage,
    registration,
    nextAction,
    reason,
    successPlanSteps: buildPlanSteps(segment, owner, {
      openIssues,
      billingRisks,
      moduleUsageGaps,
      registration,
      scopedActionRequests,
    }),
  }
}

function getSegment(
  organization: OrganizationSummary,
  usage: UsageAnalyticsRow | undefined,
  registration: RegistrationRecord | undefined,
  openIssues: SupportIssue[],
  billingRisks: BillingRiskRecord[],
  moduleUsageGaps: ModuleUsageGap[],
): ClientSuccessSegment {
  if (
    organization.accountStatus === 'At Risk'
    || organization.healthStatus === 'At Risk'
    || (usage?.inactiveDays ?? 0) >= 7
    || billingRisks.some(risk => risk.billingStatus === 'Failed Payment')
    || openIssues.some(issue => issue.severity === 'critical')
  ) return 'At Risk'

  if (organization.accountStatus === 'Trial' || registration?.status === 'Trial Started' || registration?.status === 'Setup Incomplete') return 'Onboarding'
  if (moduleUsageGaps.length) return 'Adoption Gap'
  if (organization.healthStatus === 'Expansion Candidate' || organization.expansionScore >= 80) return 'Expansion'
  return 'Healthy'
}

function getPriority(
  segment: ClientSuccessSegment,
  openIssues: SupportIssue[],
  billingRisks: BillingRiskRecord[],
  usage: UsageAnalyticsRow | undefined,
): ClientSuccessPriority {
  if (segment === 'At Risk' && (billingRisks.some(risk => risk.billingStatus === 'Failed Payment') || openIssues.some(issue => issue.severity === 'critical'))) return 'Critical'
  if (segment === 'At Risk' || segment === 'Onboarding') return 'High'
  if (segment === 'Adoption Gap' || usage?.usageTrend === 'Declining') return 'High'
  if (segment === 'Expansion') return 'Medium'
  return 'Low'
}

function getOwner(
  segment: ClientSuccessSegment,
  openIssues: SupportIssue[],
  billingRisks: BillingRiskRecord[],
  moduleUsageGaps: ModuleUsageGap[],
) {
  const failedPayment = billingRisks.find(risk => risk.billingStatus === 'Failed Payment')
  if (failedPayment) return failedPayment.owner
  const criticalIssue = openIssues.find(issue => issue.severity === 'critical')
  if (criticalIssue) return criticalIssue.owner
  if (moduleUsageGaps[0]) return moduleUsageGaps[0].owner
  if (segment === 'Onboarding' || segment === 'Expansion' || segment === 'Healthy') return 'Client Success'
  return openIssues[0]?.owner ?? 'Client Success'
}

function getNextAction(input: {
  organization: OrganizationSummary
  usage?: UsageAnalyticsRow
  registration?: RegistrationRecord
  openIssues: SupportIssue[]
  billingRisks: BillingRiskRecord[]
  moduleUsageGaps: ModuleUsageGap[]
  scopedAgentEvents: AgentEventRecord[]
}) {
  const billingRisk = input.billingRisks.find(risk => risk.billingStatus === 'Failed Payment') ?? input.billingRisks[0]
  if (billingRisk) {
    return {
      nextAction: billingRisk.nextAction,
      reason: `${billingRisk.billingStatus} with ${formatCurrency(billingRisk.amountAtRisk)} at risk.`,
    }
  }

  const criticalIssue = input.openIssues.find(issue => issue.severity === 'critical') ?? input.openIssues[0]
  if (criticalIssue) {
    return {
      nextAction: criticalIssue.recommendedAction,
      reason: `${criticalIssue.issueType} at ${criticalIssue.venueName}: ${criticalIssue.relatedSignal}`,
    }
  }

  const usageGap = input.moduleUsageGaps[0]
  if (usageGap) {
    return {
      nextAction: usageGap.recommendedAction,
      reason: `${usageGap.moduleName} has ${usageGap.usageLast7Days} uses in the last 7 days.`,
    }
  }

  if (input.registration?.status === 'Trial Started' || input.registration?.status === 'Setup Incomplete') {
    return {
      nextAction: 'Complete onboarding checklist and confirm first success milestone.',
      reason: `${input.registration.status} with ${input.registration.setupCompletion}% setup completion.`,
    }
  }

  const agentEvent = input.scopedAgentEvents.find(event => event.status === 'Needs Review' || event.status === 'Queued')
  if (agentEvent) {
    return {
      nextAction: agentEvent.outputSummary,
      reason: `${agentEvent.agentName} created a ${agentEvent.eventType.toLowerCase()} finding.`,
    }
  }

  if (input.organization.expansionScore >= 80) {
    return {
      nextAction: 'Prepare expansion review and identify the strongest module fit.',
      reason: `${input.organization.expansionScore} expansion score with ${input.usage?.usageTrend.toLowerCase() ?? 'active'} usage.`,
    }
  }

  return {
    nextAction: 'Keep account in steady-state monitoring.',
    reason: 'No immediate success risk detected.',
  }
}

function buildPlanSteps(
  segment: ClientSuccessSegment,
  owner: string,
  input: {
    openIssues: SupportIssue[]
    billingRisks: BillingRiskRecord[]
    moduleUsageGaps: ModuleUsageGap[]
    registration?: RegistrationRecord
    scopedActionRequests: AdminActionRequest[]
  },
): ClientSuccessPlanStep[] {
  const steps: ClientSuccessPlanStep[] = []

  if (input.billingRisks.length) {
    steps.push({
      id: 'billing-risk',
      label: 'Resolve billing or commercial risk before expansion.',
      owner: input.billingRisks[0].owner,
      status: input.billingRisks.some(risk => risk.billingStatus === 'Failed Payment') ? 'Blocked' : 'Needs Review',
    })
  }

  if (input.openIssues.length) {
    steps.push({
      id: 'support-risk',
      label: 'Close open support issues and confirm user impact.',
      owner: input.openIssues[0].owner,
      status: input.openIssues.some(issue => issue.severity === 'critical') ? 'Blocked' : 'Needs Review',
    })
  }

  if (input.moduleUsageGaps.length) {
    steps.push({
      id: 'adoption-gap',
      label: 'Run module adoption follow-up and verify staff workflow.',
      owner: input.moduleUsageGaps[0].owner,
      status: 'Needs Review',
    })
  }

  if (input.registration?.status === 'Trial Started' || input.registration?.status === 'Setup Incomplete') {
    steps.push({
      id: 'onboarding',
      label: 'Finish onboarding checklist and schedule first value review.',
      owner,
      status: input.registration.setupCompletion < 80 ? 'Needs Review' : 'Ready',
    })
  }

  if (segment === 'Expansion') {
    steps.push({
      id: 'expansion',
      label: 'Prepare expansion narrative and module recommendation.',
      owner,
      status: 'Ready',
    })
  }

  if (input.scopedActionRequests.length) {
    steps.push({
      id: 'action-request',
      label: 'Review open Admin Action Requests before customer follow-up.',
      owner: input.scopedActionRequests[0].requestedBy.role,
      status: input.scopedActionRequests.some(request => request.status === 'Blocked' || request.status === 'Failed') ? 'Blocked' : 'Monitoring',
    })
  }

  if (!steps.length) {
    steps.push({
      id: 'monitoring',
      label: 'Monitor health, usage, and next account milestone.',
      owner,
      status: 'Monitoring',
    })
  }

  return steps.slice(0, 5)
}

function priorityRank(priority: ClientSuccessPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
