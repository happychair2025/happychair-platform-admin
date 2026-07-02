import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { LaunchGate, LaunchGateArea, LaunchGateStatus } from './launchReadiness'

export type LaunchSignOffDecision = 'Assigned' | 'Approved' | 'Deferred' | 'Resolved'

export interface LaunchGateSignOff {
  id: string
  gateId: string
  gateTitle: string
  area: LaunchGateArea
  gateStatus: LaunchGateStatus
  decision: LaunchSignOffDecision
  assignedTo: string
  note: string
  actor: string
  actorEmail: string
  actorRole: string
  auditEventId: string
  createdAt: string
}

export interface LaunchGateSignOffInput {
  gate: LaunchGate
  decision: LaunchSignOffDecision
  assignedTo: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_gate_signoffs'
const listeners = new Set<() => void>()
let cachedRawSignOffs = ''
let cachedSignOffs: LaunchGateSignOff[] = []

export const launchSignOffDecisions: LaunchSignOffDecision[] = ['Assigned', 'Approved', 'Deferred', 'Resolved']
export const launchSignOffOwners = ['Owner', 'Engineering', 'Support', 'Client Success', 'Finance', 'Marketing']

export function getLaunchGateSignOffs(): LaunchGateSignOff[] {
  if (typeof localStorage === 'undefined') return []
  const rawSignOffs = localStorage.getItem(storageKey) ?? '[]'
  if (rawSignOffs === cachedRawSignOffs) return cachedSignOffs

  try {
    cachedRawSignOffs = rawSignOffs
    cachedSignOffs = JSON.parse(rawSignOffs) as LaunchGateSignOff[]
    return cachedSignOffs
  } catch {
    cachedRawSignOffs = rawSignOffs
    cachedSignOffs = []
    return []
  }
}

export function saveLaunchGateSignOff(input: LaunchGateSignOffInput) {
  const signOff: LaunchGateSignOff = {
    id: crypto.randomUUID(),
    gateId: input.gate.id,
    gateTitle: input.gate.title,
    area: input.gate.area,
    gateStatus: input.gate.status,
    decision: input.decision,
    assignedTo: input.assignedTo,
    note: input.note.trim() || defaultSignOffNote(input.decision, input.gate),
    actor: input.session.name,
    actorEmail: input.session.email,
    actorRole: input.actorRole,
    auditEventId: input.auditEventId,
    createdAt: new Date().toISOString(),
  }
  const signOffs = [signOff, ...getLaunchGateSignOffs()].slice(0, 120)
  cachedSignOffs = signOffs
  cachedRawSignOffs = JSON.stringify(signOffs)
  localStorage.setItem(storageKey, cachedRawSignOffs)
  emitLaunchSignOffChange()
  return signOff
}

export function subscribeToLaunchGateSignOffs(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchGateSignOffs() {
  return useSyncExternalStore(subscribeToLaunchGateSignOffs, getLaunchGateSignOffs, () => [])
}

export function getLatestSignOffByGate(signOffs: LaunchGateSignOff[]) {
  const latestByGate = new Map<string, LaunchGateSignOff>()
  signOffs.forEach(signOff => {
    if (!latestByGate.has(signOff.gateId)) latestByGate.set(signOff.gateId, signOff)
  })
  return latestByGate
}

export function getLaunchSignOffDecisionTone(decision: LaunchSignOffDecision): 'ok' | 'warn' | 'info' | 'neutral' {
  if (decision === 'Approved' || decision === 'Resolved') return 'ok'
  if (decision === 'Deferred') return 'warn'
  if (decision === 'Assigned') return 'info'
  return 'neutral'
}

function defaultSignOffNote(decision: LaunchSignOffDecision, gate: LaunchGate) {
  if (decision === 'Approved') return `${gate.title} approved for launch review with current evidence.`
  if (decision === 'Resolved') return `${gate.title} marked resolved for launch review.`
  if (decision === 'Deferred') return `${gate.title} deferred pending owner follow-up.`
  return `${gate.title} assigned for owner review.`
}

function emitLaunchSignOffChange() {
  listeners.forEach(listener => listener())
}
