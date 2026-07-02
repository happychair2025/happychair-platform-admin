import type {
  AgentEventRecord,
  BillingRiskRecord,
  ModuleUsageGap,
  OrganizationSummary,
  RegistrationRecord,
  UsageAnalyticsRow,
} from '../mock-data/mockPlatform'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type LifecycleTrigger =
  | 'Demo Follow-Up'
  | 'Trial Conversion'
  | 'Setup Rescue'
  | 'Usage Rescue'
  | 'Module Adoption'
  | 'Billing Save'
  | 'Expansion Motion'
  | 'Agent Handoff'

export type LifecyclePriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type LifecycleOwner = 'Marketing' | 'Sales' | 'Client Success' | 'Support' | 'Finance' | 'Owner'
export type LifecycleStatus = 'Ready For Review' | 'Needs Human Approval' | 'Monitoring' | 'Blocked'

export interface LifecycleCommandRow {
  id: string
  organizationName: string
  contactEmail?: string
  trigger: LifecycleTrigger
  priority: LifecyclePriority
  owner: LifecycleOwner
  status: LifecycleStatus
  title: string
  recommendedAction: string
  reason: string
  revenueImpact: number
  confidence: number
  humanApprovalRequired: boolean
  auditRequired: boolean
  source: string
  registration?: RegistrationRecord
  organization?: OrganizationSummary
  usage?: UsageAnalyticsRow
  moduleGap?: ModuleUsageGap
  billingRisk?: BillingRiskRecord
  agentEvent?: AgentEventRecord
}

export interface LifecycleCommandModel {
  rows: LifecycleCommandRow[]
  criticalCount: number
  approvalRequiredCount: number
  pipelineMrr: number
  agentHandoffCount: number
}

