import { useEffect, useState } from 'react'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandHandoffTimelineItem } from './commandHandoffTimeline'
import type { CommandWorkItem, CommandWorkPriority } from './commandWorkQueue'
import type { DecisionBriefRecord } from './decisionBriefs'
import type { ExceptionSlaPolicyItem } from './exceptionSlaPolicies'
import type { OperatingExceptionItem } from './operatingExceptionsInbox'
import type { OperatorDailyBriefFocusItem, OperatorDailyBriefRecord } from './operatorDailyBrief'

export type ExecutiveMorningReviewStatus = 'Draft' | 'Reviewed' | 'Shared' | 'Archived'
export type ExecutiveMorningReviewPosture = 'Clear' | 'Watch' | 'At Risk' | 'Critical'
export type ExecutiveMorningReviewLane =
  | 'Decisions'
  | 'Exceptions'
  | 'SLA'
  | 'Handoffs'
  | 'Revenue'
  | 'Support'
  | 'Growth'
export type ExecutiveMorningReviewTargetPage =
  | 'executive-morning-review'
  | 'owner-decision-room'
  | 'operator-daily-brief'
  | 'operating-exceptions'
  | 'exception-sla-policies'
  | 'command-handoff-timeline'
  | 'decision-briefs'
  | 'command-work'
  | 'revenue'
  | 'support'
  | 'registrations'
  | 'usage'
  | 'health'
  | 'approval-center'
  | 'action-requests'
  | 'audit'

export interface ExecutiveMorningReviewLocalState {
  reviewId: string
  status: ExecutiveMorningReviewStatus
  note?: string
  reviewedAt?: string
  sharedAt?: string
  updatedAt: string
}

export interface ExecutiveMorningReviewItem {
  id: string
  lane: ExecutiveMorningReviewLane
  title: string
  detail: string
  owner: string
  scope: string
  priority: CommandWorkPriority
  statusLabel: string
  sourceLabel: string
  targetPage: ExecutiveMorningReviewTargetPage
  targetPermission: PermissionKey
  recommendedAction: string
  evidence: string[]
  rollbackNotes: string
  dueAt: string
  relatedRecordId: string
}

export interface ExecutiveMorningReviewMetric {
  label: string
  value: string
  detail: string
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
}

export interface ExecutiveMorningReviewRecord {
  id: string
  businessDate: string
  title: string
  status: ExecutiveMorningReviewStatus
  posture: ExecutiveMorningReviewPosture
  generatedAt: string
  summary: string
  metrics: ExecutiveMorningReviewMetric[]
  topDecisions: ExecutiveMorningReviewItem[]
  exceptionWatch: ExecutiveMorningReviewItem[]
  slaWatch: ExecutiveMorningReviewItem[]
  handoffWatch: ExecutiveMorningReviewItem[]
  marketWatch: ExecutiveMorningReviewItem[]
  reviewItems: ExecutiveMorningReviewItem[]
  localState?: ExecutiveMorningReviewLocalState
}

export interface BuildExecutiveMorningReviewInput {
  dailyBrief: OperatorDailyBriefRecord
  commandWorkItems: CommandWorkItem[]
  decisionBriefs: DecisionBriefRecord[]
  exceptions: OperatingExceptionItem[]
  slaPolicies: ExceptionSlaPolicyItem[]
  handoffItems: CommandHandoffTimelineItem[]
  localStates?: ExecutiveMorningReviewLocalState[]
  now?: Date
}

export interface ExecutiveMorningReviewSummary {
  posture: ExecutiveMorningReviewPosture
  status: ExecutiveMorningReviewStatus
  totalItems: number
  critical: number
  decisions: number
  exceptions: number
  slaBreaches: number
  handoffBlockers: number
  revenueSignals: number
  supportSignals: number
  growthSignals: number
}

const localStorageKey = 'hc_platform_executive_morning_review_state_v1'

export const executiveMorningReviewBoundaryRule =
  'Executive Morning Review is an internal owner command surface. It can record local review and share state, but it cannot approve, execute, mutate, message customers, change billing, alter modules, change permissions, or resolve support records directly from the browser.'

