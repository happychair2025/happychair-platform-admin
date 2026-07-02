import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { ExecutiveGoNoGoEvidenceItem, ExecutiveGoNoGoRoom } from './executiveGoNoGoRoom'
import type { LaunchCommandItem, LaunchCommandModeModel } from './launchCommandMode'
import type { LaunchCommandSavedViewSurface, LaunchCommandSavedViewsModel } from './launchCommandSavedViews'
import type { LaunchEvidenceLedger } from './launchEvidenceLedger'
import type { LaunchExceptionSlaBoard, LaunchExceptionSlaItem } from './launchExceptionSlaBoard'
import type { LaunchFollowUpItem, LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchReadinessModel } from './launchReadiness'
import type { LaunchWarRoomTimeline, LaunchWarRoomTimelineEvent } from './launchWarRoomTimeline'

export type LaunchOwnerDailyBriefStatus = 'Blocked' | 'Attention' | 'Ready'
export type LaunchOwnerDailyBriefDecisionStatus = 'Critical' | 'Action Needed' | 'Review' | 'Ready'

export interface LaunchOwnerDailyBriefDecision {
  id: string
  status: LaunchOwnerDailyBriefDecisionStatus
  title: string
  owner: string
  source: string
  reference: string
  ask: string
  evidence: string
  dueAt: string
  surface: LaunchCommandSavedViewSurface
  auditBacked: boolean
  localOnly: boolean
}

export interface LaunchOwnerDailyBriefSection {
  id: string
  label: string
  status: LaunchOwnerDailyBriefDecisionStatus
  headline: string
  body: string
  count: number
  nextStep: string
}

export interface LaunchOwnerDailyBriefOwnerLoad {
  owner: string
  total: number
  critical: number
  actionNeeded: number
  review: number
  nextStep: string
}

export interface LaunchOwnerDailyBrief {
  status: LaunchOwnerDailyBriefStatus
  headline: string
  summary: string
  generatedAt: string
  readinessScore: number
  launchStatus: LaunchReadinessModel['status']
  goNoGoDecision: ExecutiveGoNoGoRoom['decision']
  decisions: LaunchOwnerDailyBriefDecision[]
  nextDecision?: LaunchOwnerDailyBriefDecision
  sections: LaunchOwnerDailyBriefSection[]
  ownerLoads: LaunchOwnerDailyBriefOwnerLoad[]
  decisionCount: number
  criticalCount: number
  actionNeededCount: number
  reviewCount: number
  overdueSlaCount: number
  dueSoonSlaCount: number
  actionHandoffCount: number
  auditBackedCount: number
  activeOwnerCount: number
  recordCount: number
  latestRecord?: LaunchOwnerDailyBriefRecord
}

export interface LaunchOwnerDailyBriefRecord {
  id: string
  status: LaunchOwnerDailyBriefStatus
  headline: string
  decisionCount: number
  criticalCount: number
  actionNeededCount: number
  overdueSlaCount: number
  actionHandoffCount: number
  topDecisionTitle: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildLaunchOwnerDailyBriefInput {
  readinessModel: LaunchReadinessModel
  commandMode: LaunchCommandModeModel
  launchWarRoomTimeline: LaunchWarRoomTimeline
  launchCommandSavedViews: LaunchCommandSavedViewsModel
  launchExceptionSlaBoard: LaunchExceptionSlaBoard
  executiveGoNoGoRoom: ExecutiveGoNoGoRoom
  followUpRegister: LaunchFollowUpRegisterModel
  evidenceLedger: LaunchEvidenceLedger
  records: LaunchOwnerDailyBriefRecord[]
}

interface SaveLaunchOwnerDailyBriefRecordInput {
  brief: LaunchOwnerDailyBrief
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_owner_daily_brief_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: LaunchOwnerDailyBriefRecord[] = []

export const launchOwnerDailyBriefBoundaryRule =
  'Launch Owner Daily Brief records are review and communication artifacts only. They do not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchOwnerDailyBrief(input: BuildLaunchOwnerDailyBriefInput): LaunchOwnerDailyBrief {
  const generatedAt = new Date().toISOString()
  const decisions = dedupeDecisions([
    ...input.launchExceptionSlaBoard.items
      .filter(item => item.status === 'Overdue' || item.status === 'Due Soon' || item.level === 'Executive Review' || item.level === 'Action Handoff')
      .map(decisionFromSlaItem),
    ...input.commandMode.items.map(decisionFromCommandItem),
    ...input.executiveGoNoGoRoom.items.filter(item => item.status !== 'Clear').map(decisionFromGoNoGoItem),
    ...input.launchWarRoomTimeline.events
      .filter(event => event.status === 'Critical' || event.status === 'Action Needed')
      .map(decisionFromWarRoomEvent),
    ...input.followUpRegister.items.filter(item => item.status !== 'Resolved').map(decisionFromFollowUpItem),
  ]).slice(0, 36)
  const criticalCount = decisions.filter(decision => decision.status === 'Critical').length
  const actionNeededCount = decisions.filter(decision => decision.status === 'Action Needed').length
  const reviewCount = decisions.filter(decision => decision.status === 'Review').length
  const status: LaunchOwnerDailyBriefStatus = criticalCount > 0 || input.executiveGoNoGoRoom.decision === 'No Go'
    ? 'Blocked'
    : actionNeededCount > 0 || input.executiveGoNoGoRoom.decision === 'Conditional Go'
      ? 'Attention'
      : 'Ready'

