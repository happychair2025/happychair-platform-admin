import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { MockServerExecutionRecord } from '../admin-actions/mockServerExecutor'
import type { AuditEvent } from '../audit/auditLog'
import type { BackendClosureEvidenceRecord } from './backendClosureEvidenceBinder'
import type { BackendEngineeringHandoffPacketReview } from './backendEngineeringHandoffPackets'
import type { BackendExecutionReadinessRecord } from './backendExecutionReadinessDashboard'
import type { BackendHandlerSpecReview } from './backendHandlerSpecs'
import type { BackendImplementationWorkRecord } from './backendImplementationWorkbench'
import type { BackendReleaseCommandRecord } from './backendReleaseCommandCenter'
import type { BackendServerHandlerTestRecord } from './backendServerHandlerTestMatrix'
import type { BackendServerTestEvidencePackRecord } from './backendServerTestEvidencePacks'
import type { BackendWatchRecord } from './backendWatchMonitor'
import type { ExecutiveGoNoGoRecord, ExecutiveGoNoGoRoom } from './executiveGoNoGoRoom'
import type { LaunchClosureSnapshot } from './launchClosureSnapshots'
import type { LaunchDecisionPacket } from './launchDecisionPackets'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchFollowUpRecord, LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchHandoffApproval } from './launchHandoffApprovals'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchGateSignOff } from './launchSignOffs'
import type { LaunchWatchCheck } from './launchWatchtower'
import type { ProductionGuardrailRecord } from './productionGuardrailMatrix'
import type { TrustedHandlerDeploymentRecord } from './trustedHandlerDeploymentChecklist'

export type LaunchWarRoomTimelineStatus = 'Critical' | 'Review' | 'Active' | 'Stable'
export type LaunchWarRoomEventStatus = 'Critical' | 'Action Needed' | 'Recorded' | 'Verified'
export type LaunchWarRoomLane =
  | 'Current Blocker'
  | 'Audit'
  | 'Action Queue'
  | 'Dry Run'
  | 'Decision Packet'
  | 'Approval'
  | 'Closure'
  | 'Follow-Up'
  | 'Watch'
  | 'Backend'
  | 'Guardrail'
  | 'Executive Decision'

export interface LaunchWarRoomTimelineEvent {
  id: string
  lane: LaunchWarRoomLane
  status: LaunchWarRoomEventStatus
  title: string
  owner: string
  source: string
  reference: string
  evidence: string
  nextStep: string
  occurredAt: string
  auditEventId?: string
  actor?: string
  actorRole?: string
  localOnly: boolean
}

export interface LaunchWarRoomLaneGroup {
  lane: LaunchWarRoomLane
  total: number
  critical: number
  actionNeeded: number
  recorded: number
  verified: number
  latestAt: string
  nextStep: string
}

export interface LaunchWarRoomOwnerGroup {
  owner: string
  total: number
  critical: number
  actionNeeded: number
  recorded: number
  verified: number
  latestAt: string
  nextStep: string
}

export interface LaunchWarRoomTimeline {
  status: LaunchWarRoomTimelineStatus
  summary: string
  generatedAt: string
  events: LaunchWarRoomTimelineEvent[]
  nextEvent?: LaunchWarRoomTimelineEvent
  criticalCount: number
  actionNeededCount: number
  recordedCount: number
  verifiedCount: number
  auditBackedCount: number
  localOnlyCount: number
  activeOwnerCount: number
  pulseCount: number
  latestPulse?: LaunchWarRoomPulseRecord
  laneGroups: LaunchWarRoomLaneGroup[]
  ownerGroups: LaunchWarRoomOwnerGroup[]
}