export function buildExecutiveMorningReview(input: BuildExecutiveMorningReviewInput): ExecutiveMorningReviewRecord {
  const now = input.now ?? new Date()
  const businessDate = formatBusinessDate(now)
  const id = `executive-morning-review-${businessDate}`
  const localState = (input.localStates ?? []).find(state => state.reviewId === id)
  const topDecisions = input.decisionBriefs
    .filter(brief => brief.status !== 'Archived' && (brief.readiness !== 'Ready' || brief.priority === 'Critical' || brief.priority === 'High'))
    .slice(0, 6)
    .map(fromDecisionBrief)
  const commandDecisions = input.commandWorkItems
    .filter(item => item.status !== 'Dismissed' && item.status !== 'Done' && (item.priority === 'Critical' || item.decision === 'Approve' || item.decision === 'Escalate'))
    .slice(0, 6)
    .map(fromCommandWork)
  const exceptionWatch = input.exceptions
    .filter(exception => exception.status !== 'Resolved' && exception.status !== 'Dismissed')
    .filter(exception => exception.severity === 'Critical' || exception.severity === 'High' || exception.status === 'Escalated')
    .slice(0, 8)
    .map(fromException)
  const slaWatch = input.slaPolicies
    .filter(policy => policy.health === 'Breached' || policy.health === 'At Risk')
    .slice(0, 6)
    .map(fromSlaPolicy)
  const handoffWatch = input.handoffItems
    .filter(item => item.status === 'Blocked' || item.status === 'Needs Owner' || item.status === 'Approval Pending' || item.status === 'Ready For Handoff')
    .slice(0, 6)
    .map(fromHandoff)
  const marketWatch = [
    ...input.dailyBrief.revenueRisks.map(item => fromDailyFocusItem(item, 'Revenue')),
    ...input.dailyBrief.supportRisks.map(item => fromDailyFocusItem(item, 'Support')),
    ...input.dailyBrief.growthSignals.map(item => fromDailyFocusItem(item, 'Growth')),
  ].slice(0, 10)
  const reviewItems = dedupeReviewItems([
    ...topDecisions,
    ...commandDecisions,
    ...exceptionWatch,
    ...slaWatch,
    ...handoffWatch,
    ...marketWatch,
  ]).sort(sortReviewItems).slice(0, 24)
  const critical = reviewItems.filter(item => item.priority === 'Critical').length
  const posture = getMorningPosture({
    critical,
    exceptionPressure: exceptionWatch.length,
    slaBreaches: input.slaPolicies.filter(policy => policy.health === 'Breached').length,
    handoffBlockers: input.handoffItems.filter(item => item.status === 'Blocked').length,
    decisionPressure: topDecisions.length + commandDecisions.length,
  })
  const metrics: ExecutiveMorningReviewMetric[] = [
    {
      label: 'Decision Stack',
      value: String(topDecisions.length + commandDecisions.length),
      detail: `${critical} critical items across the morning review`,
      tone: critical ? 'danger' : topDecisions.length || commandDecisions.length ? 'warn' : 'ok',
    },
    {
      label: 'Exceptions',
      value: String(exceptionWatch.length),
      detail: `${input.exceptions.filter(exception => exception.status === 'Escalated').length} escalated locally`,
      tone: exceptionWatch.some(item => item.priority === 'Critical') ? 'danger' : exceptionWatch.length ? 'warn' : 'ok',
    },
    {
      label: 'SLA Breaches',
      value: String(input.slaPolicies.filter(policy => policy.health === 'Breached').length),
      detail: `${input.slaPolicies.filter(policy => policy.health === 'At Risk').length} policies at risk`,
      tone: input.slaPolicies.some(policy => policy.health === 'Breached') ? 'danger' : input.slaPolicies.some(policy => policy.health === 'At Risk') ? 'warn' : 'ok',
    },
    {
      label: 'Market Signals',
      value: String(marketWatch.length),
      detail: `${input.dailyBrief.revenueRisks.length} revenue / ${input.dailyBrief.supportRisks.length} support / ${input.dailyBrief.growthSignals.length} growth`,
      tone: input.dailyBrief.revenueRisks.length || input.dailyBrief.supportRisks.length ? 'warn' : 'neutral',
    },
  ]

  return {
    id,
    businessDate,
    title: `Executive Morning Review / ${formatReadableDate(now)}`,
    status: localState?.status ?? 'Draft',
    posture,
    generatedAt: now.toISOString(),
    summary: buildSummary(posture, reviewItems, exceptionWatch.length, slaWatch.length, handoffWatch.length),
    metrics,
    topDecisions: dedupeReviewItems([...topDecisions, ...commandDecisions]).sort(sortReviewItems).slice(0, 8),
    exceptionWatch,
    slaWatch,
    handoffWatch,
    marketWatch,
    reviewItems,
    localState,
  }
}

