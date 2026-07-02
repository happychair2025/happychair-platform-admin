import { useEffect, useState } from 'react'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type {
  CommandDigestHeadline,
  CommandDigestItem,
  CommandDigestPosture,
  CommandDigestSeverity,
  CommandDigestSummary,
} from './commandDigest'

export type CommandBriefSnapshotStatus = 'Draft' | 'Reviewed' | 'Export Ready'
export type CommandBriefReviewAction = 'Created' | 'Reviewed' | 'Export Ready' | 'Follow-Up Queued'

export interface CommandBriefSnapshotItem {
  id: string
  title: string
  lane: string
  severity: CommandDigestSeverity
  decision: string
  owner: string
  scope: string
  source: string
  sourceStatus: string
  score: number
  dueAt: string
  recommendedAction: string
  evidence: string[]
  relatedRecordId: string
}

export interface CommandBriefFollowUpTrace {
  id: string
  title: string
  status: string
  actionType: string
  permissionRequired: string
  scope: string
  auditEventId: string
  createdAt: string
}

export interface CommandBriefReviewEvent {
  id: string
  action: CommandBriefReviewAction
  actor: string
  actorRole: string
  note: string
  auditEventId?: string
  createdAt: string
}

export interface CommandBriefSnapshot {
  id: string
  title: string
  status: CommandBriefSnapshotStatus
  sourceLabel: string
  generatedAt: string
  generatedBy: string
  generatedByRole: string
  posture: CommandDigestPosture
  readinessScore: number
  narrative: string
  itemCount: number
  criticalCount: number
  highCount: number
  decisionCount: number
  handoffCount: number
  revenueAtRisk: number
  supportEscalations: number
  clientsImpacted: number
  headlines: CommandDigestHeadline[]
  topItems: CommandBriefSnapshotItem[]
  followUpTrace: CommandBriefFollowUpTrace[]
  reviewEvents: CommandBriefReviewEvent[]
  localNote?: string
}

export interface BuildCommandBriefSnapshotInput {
  title?: string
  sourceLabel: string
  generatedBy: string
  generatedByRole: string
  summary: CommandDigestSummary
  narrative: string
  headlines: CommandDigestHeadline[]
  items: CommandDigestItem[]
  actionRequests: AdminActionRequest[]
  now?: Date
}

export interface CommandBriefArchiveSummary {
  total: number
  reviewed: number
  exportReady: number
  openFollowUps: number
  archivedItems: number
  latestPosture: CommandDigestPosture
}

const localStorageKey = 'hc_platform_command_brief_snapshots_v1'

export const commandBriefArchiveBoundaryRule =
  'Brief Archive snapshots are local executive records over read-only command signals. Export packets are generated for review and handoff only; production changes must still go through governed Admin Action Requests.'

export function buildCommandBriefSnapshot(input: BuildCommandBriefSnapshotInput): CommandBriefSnapshot {
  const now = input.now ?? new Date()
  const generatedAt = now.toISOString()
  const topItems = input.items.slice(0, 12).map(toSnapshotItem)
  const followUpTrace = buildBriefFollowUpTrace(input.items, input.actionRequests)

  return {
    id: `brief-${now.getTime()}-${crypto.randomUUID().slice(0, 8)}`,
    title: input.title ?? `Command Brief / ${formatBriefDate(generatedAt)}`,
    status: 'Draft',
    sourceLabel: input.sourceLabel,
    generatedAt,
    generatedBy: input.generatedBy,
    generatedByRole: input.generatedByRole,
    posture: input.summary.posture,
    readinessScore: input.summary.readinessScore,
    narrative: input.narrative,
    itemCount: input.summary.total,
    criticalCount: input.summary.critical,
    highCount: input.summary.high,
    decisionCount: input.summary.decisionsNeeded,
    handoffCount: input.summary.handoffsReady,
    revenueAtRisk: input.summary.revenueAtRisk,
    supportEscalations: input.summary.supportEscalations,
    clientsImpacted: input.summary.clientsImpacted,
    headlines: input.headlines,
    topItems,
    followUpTrace,
    reviewEvents: [{
      id: `event-${crypto.randomUUID()}`,
      action: 'Created',
      actor: input.generatedBy,
      actorRole: input.generatedByRole,
      note: 'Snapshot generated from the current Command Digest.',
      createdAt: generatedAt,
    }],
  }
}

