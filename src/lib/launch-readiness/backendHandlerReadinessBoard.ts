import type {
  BackendHandlerSpec,
  BackendHandlerSpecRegister,
  BackendHandlerSpecStatus,
} from './backendHandlerSpecs'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'

export type BackendHandlerReadinessStatus = 'Blocked' | 'Review' | 'Ready' | 'Approved'
export type BackendHandlerReadinessLaneId = 'blocked' | 'review' | 'draft' | 'ready' | 'approved'

export interface BackendHandlerReadinessCard {
  id: string
  specId: string
  laneId: BackendHandlerReadinessLaneId
  status: BackendHandlerReadinessStatus
  specStatus: BackendHandlerSpecStatus
  risk: BackendImplementationPriority
  owner: string
  handlerKey: string
  handlerLabel: string
  permission: string
  method: string
  endpoint: string
  mutationMode: string
  handoffStatus: string
  acceptanceSummary: string
  nextStep: string
  blockerCount: number
  reviewGateCount: number
  readyGateCount: number
  gateCount: number
  auditBacked: boolean
  reviewedAt?: string
}

export interface BackendHandlerReadinessLane {
  id: BackendHandlerReadinessLaneId
  title: string
  status: BackendHandlerReadinessStatus
  summary: string
  cards: BackendHandlerReadinessCard[]
  count: number
  criticalCount: number
}

export interface BackendHandlerReadinessOwnerGroup {
  owner: string
  total: number
  blocked: number
  review: number
  ready: number
  approved: number
  criticalCount: number
  nextStep: string
}

export interface BackendHandlerReadinessPermissionGroup {
  permission: string
  total: number
  blocked: number
  review: number
  ready: number
  mutationCandidateCount: number
  dryRunRequiredCount: number
  nextStep: string
}

export interface BackendHandlerReadinessEndpointGroup {
  id: string
  handlerKey: string
  handlerLabel: string
  owner: string
  method: string
  endpoint: string
  status: BackendHandlerReadinessStatus
  specStatus: BackendHandlerSpecStatus
  risk: BackendImplementationPriority
  mutationMode: string
  gateSummary: string
}

export interface BackendHandlerReadinessBoard {
  status: BackendHandlerReadinessStatus
  summary: string
  generatedAt: string
  lanes: BackendHandlerReadinessLane[]
  cards: BackendHandlerReadinessCard[]
  nextCard?: BackendHandlerReadinessCard
  totalCount: number
  blockedCount: number
  reviewCount: number
  draftCount: number
  readyCount: number
  approvedCount: number
  criticalCount: number
  ownerCount: number
  endpointCount: number
  mutationCandidateCount: number
  ownerGroups: BackendHandlerReadinessOwnerGroup[]
  permissionGroups: BackendHandlerReadinessPermissionGroup[]
  endpointGroups: BackendHandlerReadinessEndpointGroup[]
}

interface BuildBackendHandlerReadinessBoardInput {
  specRegister: BackendHandlerSpecRegister
}

export const backendHandlerReadinessBoardBoundaryRule =
  'Handler readiness board updates are operational visibility only. The board does not create endpoints, deploy code, execute handlers, mutate production data, change billing, change module access, alter permissions, impersonate users, or run agent actions.'

export function buildBackendHandlerReadinessBoard({
  specRegister,
}: BuildBackendHandlerReadinessBoardInput): BackendHandlerReadinessBoard {
  const generatedAt = new Date().toISOString()
  const cards = specRegister.specs.map(createCard)
  const lanes = createLanes(cards)
  const blockedCount = cards.filter(card => card.laneId === 'blocked').length
  const reviewCount = cards.filter(card => card.laneId === 'review').length
  const draftCount = cards.filter(card => card.laneId === 'draft').length
  const readyCount = cards.filter(card => card.laneId === 'ready').length
  const approvedCount = cards.filter(card => card.laneId === 'approved').length
  const status: BackendHandlerReadinessStatus = blockedCount
    ? 'Blocked'
    : reviewCount || draftCount
      ? 'Review'
      : readyCount
        ? 'Ready'
        : 'Approved'
  const openCards = cards.filter(card => card.laneId !== 'approved')

  return {
    status,
    summary: getBoardSummary(status, blockedCount, reviewCount, draftCount, readyCount, approvedCount),
    generatedAt,
    lanes,
    cards,
    nextCard: openCards[0],
    totalCount: cards.length,
    blockedCount,
    reviewCount,
    draftCount,
    readyCount,
    approvedCount,
    criticalCount: openCards.filter(card => card.risk === 'Critical').length,
    ownerCount: new Set(cards.map(card => card.owner)).size,
    endpointCount: new Set(cards.map(card => card.endpoint)).size,
    mutationCandidateCount: cards.filter(card => card.mutationMode === 'Server Mutation Candidate').length,
    ownerGroups: buildOwnerGroups(cards),
    permissionGroups: buildPermissionGroups(specRegister.specs, cards),
    endpointGroups: buildEndpointGroups(cards),
  }
}

