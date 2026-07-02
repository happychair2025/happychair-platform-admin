import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { BackendClosureEvidenceBinder } from './backendClosureEvidenceBinder'
import type { ExecutiveGoNoGoRoom } from './executiveGoNoGoRoom'
import type { LaunchArtifactManifestModel } from './launchArtifactManifest'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchCommandSavedViewsModel } from './launchCommandSavedViews'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchExceptionSlaBoard } from './launchExceptionSlaBoard'
import type { LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchOwnerDailyBrief } from './launchOwnerDailyBrief'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchWarRoomTimeline } from './launchWarRoomTimeline'
import type { ProductionGuardrailMatrix } from './productionGuardrailMatrix'

export type LaunchEvidencePacketStatus = 'Blocked' | 'Incomplete' | 'Ready For Review' | 'Complete'
export type LaunchEvidencePacketItemStatus = 'Missing' | 'Review' | 'Ready' | 'Verified'
export type LaunchEvidencePacketCategory =
  | 'Owner Brief'
  | 'Go / No-Go'
  | 'SLA'
  | 'Guardrails'
  | 'Backend Closure'
  | 'War Room'
  | 'Saved Views'
  | 'Audit'
  | 'Follow-Up'
  | 'Closure'
  | 'Manifest'

export type LaunchEvidencePacketSurface =
  | 'command'
  | 'goNoGo'
  | 'backendClosure'
  | 'productionGuardrails'
  | 'followup'
  | 'warRoom'
  | 'savedViews'
  | 'exceptionSla'
  | 'ownerBrief'
  | 'closure'
  | 'brief'
  | 'manifest'
  | 'approval'
  | 'watch'
  | 'detail'

export interface LaunchEvidencePacketItem {
  id: string
  category: LaunchEvidencePacketCategory
  title: string
  status: LaunchEvidencePacketItemStatus
  required: boolean
  owner: string
  reference: string
  evidence: string
  nextStep: string
  updatedAt: string
  auditBacked: boolean
  localOnly: boolean
  surface: LaunchEvidencePacketSurface
}

export interface LaunchEvidencePacketCategoryGroup {
  category: LaunchEvidencePacketCategory
  total: number
  missing: number
  review: number
  ready: number
  verified: number
  requiredOpen: number
  nextStep: string
}

export interface LaunchEvidencePacketOwnerGroup {
  owner: string
  total: number
  missing: number
  review: number
  ready: number
  verified: number
  requiredOpen: number
  nextStep: string
}

export interface LaunchEvidencePacketRecord {
  id: string
  status: LaunchEvidencePacketStatus
  headline: string
  itemCount: number
  requiredCount: number
  requiredSatisfiedCount: number
  missingCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  auditBackedCount: number
  localOnlyCount: number
  topGapTitle: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchEvidencePacket {
  status: LaunchEvidencePacketStatus
  headline: string
  summary: string
  generatedAt: string
  launchStatus: LaunchReadinessModel['status']
  readinessScore: number
  goNoGoDecision: ExecutiveGoNoGoRoom['decision']
  items: LaunchEvidencePacketItem[]
  gaps: LaunchEvidencePacketItem[]
  nextItem?: LaunchEvidencePacketItem
  requiredCount: number
  requiredSatisfiedCount: number
  missingCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  auditBackedCount: number
  localOnlyCount: number
  recordCount: number
  latestRecord?: LaunchEvidencePacketRecord
  ownerGroups: LaunchEvidencePacketOwnerGroup[]
  categoryGroups: LaunchEvidencePacketCategoryGroup[]
}

interface BuildLaunchEvidencePacketAssemblerInput {
  readinessModel: LaunchReadinessModel
  closureModel: LaunchClosureModel
  artifactManifest: LaunchArtifactManifestModel
  executiveGoNoGoRoom: ExecutiveGoNoGoRoom
  launchOwnerDailyBrief: LaunchOwnerDailyBrief
  launchExceptionSlaBoard: LaunchExceptionSlaBoard
  launchCommandSavedViews: LaunchCommandSavedViewsModel
  launchWarRoomTimeline: LaunchWarRoomTimeline
  productionGuardrailMatrix: ProductionGuardrailMatrix
  backendClosureEvidenceBinder: BackendClosureEvidenceBinder
  followUpRegister: LaunchFollowUpRegisterModel
  evidenceLedger: LaunchEvidenceLedger
  records: LaunchEvidencePacketRecord[]
}

interface SaveLaunchEvidencePacketRecordInput {
  packet: LaunchEvidencePacket
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_evidence_packet_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchEvidencePacketRecord[] = []

export const launchEvidencePacketBoundaryRule =
  'Launch Evidence Packets are local review, export, and handoff artifacts only. Recording or exporting a packet does not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchEvidencePacketAssembler(input: BuildLaunchEvidencePacketAssemblerInput): LaunchEvidencePacket {
  const generatedAt = new Date().toISOString()
  const items = buildItems(input, generatedAt)
    .sort((a, b) => itemStatusRank(b.status) - itemStatusRank(a.status) || Number(b.required) - Number(a.required) || a.category.localeCompare(b.category))
  const requiredItems = items.filter(item => item.required)
  const gaps = items.filter(item => item.status === 'Missing' || item.status === 'Review')
  const missingCount = items.filter(item => item.status === 'Missing').length
  const reviewCount = items.filter(item => item.status === 'Review').length
  const readyCount = items.filter(item => item.status === 'Ready').length
  const verifiedCount = items.filter(item => item.status === 'Verified').length
  const requiredSatisfiedCount = requiredItems.filter(item => item.status === 'Ready' || item.status === 'Verified').length
  const status = getPacketStatus(requiredItems)

