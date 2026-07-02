import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchBackendMatrixArea,
  LaunchBackendMatrixCheck,
  LaunchBackendMatrixRow,
  LaunchBackendMatrixStatus,
  LaunchBackendReadinessMatrix,
} from './launchBackendReadinessMatrix'

export type BackendImplementationWorkStatus = 'Blocked' | 'Planning' | 'In Review' | 'Ready For Build' | 'Complete'
export type BackendImplementationPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type BackendImplementationWorkType = 'Governance' | 'Evidence' | 'Handler' | 'Audit' | 'Safety'

export interface BackendImplementationAcceptanceCheck {
  id: string
  label: string
  status: LaunchBackendMatrixStatus
  detail: string
}

export interface BackendImplementationWorkItem {
  id: string
  matrixRowId: string
  area: LaunchBackendMatrixArea
  type: BackendImplementationWorkType
  title: string
  status: BackendImplementationWorkStatus
  recommendedStatus: BackendImplementationWorkStatus
  priority: BackendImplementationPriority
  owner: string
  handlerKey: string
  handlerLabel: string
  scope: string
  evidence: string
  nextStep: string
  dependencies: string[]
  acceptanceChecks: BackendImplementationAcceptanceCheck[]
  rollbackRequirement: string
  auditRequirement: string
  dueLabel: string
  auditBacked: boolean
  localOnly: boolean
  note?: string
  auditEventId?: string
  reviewedAt?: string
  reviewedByRole?: string
}

export interface BackendImplementationWorkbench {
  status: BackendImplementationWorkStatus
  summary: string
  generatedAt: string
  items: BackendImplementationWorkItem[]
  nextItem?: BackendImplementationWorkItem
  totalCount: number
  blockedCount: number
  planningCount: number
  inReviewCount: number
  readyForBuildCount: number
  completeCount: number
  criticalCount: number
  auditBackedCount: number
}

export interface BackendImplementationWorkRecord {
  id: string
  itemId: string
  status: BackendImplementationWorkStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendImplementationWorkbenchInput {
  matrix: LaunchBackendReadinessMatrix
  records: BackendImplementationWorkRecord[]
}

interface SaveBackendImplementationWorkRecordInput {
  item: BackendImplementationWorkItem
  status: BackendImplementationWorkStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

interface WorkProfile {
  type: BackendImplementationWorkType
  handlerKey: string
  handlerLabel: string
  scope: string
  rollbackRequirement: string
  auditRequirement: string
  dueLabel: string
}

const storageKey = 'hc_platform_launch_backend_implementation_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: BackendImplementationWorkRecord[] = []

export const launchBackendImplementationWorkbenchBoundaryRule =
  'Backend implementation workbench updates are local planning records only. They do not wire handlers, deploy code, mutate production data, change billing, change module access, alter permissions, impersonate users, or execute agent actions.'

export const launchBackendImplementationWorkStatuses: BackendImplementationWorkStatus[] = [
  'Blocked',
  'Planning',
  'In Review',
  'Ready For Build',
  'Complete',
]

export function buildBackendImplementationWorkbench({
  matrix,
  records,
}: BuildBackendImplementationWorkbenchInput): BackendImplementationWorkbench {
  const latestRecordByItem = getLatestRecordByItem(records)
  const generatedAt = new Date().toISOString()
  const items = matrix.rows
    .map(row => withLatestRecord(createWorkItem(row), latestRecordByItem.get(getWorkItemId(row))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.priority) - priorityRank(a.priority) || a.title.localeCompare(b.title))
  const openItems = items.filter(item => item.status !== 'Complete')
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const planningCount = items.filter(item => item.status === 'Planning').length
  const inReviewCount = items.filter(item => item.status === 'In Review').length
  const readyForBuildCount = items.filter(item => item.status === 'Ready For Build').length
  const completeCount = items.filter(item => item.status === 'Complete').length
  const status: BackendImplementationWorkStatus = blockedCount
    ? 'Blocked'
    : planningCount || inReviewCount
      ? 'Planning'
      : readyForBuildCount
        ? 'Ready For Build'
        : 'Complete'

  return {
    status,
    summary: getWorkbenchSummary(status, blockedCount, planningCount + inReviewCount, readyForBuildCount, completeCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    blockedCount,
    planningCount,
    inReviewCount,
    readyForBuildCount,
    completeCount,
    criticalCount: openItems.filter(item => item.priority === 'Critical').length,
    auditBackedCount: items.filter(item => item.auditBacked).length,
  }
}

export function getBackendImplementationWorkRecords(): BackendImplementationWorkRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as BackendImplementationWorkRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveBackendImplementationWorkRecord(input: SaveBackendImplementationWorkRecordInput) {
  const record: BackendImplementationWorkRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultImplementationNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getBackendImplementationWorkRecords()].slice(0, 160)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitBackendImplementationWorkRecordChange()
  return record
}

export function subscribeToBackendImplementationWorkRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendImplementationWorkRecords() {
  return useSyncExternalStore(subscribeToBackendImplementationWorkRecords, getBackendImplementationWorkRecords, () => [])
}

export function getBackendImplementationWorkTone(status: BackendImplementationWorkStatus): 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'Complete' || status === 'Ready For Build') return 'ok'
  if (status === 'In Review') return 'info'
  if (status === 'Planning') return 'warn'
  return 'danger'
}