export function summarizeCommandBriefArchive(snapshots: CommandBriefSnapshot[]): CommandBriefArchiveSummary {
  const latest = snapshots[0]
  return {
    total: snapshots.length,
    reviewed: snapshots.filter(snapshot => snapshot.status === 'Reviewed' || snapshot.status === 'Export Ready').length,
    exportReady: snapshots.filter(snapshot => snapshot.status === 'Export Ready').length,
    openFollowUps: snapshots.reduce((total, snapshot) => total + snapshot.followUpTrace.filter(trace => trace.status !== 'Completed').length, 0),
    archivedItems: snapshots.reduce((total, snapshot) => total + snapshot.itemCount, 0),
    latestPosture: latest?.posture ?? 'Steady',
  }
}

export function buildCommandBriefExportPacket(snapshot: CommandBriefSnapshot) {
  const lines = [
    `# ${snapshot.title}`,
    '',
    `Generated: ${formatBriefDateTime(snapshot.generatedAt)}`,
    `Generated by: ${snapshot.generatedBy} (${snapshot.generatedByRole})`,
    `Source: ${snapshot.sourceLabel}`,
    `Status: ${snapshot.status}`,
    `Posture: ${snapshot.posture}`,
    `Readiness: ${snapshot.readinessScore}%`,
    '',
    '## Executive Narrative',
    snapshot.narrative,
    '',
    '## Operating Metrics',
    `- Items in brief: ${snapshot.itemCount}`,
    `- Critical items: ${snapshot.criticalCount}`,
    `- High items: ${snapshot.highCount}`,
    `- Decisions needed: ${snapshot.decisionCount}`,
    `- Handoffs ready: ${snapshot.handoffCount}`,
    `- Revenue at risk: ${formatBriefCurrency(snapshot.revenueAtRisk)}`,
    `- Support escalations: ${snapshot.supportEscalations}`,
    `- Impacted client signals: ${snapshot.clientsImpacted}`,
    '',
    '## Headlines',
    ...snapshot.headlines.map(headline => `- ${headline.label}: ${headline.value} - ${headline.detail}`),
    '',
    '## Top Decisions',
    ...snapshot.topItems.flatMap((item, index) => [
      `${index + 1}. [${item.severity}] ${item.title}`,
      `   - Lane: ${item.lane}`,
      `   - Decision: ${item.decision}`,
      `   - Owner: ${item.owner}`,
      `   - Scope: ${item.scope}`,
      `   - Source: ${item.source} / ${item.sourceStatus}`,
      `   - Due: ${formatBriefDateTime(item.dueAt)}`,
      `   - Recommended action: ${item.recommendedAction}`,
      `   - Evidence: ${item.evidence.slice(0, 3).join('; ')}`,
    ]),
    '',
    '## Follow-Up Trace',
    ...(snapshot.followUpTrace.length
      ? snapshot.followUpTrace.map(trace => `- ${trace.status}: ${trace.title} (${trace.id}) / ${trace.permissionRequired}`)
      : ['- No command digest follow-ups were queued at snapshot time.']),
    '',
    '## Review History',
    ...snapshot.reviewEvents.map(event => `- ${formatBriefDateTime(event.createdAt)} / ${event.action} / ${event.actor}: ${event.note}`),
    '',
    '## Governance Boundary',
    commandBriefArchiveBoundaryRule,
  ]

  return lines.join('\n')
}

