import type { PermissionKey } from '../permissions/permissions'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { OwnerCommitmentItem } from '../command-work/ownerCommitmentLedger'
import {
  createAdminActionScope,
  formatAdminActionType,
  getServerActionHandlerPlaceholder,
  type AdminActionRequest,
  type AdminActionRequestType,
  type AdminActionScope,
  type ServerActionHandlerPlaceholder,
} from './actionRequests'
import {
  getActionRequestGovernancePolicy,
  type ActionRequestGovernancePolicy,
  type ActionRequestRiskLevel,
} from './actionRequestGovernance'

export type ActionRequestLaunchpadLane =
  | 'Draft Needed'
  | 'Drafted'
  | 'Queued For Approval'
  | 'Approved'
  | 'Blocked'
  | 'Completed'

export interface ActionRequestLaunchpadCandidate {
  id: string
  commitmentId: string
  commitmentTitle: string
  commitmentStatus: OwnerCommitmentItem['status']
  commitmentSource: OwnerCommitmentItem['source']
  priority: OwnerCommitmentItem['priority']
  requestTitle: string
  requestDescription: string
  actionType: AdminActionRequestType
  actionTypeLabel: string
  permissionRequired: PermissionKey
  scope: AdminActionScope
  lane: ActionRequestLaunchpadLane
  riskLevel: ActionRequestRiskLevel
  governancePolicy: ActionRequestGovernancePolicy
  humanConfirmationRequired: boolean
  requiredApprovers: string[]
  reason: string
  rollbackNotes: string
  serverHandler: ServerActionHandlerPlaceholder
  targetPage: OwnerCommitmentItem['targetPage']
  targetPermission: OwnerCommitmentItem['targetPermission']
  evidence: string[]
  existingRequest?: AdminActionRequest
}

export interface ActionRequestLaunchpadSummary {
  total: number
  draftNeeded: number
  drafted: number
  queued: number
  approved: number
  blocked: number
  completed: number
  criticalOrHigh: number
  humanGated: number
  existingRequests: number
}

export interface BuildActionRequestLaunchpadInput {
  commitments: OwnerCommitmentItem[]
  requests: AdminActionRequest[]
  data: PlatformAdminReadModel
}

export const actionRequestLaunchpadBoundaryRule =
  'Action Request Launchpad converts owner commitments into governed Admin Action Request drafts. It can create or queue request records with audit anchors, but production execution remains blocked until server-side handlers, permissions, approvals, rollback metadata, and audit writes are complete.'

export function buildActionRequestLaunchpad(input: BuildActionRequestLaunchpadInput): ActionRequestLaunchpadCandidate[] {
  return input.commitments
    .filter(commitment => commitment.status !== 'Dismissed')
    .map(commitment => createCandidate(commitment, input.requests, input.data))
    .sort(sortLaunchpadCandidates)
}

export function summarizeActionRequestLaunchpad(candidates: ActionRequestLaunchpadCandidate[]): ActionRequestLaunchpadSummary {
  return {
    total: candidates.length,
    draftNeeded: candidates.filter(candidate => candidate.lane === 'Draft Needed').length,
    drafted: candidates.filter(candidate => candidate.lane === 'Drafted').length,
    queued: candidates.filter(candidate => candidate.lane === 'Queued For Approval').length,
    approved: candidates.filter(candidate => candidate.lane === 'Approved').length,
    blocked: candidates.filter(candidate => candidate.lane === 'Blocked').length,
    completed: candidates.filter(candidate => candidate.lane === 'Completed').length,
    criticalOrHigh: candidates.filter(candidate => candidate.riskLevel === 'Critical' || candidate.riskLevel === 'High').length,
    humanGated: candidates.filter(candidate => candidate.humanConfirmationRequired).length,
    existingRequests: candidates.filter(candidate => candidate.existingRequest).length,
  }
}

export function getLaunchpadLaneTone(lane: ActionRequestLaunchpadLane) {
  if (lane === 'Completed') return 'ok' as const
  if (lane === 'Approved') return 'info' as const
  if (lane === 'Blocked') return 'danger' as const
  if (lane === 'Queued For Approval') return 'warn' as const
  if (lane === 'Drafted') return 'neutral' as const
  return 'warn' as const
}

