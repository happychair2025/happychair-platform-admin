import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type {
  DataStatus,
  PlatformDataSourceKind,
  PlatformReadViewDiagnostic,
} from '../platform-data/PlatformDataContext'
import type { LaunchDecisionPacket } from './launchDecisionPackets'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'
import type { LaunchGateSignOff } from './launchSignOffs'

export type LaunchClosureDecision = 'Go' | 'Conditional Go' | 'No Go'
export type LaunchClosureItemStatus = 'Complete' | 'Needs Review' | 'Blocked'
export type LaunchClosureItemCategory = 'Readiness' | 'Approvals' | 'Packets' | 'Actions' | 'Data' | 'Evidence'

export interface LaunchClosureChecklistItem {
  id: string
  category: LaunchClosureItemCategory
  title: string
  status: LaunchClosureItemStatus
  owner: string
  evidence: string
  nextStep: string
  required: boolean
  reference: string
}

export interface LaunchClosureModel {
  decision: LaunchClosureDecision
  summary: string
  generatedAt: string
  checklist: LaunchClosureChecklistItem[]
  requiredCount: number
  completeRequiredCount: number
  reviewCount: number
  blockedCount: number
  requiredApprovalCount: number
  missingApprovalCount: number
  unresolvedDeferralCount: number
  evidenceItemCount: number
  openActionCount: number
  readyForExecutiveSignOff: boolean
}