export function getBackendHandlerReadinessTone(status: BackendHandlerReadinessStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'ok'
}

export function getBackendHandlerReadinessRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

function createCard(spec: BackendHandlerSpec): BackendHandlerReadinessCard {
  const blockerCount = spec.approvalGates.filter(gate => gate.status === 'Blocked').length
  const reviewGateCount = spec.approvalGates.filter(gate => gate.status === 'Review').length
  const readyGateCount = spec.approvalGates.filter(gate => gate.status === 'Ready').length
  const laneId = getLaneId(spec.status)

  return {
    id: `handler-readiness-${spec.id}`,
    specId: spec.id,
    laneId,
    status: getCardStatus(spec.status),
    specStatus: spec.status,
    risk: spec.risk,
    owner: spec.owner,
    handlerKey: spec.handlerKey,
    handlerLabel: spec.handlerLabel,
    permission: spec.permission,
    method: spec.method,
    endpoint: spec.endpoint,
    mutationMode: spec.mutationMode,
    handoffStatus: getHandoffStatus(spec.status, blockerCount, reviewGateCount),
    acceptanceSummary: spec.acceptanceSummary,
    nextStep: getCardNextStep(spec, blockerCount, reviewGateCount),
    blockerCount,
    reviewGateCount,
    readyGateCount,
    gateCount: spec.approvalGates.length,
    auditBacked: spec.auditBacked,
    reviewedAt: spec.reviewedAt,
  }
}

function createLanes(cards: BackendHandlerReadinessCard[]): BackendHandlerReadinessLane[] {
  const definitions: Array<{
    id: BackendHandlerReadinessLaneId
    title: string
    status: BackendHandlerReadinessStatus
  }> = [
    { id: 'blocked', title: 'Blocked', status: 'Blocked' },
    { id: 'review', title: 'Needs Review', status: 'Review' },
    { id: 'draft', title: 'Drafted', status: 'Review' },
    { id: 'ready', title: 'Ready For Engineering', status: 'Ready' },
    { id: 'approved', title: 'Approved', status: 'Approved' },
  ]

  return definitions.map(definition => {
    const laneCards = cards
      .filter(card => card.laneId === definition.id)
      .sort((a, b) => priorityRank(b.risk) - priorityRank(a.risk) || b.blockerCount - a.blockerCount || a.handlerLabel.localeCompare(b.handlerLabel))
    return {
      ...definition,
      cards: laneCards,
      count: laneCards.length,
      criticalCount: laneCards.filter(card => card.risk === 'Critical').length,
      summary: getLaneSummary(definition.id, laneCards.length, laneCards.filter(card => card.risk === 'Critical').length),
    }
  })
}

