import type { PlatformHealthSignal, SupportIssue } from '../mock-data/mockPlatform'

export type RunbookCategory = 'Client Configuration' | 'Data / Queue Repair' | 'Universal Code Issue'
export type RunbookScope = 'Single Venue' | 'Client / Property' | 'Module-Wide' | 'All Tenants'
export type RunbookConfidence = 'High' | 'Medium' | 'Needs Engineering'
export type RunbookActionType = 'safe_fix' | 'incident_packet'
export type RunbookOutcomeStatus = 'Recorded' | 'Ready For Server Action' | 'Engineering Review' | 'Queued For Server Action' | 'Handed Off' | 'Resolved'
export type RemediationPersistenceStatus = 'local_durable' | 'server_recorded'
export type RemediationPersistenceTarget = 'local_storage' | 'platform_admin.remediation_packets'

export interface SupportRunbook {
  id: string
  title: string
  category: RunbookCategory
  scope: RunbookScope
  confidence: RunbookConfidence
  matchesIssueTypes: SupportIssue['issueType'][]
  supportCanApply: boolean
  serverSideRequired: boolean
  diagnosisSignals: string[]
  safeActions: string[]
  blockedActions: string[]
  engineeringPath: string
  auditActionKey: string
  owner: 'Support' | 'Engineering' | 'Client Success' | 'Finance'
}

export interface RunbookActionOutcome {
  id: string
  type: RunbookActionType
  title: string
  runbookTitle: string
  organizationName: string
  propertyName: string
  venueName: string
  issueType: SupportIssue['issueType']
  status: RunbookOutcomeStatus
  severity: 'notice' | 'warning'
  owner: SupportRunbook['owner']
  scope: RunbookScope
  createdAt: string
  primaryMessage: string
  evidence: string[]
  nextSteps: string[]
  blockedActions: string[]
  auditActionKey: string
  updatedAt?: string
  persistenceStatus?: RemediationPersistenceStatus
  persistenceTarget?: RemediationPersistenceTarget
}

export interface ImpactAssessment {
  scope: RunbookScope
  confidence: RunbookConfidence
  severity: 'notice' | 'warning' | 'critical'
  affectedClients: number
  affectedVenues: number
  similarOpenIssues: number
  primarySignal: string
  recommendedPath: string
  supportBoundary: string
  escalationRecommended: boolean
}