interface BuildLaunchClosureChecklistInput {
  model: LaunchReadinessModel
  evidenceLedger: LaunchEvidenceLedger
  actionRequests: AdminActionRequest[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  signOffs: LaunchGateSignOff[]
  decisionPackets: LaunchDecisionPacket[]
  dataSourceKind: PlatformDataSourceKind
  dataStatus: DataStatus
}

const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildLaunchClosureChecklist({
  model,
  evidenceLedger,
  actionRequests,
  readViewDiagnostics,
  signOffs,
  decisionPackets,
  dataSourceKind,
  dataStatus,
}: BuildLaunchClosureChecklistInput): LaunchClosureModel {
  const generatedAt = new Date().toISOString()
  const latestSignOffByGate = new Map<string, LaunchGateSignOff>()
  signOffs.forEach(signOff => {
    if (!latestSignOffByGate.has(signOff.gateId)) latestSignOffByGate.set(signOff.gateId, signOff)
  })

  const requiredGates = model.gates.filter(gate => gate.status !== 'Ready')
  const missingApprovals = requiredGates.filter(gate => {
    const signOff = latestSignOffByGate.get(gate.id)
    return !signOff || signOff.decision === 'Assigned' || signOff.decision === 'Deferred'
  })
  const deferredSignOffs = signOffs.filter(signOff => signOff.decision === 'Deferred')
  const deferredPackets = decisionPackets.filter(packet => packet.status === 'Deferred')
  const unresolvedPacketReviews = decisionPackets.filter(packet => packet.status === 'Drafted' || packet.status === 'Queued For Review')
  const approvedPackets = decisionPackets.filter(packet => packet.status === 'Approved For Follow-Up' || packet.status === 'Assigned Follow-Up')
  const openActions = actionRequests.filter(request => openActionStatuses.has(request.status))
  const blockedActions = openActions.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const fallbackViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')
  const readyViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready')
  const unresolvedDeferralCount = deferredSignOffs.length + deferredPackets.length

  const checklistItems: LaunchClosureChecklistItem[] = [
    {
      id: 'closure-readiness-score',
      category: 'Readiness',
      title: 'Executive readiness score',
      status: statusFromLaunchStatus(model.status),
      owner: 'Owner',
      evidence: `${model.score}% readiness, ${model.blockedCount} blocked gates, ${model.watchCount} watch gates.`,
      nextStep: model.status === 'Ready' ? 'Keep the launch report attached to executive approval.' : model.summary,
      required: true,
      reference: 'Launch Gate',
    },
    {
      id: 'closure-required-approvals',
      category: 'Approvals',
      title: 'Required owner sign-offs',
      status: missingApprovals.length
        ? requiredGates.some(gate => gate.status === 'Blocked') ? 'Blocked' : 'Needs Review'
        : 'Complete',
      owner: 'Owner',
      evidence: `${requiredGates.length - missingApprovals.length} of ${requiredGates.length} required gate approvals are resolved or approved.`,
      nextStep: missingApprovals[0]
        ? `Record approval, resolution, or dated follow-up for ${missingApprovals[0].title}.`
        : 'Keep approvals visible in the launch evidence ledger.',
      required: true,
      reference: 'Owner Sign-Offs',
    },
    {
      id: 'closure-packet-approval',
      category: 'Packets',
      title: 'Decision packet approvals',
      status: deferredPackets.length
        ? 'Blocked'
        : unresolvedPacketReviews.length || (!decisionPackets.length && model.reviewCount)
          ? 'Needs Review'
          : 'Complete',
      owner: 'Owner',
      evidence: `${approvedPackets.length} approved or assigned packets, ${unresolvedPacketReviews.length} awaiting review, ${deferredPackets.length} deferred.`,
      nextStep: deferredPackets[0]
        ? `Clear deferred packet: ${deferredPackets[0].title}.`
        : unresolvedPacketReviews[0]
          ? `Approve, assign, or defer packet: ${unresolvedPacketReviews[0].title}.`
          : !decisionPackets.length && model.reviewCount
            ? 'Create decision packets for unresolved launch work before closure.'
            : 'Keep packet decisions attached to the launch report.',
      required: true,
      reference: 'Decision Packets',
    },
    {
      id: 'closure-action-queue',
      category: 'Actions',
      title: 'Admin action queue state',
      status: blockedActions.length ? 'Blocked' : openActions.length ? 'Needs Review' : 'Complete',
      owner: 'Operations',
      evidence: `${openActions.length} open action requests, ${blockedActions.length} blocked or failed.`,
      nextStep: blockedActions[0]?.statusReason ?? (openActions[0] ? `Review ${openActions[0].title} before launch closure.` : 'No open production action requests are blocking closure.'),
      required: true,
      reference: 'Action Requests',
    },
    {
      id: 'closure-read-contracts',
      category: 'Data',
      title: 'Read-only data contract state',
      status: fallbackViews.length
        ? readyViews.length ? 'Needs Review' : 'Blocked'
        : dataSourceKind === 'mock' || dataStatus === 'mock' ? 'Needs Review' : 'Complete',
      owner: 'Engineering',
      evidence: `${readyViews.length} ready read views, ${fallbackViews.length} fallback views, provider state ${dataSourceKind}/${dataStatus}.`,
      nextStep: fallbackViews[0]?.error ?? (dataSourceKind === 'mock' || dataStatus === 'mock'
        ? 'Confirm mock data is acceptable for this closure snapshot or connect Supabase read-only views.'
        : 'Keep read diagnostics monitored during launch closure.'),
      required: true,
      reference: 'Read View Diagnostics',
    },
    {
      id: 'closure-evidence-ledger',
      category: 'Evidence',
      title: 'Evidence ledger completeness',
      status: evidenceLedger.blockedCount
        ? 'Blocked'
        : evidenceLedger.entries.length && evidenceLedger.auditEventCount
          ? 'Complete'
          : 'Needs Review',
      owner: 'Owner',
      evidence: `${evidenceLedger.entries.length} evidence items, ${evidenceLedger.auditEventCount} audit events, ${evidenceLedger.packetCount} packet records.`,
      nextStep: evidenceLedger.blockedCount
        ? 'Resolve blocked evidence items before go/no-go approval.'
        : evidenceLedger.auditEventCount
          ? 'Attach the latest report export and closure snapshot to executive review.'
          : 'Record at least one launch review, packet decision, report export, or closure snapshot before approval.',
      required: true,
      reference: 'Evidence Ledger',
    },
  ]
  const checklist = checklistItems.sort((a, b) => statusRank(b.status) - statusRank(a.status) || Number(b.required) - Number(a.required))

  const requiredItems = checklist.filter(item => item.required)
  const blockedCount = checklist.filter(item => item.status === 'Blocked').length
  const reviewCount = checklist.filter(item => item.status === 'Needs Review').length
  const completeRequiredCount = requiredItems.filter(item => item.status === 'Complete').length
  const decision = blockedCount ? 'No Go' : reviewCount ? 'Conditional Go' : 'Go'

  return {
    decision,
    summary: getClosureSummary(decision, blockedCount, reviewCount),
    generatedAt,
    checklist,
    requiredCount: requiredItems.length,
    completeRequiredCount,
    reviewCount,
    blockedCount,
    requiredApprovalCount: requiredGates.length,
    missingApprovalCount: missingApprovals.length,
    unresolvedDeferralCount,
    evidenceItemCount: evidenceLedger.entries.length,
    openActionCount: openActions.length,
    readyForExecutiveSignOff: decision === 'Go',
  }
}

export function getLaunchClosureDecisionTone(decision: LaunchClosureDecision): 'ok' | 'warn' | 'danger' {
  if (decision === 'No Go') return 'danger'
  if (decision === 'Conditional Go') return 'warn'
  return 'ok'
}

export function getLaunchClosureItemTone(status: LaunchClosureItemStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Review') return 'warn'
  return 'ok'
}

function statusFromLaunchStatus(status: LaunchGateStatus): LaunchClosureItemStatus {
  if (status === 'Blocked') return 'Blocked'
  if (status === 'Watch') return 'Needs Review'
  return 'Complete'
}

function getClosureSummary(decision: LaunchClosureDecision, blockedCount: number, reviewCount: number) {
  if (decision === 'No Go') return `${blockedCount} closure blockers must be cleared before launch approval.`
  if (decision === 'Conditional Go') return `${reviewCount} closure items need owner review before final approval.`
  return 'All required closure checks are complete for executive launch approval.'
}

function statusRank(status: LaunchClosureItemStatus) {
  if (status === 'Blocked') return 3
  if (status === 'Needs Review') return 2
  return 1
}
