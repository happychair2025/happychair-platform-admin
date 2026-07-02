import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformReadViewDiagnostic } from '../platform-data/PlatformDataContext'
import type { LaunchArtifactManifestModel } from './launchArtifactManifest'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchHandoffApproval } from './launchHandoffApprovals'

export type LaunchFollowUpStatus = 'Open' | 'In Progress' | 'Blocked' | 'Resolved'
export type LaunchFollowUpPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type LaunchFollowUpSource = 'Approval Condition' | 'Manifest Gap' | 'Action Queue' | 'Read Contract' | 'Closure Check'

export interface LaunchFollowUpItem {
  id: string
  title: string
  status: LaunchFollowUpStatus
  priority: LaunchFollowUpPriority
  source: LaunchFollowUpSource
  owner: string
  reference: string
  evidence: string
  nextStep: string
  dueLabel: string
  auditBacked: boolean
  createdAt: string
  updatedAt?: string
  note?: string
  auditEventId?: string
  linkedActionRequestId?: string
}

export interface LaunchFollowUpRegisterModel {
  generatedAt: string
  items: LaunchFollowUpItem[]
  nextItem?: LaunchFollowUpItem
  openCount: number
  inProgressCount: number
  blockedCount: number
  resolvedCount: number
  criticalCount: number
  ownerCount: number
}

export interface LaunchFollowUpRecord {
  id: string
  itemId: string
  status: LaunchFollowUpStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchFollowUpRegisterInput {
  manifest: LaunchArtifactManifestModel
  latestHandoffApproval?: LaunchHandoffApproval
  actionRequests: AdminActionRequest[]
  closureModel: LaunchClosureModel
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  records: LaunchFollowUpRecord[]
}

interface SaveLaunchFollowUpRecordInput {
  item: LaunchFollowUpItem
  status: LaunchFollowUpStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_follow_up_records'
const listeners = new Set<() => void>()
const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])
let cachedRawRecords = ''
let cachedRecords: LaunchFollowUpRecord[] = []

export const launchFollowUpStatuses: LaunchFollowUpStatus[] = ['Open', 'In Progress', 'Blocked', 'Resolved']

export function buildLaunchFollowUpRegister({
  manifest,
  latestHandoffApproval,
  actionRequests,
  closureModel,
  readViewDiagnostics,
  records,
}: BuildLaunchFollowUpRegisterInput): LaunchFollowUpRegisterModel {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const openActions = actionRequests.filter(request => openActionStatuses.has(request.status))
  const fallbackReadViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')
  const reviewClosureItems = closureModel.checklist.filter(item => item.status !== 'Complete')

  const baseItems: LaunchFollowUpItem[] = [
    ...approvalFollowUps(latestHandoffApproval, generatedAt),
    ...manifest.gaps.map(gap => ({
      id: `manifest-gap-${gap.id}`,
      title: gap.title,
      status: gap.severity === 'Blocker' ? 'Blocked' as const : 'Open' as const,
      priority: gap.severity === 'Blocker' ? 'Critical' as const : 'High' as const,
      source: 'Manifest Gap' as const,
      owner: gap.owner,
      reference: gap.reference,
      evidence: `${gap.severity} in launch artifact manifest.`,
      nextStep: gap.nextStep,
      dueLabel: gap.severity === 'Blocker' ? 'Before handoff' : 'Before final approval',
      auditBacked: manifest.auditBackedCount > 0,
      createdAt: manifest.generatedAt,
    })),
    ...openActions.map(request => ({
      id: `action-request-${request.id}`,
      title: request.title,
      status: request.status === 'Blocked' || request.status === 'Failed'
        ? 'Blocked' as const
        : request.status === 'Approved' || request.status === 'Running'
          ? 'In Progress' as const
          : 'Open' as const,
      priority: request.status === 'Blocked' || request.status === 'Failed' ? 'Critical' as const : 'High' as const,
      source: 'Action Queue' as const,
      owner: request.requestedBy.role,
      reference: request.scope.label,
      evidence: `${request.status} action request. Handler: ${request.serverHandler.key}.`,
      nextStep: request.statusReason ?? request.reason,
      dueLabel: request.status === 'Approved' || request.status === 'Running' ? 'Monitor during handoff' : 'Before approval close',
      auditBacked: Boolean(request.auditEventId),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      linkedActionRequestId: request.id,
    })),
    ...fallbackReadViews.map(diagnostic => ({
      id: `read-contract-${diagnostic.key}`,
      title: diagnostic.viewName,
      status: 'Blocked' as const,
      priority: 'Critical' as const,
      source: 'Read Contract' as const,
      owner: 'Engineering',
      reference: String(diagnostic.key),
      evidence: `${diagnostic.records} fallback records loaded for ${diagnostic.viewName}.`,
      nextStep: diagnostic.error ?? 'Repair the read-only view contract before production launch.',
      dueLabel: 'Before production launch',
      auditBacked: false,
      createdAt: diagnostic.loadedAt ?? generatedAt,
    })),
    ...reviewClosureItems.map(item => ({
      id: `closure-check-${item.id}`,
      title: item.title,
      status: item.status === 'Blocked' ? 'Blocked' as const : 'Open' as const,
      priority: item.status === 'Blocked' ? 'Critical' as const : 'Medium' as const,
      source: 'Closure Check' as const,
      owner: item.owner,
      reference: item.reference,
      evidence: item.evidence,
      nextStep: item.nextStep,
      dueLabel: item.required ? 'Before closure' : 'Track after approval',
      auditBacked: false,
      createdAt: closureModel.generatedAt,
    })),
  ]

  const items = dedupeFollowUps(baseItems)
    .map(item => withLatestRecord(item, latestRecordByItem.get(item.id)))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.priority) - priorityRank(a.priority) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const unresolvedItems = items.filter(item => item.status !== 'Resolved')

  return {
    generatedAt,
    items,
    nextItem: unresolvedItems[0],
    openCount: items.filter(item => item.status === 'Open').length,
    inProgressCount: items.filter(item => item.status === 'In Progress').length,
    blockedCount: items.filter(item => item.status === 'Blocked').length,
    resolvedCount: items.filter(item => item.status === 'Resolved').length,
    criticalCount: unresolvedItems.filter(item => item.priority === 'Critical').length,
    ownerCount: new Set(unresolvedItems.map(item => item.owner)).size,
  }
}