export function summarizeExecutiveMorningReview(review: ExecutiveMorningReviewRecord): ExecutiveMorningReviewSummary {
  return {
    posture: review.posture,
    status: review.status,
    totalItems: review.reviewItems.length,
    critical: review.reviewItems.filter(item => item.priority === 'Critical').length,
    decisions: review.reviewItems.filter(item => item.lane === 'Decisions').length,
    exceptions: review.reviewItems.filter(item => item.lane === 'Exceptions').length,
    slaBreaches: review.slaWatch.filter(item => item.statusLabel === 'Breached').length,
    handoffBlockers: review.handoffWatch.filter(item => item.statusLabel === 'Blocked').length,
    revenueSignals: review.marketWatch.filter(item => item.lane === 'Revenue').length,
    supportSignals: review.marketWatch.filter(item => item.lane === 'Support').length,
    growthSignals: review.marketWatch.filter(item => item.lane === 'Growth').length,
  }
}

export function getExecutiveMorningReviewPostureTone(posture: ExecutiveMorningReviewPosture) {
  if (posture === 'Critical') return 'danger' as const
  if (posture === 'At Risk') return 'warn' as const
  if (posture === 'Watch') return 'info' as const
  return 'ok' as const
}

export function getExecutiveMorningReviewStatusTone(status: ExecutiveMorningReviewStatus) {
  if (status === 'Draft') return 'warn' as const
  if (status === 'Reviewed' || status === 'Shared') return 'ok' as const
  return 'neutral' as const
}

export function getExecutiveMorningReviewLaneTone(lane: ExecutiveMorningReviewLane) {
  if (lane === 'Decisions' || lane === 'Exceptions' || lane === 'SLA') return 'danger' as const
  if (lane === 'Handoffs' || lane === 'Revenue' || lane === 'Support') return 'warn' as const
  if (lane === 'Growth') return 'info' as const
  return 'neutral' as const
}

export function getExecutiveMorningReviewPriorityTone(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 'danger' as const
  if (priority === 'High') return 'warn' as const
  if (priority === 'Medium') return 'info' as const
  return 'neutral' as const
}

export function loadLocalExecutiveMorningReviewStates(): ExecutiveMorningReviewLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isExecutiveMorningReviewLocalState)
  } catch {
    return []
  }
}

export function saveLocalExecutiveMorningReviewStates(states: ExecutiveMorningReviewLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 90)))
}

export function useLocalExecutiveMorningReviewStates() {
  const [states, setStates] = useState<ExecutiveMorningReviewLocalState[]>(() => loadLocalExecutiveMorningReviewStates())

  useEffect(() => {
    saveLocalExecutiveMorningReviewStates(states)
  }, [states])

  return [states, setStates] as const
}

function fromDecisionBrief(brief: DecisionBriefRecord): ExecutiveMorningReviewItem {
  return {
    id: `morning-decision-${brief.id}`,
    lane: 'Decisions',
    title: brief.title,
    detail: brief.executiveSummary,
    owner: brief.owner,
    scope: brief.scope,
    priority: brief.priority,
    statusLabel: brief.readiness,
    sourceLabel: 'Decision Brief',
    targetPage: 'decision-briefs',
    targetPermission: 'dashboard.view',
    recommendedAction: brief.recommendedAction,
    evidence: brief.evidence.slice(0, 4),
    rollbackNotes: brief.rollbackPlan,
    dueAt: brief.dueAt,
    relatedRecordId: brief.id,
  }
}

