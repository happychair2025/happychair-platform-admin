import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { LaunchGate, LaunchGateSeverity, LaunchGateStatus } from './launchReadiness'
import type { LaunchGateSignOff } from './launchSignOffs'

export type LaunchCommandItemType = 'Gate Blocker' | 'Required Sign-Off' | 'Server Action'

export interface LaunchCommandItem {
  id: string
  type: LaunchCommandItemType
  title: string
  status: LaunchGateStatus
  severity: LaunchGateSeverity
  owner: string
  reference: string
  whyItMatters: string
  nextDecision: string
  createdAt: string
  priority: number
}

export interface LaunchCommandModeModel {
  items: LaunchCommandItem[]
  nextItem?: LaunchCommandItem
  blockerCount: number
  requiredSignOffCount: number
  openActionRequestCount: number
  decisionCount: number
}

interface BuildLaunchCommandModeInput {
  gates: LaunchGate[]
  actionRequests: AdminActionRequest[]
  signOffsByGate: Map<string, LaunchGateSignOff>
  generatedAt: string
}

const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])

export function buildLaunchCommandMode({
  gates,
  actionRequests,
  signOffsByGate,
  generatedAt,
}: BuildLaunchCommandModeInput): LaunchCommandModeModel {
  const blockerItems = gates
    .filter(gate => gate.status === 'Blocked')
    .map(gate => commandItemFromGate(gate, signOffsByGate.get(gate.id), generatedAt))

  const requiredSignOffItems = gates
    .filter(gate => gate.status !== 'Ready')
    .filter(gate => {
      const signOff = signOffsByGate.get(gate.id)
      return !signOff || signOff.decision === 'Assigned' || signOff.decision === 'Deferred'
    })
    .map(gate => {
      const signOff = signOffsByGate.get(gate.id)
      return {
        id: `signoff-required-${gate.id}`,
        type: 'Required Sign-Off' as const,
        title: gate.title,
        status: gate.status,
        severity: gate.severity,
        owner: signOff?.assignedTo ?? gate.owner,
        reference: gate.linkedSurface,
        whyItMatters: signOff
          ? `${signOff.decision} by ${signOff.assignedTo}: ${signOff.note}`
          : gate.evidence,
        nextDecision: signOff?.decision === 'Deferred'
          ? 'Decide whether this deferred gate blocks launch, needs a dated follow-up, or can be resolved.'
          : 'Assign an accountable owner or record approval/resolution with evidence.',
        createdAt: signOff?.createdAt ?? generatedAt,
        priority: 700 + severityScore(gate.severity) + statusScore(gate.status),
      }
    })

  const actionItems = actionRequests
    .filter(request => openActionStatuses.has(request.status))
    .map<LaunchCommandItem>(request => ({
      id: `server-action-${request.id}`,
      type: 'Server Action',
      title: request.title,
      status: request.status === 'Blocked' || request.status === 'Failed' ? 'Blocked' : request.status === 'Approved' || request.status === 'Running' ? 'Ready' : 'Watch',
      severity: request.status === 'Blocked' || request.status === 'Failed' ? 'Critical' : request.status === 'Draft' ? 'Medium' : 'High',
      owner: request.requestedBy.role,
      reference: request.scope.label,
      whyItMatters: `${request.status} request requires ${request.permissionRequired}. Handler: ${request.serverHandler.key}.`,
      nextDecision: request.status === 'Approved' || request.status === 'Running'
        ? 'Confirm server handler readiness and preserve transition audit before execution continues.'
        : request.status === 'Blocked' || request.status === 'Failed'
          ? request.statusReason ?? 'Resolve the queue blocker or return the request to review.'
          : 'Approve, block, or defer this server action before launch approval.',
      createdAt: request.updatedAt ?? request.createdAt,
      priority: 500 + statusScore(request.status === 'Blocked' || request.status === 'Failed' ? 'Blocked' : 'Watch'),
    }))

  const items = [
    ...blockerItems,
    ...requiredSignOffItems,
    ...actionItems,
  ].sort((a, b) => b.priority - a.priority || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    items,
    nextItem: items[0],
    blockerCount: blockerItems.length,
    requiredSignOffCount: requiredSignOffItems.length,
    openActionRequestCount: actionItems.length,
    decisionCount: items.length,
  }
}

export function getLaunchCommandItemTone(status: LaunchGateStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Blocked') return 'danger'
  if (status === 'Watch') return 'warn'
  return 'ok'
}

function commandItemFromGate(gate: LaunchGate, signOff: LaunchGateSignOff | undefined, generatedAt: string): LaunchCommandItem {
  return {
    id: `gate-blocker-${gate.id}`,
    type: 'Gate Blocker',
    title: gate.title,
    status: gate.status,
    severity: gate.severity,
    owner: signOff?.assignedTo ?? gate.owner,
    reference: gate.linkedSurface,
    whyItMatters: signOff
      ? `${gate.evidence} Latest sign-off: ${signOff.decision} by ${signOff.assignedTo}.`
      : gate.evidence,
    nextDecision: gate.nextStep,
    createdAt: signOff?.createdAt ?? generatedAt,
    priority: 1000 + severityScore(gate.severity) + gate.scoreImpact,
  }
}

function severityScore(severity: LaunchGateSeverity) {
  if (severity === 'Critical') return 90
  if (severity === 'High') return 70
  if (severity === 'Medium') return 40
  return 10
}

function statusScore(status: LaunchGateStatus) {
  if (status === 'Blocked') return 80
  if (status === 'Watch') return 40
  return 10
}
