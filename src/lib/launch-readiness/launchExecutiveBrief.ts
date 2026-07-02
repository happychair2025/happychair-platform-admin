import type { LaunchCommandModeModel } from './launchCommandMode'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchClosureSnapshot } from './launchClosureSnapshots'
import type { LaunchDecisionPacket } from './launchDecisionPackets'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'
import type { LaunchGateSignOff } from './launchSignOffs'

export type LaunchExecutiveBriefRecommendation = 'Proceed' | 'Proceed With Conditions' | 'Hold'
export type LaunchExecutiveBriefTone = 'ok' | 'warn' | 'danger' | 'neutral'

export interface LaunchExecutiveBriefPoint {
  id: string
  title: string
  body: string
  tone: LaunchExecutiveBriefTone
  owner: string
  reference: string
}

export interface LaunchExecutiveBriefSource {
  id: string
  label: string
  value: string
  tone: LaunchExecutiveBriefTone
}

export interface LaunchExecutiveBriefModel {
  recommendation: LaunchExecutiveBriefRecommendation
  headline: string
  narrative: string
  generatedAt: string
  talkingPoints: LaunchExecutiveBriefPoint[]
  requiredDecisions: LaunchExecutiveBriefPoint[]
  sources: LaunchExecutiveBriefSource[]
  blockerCount: number
  reviewCount: number
  packetCount: number
  snapshotCount: number
  latestSnapshot?: LaunchClosureSnapshot
}

interface BuildLaunchExecutiveBriefInput {
  readinessModel: LaunchReadinessModel
  closureModel: LaunchClosureModel
  commandMode: LaunchCommandModeModel
  evidenceLedger: LaunchEvidenceLedger
  decisionPackets: LaunchDecisionPacket[]
  closureSnapshots: LaunchClosureSnapshot[]
  signOffs: LaunchGateSignOff[]
  sourceLabel: string
  dataStatus: string
}

