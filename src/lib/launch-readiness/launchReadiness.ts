import { buildActionRequestGovernance } from '../admin-actions/actionRequestGovernance'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import { buildDataQualityModel } from '../data-quality/dataQuality'
import type {
  DataStatus,
  PlatformDataSourceKind,
  PlatformReadViewDiagnostic,
} from '../platform-data/PlatformDataContext'
import type { PlatformAdminReadModel } from '../supabase/readContracts'

export type LaunchGateArea =
  | 'Data'
  | 'Security'
  | 'Operations'
  | 'Support'
  | 'Finance'
  | 'Agents'
  | 'Integrations'

export type LaunchGateStatus = 'Ready' | 'Watch' | 'Blocked'
export type LaunchGateSeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface LaunchGate {
  id: string
  area: LaunchGateArea
  title: string
  status: LaunchGateStatus
  severity: LaunchGateSeverity
  owner: 'Owner' | 'Engineering' | 'Support' | 'Client Success' | 'Finance' | 'Marketing'
  scoreImpact: number
  evidence: string
  nextStep: string
  linkedSurface: string
}

export interface LaunchReadinessModel {
  score: number
  status: LaunchGateStatus
  summary: string
  gates: LaunchGate[]
  readyCount: number
  watchCount: number
  blockedCount: number
  criticalCount: number
  highCount: number
  reviewCount: number
  generatedAt: string
}

interface BuildLaunchReadinessModelInput {
  data: PlatformAdminReadModel
  dataSourceKind: PlatformDataSourceKind
  status: DataStatus
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  actionRequests: AdminActionRequest[]
}

