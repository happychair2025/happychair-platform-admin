import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type {
  DataStatus,
  PlatformDataSourceKind,
  PlatformReadViewDiagnostic,
} from '../platform-data/PlatformDataContext'
import type { LaunchCommandModeModel } from './launchCommandMode'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchClosureSnapshot } from './launchClosureSnapshots'
import type { LaunchDecisionPacket } from './launchDecisionPackets'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchExecutiveBriefModel, LaunchExecutiveBriefRecommendation } from './launchExecutiveBrief'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'
import type { LaunchGateSignOff } from './launchSignOffs'

export type LaunchArtifactManifestStatus = 'Ready For Handoff' | 'Needs Owner Review' | 'Incomplete'
export type LaunchArtifactStatus = 'Ready' | 'Needs Review' | 'Missing' | 'Blocked'
export type LaunchArtifactType = 'Report' | 'Brief' | 'Snapshot' | 'Packet Set' | 'Evidence' | 'Approval' | 'Data Contract' | 'Action Queue' | 'Checklist'
export type LaunchArtifactTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

export interface LaunchArtifactManifestItem {
  id: string
  type: LaunchArtifactType
  title: string
  status: LaunchArtifactStatus
  required: boolean
  owner: string
  reference: string
  evidence: string
  nextStep: string
  updatedAt: string
  exportable: boolean
  auditBacked: boolean
}

export interface LaunchArtifactManifestGap {
  id: string
  title: string
  severity: 'Blocker' | 'Review'
  owner: string
  reference: string
  nextStep: string
}

export interface LaunchArtifactManifestModel {
  status: LaunchArtifactManifestStatus
  summary: string
  generatedAt: string
  artifacts: LaunchArtifactManifestItem[]
  gaps: LaunchArtifactManifestGap[]
  requiredCount: number
  readyRequiredCount: number
  missingRequiredCount: number
  blockedCount: number
  reviewCount: number
  exportableCount: number
  auditBackedCount: number
  latestSnapshot?: LaunchClosureSnapshot
}