function buildOwnerGroups(cards: BackendHandlerReadinessCard[]): BackendHandlerReadinessOwnerGroup[] {
  const owners = Array.from(new Set(cards.map(card => card.owner)))
  return owners.map(owner => {
    const ownerCards = cards.filter(card => card.owner === owner)
    const blocked = ownerCards.filter(card => card.status === 'Blocked').length
    const review = ownerCards.filter(card => card.status === 'Review').length
    const ready = ownerCards.filter(card => card.status === 'Ready').length
    const approved = ownerCards.filter(card => card.status === 'Approved').length
    return {
      owner,
      total: ownerCards.length,
      blocked,
      review,
      ready,
      approved,
      criticalCount: ownerCards.filter(card => card.risk === 'Critical').length,
      nextStep: blocked
        ? 'Clear blocked gates before engineering handoff.'
        : review
          ? 'Review draft or owner-gated handler specs.'
          : ready
            ? 'Hand ready specs to engineering.'
            : 'Monitor approved handler specs.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.review - a.review || b.ready - a.ready || a.owner.localeCompare(b.owner))
}

function buildPermissionGroups(
  specs: BackendHandlerSpec[],
  cards: BackendHandlerReadinessCard[],
): BackendHandlerReadinessPermissionGroup[] {
  const permissions = Array.from(new Set(cards.map(card => card.permission)))
  return permissions.map(permission => {
    const permissionCards = cards.filter(card => card.permission === permission)
    const permissionSpecs = specs.filter(spec => spec.permission === permission)
    const blocked = permissionCards.filter(card => card.status === 'Blocked').length
    const review = permissionCards.filter(card => card.status === 'Review').length
    const ready = permissionCards.filter(card => card.status === 'Ready').length
    const mutationCandidateCount = permissionCards.filter(card => card.mutationMode === 'Server Mutation Candidate').length
    return {
      permission,
      total: permissionCards.length,
      blocked,
      review,
      ready,
      mutationCandidateCount,
      dryRunRequiredCount: permissionSpecs.filter(spec => spec.dryRunRequired).length,
      nextStep: blocked
        ? 'Hold permission handoff until blocked specs are cleared.'
        : review
          ? 'Review permission scope before engineering accepts the handler set.'
          : 'Permission path is ready for server-side implementation review.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.review - a.review || a.permission.localeCompare(b.permission))
}

function buildEndpointGroups(cards: BackendHandlerReadinessCard[]): BackendHandlerReadinessEndpointGroup[] {
  return cards.map(card => ({
    id: `endpoint-${card.specId}`,
    handlerKey: card.handlerKey,
    handlerLabel: card.handlerLabel,
    owner: card.owner,
    method: card.method,
    endpoint: card.endpoint,
    status: card.status,
    specStatus: card.specStatus,
    risk: card.risk,
    mutationMode: card.mutationMode,
    gateSummary: `${card.readyGateCount}/${card.gateCount} gates ready, ${card.blockerCount} blocked, ${card.reviewGateCount} review.`,
  })).sort((a, b) => statusSortRank(b.status) - statusSortRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.endpoint.localeCompare(b.endpoint))
}

function getLaneId(status: BackendHandlerSpecStatus): BackendHandlerReadinessLaneId {
  if (status === 'Blocked') return 'blocked'
  if (status === 'Needs Review') return 'review'
  if (status === 'Draft') return 'draft'
  if (status === 'Ready For Engineering') return 'ready'
  return 'approved'
}

function getCardStatus(status: BackendHandlerSpecStatus): BackendHandlerReadinessStatus {
  if (status === 'Blocked') return 'Blocked'
  if (status === 'Needs Review' || status === 'Draft') return 'Review'
  if (status === 'Ready For Engineering') return 'Ready'
  return 'Approved'
}

function getHandoffStatus(
  status: BackendHandlerSpecStatus,
  blockerCount: number,
  reviewGateCount: number,
) {
  if (status === 'Approved') return 'Approved for engineering'
  if (status === 'Ready For Engineering') return 'Ready for engineering intake'
  if (blockerCount) return 'Blocked before handoff'
  if (reviewGateCount || status === 'Needs Review') return 'Needs owner review'
  return 'Drafting'
}

function getCardNextStep(
  spec: BackendHandlerSpec,
  blockerCount: number,
  reviewGateCount: number,
) {
  if (spec.status === 'Approved') return 'Keep approved spec visible until implementation is complete.'
  if (spec.status === 'Ready For Engineering') return 'Assign engineering implementation owner and preserve audit-backed handoff.'
  if (blockerCount) return `Clear ${blockerCount} blocked gate${blockerCount === 1 ? '' : 's'} before handoff.`
  if (reviewGateCount) return `Review ${reviewGateCount} gate${reviewGateCount === 1 ? '' : 's'} before marking ready.`
  return 'Confirm endpoint, permission, rollback, and audit fields before engineering handoff.'
}

function getBoardSummary(
  status: BackendHandlerReadinessStatus,
  blockedCount: number,
  reviewCount: number,
  draftCount: number,
  readyCount: number,
  approvedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} handler spec${blockedCount === 1 ? '' : 's'} are blocked before engineering handoff.`
  if (status === 'Review') return `${reviewCount + draftCount} handler spec${reviewCount + draftCount === 1 ? '' : 's'} need review or drafting.`
  if (status === 'Ready') return `${readyCount} handler spec${readyCount === 1 ? '' : 's'} are ready for engineering intake.`
  return `${approvedCount} handler spec${approvedCount === 1 ? '' : 's'} are approved for implementation tracking.`
}

function getLaneSummary(
  id: BackendHandlerReadinessLaneId,
  count: number,
  criticalCount: number,
) {
  if (id === 'blocked') return `${count} blocked, ${criticalCount} critical.`
  if (id === 'review') return `${count} need owner or engineering review.`
  if (id === 'draft') return `${count} drafted from implementation work.`
  if (id === 'ready') return `${count} ready for engineering intake.`
  return `${count} approved and audit-backed.`
}

function statusSortRank(status: BackendHandlerReadinessStatus) {
  if (status === 'Blocked') return 4
  if (status === 'Review') return 3
  if (status === 'Ready') return 2
  return 1
}

function priorityRank(priority: BackendImplementationPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}
