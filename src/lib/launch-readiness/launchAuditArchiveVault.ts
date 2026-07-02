import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  LaunchFinalAuditItem,
  LaunchFinalAuditItemStatus,
  LaunchFinalAuditRoom,
  LaunchFinalAuditRoomStatus,
} from './launchFinalAuditRoom'

export type LaunchAuditArchiveVaultStatus = 'Archive Blocked' | 'Archive Review' | 'Archive Ready' | 'Archived'
export type LaunchAuditArchiveItemStatus = 'Blocked' | 'Needs Archive' | 'Archive Review' | 'Archive Ready' | 'Archived'
export type LaunchAuditArchiveCheckStatus = 'Missing' | 'Review' | 'Ready'
export type LaunchAuditArchiveCategory = 'Final Audit' | 'Evidence Export' | 'Owner Signoff' | 'Operations Handoff' | 'Retention'

export interface LaunchAuditArchiveCheck {
  id: string
  label: string
  status: LaunchAuditArchiveCheckStatus
  evidence: string
  required: boolean
}

export interface LaunchAuditArchiveItem {
  id: string
  category: LaunchAuditArchiveCategory
  title: string
  status: LaunchAuditArchiveItemStatus
  sourceFinalAuditItemId?: string
  sourceFinalAuditStage?: string
  sourceFinalAuditStatus?: LaunchFinalAuditItemStatus
  sourceStatus: string
  owner: string
  reference: string
  targetView: string
  archiveRequirement: string
  archiveEvidence: string
  handoffPlan: string
  retentionPlan: string
  rollbackPlan: string
  nextStep: string
  auditRecordCount: number
  customerFacingCount: number
  actionRequiredCount: number
  readyCount: number
  totalCount: number
  generatedAt: string
  actionRequired: boolean
  checks: LaunchAuditArchiveCheck[]
}

export interface LaunchAuditArchiveCategoryGroup {
  category: LaunchAuditArchiveCategory
  status: LaunchAuditArchiveItemStatus
  owner: string
  itemCount: number
  archiveEvidence: string
  nextStep: string
}

export interface LaunchAuditArchiveOwnerGroup {
  owner: string
  total: number
  blocked: number
  needsArchive: number
  review: number
  ready: number
  archived: number
  nextStep: string
}