export const supportRunbooks: SupportRunbook[] = [
  {
    id: 'runbook-module-configuration',
    title: 'Repair Module Configuration',
    category: 'Client Configuration',
    scope: 'Client / Property',
    confidence: 'High',
    matchesIssueTypes: ['Module Configuration'],
    supportCanApply: true,
    serverSideRequired: true,
    diagnosisSignals: ['Module enabled but routing incomplete', 'Dependency missing', 'Low usage after activation'],
    safeActions: ['Validate module dependencies', 'Repair staff alert routing', 'Re-run module setup checklist'],
    blockedActions: ['Change plan or billing', 'Enable paid modules silently', 'Rewrite customer permissions'],
    engineeringPath: 'Escalate only if dependency validation fails across multiple clients.',
    auditActionKey: 'runbook.module_configuration.safe_fix.mock',
    owner: 'Support',
  },
  {
    id: 'runbook-notification-delivery',
    title: 'Recover Notification Delivery',
    category: 'Data / Queue Repair',
    scope: 'Single Venue',
    confidence: 'High',
    matchesIssueTypes: ['Notification Delivery', 'Device Offline'],
    supportCanApply: true,
    serverSideRequired: true,
    diagnosisSignals: ['Delayed staff alert delivery', 'Device presence warning', 'Offline tablet session'],
    safeActions: ['Re-run notification health check', 'Send test notification', 'Reset device presence session'],
    blockedActions: ['Disable notifications globally', 'Bypass staff routing rules', 'Change app code from support console'],
    engineeringPath: 'Escalate if delivery delays appear across multiple venues or environments.',
    auditActionKey: 'runbook.notification_delivery.safe_fix.mock',
    owner: 'Support',
  },
  {
    id: 'runbook-qr-session',
    title: 'Repair QR / Session Path',
    category: 'Data / Queue Repair',
    scope: 'Single Venue',
    confidence: 'Medium',
    matchesIssueTypes: ['QR Scan Failure'],
    supportCanApply: true,
    serverSideRequired: true,
    diagnosisSignals: ['QR scan failures', 'Session start errors', 'Venue code mismatch'],
    safeActions: ['Validate QR mapping', 'Refresh session token', 'Replay failed session start event'],
    blockedActions: ['Regenerate all venue QR codes without approval', 'Delete guest session history', 'Weaken venue scoping'],
    engineeringPath: 'Escalate if QR failures reproduce on clean mappings or multiple tenants.',
    auditActionKey: 'runbook.qr_session.safe_fix.mock',
    owner: 'Support',
  },
  {
    id: 'runbook-stalled-queue',
    title: 'Clear Stalled Service Queue',
    category: 'Data / Queue Repair',
    scope: 'Single Venue',
    confidence: 'Medium',
    matchesIssueTypes: ['Stalled Queue', 'High Escalations'],
    supportCanApply: true,
    serverSideRequired: true,
    diagnosisSignals: ['Queue age above threshold', 'High escalation count', 'Request state mismatch'],
    safeActions: ['Replay stalled request event', 'Recalculate queue state', 'Create manager review note'],
    blockedActions: ['Delete service requests', 'Silently mark guest requests complete', 'Change escalation thresholds globally'],
    engineeringPath: 'Escalate if queue stalls are caused by shared API errors or deployment regressions.',
    auditActionKey: 'runbook.stalled_queue.safe_fix.mock',
    owner: 'Support',
  },
  {
    id: 'runbook-inactive-venue',
    title: 'Reactivate Quiet Venue',
    category: 'Client Configuration',
    scope: 'Client / Property',
    confidence: 'Medium',
    matchesIssueTypes: ['Inactive Venue'],
    supportCanApply: true,
    serverSideRequired: false,
    diagnosisSignals: ['No activity in 7+ days', 'Low staff adoption', 'QR placement changed'],
    safeActions: ['Assign success owner', 'Verify QR placement', 'Schedule staff enablement follow-up'],
    blockedActions: ['Change customer settings without confirmation', 'Send customer outreach silently', 'Assume churn without success review'],
    engineeringPath: 'Escalate only if inactivity is tied to login, QR, or request creation failures.',
    auditActionKey: 'runbook.inactive_venue.safe_fix.mock',
    owner: 'Client Success',
  },
  {
    id: 'runbook-billing-access',
    title: 'Resolve Billing / Access Issue',
    category: 'Client Configuration',
    scope: 'Client / Property',
    confidence: 'Medium',
    matchesIssueTypes: ['Module Configuration', 'Inactive Venue'],
    supportCanApply: false,
    serverSideRequired: true,
    diagnosisSignals: ['Plan mismatch', 'Past-due account', 'Module unavailable despite expected access'],
    safeActions: ['Create finance review packet', 'Confirm entitlement source', 'Hold module mutation until billing review'],
    blockedActions: ['Override billing state', 'Grant paid module access without approval', 'Issue refunds'],
    engineeringPath: 'Finance owns billing state. Engineering only investigates entitlement sync defects.',
    auditActionKey: 'runbook.billing_access.review_packet.mock',
    owner: 'Finance',
  },
  {
    id: 'runbook-universal-code',
    title: 'Universal Code Regression',
    category: 'Universal Code Issue',
    scope: 'All Tenants',
    confidence: 'Needs Engineering',
    matchesIssueTypes: ['Notification Delivery', 'QR Scan Failure', 'Stalled Queue', 'High Escalations', 'Module Configuration'],
    supportCanApply: false,
    serverSideRequired: true,
    diagnosisSignals: ['Same failure across multiple tenants', 'Started after deploy', 'Shared API or module behavior failing'],
    safeActions: ['Create engineering incident packet', 'Attach logs and impacted clients', 'Recommend feature flag mitigation'],
    blockedActions: ['Edit universal code from support console', 'Patch customer data to hide shared bug', 'Disable platform-wide behavior without owner review'],
    engineeringPath: 'Engineering fixes shared code. Support gathers scope, logs, mitigation options, and client communication context.',
    auditActionKey: 'runbook.universal_code.incident_packet.mock',
    owner: 'Engineering',
  },
]

export function getRunbooksForIssue(issueType?: SupportIssue['issueType']) {
  if (!issueType) return supportRunbooks
  return supportRunbooks.filter(runbook => runbook.matchesIssueTypes.includes(issueType))
}