interface BuildLaunchArtifactManifestInput {
  readinessModel: LaunchReadinessModel
  closureModel: LaunchClosureModel
  commandMode: LaunchCommandModeModel
  evidenceLedger: LaunchEvidenceLedger
  executiveBrief: LaunchExecutiveBriefModel
  decisionPackets: LaunchDecisionPacket[]
  closureSnapshots: LaunchClosureSnapshot[]
  signOffs: LaunchGateSignOff[]
  actionRequests: AdminActionRequest[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  sourceLabel: string
  dataSourceKind: PlatformDataSourceKind
  dataStatus: DataStatus
}

const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildLaunchArtifactManifest({
  readinessModel,
  closureModel,
  commandMode,
  evidenceLedger,
  executiveBrief,
  decisionPackets,
  closureSnapshots,
  signOffs,
  actionRequests,
  readViewDiagnostics,
  sourceLabel,
  dataSourceKind,
  dataStatus,
}: BuildLaunchArtifactManifestInput): LaunchArtifactManifestModel {
  const generatedAt = new Date().toISOString()
  const latestSnapshot = closureSnapshots[0]
  const openActions = actionRequests.filter(request => openActionStatuses.has(request.status))
  const blockedActions = openActions.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const unresolvedPackets = decisionPackets.filter(packet => packet.status === 'Drafted' || packet.status === 'Queued For Review')
  const deferredPackets = decisionPackets.filter(packet => packet.status === 'Deferred')
  const approvedPackets = decisionPackets.filter(packet => packet.status === 'Approved For Follow-Up' || packet.status === 'Assigned Follow-Up')
  const requiredGateCount = readinessModel.gates.filter(gate => gate.status !== 'Ready').length
  const resolvedSignOffCount = signOffs.filter(signOff => signOff.decision === 'Approved' || signOff.decision === 'Resolved').length
  const readyViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready')
  const fallbackViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')

  const artifacts: LaunchArtifactManifestItem[] = [
    {
      id: 'artifact-launch-review-report',
      type: 'Report',
      title: 'Launch Review Report',
      status: statusFromLaunchStatus(readinessModel.status),
      required: true,
      owner: 'Owner',
      reference: 'Launch Gate',
      evidence: `${readinessModel.score}% readiness with ${readinessModel.readyCount} ready, ${readinessModel.watchCount} watch, and ${readinessModel.blockedCount} blocked gates.`,
      nextStep: readinessModel.status === 'Ready' ? 'Attach the latest launch report to the owner approval record.' : readinessModel.summary,
      updatedAt: readinessModel.generatedAt,
      exportable: true,
      auditBacked: evidenceLedger.exportCount > 0,
    },
    {
      id: 'artifact-executive-brief',
      type: 'Brief',
      title: 'Executive Launch Brief',
      status: statusFromRecommendation(executiveBrief.recommendation),
      required: true,
      owner: 'Owner',
      reference: 'Executive Brief',
      evidence: executiveBrief.headline,
      nextStep: executiveBrief.recommendation === 'Proceed'
        ? 'Keep this brief with the final launch packet.'
        : 'Use the required owner decisions in the brief to clear launch approval.',
      updatedAt: executiveBrief.generatedAt,
      exportable: true,
      auditBacked: evidenceLedger.entries.some(entry => entry.evidence.includes('executive launch brief')),
    },
    {
      id: 'artifact-closure-snapshot',
      type: 'Snapshot',
      title: 'Latest Closure Snapshot',
      status: latestSnapshot ? statusFromClosureDecision(latestSnapshot.decision) : 'Missing',
      required: true,
      owner: 'Owner',
      reference: 'Closure Snapshot Ledger',
      evidence: latestSnapshot
        ? `${latestSnapshot.decision} recorded by ${latestSnapshot.recordedByRole} with ${latestSnapshot.completeRequiredCount}/${latestSnapshot.requiredCount} required checks complete.`
        : 'No closure snapshot has been recorded.',
      nextStep: latestSnapshot
        ? 'Export or retain the latest closure snapshot with the final handoff packet.'
        : 'Record a closure snapshot before executive handoff.',
      updatedAt: latestSnapshot?.recordedAt ?? closureModel.generatedAt,
      exportable: Boolean(latestSnapshot),
      auditBacked: Boolean(latestSnapshot?.auditEventId),
    },
    {
      id: 'artifact-decision-packets',
      type: 'Packet Set',
      title: 'Decision Packet Set',
      status: getPacketSetStatus(commandMode.decisionCount, decisionPackets),
      required: true,
      owner: 'Owner',
      reference: 'Decision Packets',
      evidence: `${approvedPackets.length} approved or assigned, ${unresolvedPackets.length} awaiting review, ${deferredPackets.length} deferred.`,
      nextStep: deferredPackets[0]
        ? `Clear deferred packet: ${deferredPackets[0].title}.`
        : unresolvedPackets[0]
          ? `Approve, assign, or defer packet: ${unresolvedPackets[0].title}.`
          : !decisionPackets.length && commandMode.decisionCount
            ? 'Create decision packets for unresolved launch decisions.'
            : 'Keep packet exports available for final review.',
      updatedAt: getLatestPacketUpdate(decisionPackets) ?? readinessModel.generatedAt,
      exportable: decisionPackets.length > 0,
      auditBacked: decisionPackets.some(packet => Boolean(packet.auditEventId)),
    },
    {
      id: 'artifact-evidence-ledger',
      type: 'Evidence',
      title: 'Evidence Ledger',
      status: evidenceLedger.blockedCount
        ? 'Blocked'
        : evidenceLedger.entries.length && evidenceLedger.auditEventCount ? 'Ready' : 'Needs Review',
      required: true,
      owner: 'Owner',
      reference: 'Evidence Ledger',
      evidence: `${evidenceLedger.entries.length} evidence items, ${evidenceLedger.auditEventCount} audit events, ${evidenceLedger.signOffCount} sign-offs, and ${evidenceLedger.packetCount} packet records.`,
      nextStep: evidenceLedger.blockedCount
        ? 'Resolve blocked evidence before final handoff.'
        : evidenceLedger.auditEventCount
          ? 'Keep the ledger attached to the manifest.'
          : 'Record at least one launch review, export, sign-off, packet decision, or closure snapshot.',
      updatedAt: evidenceLedger.entries[0]?.createdAt ?? generatedAt,
      exportable: false,
      auditBacked: evidenceLedger.auditEventCount > 0,
    },
    {
      id: 'artifact-owner-signoffs',
      type: 'Approval',
      title: 'Owner Sign-Offs',
      status: closureModel.missingApprovalCount
        ? readinessModel.blockedCount ? 'Blocked' : 'Needs Review'
        : 'Ready',
      required: true,
      owner: 'Owner',
      reference: 'Owner Sign-Offs',
      evidence: `${resolvedSignOffCount} resolved or approved sign-offs. ${closureModel.missingApprovalCount} required approvals missing across ${requiredGateCount} non-ready gates.`,
      nextStep: closureModel.missingApprovalCount
        ? 'Record approval, resolution, or dated follow-up for each non-ready launch gate.'
        : 'Keep sign-off decisions visible in the evidence ledger.',
      updatedAt: signOffs[0]?.createdAt ?? closureModel.generatedAt,
      exportable: false,
      auditBacked: signOffs.some(signOff => Boolean(signOff.auditEventId)),
    },
    {
      id: 'artifact-action-queue',
      type: 'Action Queue',
      title: 'Admin Action Queue State',
      status: blockedActions.length ? 'Blocked' : openActions.length ? 'Needs Review' : 'Ready',
      required: true,
      owner: 'Operations',
      reference: 'Action Requests',
      evidence: `${openActions.length} open action requests, ${blockedActions.length} blocked or failed.`,
      nextStep: blockedActions[0]?.statusReason ?? (openActions[0] ? `Review ${openActions[0].title} before final handoff.` : 'No open action requests are blocking the handoff packet.'),
      updatedAt: openActions[0]?.updatedAt ?? openActions[0]?.createdAt ?? generatedAt,
      exportable: false,
      auditBacked: actionRequests.some(request => Boolean(request.auditEventId)),
    },
    {
      id: 'artifact-read-contracts',
      type: 'Data Contract',
      title: 'Read Contract Diagnostics',
      status: getReadContractStatus(fallbackViews.length, readyViews.length, dataSourceKind, dataStatus),
      required: true,
      owner: 'Engineering',
      reference: 'Read View Diagnostics',
      evidence: `${readyViews.length} ready read views, ${fallbackViews.length} fallback views. Source: ${sourceLabel} / ${dataSourceKind} / ${dataStatus}.`,
      nextStep: fallbackViews[0]?.error ?? (dataSourceKind === 'mock' || dataStatus === 'mock'
        ? 'Confirm mock-read handoff status or connect approved read-only views before production launch.'
        : 'Keep read diagnostics monitored through launch handoff.'),
      updatedAt: readViewDiagnostics[0]?.loadedAt ?? generatedAt,
      exportable: false,
      auditBacked: false,
    },
    {
      id: 'artifact-closure-checklist',
      type: 'Checklist',
      title: 'Closure Checklist',
      status: closureModel.decision === 'No Go'
        ? 'Blocked'
        : closureModel.decision === 'Conditional Go' ? 'Needs Review' : 'Ready',
      required: true,
      owner: 'Owner',
      reference: 'Launch Closure',
      evidence: `${closureModel.completeRequiredCount}/${closureModel.requiredCount} required checks complete, ${closureModel.blockedCount} blocked, ${closureModel.reviewCount} needs review.`,
      nextStep: closureModel.readyForExecutiveSignOff
        ? 'Attach the closure checklist to executive approval.'
        : closureModel.summary,
      updatedAt: closureModel.generatedAt,
      exportable: true,
      auditBacked: Boolean(latestSnapshot?.auditEventId),
    },
  ]

  const sortedArtifacts = artifacts.sort((a, b) => statusRank(b.status) - statusRank(a.status) || Number(b.required) - Number(a.required))
  const requiredArtifacts = sortedArtifacts.filter(artifact => artifact.required)
  const blockedCount = sortedArtifacts.filter(artifact => artifact.status === 'Blocked').length
  const reviewCount = sortedArtifacts.filter(artifact => artifact.status === 'Needs Review').length
  const missingRequiredCount = requiredArtifacts.filter(artifact => artifact.status === 'Missing').length
  const readyRequiredCount = requiredArtifacts.filter(artifact => artifact.status === 'Ready').length
  const gaps = sortedArtifacts
    .filter(artifact => artifact.required && artifact.status !== 'Ready')
    .map<LaunchArtifactManifestGap>(artifact => ({
      id: `gap-${artifact.id}`,
      title: artifact.title,
      severity: artifact.status === 'Blocked' || artifact.status === 'Missing' ? 'Blocker' : 'Review',
      owner: artifact.owner,
      reference: artifact.reference,
      nextStep: artifact.nextStep,
    }))
  const status = getManifestStatus(blockedCount, missingRequiredCount, reviewCount, readyRequiredCount, requiredArtifacts.length)

  return {
    status,
    summary: getManifestSummary(status, blockedCount, missingRequiredCount, reviewCount),
    generatedAt,
    artifacts: sortedArtifacts,
    gaps,
    requiredCount: requiredArtifacts.length,
    readyRequiredCount,
    missingRequiredCount,
    blockedCount,
    reviewCount,
    exportableCount: sortedArtifacts.filter(artifact => artifact.exportable).length,
    auditBackedCount: sortedArtifacts.filter(artifact => artifact.auditBacked).length,
    latestSnapshot,
  }
}

export function getLaunchArtifactManifestTone(status: LaunchArtifactManifestStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Ready For Handoff') return 'ok'
  if (status === 'Needs Owner Review') return 'warn'
  return 'danger'
}

export function getLaunchArtifactStatusTone(status: LaunchArtifactStatus): LaunchArtifactTone {
  if (status === 'Ready') return 'ok'
  if (status === 'Needs Review') return 'warn'
  if (status === 'Blocked' || status === 'Missing') return 'danger'
  return 'neutral'
}

function getManifestStatus(
  blockedCount: number,
  missingRequiredCount: number,
  reviewCount: number,
  readyRequiredCount: number,
  requiredCount: number,
): LaunchArtifactManifestStatus {
  if (blockedCount || missingRequiredCount) return 'Incomplete'
  if (reviewCount || readyRequiredCount < requiredCount) return 'Needs Owner Review'
  return 'Ready For Handoff'
}

function getManifestSummary(
  status: LaunchArtifactManifestStatus,
  blockedCount: number,
  missingRequiredCount: number,
  reviewCount: number,
) {
  if (status === 'Incomplete') return `${blockedCount + missingRequiredCount} required launch artifacts are blocked or missing before handoff.`
  if (status === 'Needs Owner Review') return `${reviewCount} launch artifacts need owner review before the packet is final.`
  return 'All required launch artifacts are ready for executive handoff.'
}

function statusFromLaunchStatus(status: LaunchGateStatus): LaunchArtifactStatus {
  if (status === 'Blocked') return 'Blocked'
  if (status === 'Watch') return 'Needs Review'
  return 'Ready'
}

function statusFromRecommendation(recommendation: LaunchExecutiveBriefRecommendation): LaunchArtifactStatus {
  if (recommendation === 'Hold') return 'Blocked'
  if (recommendation === 'Proceed With Conditions') return 'Needs Review'
  return 'Ready'
}

function statusFromClosureDecision(decision: string): LaunchArtifactStatus {
  if (decision === 'No Go') return 'Blocked'
  if (decision === 'Conditional Go') return 'Needs Review'
  return 'Ready'
}

function getPacketSetStatus(commandDecisionCount: number, packets: LaunchDecisionPacket[]): LaunchArtifactStatus {
  if (packets.some(packet => packet.status === 'Deferred')) return 'Blocked'
  if (packets.some(packet => packet.status === 'Drafted' || packet.status === 'Queued For Review')) return 'Needs Review'
  if (!packets.length && commandDecisionCount > 0) return 'Missing'
  return 'Ready'
}

function getReadContractStatus(
  fallbackViewCount: number,
  readyViewCount: number,
  dataSourceKind: PlatformDataSourceKind,
  dataStatus: DataStatus,
): LaunchArtifactStatus {
  if (fallbackViewCount && !readyViewCount) return 'Blocked'
  if (fallbackViewCount || dataSourceKind === 'mock' || dataStatus === 'mock' || dataStatus === 'partial' || dataStatus === 'loading') return 'Needs Review'
  if (dataStatus === 'fallback') return 'Blocked'
  return 'Ready'
}

function getLatestPacketUpdate(packets: LaunchDecisionPacket[]) {
  return packets
    .map(packet => packet.updatedAt ?? packet.createdAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function statusRank(status: LaunchArtifactStatus) {
  if (status === 'Blocked' || status === 'Missing') return 4
  if (status === 'Needs Review') return 3
  if (status === 'Ready') return 2
  return 1
}