export function buildLifecycleCommand(data: PlatformAdminReadModel, agentEvents: AgentEventRecord[]): LifecycleCommandModel {
  const organizationByName = new Map(data.organizations.map(org => [org.name, org]))
  const registrationByCompany = new Map(data.registrations.map(registration => [registration.companyName, registration]))
  const rows: LifecycleCommandRow[] = []

  data.registrations.forEach(registration => {
    const organization = organizationByName.get(registration.companyName)
    if (registration.status === 'Demo Requested') {
      rows.push(createRegistrationRow(registration, organization, 'Demo Follow-Up', 'Sales', 'Medium', 'Same-day demo qualification and founder follow-up.', 72))
    }
    if (registration.status === 'Trial Started') {
      rows.push(createRegistrationRow(registration, organization, 'Trial Conversion', 'Client Success', registration.setupCompletion >= 70 ? 'High' : 'Medium', 'Confirm first-value milestone and conversion path.', 84))
    }
    if (registration.status === 'Setup Incomplete') {
      rows.push(createRegistrationRow(registration, organization, 'Setup Rescue', 'Client Success', 'High', 'Schedule setup rescue and clear implementation blockers.', 78))
    }
    if (registration.status === 'Abandoned') {
      rows.push(createRegistrationRow(registration, organization, 'Usage Rescue', 'Marketing', 'Low', 'Add to recovery sequence and review campaign/source fit.', 48))
    }
  })

  data.usageAnalytics.forEach(usage => {
    const organization = organizationByName.get(usage.organizationName)
    const registration = registrationByCompany.get(usage.organizationName)
    if (usage.inactiveDays >= 7 || usage.usageTrend === 'Declining') {
      rows.push({
        id: `usage-${usage.id}`,
        organizationName: usage.organizationName,
        contactEmail: registration?.email,
        trigger: 'Usage Rescue',
        priority: usage.inactiveDays >= 7 ? 'Critical' : 'High',
        owner: 'Client Success',
        status: usage.inactiveDays >= 7 ? 'Needs Human Approval' : 'Ready For Review',
        title: `${usage.organizationName} usage rescue`,
        recommendedAction: usage.inactiveDays >= 7
          ? 'Escalate account rescue plan and verify staff adoption blockers.'
          : 'Review usage decline and schedule adoption check-in.',
        reason: `${usage.usageTrend} usage with ${usage.inactiveDays} inactive days and ${usage.staffAdoption}% staff adoption.`,
        revenueImpact: organization?.mrr ?? registration?.projectedMrr ?? 0,
        confidence: usage.inactiveDays >= 7 ? 91 : 76,
        humanApprovalRequired: true,
        auditRequired: true,
        source: 'Usage Analytics',
        organization,
        usage,
        registration,
      })
    }
  })

  data.moduleUsageGaps.forEach(gap => {
    const organization = organizationByName.get(gap.organizationName)
    const registration = registrationByCompany.get(gap.organizationName)
    rows.push({
      id: `module-gap-${gap.id}`,
      organizationName: gap.organizationName,
      contactEmail: registration?.email,
      trigger: 'Module Adoption',
      priority: gap.usageLast7Days === 0 ? 'High' : 'Medium',
      owner: gap.owner,
      status: 'Ready For Review',
      title: `${gap.moduleName} adoption gap`,
      recommendedAction: gap.recommendedAction,
      reason: `${gap.moduleName} has ${gap.usageLast7Days} uses in the last 7 days.`,
      revenueImpact: organization?.mrr ?? registration?.projectedMrr ?? 0,
      confidence: gap.usageLast7Days === 0 ? 88 : 69,
      humanApprovalRequired: true,
      auditRequired: true,
      source: 'Module Usage Gaps',
      organization,
      registration,
      moduleGap: gap,
    })
  })

  data.billingRisks.forEach(risk => {
    const organization = organizationByName.get(risk.organizationName)
    const registration = registrationByCompany.get(risk.organizationName)
    rows.push({
      id: `billing-${risk.id}`,
      organizationName: risk.organizationName,
      contactEmail: registration?.email,
      trigger: 'Billing Save',
      priority: risk.billingStatus === 'Failed Payment' ? 'Critical' : 'High',
      owner: risk.owner,
      status: risk.billingStatus === 'Failed Payment' ? 'Blocked' : 'Needs Human Approval',
      title: `${risk.billingStatus} lifecycle save`,
      recommendedAction: risk.nextAction,
      reason: `${risk.billingStatus} with ${risk.amountAtRisk} at risk.`,
      revenueImpact: risk.amountAtRisk,
      confidence: risk.billingStatus === 'Failed Payment' ? 94 : 81,
      humanApprovalRequired: true,
      auditRequired: true,
      source: 'Billing Risks',
      organization,
      registration,
      billingRisk: risk,
    })
  })

  data.organizations
    .filter(organization => organization.expansionScore >= 80)
    .forEach(organization => {
      const registration = registrationByCompany.get(organization.name)
      rows.push({
        id: `expansion-${organization.id}`,
        organizationName: organization.name,
        contactEmail: registration?.email,
        trigger: 'Expansion Motion',
        priority: organization.expansionScore >= 90 ? 'High' : 'Medium',
        owner: 'Client Success',
        status: 'Ready For Review',
        title: `${organization.name} expansion motion`,
        recommendedAction: 'Prepare expansion review and strongest module recommendation.',
        reason: `${organization.expansionScore} expansion score with ${organization.healthStatus.toLowerCase()} account health.`,
        revenueImpact: Math.round(organization.mrr * 0.25),
        confidence: Math.min(95, organization.expansionScore),
        humanApprovalRequired: true,
        auditRequired: true,
        source: 'Client Health',
        organization,
        registration,
      })
    })

  agentEvents
    .filter(event => event.status === 'Needs Review' || event.status === 'Queued' || event.status === 'Draft Only')
    .forEach(event => {
      const organization = event.organizationName ? organizationByName.get(event.organizationName) : undefined
      const registration = event.organizationName ? registrationByCompany.get(event.organizationName) : undefined
      rows.push({
        id: `agent-${event.id}`,
        organizationName: event.organizationName ?? event.agentName,
        contactEmail: registration?.email,
        trigger: 'Agent Handoff',
        priority: event.status === 'Needs Review' ? 'High' : 'Medium',
        owner: ownerFromAgent(event.agentKey),
        status: event.auditRequired ? 'Needs Human Approval' : 'Ready For Review',
        title: event.outputSummary,
        recommendedAction: 'Review agent recommendation, approve the next action, or keep it as a draft.',
        reason: `${event.agentName} ${event.eventType.toLowerCase()}: ${event.inputSummary}`,
        revenueImpact: organization?.mrr ?? registration?.projectedMrr ?? 0,
        confidence: event.status === 'Needs Review' ? 82 : 64,
        humanApprovalRequired: event.auditRequired,
        auditRequired: event.auditRequired,
        source: 'Agent Events',
        organization,
        registration,
        agentEvent: event,
      })
    })

  const sortedRows = rows.sort((a, b) =>
    priorityRank(b.priority) - priorityRank(a.priority)
    || Number(b.humanApprovalRequired) - Number(a.humanApprovalRequired)
    || b.revenueImpact - a.revenueImpact
    || b.confidence - a.confidence,
  )

  return {
    rows: sortedRows,
    criticalCount: sortedRows.filter(row => row.priority === 'Critical').length,
    approvalRequiredCount: sortedRows.filter(row => row.humanApprovalRequired).length,
    pipelineMrr: sortedRows.reduce((sum, row) => sum + row.revenueImpact, 0),
    agentHandoffCount: sortedRows.filter(row => row.trigger === 'Agent Handoff').length,
  }
}