export function getBackendImplementationPriorityTone(priority: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'info' {
  if (priority === 'Critical') return 'danger'
  if (priority === 'High') return 'warn'
  if (priority === 'Medium') return 'info'
  return 'ok'
}

function createWorkItem(row: LaunchBackendMatrixRow): BackendImplementationWorkItem {
  const profile = getWorkProfile(row)
  const dependencies = row.checks
    .filter(item => item.status !== 'Ready')
    .map(item => `${item.label}: ${item.detail}`)
  const recommendedStatus = getRecommendedStatus(row)

  return {
    id: getWorkItemId(row),
    matrixRowId: row.id,
    area: row.area,
    type: profile.type,
    title: getWorkTitle(row),
    status: recommendedStatus,
    recommendedStatus,
    priority: getWorkPriority(row.status),
    owner: row.owner,
    handlerKey: profile.handlerKey,
    handlerLabel: profile.handlerLabel,
    scope: profile.scope,
    evidence: row.evidence,
    nextStep: row.nextStep,
    dependencies,
    acceptanceChecks: [
      ...row.checks.map(toAcceptanceCheck),
      {
        id: `${row.id}_permission_audit`,
        label: 'Permission and audit guardrail',
        status: 'Ready',
        detail: 'Implementation must use server-side permission checks and immutable audit records before production mutation.',
      },
      {
        id: `${row.id}_browser_boundary`,
        label: 'Browser mutation boundary',
        status: row.id === 'browser_mutation_boundary' ? row.status : 'Ready',
        detail: 'The Platform Admin browser remains review-only for production-changing work.',
      },
    ],
    rollbackRequirement: profile.rollbackRequirement,
    auditRequirement: profile.auditRequirement,
    dueLabel: profile.dueLabel,
    auditBacked: false,
    localOnly: true,
  }
}

function withLatestRecord(
  item: BackendImplementationWorkItem,
  record: BackendImplementationWorkRecord | undefined,
): BackendImplementationWorkItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    owner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
    auditBacked: true,
  }
}

function toAcceptanceCheck(check: LaunchBackendMatrixCheck): BackendImplementationAcceptanceCheck {
  return {
    id: check.id,
    label: check.label,
    status: check.status,
    detail: check.detail,
  }
}

function getWorkItemId(row: LaunchBackendMatrixRow) {
  return `backend-implementation-${row.id}`
}

function getWorkTitle(row: LaunchBackendMatrixRow) {
  if (row.status === 'Ready') return `Prepare ${row.title}`
  if (row.status === 'Watch') return `Stabilize ${row.title}`
  return `Clear ${row.title}`
}

function getRecommendedStatus(row: LaunchBackendMatrixRow): BackendImplementationWorkStatus {
  if (row.status === 'Blocked' || row.status === 'Missing') return 'Blocked'
  if (row.status === 'Watch') return 'Planning'
  return 'Ready For Build'
}

function getWorkPriority(status: LaunchBackendMatrixStatus): BackendImplementationPriority {
  if (status === 'Blocked') return 'Critical'
  if (status === 'Missing') return 'High'
  if (status === 'Watch') return 'Medium'
  return 'Low'
}

