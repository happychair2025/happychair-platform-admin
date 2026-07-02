import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { CoverageLedgerEntry } from '../ownership/coverageLedger'
import type { PermissionKey } from '../permissions/permissions'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { CommandWorkItem, CommandWorkPriority, CommandWorkTargetPage } from './commandWorkQueue'
import type { DecisionBriefRecord } from './decisionBriefs'

export type OperatorDailyBriefStatus = 'Draft' | 'Reviewed' | 'Shared' | 'Archived'
export type OperatorDailyPosture = 'Stable' | 'Watch' | 'At Risk' | 'Critical'
export type OperatorDailyFocusLane = 'Do First' | 'Approve' | 'Cover' | 'Support' | 'Revenue' | 'Growth' | 'Watch'
export type OperatorDailyTargetPage = CommandWorkTargetPage
  | 'operator-daily-brief'
  | 'command-work'
  | 'decision-briefs'
  | 'revenue'
  | 'support'
  | 'registrations'
  | 'usage'
  | 'health'

export interface OperatorDailyBriefLocalState {
  briefId: string
  status: OperatorDailyBriefStatus
  note?: string
  reviewedAt?: string
  sharedAt?: string
  followUpRequestId?: string
  updatedAt: string
}

export interface OperatorDailyBriefMetric {
  label: string
  value: string
  detail: string
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
}

export interface OperatorDailyBriefFocusItem {
  id: string
  lane: OperatorDailyFocusLane
  title: string
  detail: string
  owner: string
  scope: string
  priority: CommandWorkPriority
  sourceLabel: string
  dueAt: string
  recommendedAction: string
  evidence: string[]
  targetPage: OperatorDailyTargetPage
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  rollbackNotes: string
  handlerKey?: string
  relatedRecordId: string
}

export interface OperatorDailyBriefRecord {
  id: string
  businessDate: string
  title: string
  status: OperatorDailyBriefStatus
  posture: OperatorDailyPosture
  summary: string
  generatedAt: string
  metrics: OperatorDailyBriefMetric[]
  focusItems: OperatorDailyBriefFocusItem[]
  commandHighlights: OperatorDailyBriefFocusItem[]
  revenueRisks: OperatorDailyBriefFocusItem[]
  supportRisks: OperatorDailyBriefFocusItem[]
  growthSignals: OperatorDailyBriefFocusItem[]
  localState?: OperatorDailyBriefLocalState
}

export interface BuildOperatorDailyBriefInput {
  data: PlatformAdminReadModel
  commandWorkItems: CommandWorkItem[]
  decisionBriefs: DecisionBriefRecord[]
  coverageEntries: CoverageLedgerEntry[]
  localStates?: OperatorDailyBriefLocalState[]
  now?: Date
}

export interface OperatorDailyBriefSummary {
  posture: OperatorDailyPosture
  totalFocus: number
  critical: number
  approvals: number
  coverage: number
  revenueAtRisk: number
  supportRisks: number
  growthSignals: number
  status: OperatorDailyBriefStatus
}

const localStorageKey = 'hc_platform_operator_daily_brief_state_v1'

export const operatorDailyBriefBoundaryRule =
  'Operator Daily Brief is an internal executive operating summary. It can record local review/share state and queue governed follow-ups, but it cannot mutate customer data, billing, modules, permissions, notifications, or support records directly from the browser.'