export function appendCommandBriefReviewEvent(
  snapshot: CommandBriefSnapshot,
  event: Omit<CommandBriefReviewEvent, 'id' | 'createdAt'>,
): CommandBriefSnapshot {
  const nextEvent: CommandBriefReviewEvent = {
    ...event,
    id: `event-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  }

  return {
    ...snapshot,
    status: event.action === 'Export Ready' ? 'Export Ready' : event.action === 'Reviewed' ? 'Reviewed' : snapshot.status,
    reviewEvents: [nextEvent, ...snapshot.reviewEvents].slice(0, 24),
  }
}

export function appendCommandBriefFollowUp(snapshot: CommandBriefSnapshot, request: AdminActionRequest): CommandBriefSnapshot {
  return {
    ...appendCommandBriefReviewEvent(snapshot, {
      action: 'Follow-Up Queued',
      actor: request.requestedBy.name,
      actorRole: request.requestedBy.role,
      note: `Queued ${request.title}.`,
      auditEventId: request.auditEventId,
    }),
    followUpTrace: [toFollowUpTrace(request), ...snapshot.followUpTrace.filter(trace => trace.id !== request.id)].slice(0, 24),
  }
}

export function getBriefSnapshotStatusTone(status: CommandBriefSnapshotStatus) {
  if (status === 'Export Ready') return 'ok' as const
  if (status === 'Reviewed') return 'info' as const
  return 'neutral' as const
}

export function getBriefPostureTone(posture: CommandDigestPosture) {
  if (posture === 'Critical') return 'danger' as const
  if (posture === 'Needs Attention') return 'warn' as const
  return 'ok' as const
}

export function formatBriefCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function loadLocalCommandBriefSnapshots(): CommandBriefSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCommandBriefSnapshot)
  } catch {
    return []
  }
}

export function saveLocalCommandBriefSnapshots(snapshots: CommandBriefSnapshot[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(snapshots.slice(0, 60)))
}

export function useLocalCommandBriefSnapshots() {
  const [snapshots, setSnapshots] = useState<CommandBriefSnapshot[]>(() => loadLocalCommandBriefSnapshots())

  useEffect(() => {
    saveLocalCommandBriefSnapshots(snapshots)
  }, [snapshots])

  return [snapshots, setSnapshots] as const
}

function buildBriefFollowUpTrace(items: CommandDigestItem[], actionRequests: AdminActionRequest[]) {
  const digestItemIds = new Set(items.map(item => item.id))
  const relatedRecordIds = new Set(items.map(item => item.relatedRecordId))

  return actionRequests
    .filter(request => {
      const metadata = request.metadata ?? {}
      return metadata.source === 'command_digest'
        || (typeof metadata.digestItemId === 'string' && digestItemIds.has(metadata.digestItemId))
        || relatedRecordIds.has(request.scope.label)
        || request.title.startsWith('Command digest follow-up:')
    })
    .slice(0, 24)
    .map(toFollowUpTrace)
}

function toSnapshotItem(item: CommandDigestItem): CommandBriefSnapshotItem {
  return {
    id: item.id,
    title: item.title,
    lane: item.lane,
    severity: item.severity,
    decision: item.decision,
    owner: item.owner,
    scope: item.scope,
    source: item.source,
    sourceStatus: item.sourceStatus,
    score: item.score,
    dueAt: item.dueAt,
    recommendedAction: item.recommendedAction,
    evidence: item.evidence,
    relatedRecordId: item.relatedRecordId,
  }
}

function toFollowUpTrace(request: AdminActionRequest): CommandBriefFollowUpTrace {
  return {
    id: request.id,
    title: request.title,
    status: request.status,
    actionType: request.actionType,
    permissionRequired: request.permissionRequired,
    scope: request.scope.label,
    auditEventId: request.auditEventId,
    createdAt: request.createdAt,
  }
}

function isCommandBriefSnapshot(value: unknown): value is CommandBriefSnapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.status === 'string'
    && typeof record.generatedAt === 'string'
    && Array.isArray(record.topItems)
}

function formatBriefDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatBriefDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