function fromCommandWork(item: CommandWorkItem): ExecutiveMorningReviewItem {
  return {
    id: `morning-command-${item.id}`,
    lane: 'Decisions',
    title: item.title,
    detail: item.description,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    statusLabel: item.status,
    sourceLabel: item.source,
    targetPage: 'command-work',
    targetPermission: item.permission,
    recommendedAction: `${item.decision}: ${item.targetLabel}`,
    evidence: item.evidence.slice(0, 4),
    rollbackNotes: item.rollbackNotes,
    dueAt: item.dueAt,
    relatedRecordId: item.relatedRecordId,
  }
}

function fromException(exception: OperatingExceptionItem): ExecutiveMorningReviewItem {
  return {
    id: `morning-exception-${exception.id}`,
    lane: 'Exceptions',
    title: exception.title,
    detail: exception.description,
    owner: exception.owner,
    scope: exception.scope,
    priority: exception.severity === 'Critical' ? 'Critical' : exception.severity === 'High' ? 'High' : exception.severity === 'Medium' ? 'Medium' : 'Low',
    statusLabel: exception.status,
    sourceLabel: exception.sourceLabel,
    targetPage: 'operating-exceptions',
    targetPermission: 'dashboard.view',
    recommendedAction: exception.recommendedAction,
    evidence: exception.evidence.slice(0, 4),
    rollbackNotes: exception.rollbackNotes,
    dueAt: exception.dueAt,
    relatedRecordId: exception.relatedRecordId,
  }
}

function fromSlaPolicy(policy: ExceptionSlaPolicyItem): ExecutiveMorningReviewItem {
  return {
    id: `morning-sla-${policy.id}`,
    lane: 'SLA',
    title: `${policy.name}: ${policy.health}`,
    detail: `${policy.activeExceptions} active exceptions / ${policy.breachedExceptions} breached under ${policy.exceptionType}.`,
    owner: policy.ownerRole,
    scope: `Exception SLA / ${policy.exceptionType}`,
    priority: policy.health === 'Breached' ? 'Critical' : 'High',
    statusLabel: policy.health,
    sourceLabel: 'Exception SLA',
    targetPage: 'exception-sla-policies',
    targetPermission: 'notifications.view',
    recommendedAction: policy.health === 'Breached'
      ? 'Review breached exception policy and assign owner escalation.'
      : 'Review at-risk exception policy before it breaches.',
    evidence: [
      `Response SLA: ${formatMinutes(policy.responseMinutes)}`,
      `Resolution SLA: ${formatMinutes(policy.resolutionMinutes)}`,
      `Mode: ${policy.enforcementMode}`,
      `Human confirmation: ${policy.humanConfirmationRequired ? 'required' : 'not required'}`,
    ],
    rollbackNotes: policy.rollbackNotes,
    dueAt: policy.updatedAt,
    relatedRecordId: policy.id,
  }
}

function fromHandoff(item: CommandHandoffTimelineItem): ExecutiveMorningReviewItem {
  return {
    id: `morning-handoff-${item.id}`,
    lane: 'Handoffs',
    title: item.title,
    detail: item.detail,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    statusLabel: item.status,
    sourceLabel: item.sourceLabel,
    targetPage: 'command-handoff-timeline',
    targetPermission: 'dashboard.view',
    recommendedAction: item.recommendedAction,
    evidence: [
      `Stage: ${item.currentStage}`,
      `Completion: ${item.completion}%`,
      ...item.evidence.slice(0, 2),
    ],
    rollbackNotes: item.rollbackNotes,
    dueAt: item.dueAt,
    relatedRecordId: item.relatedRecordId,
  }
}

