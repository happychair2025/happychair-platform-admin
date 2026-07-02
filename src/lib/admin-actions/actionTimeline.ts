import type { AuditEvent, AuditSeverity } from '../audit/auditLog'
import type { AdminActionRequest } from './actionRequests'
import type { MockServerExecutionRecord } from './mockServerExecutor'

export type ActionTimelineEventType =
  | 'Request'
  | 'Approval'
  | 'Handoff'
  | 'Adapter Review'
  | 'Dry Run'
  | 'Audit'

export interface ActionTimelineEvent {
  id: string
  eventType: ActionTimelineEventType
  occurredAt: string
  title: string
  detail: string
  actor: string
  actorRole?: string
  scope: string
  statusLabel: string
  severity: AuditSeverity
  source: 'Action Request' | 'Approval Metadata' | 'Handoff Metadata' | 'Adapter Audit' | 'Mock Server Ledger' | 'Audit Ledger'
  actionRequestId?: string
  auditEventId?: string
  handlerKey?: string
  persistenceLabel?: string
}

export interface ActionTimelineSummary {
  total: number
  requests: number
  approvals: number
  handoffs: number
  dryRuns: number
  adapterReviews: number
  blockedOrCritical: number
  latest?: ActionTimelineEvent
}

export interface BuildActionTimelineInput {
  requests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  mockExecutions: MockServerExecutionRecord[]
}

interface ApprovalDecisionRecord {
  decision?: 'approved' | 'blocked'
  decidedBy?: string
  decidedByRole?: string
  decidedAt?: string
  note?: string
  auditEventId?: string
  riskLevel?: string
}

interface ExecutionHandoffRecord {
  reviewedBy?: string
  reviewedAt?: string
  auditEventId?: string
  lane?: string
  posture?: string
  endpointLabel?: string
  idempotencyKey?: string
  correlationId?: string
  note?: string
}

export function buildActionTimeline(input: BuildActionTimelineInput): ActionTimelineEvent[] {
  const requestById = new Map(input.requests.map(request => [request.id, request]))
  const timelineEvents: ActionTimelineEvent[] = [
    ...input.requests.flatMap(request => buildRequestEvents(request)),
    ...input.mockExecutions.map(execution => buildDryRunEvent(execution, requestById.get(execution.requestId))),
    ...input.auditEvents.map(event => buildAuditEvent(event, requestById)),
  ]

  return timelineEvents
    .filter(event => Boolean(event.occurredAt))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

export function summarizeActionTimeline(events: ActionTimelineEvent[]): ActionTimelineSummary {
  return {
    total: events.length,
    requests: events.filter(event => event.eventType === 'Request').length,
    approvals: events.filter(event => event.eventType === 'Approval').length,
    handoffs: events.filter(event => event.eventType === 'Handoff').length,
    dryRuns: events.filter(event => event.eventType === 'Dry Run').length,
    adapterReviews: events.filter(event => event.eventType === 'Adapter Review').length,
    blockedOrCritical: events.filter(event => event.severity === 'critical' || event.statusLabel.toLowerCase().includes('blocked')).length,
    latest: events[0],
  }
}

export function getActionTimelineEventTone(event: ActionTimelineEvent): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (event.severity === 'critical') return 'danger'
  if (event.statusLabel.toLowerCase().includes('blocked')) return 'danger'
  if (event.statusLabel.toLowerCase().includes('approved') || event.statusLabel.toLowerCase().includes('passed') || event.statusLabel.toLowerCase().includes('completed')) return 'ok'
  if (event.severity === 'warning' || event.statusLabel.toLowerCase().includes('review')) return 'warn'
  if (event.eventType === 'Dry Run' || event.eventType === 'Handoff') return 'info'
  return 'neutral'
}

export function getActionTimelineTypeTone(eventType: ActionTimelineEventType): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (eventType === 'Approval') return 'warn'
  if (eventType === 'Handoff' || eventType === 'Dry Run') return 'info'
  if (eventType === 'Adapter Review') return 'ok'
  if (eventType === 'Audit') return 'neutral'
  return 'info'
}