export function buildLaunchReadinessModel({
  data,
  dataSourceKind,
  status,
  readViewDiagnostics,
  actionRequests,
}: BuildLaunchReadinessModelInput): LaunchReadinessModel {
  const generatedAt = new Date().toISOString()
  const dataQuality = buildDataQualityModel(data, readViewDiagnostics)
  const governance = buildActionRequestGovernance(actionRequests, data)
  const fallbackViews = readViewDiagnostics.filter(view => view.status === 'fallback')
  const readyViews = readViewDiagnostics.filter(view => view.status === 'ready')
  const blockedQualityChecks = dataQuality.checks.filter(check => check.status === 'Blocked')
  const reviewQualityChecks = dataQuality.checks.filter(check => check.status === 'Needs Review' || check.status === 'Monitoring')
  const governanceBlocked = governance.filter(record => record.readiness === 'Blocked')
  const governanceNeedsApproval = governance.filter(record => record.readiness === 'Needs Approval')
  const openSupportIssues = data.supportIssues.filter(issue => issue.status !== 'Resolved')
  const criticalSupportIssues = openSupportIssues.filter(issue => issue.severity === 'critical')
  const failingHealthSignals = data.platformHealthSignals.filter(signal => signal.status === 'Failing')
  const warningHealthSignals = data.platformHealthSignals.filter(signal => signal.status === 'Warning')
  const highRiskProductionFlags = data.featureFlags.filter(flag => flag.enabled && flag.environment === 'Production' && flag.blastRadius === 'High')
  const activeAuditEvents = data.auditEvents.length
  const reviewAgentEvents = data.agentEvents.filter(event => event.status === 'Needs Review' || event.status === 'Queued')
  const draftAgents = data.agentDefinitions.filter(agent => agent.status !== 'Monitoring Ready')
  const billingRisks = data.billingRisks.filter(risk => risk.billingStatus === 'Failed Payment' || risk.billingStatus === 'Past Due')
  const providerPendingRevenue = data.revenueMetrics.filter(metric => metric.source === 'stripe_pending' || metric.source === 'quickbooks_pending')

  const gates: LaunchGate[] = [
    createGate({
      id: 'read-view-connection',
      area: 'Data',
      title: 'Read-only data connection',
      status: fallbackViews.length
        ? readyViews.length ? 'Watch' : 'Blocked'
        : dataSourceKind === 'mock' || status === 'mock' ? 'Watch' : 'Ready',
      severity: fallbackViews.length ? 'Critical' : dataSourceKind === 'mock' ? 'High' : 'Low',
      owner: 'Engineering',
      scoreImpact: fallbackViews.length ? 18 : dataSourceKind === 'mock' ? 10 : 0,
      evidence: fallbackViews.length
        ? `${fallbackViews.length} read views are using mock fallback; ${readyViews.length} are live.`
        : dataSourceKind === 'mock'
          ? 'The console is intentionally running from mock data.'
          : `${readyViews.length} read-only views are connected.`,
      nextStep: fallbackViews.length
        ? 'Repair failed read views in Admin Settings before production decision workflows rely on them.'
        : dataSourceKind === 'mock'
          ? 'Switch to Supabase read-only views once the database review is complete.'
          : 'Keep read-view diagnostics monitored during launch.',
      linkedSurface: 'Admin Settings',
    }),
    createGate({
      id: 'data-quality-blockers',
      area: 'Data',
      title: 'Data quality blockers',
      status: blockedQualityChecks.length ? 'Blocked' : reviewQualityChecks.length ? 'Watch' : 'Ready',
      severity: blockedQualityChecks.length ? 'Critical' : reviewQualityChecks.length ? 'High' : 'Low',
      owner: 'Engineering',
      scoreImpact: blockedQualityChecks.length * 9 + reviewQualityChecks.length * 3,
      evidence: `${blockedQualityChecks.length} blocked checks, ${reviewQualityChecks.length} checks needing review.`,
      nextStep: blockedQualityChecks[0]?.remediation ?? reviewQualityChecks[0]?.remediation ?? 'Keep data quality checks passing.',
      linkedSurface: 'Data Quality',
    }),
    createGate({
      id: 'action-governance',
      area: 'Operations',
      title: 'Admin action governance',
      status: governanceBlocked.length ? 'Blocked' : governanceNeedsApproval.length ? 'Watch' : 'Ready',
      severity: governanceBlocked.length ? 'Critical' : governanceNeedsApproval.length ? 'High' : 'Low',
      owner: 'Owner',
      scoreImpact: governanceBlocked.length * 10 + governanceNeedsApproval.length * 4,
      evidence: `${governanceBlocked.length} blocked requests, ${governanceNeedsApproval.length} waiting on approval.`,
      nextStep: governanceBlocked[0]?.hardBlockers[0] ?? 'Review queued requests and approve only server-safe actions.',
      linkedSurface: 'Action Requests',
    }),
    createGate({
      id: 'audit-coverage',
      area: 'Security',
      title: 'Audit coverage',
      status: activeAuditEvents ? 'Ready' : 'Watch',
      severity: activeAuditEvents ? 'Low' : 'High',
      owner: 'Owner',
      scoreImpact: activeAuditEvents ? 0 : 8,
      evidence: activeAuditEvents ? `${activeAuditEvents} audit records are visible in the read model.` : 'No audit records are visible yet.',
      nextStep: activeAuditEvents
        ? 'Keep meaningful admin, support, finance, impersonation, agent, and export events audit-logged.'
        : 'Connect audit log read views before launch review.',
      linkedSurface: 'Audit Logs',
    }),
    createGate({
      id: 'support-health',
      area: 'Support',
      title: 'Support and health load',
      status: criticalSupportIssues.length || failingHealthSignals.length ? 'Blocked' : openSupportIssues.length || warningHealthSignals.length ? 'Watch' : 'Ready',
      severity: criticalSupportIssues.length || failingHealthSignals.length ? 'Critical' : openSupportIssues.length || warningHealthSignals.length ? 'High' : 'Low',
      owner: 'Support',
      scoreImpact: criticalSupportIssues.length * 8 + failingHealthSignals.length * 8 + openSupportIssues.length + warningHealthSignals.length * 2,
      evidence: `${openSupportIssues.length} open support issues, ${failingHealthSignals.length} failing health signals, ${warningHealthSignals.length} warnings.`,
      nextStep: criticalSupportIssues[0]?.recommendedAction ?? failingHealthSignals[0]?.recommendedAction ?? 'Triage open support and health signals before customer-facing expansion.',
      linkedSurface: 'Support Center',
    }),
    createGate({
      id: 'production-feature-flags',
      area: 'Security',
      title: 'Production feature flags',
      status: highRiskProductionFlags.length ? 'Watch' : 'Ready',
      severity: highRiskProductionFlags.length ? 'High' : 'Low',
      owner: 'Engineering',
      scoreImpact: highRiskProductionFlags.length * 5,
      evidence: `${highRiskProductionFlags.length} high-risk production flags are enabled.`,
      nextStep: highRiskProductionFlags[0]
        ? `Review ${highRiskProductionFlags[0].name} rollout, audit requirement, and rollback path.`
        : 'Keep high-risk production flags under explicit rollout review.',
      linkedSurface: 'Feature Flags',
    }),
    createGate({
      id: 'agent-human-review',
      area: 'Agents',
      title: 'Agent human-review boundary',
      status: reviewAgentEvents.length ? 'Watch' : 'Ready',
      severity: reviewAgentEvents.length ? 'High' : 'Low',
      owner: 'Owner',
      scoreImpact: reviewAgentEvents.length * 4,
      evidence: `${reviewAgentEvents.length} agent events need human review; ${draftAgents.length} agent definitions are draft or planned.`,
      nextStep: reviewAgentEvents[0]?.outputSummary ?? 'Keep agent actions recommendation-only until approval handlers exist.',
      linkedSurface: 'Agent Foundation',
    }),
    createGate({
      id: 'billing-provider-readiness',
      area: 'Finance',
      title: 'Billing provider readiness',
      status: billingRisks.length ? 'Watch' : 'Ready',
      severity: billingRisks.length ? 'High' : 'Medium',
      owner: 'Finance',
      scoreImpact: billingRisks.length * 4 + providerPendingRevenue.length,
      evidence: `${billingRisks.length} payment risks and ${providerPendingRevenue.length} provider-pending revenue rows.`,
      nextStep: billingRisks[0]?.nextAction ?? 'Keep Stripe and QuickBooks behind finance-owned review adapters.',
      linkedSurface: 'Billing',
    }),
    createGate({
      id: 'integrations-boundary',
      area: 'Integrations',
      title: 'External integration boundary',
      status: providerPendingRevenue.length || draftAgents.length ? 'Watch' : 'Ready',
      severity: providerPendingRevenue.length || draftAgents.length ? 'Medium' : 'Low',
      owner: 'Engineering',
      scoreImpact: Math.min(8, providerPendingRevenue.length + draftAgents.length),
      evidence: `${providerPendingRevenue.length} revenue rows await provider reconciliation; ${draftAgents.length} agents are not monitoring-ready.`,
      nextStep: 'Keep Stripe, QuickBooks, analytics, and agent execution behind internal interfaces until contracts are stable.',
      linkedSurface: 'Reports',
    }),
  ].sort((a, b) => statusRank(b.status) - statusRank(a.status) || severityRank(b.severity) - severityRank(a.severity) || b.scoreImpact - a.scoreImpact)

  const score = Math.max(0, Math.min(100, 100 - gates.reduce((sum, gate) => sum + gate.scoreImpact, 0)))
  const blockedCount = gates.filter(gate => gate.status === 'Blocked').length
  const watchCount = gates.filter(gate => gate.status === 'Watch').length
  const readyCount = gates.filter(gate => gate.status === 'Ready').length
  const criticalCount = gates.filter(gate => gate.severity === 'Critical').length
  const highCount = gates.filter(gate => gate.severity === 'High').length
  const reviewCount = watchCount + blockedCount
  const launchStatus: LaunchGateStatus = blockedCount ? 'Blocked' : watchCount ? 'Watch' : 'Ready'

  return {
    score,
    status: launchStatus,
    summary: getSummary(launchStatus, blockedCount, watchCount),
    gates,
    readyCount,
    watchCount,
    blockedCount,
    criticalCount,
    highCount,
    reviewCount,
    generatedAt,
  }
}

export function getLaunchGateTone(status: LaunchGateStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'ok'
}

export function getLaunchSeverityTone(severity: LaunchGateSeverity): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (severity === 'Critical') return 'danger'
  if (severity === 'High') return 'warn'
  if (severity === 'Medium') return 'info'
  return 'neutral'
}

function createGate(gate: LaunchGate): LaunchGate {
  return gate
}

function getSummary(status: LaunchGateStatus, blockedCount: number, watchCount: number) {
  if (status === 'Blocked') return `${blockedCount} launch blockers must be cleared before production expansion.`
  if (status === 'Watch') return `${watchCount} gates need owner review before launch confidence is high.`
  return 'All launch gates are ready for executive review.'
}

function statusRank(status: LaunchGateStatus) {
  if (status === 'Blocked') return 3
  if (status === 'Watch') return 2
  return 1
}

function severityRank(severity: LaunchGateSeverity) {
  if (severity === 'Critical') return 4
  if (severity === 'High') return 3
  if (severity === 'Medium') return 2
  return 1
}
