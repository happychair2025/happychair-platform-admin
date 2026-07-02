import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type {
  DataStatus,
  PlatformDataSourceKind,
  PlatformReadViewDiagnostic,
} from '../platform-data/PlatformDataContext'
import type { BackendClosureEvidenceBinder } from './backendClosureEvidenceBinder'
import type { LaunchArtifactManifestModel } from './launchArtifactManifest'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchExecutiveBriefModel } from './launchExecutiveBrief'
import type { LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchHandoffApproval } from './launchHandoffApprovals'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchWatchModel } from './launchWatchtower'
import type { ProductionGuardrailMatrix } from './productionGuardrailMatrix'

export type ExecutiveGoNoGoDecision = 'Go' | 'Conditional Go' | 'No Go'
export type ExecutiveGoNoGoEvidenceStatus = 'Clear' | 'Condition' | 'Blocked'
export type ExecutiveGoNoGoEvidenceCategory =
  | 'Launch'
  | 'Closure'
  | 'Executive Brief'
  | 'Manifest'
  | 'Approval'
  | 'Watch'
  | 'Backend Closure'
  | 'Guardrails'
  | 'Follow-Up'
  | 'Actions'
  | 'Data'
  | 'Audit'

export interface ExecutiveGoNoGoEvidenceItem {
  id: string
  category: ExecutiveGoNoGoEvidenceCategory
  title: string
  status: ExecutiveGoNoGoEvidenceStatus
  required: boolean
  owner: string
  reference: string
  evidence: string
  nextStep: string
  updatedAt: string
  auditBacked: boolean
}

export interface ExecutiveGoNoGoSourceGroup {
  category: ExecutiveGoNoGoEvidenceCategory
  total: number
  clear: number
  conditions: number
  blocked: number
  requiredOpen: number
  nextStep: string
}

export interface ExecutiveGoNoGoOwnerGroup {
  owner: string
  total: number
  clear: number
  conditions: number
  blocked: number
  requiredOpen: number
  nextStep: string
}

export interface ExecutiveGoNoGoRoom {
  decision: ExecutiveGoNoGoDecision
  headline: string
  summary: string
  generatedAt: string
  readinessScore: number
  launchStatus: LaunchReadinessModel['status']
  items: ExecutiveGoNoGoEvidenceItem[]
  nextItem?: ExecutiveGoNoGoEvidenceItem
  requiredCount: number
  requiredClearCount: number
  clearCount: number
  conditionCount: number
  blockedCount: number
  auditBackedCount: number
  recordCount: number
  latestRecord?: ExecutiveGoNoGoRecord
  sourceGroups: ExecutiveGoNoGoSourceGroup[]
  ownerGroups: ExecutiveGoNoGoOwnerGroup[]
}