export interface LaunchWarRoomPulseRecord {
  id: string
  status: LaunchWarRoomTimelineStatus
  summary: string
  criticalCount: number
  actionNeededCount: number
  recordedCount: number
  verifiedCount: number
  auditBackedCount: number
  latestEventTitle: string
  latestEventStatus: LaunchWarRoomEventStatus
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchWarRoomTimelineInput {
  readinessModel: LaunchReadinessModel
  evidenceLedger: LaunchEvidenceLedger
  auditEvents: AuditEvent[]
  actionRequests: AdminActionRequest[]
  mockServerExecutions: MockServerExecutionRecord[]
  signOffs: LaunchGateSignOff[]
  decisionPackets: LaunchDecisionPacket[]
  closureSnapshots: LaunchClosureSnapshot[]
  handoffApprovals: LaunchHandoffApproval[]
  followUpRegister: LaunchFollowUpRegisterModel
  followUpRecords: LaunchFollowUpRecord[]
  watchChecks: LaunchWatchCheck[]
  backendImplementationRecords: BackendImplementationWorkRecord[]
  backendHandlerSpecReviews: BackendHandlerSpecReview[]
  engineeringHandoffPacketReviews: BackendEngineeringHandoffPacketReview[]
  serverHandlerTestRecords: BackendServerHandlerTestRecord[]
  serverTestEvidencePackRecords: BackendServerTestEvidencePackRecord[]
  backendExecutionReadinessRecords: BackendExecutionReadinessRecord[]
  trustedHandlerDeploymentRecords: TrustedHandlerDeploymentRecord[]
  backendReleaseCommandRecords: BackendReleaseCommandRecord[]
  backendWatchRecords: BackendWatchRecord[]
  backendClosureEvidenceRecords: BackendClosureEvidenceRecord[]
  productionGuardrailRecords: ProductionGuardrailRecord[]
  executiveGoNoGoRoom: ExecutiveGoNoGoRoom
  executiveGoNoGoRecords: ExecutiveGoNoGoRecord[]
  pulseRecords: LaunchWarRoomPulseRecord[]
}

interface SaveLaunchWarRoomPulseInput {
  timeline: LaunchWarRoomTimeline
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_war_room_pulses'
const listeners = new Set<() => void>()
let cachedRawPulses = ''
let cachedPulses: LaunchWarRoomPulseRecord[] = []

export const launchWarRoomBoundaryRule =
  'Launch War Room Timeline events are operational evidence only. Recording a pulse does not deploy code, execute handlers, roll back production, mutate data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchWarRoomTimeline(input: BuildLaunchWarRoomTimelineInput): LaunchWarRoomTimeline {
  const generatedAt = new Date().toISOString()
  const events = [
    ...currentBlockerEvents(input.readinessModel),
    ...evidenceEvents(input.evidenceLedger),
    ...auditEvents(input.auditEvents),
    ...actionRequestEvents(input.actionRequests),
    ...mockServerExecutionEvents(input.mockServerExecutions),
    ...signOffEvents(input.signOffs),
    ...decisionPacketEvents(input.decisionPackets),
    ...closureSnapshotEvents(input.closureSnapshots),
    ...handoffApprovalEvents(input.handoffApprovals),
    ...followUpCurrentEvents(input.followUpRegister, generatedAt),
    ...followUpRecordEvents(input.followUpRecords),
    ...watchCheckEvents(input.watchChecks),
    ...backendRecordEvents(input),
    ...productionGuardrailEvents(input.productionGuardrailRecords),
    ...executiveDecisionEvents(input.executiveGoNoGoRoom, input.executiveGoNoGoRecords),
  ]
    .filter((event, index, allEvents) => allEvents.findIndex(candidate => candidate.id === event.id) === index)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || statusRank(b.status) - statusRank(a.status))
    .slice(0, 260)

  const criticalCount = events.filter(event => event.status === 'Critical').length
  const actionNeededCount = events.filter(event => event.status === 'Action Needed').length
  const recordedCount = events.filter(event => event.status === 'Recorded').length
  const verifiedCount = events.filter(event => event.status === 'Verified').length
  const status = getTimelineStatus(criticalCount, actionNeededCount, events.length)

  return {
    status,
    summary: getTimelineSummary(status, criticalCount, actionNeededCount, events.length),
    generatedAt,
    events,
    nextEvent: events.find(event => event.status === 'Critical' || event.status === 'Action Needed') ?? events[0],
    criticalCount,
    actionNeededCount,
    recordedCount,
    verifiedCount,
    auditBackedCount: events.filter(event => Boolean(event.auditEventId)).length,
    localOnlyCount: events.filter(event => event.localOnly).length,
    activeOwnerCount: new Set(events.filter(event => event.status === 'Critical' || event.status === 'Action Needed').map(event => event.owner)).size,
    pulseCount: input.pulseRecords.length,
    latestPulse: input.pulseRecords[0],
    laneGroups: buildLaneGroups(events),
    ownerGroups: buildOwnerGroups(events),
  }
}

