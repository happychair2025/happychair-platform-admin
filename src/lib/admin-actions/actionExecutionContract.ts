import type {
  ActionRequestGovernanceRecord,
  ActionRequestReadiness,
  GovernanceCheckStatus,
} from './actionRequestGovernance'
import type { AdminActionRequest } from './actionRequests'

export type ActionExecutionSource = 'browser_contract' | 'server_endpoint'
export type ActionExecutionPosture = 'Review Only' | 'Ready For Server' | 'Blocked' | 'Executing' | 'Completed'
export type ActionExecutionStageStatus = GovernanceCheckStatus

export interface ActionExecutionConfig {
  endpoint: string
  source: ActionExecutionSource
}

export interface ActionExecutionStage {
  id: string
  label: string
  status: ActionExecutionStageStatus
  detail: string
}

export interface ActionExecutionPacket {
  requestId: string
  actionType: AdminActionRequest['actionType']
  handlerKey: string
  route: string
  method: 'POST'
  idempotencyKey: string
  correlationId: string
  endpointLabel: string
  browserMutationAllowed: false
  posture: ActionExecutionPosture
  stages: ActionExecutionStage[]
  blockers: string[]
  warnings: string[]
  payloadPreview: {
    requestId: string
    actionType: AdminActionRequest['actionType']
    scope: string
    permissionRequired: AdminActionRequest['permissionRequired']
    requestedBy: string
    auditEventId: string
    transitionAuditEventId?: string
    rollbackNotes: string
    metadataKeys: string[]
  }
}

export interface ActionExecutionSummary {
  total: number
  readyForServer: number
  reviewOnly: number
  blocked: number
  executing: number
  completed: number
  endpointConfigured: boolean
}

export const actionExecutionBoundaryRule =
  'Execution packets are browser-visible contracts only. The browser may prepare, review, and queue packets, but production mutations require a trusted server endpoint with secret-key access, permission checks, audit writes, and rollback metadata.'

export function getActionExecutionConfig(env: Record<string, unknown>): ActionExecutionConfig {
  const endpoint = getEnvString(env, 'VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT')
  return {
    endpoint,
    source: endpoint ? 'server_endpoint' : 'browser_contract',
  }
}

export function buildActionExecutionPackets(
  requests: AdminActionRequest[],
  governanceByRequestId: Map<string, ActionRequestGovernanceRecord>,
  config: ActionExecutionConfig,
) {
  return requests.map(request => buildActionExecutionPacket(request, governanceByRequestId.get(request.id), config))
}

export function buildActionExecutionPacket(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord | undefined,
  config: ActionExecutionConfig,
): ActionExecutionPacket {
  const endpointConfigured = Boolean(config.endpoint)
  const route = config.endpoint || `/platform-admin/actions/${request.serverHandler.key}`
  const idempotencyKey = `hc-platform:${request.id}:${request.updatedAt ?? request.createdAt}`
  const correlationId = `${request.id}:${request.auditEventId}`
  const stages = [
    createEndpointStage(config),
    createGovernanceStage(request, governance),
    createApprovalStage(governance),
    createHandlerStage(request),
    createIdempotencyStage(idempotencyKey),
    createAuditStage(request),
    createRollbackStage(request),
    createBrowserBoundaryStage(),
  ]
  const blockers = stages.filter(stage => stage.status === 'fail').map(stage => stage.detail)
  const warnings = stages.filter(stage => stage.status === 'warn').map(stage => stage.detail)

  return {
    requestId: request.id,
    actionType: request.actionType,
    handlerKey: request.serverHandler.key,
    route,
    method: 'POST',
    idempotencyKey,
    correlationId,
    endpointLabel: endpointConfigured ? config.endpoint : 'No server endpoint configured',
    browserMutationAllowed: false,
    posture: getExecutionPosture(request, governance?.readiness, endpointConfigured, blockers),
    stages,
    blockers,
    warnings,
    payloadPreview: {
      requestId: request.id,
      actionType: request.actionType,
      scope: request.scope.label,
      permissionRequired: request.permissionRequired,
      requestedBy: request.requestedBy.email ?? request.requestedBy.name,
      auditEventId: request.auditEventId,
      transitionAuditEventId: request.transitionAuditEventId,
      rollbackNotes: request.rollbackNotes,
      metadataKeys: Object.keys(request.metadata ?? {}),
    },
  }
}

export function summarizeActionExecution(packets: ActionExecutionPacket[]): ActionExecutionSummary {
  return {
    total: packets.length,
    readyForServer: packets.filter(packet => packet.posture === 'Ready For Server').length,
    reviewOnly: packets.filter(packet => packet.posture === 'Review Only').length,
    blocked: packets.filter(packet => packet.posture === 'Blocked').length,
    executing: packets.filter(packet => packet.posture === 'Executing').length,
    completed: packets.filter(packet => packet.posture === 'Completed').length,
    endpointConfigured: packets.some(packet => packet.endpointLabel !== 'No server endpoint configured'),
  }
}