  return {
    status,
    headline: getBriefHeadline(status, input, criticalCount, actionNeededCount),
    summary: getBriefSummary(status, input, decisions.length),
    generatedAt,
    readinessScore: input.readinessModel.score,
    launchStatus: input.readinessModel.status,
    goNoGoDecision: input.executiveGoNoGoRoom.decision,
    decisions,
    nextDecision: decisions.find(decision => decision.status === 'Critical' || decision.status === 'Action Needed') ?? decisions[0],
    sections: buildSections(input, status, decisions),
    ownerLoads: buildOwnerLoads(decisions),
    decisionCount: decisions.length,
    criticalCount,
    actionNeededCount,
    reviewCount,
    overdueSlaCount: input.launchExceptionSlaBoard.overdueCount,
    dueSoonSlaCount: input.launchExceptionSlaBoard.dueSoonCount,
    actionHandoffCount: input.launchExceptionSlaBoard.actionHandoffCount,
    auditBackedCount: decisions.filter(decision => decision.auditBacked).length,
    activeOwnerCount: new Set(decisions.filter(decision => decision.status !== 'Ready').map(decision => decision.owner)).size,
    recordCount: input.records.length,
    latestRecord: input.records[0],
  }
}

export function getLaunchOwnerDailyBriefRecords(): LaunchOwnerDailyBriefRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchOwnerDailyBriefRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchOwnerDailyBriefRecord(input: SaveLaunchOwnerDailyBriefRecordInput) {
  const record: LaunchOwnerDailyBriefRecord = {
    id: crypto.randomUUID(),
    status: input.brief.status,
    headline: input.brief.headline,
    decisionCount: input.brief.decisionCount,
    criticalCount: input.brief.criticalCount,
    actionNeededCount: input.brief.actionNeededCount,
    overdueSlaCount: input.brief.overdueSlaCount,
    actionHandoffCount: input.brief.actionHandoffCount,
    topDecisionTitle: input.brief.nextDecision?.title ?? 'No owner decision required',
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchOwnerDailyBriefRecords()].slice(0, 120)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchOwnerDailyBriefRecordChange()
  return record
}

export function subscribeToLaunchOwnerDailyBriefRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchOwnerDailyBriefRecords() {
  return useSyncExternalStore(subscribeToLaunchOwnerDailyBriefRecords, getLaunchOwnerDailyBriefRecords, () => [])
}

export function getLaunchOwnerDailyBriefStatusTone(status: LaunchOwnerDailyBriefStatus | LaunchOwnerDailyBriefDecisionStatus) {
  if (status === 'Blocked' || status === 'Critical') return 'danger' as const
  if (status === 'Attention' || status === 'Action Needed') return 'warn' as const
  if (status === 'Review') return 'info' as const
  return 'ok' as const
}

export function getLaunchOwnerDailyBriefFilename(brief: LaunchOwnerDailyBrief) {
  return `launch-owner-daily-brief-${brief.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchOwnerDailyBriefHtml(brief: LaunchOwnerDailyBrief, session: AdminSession) {
  const sectionRows = brief.sections.map(section => `
    <tr>
      <td>${escapeHtml(section.label)}</td>
      <td>${escapeHtml(section.status)}</td>
      <td>${section.count}</td>
      <td>${escapeHtml(section.headline)}</td>
      <td>${escapeHtml(section.nextStep)}</td>
    </tr>
  `).join('')
  const decisionRows = brief.decisions.map(decision => `
    <tr>
      <td>${escapeHtml(decision.dueAt)}</td>
      <td>${escapeHtml(decision.status)}</td>
      <td>${escapeHtml(decision.title)}</td>
      <td>${escapeHtml(decision.owner)}</td>
      <td>${escapeHtml(decision.source)}</td>
      <td>${escapeHtml(decision.ask)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Launch Owner Daily Brief</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 17px; }
      p, td { line-height: 1.55; }
      .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .meta div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Launch Owner Daily Brief</p>
        <h1>${escapeHtml(brief.headline)}</h1>
        <p>${escapeHtml(brief.summary)}</p>
        <p>${escapeHtml(launchOwnerDailyBriefBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(brief.status)}</strong></div>
        <div><span>Readiness</span><strong>${brief.readinessScore}% / ${escapeHtml(brief.launchStatus)}</strong></div>
        <div><span>Go / No-Go</span><strong>${escapeHtml(brief.goNoGoDecision)}</strong></div>
        <div><span>Decisions</span><strong>${brief.decisionCount}</strong></div>
        <div><span>Critical</span><strong>${brief.criticalCount}</strong></div>
        <div><span>Overdue SLA</span><strong>${brief.overdueSlaCount}</strong></div>
        <div><span>Handoffs</span><strong>${brief.actionHandoffCount}</strong></div>
        <div><span>Generated By</span><strong>${escapeHtml(session.name)} / ${escapeHtml(session.email)}</strong></div>
      </section>
      <section>
        <h2>Brief Sections</h2>
        <table><thead><tr><th>Section</th><th>Status</th><th>Count</th><th>Headline</th><th>Next Step</th></tr></thead><tbody>${sectionRows}</tbody></table>
      </section>
      <section>
        <h2>Owner Decisions</h2>
        <table><thead><tr><th>Due</th><th>Status</th><th>Decision</th><th>Owner</th><th>Source</th><th>Ask</th></tr></thead><tbody>${decisionRows}</tbody></table>
      </section>
    </main>
  </body>
</html>`
}

function decisionFromSlaItem(item: LaunchExceptionSlaItem): LaunchOwnerDailyBriefDecision {
  return {
    id: `sla-${item.id}`,
    status: item.status === 'Overdue' ? 'Critical' : item.status === 'Due Soon' ? 'Action Needed' : 'Review',
    title: item.title,
    owner: item.owner,
    source: `Exception SLA / ${item.source}`,
    reference: item.reference,
    ask: item.nextStep,
    evidence: item.description,
    dueAt: item.dueAt,
    surface: item.defaultSurface,
    auditBacked: item.auditBacked,
    localOnly: item.localOnly,
  }
}

function decisionFromCommandItem(item: LaunchCommandItem): LaunchOwnerDailyBriefDecision {
  return {
    id: `command-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Watch' ? 'Action Needed' : 'Review',
    title: item.title,
    owner: item.owner,
    source: `Command Mode / ${item.type}`,
    reference: item.reference,
    ask: item.nextDecision,
    evidence: item.whyItMatters,
    dueAt: item.createdAt,
    surface: 'command',
    auditBacked: false,
    localOnly: true,
  }
}

function decisionFromGoNoGoItem(item: ExecutiveGoNoGoEvidenceItem): LaunchOwnerDailyBriefDecision {
  return {
    id: `go-no-go-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'Condition' ? 'Action Needed' : 'Review',
    title: item.title,
    owner: item.owner,
    source: `Go / No-Go / ${item.category}`,
    reference: item.reference,
    ask: item.nextStep,
    evidence: item.evidence,
    dueAt: item.updatedAt,
    surface: 'goNoGo',
    auditBacked: item.auditBacked,
    localOnly: true,
  }
}

function decisionFromWarRoomEvent(event: LaunchWarRoomTimelineEvent): LaunchOwnerDailyBriefDecision {
  return {
    id: `war-room-${event.id}`,
    status: event.status === 'Critical' ? 'Critical' : 'Action Needed',
    title: event.title,
    owner: event.owner,
    source: `War Room / ${event.lane}`,
    reference: event.reference,
    ask: event.nextStep,
    evidence: event.evidence,
    dueAt: event.occurredAt,
    surface: event.lane === 'Follow-Up'
      ? 'followup'
      : event.lane === 'Backend' || event.lane === 'Closure'
        ? 'backendClosure'
        : event.lane === 'Guardrail'
          ? 'productionGuardrails'
          : event.lane === 'Executive Decision'
            ? 'goNoGo'
            : 'warRoom',
    auditBacked: Boolean(event.auditEventId),
    localOnly: event.localOnly,
  }
}

function decisionFromFollowUpItem(item: LaunchFollowUpItem): LaunchOwnerDailyBriefDecision {
  return {
    id: `follow-up-${item.id}`,
    status: item.status === 'Blocked' ? 'Critical' : item.status === 'In Progress' ? 'Review' : 'Action Needed',
    title: item.title,
    owner: item.owner,
    source: `Follow-Up / ${item.source}`,
    reference: item.reference,
    ask: item.nextStep,
    evidence: item.evidence,
    dueAt: item.updatedAt ?? item.createdAt,
    surface: 'followup',
    auditBacked: item.auditBacked || Boolean(item.auditEventId),
    localOnly: true,
  }
}

function buildSections(input: BuildLaunchOwnerDailyBriefInput, status: LaunchOwnerDailyBriefStatus, decisions: LaunchOwnerDailyBriefDecision[]): LaunchOwnerDailyBriefSection[] {
  const topDecision = decisions.find(decision => decision.status === 'Critical' || decision.status === 'Action Needed') ?? decisions[0]
  return [
    {
      id: 'posture',
      label: 'Go / No-Go Posture',
      status: input.executiveGoNoGoRoom.decision === 'No Go' ? 'Critical' : input.executiveGoNoGoRoom.decision === 'Conditional Go' ? 'Action Needed' : 'Ready',
      headline: `${input.executiveGoNoGoRoom.decision}: ${input.executiveGoNoGoRoom.headline}`,
      body: input.executiveGoNoGoRoom.summary,
      count: input.executiveGoNoGoRoom.blockedCount + input.executiveGoNoGoRoom.conditionCount,
      nextStep: input.executiveGoNoGoRoom.nextItem?.nextStep ?? 'Keep the Go / No-Go evidence room attached to owner review.',
    },
    {
      id: 'owner-decisions',
      label: 'Owner Decisions',
      status: decisions.some(decision => decision.status === 'Critical') ? 'Critical' : decisions.length ? 'Action Needed' : 'Ready',
      headline: `${decisions.length} owner decisions are in today’s brief.`,
      body: topDecision?.evidence ?? 'No owner decisions are open.',
      count: decisions.length,
      nextStep: topDecision?.ask ?? 'No owner action is required from the current launch model.',
    },
    {
      id: 'sla-pressure',
      label: 'SLA Pressure',
      status: input.launchExceptionSlaBoard.overdueCount ? 'Critical' : input.launchExceptionSlaBoard.dueSoonCount ? 'Action Needed' : 'Ready',
      headline: `${input.launchExceptionSlaBoard.overdueCount} overdue / ${input.launchExceptionSlaBoard.dueSoonCount} due soon.`,
      body: input.launchExceptionSlaBoard.summary,
      count: input.launchExceptionSlaBoard.totalCount,
      nextStep: input.launchExceptionSlaBoard.nextItem?.nextStep ?? 'Keep monitoring launch exceptions through the SLA Board.',
    },
    {
      id: 'handoffs',
      label: 'Action Handoffs',
      status: input.launchExceptionSlaBoard.actionHandoffCount ? 'Action Needed' : 'Ready',
      headline: `${input.launchExceptionSlaBoard.actionHandoffCount} governed handoffs are available.`,
      body: 'Queue only reviewed handoffs into Admin Action Requests; production changes still need trusted handlers.',
      count: input.launchExceptionSlaBoard.actionHandoffCount,
      nextStep: input.launchExceptionSlaBoard.nextItem?.actionHandoffRequired ? input.launchExceptionSlaBoard.nextItem.nextStep : 'No immediate handoff is required.',
    },
    {
      id: 'audit',
      label: 'Audit Readiness',
      status: input.evidenceLedger.auditEventCount || input.launchCommandSavedViews.auditBackedResultCount ? 'Ready' : 'Review',
      headline: `${input.launchCommandSavedViews.auditBackedResultCount} saved-view results and ${input.evidenceLedger.auditEventCount} launch audit events are audit-backed.`,
      body: 'Owner brief actions are local records and exports; the audit ledger remains the source for traceability.',
      count: input.evidenceLedger.auditEventCount + input.launchCommandSavedViews.auditBackedResultCount,
      nextStep: input.launchCommandSavedViews.auditBackedResultCount ? 'Attach audit-backed results to today’s owner review.' : 'Record or export evidence before final owner handoff.',
    },
    {
      id: 'safe-move',
      label: 'Safest Next Move',
      status: status === 'Blocked' ? 'Critical' : status === 'Attention' ? 'Action Needed' : 'Ready',
      headline: topDecision?.title ?? 'No launch owner decision is waiting.',
      body: topDecision?.evidence ?? 'The current launch model has no critical owner blockers.',
      count: topDecision ? 1 : 0,
      nextStep: topDecision?.ask ?? 'Keep the current launch evidence available.',
    },
  ]
}

function buildOwnerLoads(decisions: LaunchOwnerDailyBriefDecision[]): LaunchOwnerDailyBriefOwnerLoad[] {
  const groups = new Map<string, LaunchOwnerDailyBriefDecision[]>()
  decisions.forEach(decision => groups.set(decision.owner, [...(groups.get(decision.owner) ?? []), decision]))

  return Array.from(groups.entries()).map(([owner, ownerDecisions]) => {
    const open = ownerDecisions.filter(decision => decision.status !== 'Ready')
    return {
      owner,
      total: ownerDecisions.length,
      critical: ownerDecisions.filter(decision => decision.status === 'Critical').length,
      actionNeeded: ownerDecisions.filter(decision => decision.status === 'Action Needed').length,
      review: ownerDecisions.filter(decision => decision.status === 'Review').length,
      nextStep: open[0]?.ask ?? 'No owner decision is currently open.',
    }
  }).sort((a, b) => b.critical - a.critical || b.actionNeeded - a.actionNeeded || b.total - a.total || a.owner.localeCompare(b.owner))
}

function dedupeDecisions(decisions: LaunchOwnerDailyBriefDecision[]) {
  const byKey = new Map<string, LaunchOwnerDailyBriefDecision>()
  decisions.forEach(decision => {
    const key = `${decision.title.toLowerCase()}|${decision.owner.toLowerCase()}|${decision.reference.toLowerCase()}`
    const current = byKey.get(key)
    if (!current || decisionRank(decision.status) > decisionRank(current.status) || decision.auditBacked && !current.auditBacked) {
      byKey.set(key, decision)
    }
  })
  return Array.from(byKey.values()).sort((a, b) => decisionRank(b.status) - decisionRank(a.status) || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() || a.title.localeCompare(b.title))
}

function decisionRank(status: LaunchOwnerDailyBriefDecisionStatus) {
  if (status === 'Critical') return 4
  if (status === 'Action Needed') return 3
  if (status === 'Review') return 2
  return 1
}

function getBriefHeadline(status: LaunchOwnerDailyBriefStatus, input: BuildLaunchOwnerDailyBriefInput, criticalCount: number, actionNeededCount: number) {
  if (status === 'Blocked') return `${criticalCount} launch owner decisions are blocking today’s path.`
  if (status === 'Attention') return `${actionNeededCount} launch decisions need owner attention today.`
  return `${input.readinessModel.score}% readiness with no critical owner blocker in today’s brief.`
}

function getBriefSummary(status: LaunchOwnerDailyBriefStatus, input: BuildLaunchOwnerDailyBriefInput, decisionCount: number) {
  if (status === 'Blocked') return `${input.executiveGoNoGoRoom.decision} posture with ${input.launchExceptionSlaBoard.overdueCount} overdue SLA exceptions and ${decisionCount} owner decisions.`
  if (status === 'Attention') return `${input.executiveGoNoGoRoom.decision} posture with ${input.launchExceptionSlaBoard.dueSoonCount} due-soon SLA exceptions and ${decisionCount} owner decisions.`
  return `${input.executiveGoNoGoRoom.decision} posture with ${decisionCount} tracked owner decisions and current audit evidence.`
}

function emitLaunchOwnerDailyBriefRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | boolean | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
