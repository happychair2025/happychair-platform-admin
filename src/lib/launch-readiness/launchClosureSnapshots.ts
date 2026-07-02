import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  DataStatus,
  PlatformDataSourceKind,
} from '../platform-data/PlatformDataContext'
import type {
  LaunchClosureChecklistItem,
  LaunchClosureDecision,
  LaunchClosureModel,
} from './launchClosureChecklist'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'

export interface LaunchClosureSnapshot {
  id: string
  decision: LaunchClosureDecision
  summary: string
  readinessScore: number
  launchStatus: LaunchGateStatus
  generatedAt: string
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
  sourceLabel: string
  dataSourceKind: PlatformDataSourceKind
  dataStatus: DataStatus
  checklist: LaunchClosureChecklistItem[]
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface SaveLaunchClosureSnapshotInput {
  closureModel: LaunchClosureModel
  readinessModel: LaunchReadinessModel
  session: AdminSession
  actorRole: string
  auditEventId: string
  sourceLabel: string
  dataSourceKind: PlatformDataSourceKind
  dataStatus: DataStatus
}

const storageKey = 'hc_platform_launch_closure_snapshots'
const listeners = new Set<() => void>()
let cachedRawSnapshots = ''
let cachedSnapshots: LaunchClosureSnapshot[] = []

export function getLaunchClosureSnapshots(): LaunchClosureSnapshot[] {
  if (typeof localStorage === 'undefined') return []
  const rawSnapshots = localStorage.getItem(storageKey) ?? '[]'
  if (rawSnapshots === cachedRawSnapshots) return cachedSnapshots

  try {
    cachedRawSnapshots = rawSnapshots
    cachedSnapshots = JSON.parse(rawSnapshots) as LaunchClosureSnapshot[]
    return cachedSnapshots
  } catch {
    cachedRawSnapshots = rawSnapshots
    cachedSnapshots = []
    return []
  }
}

export function saveLaunchClosureSnapshot(input: SaveLaunchClosureSnapshotInput) {
  const snapshot: LaunchClosureSnapshot = {
    id: crypto.randomUUID(),
    decision: input.closureModel.decision,
    summary: input.closureModel.summary,
    readinessScore: input.readinessModel.score,
    launchStatus: input.readinessModel.status,
    generatedAt: input.closureModel.generatedAt,
    requiredCount: input.closureModel.requiredCount,
    completeRequiredCount: input.closureModel.completeRequiredCount,
    reviewCount: input.closureModel.reviewCount,
    blockedCount: input.closureModel.blockedCount,
    requiredApprovalCount: input.closureModel.requiredApprovalCount,
    missingApprovalCount: input.closureModel.missingApprovalCount,
    unresolvedDeferralCount: input.closureModel.unresolvedDeferralCount,
    evidenceItemCount: input.closureModel.evidenceItemCount,
    openActionCount: input.closureModel.openActionCount,
    readyForExecutiveSignOff: input.closureModel.readyForExecutiveSignOff,
    sourceLabel: input.sourceLabel,
    dataSourceKind: input.dataSourceKind,
    dataStatus: input.dataStatus,
    checklist: input.closureModel.checklist,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const snapshots = [snapshot, ...getLaunchClosureSnapshots()].slice(0, 80)

  cachedSnapshots = snapshots
  cachedRawSnapshots = JSON.stringify(snapshots)
  localStorage.setItem(storageKey, cachedRawSnapshots)
  emitLaunchClosureSnapshotChange()
  return snapshot
}

export function subscribeToLaunchClosureSnapshots(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchClosureSnapshots() {
  return useSyncExternalStore(subscribeToLaunchClosureSnapshots, getLaunchClosureSnapshots, () => [])
}

function emitLaunchClosureSnapshotChange() {
  listeners.forEach(listener => listener())
}
