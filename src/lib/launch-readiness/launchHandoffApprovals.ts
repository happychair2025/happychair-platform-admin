import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { LaunchArtifactManifestModel } from './launchArtifactManifest'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchExecutiveBriefModel } from './launchExecutiveBrief'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'

export type LaunchHandoffDecision = 'Approved' | 'Approved With Conditions' | 'Held'

export interface LaunchHandoffApproval {
  id: string
  decision: LaunchHandoffDecision
  manifestStatus: LaunchArtifactManifestModel['status']
  executiveRecommendation: LaunchExecutiveBriefModel['recommendation']
  closureDecision: LaunchClosureModel['decision']
  readinessScore: number
  launchStatus: LaunchGateStatus
  requiredReadyCount: number
  requiredCount: number
  handoffGapCount: number
  blockerCount: number
  reviewCount: number
  conditionNote: string
  acceptedRisk: string
  followUpOwner: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface SaveLaunchHandoffApprovalInput {
  decision: LaunchHandoffDecision
  conditionNote: string
  acceptedRisk: string
  followUpOwner: string
  manifest: LaunchArtifactManifestModel
  executiveBrief: LaunchExecutiveBriefModel
  closureModel: LaunchClosureModel
  readinessModel: LaunchReadinessModel
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_handoff_approvals'
const listeners = new Set<() => void>()
let cachedRawApprovals = ''
let cachedApprovals: LaunchHandoffApproval[] = []

export const launchHandoffDecisions: LaunchHandoffDecision[] = ['Approved', 'Approved With Conditions', 'Held']

export function getLaunchHandoffApprovals(): LaunchHandoffApproval[] {
  if (typeof localStorage === 'undefined') return []
  const rawApprovals = localStorage.getItem(storageKey) ?? '[]'
  if (rawApprovals === cachedRawApprovals) return cachedApprovals

  try {
    cachedRawApprovals = rawApprovals
    cachedApprovals = JSON.parse(rawApprovals) as LaunchHandoffApproval[]
    return cachedApprovals
  } catch {
    cachedRawApprovals = rawApprovals
    cachedApprovals = []
    return []
  }
}

export function saveLaunchHandoffApproval(input: SaveLaunchHandoffApprovalInput) {
  const approval: LaunchHandoffApproval = {
    id: crypto.randomUUID(),
    decision: input.decision,
    manifestStatus: input.manifest.status,
    executiveRecommendation: input.executiveBrief.recommendation,
    closureDecision: input.closureModel.decision,
    readinessScore: input.readinessModel.score,
    launchStatus: input.readinessModel.status,
    requiredReadyCount: input.manifest.readyRequiredCount,
    requiredCount: input.manifest.requiredCount,
    handoffGapCount: input.manifest.gaps.length,
    blockerCount: input.manifest.blockedCount,
    reviewCount: input.manifest.reviewCount,
    conditionNote: input.conditionNote.trim() || getDefaultConditionNote(input.decision, input.manifest),
    acceptedRisk: input.acceptedRisk.trim() || getDefaultAcceptedRisk(input.decision),
    followUpOwner: input.followUpOwner,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const approvals = [approval, ...getLaunchHandoffApprovals()].slice(0, 80)

  cachedApprovals = approvals
  cachedRawApprovals = JSON.stringify(approvals)
  localStorage.setItem(storageKey, cachedRawApprovals)
  emitLaunchHandoffApprovalChange()
  return approval
}

export function subscribeToLaunchHandoffApprovals(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchHandoffApprovals() {
  return useSyncExternalStore(subscribeToLaunchHandoffApprovals, getLaunchHandoffApprovals, () => [])
}

export function getSuggestedHandoffDecision(manifestStatus: LaunchArtifactManifestModel['status']): LaunchHandoffDecision {
  if (manifestStatus === 'Ready For Handoff') return 'Approved'
  if (manifestStatus === 'Needs Owner Review') return 'Approved With Conditions'
  return 'Held'
}

export function getLaunchHandoffDecisionTone(decision: LaunchHandoffDecision): 'ok' | 'warn' | 'danger' {
  if (decision === 'Approved') return 'ok'
  if (decision === 'Approved With Conditions') return 'warn'
  return 'danger'
}

function getDefaultConditionNote(decision: LaunchHandoffDecision, manifest: LaunchArtifactManifestModel) {
  if (decision === 'Approved') return 'Approved for launch handoff with current manifest, evidence, and audit trail attached.'
  if (decision === 'Approved With Conditions') return `${manifest.reviewCount} review items must remain owner-tracked after launch handoff.`
  return `${manifest.blockedCount + manifest.missingRequiredCount} blocked or missing required artifacts must be cleared before launch handoff.`
}

function getDefaultAcceptedRisk(decision: LaunchHandoffDecision) {
  if (decision === 'Approved') return 'No additional launch risk accepted beyond the current manifest record.'
  if (decision === 'Approved With Conditions') return 'Conditional approval requires visible owner follow-up and no silent production mutation.'
  return 'No launch risk accepted while handoff is held.'
}

function emitLaunchHandoffApprovalChange() {
  listeners.forEach(listener => listener())
}
