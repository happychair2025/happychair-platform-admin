export type LedgerPersistenceStatus = 'local_durable' | 'server_pending' | 'server_recorded'
export type LedgerPersistenceTarget =
  | 'local_storage'
  | 'platform_admin.admin_action_requests'
  | 'platform_admin.audit_logs'
  | 'platform_admin.remediation_packets'
  | 'platform_admin.agent_events'

export interface DurableLedgerConfig {
  endpoint: string
  endpointConfigured: boolean
  endpointLabel: string
  mode: 'local_only' | 'trusted_server_ready'
}

export interface LedgerPersistencePlan<TTarget extends LedgerPersistenceTarget> {
  persistenceStatus: Exclude<LedgerPersistenceStatus, 'server_recorded'>
  persistenceTarget: TTarget | 'local_storage'
  syncRequired: boolean
  endpointLabel: string
  endpoint?: string
}

export const durableLedgerBoundaryRule =
  'Browser ledgers are reviewable intent records only. Production persistence must route through a trusted server endpoint that verifies permission, writes immutable audit, records rollback metadata, and then updates Platform Admin read views.'

export function getDurableLedgerConfig(env: Record<string, unknown> = getRuntimeEnv()): DurableLedgerConfig {
  const endpoint = getEnvString(env, 'VITE_PLATFORM_LEDGER_SERVER_ENDPOINT')
    || getEnvString(env, 'VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT')
    || ''

  return {
    endpoint,
    endpointConfigured: Boolean(endpoint),
    endpointLabel: endpoint ? 'Trusted server endpoint configured' : 'Trusted server endpoint pending',
    mode: endpoint ? 'trusted_server_ready' : 'local_only',
  }
}

export function createLedgerPersistencePlan<TTarget extends Exclude<LedgerPersistenceTarget, 'local_storage'>>(
  target: TTarget,
  env?: Record<string, unknown>,
): LedgerPersistencePlan<TTarget> {
  const config = getDurableLedgerConfig(env)

  if (config.endpointConfigured) {
    return {
      persistenceStatus: 'server_pending',
      persistenceTarget: target,
      syncRequired: true,
      endpoint: config.endpoint,
      endpointLabel: config.endpointLabel,
    }
  }

  return {
    persistenceStatus: 'local_durable',
    persistenceTarget: 'local_storage',
    syncRequired: false,
    endpointLabel: config.endpointLabel,
  }
}

export function getLedgerPersistenceLabel(status?: LedgerPersistenceStatus, target?: LedgerPersistenceTarget) {
  if (status === 'server_recorded') return 'Server Recorded'
  if (status === 'server_pending') return 'Server Pending'
  if (target === 'local_storage' || status === 'local_durable') return 'Local Ledger'
  return 'Untracked'
}

export function getLedgerPersistenceTone(status?: LedgerPersistenceStatus): 'ok' | 'warn' | 'info' | 'neutral' {
  if (status === 'server_recorded') return 'ok'
  if (status === 'server_pending') return 'warn'
  if (status === 'local_durable') return 'info'
  return 'neutral'
}

function getRuntimeEnv(): Record<string, unknown> {
  return import.meta.env as Record<string, unknown>
}

function getEnvString(env: Record<string, unknown>, key: string) {
  const value = env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
