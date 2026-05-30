import { useSyncExternalStore } from 'react'
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
  return {
    ...packet,
    updatedAt: new Date().toISOString(),
    persistenceStatus: packet.persistenceStatus ?? 'local_durable',
    persistenceTarget: packet.persistenceTarget ?? 'local_storage',
  }
}

function emitRemediationChange() {
  listeners.forEach(listener => listener())
}
