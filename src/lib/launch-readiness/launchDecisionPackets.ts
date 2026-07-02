import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { LaunchCommandItem } from './launchCommandMode'

export type LaunchDecisionPacketStatus = 'Drafted' | 'Queued For Review' | 'Approved For Follow-Up' | 'Assigned Follow-Up' | 'Deferred'
export type LaunchDecisionPacketReviewStatus = 'Approved For Follow-Up' | 'Assigned Follow-Up' | 'Deferred'

export interface LaunchDecisionPacket {
  id: string
  commandItemId: string
  type: LaunchCommandItem['type']
  title: string
  status: LaunchDecisionPacketStatus
  owner: string
  reference: string
  evidence: string
  nextDecision: string
  approvalPath: string[]
  serverActionRecommendation: string
  rollbackNotes: string
  auditEventId: string
  generatedBy: string
  generatedByEmail: string
  generatedByRole: string
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  reviewedByEmail?: string
  reviewedByRole?: string
  followUpOwner?: string
  createdAt: string
  updatedAt?: string
}

export interface LaunchDecisionPacketInput {
  item: LaunchCommandItem
  session: AdminSession
  actorRole: string
  auditEventId: string
  status?: LaunchDecisionPacketStatus
}

export interface LaunchDecisionPacketReviewInput {
  packet: LaunchDecisionPacket
  status: LaunchDecisionPacketReviewStatus
  session: AdminSession
  actorRole: string
  auditEventId: string
  note: string
  followUpOwner: string
}

const storageKey = 'hc_platform_launch_decision_packets'
const listeners = new Set<() => void>()
let cachedRawPackets = ''
let cachedPackets: LaunchDecisionPacket[] = []

export function getLaunchDecisionPackets(): LaunchDecisionPacket[] {
  if (typeof localStorage === 'undefined') return []
  const rawPackets = localStorage.getItem(storageKey) ?? '[]'
  if (rawPackets === cachedRawPackets) return cachedPackets

  try {
    cachedRawPackets = rawPackets
    cachedPackets = JSON.parse(rawPackets) as LaunchDecisionPacket[]
    return cachedPackets
  } catch {
    cachedRawPackets = rawPackets
    cachedPackets = []
    return []
  }
}

export function saveLaunchDecisionPacket(input: LaunchDecisionPacketInput) {
  const existing = getLaunchDecisionPackets()
  const previous = existing.find(packet => packet.commandItemId === input.item.id)
  const packet: LaunchDecisionPacket = {
    id: previous?.id ?? crypto.randomUUID(),
    commandItemId: input.item.id,
    type: input.item.type,
    title: input.item.title,
    status: input.status ?? previous?.status ?? 'Drafted',
    owner: input.item.owner,
    reference: input.item.reference,
    evidence: input.item.whyItMatters,
    nextDecision: input.item.nextDecision,
    approvalPath: getApprovalPath(input.item),
    serverActionRecommendation: getServerActionRecommendation(input.item),
    rollbackNotes: getRollbackNotes(input.item),
    auditEventId: input.auditEventId,
    generatedBy: input.session.name,
    generatedByEmail: input.session.email,
    generatedByRole: input.actorRole,
    reviewNote: previous?.reviewNote,
    reviewedAt: previous?.reviewedAt,
    reviewedBy: previous?.reviewedBy,
    reviewedByEmail: previous?.reviewedByEmail,
    reviewedByRole: previous?.reviewedByRole,
    followUpOwner: previous?.followUpOwner,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    updatedAt: previous ? new Date().toISOString() : undefined,
  }
  const packets = [
    packet,
    ...existing.filter(item => item.id !== packet.id),
  ].slice(0, 120)

  cachedPackets = packets
  cachedRawPackets = JSON.stringify(packets)
  localStorage.setItem(storageKey, cachedRawPackets)
  emitLaunchDecisionPacketChange()
  return packet
}

export function reviewLaunchDecisionPacket(input: LaunchDecisionPacketReviewInput) {
  const existing = getLaunchDecisionPackets()
  const current = existing.find(packet => packet.id === input.packet.id) ?? input.packet
  const reviewedAt = new Date().toISOString()
  const packet: LaunchDecisionPacket = {
    ...current,
    status: input.status,
    auditEventId: input.auditEventId,
    reviewNote: input.note.trim() || defaultReviewNote(input.status, current),
    reviewedAt,
    reviewedBy: input.session.name,
    reviewedByEmail: input.session.email,
    reviewedByRole: input.actorRole,
    followUpOwner: input.followUpOwner,
    updatedAt: reviewedAt,
  }
  const packets = [
    packet,
    ...existing.filter(item => item.id !== packet.id),
  ].slice(0, 120)

  cachedPackets = packets
  cachedRawPackets = JSON.stringify(packets)
  localStorage.setItem(storageKey, cachedRawPackets)
  emitLaunchDecisionPacketChange()
  return packet
}

export function subscribeToLaunchDecisionPackets(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchDecisionPackets() {
  return useSyncExternalStore(subscribeToLaunchDecisionPackets, getLaunchDecisionPackets, () => [])
}

export function getLatestPacketByCommandItem(packets: LaunchDecisionPacket[]) {
  const packetByCommandItem = new Map<string, LaunchDecisionPacket>()
  packets.forEach(packet => {
    if (!packetByCommandItem.has(packet.commandItemId)) packetByCommandItem.set(packet.commandItemId, packet)
  })
  return packetByCommandItem
}

export function getLaunchDecisionPacketStatusTone(status: LaunchDecisionPacketStatus): 'ok' | 'warn' | 'info' | 'neutral' {
  if (status === 'Approved For Follow-Up') return 'ok'
  if (status === 'Deferred') return 'warn'
  if (status === 'Queued For Review') return 'warn'
  if (status === 'Assigned Follow-Up' || status === 'Drafted') return 'info'
  return 'neutral'
}

function getApprovalPath(item: LaunchCommandItem) {
  if (item.type === 'Server Action') return ['Owner', item.owner, 'Admin Action Governance']
  if (item.status === 'Blocked') return ['Owner', item.owner, 'Engineering']
  return ['Owner', item.owner]
}

function getServerActionRecommendation(item: LaunchCommandItem) {
  if (item.type === 'Server Action') return 'Review the existing Admin Action Request before execution. Do not create a duplicate mutation path.'
  if (item.type === 'Gate Blocker') return 'Create or link a server-side action request only if resolving the blocker requires production state changes.'
  return 'Use sign-off evidence first. Queue a server action only if follow-up requires production state changes.'
}

function getRollbackNotes(item: LaunchCommandItem) {
  if (item.type === 'Server Action') return 'Preserve current queue state, keep the audit trail, and revert only through the approved server handler rollback path.'
  return 'This packet is review evidence only. If follow-up creates a production action, that action must include its own rollback plan.'
}

function defaultReviewNote(status: LaunchDecisionPacketReviewStatus, packet: LaunchDecisionPacket) {
  if (status === 'Approved For Follow-Up') return `${packet.title} approved for follow-up with current evidence and rollback notes attached.`
  if (status === 'Deferred') return `${packet.title} deferred until owner review clears the launch decision.`
  return `${packet.title} assigned for accountable follow-up before launch approval.`
}

function emitLaunchDecisionPacketChange() {
  listeners.forEach(listener => listener())
}