export function getLifecyclePriorityTone(priority: LifecyclePriority): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'neutral'
}

export function getLifecycleStatusTone(status: LifecycleStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Human Approval') return 'warn'
  if (status === 'Ready For Review') return 'ok'
  return 'neutral'
}

export function getLifecycleTriggerTone(trigger: LifecycleTrigger): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (trigger === 'Billing Save' || trigger === 'Usage Rescue') return 'danger'
  if (trigger === 'Setup Rescue' || trigger === 'Module Adoption') return 'warn'
  if (trigger === 'Expansion Motion' || trigger === 'Trial Conversion') return 'ok'
  return 'info'
}

function createRegistrationRow(
  registration: RegistrationRecord,
  organization: OrganizationSummary | undefined,
  trigger: LifecycleTrigger,
  owner: LifecycleOwner,
  priority: LifecyclePriority,
  recommendedAction: string,
  confidence: number,
): LifecycleCommandRow {
  return {
    id: `registration-${registration.id}-${trigger.toLowerCase().replace(/\s+/g, '-')}`,
    organizationName: registration.companyName,
    contactEmail: registration.email,
    trigger,
    priority,
    owner,
    status: trigger === 'Setup Rescue' ? 'Needs Human Approval' : 'Ready For Review',
    title: `${registration.companyName} ${trigger.toLowerCase()}`,
    recommendedAction,
    reason: `${registration.status} from ${registration.source} / ${registration.campaign} with ${registration.setupCompletion}% setup completion.`,
    revenueImpact: registration.projectedMrr,
    confidence,
    humanApprovalRequired: trigger !== 'Demo Follow-Up',
    auditRequired: true,
    source: 'Registrations',
    registration,
    organization,
  }
}

function ownerFromAgent(agentKey: AgentEventRecord['agentKey']): LifecycleOwner {
  if (agentKey === 'finance') return 'Finance'
  if (agentKey === 'support') return 'Support'
  if (agentKey === 'marketing' || agentKey === 'website_content' || agentKey === 'social_media' || agentKey === 'seo_geo' || agentKey === 'sem' || agentKey === 'email') return 'Marketing'
  if (agentKey === 'sales_sdr') return 'Sales'
  if (agentKey === 'client_success') return 'Client Success'
  return 'Owner'
}

function priorityRank(priority: LifecyclePriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}
