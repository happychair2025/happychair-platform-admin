import { useSyncExternalStore } from 'react'
import { createLedgerPersistencePlan } from '../platform-ledger/durableLedger'
import type { RunbookActionOutcome, RunbookOutcomeStatus } from './runbooks'

const storageKey = 'hc_platform_admin_remediation_packets'
const listeners = new Set<() => void>()
let cachedRawPackets = ''
let cachedPackets: RunbookActionOutcome[] = []

export function getLocalRemediationPackets(): RunbookActionOutcome[] {
  if (typeof localStorage === 'undefined') return []
  const rawPackets = localStorage.getItem(storageKey) ?? '[]'
  if (rawPackets === cachedRawPackets) return cachedPackets

  try {
    cachedRawPackets = rawPackets
    cachedPackets = JSON.parse(rawPackets) as RunbookActionOutcome[]
    return cachedPackets
  } catch {
    cachedRawPackets = rawPackets
    cachedPackets = []
    return []
  }
}

export function saveRemediationPacket(packet: RunbookActionOutcome) {
  const nextPacket = withLocalPersistence(packet)
  const existing = getLocalRemediationPackets()
  const packets = [
    nextPacket,
    ...existing.filter(item => item.id !== nextPacket.id),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40)

  cachedPackets = packets
  cachedRawPackets = JSON.stringify(packets)
  localStorage.setItem(storageKey, cachedRawPackets)
  emitRemediationChange()
  return nextPacket
}

export function updateRemediationPacketStatus(packet: RunbookActionOutcome, status: RunbookOutcomeStatus) {
  return saveRemediationPacket({
    ...packet,
    status,
    updatedAt: new Date().toISOString(),
  })
}

export function subscribeToRemediationPackets(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useRemediationPackets() {
  return useSyncExternalStore(subscribeToRemediationPackets, getLocalRemediationPackets, () => [])
}

function withLocalPersistence(packet: RunbookActionOutcome): RunbookActionOutcome {
  const persistence = packet.persistenceStatus === 'server_recorded'
    ? {
      persistenceStatus: 'server_recorded' as const,
      persistenceTarget: 'platform_admin.remediation_packets' as const,
      syncRequired: false,
      endpointLabel: 'Read-only server record',
    }
    : createLedgerPersistencePlan('platform_admin.remediation_packets')
  return {
    ...packet,
    updatedAt: new Date().toISOString(),
    persistenceStatus: packet.persistenceStatus ?? persistence.persistenceStatus,
    persistenceTarget: packet.persistenceTarget ?? persistence.persistenceTarget,
  }
}

function emitRemediationChange() {
  listeners.forEach(listener => listener())
}