export interface ExecutiveGoNoGoRecord {
  id: string
  decision: ExecutiveGoNoGoDecision
  owner: string
  conditionNote: string
  acceptedRisk: string
  readinessScore: number
  launchStatus: LaunchReadinessModel['status']
  blockerCount: number
  conditionCount: number
  requiredClearCount: number
  requiredCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildExecutiveGoNoGoRoomInput {
  readinessModel: LaunchReadinessModel
  closureModel: LaunchClosureModel
  executiveBrief: LaunchExecutiveBriefModel
  artifactManifest: LaunchArtifactManifestModel
  latestHandoffApproval?: LaunchHandoffApproval
  followUpRegister: LaunchFollowUpRegisterModel
  watchtower: LaunchWatchModel
  backendClosureEvidenceBinder: BackendClosureEvidenceBinder
  productionGuardrailMatrix: ProductionGuardrailMatrix
  evidenceLedger: LaunchEvidenceLedger
  actionRequests: AdminActionRequest[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  sourceLabel: string
  dataSourceKind: PlatformDataSourceKind
  dataStatus: DataStatus
  records: ExecutiveGoNoGoRecord[]
}

interface SaveExecutiveGoNoGoRecordInput {
  room: ExecutiveGoNoGoRoom
  decision: ExecutiveGoNoGoDecision
  owner: string
  conditionNote: string
  acceptedRisk: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_executive_go_no_go_records'
const listeners = new Set<() => void>()
const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])
let cachedRawRecords = ''
let cachedRecords: ExecutiveGoNoGoRecord[] = []

export const executiveGoNoGoBoundaryRule =
  'Executive Go / No-Go records are decision evidence only. They do not deploy code, run handlers, roll back production, mutate data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions from Platform Admin.'

export const executiveGoNoGoDecisions: ExecutiveGoNoGoDecision[] = ['Go', 'Conditional Go', 'No Go']

export function buildExecutiveGoNoGoRoom({
  readinessModel,
  closureModel,
  executiveBrief,
  artifactManifest,
  latestHandoffApproval,
  followUpRegister,
  watchtower,
  backendClosureEvidenceBinder,
  productionGuardrailMatrix,
  evidenceLedger,
  actionRequests,
  readViewDiagnostics,
  sourceLabel,
  dataSourceKind,
  dataStatus,
  records,
}: BuildExecutiveGoNoGoRoomInput): ExecutiveGoNoGoRoom {
  const generatedAt = new Date().toISOString()
  const openActions = actionRequests.filter(request => openActionStatuses.has(request.status))
  const blockedActions = openActions.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const fallbackViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback')
  const readyViews = readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready')

  const items: ExecutiveGoNoGoEvidenceItem[] = [
    evidenceItem({
      id: 'go-no-go-launch-readiness',
      category: 'Launch',
      title: 'Launch readiness posture',
      status: statusFromLaunch(readinessModel.status),
      required: true,
      owner: 'Owner',
      reference: 'Launch Gate',
      evidence: `${readinessModel.score}% readiness with ${readinessModel.readyCount} ready, ${readinessModel.watchCount} watch, and ${readinessModel.blockedCount} blocked gates.`,
      nextStep: readinessModel.status === 'Ready' ? 'Keep the current launch review report attached to the executive packet.' : readinessModel.summary,
      updatedAt: readinessModel.generatedAt,
      auditBacked: evidenceLedger.exportCount > 0,
    }),
    evidenceItem({
      id: 'go-no-go-closure',
      category: 'Closure',
      title: 'Closure decision',
      status: statusFromClosure(closureModel.decision),
      required: true,
      owner: 'Owner',
      reference: 'Launch Closure',
      evidence: `${closureModel.decision}: ${closureModel.completeRequiredCount}/${closureModel.requiredCount} required checks complete, ${closureModel.blockedCount} blocked, ${closureModel.reviewCount} review.`,
      nextStep: closureModel.readyForExecutiveSignOff ? 'Attach the closure checklist to final decision evidence.' : closureModel.summary,
      updatedAt: closureModel.generatedAt,
      auditBacked: evidenceLedger.entries.some(entry => entry.reference === 'Launch Closure'),
    }),
    evidenceItem({
      id: 'go-no-go-executive-brief',
      category: 'Executive Brief',
      title: 'Executive brief recommendation',
      status: statusFromRecommendation(executiveBrief.recommendation),
      required: true,
      owner: 'Owner',
      reference: 'Executive Brief',
      evidence: executiveBrief.headline,
      nextStep: executiveBrief.requiredDecisions[0]?.body ?? 'Keep the latest executive brief with the final packet.',
      updatedAt: executiveBrief.generatedAt,
      auditBacked: evidenceLedger.entries.some(entry => entry.evidence.toLowerCase().includes('executive launch brief')),
    }),
    evidenceItem({
      id: 'go-no-go-artifact-manifest',
      category: 'Manifest',
      title: 'Launch artifact manifest',
      status: statusFromManifest(artifactManifest.status),
      required: true,
      owner: 'Owner',
      reference: 'Launch Artifact Manifest',
      evidence: `${artifactManifest.status}: ${artifactManifest.readyRequiredCount}/${artifactManifest.requiredCount} required artifacts ready, ${artifactManifest.blockedCount} blocked, ${artifactManifest.reviewCount} review.`,
      nextStep: artifactManifest.gaps[0]?.nextStep ?? 'Keep the manifest attached to executive handoff.',
      updatedAt: artifactManifest.generatedAt,
      auditBacked: artifactManifest.auditBackedCount > 0,
    }),
    evidenceItem({
      id: 'go-no-go-handoff-approval',
      category: 'Approval',
      title: 'Owner handoff approval',
      status: statusFromHandoff(latestHandoffApproval),
      required: true,
      owner: latestHandoffApproval?.followUpOwner ?? 'Owner',
      reference: 'Handoff Approval',
      evidence: latestHandoffApproval
        ? `${latestHandoffApproval.decision}: ${latestHandoffApproval.conditionNote}`
        : 'No owner handoff approval has been recorded.',
      nextStep: latestHandoffApproval
        ? latestHandoffApproval.acceptedRisk
        : 'Record an approval, conditional approval, or hold before executive Go / No-Go close.',
      updatedAt: latestHandoffApproval?.recordedAt ?? generatedAt,
      auditBacked: Boolean(latestHandoffApproval?.auditEventId),
    }),
    evidenceItem({
      id: 'go-no-go-watchtower',
      category: 'Watch',
      title: 'Launch watchtower',
      status: statusFromWatch(watchtower.status),
      required: true,
      owner: 'Operations',
      reference: 'Launch Watchtower',
      evidence: `${watchtower.status}: ${watchtower.criticalCount} critical, ${watchtower.watchCount} watch, ${watchtower.scoreDrift} point score drift.`,
      nextStep: watchtower.status === 'Stable' ? 'Keep monitoring for drift until the launch window closes.' : watchtower.summary,
      updatedAt: watchtower.generatedAt,
      auditBacked: Boolean(watchtower.baselineApproval?.auditEventId),
    }),
    evidenceItem({
      id: 'go-no-go-backend-closure',
      category: 'Backend Closure',
      title: 'Backend closure evidence',
      status: statusFromBackendClosure(backendClosureEvidenceBinder.status),
      required: true,
      owner: 'Engineering',
      reference: 'Backend Closure Evidence',
      evidence: `${backendClosureEvidenceBinder.status}: ${backendClosureEvidenceBinder.closedCount} closed, ${backendClosureEvidenceBinder.packetReadyCount} packet ready, ${backendClosureEvidenceBinder.blockedCount} blocked.`,
      nextStep: backendClosureEvidenceBinder.nextItem?.nextStep ?? 'Keep closure packets available for final launch review.',
      updatedAt: backendClosureEvidenceBinder.generatedAt,
      auditBacked: backendClosureEvidenceBinder.auditBackedCount > 0,
    }),
    evidenceItem({
      id: 'go-no-go-production-guardrails',
      category: 'Guardrails',
      title: 'Production guardrail matrix',
      status: statusFromGuardrails(productionGuardrailMatrix.status),
      required: true,
      owner: 'Engineering',
      reference: 'Production Guardrails',
      evidence: `${productionGuardrailMatrix.status}: ${productionGuardrailMatrix.requiredSatisfiedCount}/${productionGuardrailMatrix.requiredCount} required guardrails satisfied, ${productionGuardrailMatrix.blockedCount} blocked.`,
      nextStep: productionGuardrailMatrix.nextItem?.nextStep ?? 'Keep guardrail records attached to production review.',
      updatedAt: productionGuardrailMatrix.generatedAt,
      auditBacked: productionGuardrailMatrix.auditBackedCount > 0,
    }),
    evidenceItem({
      id: 'go-no-go-follow-ups',
      category: 'Follow-Up',
      title: 'Follow-up backlog',
      status: followUpRegister.blockedCount
        ? 'Blocked'
        : followUpRegister.openCount || followUpRegister.inProgressCount ? 'Condition' : 'Clear',
      required: true,
      owner: followUpRegister.nextItem?.owner ?? 'Owner',
      reference: 'Launch Follow-Up',
      evidence: `${followUpRegister.openCount} open, ${followUpRegister.inProgressCount} in progress, ${followUpRegister.blockedCount} blocked, ${followUpRegister.criticalCount} critical.`,
      nextStep: followUpRegister.nextItem?.nextStep ?? 'No unresolved launch follow-up is blocking the decision packet.',
      updatedAt: followUpRegister.generatedAt,
      auditBacked: followUpRegister.items.some(item => Boolean(item.auditEventId)),
    }),
    evidenceItem({
      id: 'go-no-go-action-queue',
      category: 'Actions',
      title: 'Admin action queue',
      status: blockedActions.length ? 'Blocked' : openActions.length ? 'Condition' : 'Clear',
      required: true,
      owner: blockedActions[0]?.requestedBy.role ?? openActions[0]?.requestedBy.role ?? 'Operations',
      reference: 'Admin Action Requests',
      evidence: `${openActions.length} open action requests, ${blockedActions.length} blocked or failed.`,
      nextStep: blockedActions[0]?.statusReason ?? openActions[0]?.reason ?? 'No open action requests are blocking final decision evidence.',
      updatedAt: openActions[0]?.updatedAt ?? openActions[0]?.createdAt ?? generatedAt,
      auditBacked: actionRequests.some(request => Boolean(request.auditEventId)),
    }),
    evidenceItem({
      id: 'go-no-go-data-contracts',
      category: 'Data',
      title: 'Read-only data contracts',
      status: fallbackViews.length ? 'Blocked' : dataSourceKind === 'mock' || dataStatus === 'mock' ? 'Condition' : 'Clear',
      required: true,
      owner: 'Engineering',
      reference: 'Read View Diagnostics',
      evidence: `${readyViews.length} ready read views, ${fallbackViews.length} fallback views. Source: ${sourceLabel} / ${dataSourceKind} / ${dataStatus}.`,
      nextStep: fallbackViews[0]?.error ?? (dataSourceKind === 'mock' || dataStatus === 'mock'
        ? 'Confirm mock-read status is acceptable for the current packet or connect approved read-only views.'
        : 'Keep read diagnostics monitored through launch close.'),
      updatedAt: readViewDiagnostics[0]?.loadedAt ?? generatedAt,
      auditBacked: false,
    }),
    evidenceItem({
      id: 'go-no-go-audit-trail',
      category: 'Audit',
      title: 'Audit and evidence ledger',
      status: evidenceLedger.blockedCount
        ? 'Blocked'
        : evidenceLedger.auditEventCount && evidenceLedger.entries.length ? 'Clear' : 'Condition',
      required: true,
      owner: 'Owner',
      reference: 'Evidence Ledger',
      evidence: `${evidenceLedger.entries.length} evidence items, ${evidenceLedger.auditEventCount} audit events, ${evidenceLedger.signOffCount} sign-offs, ${evidenceLedger.packetCount} packet records.`,
      nextStep: evidenceLedger.auditEventCount
        ? 'Keep the audit trail attached to the final decision record.'
        : 'Record at least one audited review, export, approval, or decision before final close.',
      updatedAt: evidenceLedger.entries[0]?.createdAt ?? generatedAt,
      auditBacked: evidenceLedger.auditEventCount > 0,
    }),
  ].sort((a, b) => statusRank(b.status) - statusRank(a.status) || Number(b.required) - Number(a.required) || a.title.localeCompare(b.title))

  const requiredItems = items.filter(item => item.required)
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const conditionCount = items.filter(item => item.status === 'Condition').length
  const clearCount = items.filter(item => item.status === 'Clear').length
  const decision = blockedCount ? 'No Go' : conditionCount ? 'Conditional Go' : 'Go'

  return {
    decision,
    headline: getHeadline(decision, blockedCount, conditionCount),
    summary: getSummary(decision, readinessModel.score, blockedCount, conditionCount),
    generatedAt,
    readinessScore: readinessModel.score,
    launchStatus: readinessModel.status,
    items,
    nextItem: items.find(item => item.status !== 'Clear'),
    requiredCount: requiredItems.length,
    requiredClearCount: requiredItems.filter(item => item.status === 'Clear').length,
    clearCount,
    conditionCount,
    blockedCount,
    auditBackedCount: items.filter(item => item.auditBacked).length,
    recordCount: records.length,
    latestRecord: records[0],
    sourceGroups: buildSourceGroups(items),
    ownerGroups: buildOwnerGroups(items),
  }
}

export function getExecutiveGoNoGoRecords(): ExecutiveGoNoGoRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as ExecutiveGoNoGoRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveExecutiveGoNoGoRecord(input: SaveExecutiveGoNoGoRecordInput) {
  const record: ExecutiveGoNoGoRecord = {
    id: crypto.randomUUID(),
    decision: input.decision,
    owner: input.owner,
    conditionNote: input.conditionNote.trim() || getDefaultConditionNote(input.decision, input.room),
    acceptedRisk: input.acceptedRisk.trim() || getDefaultAcceptedRisk(input.decision, input.room),
    readinessScore: input.room.readinessScore,
    launchStatus: input.room.launchStatus,
    blockerCount: input.room.blockedCount,
    conditionCount: input.room.conditionCount,
    requiredClearCount: input.room.requiredClearCount,
    requiredCount: input.room.requiredCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getExecutiveGoNoGoRecords()].slice(0, 80)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitExecutiveGoNoGoRecordChange()
  return record
}

export function subscribeToExecutiveGoNoGoRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useExecutiveGoNoGoRecords() {
  return useSyncExternalStore(subscribeToExecutiveGoNoGoRecords, getExecutiveGoNoGoRecords, () => [])
}

export function getExecutiveGoNoGoTone(status: ExecutiveGoNoGoDecision | ExecutiveGoNoGoEvidenceStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Go' || status === 'Clear') return 'ok'
  if (status === 'Conditional Go' || status === 'Condition') return 'warn'
  return 'danger'
}

export function getExecutiveGoNoGoFilename(room: ExecutiveGoNoGoRoom) {
  return `executive-go-no-go-room-${room.decision.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildExecutiveGoNoGoHtml(room: ExecutiveGoNoGoRoom, session: AdminSession) {
  const rows = room.items.map(item => `
    <tr>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.evidence)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>
  `).join('')

  const sources = room.sourceGroups.map(group => `
    <tr>
      <td>${escapeHtml(group.category)}</td>
      <td>${group.total}</td>
      <td>${group.clear}</td>
      <td>${group.conditions}</td>
      <td>${group.blocked}</td>
      <td>${escapeHtml(group.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Executive Go / No-Go Evidence Room</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 17px; }
      p, td { line-height: 1.55; }
      .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .meta div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Executive Go / No-Go Evidence Room</p>
        <h1>${escapeHtml(room.headline)}</h1>
        <p>${escapeHtml(room.summary)}</p>
        <p>${escapeHtml(executiveGoNoGoBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Decision</span><strong>${escapeHtml(room.decision)}</strong></div>
        <div><span>Readiness</span><strong>${room.readinessScore}% / ${escapeHtml(room.launchStatus)}</strong></div>
        <div><span>Required Clear</span><strong>${room.requiredClearCount}/${room.requiredCount}</strong></div>
        <div><span>Open Evidence</span><strong>${room.blockedCount} blocked / ${room.conditionCount} condition</strong></div>
        <div><span>Audit Backed</span><strong>${room.auditBackedCount}/${room.items.length}</strong></div>
        <div><span>Records</span><strong>${room.recordCount}</strong></div>
        <div><span>Generated</span><strong>${escapeHtml(room.generatedAt)}</strong></div>
        <div><span>Generated By</span><strong>${escapeHtml(session.name)} / ${escapeHtml(session.email)}</strong></div>
      </section>
      <section>
        <h2>Evidence</h2>
        <table><thead><tr><th>Source</th><th>Evidence</th><th>Status</th><th>Owner</th><th>Proof</th><th>Next Step</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <section>
        <h2>Source Coverage</h2>
        <table><thead><tr><th>Source</th><th>Total</th><th>Clear</th><th>Condition</th><th>Blocked</th><th>Next Step</th></tr></thead><tbody>${sources}</tbody></table>
      </section>
    </main>
  </body>
</html>`
}

function evidenceItem(item: ExecutiveGoNoGoEvidenceItem): ExecutiveGoNoGoEvidenceItem {
  return item
}

function statusFromLaunch(status: LaunchReadinessModel['status']): ExecutiveGoNoGoEvidenceStatus {
  if (status === 'Ready') return 'Clear'
  if (status === 'Watch') return 'Condition'
  return 'Blocked'
}

function statusFromClosure(decision: LaunchClosureModel['decision']): ExecutiveGoNoGoEvidenceStatus {
  if (decision === 'Go') return 'Clear'
  if (decision === 'Conditional Go') return 'Condition'
  return 'Blocked'
}

function statusFromRecommendation(recommendation: LaunchExecutiveBriefModel['recommendation']): ExecutiveGoNoGoEvidenceStatus {
  if (recommendation === 'Proceed') return 'Clear'
  if (recommendation === 'Proceed With Conditions') return 'Condition'
  return 'Blocked'
}

function statusFromManifest(status: LaunchArtifactManifestModel['status']): ExecutiveGoNoGoEvidenceStatus {
  if (status === 'Ready For Handoff') return 'Clear'
  if (status === 'Needs Owner Review') return 'Condition'
  return 'Blocked'
}

function statusFromHandoff(approval: LaunchHandoffApproval | undefined): ExecutiveGoNoGoEvidenceStatus {
  if (!approval) return 'Blocked'
  if (approval.decision === 'Approved') return 'Clear'
  if (approval.decision === 'Approved With Conditions') return 'Condition'
  return 'Blocked'
}

function statusFromWatch(status: LaunchWatchModel['status']): ExecutiveGoNoGoEvidenceStatus {
  if (status === 'Stable') return 'Clear'
  if (status === 'Drift') return 'Condition'
  return 'Blocked'
}

function statusFromBackendClosure(status: BackendClosureEvidenceBinder['status']): ExecutiveGoNoGoEvidenceStatus {
  if (status === 'Closed' || status === 'Packet Ready' || status === 'Ready For Closure') return 'Clear'
  if (status === 'Evidence Review') return 'Condition'
  return 'Blocked'
}

function statusFromGuardrails(status: ProductionGuardrailMatrix['status']): ExecutiveGoNoGoEvidenceStatus {
  if (status === 'Verified' || status === 'Ready For Production Review') return 'Clear'
  if (status === 'Guardrail Review') return 'Condition'
  return 'Blocked'
}

function buildSourceGroups(items: ExecutiveGoNoGoEvidenceItem[]): ExecutiveGoNoGoSourceGroup[] {
  const groups = new Map<ExecutiveGoNoGoEvidenceCategory, ExecutiveGoNoGoEvidenceItem[]>()
  items.forEach(item => {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  })

  return Array.from(groups.entries()).map(([category, groupItems]) => {
    const openItems = groupItems.filter(item => item.status !== 'Clear')
    return {
      category,
      total: groupItems.length,
      clear: groupItems.filter(item => item.status === 'Clear').length,
      conditions: groupItems.filter(item => item.status === 'Condition').length,
      blocked: groupItems.filter(item => item.status === 'Blocked').length,
      requiredOpen: openItems.filter(item => item.required).length,
      nextStep: openItems[0]?.nextStep ?? 'Source is clear for executive decision evidence.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.conditions - a.conditions || a.category.localeCompare(b.category))
}

function buildOwnerGroups(items: ExecutiveGoNoGoEvidenceItem[]): ExecutiveGoNoGoOwnerGroup[] {
  const groups = new Map<string, ExecutiveGoNoGoEvidenceItem[]>()
  items.forEach(item => {
    groups.set(item.owner, [...(groups.get(item.owner) ?? []), item])
  })

  return Array.from(groups.entries()).map(([owner, groupItems]) => {
    const openItems = groupItems.filter(item => item.status !== 'Clear')
    return {
      owner,
      total: groupItems.length,
      clear: groupItems.filter(item => item.status === 'Clear').length,
      conditions: groupItems.filter(item => item.status === 'Condition').length,
      blocked: groupItems.filter(item => item.status === 'Blocked').length,
      requiredOpen: openItems.filter(item => item.required).length,
      nextStep: openItems[0]?.nextStep ?? 'Owner has no open Go / No-Go evidence item.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.conditions - a.conditions || b.requiredOpen - a.requiredOpen || a.owner.localeCompare(b.owner))
}

function getHeadline(decision: ExecutiveGoNoGoDecision, blockedCount: number, conditionCount: number) {
  if (decision === 'No Go') return `No Go: ${blockedCount} launch decision blockers remain`
  if (decision === 'Conditional Go') return `Conditional Go: ${conditionCount} conditions require owner tracking`
  return 'Go: required executive evidence is clear'
}

function getSummary(decision: ExecutiveGoNoGoDecision, readinessScore: number, blockedCount: number, conditionCount: number) {
  if (decision === 'No Go') return `${readinessScore}% readiness cannot move to launch until ${blockedCount} blocker${blockedCount === 1 ? '' : 's'} clear.`
  if (decision === 'Conditional Go') return `${readinessScore}% readiness can move forward only with ${conditionCount} tracked condition${conditionCount === 1 ? '' : 's'} and preserved audit evidence.`
  return `${readinessScore}% readiness is clear for executive Go evidence with required artifacts attached.`
}

function getDefaultConditionNote(decision: ExecutiveGoNoGoDecision, room: ExecutiveGoNoGoRoom) {
  if (decision === 'Go') return 'Approved for launch decision evidence with current room, guardrails, closure packets, approval baseline, and audit trail attached.'
  if (decision === 'Conditional Go') return `${room.conditionCount} conditions remain owner-tracked; no production mutation is authorized by this record.`
  return `${room.blockedCount} blockers prevent launch approval. Hold until open evidence clears.`
}

function getDefaultAcceptedRisk(decision: ExecutiveGoNoGoDecision, room: ExecutiveGoNoGoRoom) {
  if (decision === 'Go') return 'No additional launch risk accepted beyond the current evidence room.'
  if (decision === 'Conditional Go') return `${room.conditionCount} tracked conditions accepted for review continuity only; production changes still require permissioned server handlers.`
  return 'No launch risk accepted while the decision is No Go.'
}

function statusRank(status: ExecutiveGoNoGoEvidenceStatus) {
  if (status === 'Blocked') return 3
  if (status === 'Condition') return 2
  return 1
}

function emitExecutiveGoNoGoRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