  return {
    status,
    headline: getPacketHeadline(status, input, gaps.length),
    summary: getPacketSummary(status, missingCount, reviewCount, requiredSatisfiedCount, requiredItems.length),
    generatedAt,
    launchStatus: input.readinessModel.status,
    readinessScore: input.readinessModel.score,
    goNoGoDecision: input.executiveGoNoGoRoom.decision,
    items,
    gaps,
    nextItem: gaps[0] ?? items.find(item => item.status === 'Ready') ?? items[0],
    requiredCount: requiredItems.length,
    requiredSatisfiedCount,
    missingCount,
    reviewCount,
    readyCount,
    verifiedCount,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    localOnlyCount: items.filter(item => item.localOnly).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    ownerGroups: buildOwnerGroups(items),
    categoryGroups: buildCategoryGroups(items),
  }
}

export function getLaunchEvidencePacketRecords(): LaunchEvidencePacketRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchEvidencePacketRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchEvidencePacketRecord(input: SaveLaunchEvidencePacketRecordInput) {
  const record: LaunchEvidencePacketRecord = {
    id: crypto.randomUUID(),
    status: input.packet.status,
    headline: input.packet.headline,
    itemCount: input.packet.items.length,
    requiredCount: input.packet.requiredCount,
    requiredSatisfiedCount: input.packet.requiredSatisfiedCount,
    missingCount: input.packet.missingCount,
    reviewCount: input.packet.reviewCount,
    readyCount: input.packet.readyCount,
    verifiedCount: input.packet.verifiedCount,
    auditBackedCount: input.packet.auditBackedCount,
    localOnlyCount: input.packet.localOnlyCount,
    topGapTitle: input.packet.nextItem?.title ?? 'No open packet gap',
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchEvidencePacketRecords()].slice(0, 120)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchEvidencePacketRecordChange()
  return record
}

export function subscribeToLaunchEvidencePacketRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchEvidencePacketRecords() {
  return useSyncExternalStore(subscribeToLaunchEvidencePacketRecords, getLaunchEvidencePacketRecords, () => [])
}

export function getLaunchEvidencePacketStatusTone(status: LaunchEvidencePacketStatus) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Incomplete') return 'warn' as const
  if (status === 'Ready For Review') return 'neutral' as const
  return 'ok' as const
}

export function getLaunchEvidencePacketItemTone(status: LaunchEvidencePacketItemStatus) {
  if (status === 'Missing') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  if (status === 'Ready') return 'info' as const
  return 'ok' as const
}

