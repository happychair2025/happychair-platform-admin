import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { AuditEvent } from '../audit/auditLog'
import type { PlatformReadViewDiagnostic } from '../platform-data/PlatformDataContext'
import type { LaunchGateStatus, LaunchReadinessModel } from './launchReadiness'
import type { LaunchDecisionPacket } from './launchDecisionPackets'
import type { LaunchGateSignOff } from './launchSignOffs'

export type LaunchEvidenceType = 'Gate Signal' | 'Launch Review' | 'Report Export' | 'Owner Sign-Off' | 'Decision Packet' | 'Action Queue' | 'Read Contract'
export type LaunchEvidenceSource = 'Launch Gate' | 'Audit Ledger' | 'Owner Sign-Offs' | 'Decision Packets' | 'Admin Action Requests' | 'Read View Diagnostics'

export interface LaunchEvidenceEntry {
  id: string
  type: LaunchEvidenceType
  source: LaunchEvidenceSource
  status: LaunchGateStatus
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  owner: string
  evidence: string
  nextStep: string
  createdAt: string
  reference: string
}

export interface LaunchEvidenceLedger {
  entries: LaunchEvidenceEntry[]
  blockedCount: number
  watchCount: number
  auditEventCount: number
  exportCount: number
  signOffCount: number
  packetCount: number
  actionQueueCount: number
}

interface BuildLaunchEvidenceLedgerInput {
  model: LaunchReadinessModel
  auditEvents: AuditEvent[]
  actionRequests: AdminActionRequest[]
  readViewDiagnostics: PlatformReadViewDiagnostic[]
  signOffs: LaunchGateSignOff[]
  decisionPackets: LaunchDecisionPacket[]
}