export function getLaunchpadRiskTone(riskLevel: ActionRequestRiskLevel) {
  if (riskLevel === 'Critical') return 'danger' as const
  if (riskLevel === 'High') return 'warn' as const
  if (riskLevel === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function getLaunchpadActionTypeTone(actionType: AdminActionRequestType) {
  if (actionType === 'feature_flag_change' || actionType === 'admin_user_change' || actionType === 'impersonation_start') return 'danger' as const
  if (actionType === 'module_activation_change' || actionType === 'billing_review_action' || actionType === 'remediation_server_action') return 'warn' as const
  if (actionType === 'agent_recommended_action') return 'info' as const
  return 'neutral' as const
}

export function getLaunchpadPriorityTone(priority: OwnerCommitmentItem['priority']) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

function createCandidate(
  commitment: OwnerCommitmentItem,
  requests: AdminActionRequest[],
  data: PlatformAdminReadModel,
): ActionRequestLaunchpadCandidate {
  const actionType = inferActionType(commitment)
  const governancePolicy = getActionRequestGovernancePolicy(actionType)
  const existingRequest = findExistingRequest(commitment, requests)
  const serverHandler = getServerActionHandlerPlaceholder(actionType, createHandlerOverride(commitment, actionType))
  return {
    id: `launchpad-${commitment.id}`,
    commitmentId: commitment.id,
    commitmentTitle: commitment.title,
    commitmentStatus: commitment.status,
    commitmentSource: commitment.source,
    priority: commitment.priority,
    requestTitle: createRequestTitle(commitment, actionType),
    requestDescription: createRequestDescription(commitment, actionType),
    actionType,
    actionTypeLabel: formatAdminActionType(actionType),
    permissionRequired: permissionForActionType(actionType),
    scope: inferScope(commitment.scope, data),
    lane: laneFromRequest(existingRequest),
    riskLevel: governancePolicy.riskLevel,
    governancePolicy,
    humanConfirmationRequired: governancePolicy.humanConfirmationRequired,
    requiredApprovers: governancePolicy.requiredApprovers,
    reason: createReason(commitment),
    rollbackNotes: createRollbackNotes(commitment),
    serverHandler,
    targetPage: commitment.targetPage,
    targetPermission: commitment.targetPermission,
    evidence: createEvidence(commitment, actionType),
    existingRequest,
  }
}

function inferActionType(commitment: OwnerCommitmentItem): AdminActionRequestType {
  const text = normalize(`${commitment.title} ${commitment.description} ${commitment.recommendedAction} ${commitment.scope}`)
  if (commitment.targetPage === 'revenue' || text.includes('billing') || text.includes('payment') || text.includes('revenue')) {
    return 'billing_review_action'
  }
  if (text.includes('module') || text.includes('activation') || text.includes('entitlement')) {
    return 'module_activation_change'
  }
  if (text.includes('feature flag') || text.includes('rollout') || text.includes('flag')) {
    return 'feature_flag_change'
  }
  if (commitment.targetPage === 'support' || text.includes('support') || text.includes('troubleshooting')) {
    return 'support_troubleshooting_action'
  }
  if (commitment.targetPage === 'operating-exceptions' || text.includes('exception') || text.includes('remediation') || text.includes('repair') || text.includes('blocked')) {
    return 'remediation_server_action'
  }
  return 'agent_recommended_action'
}

function permissionForActionType(actionType: AdminActionRequestType): PermissionKey {
  if (actionType === 'billing_review_action') return 'billing.manage'
  if (actionType === 'module_activation_change') return 'modules.manage'
  if (actionType === 'feature_flag_change') return 'feature_flags.manage'
  if (actionType === 'support_troubleshooting_action') return 'support.manage'
  if (actionType === 'remediation_server_action') return 'troubleshooting.run'
  if (actionType === 'admin_user_change') return 'admin_users.manage'
  if (actionType === 'impersonation_start' || actionType === 'impersonation_end') return 'impersonation.start'
  return 'agents.manage'
}

function inferScope(scopeLabel: string, data: PlatformAdminReadModel): AdminActionScope {
  const normalizedLabel = normalize(scopeLabel)
  const venue = data.venues.find(item => normalizedLabel.includes(normalize(item.name)))
  const property = data.properties.find(item => normalizedLabel.includes(normalize(item.name)))
    ?? data.properties.find(item => item.id === venue?.propertyId)
  const organization = data.organizations.find(item => normalizedLabel.includes(normalize(item.name)))
    ?? data.organizations.find(item => item.id === venue?.organizationId || item.id === property?.organizationId)

  return createAdminActionScope({
    label: scopeLabel,
    organizationId: organization?.id,
    organizationName: organization?.name,
    propertyId: property?.id ?? venue?.propertyId,
    propertyName: property?.name ?? venue?.propertyName,
    venueId: venue?.id,
    venueName: venue?.name,
  })
}

function findExistingRequest(commitment: OwnerCommitmentItem, requests: AdminActionRequest[]) {
  return requests.find(request => (
    request.metadata?.sourceCommitmentId === commitment.id
    || request.metadata?.ownerCommitmentId === commitment.id
    || request.metadata?.relatedDecisionId === commitment.relatedDecisionId
  ))
}

function laneFromRequest(request: AdminActionRequest | undefined): ActionRequestLaunchpadLane {
  if (!request) return 'Draft Needed'
  if (request.status === 'Draft') return 'Drafted'
  if (request.status === 'Queued') return 'Queued For Approval'
  if (request.status === 'Approved' || request.status === 'Running') return 'Approved'
  if (request.status === 'Completed') return 'Completed'
  return 'Blocked'
}

function createRequestTitle(commitment: OwnerCommitmentItem, actionType: AdminActionRequestType) {
  return `${formatAdminActionType(actionType)}: ${commitment.source === 'Closure' ? 'verify' : 'execute'} ${commitment.title}`
}

function createRequestDescription(commitment: OwnerCommitmentItem, actionType: AdminActionRequestType) {
  return `${formatAdminActionType(actionType)} package generated from ${commitment.source.toLowerCase()} commitment ${commitment.id}.`
}

function createReason(commitment: OwnerCommitmentItem) {
  return [
    `${commitment.title}`,
    `Owner commitment status: ${commitment.status}.`,
    `Recommended action: ${commitment.recommendedAction}`,
    `Source decision: ${commitment.relatedDecisionId}.`,
  ].join(' ')
}

function createRollbackNotes(commitment: OwnerCommitmentItem) {
  return [
    commitment.rollbackNotes,
    'Server execution must preserve tenant scope, confirm human approval, write immutable audit evidence, and support a no-op rollback if preflight checks fail.',
  ].join(' ')
}

function createEvidence(commitment: OwnerCommitmentItem, actionType: AdminActionRequestType) {
  return [
    `Launchpad action type: ${formatAdminActionType(actionType)}`,
    `Commitment priority: ${commitment.priority}`,
    `Commitment status: ${commitment.status}`,
    `Target page: ${commitment.targetPage}`,
    ...commitment.evidence,
  ]
}

function createHandlerOverride(
  commitment: OwnerCommitmentItem,
  actionType: AdminActionRequestType,
): Partial<Omit<ServerActionHandlerPlaceholder, 'status'>> {
  return {
    key: `server.launchpad.${actionType}`,
    label: `${formatAdminActionType(actionType)} launch handler`,
    description: `Placeholder for governed execution of owner commitment ${commitment.id}; requires server-side permission checks, approval confirmation, audit write, and rollback metadata before mutation.`,
  }
}

function sortLaunchpadCandidates(a: ActionRequestLaunchpadCandidate, b: ActionRequestLaunchpadCandidate) {
  return laneWeight(a.lane) - laneWeight(b.lane)
    || riskWeight(a.riskLevel) - riskWeight(b.riskLevel)
    || priorityWeight(a.priority) - priorityWeight(b.priority)
    || a.requestTitle.localeCompare(b.requestTitle)
}

function laneWeight(lane: ActionRequestLaunchpadLane) {
  if (lane === 'Draft Needed') return 0
  if (lane === 'Blocked') return 1
  if (lane === 'Queued For Approval') return 2
  if (lane === 'Drafted') return 3
  if (lane === 'Approved') return 4
  return 5
}

function riskWeight(riskLevel: ActionRequestRiskLevel) {
  if (riskLevel === 'Critical') return 0
  if (riskLevel === 'High') return 1
  if (riskLevel === 'Medium') return 2
  return 3
}

function priorityWeight(priority: OwnerCommitmentItem['priority']) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