export function getLaunchEvidencePacketFilename(packet: LaunchEvidencePacket) {
  return `launch-evidence-packet-${packet.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchEvidencePacketHtml(packet: LaunchEvidencePacket, session: AdminSession) {
  const itemRows = packet.items.map(item => `
    <tr>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${item.required ? 'Yes' : 'No'}</td>
      <td>${item.auditBacked ? 'Yes' : 'No'}</td>
      <td>${escapeHtml(item.evidence)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')
  const gapRows = packet.gaps.map(item => `
    <tr>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.reference)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')
  const ownerRows = packet.ownerGroups.map(group => `
    <tr>
      <td>${escapeHtml(group.owner)}</td>
      <td>${group.total}</td>
      <td>${group.missing}</td>
      <td>${group.review}</td>
      <td>${group.ready}</td>
      <td>${group.verified}</td>
      <td>${escapeHtml(group.nextStep)}</td>
    </tr>
  `).join('')
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Launch Evidence Packet</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17211c; margin: 40px; background: #f8faf7; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 28px; }
      .meta, .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
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
    <h1>${escapeHtml(packet.headline)}</h1>
    <p>${escapeHtml(packet.summary)}</p>
    <div class="meta">
      <div class="card"><span>Status</span><strong>${escapeHtml(packet.status)}</strong></div>
      <div class="card"><span>Required Satisfied</span><strong>${packet.requiredSatisfiedCount}/${packet.requiredCount}</strong></div>
      <div class="card"><span>Gaps</span><strong>${packet.missingCount} missing / ${packet.reviewCount} review</strong></div>
      <div class="card"><span>Audit Backed</span><strong>${packet.auditBackedCount}/${packet.items.length}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(packet.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This packet is review evidence only and does not execute production changes.
    </div>
    <h2>Open Packet Gaps</h2>
    <table>
      <thead><tr><th>Status</th><th>Title</th><th>Owner</th><th>Reference</th><th>Next Step</th></tr></thead>
      <tbody>${gapRows || '<tr><td colspan="5">No open packet gaps.</td></tr>'}</tbody>
    </table>
    <h2>Evidence Items</h2>
    <table>
      <thead><tr><th>Category</th><th>Status</th><th>Title</th><th>Owner</th><th>Required</th><th>Audit</th><th>Evidence</th><th>Next Step</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <h2>Owner Load</h2>
    <table>
      <thead><tr><th>Owner</th><th>Total</th><th>Missing</th><th>Review</th><th>Ready</th><th>Verified</th><th>Next Step</th></tr></thead>
      <tbody>${ownerRows}</tbody>
    </table>
  </body>
</html>`
}

function buildItems(input: BuildLaunchEvidencePacketAssemblerInput, generatedAt: string): LaunchEvidencePacketItem[] {
  return [
    {
      id: 'owner-brief',
      category: 'Owner Brief',
      title: 'Owner daily brief attached',
      status: statusFromOwnerBrief(input.launchOwnerDailyBrief),
      required: true,
      owner: 'Owner',
      reference: 'Launch Owner Daily Brief',
      evidence: `${input.launchOwnerDailyBrief.status}: ${input.launchOwnerDailyBrief.decisionCount} decisions, ${input.launchOwnerDailyBrief.criticalCount} critical, ${input.launchOwnerDailyBrief.actionHandoffCount} action handoffs.`,
      nextStep: input.launchOwnerDailyBrief.nextDecision?.ask ?? 'Record the owner brief after final review.',
      updatedAt: input.launchOwnerDailyBrief.latestRecord?.recordedAt ?? input.launchOwnerDailyBrief.generatedAt,
      auditBacked: input.launchOwnerDailyBrief.recordCount > 0 || input.launchOwnerDailyBrief.auditBackedCount > 0,
      localOnly: true,
      surface: 'ownerBrief',
    },
    {
      id: 'go-no-go',
      category: 'Go / No-Go',
      title: 'Executive Go / No-Go decision evidence',
      status: statusFromGoNoGo(input.executiveGoNoGoRoom),
      required: true,
      owner: 'Owner',
      reference: 'Executive Go / No-Go Room',
      evidence: `${input.executiveGoNoGoRoom.decision}: ${input.executiveGoNoGoRoom.requiredClearCount}/${input.executiveGoNoGoRoom.requiredCount} required evidence items clear, ${input.executiveGoNoGoRoom.blockedCount} blocked.`,
      nextStep: input.executiveGoNoGoRoom.nextItem?.nextStep ?? 'Keep go/no-go evidence attached to the launch packet.',
      updatedAt: input.executiveGoNoGoRoom.latestRecord?.recordedAt ?? input.executiveGoNoGoRoom.generatedAt,
      auditBacked: input.executiveGoNoGoRoom.recordCount > 0 || input.executiveGoNoGoRoom.auditBackedCount > 0,
      localOnly: true,
      surface: 'goNoGo',
    },
    {
      id: 'exception-sla',
      category: 'SLA',
      title: 'Exception SLA board captured',
      status: statusFromExceptionSla(input.launchExceptionSlaBoard),
      required: true,
      owner: input.launchExceptionSlaBoard.nextItem?.owner ?? 'Support Lead',
      reference: 'Launch Exception SLA Board',
      evidence: `${input.launchExceptionSlaBoard.status}: ${input.launchExceptionSlaBoard.overdueCount} overdue, ${input.launchExceptionSlaBoard.dueSoonCount} due soon, ${input.launchExceptionSlaBoard.actionHandoffCount} action handoffs.`,
      nextStep: input.launchExceptionSlaBoard.nextItem?.nextStep ?? 'Keep exception SLA monitoring active through launch close.',
      updatedAt: input.launchExceptionSlaBoard.latestRecord?.recordedAt ?? input.launchExceptionSlaBoard.generatedAt,
      auditBacked: input.launchExceptionSlaBoard.recordCount > 0 || input.launchExceptionSlaBoard.auditBackedCount > 0,
      localOnly: true,
      surface: 'exceptionSla',
    },
    {
      id: 'production-guardrails',
      category: 'Guardrails',
      title: 'Production guardrails verified',
      status: statusFromProductionGuardrails(input.productionGuardrailMatrix),
      required: true,
      owner: input.productionGuardrailMatrix.nextItem?.guardrailOwner ?? 'Engineering',
      reference: 'Production Guardrails',
      evidence: `${input.productionGuardrailMatrix.status}: ${input.productionGuardrailMatrix.requiredSatisfiedCount}/${input.productionGuardrailMatrix.requiredCount} required guardrails satisfied, ${input.productionGuardrailMatrix.blockedCount} blocked.`,
      nextStep: input.productionGuardrailMatrix.nextItem?.nextStep ?? 'Keep production guardrail evidence attached to the packet.',
      updatedAt: input.productionGuardrailMatrix.nextItem?.reviewedAt ?? input.productionGuardrailMatrix.generatedAt,
      auditBacked: input.productionGuardrailMatrix.auditBackedCount > 0,
      localOnly: true,
      surface: 'productionGuardrails',
    },
    {
      id: 'backend-closure',
      category: 'Backend Closure',
      title: 'Backend closure evidence binder',
      status: statusFromBackendClosure(input.backendClosureEvidenceBinder),
      required: true,
      owner: input.backendClosureEvidenceBinder.nextItem?.closureOwner ?? 'Engineering',
      reference: 'Backend Closure',
      evidence: `${input.backendClosureEvidenceBinder.status}: ${input.backendClosureEvidenceBinder.closedCount} closed, ${input.backendClosureEvidenceBinder.packetReadyCount} packet ready, ${input.backendClosureEvidenceBinder.blockedCount} blocked.`,
      nextStep: input.backendClosureEvidenceBinder.nextItem?.nextStep ?? 'Keep backend closure packet evidence attached.',
      updatedAt: input.backendClosureEvidenceBinder.nextItem?.reviewedAt ?? input.backendClosureEvidenceBinder.generatedAt,
      auditBacked: input.backendClosureEvidenceBinder.auditBackedCount > 0,
      localOnly: true,
      surface: 'backendClosure',
    },
    {
      id: 'war-room',
      category: 'War Room',
      title: 'War room timeline attached',
      status: statusFromWarRoom(input.launchWarRoomTimeline),
      required: true,
      owner: input.launchWarRoomTimeline.nextEvent?.owner ?? 'Owner',
      reference: 'Launch War Room Timeline',
      evidence: `${input.launchWarRoomTimeline.status}: ${input.launchWarRoomTimeline.criticalCount} critical, ${input.launchWarRoomTimeline.actionNeededCount} action needed, ${input.launchWarRoomTimeline.auditBackedCount} audit backed.`,
      nextStep: input.launchWarRoomTimeline.nextEvent?.nextStep ?? 'Keep timeline pulses current during launch.',
      updatedAt: input.launchWarRoomTimeline.nextEvent?.occurredAt ?? input.launchWarRoomTimeline.generatedAt,
      auditBacked: input.launchWarRoomTimeline.auditBackedCount > 0,
      localOnly: input.launchWarRoomTimeline.localOnlyCount > 0,
      surface: 'warRoom',
    },
    {
      id: 'saved-views',
      category: 'Saved Views',
      title: 'Saved command views ready',
      status: statusFromSavedViews(input.launchCommandSavedViews),
      required: true,
      owner: 'Owner',
      reference: 'Launch Command Saved Views',
      evidence: `${input.launchCommandSavedViews.status}: ${input.launchCommandSavedViews.totalResultCount} results, ${input.launchCommandSavedViews.blockedViewCount} blocked views, ${input.launchCommandSavedViews.auditBackedResultCount} audit backed results.`,
      nextStep: input.launchCommandSavedViews.views.find(view => view.status !== 'Clear')?.nextStep ?? 'Keep saved views available for owner, support, engineering, and audit review.',
      updatedAt: input.launchCommandSavedViews.latestRecord?.recordedAt ?? input.launchCommandSavedViews.generatedAt,
      auditBacked: input.launchCommandSavedViews.savedRecordCount > 0 || input.launchCommandSavedViews.auditBackedResultCount > 0,
      localOnly: true,
      surface: 'savedViews',
    },
    {
      id: 'audit-ledger',
      category: 'Audit',
      title: 'Audit evidence ledger attached',
      status: statusFromAuditLedger(input.evidenceLedger),
      required: true,
      owner: 'Engineering',
      reference: 'Launch Evidence Ledger',
      evidence: `${input.evidenceLedger.entries.length} evidence items, ${input.evidenceLedger.auditEventCount} audit events, ${input.evidenceLedger.packetCount} packet records, ${input.evidenceLedger.actionQueueCount} action queue entries.`,
      nextStep: input.evidenceLedger.blockedCount ? 'Resolve blocked evidence items before packet approval.' : 'Preserve audit ledger references with the packet export.',
      updatedAt: input.evidenceLedger.entries[0]?.createdAt ?? generatedAt,
      auditBacked: input.evidenceLedger.auditEventCount > 0,
      localOnly: false,
      surface: 'detail',
    },
    {
      id: 'follow-up',
      category: 'Follow-Up',
      title: 'Follow-up register reviewed',
      status: statusFromFollowUp(input.followUpRegister),
      required: true,
      owner: input.followUpRegister.nextItem?.owner ?? 'Client Success',
      reference: 'Launch Follow-Up Register',
      evidence: `${input.followUpRegister.blockedCount} blocked, ${input.followUpRegister.openCount} open, ${input.followUpRegister.inProgressCount} in progress, ${input.followUpRegister.resolvedCount} resolved follow-ups.`,
      nextStep: input.followUpRegister.nextItem?.nextStep ?? 'Keep unresolved follow-ups visible after launch.',
      updatedAt: input.followUpRegister.nextItem?.updatedAt ?? input.followUpRegister.nextItem?.createdAt ?? generatedAt,
      auditBacked: input.followUpRegister.items.some(item => item.auditBacked),
      localOnly: true,
      surface: 'followup',
    },
    {
      id: 'closure',
      category: 'Closure',
      title: 'Closure checklist ready for executive sign-off',
      status: statusFromClosure(input.closureModel),
      required: true,
      owner: 'Owner',
      reference: 'Launch Closure',
      evidence: `${input.closureModel.decision}: ${input.closureModel.completeRequiredCount}/${input.closureModel.requiredCount} required complete, ${input.closureModel.blockedCount} blocked, ${input.closureModel.reviewCount} review.`,
      nextStep: input.closureModel.checklist.find(item => item.status !== 'Complete')?.nextStep ?? 'Record final closure decision after packet review.',
      updatedAt: input.closureModel.generatedAt,
      auditBacked: input.closureModel.evidenceItemCount > 0,
      localOnly: true,
      surface: 'closure',
    },
    {
      id: 'manifest',
      category: 'Manifest',
      title: 'Artifact manifest complete',
      status: statusFromManifest(input.artifactManifest),
      required: true,
      owner: input.artifactManifest.gaps[0]?.owner ?? 'Owner',
      reference: 'Artifact Manifest',
      evidence: `${input.artifactManifest.status}: ${input.artifactManifest.readyRequiredCount}/${input.artifactManifest.requiredCount} required artifacts ready, ${input.artifactManifest.blockedCount} blocked, ${input.artifactManifest.reviewCount} review.`,
      nextStep: input.artifactManifest.gaps[0]?.nextStep ?? 'Attach the exportable artifact manifest to the packet.',
      updatedAt: input.artifactManifest.artifacts[0]?.updatedAt ?? input.artifactManifest.generatedAt,
      auditBacked: input.artifactManifest.auditBackedCount > 0,
      localOnly: true,
      surface: 'manifest',
    },
  ]
}

function statusFromOwnerBrief(brief: LaunchOwnerDailyBrief): LaunchEvidencePacketItemStatus {
  if (brief.status === 'Blocked') return 'Missing'
  if (brief.status === 'Attention') return 'Review'
  return brief.recordCount > 0 ? 'Verified' : 'Ready'
}

function statusFromGoNoGo(room: ExecutiveGoNoGoRoom): LaunchEvidencePacketItemStatus {
  if (room.decision === 'No Go' || room.blockedCount > 0) return 'Missing'
  if (room.decision === 'Conditional Go' || room.conditionCount > 0) return 'Review'
  return room.recordCount > 0 ? 'Verified' : 'Ready'
}

function statusFromExceptionSla(board: LaunchExceptionSlaBoard): LaunchEvidencePacketItemStatus {
  if (board.status === 'Overdue') return 'Missing'
  if (board.status === 'Due Soon' || board.status === 'Needs Review') return 'Review'
  return board.recordCount > 0 || board.status === 'Acknowledged' ? 'Verified' : 'Ready'
}

function statusFromProductionGuardrails(matrix: ProductionGuardrailMatrix): LaunchEvidencePacketItemStatus {
  if (matrix.status === 'Blocked') return 'Missing'
  if (matrix.status === 'Guardrail Review') return 'Review'
  if (matrix.status === 'Ready For Production Review') return 'Ready'
  return 'Verified'
}

function statusFromBackendClosure(binder: BackendClosureEvidenceBinder): LaunchEvidencePacketItemStatus {
  if (binder.status === 'Blocked') return 'Missing'
  if (binder.status === 'Evidence Review') return 'Review'
  if (binder.status === 'Ready For Closure' || binder.status === 'Packet Ready') return 'Ready'
  return 'Verified'
}

function statusFromWarRoom(timeline: LaunchWarRoomTimeline): LaunchEvidencePacketItemStatus {
  if (timeline.status === 'Critical') return 'Missing'
  if (timeline.status === 'Review') return 'Review'
  if (timeline.status === 'Active') return 'Ready'
  return 'Verified'
}

function statusFromSavedViews(model: LaunchCommandSavedViewsModel): LaunchEvidencePacketItemStatus {
  if (model.status === 'Blocked') return 'Missing'
  if (model.status === 'Review') return 'Review'
  return model.savedRecordCount > 0 ? 'Verified' : 'Ready'
}

function statusFromAuditLedger(ledger: LaunchEvidenceLedger): LaunchEvidencePacketItemStatus {
  if (ledger.blockedCount > 0) return 'Missing'
  if (ledger.watchCount > 0) return 'Review'
  if (ledger.auditEventCount > 0 && ledger.packetCount > 0) return 'Verified'
  return 'Ready'
}

function statusFromFollowUp(register: LaunchFollowUpRegisterModel): LaunchEvidencePacketItemStatus {
  if (register.blockedCount > 0) return 'Missing'
  if (register.openCount > 0 || register.inProgressCount > 0 || register.criticalCount > 0) return 'Review'
  return register.resolvedCount > 0 ? 'Verified' : 'Ready'
}

function statusFromClosure(model: LaunchClosureModel): LaunchEvidencePacketItemStatus {
  if (model.decision === 'No Go' || model.blockedCount > 0) return 'Missing'
  if (model.decision === 'Conditional Go' || model.reviewCount > 0 || model.missingApprovalCount > 0) return 'Review'
  return model.readyForExecutiveSignOff ? 'Verified' : 'Ready'
}

function statusFromManifest(model: LaunchArtifactManifestModel): LaunchEvidencePacketItemStatus {
  if (model.status === 'Incomplete') return 'Missing'
  if (model.status === 'Needs Owner Review') return 'Review'
  return model.auditBackedCount >= model.requiredCount ? 'Verified' : 'Ready'
}

function getPacketStatus(items: LaunchEvidencePacketItem[]): LaunchEvidencePacketStatus {
  if (items.some(item => item.required && item.status === 'Missing')) return 'Blocked'
  if (items.some(item => item.required && item.status === 'Review')) return 'Incomplete'
  if (items.some(item => item.required && item.status === 'Ready')) return 'Ready For Review'
  return 'Complete'
}

function getPacketHeadline(status: LaunchEvidencePacketStatus, input: BuildLaunchEvidencePacketAssemblerInput, gapCount: number) {
  if (status === 'Blocked') return `${gapCount} launch packet gap${gapCount === 1 ? '' : 's'} block evidence handoff`
  if (status === 'Incomplete') return `${gapCount} launch packet gap${gapCount === 1 ? '' : 's'} need owner review`
  if (status === 'Ready For Review') return 'Launch evidence packet is assembled for owner review'
  return `${input.executiveGoNoGoRoom.decision} launch evidence packet is complete`
}

function getPacketSummary(status: LaunchEvidencePacketStatus, missingCount: number, reviewCount: number, requiredSatisfiedCount: number, requiredCount: number) {
  if (status === 'Blocked') return `${missingCount} required evidence item${missingCount === 1 ? '' : 's'} are missing or blocked before launch approval.`
  if (status === 'Incomplete') return `${reviewCount} evidence item${reviewCount === 1 ? '' : 's'} need review before final handoff.`
  if (status === 'Ready For Review') return `${requiredSatisfiedCount}/${requiredCount} required evidence items are satisfied and ready for final owner review.`
  return `All ${requiredCount} required evidence items are verified for launch close.`
}

function buildOwnerGroups(items: LaunchEvidencePacketItem[]): LaunchEvidencePacketOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.owner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.owner === owner)
    const requiredOpen = ownerItems.filter(item => item.required && (item.status === 'Missing' || item.status === 'Review')).length
    const nextItem = ownerItems.find(item => item.status === 'Missing' || item.status === 'Review') ?? ownerItems[0]
    return {
      owner,
      total: ownerItems.length,
      missing: ownerItems.filter(item => item.status === 'Missing').length,
      review: ownerItems.filter(item => item.status === 'Review').length,
      ready: ownerItems.filter(item => item.status === 'Ready').length,
      verified: ownerItems.filter(item => item.status === 'Verified').length,
      requiredOpen,
      nextStep: requiredOpen ? nextItem.nextStep : 'No required packet gaps for this owner.',
    }
  }).sort((a, b) => b.requiredOpen - a.requiredOpen || b.missing - a.missing || b.review - a.review || a.owner.localeCompare(b.owner))
}

