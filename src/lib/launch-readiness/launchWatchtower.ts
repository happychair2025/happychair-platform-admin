import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformReadViewDiagnostic } from '../platform-data/PlatformDataContext'
import type { LaunchArtifactManifestModel } from './launchArtifactManifest'
import type { LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchHandoffApproval } from './launchHandoffApprovals'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'

export type LaunchWatchStatus = 'Stable' | 'Drift' | 'Critical Drift'
export type LaunchWatchSignalStatus = 'Stable' | 'Watch' | 'Critical'
export type LaunchWatchSignalType = 'Approval Baseline' | 'Readiness Drift' | 'Manifest Drift' | 'Follow-Up Backlog' | 'Action Queue' | 'Read Contract'

export interface LaunchWatchSignal {
  id: string
  type: LaunchWatchSignalType
  status: LaunchWatchSignalStatus
  owner: string
  reference: string
  evidence: string
  nextStep: string
  createdAt: string
}

export interface LaunchWatchModel {
  status: LaunchWatchStatus
  summary: string
  generatedAt: string
  signals: LaunchWatchSignal[]
  criticalCount: number
  watchCount: number
  stableCount: number
  baselineApproval?: LaunchHandoffApproval
  scoreDrift: number
}

export interface LaunchWatchCheck {
  id: string
  status: LaunchWatchStatus
  summary: string
  readinessScore: number
  launchStatus: LaunchGateStatus
  manifestStatus: LaunchArtifactManifestModel['status']
  baselineApprovalId?: string
  baselineDecision?: LaunchHandoffApproval['decision']
  criticalCount: number
  watchCount: number
  scoreDrift: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchWatchtowerInput {
  readinessModel: LaunchReadinessModel
  manifest: LaunchArtifactManifestModel
  followUpRegister: LaunchFollowUpRegisterModel
  latestHandoffApproval?: LaunchHandoffApproval
  actionRequests: AdminActionRequest[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
}

interface SaveLaunchWatchCheckInput {
  watchModel: LaunchWatchModel
  readinessModel: LaunchReadinessModel
  manifest: LaunchArtifactManifestModel
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_watch_checks'
const listeners = new Set<() => void>()
const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])
let cachedRawChecks = ''
let cachedChecks: LaunchWatchCheck[] = []

export function buildLaunchWatchtower({
  readinessModel,
  manifest,
  followUpRegister,
  latestHandoffApproval,
  actionRequests,
  readViewDiagnostics,
}: BuildLaunchWatchtowerInput): LaunchWatchModel {
  const generatedAt = new Date().toISOString()
  const openActions = actionRequests.filter(request => openActionStatuses.has(request.status))
  const blockedActions = openActions.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const fallbackViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')
  const scoreDrift = latestHandoffApproval ? readinessModel.score - latestHandoffApproval.readinessScore : 0

  const signals: LaunchWatchSignal[] = [
    approvalSignal(latestHandoffApproval, generatedAt),
    readinessSignal(readinessModel, latestHandoffApproval, scoreDrift, generatedAt),
    manifestSignal(manifest, latestHandoffApproval, generatedAt),
    followUpSignal(followUpRegister, generatedAt),
    actionQueueSignal(openActions.length, blockedActions.length, generatedAt),
    readContractSignal(fallbackViews, readViewDiagnostics, generatedAt),
  ].sort((a, b) => statusRank(b.status) - statusRank(a.status))

  const criticalCount = signals.filter(signal => signal.status === 'Critical').length
  const watchCount = signals.filter(signal => signal.status === 'Watch').length
  const status: LaunchWatchStatus = criticalCount ? 'Critical Drift' : watchCount ? 'Drift' : 'Stable'

  return {
    status,
    summary: getWatchSummary(status, criticalCount, watchCount),
    generatedAt,
    signals,
    criticalCount,
    watchCount,
    stableCount: signals.filter(signal => signal.status === 'Stable').length,
    baselineApproval: latestHandoffApproval,
    scoreDrift,
  }
}

export function getLaunchWatchChecks(): LaunchWatchCheck[] {
  if (typeof localStorage === 'undefined') return []
  const rawChecks = localStorage.getItem(storageKey) ?? '[]'
  if (rawChecks === cachedRawChecks) return cachedChecks

  try {
    cachedRawChecks = rawChecks
    cachedChecks = JSON.parse(rawChecks) as LaunchWatchCheck[]
    return cachedChecks
  } catch {
    cachedRawChecks = rawChecks
    cachedChecks = []
    return []
  }
}

export function saveLaunchWatchCheck(input: SaveLaunchWatchCheckInput) {
  const check: LaunchWatchCheck = {
    id: crypto.randomUUID(),
    status: input.watchModel.status,
    summary: input.watchModel.summary,
    readinessScore: input.readinessModel.score,
    launchStatus: input.readinessModel.status,
    manifestStatus: input.manifest.status,
    baselineApprovalId: input.watchModel.baselineApproval?.id,
    baselineDecision: input.watchModel.baselineApproval?.decision,
    criticalCount: input.watchModel.criticalCount,
    watchCount: input.watchModel.watchCount,
    scoreDrift: input.watchModel.scoreDrift,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const checks = [check, ...getLaunchWatchChecks()].slice(0, 80)

  cachedChecks = checks
  cachedRawChecks = JSON.stringify(checks)
  localStorage.setItem(storageKey, cachedRawChecks)
  emitLaunchWatchCheckChange()
  return check
}

export function subscribeToLaunchWatchChecks(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchWatchChecks() {
  return useSyncExternalStore(subscribeToLaunchWatchChecks, getLaunchWatchChecks, () => [])
}

export function getLaunchWatchTone(status: LaunchWatchStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Stable') return 'ok'
  if (status === 'Drift') return 'warn'
  return 'danger'
}

export function getLaunchWatchSignalTone(status: LaunchWatchSignalStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Stable') return 'ok'
  if (status === 'Watch') return 'warn'
  return 'danger'
}

function approvalSignal(
  latestHandoffApproval: LaunchHandoffApproval | undefined,
  generatedAt: string,
): LaunchWatchSignal {
  if (!latestHandoffApproval) {
    return {
      id: 'watch-approval-missing',
      type: 'Approval Baseline',
      status: 'Critical',
      owner: 'Owner',
      reference: 'Handoff Approval',
      evidence: 'No owner handoff approval has been recorded.',
      nextStep: 'Record an approval, conditional approval, or hold before launch watch can use a baseline.',
      createdAt: generatedAt,
    }
  }

  if (latestHandoffApproval.decision === 'Held') {
    return {
      id: 'watch-approval-held',
      type: 'Approval Baseline',
      status: 'Critical',
      owner: latestHandoffApproval.followUpOwner,
      reference: 'Handoff Approval',
      evidence: `Latest approval is Held: ${latestHandoffApproval.conditionNote}`,
      nextStep: latestHandoffApproval.acceptedRisk,
      createdAt: latestHandoffApproval.recordedAt,
    }
  }

  if (latestHandoffApproval.decision === 'Approved With Conditions') {
    return {
      id: 'watch-approval-conditions',
      type: 'Approval Baseline',
      status: 'Watch',
      owner: latestHandoffApproval.followUpOwner,
      reference: 'Handoff Approval',
      evidence: latestHandoffApproval.conditionNote,
      nextStep: 'Keep conditional follow-up visible until all launch conditions are resolved.',
      createdAt: latestHandoffApproval.recordedAt,
    }
  }

  return {
    id: 'watch-approval-stable',
    type: 'Approval Baseline',
    status: 'Stable',
    owner: latestHandoffApproval.followUpOwner,
    reference: 'Handoff Approval',
    evidence: `Approved at ${latestHandoffApproval.readinessScore}% readiness.`,
    nextStep: 'Continue monitoring for drift from the approved launch posture.',
    createdAt: latestHandoffApproval.recordedAt,
  }
}

function readinessSignal(
  readinessModel: LaunchReadinessModel,
  latestHandoffApproval: LaunchHandoffApproval | undefined,
  scoreDrift: number,
  generatedAt: string,
): LaunchWatchSignal {
  if (!latestHandoffApproval) {
    return {
      id: 'watch-readiness-no-baseline',
      type: 'Readiness Drift',
      status: readinessModel.status === 'Blocked' ? 'Critical' : 'Watch',
      owner: 'Owner',
      reference: 'Launch Gate',
      evidence: `${readinessModel.score}% readiness with no approval baseline.`,
      nextStep: 'Record a handoff approval baseline before treating launch posture as stable.',
      createdAt: readinessModel.generatedAt,
    }
  }

  const becameBlocked = latestHandoffApproval.launchStatus !== 'Blocked' && readinessModel.status === 'Blocked'
  const scoreDroppedHard = scoreDrift <= -10
  const scoreDropped = scoreDrift < 0
  const status = becameBlocked || scoreDroppedHard ? 'Critical' : scoreDropped || readinessModel.status !== latestHandoffApproval.launchStatus ? 'Watch' : 'Stable'

  return {
    id: 'watch-readiness-drift',
    type: 'Readiness Drift',
    status,
    owner: 'Owner',
    reference: 'Launch Gate',
    evidence: `${readinessModel.score}% now vs ${latestHandoffApproval.readinessScore}% at approval (${formatSigned(scoreDrift)} pts).`,
    nextStep: status === 'Stable'
      ? 'Keep monitoring readiness through launch.'
      : 'Review changed launch gates and decide whether approval must be refreshed.',
    createdAt: generatedAt,
  }
}

function manifestSignal(
  manifest: LaunchArtifactManifestModel,
  latestHandoffApproval: LaunchHandoffApproval | undefined,
  generatedAt: string,
): LaunchWatchSignal {
  if (!latestHandoffApproval) {
    return {
      id: 'watch-manifest-no-baseline',
      type: 'Manifest Drift',
      status: manifest.status === 'Incomplete' ? 'Critical' : 'Watch',
      owner: 'Owner',
      reference: 'Artifact Manifest',
      evidence: `${manifest.status} with no approval baseline.`,
      nextStep: 'Record a handoff approval baseline once the manifest is ready for owner review.',
      createdAt: manifest.generatedAt,
    }
  }

  const degradedFromApproval = latestHandoffApproval.manifestStatus === 'Ready For Handoff' && manifest.status !== 'Ready For Handoff'
  const status: LaunchWatchSignalStatus = manifest.status === 'Incomplete'
    ? 'Critical'
    : degradedFromApproval || manifest.status !== latestHandoffApproval.manifestStatus ? 'Watch' : 'Stable'

  return {
    id: 'watch-manifest-drift',
    type: 'Manifest Drift',
    status,
    owner: 'Owner',
    reference: 'Artifact Manifest',
    evidence: `${manifest.status} now vs ${latestHandoffApproval.manifestStatus} at approval.`,
    nextStep: status === 'Stable'
      ? 'Keep the artifact packet attached to launch monitoring.'
      : 'Refresh the manifest export or revisit handoff approval before launch proceeds.',
    createdAt: generatedAt,
  }
}

function followUpSignal(
  followUpRegister: LaunchFollowUpRegisterModel,
  generatedAt: string,
): LaunchWatchSignal {
  const activeCount = followUpRegister.openCount + followUpRegister.inProgressCount
  const status: LaunchWatchSignalStatus = followUpRegister.blockedCount ? 'Critical' : activeCount ? 'Watch' : 'Stable'

  return {
    id: 'watch-follow-up-backlog',
    type: 'Follow-Up Backlog',
    status,
    owner: followUpRegister.nextItem?.owner ?? 'Owner',
    reference: 'Follow-Up Register',
    evidence: `${activeCount} active, ${followUpRegister.blockedCount} blocked, ${followUpRegister.resolvedCount} resolved.`,
    nextStep: followUpRegister.nextItem?.nextStep ?? 'No unresolved launch follow-up is waiting.',
    createdAt: followUpRegister.generatedAt ?? generatedAt,
  }
}

function actionQueueSignal(openActionCount: number, blockedActionCount: number, generatedAt: string): LaunchWatchSignal {
  const status: LaunchWatchSignalStatus = blockedActionCount ? 'Critical' : openActionCount ? 'Watch' : 'Stable'
  return {
    id: 'watch-action-queue',
    type: 'Action Queue',
    status,
    owner: 'Operations',
    reference: 'Admin Action Requests',
    evidence: `${openActionCount} open action requests, ${blockedActionCount} blocked or failed.`,
    nextStep: status === 'Stable'
      ? 'No open action queue drift is blocking launch watch.'
      : 'Clear or explicitly defer action requests before considering watch stable.',
    createdAt: generatedAt,
  }
}

function readContractSignal(
  fallbackViews: PlatformReadViewDiagnostic[],
  readViewDiagnostics: PlatformReadViewDiagnostic[],
  generatedAt: string,
): LaunchWatchSignal {
  return {
    id: 'watch-read-contracts',
    type: 'Read Contract',
    status: fallbackViews.length ? 'Critical' : 'Stable',
    owner: 'Engineering',
    reference: 'Read View Diagnostics',
    evidence: `${readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready').length} ready views, ${fallbackViews.length} fallback views.`,
    nextStep: fallbackViews[0]?.error ?? 'Read-only diagnostics are stable for launch watch.',
    createdAt: fallbackViews[0]?.loadedAt ?? generatedAt,
  }
}

function getWatchSummary(status: LaunchWatchStatus, criticalCount: number, watchCount: number) {
  if (status === 'Critical Drift') return `${criticalCount} critical launch watch signals require owner review.`
  if (status === 'Drift') return `${watchCount} launch watch signals need follow-up before posture is stable.`
  return 'Launch watch is stable against the current handoff baseline.'
}

function statusRank(status: LaunchWatchSignalStatus) {
  if (status === 'Critical') return 3
  if (status === 'Watch') return 2
  return 1
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function emitLaunchWatchCheckChange() {
  listeners.forEach(listener => listener())
}