function buildRequestEvents(request: AdminActionRequest): ActionTimelineEvent[] {
  const events: ActionTimelineEvent[] = [
    {
      id: `request-created-${request.id}`,
      eventType: 'Request',
      occurredAt: request.createdAt,
      title: request.title,
      detail: request.reason,
      actor: request.requestedBy.email ?? request.requestedBy.name,
      actorRole: request.requestedBy.role,
      scope: request.scope.label,
      statusLabel: request.status,
      severity: request.status === 'Blocked' || request.status === 'Failed' ? 'warning' : 'notice',
      source: 'Action Request',
      actionRequestId: request.id,
      auditEventId: request.auditEventId,
      handlerKey: request.serverHandler.key,
      persistenceLabel: request.persistenceStatus ?? 'local_durable',
    },
  ]

  const approvalDecision = getApprovalDecision(request)
  if (approvalDecision?.auditEventId) {
    events.push({
      id: `approval-${request.id}-${approvalDecision.auditEventId}`,
      eventType: 'Approval',
      occurredAt: approvalDecision.decidedAt ?? request.updatedAt ?? request.createdAt,
      title: `${approvalDecision.decision === 'blocked' ? 'Blocked' : 'Approved'} ${request.title}`,
      detail: approvalDecision.note || `Human approval decision recorded for ${request.title}.`,
      actor: approvalDecision.decidedBy ?? 'Unknown reviewer',
      actorRole: approvalDecision.decidedByRole,
      scope: request.scope.label,
      statusLabel: approvalDecision.decision ?? 'approved',
      severity: approvalDecision.decision === 'blocked' ? 'warning' : 'notice',
      source: 'Approval Metadata',
      actionRequestId: request.id,
      auditEventId: approvalDecision.auditEventId,
      handlerKey: request.serverHandler.key,
      persistenceLabel: request.persistenceStatus ?? 'local_durable',
    })
  }

  const handoffRecord = getExecutionHandoffRecord(request)
  if (handoffRecord?.auditEventId) {
    events.push({
      id: `handoff-${request.id}-${handoffRecord.auditEventId}`,
      eventType: 'Handoff',
      occurredAt: handoffRecord.reviewedAt ?? request.updatedAt ?? request.createdAt,
      title: `Reviewed execution handoff for ${request.title}`,
      detail: handoffRecord.note || `${handoffRecord.lane ?? 'Handoff'} / ${handoffRecord.posture ?? 'Unknown posture'} targeting ${handoffRecord.endpointLabel ?? 'unknown endpoint'}.`,
      actor: handoffRecord.reviewedBy ?? 'Unknown reviewer',
      scope: request.scope.label,
      statusLabel: handoffRecord.lane ?? 'Handoff Reviewed',
      severity: handoffRecord.lane === 'Blocked' ? 'warning' : 'notice',
      source: 'Handoff Metadata',
      actionRequestId: request.id,
      auditEventId: handoffRecord.auditEventId,
      handlerKey: request.serverHandler.key,
      persistenceLabel: request.persistenceStatus ?? 'local_durable',
    })
  }

  return events
}

function buildDryRunEvent(
  execution: MockServerExecutionRecord,
  request: AdminActionRequest | undefined,
): ActionTimelineEvent {
  return {
    id: `dry-run-${execution.id}`,
    eventType: 'Dry Run',
    occurredAt: execution.createdAt,
    title: `${execution.status}: ${request?.title ?? execution.requestId}`,
    detail: execution.outcomeSummary,
    actor: execution.actorEmail,
    scope: request?.scope.label ?? execution.simulatedWriteTarget,
    statusLabel: execution.status,
    severity: execution.status === 'Dry Run Blocked' ? 'warning' : 'notice',
    source: 'Mock Server Ledger',
    actionRequestId: execution.requestId,
    auditEventId: execution.auditEventId,
    handlerKey: execution.handlerKey,
    persistenceLabel: 'local_storage',
  }
}

function buildAuditEvent(
  event: AuditEvent,
  requestById: Map<string, AdminActionRequest>,
): ActionTimelineEvent {
  const actionRequestId = getStringMetadata(event.metadata, 'actionRequestId')
  const request = actionRequestId ? requestById.get(actionRequestId) : undefined
  const isAdapterReview = event.actionKey.includes('server_adapter_readiness')
  return {
    id: `audit-${event.id}`,
    eventType: isAdapterReview ? 'Adapter Review' : 'Audit',
    occurredAt: event.createdAt,
    title: event.actionLabel,
    detail: getAuditDetail(event),
    actor: event.actorEmail ?? event.actor,
    actorRole: event.actorRole,
    scope: request?.scope.label ?? event.scope,
    statusLabel: event.outcome ?? event.severity,
    severity: event.severity,
    source: isAdapterReview ? 'Adapter Audit' : 'Audit Ledger',
    actionRequestId,
    auditEventId: event.id,
    handlerKey: getStringMetadata(event.metadata, 'serverHandlerKey') ?? getStringMetadata(event.metadata, 'handlerKey'),
    persistenceLabel: event.persistenceStatus ?? 'local_durable',
  }
}

function getAuditDetail(event: AuditEvent) {
  const status = getStringMetadata(event.metadata, 'executionStatus')
    ?? getStringMetadata(event.metadata, 'adapterStatus')
    ?? getStringMetadata(event.metadata, 'executionPosture')
    ?? getStringMetadata(event.metadata, 'nextStatus')
  if (status) return `${event.actionKey} / ${status}`
  return event.actionKey
}

function getApprovalDecision(request: AdminActionRequest): ApprovalDecisionRecord | undefined {
  const decision = request.metadata?.approvalDecision
  if (!decision || typeof decision !== 'object') return undefined
  return decision as ApprovalDecisionRecord
}

function getExecutionHandoffRecord(request: AdminActionRequest): ExecutionHandoffRecord | undefined {
  const handoff = request.metadata?.executionHandoff
  if (!handoff || typeof handoff !== 'object') return undefined
  return handoff as ExecutionHandoffRecord
}

function getStringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : undefined
}