export function getLaunchWarRoomPulses(): LaunchWarRoomPulseRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawPulses = localStorage.getItem(storageKey) ?? '[]'
  if (rawPulses === cachedRawPulses) return cachedPulses

  try {
    cachedRawPulses = rawPulses
    cachedPulses = JSON.parse(rawPulses) as LaunchWarRoomPulseRecord[]
    return cachedPulses
  } catch {
    cachedRawPulses = rawPulses
    cachedPulses = []
    return []
  }
}

export function saveLaunchWarRoomPulse(input: SaveLaunchWarRoomPulseInput) {
  const record: LaunchWarRoomPulseRecord = {
    id: crypto.randomUUID(),
    status: input.timeline.status,
    summary: input.timeline.summary,
    criticalCount: input.timeline.criticalCount,
    actionNeededCount: input.timeline.actionNeededCount,
    recordedCount: input.timeline.recordedCount,
    verifiedCount: input.timeline.verifiedCount,
    auditBackedCount: input.timeline.auditBackedCount,
    latestEventTitle: input.timeline.nextEvent?.title ?? 'No timeline event selected',
    latestEventStatus: input.timeline.nextEvent?.status ?? 'Recorded',
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const pulses = [record, ...getLaunchWarRoomPulses()].slice(0, 120)

  cachedPulses = pulses
  cachedRawPulses = JSON.stringify(pulses)
  localStorage.setItem(storageKey, cachedRawPulses)
  emitLaunchWarRoomPulseChange()
  return record
}

export function subscribeToLaunchWarRoomPulses(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchWarRoomPulses() {
  return useSyncExternalStore(subscribeToLaunchWarRoomPulses, getLaunchWarRoomPulses, () => [])
}

export function getLaunchWarRoomTone(status: LaunchWarRoomTimelineStatus | LaunchWarRoomEventStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Critical') return 'danger'
  if (status === 'Review' || status === 'Action Needed') return 'warn'
  if (status === 'Active' || status === 'Recorded') return 'info'
  if (status === 'Stable' || status === 'Verified') return 'ok'
  return 'neutral'
}

export function getLaunchWarRoomMetricTone(status: LaunchWarRoomTimelineStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Critical') return 'danger'
  if (status === 'Review') return 'warn'
  if (status === 'Active') return 'neutral'
  return 'ok'
}

export function getLaunchWarRoomTimelineFilename(timeline: LaunchWarRoomTimeline) {
  return `launch-war-room-timeline-${timeline.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchWarRoomTimelineHtml(timeline: LaunchWarRoomTimeline, session: AdminSession) {
  const eventRows = timeline.events.map(event => `
    <tr>
      <td>${escapeHtml(event.occurredAt)}</td>
      <td>${escapeHtml(event.lane)}</td>
      <td>${escapeHtml(event.status)}</td>
      <td>${escapeHtml(event.title)}</td>
      <td>${escapeHtml(event.owner)}</td>
      <td>${escapeHtml(event.evidence)}</td>
      <td>${escapeHtml(event.nextStep)}</td>
    </tr>
  `).join('')

  const laneRows = timeline.laneGroups.map(group => `
    <tr>
      <td>${escapeHtml(group.lane)}</td>
      <td>${group.total}</td>
      <td>${group.critical}</td>
      <td>${group.actionNeeded}</td>
      <td>${group.recorded}</td>
      <td>${group.verified}</td>
      <td>${escapeHtml(group.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Launch War Room Timeline</title>
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
        <p>Happy Chair Platform Admin / Launch War Room Timeline</p>
        <h1>${escapeHtml(timeline.summary)}</h1>
        <p>${escapeHtml(launchWarRoomBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(timeline.status)}</strong></div>
        <div><span>Events</span><strong>${timeline.events.length}</strong></div>
        <div><span>Critical</span><strong>${timeline.criticalCount}</strong></div>
        <div><span>Action Needed</span><strong>${timeline.actionNeededCount}</strong></div>
        <div><span>Audit Backed</span><strong>${timeline.auditBackedCount}</strong></div>
        <div><span>Owners</span><strong>${timeline.activeOwnerCount}</strong></div>
        <div><span>Pulses</span><strong>${timeline.pulseCount}</strong></div>
        <div><span>Generated By</span><strong>${escapeHtml(session.name)} / ${escapeHtml(session.email)}</strong></div>
      </section>
      <section>
        <h2>Timeline</h2>
        <table><thead><tr><th>Time</th><th>Lane</th><th>Status</th><th>Event</th><th>Owner</th><th>Evidence</th><th>Next Step</th></tr></thead><tbody>${eventRows}</tbody></table>
      </section>
      <section>
        <h2>Lane Coverage</h2>
        <table><thead><tr><th>Lane</th><th>Total</th><th>Critical</th><th>Action Needed</th><th>Recorded</th><th>Verified</th><th>Next Step</th></tr></thead><tbody>${laneRows}</tbody></table>
      </section>
    </main>
  </body>
</html>`
}

function currentBlockerEvents(model: LaunchReadinessModel): LaunchWarRoomTimelineEvent[] {
  return model.gates
    .filter(gate => gate.status !== 'Ready')
    .map(gate => ({
      id: `current-gate-${gate.id}`,
      lane: 'Current Blocker' as const,
      status: gate.status === 'Blocked' ? 'Critical' as const : 'Action Needed' as const,
      title: gate.title,
      owner: gate.owner,
      source: 'Launch Gate',
      reference: gate.linkedSurface,
      evidence: gate.evidence,
      nextStep: gate.nextStep,
      occurredAt: model.generatedAt,
      localOnly: true,
    }))
}

function evidenceEvents(ledger: LaunchEvidenceLedger): LaunchWarRoomTimelineEvent[] {
  return ledger.entries.slice(0, 80).map(entry => ({
    id: `evidence-${entry.id}`,
    lane: entry.status === 'Blocked' ? 'Current Blocker' as const : 'Audit' as const,
    status: entry.status === 'Blocked' ? 'Critical' as const : entry.status === 'Watch' ? 'Action Needed' as const : 'Verified' as const,
    title: `${entry.type}: ${entry.reference}`,
    owner: entry.owner,
    source: entry.source,
    reference: entry.reference,
    evidence: entry.evidence,
    nextStep: entry.nextStep,
    occurredAt: entry.createdAt,
    localOnly: true,
  }))
}

function auditEvents(events: AuditEvent[]): LaunchWarRoomTimelineEvent[] {
  return events
    .filter(event => event.actionKey.includes('launch') || event.actionLabel.toLowerCase().includes('launch'))
    .map(event => ({
      id: `audit-${event.id}`,
      lane: laneFromAudit(event),
      status: event.outcome === 'blocked' || event.severity === 'critical'
        ? 'Critical' as const
        : event.severity === 'warning' ? 'Action Needed' as const : 'Recorded' as const,
      title: event.actionLabel,
      owner: event.actorRole,
      source: 'Audit Logs',
      reference: event.scope,
      evidence: `${event.outcome ?? 'recorded'} / ${event.permission ?? 'no explicit permission'}`,
      nextStep: event.outcome === 'blocked' ? 'Resolve the permission or policy blocker before retrying.' : 'Keep this audit event available for launch traceability.',
      occurredAt: event.createdAt,
      auditEventId: event.id,
      actor: event.actor,
      actorRole: event.actorRole,
      localOnly: event.persistenceTarget !== 'platform_admin.audit_logs',
    }))
}

function actionRequestEvents(requests: AdminActionRequest[]): LaunchWarRoomTimelineEvent[] {
  return requests
    .filter(request => request.status !== 'Completed')
    .map(request => ({
      id: `action-request-${request.id}`,
      lane: 'Action Queue' as const,
      status: request.status === 'Blocked' || request.status === 'Failed'
        ? 'Critical' as const
        : request.status === 'Approved' || request.status === 'Running' ? 'Recorded' as const : 'Action Needed' as const,
      title: request.title,
      owner: request.requestedBy.role,
      source: 'Admin Action Requests',
      reference: request.scope.label,
      evidence: `${request.status}. Handler: ${request.serverHandler.key}.`,
      nextStep: request.statusReason ?? request.reason,
      occurredAt: request.updatedAt ?? request.createdAt,
      auditEventId: request.auditEventId,
      actor: request.requestedBy.name,
      actorRole: request.requestedBy.role,
      localOnly: request.persistenceTarget !== 'platform_admin.admin_action_requests',
    }))
}

function mockServerExecutionEvents(records: MockServerExecutionRecord[]): LaunchWarRoomTimelineEvent[] {
  return records.map(record => ({
    id: `dry-run-${record.id}`,
    lane: 'Dry Run' as const,
    status: record.status === 'Dry Run Blocked' ? 'Critical' as const : record.status === 'Needs Approval' ? 'Action Needed' as const : 'Verified' as const,
    title: `${record.status}: ${record.handlerLabel}`,
    owner: 'Engineering',
    source: 'Mock Server Executor',
    reference: record.handlerKey,
    evidence: `${record.outcomeSummary} Duration ${record.durationMs}ms. Mutation applied: ${record.mutationApplied}.`,
    nextStep: record.status === 'Dry Run Passed' ? 'Keep dry-run evidence attached to launch review.' : 'Clear failed dry-run checks before production wiring.',
    occurredAt: record.createdAt,
    auditEventId: record.auditEventId,
    actor: record.actorEmail,
    actorRole: 'Engineering',
    localOnly: true,
  }))
}

function signOffEvents(signOffs: LaunchGateSignOff[]): LaunchWarRoomTimelineEvent[] {
  return signOffs.map(signOff => ({
    id: `signoff-${signOff.id}`,
    lane: 'Approval' as const,
    status: signOff.decision === 'Deferred' ? 'Action Needed' as const : signOff.decision === 'Approved' || signOff.decision === 'Resolved' ? 'Verified' as const : 'Recorded' as const,
    title: `${signOff.decision}: ${signOff.gateTitle}`,
    owner: signOff.assignedTo,
    source: 'Owner Sign-Offs',
    reference: signOff.area,
    evidence: signOff.note,
    nextStep: signOff.decision === 'Deferred' ? 'Resolve this deferral before final approval.' : 'Keep sign-off attached to launch evidence.',
    occurredAt: signOff.createdAt,
    auditEventId: signOff.auditEventId,
    actor: signOff.actor,
    actorRole: signOff.actorRole,
    localOnly: true,
  }))
}

function decisionPacketEvents(packets: LaunchDecisionPacket[]): LaunchWarRoomTimelineEvent[] {
  return packets.map(packet => ({
    id: `packet-${packet.id}-${packet.updatedAt ?? packet.createdAt}`,
    lane: 'Decision Packet' as const,
    status: packet.status === 'Deferred' ? 'Action Needed' as const : packet.status === 'Approved For Follow-Up' ? 'Verified' as const : 'Recorded' as const,
    title: `${packet.status}: ${packet.title}`,
    owner: packet.followUpOwner ?? packet.owner,
    source: 'Decision Packets',
    reference: packet.reference,
    evidence: packet.reviewNote ?? packet.evidence,
    nextStep: packet.status === 'Deferred' ? 'Resolve the deferred packet before launch close.' : packet.nextDecision,
    occurredAt: packet.updatedAt ?? packet.createdAt,
    auditEventId: packet.auditEventId,
    actor: packet.reviewedBy ?? packet.generatedBy,
    actorRole: packet.reviewedByRole ?? packet.generatedByRole,
    localOnly: true,
  }))
}

function closureSnapshotEvents(snapshots: LaunchClosureSnapshot[]): LaunchWarRoomTimelineEvent[] {
  return snapshots.map(snapshot => ({
    id: `closure-snapshot-${snapshot.id}`,
    lane: 'Closure' as const,
    status: snapshot.decision === 'No Go' ? 'Critical' as const : snapshot.decision === 'Conditional Go' ? 'Action Needed' as const : 'Verified' as const,
    title: `${snapshot.decision} closure snapshot`,
    owner: 'Owner',
    source: 'Closure Snapshot Ledger',
    reference: snapshot.launchStatus,
    evidence: snapshot.summary,
    nextStep: snapshot.readyForExecutiveSignOff ? 'Attach this snapshot to executive approval.' : 'Clear snapshot blockers before final close.',
    occurredAt: snapshot.recordedAt,
    auditEventId: snapshot.auditEventId,
    actor: snapshot.recordedBy,
    actorRole: snapshot.recordedByRole,
    localOnly: true,
  }))
}

function handoffApprovalEvents(approvals: LaunchHandoffApproval[]): LaunchWarRoomTimelineEvent[] {
  return approvals.map(approval => ({
    id: `handoff-approval-${approval.id}`,
    lane: 'Approval' as const,
    status: approval.decision === 'Held' ? 'Critical' as const : approval.decision === 'Approved With Conditions' ? 'Action Needed' as const : 'Verified' as const,
    title: `${approval.decision} handoff approval`,
    owner: approval.followUpOwner,
    source: 'Handoff Approval',
    reference: approval.manifestStatus,
    evidence: approval.conditionNote,
    nextStep: approval.acceptedRisk,
    occurredAt: approval.recordedAt,
    auditEventId: approval.auditEventId,
    actor: approval.recordedBy,
    actorRole: approval.recordedByRole,
    localOnly: true,
  }))
}

function followUpCurrentEvents(register: LaunchFollowUpRegisterModel, generatedAt: string): LaunchWarRoomTimelineEvent[] {
  return register.items
    .filter(item => item.status !== 'Resolved')
    .map(item => ({
      id: `follow-up-current-${item.id}`,
      lane: 'Follow-Up' as const,
      status: item.status === 'Blocked' ? 'Critical' as const : 'Action Needed' as const,
      title: `${item.status}: ${item.title}`,
      owner: item.owner,
      source: 'Launch Follow-Up',
      reference: item.reference,
      evidence: item.evidence,
      nextStep: item.nextStep,
      occurredAt: item.updatedAt ?? item.createdAt ?? generatedAt,
      auditEventId: item.auditEventId,
      localOnly: true,
    }))
}

function followUpRecordEvents(records: LaunchFollowUpRecord[]): LaunchWarRoomTimelineEvent[] {
  return records.map(record => ({
    id: `follow-up-record-${record.id}`,
    lane: 'Follow-Up' as const,
    status: record.status === 'Blocked' ? 'Critical' as const : record.status === 'Resolved' ? 'Verified' as const : 'Recorded' as const,
    title: `${record.status} follow-up`,
    owner: record.owner,
    source: 'Launch Follow-Up Records',
    reference: record.itemId,
    evidence: record.note,
    nextStep: record.status === 'Resolved' ? 'Keep resolution evidence attached.' : 'Keep follow-up visible until resolved.',
    occurredAt: record.recordedAt,
    auditEventId: record.auditEventId,
    actor: record.recordedBy,
    actorRole: record.recordedByRole,
    localOnly: true,
  }))
}

function watchCheckEvents(records: LaunchWatchCheck[]): LaunchWarRoomTimelineEvent[] {
  return records.map(record => ({
    id: `watch-check-${record.id}`,
    lane: 'Watch' as const,
    status: record.status === 'Critical Drift' ? 'Critical' as const : record.status === 'Drift' ? 'Action Needed' as const : 'Verified' as const,
    title: `${record.status} launch watch check`,
    owner: 'Operations',
    source: 'Launch Watchtower',
    reference: record.manifestStatus,
    evidence: record.summary,
    nextStep: record.status === 'Stable' ? 'Continue launch watch monitoring.' : 'Resolve watch drift before final close.',
    occurredAt: record.recordedAt,
    auditEventId: record.auditEventId,
    actor: record.recordedBy,
    actorRole: record.recordedByRole,
    localOnly: true,
  }))
}

function backendRecordEvents(input: BuildLaunchWarRoomTimelineInput): LaunchWarRoomTimelineEvent[] {
  return [
    ...recordEvents(input.backendImplementationRecords, 'Backend', 'Backend Implementation', record => `${record.status} implementation work`, record => record.status, record => record.owner),
    ...recordEvents(input.backendHandlerSpecReviews, 'Backend', 'Handler Specs', record => `${record.status} handler spec`, record => record.status, record => record.owner),
    ...recordEvents(input.engineeringHandoffPacketReviews, 'Backend', 'Engineering Handoff', record => `${record.status} engineering handoff`, record => record.status, record => record.engineeringOwner),
    ...recordEvents(input.serverHandlerTestRecords, 'Backend', 'Server Test Matrix', record => `${record.status} server test`, record => record.status, record => record.owner),
    ...recordEvents(input.serverTestEvidencePackRecords, 'Backend', 'Server Evidence Packs', record => `${record.status} server evidence pack`, record => record.status, record => record.owner),
    ...recordEvents(input.backendExecutionReadinessRecords, 'Backend', 'Execution Readiness', record => `${record.status} execution readiness`, record => record.status, record => record.owner),
    ...recordEvents(input.trustedHandlerDeploymentRecords, 'Backend', 'Trusted Deployment', record => `${record.status} trusted deployment`, record => record.status, record => record.owner),
    ...recordEvents(input.backendReleaseCommandRecords, 'Backend', 'Release Command', record => `${record.status} release command`, record => record.status, record => record.owner),
    ...recordEvents(input.backendWatchRecords, 'Watch', 'Backend Watch', record => `${record.status} backend watch`, record => record.status, record => record.owner),
    ...recordEvents(input.backendClosureEvidenceRecords, 'Closure', 'Backend Closure Evidence', record => `${record.status} backend closure`, record => record.status, record => record.owner),
  ]
}

function productionGuardrailEvents(records: ProductionGuardrailRecord[]): LaunchWarRoomTimelineEvent[] {
  return recordEvents(records, 'Guardrail', 'Production Guardrails', record => `${record.status} production guardrail`, record => record.status, record => record.owner)
}

function executiveDecisionEvents(room: ExecutiveGoNoGoRoom, records: ExecutiveGoNoGoRecord[]): LaunchWarRoomTimelineEvent[] {
  const currentEvent: LaunchWarRoomTimelineEvent = {
    id: 'executive-go-no-go-current',
    lane: 'Executive Decision',
    status: room.decision === 'No Go' ? 'Critical' : room.decision === 'Conditional Go' ? 'Action Needed' : 'Verified',
    title: `${room.decision}: ${room.headline}`,
    owner: room.nextItem?.owner ?? 'Owner',
    source: 'Executive Go / No-Go Evidence Room',
    reference: room.launchStatus,
    evidence: room.summary,
    nextStep: room.nextItem?.nextStep ?? 'Keep current decision room attached to launch evidence.',
    occurredAt: room.generatedAt,
    auditEventId: room.latestRecord?.auditEventId,
    localOnly: true,
  }

  return [
    currentEvent,
    ...records.map(record => ({
      id: `executive-go-no-go-record-${record.id}`,
      lane: 'Executive Decision' as const,
      status: record.decision === 'No Go' ? 'Critical' as const : record.decision === 'Conditional Go' ? 'Action Needed' as const : 'Verified' as const,
      title: `${record.decision} executive Go / No-Go record`,
      owner: record.owner,
      source: 'Executive Decision Ledger',
      reference: record.launchStatus,
      evidence: record.conditionNote,
      nextStep: record.acceptedRisk,
      occurredAt: record.recordedAt,
      auditEventId: record.auditEventId,
      actor: record.recordedBy,
      actorRole: record.recordedByRole,
      localOnly: true,
    })),
  ]
}

function recordEvents<T extends {
  id: string
  auditEventId: string
  note: string
  recordedBy: string
  recordedByRole: string
  recordedAt: string
}>(
  records: T[],
  lane: LaunchWarRoomLane,
  source: string,
  title: (record: T) => string,
  status: (record: T) => string,
  owner: (record: T) => string,
): LaunchWarRoomTimelineEvent[] {
  return records.map(record => ({
    id: `${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${record.id}`,
    lane,
    status: statusFromRecordStatus(status(record)),
    title: title(record),
    owner: owner(record),
    source,
    reference: 'itemId' in record && typeof record.itemId === 'string'
      ? record.itemId
      : 'rowId' in record && typeof record.rowId === 'string'
        ? record.rowId
        : 'packId' in record && typeof record.packId === 'string'
          ? record.packId
          : 'record',
    evidence: record.note,
    nextStep: statusFromRecordStatus(status(record)) === 'Verified' ? 'Keep record attached to launch evidence.' : 'Track this record until it is verified or resolved.',
    occurredAt: record.recordedAt,
    auditEventId: record.auditEventId,
    actor: record.recordedBy,
    actorRole: record.recordedByRole,
    localOnly: true,
  }))
}

function buildLaneGroups(events: LaunchWarRoomTimelineEvent[]): LaunchWarRoomLaneGroup[] {
  const groups = new Map<LaunchWarRoomLane, LaunchWarRoomTimelineEvent[]>()
  events.forEach(event => groups.set(event.lane, [...(groups.get(event.lane) ?? []), event]))

  return Array.from(groups.entries()).map(([lane, laneEvents]) => {
    const openEvents = laneEvents.filter(event => event.status === 'Critical' || event.status === 'Action Needed')
    return {
      lane,
      total: laneEvents.length,
      critical: laneEvents.filter(event => event.status === 'Critical').length,
      actionNeeded: laneEvents.filter(event => event.status === 'Action Needed').length,
      recorded: laneEvents.filter(event => event.status === 'Recorded').length,
      verified: laneEvents.filter(event => event.status === 'Verified').length,
      latestAt: laneEvents[0]?.occurredAt ?? new Date().toISOString(),
      nextStep: openEvents[0]?.nextStep ?? 'Lane is stable or evidence-only.',
    }
  }).sort((a, b) => b.critical - a.critical || b.actionNeeded - a.actionNeeded || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
}

function buildOwnerGroups(events: LaunchWarRoomTimelineEvent[]): LaunchWarRoomOwnerGroup[] {
  const groups = new Map<string, LaunchWarRoomTimelineEvent[]>()
  events.forEach(event => groups.set(event.owner, [...(groups.get(event.owner) ?? []), event]))

  return Array.from(groups.entries()).map(([owner, ownerEvents]) => {
    const openEvents = ownerEvents.filter(event => event.status === 'Critical' || event.status === 'Action Needed')
    return {
      owner,
      total: ownerEvents.length,
      critical: ownerEvents.filter(event => event.status === 'Critical').length,
      actionNeeded: ownerEvents.filter(event => event.status === 'Action Needed').length,
      recorded: ownerEvents.filter(event => event.status === 'Recorded').length,
      verified: ownerEvents.filter(event => event.status === 'Verified').length,
      latestAt: ownerEvents[0]?.occurredAt ?? new Date().toISOString(),
      nextStep: openEvents[0]?.nextStep ?? 'Owner has no open war-room item.',
    }
  }).sort((a, b) => b.critical - a.critical || b.actionNeeded - a.actionNeeded || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
}

function laneFromAudit(event: AuditEvent): LaunchWarRoomLane {
  const key = `${event.actionKey} ${event.actionLabel}`.toLowerCase()
  if (key.includes('go_no_go')) return 'Executive Decision'
  if (key.includes('guardrail')) return 'Guardrail'
  if (key.includes('closure')) return 'Closure'
  if (key.includes('approval') || key.includes('signoff')) return 'Approval'
  if (key.includes('packet')) return 'Decision Packet'
  if (key.includes('watch')) return 'Watch'
  if (key.includes('backend') || key.includes('server') || key.includes('release')) return 'Backend'
  if (key.includes('follow_up') || key.includes('follow-up')) return 'Follow-Up'
  return 'Audit'
}

function statusFromRecordStatus(status: string): LaunchWarRoomEventStatus {
  const normalized = status.toLowerCase()
  if (normalized.includes('blocked') || normalized.includes('held') || normalized.includes('no go') || normalized.includes('missing')) return 'Critical'
  if (normalized.includes('review') || normalized.includes('planning') || normalized.includes('draft') || normalized.includes('watch') || normalized.includes('condition')) return 'Action Needed'
  if (normalized.includes('complete') || normalized.includes('approved') || normalized.includes('verified') || normalized.includes('ready') || normalized.includes('closed') || normalized.includes('passed') || normalized.includes('stable') || normalized.includes('go')) return 'Verified'
  return 'Recorded'
}

function getTimelineStatus(criticalCount: number, actionNeededCount: number, totalCount: number): LaunchWarRoomTimelineStatus {
  if (criticalCount) return 'Critical'
  if (actionNeededCount) return 'Review'
  if (totalCount) return 'Active'
  return 'Stable'
}

function getTimelineSummary(status: LaunchWarRoomTimelineStatus, criticalCount: number, actionNeededCount: number, totalCount: number) {
  if (status === 'Critical') return `${criticalCount} critical launch war-room event${criticalCount === 1 ? '' : 's'} need immediate owner attention.`
  if (status === 'Review') return `${actionNeededCount} launch war-room event${actionNeededCount === 1 ? '' : 's'} need follow-up before final close.`
  if (status === 'Active') return `${totalCount} launch war-room events are recorded with no critical open item.`
  return 'No launch war-room events are currently open.'
}

function statusRank(status: LaunchWarRoomEventStatus) {
  if (status === 'Critical') return 4
  if (status === 'Action Needed') return 3
  if (status === 'Recorded') return 2
  return 1
}

function emitLaunchWarRoomPulseChange() {
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
