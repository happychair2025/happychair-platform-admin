export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical'

export interface AuditEvent {
  id: string
  actor: string
  actorRole: string
  scope: string
  actionKey: string
  actionLabel: string
  severity: AuditSeverity
  createdAt: string
}

const storageKey = 'hc_platform_admin_audit_events'

export function getLocalAuditEvents(): AuditEvent[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as AuditEvent[]
  } catch {
    return []
  }
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>) {
  const nextEvent: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const events = [nextEvent, ...getLocalAuditEvents()].slice(0, 40)
  localStorage.setItem(storageKey, JSON.stringify(events))
  return nextEvent
}