export function getExecutionPostureTone(posture: ActionExecutionPosture): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (posture === 'Ready For Server' || posture === 'Completed') return 'ok'
  if (posture === 'Executing') return 'info'
  if (posture === 'Blocked') return 'danger'
  return 'warn'
}

export function getExecutionStageTone(status: ActionExecutionStageStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'pass') return 'ok'
  if (status === 'warn') return 'warn'
  return 'danger'
}

function createEndpointStage(config: ActionExecutionConfig): ActionExecutionStage {
  if (config.endpoint) {
    return {
      id: 'endpoint',
      label: 'Server Endpoint',
      status: 'pass',
      detail: `Execution endpoint configured at ${config.endpoint}.`,
    }
  }

  return {
    id: 'endpoint',
    label: 'Server Endpoint',
    status: 'warn',
    detail: 'No VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT is configured, so requests remain review-only contracts.',
  }
}

function createGovernanceStage(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord | undefined,
): ActionExecutionStage {
  if (!governance) {
    return {
      id: 'governance',
      label: 'Governance',
      status: 'fail',
      detail: 'No governance record is available for this request.',
    }
  }

  if (governance.hardBlockers.length) {
    return {
      id: 'governance',
      label: 'Governance',
      status: 'fail',
      detail: governance.hardBlockers[0],
    }
  }

  return {
    id: 'governance',
    label: 'Governance',
    status: governance.readiness === 'Ready' || governance.readiness === 'Executing' || governance.readiness === 'Completed' ? 'pass' : 'warn',
    detail: `${request.title} governance readiness is ${governance.readiness}.`,
  }
}

function createApprovalStage(governance: ActionRequestGovernanceRecord | undefined): ActionExecutionStage {
  if (!governance) {
    return {
      id: 'approval',
      label: 'Approval',
      status: 'fail',
      detail: 'No approval policy is available.',
    }
  }

  if (!governance.humanConfirmationRequired) {
    return {
      id: 'approval',
      label: 'Approval',
      status: 'pass',
      detail: 'Human confirmation is not required for this safety action.',
    }
  }

  return {
    id: 'approval',
    label: 'Approval',
    status: governance.readiness === 'Ready' || governance.readiness === 'Executing' || governance.readiness === 'Completed' ? 'pass' : 'warn',
    detail: `Requires confirmation from ${governance.requiredApprovers.join(', ')}.`,
  }
}

function createHandlerStage(request: AdminActionRequest): ActionExecutionStage {
  return {
    id: 'handler',
    label: 'Handler Contract',
    status: request.serverHandler?.key ? 'pass' : 'fail',
    detail: request.serverHandler?.key
      ? `${request.serverHandler.key}: ${request.serverHandler.description}`
      : 'No server handler contract is attached.',
  }
}

function createIdempotencyStage(idempotencyKey: string): ActionExecutionStage {
  return {
    id: 'idempotency',
    label: 'Idempotency',
    status: 'pass',
    detail: `Server calls must include idempotency key ${idempotencyKey}.`,
  }
}

function createAuditStage(request: AdminActionRequest): ActionExecutionStage {
  return {
    id: 'audit',
    label: 'Audit Chain',
    status: request.auditEventId ? 'pass' : 'fail',
    detail: request.auditEventId
      ? `Root audit event is ${request.auditEventId}.`
      : 'Missing root audit event.',
  }
}

function createRollbackStage(request: AdminActionRequest): ActionExecutionStage {
  const hasRollback = request.rollbackNotes.trim().length >= 24
  return {
    id: 'rollback',
    label: 'Rollback Metadata',
    status: hasRollback ? 'pass' : 'fail',
    detail: hasRollback ? request.rollbackNotes : 'Rollback metadata is required before execution.',
  }
}

function createBrowserBoundaryStage(): ActionExecutionStage {
  return {
    id: 'browser_boundary',
    label: 'Browser Boundary',
    status: 'pass',
    detail: 'Browser mutation is disabled; this packet must be submitted to a trusted server handler.',
  }
}

function getExecutionPosture(
  request: AdminActionRequest,
  readiness: ActionRequestReadiness | undefined,
  endpointConfigured: boolean,
  blockers: string[],
): ActionExecutionPosture {
  if (request.status === 'Completed') return 'Completed'
  if (request.status === 'Running') return blockers.length ? 'Blocked' : 'Executing'
  if (blockers.length || readiness === 'Blocked') return 'Blocked'
  if (readiness === 'Ready' && endpointConfigured) return 'Ready For Server'
  return 'Review Only'
}

function getEnvString(env: Record<string, unknown>, key: string) {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : ''
}