function buildCategoryGroups(items: LaunchEvidencePacketItem[]): LaunchEvidencePacketCategoryGroup[] {
  const categories = Array.from(new Set(items.map(item => item.category)))
  return categories.map(category => {
    const categoryItems = items.filter(item => item.category === category)
    const requiredOpen = categoryItems.filter(item => item.required && (item.status === 'Missing' || item.status === 'Review')).length
    const nextItem = categoryItems.find(item => item.status === 'Missing' || item.status === 'Review') ?? categoryItems[0]
    return {
      category,
      total: categoryItems.length,
      missing: categoryItems.filter(item => item.status === 'Missing').length,
      review: categoryItems.filter(item => item.status === 'Review').length,
      ready: categoryItems.filter(item => item.status === 'Ready').length,
      verified: categoryItems.filter(item => item.status === 'Verified').length,
      requiredOpen,
      nextStep: requiredOpen ? nextItem.nextStep : 'Category evidence is packet-ready.',
    }
  }).sort((a, b) => b.requiredOpen - a.requiredOpen || b.missing - a.missing || b.review - a.review || a.category.localeCompare(b.category))
}

function itemStatusRank(status: LaunchEvidencePacketItemStatus) {
  if (status === 'Missing') return 4
  if (status === 'Review') return 3
  if (status === 'Ready') return 2
  return 1
}

function emitLaunchEvidencePacketRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