function fromDailyFocusItem(
  item: OperatorDailyBriefFocusItem,
  lane: 'Revenue' | 'Support' | 'Growth',
): ExecutiveMorningReviewItem {
  return {
    id: `morning-${lane.toLowerCase()}-${item.id}`,
    lane,
    title: item.title,
    detail: item.detail,
    owner: item.owner,
    scope: item.scope,
    priority: item.priority,
    statusLabel: item.sourceLabel,
    sourceLabel: item.sourceLabel,
    targetPage: targetPageFromDailyItem(item, lane),
    targetPermission: item.followUpPermission,
    recommendedAction: item.recommendedAction,
    evidence: item.evidence.slice(0, 4),
    rollbackNotes: item.rollbackNotes,
    dueAt: item.dueAt,
    relatedRecordId: item.relatedRecordId,
  }
}

function targetPageFromDailyItem(
  item: OperatorDailyBriefFocusItem,
  lane: 'Revenue' | 'Support' | 'Growth',
): ExecutiveMorningReviewTargetPage {
  if (item.targetPage === 'revenue' || item.targetPage === 'support' || item.targetPage === 'registrations' || item.targetPage === 'usage' || item.targetPage === 'health') {
    return item.targetPage
  }
  if (lane === 'Revenue') return 'revenue'
  if (lane === 'Support') return 'support'
  return 'registrations'
}

function dedupeReviewItems(items: ExecutiveMorningReviewItem[]) {
  const byKey = new Map<string, ExecutiveMorningReviewItem>()
  items.forEach(item => {
    const key = `${item.lane}:${item.relatedRecordId}`
    const existing = byKey.get(key)
    if (!existing || sortReviewItems(item, existing) < 0) byKey.set(key, item)
  })
  return [...byKey.values()]
}

function sortReviewItems(a: ExecutiveMorningReviewItem, b: ExecutiveMorningReviewItem) {
  return priorityWeight(a.priority) - priorityWeight(b.priority)
    || laneWeight(a.lane) - laneWeight(b.lane)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function getMorningPosture(input: {
  critical: number
  exceptionPressure: number
  slaBreaches: number
  handoffBlockers: number
  decisionPressure: number
}): ExecutiveMorningReviewPosture {
  if (input.slaBreaches || input.handoffBlockers || input.critical >= 5) return 'Critical'
  if (input.exceptionPressure >= 5 || input.decisionPressure >= 8 || input.critical >= 2) return 'At Risk'
  if (input.exceptionPressure || input.decisionPressure) return 'Watch'
  return 'Clear'
}

function buildSummary(
  posture: ExecutiveMorningReviewPosture,
  items: ExecutiveMorningReviewItem[],
  exceptions: number,
  sla: number,
  handoffs: number,
) {
  if (!items.length) return 'No owner-facing command work is currently waiting in the morning review.'
  const lead = posture === 'Critical'
    ? 'Critical owner attention is needed today.'
    : posture === 'At Risk'
      ? 'The platform has meaningful operating pressure today.'
      : posture === 'Watch'
        ? 'The platform is stable with watch items to clear.'
        : 'The platform is clear.'
  return `${lead} ${items.length} review items are queued, including ${exceptions} exception items, ${sla} SLA policy items, and ${handoffs} handoff items.`
}

function formatBusinessDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatReadableDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours}h`
  return `${Math.round(hours * 10) / 10}h`
}

function priorityWeight(priority: CommandWorkPriority) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Medium') return 2
  return 3
}

function laneWeight(lane: ExecutiveMorningReviewLane) {
  if (lane === 'Decisions') return 0
  if (lane === 'Exceptions') return 1
  if (lane === 'SLA') return 2
  if (lane === 'Handoffs') return 3
  if (lane === 'Revenue') return 4
  if (lane === 'Support') return 5
  return 6
}

function isExecutiveMorningReviewLocalState(value: unknown): value is ExecutiveMorningReviewLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.reviewId === 'string'
    && ['Draft', 'Reviewed', 'Shared', 'Archived'].includes(String(record.status))
    && typeof record.updatedAt === 'string'
}