export function createImpactAssessment(
  issue: SupportIssue,
  runbook: SupportRunbook,
  relatedSignals: PlatformHealthSignal[],
  allIssues: SupportIssue[],
): ImpactAssessment {
  const affectedClients = Math.max(1, ...relatedSignals.map(signal => signal.affectedClients))
  const affectedVenues = Math.max(1, ...relatedSignals.map(signal => signal.affectedVenues))
  const similarOpenIssues = allIssues.filter(item => item.issueType === issue.issueType && item.status !== 'Resolved').length
  const primarySignal = relatedSignals.find(signal => signal.status === 'Failing')?.label
    ?? relatedSignals.find(signal => signal.status === 'Warning')?.label
    ?? issue.relatedSignal

  if (runbook.category === 'Universal Code Issue') {
    return {
      scope: 'All Tenants',
      confidence: 'Needs Engineering',
      severity: 'critical',
      affectedClients,
      affectedVenues,
      similarOpenIssues,
      primarySignal,
      recommendedPath: 'Create engineering incident packet before attempting any broad mitigation.',
      supportBoundary: 'Support gathers evidence and mitigation context. Engineering fixes shared code.',
      escalationRecommended: true,
    }
  }

  if (affectedClients > 1 || similarOpenIssues > 1) {
    return {
      scope: 'Module-Wide',
      confidence: 'Medium',
      severity: 'warning',
      affectedClients,
      affectedVenues,
      similarOpenIssues,
      primarySignal,
      recommendedPath: 'Confirm whether the signal repeats across clients before applying a client-scoped repair.',
      supportBoundary: 'Use read-only diagnostics and scoped server actions. Escalate if the same failure repeats across tenants.',
      escalationRecommended: true,
    }
  }

  if (affectedVenues > 1) {
    return {
      scope: 'Client / Property',
      confidence: 'Medium',
      severity: 'warning',
      affectedClients,
      affectedVenues,
      similarOpenIssues,
      primarySignal,
      recommendedPath: 'Use the selected runbook only against this client or property scope.',
      supportBoundary: 'Support can apply allowlisted configuration or queue repair actions within the affected customer scope.',
      escalationRecommended: false,
    }
  }

  return {
    scope: 'Single Venue',
    confidence: 'High',
    severity: 'notice',
    affectedClients,
    affectedVenues,
    similarOpenIssues,
    primarySignal,
    recommendedPath: 'Use the selected support-safe runbook and keep all changes auditable.',
    supportBoundary: 'Support can apply allowlisted venue-scoped actions. Do not change shared platform behavior.',
    escalationRecommended: false,
  }
}

export function createRunbookOutcome(
  runbook: SupportRunbook,
  issue: SupportIssue,
  relatedSignals: PlatformHealthSignal[],
  actionType: RunbookActionType,
): RunbookActionOutcome {
  const isIncident = actionType === 'incident_packet'
  const evidence = [
    `${issue.issueType} at ${issue.venueName}`,
    issue.relatedSignal,
    issue.probableCause,
    ...relatedSignals.slice(0, 3).map(signal => `${signal.label}: ${signal.message}`),
  ]

  return {
    id: `${runbook.id}-${Date.now()}`,
    type: actionType,
    title: isIncident ? 'Engineering Incident Packet' : 'Support Safe Fix Packet',
    runbookTitle: runbook.title,
    organizationName: issue.organizationName,
    propertyName: issue.propertyName,
    venueName: issue.venueName,
    issueType: issue.issueType,
    status: isIncident ? 'Engineering Review' : runbook.serverSideRequired ? 'Ready For Server Action' : 'Recorded',
    severity: isIncident || runbook.category === 'Universal Code Issue' ? 'warning' : 'notice',
    owner: isIncident ? 'Engineering' : runbook.owner,
    scope: runbook.scope,
    createdAt: new Date().toISOString(),
    primaryMessage: isIncident
      ? `${runbook.title} has been packaged for engineering with scope, evidence, blocked support actions, and mitigation notes.`
      : `${runbook.title} is scoped as a support-safe remediation path for ${issue.venueName}.`,
    evidence,
    nextSteps: isIncident
      ? [
        'Create engineering incident from this packet.',
        'Attach affected client and health signal evidence.',
        runbook.engineeringPath,
        'Review feature flag or module mitigation before customer communication.',
      ]
      : runbook.safeActions,
    blockedActions: runbook.blockedActions,
    auditActionKey: isIncident ? 'runbook.engineering_incident_packet.mock' : runbook.auditActionKey,
  }
}