export function buildLaunchExecutiveBrief({
  readinessModel,
  closureModel,
  commandMode,
  evidenceLedger,
  decisionPackets,
  closureSnapshots,
  signOffs,
  sourceLabel,
  dataStatus,
}: BuildLaunchExecutiveBriefInput): LaunchExecutiveBriefModel {
  const latestSnapshot = closureSnapshots[0]
  const deferredPackets = decisionPackets.filter(packet => packet.status === 'Deferred')
  const unresolvedPackets = decisionPackets.filter(packet => packet.status === 'Drafted' || packet.status === 'Queued For Review')
  const approvedPackets = decisionPackets.filter(packet => packet.status === 'Approved For Follow-Up' || packet.status === 'Assigned Follow-Up')
  const deferredSignOffs = signOffs.filter(signOff => signOff.decision === 'Deferred')
  const recommendation = getRecommendation(closureModel.decision)
  const blockedClosureItems = closureModel.checklist.filter(item => item.status === 'Blocked')
  const reviewClosureItems = closureModel.checklist.filter(item => item.status === 'Needs Review')

  const talkingPoints: LaunchExecutiveBriefPoint[] = [
    {
      id: 'brief-readiness',
      title: 'Launch position',
      body: `${readinessModel.score}% readiness with ${readinessModel.blockedCount} blocked gates and ${readinessModel.watchCount} watch gates. ${readinessModel.summary}`,
      tone: toneFromLaunchStatus(readinessModel.status),
      owner: 'Owner',
      reference: 'Launch Gate',
    },
    {
      id: 'brief-closure',
      title: 'Closure recommendation',
      body: `${closureModel.decision}: ${closureModel.summary}`,
      tone: toneFromRecommendation(recommendation),
      owner: 'Owner',
      reference: 'Launch Closure',
    },
    {
      id: 'brief-packets',
      title: 'Decision packet posture',
      body: `${approvedPackets.length} packets are approved or assigned, ${unresolvedPackets.length} await review, and ${deferredPackets.length} are deferred.`,
      tone: deferredPackets.length ? 'danger' : unresolvedPackets.length ? 'warn' : approvedPackets.length ? 'ok' : 'neutral',
      owner: 'Owner',
      reference: 'Decision Packets',
    },
    {
      id: 'brief-evidence',
      title: 'Evidence trail',
      body: `${evidenceLedger.entries.length} evidence items, ${evidenceLedger.auditEventCount} audit events, ${evidenceLedger.signOffCount} sign-offs, and ${evidenceLedger.packetCount} packet records are available for review.`,
      tone: evidenceLedger.blockedCount ? 'danger' : evidenceLedger.auditEventCount ? 'ok' : 'warn',
      owner: 'Owner',
      reference: 'Evidence Ledger',
    },
    {
      id: 'brief-snapshot',
      title: 'Latest closure snapshot',
      body: latestSnapshot
        ? `${latestSnapshot.decision} recorded by ${latestSnapshot.recordedByRole} at ${formatShortDateTime(latestSnapshot.recordedAt)}.`
        : 'No closure snapshot has been recorded yet.',
      tone: latestSnapshot ? toneFromRecommendation(getRecommendation(latestSnapshot.decision)) : 'warn',
      owner: 'Owner',
      reference: 'Closure Snapshot Ledger',
    },
  ]

  const requiredDecisions: LaunchExecutiveBriefPoint[] = [
    ...blockedClosureItems.map(item => ({
      id: `closure-${item.id}`,
      title: item.title,
      body: item.nextStep,
      tone: 'danger' as const,
      owner: item.owner,
      reference: item.reference,
    })),
    ...reviewClosureItems.map(item => ({
      id: `closure-${item.id}`,
      title: item.title,
      body: item.nextStep,
      tone: 'warn' as const,
      owner: item.owner,
      reference: item.reference,
    })),
    ...commandMode.items.slice(0, 5).map(item => ({
      id: `command-${item.id}`,
      title: item.title,
      body: item.nextDecision,
      tone: toneFromLaunchStatus(item.status),
      owner: item.owner,
      reference: item.reference,
    })),
  ].slice(0, 10)

  const sources: LaunchExecutiveBriefSource[] = [
    {
      id: 'source-readiness',
      label: 'Launch Gate',
      value: `${readinessModel.score}% / ${readinessModel.status}`,
      tone: toneFromLaunchStatus(readinessModel.status),
    },
    {
      id: 'source-closure',
      label: 'Closure Checklist',
      value: `${closureModel.completeRequiredCount}/${closureModel.requiredCount} required complete`,
      tone: closureModel.blockedCount ? 'danger' : closureModel.reviewCount ? 'warn' : 'ok',
    },
    {
      id: 'source-snapshot',
      label: 'Latest Snapshot',
      value: latestSnapshot ? `${latestSnapshot.decision} / ${formatShortDateTime(latestSnapshot.recordedAt)}` : 'Not recorded',
      tone: latestSnapshot ? toneFromRecommendation(getRecommendation(latestSnapshot.decision)) : 'warn',
    },
    {
      id: 'source-data',
      label: 'Data Source',
      value: `${sourceLabel} / ${dataStatus}`,
      tone: dataStatus === 'ready' ? 'ok' : dataStatus === 'fallback' ? 'danger' : 'warn',
    },
    {
      id: 'source-deferrals',
      label: 'Deferrals',
      value: `${deferredSignOffs.length + deferredPackets.length} unresolved`,
      tone: deferredSignOffs.length + deferredPackets.length ? 'warn' : 'ok',
    },
    {
      id: 'source-actions',
      label: 'Open Actions',
      value: `${closureModel.openActionCount} open`,
      tone: closureModel.openActionCount ? 'warn' : 'ok',
    },
  ]

  return {
    recommendation,
    headline: `${recommendation}: ${closureModel.summary}`,
    narrative: getNarrative(recommendation, readinessModel, closureModel),
    generatedAt: new Date().toISOString(),
    talkingPoints,
    requiredDecisions,
    sources,
    blockerCount: closureModel.blockedCount,
    reviewCount: closureModel.reviewCount,
    packetCount: decisionPackets.length,
    snapshotCount: closureSnapshots.length,
    latestSnapshot,
  }
}

export function getLaunchExecutiveBriefTone(recommendation: LaunchExecutiveBriefRecommendation): LaunchExecutiveBriefTone {
  return toneFromRecommendation(recommendation)
}

function getRecommendation(decision: string): LaunchExecutiveBriefRecommendation {
  if (decision === 'Go') return 'Proceed'
  if (decision === 'Conditional Go') return 'Proceed With Conditions'
  return 'Hold'
}

function getNarrative(
  recommendation: LaunchExecutiveBriefRecommendation,
  readinessModel: LaunchReadinessModel,
  closureModel: LaunchClosureModel,
) {
  if (recommendation === 'Proceed') {
    return `Launch is ready for executive approval with ${readinessModel.score}% readiness and all required closure checks complete.`
  }
  if (recommendation === 'Proceed With Conditions') {
    return `Launch can move forward only after owner review of ${closureModel.reviewCount} closure items and preservation of the current audit/evidence trail.`
  }
  return `Launch should remain on hold until ${closureModel.blockedCount} closure blockers and ${readinessModel.blockedCount} launch gate blockers are cleared.`
}

function toneFromRecommendation(recommendation: LaunchExecutiveBriefRecommendation): LaunchExecutiveBriefTone {
  if (recommendation === 'Hold') return 'danger'
  if (recommendation === 'Proceed With Conditions') return 'warn'
  return 'ok'
}

function toneFromLaunchStatus(status: LaunchGateStatus): LaunchExecutiveBriefTone {
  if (status === 'Blocked') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'ok'
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
