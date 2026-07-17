import { useSyncExternalStore } from 'react'
import { createLedgerPersistencePlan } from '../platform-ledger/durableLedger'

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical'
export type AuditOutcome = 'allowed' | 'blocked' | 'recorded'
export type AuditPersistenceStatus = 'local_durable' | 'server_recorded' | 'server_pending'
export type AuditPersistenceTarget = 'local_storage' | 'platform_admin.audit_logs'

export interface AuditEvent {
  id: string
  actor: string
  actorEmail?: string
  actorRole: string
  scope: string
  actionKey: string
  actionLabel: string
  severity: AuditSeverity
  permission?: string
  outcome?: AuditOutcome
  metadata?: Record<string, unknown>
  persistenceStatus?: AuditPersistenceStatus
  persistenceTarget?: AuditPersistenceTarget
  serverEndpointLabel?: string
  serverSyncRequired?: boolean
  createdAt: string
}

const storageKey = 'hc_platform_admin_audit_events'
const listeners = new Set<() => void>()
let cachedRawEvents = ''
let cachedEvents: AuditEvent[] = []

export function getLocalAuditEvents(): AuditEvent[] {
  if (typeof localStorage === 'undefined') return []
  const rawEvents = localStorage.getItem(storageKey) ?? '[]'
  if (rawEvents === cachedRawEvents) return cachedEvents

  try {
    cachedRawEvents = rawEvents
    cachedEvents = JSON.parse(rawEvents) as AuditEvent[]
    return cachedEvents
  } catch {
    cachedRawEvents = rawEvents
    cachedEvents = []
    return []
  }
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>) {
  const persistence = event.persistenceStatus === 'server_recorded'
    ? {
      persistenceStatus: 'server_recorded' as const,
      persistenceTarget: 'platform_admin.audit_logs' as const,
      syncRequired: false,
      endpointLabel: 'Read-only server record',
    }
    : createLedgerPersistencePlan('platform_admin.audit_logs')
  const nextEvent: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    outcome: event.outcome ?? 'recorded',
    persistenceStatus: event.persistenceStatus ?? persistence.persistenceStatus,
    persistenceTarget: event.persistenceTarget ?? persistence.persistenceTarget,
    serverEndpointLabel: event.serverEndpointLabel ?? persistence.endpointLabel,
    serverSyncRequired: event.serverSyncRequired ?? persistence.syncRequired,
    createdAt: new Date().toISOString(),
  }
  const events = [nextEvent, ...getLocalAuditEvents()].slice(0, 40)
  cachedEvents = events
  cachedRawEvents = JSON.stringify(events)
  localStorage.setItem(storageKey, cachedRawEvents)
  emitAuditChange()
  return nextEvent
}

export function subscribeToAuditEvents(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLocalAuditEvents() {
  return useSyncExternalStore(subscribeToAuditEvents, getLocalAuditEvents, () => [])
}

function emitAuditChange() {
  listeners.forEach(listener => listener())
}