export function buildLaunchEvidenceLedger({
  model,
  auditEvents,
  actionRequests,
  readViewDiagnostics,
  signOffs,
  decisionPackets,
}: BuildLaunchEvidenceLedgerInput): LaunchEvidenceLedger {
  const gateEntries = model.gates
    .filter(gate => gate.status !== 'Ready')
    .map<LaunchEvidenceEntry>(gate => ({
      id: `gate-${gate.id}`,
      type: 'Gate Signal',
      source: 'Launch Gate',
      status: gate.status,
      severity: gate.severity,
      owner: gate.owner,
      evidence: gate.evidence,
      nextStep: gate.nextStep,
      createdAt: model.generatedAt,
      reference: gate.linkedSurface,
    }))

  const auditEntries = auditEvents
    .filter(event => event.actionKey.includes('launch_gate') || event.actionLabel.toLowerCase().includes('launch'))
    .map<LaunchEvidenceEntry>(event => ({
      id: `audit-${event.id}`,
      type: event.actionKey.includes('export') ? 'Report Export' : 'Launch Review',
      source: 'Audit Ledger',
      status: event.outcome === 'blocked' ? 'Blocked' : event.severity === 'warning' || event.severity === 'critical' ? 'Watch' : 'Ready',
      severity: event.severity === 'critical' ? 'Critical' : event.severity === 'warning' ? 'High' : 'Low',
      owner: event.actorRole,
      evidence: event.actionLabel,
      nextStep: event.outcome === 'blocked'
        ? `Resolve permission ${event.permission ?? 'requirement'} before retrying.`
        : 'Keep this event available for launch review traceability.',
      createdAt: event.createdAt,
      reference: event.scope,
    }))

  const actionEntries = actionRequests
    .filter(request => request.status !== 'Completed')
    .map<LaunchEvidenceEntry>(request => ({
      id: `request-${request.id}`,
      type: 'Action Queue',
      source: 'Admin Action Requests',
      status: request.status === 'Blocked' || request.status === 'Failed'
        ? 'Blocked'
        : request.status === 'Approved' || request.status === 'Running'
          ? 'Ready'
          : 'Watch',
      severity: request.status === 'Blocked' || request.status === 'Failed' ? 'Critical' : request.status === 'Draft' ? 'Medium' : 'High',
      owner: request.requestedBy.role,
      evidence: `${request.title} is ${request.status}. Handler: ${request.serverHandler.key}.`,
      nextStep: request.status === 'Approved' || request.status === 'Running'
        ? 'Confirm server-side handler readiness and preserve transition audit events.'
        : request.status === 'Blocked' || request.status === 'Failed'
          ? request.statusReason ?? 'Resolve blocker before production execution.'
          : 'Review scope, approval, rollback, and handler contract before execution.',
      createdAt: request.updatedAt ?? request.createdAt,
      reference: request.scope.label,
    }))

  const signOffEntries = signOffs.map<LaunchEvidenceEntry>(signOff => ({
    id: `signoff-${signOff.id}`,
    type: 'Owner Sign-Off',
    source: 'Owner Sign-Offs',
    status: signOff.decision === 'Approved' || signOff.decision === 'Resolved' ? 'Ready' : 'Watch',
    severity: signOff.gateStatus === 'Blocked'
      ? signOff.decision === 'Resolved' ? 'High' : 'Critical'
      : signOff.decision === 'Deferred' ? 'High' : 'Medium',
    owner: signOff.assignedTo,
    evidence: `${signOff.decision}: ${signOff.gateTitle}. ${signOff.note}`,
    nextStep: signOff.decision === 'Resolved'
      ? 'Confirm source evidence remains clear in the next launch review.'
      : signOff.decision === 'Approved'
        ? 'Keep this approval attached to the launch report and audit ledger.'
        : signOff.decision === 'Deferred'
          ? 'Revisit deferred gate before executive launch approval.'
          : 'Assigned owner should review evidence and record a decision.',
    createdAt: signOff.createdAt,
    reference: signOff.area,
  }))

  const readContractEntries = readViewDiagnostics
    .filter(diagnostic => diagnostic.status === 'fallback')
    .map<LaunchEvidenceEntry>(diagnostic => ({
      id: `read-view-${diagnostic.key}`,
      type: 'Read Contract',
      source: 'Read View Diagnostics',
      status: 'Blocked',
      severity: 'Critical',
      owner: 'Engineering',
      evidence: `${diagnostic.viewName} is using mock fallback with ${diagnostic.records} records.`,
      nextStep: diagnostic.error ?? 'Repair missing read view, policy, or column contract.',
      createdAt: diagnostic.loadedAt ?? model.generatedAt,
      reference: String(diagnostic.key),
    }))

  const packetEntries = decisionPackets.map<LaunchEvidenceEntry>(packet => ({
    id: `packet-${packet.id}`,
    type: 'Decision Packet',
    source: 'Decision Packets',
    status: packet.status === 'Approved For Follow-Up' ? 'Ready' : 'Watch',
    severity: packet.status === 'Deferred' || packet.type === 'Server Action' ? 'High' : 'Medium',
    owner: packet.followUpOwner ?? packet.owner,
    evidence: `${packet.status}: ${packet.title}. ${packet.reviewNote ?? packet.evidence}`,
    nextStep: getDecisionPacketNextStep(packet),
    createdAt: packet.updatedAt ?? packet.createdAt,
    reference: packet.reference,
  }))

  const entries = [
    ...gateEntries,
    ...auditEntries,
    ...signOffEntries,
    ...packetEntries,
    ...actionEntries,
    ...readContractEntries,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    entries,
    blockedCount: entries.filter(entry => entry.status === 'Blocked').length,
    watchCount: entries.filter(entry => entry.status === 'Watch').length,
    auditEventCount: auditEntries.length,
    exportCount: auditEntries.filter(entry => entry.type === 'Report Export').length,
    signOffCount: signOffEntries.length,
    packetCount: packetEntries.length,
    actionQueueCount: actionEntries.length,
  }
}

export function getLaunchEvidenceTone(status: LaunchGateStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'ok'
}

function getDecisionPacketNextStep(packet: LaunchDecisionPacket) {
  if (packet.status === 'Approved For Follow-Up') return 'Keep approved follow-up evidence attached to the launch report and execute any production change only through Admin Action Requests.'
  if (packet.status === 'Deferred') return 'Resolve the deferral before executive launch approval.'
  if (packet.status === 'Assigned Follow-Up') return `${packet.followUpOwner ?? packet.owner} owns follow-up: ${packet.nextDecision}`
  if (packet.status === 'Queued For Review') return 'Review the packet, record approval or deferral, and preserve the audit event.'
  return packet.nextDecision
}