function getWorkProfile(row: LaunchBackendMatrixRow): WorkProfile {
  const profiles: Record<string, WorkProfile> = {
    action_request_pipeline: {
      type: 'Governance',
      handlerKey: 'admin_action.request_pipeline.governance',
      handlerLabel: 'Action Request Governance',
      scope: 'Admin Action Request Pipeline',
      rollbackRequirement: 'Keep request records intact and revert only through action-request status transitions with audit proof.',
      auditRequirement: 'Record request scope, owner, permission, and blocker state in the admin action ledger.',
      dueLabel: 'Before handler wiring',
    },
    approval_evidence: {
      type: 'Evidence',
      handlerKey: 'admin_action.approval_evidence.verify',
      handlerLabel: 'Approval Evidence Verification',
      scope: 'Approval Evidence Packs',
      rollbackRequirement: 'Preserve approval evidence history and re-open checklist items instead of deleting evidence.',
      auditRequirement: 'Record approval reviewer, checklist state, and evidence pack status.',
      dueLabel: 'Before approval handoff',
    },
    execution_handoff_readiness: {
      type: 'Governance',
      handlerKey: 'admin_action.execution_handoff.prepare',
      handlerLabel: 'Execution Handoff Preparation',
      scope: 'Execution Handoff Readiness',
      rollbackRequirement: 'Revert executor assignment through handoff readiness records and keep the prior assignment visible.',
      auditRequirement: 'Record executor, confirmation state, and readiness blockers.',
      dueLabel: 'Before dry-run execution',
    },
    dry_run_ledger: {
      type: 'Evidence',
      handlerKey: 'admin_action.execution_dry_run.review',
      handlerLabel: 'Dry-Run Ledger Review',
      scope: 'Dry-Run Execution Ledger',
      rollbackRequirement: 'Dry-run records are evidence only; production rollback must be defined on the eventual server handler.',
      auditRequirement: 'Record dry-run status, payload summary, and mutationApplied=false.',
      dueLabel: 'Before server handler enablement',
    },
    execution_evidence_chain: {
      type: 'Evidence',
      handlerKey: 'admin_action.execution_evidence.link',
      handlerLabel: 'Execution Evidence Chain',
      scope: 'Execution Ledger Evidence',
      rollbackRequirement: 'Repair evidence links by appending corrected records; do not mutate historical execution evidence.',
      auditRequirement: 'Record request, approval, handoff, dry-run, and audit linkage.',
      dueLabel: 'Before launch review',
    },
    server_adapter_coverage: {
      type: 'Handler',
      handlerKey: 'server_adapter.coverage.review',
      handlerLabel: 'Server Adapter Coverage',
      scope: 'Server Adapter Contracts',
      rollbackRequirement: 'Keep handler contracts disabled until rollback and dry-run proof are attached.',
      auditRequirement: 'Record handler key, permission, coverage state, and review result.',
      dueLabel: 'Before trusted handler wiring',
    },
    audit_chain: {
      type: 'Audit',
      handlerKey: 'platform_audit.backend_chain.review',
      handlerLabel: 'Backend Audit Chain Review',
      scope: 'Audit Chain Coverage',
      rollbackRequirement: 'Audit entries are append-only; corrections require follow-up audit events.',
      auditRequirement: 'Record blocked outcomes, reviewed guardrails, and persistence target.',
      dueLabel: 'Before executive sign-off',
    },
    rollback_proof: {
      type: 'Safety',
      handlerKey: 'admin_action.rollback_proof.capture',
      handlerLabel: 'Rollback Proof Capture',
      scope: 'Rollback Proof',
      rollbackRequirement: 'Every production-changing handler must include a named rollback plan before execution.',
      auditRequirement: 'Record rollback plan coverage by request and owner.',
      dueLabel: 'Before any production mutation',
    },
    browser_mutation_boundary: {
      type: 'Safety',
      handlerKey: 'safety.browser_mutation_boundary.enforce',
      handlerLabel: 'Browser Mutation Boundary',
      scope: 'Browser Mutation Boundary',
      rollbackRequirement: 'Stop production-changing work if browser mutation flags appear; clear flags before any handler proceeds.',
      auditRequirement: 'Record mutationApplied=false and server_action_required for every browser-side review.',
      dueLabel: 'Always enforced',
    },
  }

  return profiles[row.id] ?? {
    type: 'Governance',
    handlerKey: `launch_backend.${row.id}.review`,
    handlerLabel: row.title,
    scope: row.title,
    rollbackRequirement: 'Attach rollback proof before any production-changing work is approved.',
    auditRequirement: 'Record owner, permission, scope, and evidence state before implementation.',
    dueLabel: 'Before backend implementation',
  }
}

function getLatestRecordByItem(records: BackendImplementationWorkRecord[]) {
  const latestRecordByItem = new Map<string, BackendImplementationWorkRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getWorkbenchSummary(
  status: BackendImplementationWorkStatus,
  blockedCount: number,
  reviewCount: number,
  readyForBuildCount: number,
  completeCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} backend implementation work item${blockedCount === 1 ? '' : 's'} must clear before trusted handler wiring.`
  if (status === 'Planning') return `${reviewCount} backend implementation work item${reviewCount === 1 ? '' : 's'} need planning or review.`
  if (status === 'Ready For Build') return `${readyForBuildCount} backend implementation work item${readyForBuildCount === 1 ? '' : 's'} are ready for trusted server build.`
  return `${completeCount} backend implementation work item${completeCount === 1 ? '' : 's'} have local completion evidence.`
}

function defaultImplementationNote(status: BackendImplementationWorkStatus, item: BackendImplementationWorkItem) {
  if (status === 'Complete') return `${item.title} marked complete with local audit-backed planning evidence.`
  if (status === 'Ready For Build') return `${item.title} is ready for trusted server build after current acceptance checks.`
  if (status === 'In Review') return `${item.title} is under implementation review with owner follow-up attached.`
  if (status === 'Planning') return `${item.title} moved into planning with dependencies visible.`
  return `${item.title} remains blocked before backend implementation can proceed.`
}

function statusRank(status: BackendImplementationWorkStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Planning') return 4
  if (status === 'In Review') return 3
  if (status === 'Ready For Build') return 2
  return 1
}

function priorityRank(priority: BackendImplementationPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function emitBackendImplementationWorkRecordChange() {
  listeners.forEach(listener => listener())
}