export function getLaunchFollowUpRecords(): LaunchFollowUpRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchFollowUpRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchFollowUpRecord(input: SaveLaunchFollowUpRecordInput) {
  const record: LaunchFollowUpRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultFollowUpNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchFollowUpRecords()].slice(0, 160)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchFollowUpRecordChange()
  return record
}

export function subscribeToLaunchFollowUpRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchFollowUpRecords() {
  return useSyncExternalStore(subscribeToLaunchFollowUpRecords, getLaunchFollowUpRecords, () => [])
}

export function getLaunchFollowUpStatusTone(status: LaunchFollowUpStatus): 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'Resolved') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'In Progress') return 'info'
  return 'warn'
}

export function getLaunchFollowUpPriorityTone(priority: LaunchFollowUpPriority): 'ok' | 'warn' | 'danger' | 'info' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'ok'
}

function approvalFollowUps(
  latestHandoffApproval: LaunchHandoffApproval | undefined,
  generatedAt: string,
): LaunchFollowUpItem[] {
  if (!latestHandoffApproval || latestHandoffApproval.decision === 'Approved') return []

  return [
    {
      id: `handoff-approval-${latestHandoffApproval.id}`,
      title: `${latestHandoffApproval.decision} handoff follow-up`,
      status: latestHandoffApproval.decision === 'Held' ? 'Blocked' : 'Open',
      priority: latestHandoffApproval.decision === 'Held' ? 'Critical' : 'High',
      source: 'Approval Condition',
      owner: latestHandoffApproval.followUpOwner,
      reference: 'Handoff Approval',
      evidence: latestHandoffApproval.conditionNote,
      nextStep: latestHandoffApproval.acceptedRisk,
      dueLabel: latestHandoffApproval.decision === 'Held' ? 'Before handoff resumes' : 'Track through launch',
      auditBacked: Boolean(latestHandoffApproval.auditEventId),
      createdAt: latestHandoffApproval.recordedAt ?? generatedAt,
      auditEventId: latestHandoffApproval.auditEventId,
    },
  ]
}

function getLatestRecordByItem(records: LaunchFollowUpRecord[]) {
  const latestRecordByItem = new Map<string, LaunchFollowUpRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function withLatestRecord(item: LaunchFollowUpItem, record: LaunchFollowUpRecord | undefined): LaunchFollowUpItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    owner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    updatedAt: record.recordedAt,
    auditBacked: true,
  }
}

function dedupeFollowUps(items: LaunchFollowUpItem[]) {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function defaultFollowUpNote(status: LaunchFollowUpStatus, item: LaunchFollowUpItem) {
  if (status === 'Resolved') return `${item.title} marked resolved with current evidence.`
  if (status === 'Blocked') return `${item.title} remains blocked before launch handoff can close.`
  if (status === 'In Progress') return `${item.title} is in progress with owner follow-up attached.`
  return `${item.title} reopened for launch follow-up.`
}

function statusRank(status: LaunchFollowUpStatus) {
  if (status === 'Blocked') return 4
  if (status === 'Open') return 3
  if (status === 'In Progress') return 2
  return 1
}

function priorityRank(priority: LaunchFollowUpPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function emitLaunchFollowUpRecordChange() {
  listeners.forEach(listener => listener())
}