export interface LaunchAuditArchiveRecord {
  id: string
  itemId?: string
  itemTitle?: string
  category?: LaunchAuditArchiveCategory
  itemStatus: LaunchAuditArchiveItemStatus
  vaultStatus: LaunchAuditArchiveVaultStatus
  blockedCount: number
  needsArchiveCount: number
  reviewCount: number
  readyCount: number
  archivedCount: number
  finalAuditStatus: LaunchFinalAuditRoomStatus
  finalAuditScore: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchAuditArchiveVault {
  status: LaunchAuditArchiveVaultStatus
  headline: string
  summary: string
  generatedAt: string
  items: LaunchAuditArchiveItem[]
  nextItem?: LaunchAuditArchiveItem
  blockedCount: number
  needsArchiveCount: number
  reviewCount: number
  readyCount: number
  archivedCount: number
  totalCount: number
  finalAuditStatus: LaunchFinalAuditRoomStatus
  finalAuditScore: number
  customerFacingCount: number
  auditRecordCount: number
  actionRequiredCount: number
  recordCount: number
  latestRecord?: LaunchAuditArchiveRecord
  categoryGroups: LaunchAuditArchiveCategoryGroup[]
  ownerGroups: LaunchAuditArchiveOwnerGroup[]
}

interface BuildLaunchAuditArchiveVaultInput {
  finalAuditRoom: LaunchFinalAuditRoom
  records: LaunchAuditArchiveRecord[]
}

interface SaveLaunchAuditArchiveRecordInput {
  vault: LaunchAuditArchiveVault
  item?: LaunchAuditArchiveItem
  itemStatus?: LaunchAuditArchiveItemStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_audit_archive_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchAuditArchiveRecord[] = []

export const launchAuditArchiveBoundaryRule =
  'Launch Audit Archive Vault records retention, archive readiness, handoff, and export evidence only. Recording, exporting, or queueing archive review does not close production incidents, send messages, publish notices, mutate customer data, alter billing, change modules, modify permissions, impersonate users, or execute agent actions from the browser.'

export function buildLaunchAuditArchiveVault(input: BuildLaunchAuditArchiveVaultInput): LaunchAuditArchiveVault {
  const generatedAt = new Date().toISOString()
  const recordByItemId = latestRecordByItem(input.records)
  const baseItems = [
    finalAuditExportItem(input.finalAuditRoom, generatedAt),
    evidenceExportItem(input.finalAuditRoom, generatedAt),
    ownerSignoffItem(input.finalAuditRoom, generatedAt),
    operationsHandoffItem(input.finalAuditRoom, generatedAt),
    retentionItem(input.finalAuditRoom, input.records, generatedAt),
  ]
  const items = baseItems.map(item => applyRecordedArchiveStatus(item, recordByItemId.get(item.id)))
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const needsArchiveCount = items.filter(item => item.status === 'Needs Archive').length
  const reviewCount = items.filter(item => item.status === 'Archive Review').length
  const readyCount = items.filter(item => item.status === 'Archive Ready').length
  const archivedCount = items.filter(item => item.status === 'Archived').length
  const status = getAggregateStatus(blockedCount, needsArchiveCount, reviewCount, readyCount, archivedCount, items.length)

  return {
    status,
    headline: getHeadline(status, blockedCount, needsArchiveCount, reviewCount, readyCount),
    summary: getSummary(status, items.length, blockedCount, needsArchiveCount, reviewCount, archivedCount, input.finalAuditRoom.auditScore),
    generatedAt,
    items,
    nextItem: items.find(item => item.status === 'Blocked' || item.status === 'Needs Archive' || item.status === 'Archive Review') ?? items[0],
    blockedCount,
    needsArchiveCount,
    reviewCount,
    readyCount,
    archivedCount,
    totalCount: items.length,
    finalAuditStatus: input.finalAuditRoom.status,
    finalAuditScore: input.finalAuditRoom.auditScore,
    customerFacingCount: items.reduce((total, item) => total + item.customerFacingCount, 0),
    auditRecordCount: items.reduce((total, item) => total + item.auditRecordCount, 0),
    actionRequiredCount: items.reduce((total, item) => total + item.actionRequiredCount, 0),
    recordCount: input.records.length,
    latestRecord: input.records[0],
    categoryGroups: buildCategoryGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getLaunchAuditArchiveRecords(): LaunchAuditArchiveRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchAuditArchiveRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchAuditArchiveRecord(input: SaveLaunchAuditArchiveRecordInput) {
  const record: LaunchAuditArchiveRecord = {
    id: crypto.randomUUID(),
    itemId: input.item?.id,
    itemTitle: input.item?.title,
    category: input.item?.category,
    itemStatus: input.itemStatus ?? input.item?.status ?? 'Archive Review',
    vaultStatus: input.vault.status,
    blockedCount: input.vault.blockedCount,
    needsArchiveCount: input.vault.needsArchiveCount,
    reviewCount: input.vault.reviewCount,
    readyCount: input.vault.readyCount,
    archivedCount: input.vault.archivedCount,
    finalAuditStatus: input.vault.finalAuditStatus,
    finalAuditScore: input.vault.finalAuditScore,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchAuditArchiveRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchAuditArchiveRecordChange()
  return record
}

export function subscribeToLaunchAuditArchiveRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchAuditArchiveRecords() {
  return useSyncExternalStore(subscribeToLaunchAuditArchiveRecords, getLaunchAuditArchiveRecords, () => [])
}

export function getLaunchAuditArchiveVaultTone(status: LaunchAuditArchiveVaultStatus) {
  if (status === 'Archive Blocked') return 'danger' as const
  if (status === 'Archive Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchAuditArchiveItemTone(status: LaunchAuditArchiveItemStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Archive' || status === 'Archive Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchAuditArchiveCheckTone(status: LaunchAuditArchiveCheckStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

export function getLaunchAuditArchiveFilename(vault: LaunchAuditArchiveVault) {
  return `launch-audit-archive-vault-${vault.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchAuditArchiveHtml(vault: LaunchAuditArchiveVault, session: AdminSession) {
  const rows = vault.items.map(item => `
    <tr>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.sourceStatus)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.archiveEvidence)}</td>
      <td>${escapeHtml(item.retentionPlan)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Audit Archive Vault</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17211c; margin: 40px; background: #f8faf7; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 28px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { border: 1px solid #d8e0d7; border-radius: 8px; padding: 14px; background: #fff; }
      .card span { display: block; color: #66736b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .card strong { display: block; margin-top: 8px; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8e0d7; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e8eee7; vertical-align: top; }
      th { color: #516157; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .notice { border-left: 4px solid #7a8f5f; padding: 14px; background: #fff; margin: 20px 0; }
    </style>
  </head>
  <body>
    <p>Happy Chair Platform Admin</p>
    <h1>${escapeHtml(vault.headline)}</h1>
    <p>${escapeHtml(vault.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(vault.status)}</strong></div>
      <div class="card"><span>Final Audit Score</span><strong>${vault.finalAuditScore}%</strong></div>
      <div class="card"><span>Needs Archive</span><strong>${vault.needsArchiveCount + vault.reviewCount}</strong></div>
      <div class="card"><span>Archive Ready</span><strong>${vault.readyCount + vault.archivedCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(vault.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is audit archive evidence only and does not close production incidents, send messages, publish notices, or mutate production state.
    </div>
    <h2>Archive Items</h2>
    <table>
      <thead><tr><th>Category</th><th>Status</th><th>Source</th><th>Owner</th><th>Archive Evidence</th><th>Retention Plan</th><th>Next Step</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`
}

function finalAuditExportItem(room: LaunchFinalAuditRoom, generatedAt: string): LaunchAuditArchiveItem {
  const sourceItem = room.nextItem ?? room.items[0]
  const status = room.status === 'Audit Blocked'
    ? 'Blocked'
    : room.status === 'Audit Review'
      ? 'Archive Review'
      : room.status === 'Closed'
        ? 'Archived'
        : 'Needs Archive'
  return {
    id: 'archive-final-audit-export',
    category: 'Final Audit',
    title: 'Final audit export retained',
    status,
    sourceFinalAuditItemId: sourceItem?.id,
    sourceFinalAuditStage: sourceItem?.stage,
    sourceFinalAuditStatus: sourceItem?.status,
    sourceStatus: `${room.status} / ${room.auditScore}% score`,
    owner: 'Owner',
    reference: 'Final Audit Room',
    targetView: 'finalAudit',
    archiveRequirement: 'Retain the final audit room export before launch closure is treated as archived.',
    archiveEvidence: `${room.totalCount} final audit stages, ${room.auditRecordCount} upstream records, ${room.recordCount} final audit room records.`,
    handoffPlan: 'Attach the final audit export to the executive closure handoff packet.',
    retentionPlan: 'Store final audit export with the launch evidence archive for owner, support, and engineering review.',
    rollbackPlan: 'If the final audit changes, keep the prior export and record a new archive record.',
    nextStep: status === 'Blocked' ? 'Resolve final audit blockers before archiving.' : status === 'Archived' ? 'Keep retained export available for audit lookup.' : 'Export and record the final audit archive evidence.',
    auditRecordCount: room.auditRecordCount + room.recordCount,
    customerFacingCount: room.customerFacingCount,
    actionRequiredCount: room.blockedCount + room.needsEvidenceCount + room.reviewCount,
    readyCount: room.readyCount + room.closedCount,
    totalCount: Math.max(room.totalCount, 1),
    generatedAt,
    actionRequired: status !== 'Archived',
    checks: [
      check('final-audit-not-blocked', 'Final audit is not blocked', room.status === 'Audit Blocked' ? 'Missing' : room.status === 'Audit Review' ? 'Review' : 'Ready', room.status, true),
      check('final-audit-local-record', 'Final audit has local archiveable record evidence', room.recordCount || room.auditRecordCount ? 'Ready' : 'Review', `${room.recordCount} room records / ${room.auditRecordCount} upstream records`, true),
    ],
  }
}

function evidenceExportItem(room: LaunchFinalAuditRoom, generatedAt: string): LaunchAuditArchiveItem {
  const closurePack = room.items.find(item => item.stage === 'Closure Pack')
  const status = room.blockedCount || closurePack?.status === 'Blocked'
    ? 'Blocked'
    : room.needsEvidenceCount
      ? 'Needs Archive'
      : room.reviewCount || closurePack?.status === 'Review'
        ? 'Archive Review'
        : 'Archive Ready'
  return {
    id: 'archive-evidence-export',
    category: 'Evidence Export',
    title: 'Closure evidence export retained',
    status,
    sourceFinalAuditItemId: closurePack?.id,
    sourceFinalAuditStage: closurePack?.stage,
    sourceFinalAuditStatus: closurePack?.status,
    sourceStatus: closurePack?.sourceStatus ?? room.status,
    owner: 'Support Lead',
    reference: 'Closure Evidence Pack',
    targetView: 'closurePack',
    archiveRequirement: 'Retain closure pack evidence, delivery proof, recipient response state, and any customer-facing approval trail.',
    archiveEvidence: closurePack?.evidence ?? `${room.customerFacingCount} customer-facing artifacts require retained evidence.`,
    handoffPlan: 'Support Lead keeps closure evidence attached to the launch archive and routes any gap through action requests.',
    retentionPlan: 'Retain customer-facing evidence with delivery and response records for support replay.',
    rollbackPlan: 'If a proof gap is found, mark archive blocked and return to Closure Pack.',
    nextStep: status === 'Archive Ready' ? 'Keep evidence export attached to the archive vault.' : closurePack?.nextStep ?? 'Review closure evidence before archive completion.',
    auditRecordCount: closurePack?.auditRecordCount ?? room.auditRecordCount,
    customerFacingCount: closurePack?.customerFacingCount ?? room.customerFacingCount,
    actionRequiredCount: closurePack?.actionRequiredCount ?? room.actionRequiredCount,
    readyCount: closurePack?.readyCount ?? room.readyCount,
    totalCount: closurePack?.totalCount ?? Math.max(room.totalCount, 1),
    generatedAt,
    actionRequired: status !== 'Archive Ready',
    checks: [
      check('closure-evidence-complete', 'Closure evidence has no missing proof', room.needsEvidenceCount ? 'Missing' : room.reviewCount ? 'Review' : 'Ready', `${room.needsEvidenceCount} evidence gaps`, true),
      check('customer-facing-retention', 'Customer-facing communication evidence is retained', room.customerFacingCount ? 'Review' : 'Ready', `${room.customerFacingCount} customer-facing artifacts`, true),
    ],
  }
}

function ownerSignoffItem(room: LaunchFinalAuditRoom, generatedAt: string): LaunchAuditArchiveItem {
  const executiveItem = room.items.find(item => item.stage === 'Executive Closure')
  const status = room.status === 'Audit Blocked'
    ? 'Blocked'
    : room.status === 'Audit Review' || executiveItem?.status === 'Review'
      ? 'Archive Review'
      : room.status === 'Closed'
        ? 'Archived'
        : 'Archive Ready'
  return {
    id: 'archive-owner-signoff',
    category: 'Owner Signoff',
    title: 'Owner signoff trail retained',
    status,
    sourceFinalAuditItemId: executiveItem?.id,
    sourceFinalAuditStage: executiveItem?.stage,
    sourceFinalAuditStatus: executiveItem?.status,
    sourceStatus: executiveItem?.sourceStatus ?? room.status,
    owner: 'Owner',
    reference: 'Launch Closure',
    targetView: 'closure',
    archiveRequirement: 'Retain the owner decision, final audit score, and any accepted risk before archiving launch work.',
    archiveEvidence: executiveItem?.evidence ?? `${room.status} final audit status`,
    handoffPlan: 'Owner confirms retained evidence before archive status moves beyond review.',
    retentionPlan: 'Store owner signoff with final audit and closure snapshot records.',
    rollbackPlan: 'If owner signoff changes, record a new archive entry and keep the prior one for history.',
    nextStep: status === 'Archive Ready' || status === 'Archived' ? 'Owner signoff trail is ready for archive retention.' : executiveItem?.nextStep ?? 'Review owner signoff before archiving.',
    auditRecordCount: executiveItem?.auditRecordCount ?? room.recordCount,
    customerFacingCount: executiveItem?.customerFacingCount ?? 0,
    actionRequiredCount: executiveItem?.actionRequiredCount ?? room.actionRequiredCount,
    readyCount: executiveItem?.readyCount ?? room.readyCount,
    totalCount: executiveItem?.totalCount ?? Math.max(room.totalCount, 1),
    generatedAt,
    actionRequired: status !== 'Archive Ready',
    checks: [
      check('owner-signoff-ready', 'Owner closure signal is ready or archived', status === 'Blocked' ? 'Missing' : status === 'Archive Review' ? 'Review' : 'Ready', executiveItem?.sourceStatus ?? room.status, true),
      check('accepted-risk-retained', 'Accepted risk and closure notes are retention-ready', room.status === 'Audit Review' ? 'Review' : 'Ready', `${room.auditScore}% audit score`, true),
    ],
  }
}

function operationsHandoffItem(room: LaunchFinalAuditRoom, generatedAt: string): LaunchAuditArchiveItem {
  const supportOpenCount = room.items
    .filter(item => item.owner === 'Support Lead' && item.actionRequired)
    .reduce((total, item) => total + Math.max(item.actionRequiredCount, 1), 0)
  const status = room.blockedCount
    ? 'Blocked'
    : supportOpenCount
      ? 'Archive Review'
      : 'Archive Ready'
  return {
    id: 'archive-operations-handoff',
    category: 'Operations Handoff',
    title: 'Operations handoff path retained',
    status,
    sourceStatus: `${supportOpenCount} support follow-up item${supportOpenCount === 1 ? '' : 's'}`,
    owner: 'Support Lead',
    reference: 'Support Operations',
    targetView: 'finalAudit',
    archiveRequirement: 'Confirm support and engineering can replay launch decisions from the retained archive.',
    archiveEvidence: `${room.actionRequiredCount} action-required signals, ${room.customerFacingCount} customer-facing artifacts.`,
    handoffPlan: 'Support Lead owns replay readiness and routes unresolved items through action requests before archive completion.',
    retentionPlan: 'Retain operational handoff notes beside final audit and closure evidence exports.',
    rollbackPlan: 'If support replay fails, mark the archive blocked and reopen the upstream final audit item.',
    nextStep: status === 'Archive Ready' ? 'Archive handoff is clear for operations replay.' : 'Resolve support follow-up before treating launch as archived.',
    auditRecordCount: room.auditRecordCount,
    customerFacingCount: room.customerFacingCount,
    actionRequiredCount: supportOpenCount,
    readyCount: room.items.filter(item => item.owner === 'Support Lead' && !item.actionRequired).length,
    totalCount: Math.max(room.items.filter(item => item.owner === 'Support Lead').length, 1),
    generatedAt,
    actionRequired: status !== 'Archive Ready',
    checks: [
      check('operations-replay-ready', 'Support replay path is clear', supportOpenCount ? 'Review' : 'Ready', `${supportOpenCount} support follow-ups`, true),
      check('action-queue-governed', 'Action-required items stay in governed queues', room.actionRequiredCount ? 'Review' : 'Ready', `${room.actionRequiredCount} action-required signals`, true),
    ],
  }
}

function retentionItem(room: LaunchFinalAuditRoom, records: LaunchAuditArchiveRecord[], generatedAt: string): LaunchAuditArchiveItem {
  const hasArchiveRecord = records.length > 0
  const status = room.status === 'Audit Blocked'
    ? 'Blocked'
    : hasArchiveRecord
      ? 'Archive Ready'
      : room.auditRecordCount || room.recordCount
        ? 'Needs Archive'
        : 'Archive Review'
  return {
    id: 'archive-retention-ledger',
    category: 'Retention',
    title: 'Archive retention ledger established',
    status,
    sourceStatus: `${records.length} archive record${records.length === 1 ? '' : 's'}`,
    owner: 'Engineering',
    reference: 'Archive Retention',
    targetView: 'finalAudit',
    archiveRequirement: 'Create a durable local archive record before considering the launch audit retained.',
    archiveEvidence: `${records.length} archive records, ${room.recordCount} final audit room records, ${room.auditRecordCount} upstream audit records.`,
    handoffPlan: 'Engineering validates that archive metadata is structured for future read-only reporting and data retention views.',
    retentionPlan: 'Keep archive records immutable in the local audit ledger until a server-side archive table is introduced.',
    rollbackPlan: 'If retention metadata is incomplete, keep prior records and create a corrected archive record.',
    nextStep: status === 'Archive Ready' ? 'Retention ledger is established for this launch audit.' : 'Record archive readiness to establish the retention ledger.',
    auditRecordCount: room.auditRecordCount + room.recordCount + records.length,
    customerFacingCount: 0,
    actionRequiredCount: hasArchiveRecord ? 0 : 1,
    readyCount: hasArchiveRecord ? 1 : 0,
    totalCount: 1,
    generatedAt,
    actionRequired: status !== 'Archive Ready',
    checks: [
      check('archive-record-written', 'Archive record exists', hasArchiveRecord ? 'Ready' : 'Missing', `${records.length} archive records`, true),
      check('server-mutation-absent', 'Archive vault remains local and read-only', 'Ready', 'No browser-side production archive mutation.', true),
    ],
  }
}

function applyRecordedArchiveStatus(item: LaunchAuditArchiveItem, record?: LaunchAuditArchiveRecord): LaunchAuditArchiveItem {
  if (!record) return item
  const status = record.itemStatus
  return {
    ...item,
    status,
    actionRequired: status === 'Blocked' || status === 'Needs Archive' || status === 'Archive Review',
    checks: item.checks.map(checkItem => checkItem.id === 'archive-record-written'
      ? { ...checkItem, status: 'Ready', evidence: `Recorded ${record.itemStatus} at ${record.recordedAt}` }
      : checkItem),
  }
}

function latestRecordByItem(records: LaunchAuditArchiveRecord[]) {
  const recordMap = new Map<string, LaunchAuditArchiveRecord>()
  records.forEach(record => {
    if (record.itemId && !recordMap.has(record.itemId)) {
      recordMap.set(record.itemId, record)
    }
  })
  return recordMap
}

function buildCategoryGroups(items: LaunchAuditArchiveItem[]): LaunchAuditArchiveCategoryGroup[] {
  const categories = Array.from(new Set(items.map(item => item.category)))
  return categories.map(category => {
    const rows = items.filter(item => item.category === category)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Archive' || item.status === 'Archive Review') ?? rows[0]
    return {
      category,
      status: nextItem?.status ?? 'Archive Review',
      owner: nextItem?.owner ?? 'Owner',
      itemCount: rows.length,
      archiveEvidence: nextItem?.archiveEvidence ?? 'No archive evidence available.',
      nextStep: nextItem?.nextStep ?? 'No archive follow-up needed.',
    }
  }).sort((a, b) => archiveStatusSort(a.status).localeCompare(archiveStatusSort(b.status)) || a.category.localeCompare(b.category))
}

function buildOwnerGroups(items: LaunchAuditArchiveItem[]): LaunchAuditArchiveOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.owner)))
  return owners.map(owner => {
    const rows = items.filter(item => item.owner === owner)
    const nextItem = rows.find(item => item.status === 'Blocked' || item.status === 'Needs Archive' || item.status === 'Archive Review') ?? rows[0]
    return {
      owner,
      total: rows.length,
      blocked: rows.filter(item => item.status === 'Blocked').length,
      needsArchive: rows.filter(item => item.status === 'Needs Archive').length,
      review: rows.filter(item => item.status === 'Archive Review').length,
      ready: rows.filter(item => item.status === 'Archive Ready').length,
      archived: rows.filter(item => item.status === 'Archived').length,
      nextStep: nextItem?.nextStep ?? 'No archive follow-up needed.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.needsArchive - a.needsArchive || b.review - a.review || a.owner.localeCompare(b.owner))
}

function getAggregateStatus(
  blockedCount: number,
  needsArchiveCount: number,
  reviewCount: number,
  readyCount: number,
  archivedCount: number,
  totalCount: number,
): LaunchAuditArchiveVaultStatus {
  if (blockedCount) return 'Archive Blocked'
  if (needsArchiveCount || reviewCount) return 'Archive Review'
  if (archivedCount === totalCount) return 'Archived'
  if (readyCount || archivedCount) return 'Archive Ready'
  return 'Archive Review'
}

function getHeadline(status: LaunchAuditArchiveVaultStatus, blockedCount: number, needsArchiveCount: number, reviewCount: number, readyCount: number) {
  if (status === 'Archive Blocked') return `${blockedCount} archive item${blockedCount === 1 ? '' : 's'} blocked`
  if (status === 'Archive Review') return `${needsArchiveCount + reviewCount} archive item${needsArchiveCount + reviewCount === 1 ? '' : 's'} need review`
  if (status === 'Archive Ready') return `${readyCount} archive item${readyCount === 1 ? '' : 's'} ready`
  return 'Launch audit archive is retained'
}

function getSummary(
  status: LaunchAuditArchiveVaultStatus,
  total: number,
  blockedCount: number,
  needsArchiveCount: number,
  reviewCount: number,
  archivedCount: number,
  finalAuditScore: number,
) {
  if (status === 'Archive Blocked') return `${blockedCount} of ${total} archive items are blocked. Keep launch closure open until archive evidence is corrected.`
  if (status === 'Archive Review') return `${needsArchiveCount + reviewCount} of ${total} archive items need retention review. Final audit score is ${finalAuditScore}%.`
  if (status === 'Archive Ready') return `Archive package is ready for retained handoff with ${finalAuditScore}% final audit coverage.`
  return `${archivedCount} archive items are retained and available for operational replay.`
}

function archiveStatusSort(status: LaunchAuditArchiveItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Archive') return '1 Needs Archive'
  if (status === 'Archive Review') return '2 Archive Review'
  if (status === 'Archive Ready') return '3 Archive Ready'
  return '4 Archived'
}

function check(id: string, label: string, status: LaunchAuditArchiveCheckStatus, evidence: string, required: boolean): LaunchAuditArchiveCheck {
  return { id, label, status, evidence, required }
}

function emitLaunchAuditArchiveRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