export function buildOperatorDailyBrief(input: BuildOperatorDailyBriefInput): OperatorDailyBriefRecord {
  const now = input.now ?? new Date()
  const businessDate = formatBusinessDate(now)
  const id = `operator-daily-brief-${businessDate}`
  const localState = (input.localStates ?? []).find(state => state.briefId === id)
  const commandHighlights = input.commandWorkItems
    .filter(item => item.status !== 'Dismissed' && item.status !== 'Done')
    .slice(0, 8)
    .map(fromCommandWorkItem)
  const decisionHighlights = input.decisionBriefs
    .filter(brief => brief.status !== 'Archived' && (brief.readiness === 'Blocked' || brief.readiness === 'Needs Approval' || brief.priority === 'Critical'))
    .slice(0, 6)
    .map(fromDecisionBrief)
  const coverageHighlights = input.coverageEntries
    .filter(entry => entry.status !== 'Dismissed' && (entry.type === 'Coverage Gap' || entry.type === 'Backup Missing' || entry.severity === 'Critical'))
    .slice(0, 5)
    .map(fromCoverageEntry)
  const revenueRisks = input.data.billingRisks
    .slice()
    .sort((a, b) => b.amountAtRisk - a.amountAtRisk)
    .slice(0, 5)
    .map(fromBillingRisk)
  const supportRisks = input.data.supportIssues
    .filter(issue => issue.status !== 'Resolved')
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
    .slice(0, 5)
    .map(fromSupportIssue)
  const healthRisks = input.data.platformHealthSignals
    .filter(signal => signal.status !== 'Passing')
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
    .slice(0, 4)
    .map(fromHealthSignal)
  const growthSignals = [
    ...input.data.registrations
      .filter(registration => registration.status === 'Demo Requested' || registration.status === 'Trial Started' || registration.status === 'Setup Incomplete')
      .sort((a, b) => b.projectedMrr - a.projectedMrr)
      .slice(0, 4)
      .map(fromRegistration),
    ...input.data.moduleUsageGaps
      .filter(gap => gap.usageLast7Days === 0)
      .slice(0, 4)
      .map(fromUsageGap),
  ].slice(0, 6)
  const focusItems = dedupeFocusItems([
    ...commandHighlights,
    ...decisionHighlights,
    ...coverageHighlights,
    ...supportRisks,
    ...revenueRisks,
    ...healthRisks,
    ...growthSignals,
  ]).sort(sortFocusItems).slice(0, 18)
  const revenueAtRisk = input.data.billingRisks.reduce((total, risk) => total + risk.amountAtRisk, 0)
  const critical = focusItems.filter(item => item.priority === 'Critical').length
  const posture = getDailyPosture({
    critical,
    coverageGaps: coverageHighlights.filter(item => item.priority === 'Critical').length,
    blockedBriefs: input.decisionBriefs.filter(brief => brief.readiness === 'Blocked').length,
    supportCritical: supportRisks.filter(item => item.priority === 'Critical').length,
    revenueAtRisk,
  })
  const metrics: OperatorDailyBriefMetric[] = [
    {
      label: 'Focus Items',
      value: String(focusItems.length),
      detail: `${critical} critical / ${input.commandWorkItems.filter(item => item.status === 'Open').length} open command items`,
      tone: critical ? 'danger' : focusItems.length ? 'warn' : 'ok',
    },
    {
      label: 'Approvals',
      value: String(input.commandWorkItems.filter(item => item.lane === 'Approval').length),
      detail: `${input.decisionBriefs.filter(brief => brief.readiness === 'Needs Approval').length} briefs need approval`,
      tone: input.decisionBriefs.some(brief => brief.readiness === 'Blocked') ? 'danger' : 'warn',
    },
    {
      label: 'Coverage',
      value: String(coverageHighlights.length),
      detail: `${coverageHighlights.filter(item => item.priority === 'Critical').length} owner gaps`,
      tone: coverageHighlights.some(item => item.priority === 'Critical') ? 'danger' : coverageHighlights.length ? 'warn' : 'ok',
    },
    {
      label: 'Revenue At Risk',
      value: formatCurrency(revenueAtRisk),
      detail: `${revenueRisks.length} finance signals`,
      tone: revenueAtRisk ? 'warn' : 'ok',
    },
  ]

  return {
    id,
    businessDate,
    title: `Operator Daily Brief / ${formatReadableDate(now)}`,
    status: localState?.status ?? 'Draft',
    posture,
    summary: buildSummary(posture, focusItems, revenueAtRisk, supportRisks.length, growthSignals.length),
    generatedAt: now.toISOString(),
    metrics,
    focusItems,
    commandHighlights,
    revenueRisks,
    supportRisks: [...supportRisks, ...healthRisks].slice(0, 7),
    growthSignals,
    localState,
  }
}

export function summarizeOperatorDailyBrief(brief: OperatorDailyBriefRecord): OperatorDailyBriefSummary {
  return {
    posture: brief.posture,
    totalFocus: brief.focusItems.length,
    critical: brief.focusItems.filter(item => item.priority === 'Critical').length,
    approvals: brief.focusItems.filter(item => item.lane === 'Approve').length,
    coverage: brief.focusItems.filter(item => item.lane === 'Cover').length,
    revenueAtRisk: brief.revenueRisks.reduce((total, item) => total + extractCurrencyValue(item.detail), 0),
    supportRisks: brief.supportRisks.length,
    growthSignals: brief.growthSignals.length,
    status: brief.status,
  }
}

export function getOperatorDailyPostureTone(posture: OperatorDailyPosture) {
  if (posture === 'Critical') return 'danger' as const
  if (posture === 'At Risk') return 'warn' as const
  if (posture === 'Watch') return 'info' as const
  return 'ok' as const
}

export function getOperatorDailyStatusTone(status: OperatorDailyBriefStatus) {
  if (status === 'Draft') return 'warn' as const
  if (status === 'Reviewed' || status === 'Shared') return 'ok' as const
  return 'neutral' as const
}

export function getOperatorDailyLaneTone(lane: OperatorDailyFocusLane) {
  if (lane === 'Do First' || lane === 'Approve') return 'danger' as const
  if (lane === 'Cover' || lane === 'Revenue' || lane === 'Support') return 'warn' as const
  if (lane === 'Growth') return 'info' as const
  return 'neutral' as const
}

export function loadLocalOperatorDailyBriefStates(): OperatorDailyBriefLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOperatorDailyBriefLocalState)
  } catch {
    return []
  }
}

export function saveLocalOperatorDailyBriefStates(states: OperatorDailyBriefLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 120)))
}

export function useLocalOperatorDailyBriefStates() {
  const [states, setStates] = useState<OperatorDailyBriefLocalState[]>(() => loadLocalOperatorDailyBriefStates())

  useEffect(() => {
    saveLocalOperatorDailyBriefStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromCommandWorkItem(item: CommandWorkItem): OperatorDailyBriefFocusItem {
  return {
    id: `daily-command-${item.id}`,
    lane: item.decision === 'Approve' ? 'Approve' : item.lane === 'Coverage' ? 'Cover' : item.priority === 'Critical' ? 'Do First' : 'Watch',
    title: item.title,
    detail: item.description,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    sourceLabel: item.source,
    dueAt: item.dueAt,
    recommendedAction: item.decision === 'Approve' ? 'Review approval path and confirm governed handoff.' : item.description,
    evidence: item.evidence,
    targetPage: item.targetPage,
    followUpPermission: item.followUpPermission,
    followUpActionType: item.followUpActionType,
    rollbackNotes: item.rollbackNotes,
    handlerKey: item.handlerKey,
    relatedRecordId: item.relatedRecordId,
  }
}

function fromDecisionBrief(brief: DecisionBriefRecord): OperatorDailyBriefFocusItem {
  return {
    id: `daily-brief-${brief.id}`,
    lane: brief.readiness === 'Blocked' || brief.decision === 'Escalate' ? 'Do First' : 'Approve',
    title: brief.title,
    detail: brief.executiveSummary,
    owner: brief.owner,
    scope: brief.scope,
    priority: brief.priority,
    sourceLabel: 'Decision Briefs',
    dueAt: brief.dueAt,
    recommendedAction: brief.recommendedAction,
    evidence: brief.evidence,
    targetPage: 'decision-briefs',
    followUpPermission: brief.workItem.followUpPermission,
    followUpActionType: brief.workItem.followUpActionType,
    rollbackNotes: brief.rollbackPlan,
    handlerKey: brief.workItem.handlerKey,
    relatedRecordId: brief.id,
  }
}

function fromCoverageEntry(entry: CoverageLedgerEntry): OperatorDailyBriefFocusItem {
  return {
    id: `daily-coverage-${entry.id}`,
    lane: 'Cover',
    title: entry.title,
    detail: entry.description,
    owner: entry.owner,
    scope: entry.scope,
    priority: entry.severity === 'Critical' ? 'Critical' : entry.severity === 'Warning' ? 'High' : 'Medium',
    sourceLabel: 'Coverage Ledger',
    dueAt: entry.dueAt ?? entry.createdAt,
    recommendedAction: entry.nextAction,
    evidence: entry.evidence,
    targetPage: 'coverage-ledger',
    followUpPermission: entry.followUpPermission,
    followUpActionType: entry.followUpActionType,
    rollbackNotes: 'Coverage corrections must be made through governed server-side handlers.',
    relatedRecordId: entry.id,
  }
}

function fromBillingRisk(risk: PlatformAdminReadModel['billingRisks'][number]): OperatorDailyBriefFocusItem {
  return {
    id: `daily-revenue-${risk.id}`,
    lane: 'Revenue',
    title: `${risk.billingStatus}: ${risk.organizationName}`,
    detail: `${formatCurrency(risk.amountAtRisk)} at risk / ${formatCurrency(risk.mrr)} MRR.`,
    owner: risk.owner,
    scope: risk.organizationName,
    priority: risk.billingStatus === 'Failed Payment' ? 'Critical' : risk.billingStatus === 'Past Due' ? 'High' : 'Medium',
    sourceLabel: 'Billing Risk',
    dueAt: risk.lastPaymentAttempt,
    recommendedAction: risk.nextAction,
    evidence: [
      `${formatCurrency(risk.amountAtRisk)} at risk`,
      `${formatCurrency(risk.mrr)} monthly recurring revenue`,
      `Last payment attempt ${formatShortDate(risk.lastPaymentAttempt)}`,
    ],
    targetPage: 'revenue',
    followUpPermission: 'billing.manage',
    followUpActionType: 'billing_review_action',
    rollbackNotes: 'Billing-affecting action requires finance-owned provider review and rollback notes.',
    handlerKey: `server.billing.daily_brief.${risk.id}`,
    relatedRecordId: risk.id,
  }
}

function fromSupportIssue(issue: PlatformAdminReadModel['supportIssues'][number]): OperatorDailyBriefFocusItem {
  return {
    id: `daily-support-${issue.id}`,
    lane: 'Support',
    title: `${issue.issueType}: ${issue.venueName}`,
    detail: `${issue.status} / ${issue.probableCause}`,
    owner: issue.owner,
    scope: `${issue.organizationName} / ${issue.propertyName} / ${issue.venueName}`,
    priority: issue.severity === 'critical' ? 'Critical' : issue.severity === 'warning' ? 'High' : issue.severity === 'notice' ? 'Medium' : 'Low',
    sourceLabel: 'Support Risk',
    dueAt: issue.detectedAt,
    recommendedAction: issue.recommendedAction,
    evidence: [
      issue.probableCause,
      issue.relatedSignal,
      `${issue.affectedUsers} affected users`,
    ],
    targetPage: 'support',
    followUpPermission: 'support.manage',
    followUpActionType: 'support_troubleshooting_action',
    rollbackNotes: 'Support lifecycle changes require support-governed handlers and visible activity history.',
    handlerKey: `server.support.daily_brief.${issue.id}`,
    relatedRecordId: issue.id,
  }
}

function fromHealthSignal(signal: PlatformAdminReadModel['platformHealthSignals'][number]): OperatorDailyBriefFocusItem {
  return {
    id: `daily-health-${signal.id}`,
    lane: 'Watch',
    title: signal.label,
    detail: signal.message,
    owner: signal.severity === 'critical' || signal.status === 'Failing' ? 'Engineering' : 'Support',
    scope: 'Platform Health',
    priority: signal.severity === 'critical' ? 'Critical' : signal.severity === 'warning' ? 'High' : signal.severity === 'notice' ? 'Medium' : 'Low',
    sourceLabel: 'System Health',
    dueAt: signal.checkedAt,
    recommendedAction: signal.recommendedAction,
    evidence: [
      signal.probableCause,
      `${signal.affectedClients} affected clients`,
      `${signal.affectedVenues} affected venues`,
    ],
    targetPage: 'health',
    followUpPermission: 'troubleshooting.run',
    followUpActionType: 'remediation_server_action',
    rollbackNotes: 'Remediation requires server-side runbook handling, tenant scope, and rollback metadata.',
    handlerKey: `server.health.daily_brief.${signal.id}`,
    relatedRecordId: signal.id,
  }
}

function fromRegistration(registration: PlatformAdminReadModel['registrations'][number]): OperatorDailyBriefFocusItem {
  return {
    id: `daily-registration-${registration.id}`,
    lane: 'Growth',
    title: `${registration.companyName}: ${registration.status}`,
    detail: `${registration.selectedPlan} / ${registration.propertyType} / ${formatCurrency(registration.projectedMrr)} projected MRR.`,
    owner: 'Client Success',
    scope: registration.companyName,
    priority: registration.projectedMrr >= 800 ? 'High' : 'Medium',
    sourceLabel: 'Registration',
    dueAt: registration.createdAt,
    recommendedAction: registration.setupCompletion < 80 ? 'Assign setup follow-up before trial momentum drops.' : 'Prepare owner review for conversion path.',
    evidence: [
      `${registration.setupCompletion}% setup completion`,
      `${formatCurrency(registration.projectedMrr)} projected MRR`,
      `${registration.source} / ${registration.campaign}`,
    ],
    targetPage: 'registrations',
    followUpPermission: 'clients.manage',
    followUpActionType: 'agent_recommended_action',
    rollbackNotes: 'Client lifecycle changes require governed follow-up and visible activity records.',
    handlerKey: `server.registrations.daily_brief.${registration.id}`,
    relatedRecordId: registration.id,
  }
}

function fromUsageGap(gap: PlatformAdminReadModel['moduleUsageGaps'][number]): OperatorDailyBriefFocusItem {
  return {
    id: `daily-usage-gap-${gap.id}`,
    lane: 'Growth',
    title: `${gap.moduleName} adoption gap`,
    detail: `${gap.organizationName} has ${gap.usageLast7Days} uses in the last 7 days.`,
    owner: gap.owner,
    scope: gap.organizationName,
    priority: gap.usageLast7Days === 0 ? 'High' : 'Medium',
    sourceLabel: 'Usage Gap',
    dueAt: gap.enabledAt,
    recommendedAction: gap.recommendedAction,
    evidence: [
      `${gap.moduleName} enabled ${formatShortDate(gap.enabledAt)}`,
      `${gap.usageLast7Days} usage events in 7 days`,
      `${gap.owner} owns follow-up`,
    ],
    targetPage: 'usage',
    followUpPermission: 'clients.manage',
    followUpActionType: 'agent_recommended_action',
    rollbackNotes: 'Client state changes require governed follow-up and audit history.',
    handlerKey: `server.usage.daily_brief.${gap.id}`,
    relatedRecordId: gap.id,
  }
}

function dedupeFocusItems(items: OperatorDailyBriefFocusItem[]) {
  const byKey = new Map<string, OperatorDailyBriefFocusItem>()
  items.forEach(item => {
    const key = `${item.targetPage}:${item.relatedRecordId}`
    const existing = byKey.get(key)
    if (!existing || sortFocusItems(item, existing) < 0) byKey.set(key, item)
  })
  return [...byKey.values()]
}

function sortFocusItems(a: OperatorDailyBriefFocusItem, b: OperatorDailyBriefFocusItem) {
  return priorityWeight(a.priority) - priorityWeight(b.priority)
    || laneWeight(a.lane) - laneWeight(b.lane)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function getDailyPosture(input: {
  critical: number
  coverageGaps: number
  blockedBriefs: number
  supportCritical: number
  revenueAtRisk: number
}): OperatorDailyPosture {
  if (input.critical >= 5 || input.coverageGaps || input.blockedBriefs || input.supportCritical) return 'Critical'
  if (input.critical >= 2 || input.revenueAtRisk >= 5000) return 'At Risk'
  if (input.critical || input.revenueAtRisk > 0) return 'Watch'
  return 'Stable'
}

function buildSummary(
  posture: OperatorDailyPosture,
  focusItems: OperatorDailyBriefFocusItem[],
  revenueAtRisk: number,
  supportRiskCount: number,
  growthSignalCount: number,
) {
  const first = focusItems[0]
  const lead = first ? `Lead with ${first.title}.` : 'No urgent command item is currently open.'
  return `${posture} posture. ${lead} ${formatCurrency(revenueAtRisk)} revenue at risk, ${supportRiskCount} support risks, and ${growthSignalCount} growth signals are visible today.`
}

function severityScore(severity: string) {
  if (severity === 'critical') return 96
  if (severity === 'warning') return 82
  if (severity === 'notice') return 58
  return 34
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function laneWeight(lane: OperatorDailyFocusLane) {
  if (lane === 'Do First') return 0
  if (lane === 'Approve') return 1
  if (lane === 'Cover') return 2
  if (lane === 'Support') return 3
  if (lane === 'Revenue') return 4
  if (lane === 'Growth') return 5
  return 6
}

function formatBusinessDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function formatReadableDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function extractCurrencyValue(value: string) {
  const match = value.match(/\$([\d,]+)/)
  return match ? Number(match[1].replace(/,/g, '')) : 0
}

function isOperatorDailyBriefLocalState(value: unknown): value is OperatorDailyBriefLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.briefId === 'string'
    && ['Draft', 'Reviewed', 'Shared', 'Archived'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
