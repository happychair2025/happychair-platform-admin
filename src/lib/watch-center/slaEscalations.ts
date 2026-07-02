import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type {
  WatchSignal,
  WatchSignalOwner,
  WatchSignalPriority,
  WatchSignalSensitivity,
  WatchTargetPage,
} from './watchCenter'
import type { ResponsePlaybookDefinition } from './responsePlaybooks'
import type { WatchRuleDefinition } from './watchRules'

export type SlaEscalationItemType = 'Watch Signal' | 'Watch Rule' | 'Response Playbook'
export type SlaEscalationStatus = 'On Track' | 'Due Soon' | 'Overdue' | 'Paused' | 'Needs Review' | 'Acknowledged'
export type SlaEscalationLevel = 'Monitor' | 'Owner Review' | 'Action Handoff' | 'Executive Review'
export type SlaEscalationReviewStatus = 'Open' | 'Reviewed' | 'Escalated'

export interface SlaEscalationStep {
  label: string
  owner: WatchSignalOwner
  dueAt: string
  action: string
  level: SlaEscalationLevel
}

export interface SlaEscalationItem {
  id: string
  title: string
  description: string
  itemType: SlaEscalationItemType
  owner: WatchSignalOwner
  priority: WatchSignalPriority
  status: SlaEscalationStatus
  reviewStatus: SlaEscalationReviewStatus
  level: SlaEscalationLevel
  sensitivity: WatchSignalSensitivity
  targetPage: WatchTargetPage
  targetLabel: string
  permission: PermissionKey
  scope: string
  createdAt: string
  dueAt: string
  slaMinutes: number
  elapsedMinutes: number
  minutesRemaining: number
  progress: number
  escalationSteps: SlaEscalationStep[]
  evidence: string[]
  sourceId: string
  actionHandoffRequired: boolean
  handoffActionType?: AdminActionRequestType
  handoffPermission?: PermissionKey
  handoffHandlerKey?: string
  rollbackNotes?: string
  localNote?: string
}

export interface SlaEscalationLocalState {
  itemId: string
  reviewStatus: SlaEscalationReviewStatus
  note?: string
  updatedAt: string
}

export interface SlaEscalationBoardSummary {
  total: number
  overdue: number
  dueSoon: number
  paused: number
  needsReview: number
  actionHandoffs: number
  executiveReview: number
  reviewed: number
}

export interface BuildSlaEscalationBoardInput {
  signals: WatchSignal[]
  rules: WatchRuleDefinition[]
  playbooks: ResponsePlaybookDefinition[]
  localStates?: SlaEscalationLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_sla_escalation_state_v1'

export const slaEscalationBoundaryRule =
  'SLA Board state is a local operating rollup over watch signals, watch rules, and response playbooks. It records reviews and handoffs but does not change production alert delivery, customer data, support records, billing, modules, or permissions.'

export function buildSlaEscalationBoard(input: BuildSlaEscalationBoardInput): SlaEscalationItem[] {
  const now = input.now ?? new Date()
  const localStateByItemId = new Map((input.localStates ?? []).map(state => [state.itemId, state]))
  const items = [
    ...input.signals.map(signal => buildSignalItem(signal, now)),
    ...input.rules.map(rule => buildRuleItem(rule, now)),
    ...input.playbooks.map(playbook => buildPlaybookItem(playbook, now)),
  ]

  return items
    .map(item => applyLocalState(item, localStateByItemId.get(item.id)))
    .sort(sortSlaItems)
}

export function summarizeSlaEscalationBoard(items: SlaEscalationItem[]): SlaEscalationBoardSummary {
  return {
    total: items.length,
    overdue: items.filter(item => item.status === 'Overdue').length,
    dueSoon: items.filter(item => item.status === 'Due Soon').length,
    paused: items.filter(item => item.status === 'Paused').length,
    needsReview: items.filter(item => item.status === 'Needs Review').length,
    actionHandoffs: items.filter(item => item.actionHandoffRequired || item.level === 'Action Handoff').length,
    executiveReview: items.filter(item => item.level === 'Executive Review').length,
    reviewed: items.filter(item => item.reviewStatus === 'Reviewed').length,
  }
}

export function getSlaStatusTone(status: SlaEscalationStatus) {
  if (status === 'Overdue') return 'danger' as const
  if (status === 'Due Soon' || status === 'Needs Review') return 'warn' as const
  if (status === 'Paused') return 'info' as const
  if (status === 'Acknowledged') return 'ok' as const
  return 'neutral' as const
}

export function getSlaLevelTone(level: SlaEscalationLevel) {
  if (level === 'Executive Review') return 'danger' as const
  if (level === 'Action Handoff') return 'warn' as const
  if (level === 'Owner Review') return 'info' as const
  return 'neutral' as const
}

export function getSlaReviewTone(status: SlaEscalationReviewStatus) {
  if (status === 'Escalated') return 'warn' as const
  if (status === 'Reviewed') return 'ok' as const
  return 'neutral' as const
}

export function formatSlaDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.round(minutes / 60)}h`
}

export function loadLocalSlaEscalationStates(): SlaEscalationLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSlaEscalationLocalState)
  } catch {
    return []
  }
}

export function saveLocalSlaEscalationStates(states: SlaEscalationLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 160)))
}

export function useLocalSlaEscalationStates() {
  const [states, setStates] = useState<SlaEscalationLocalState[]>(() => loadLocalSlaEscalationStates())

  useEffect(() => {
    saveLocalSlaEscalationStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildSignalItem(signal: WatchSignal, now: Date): SlaEscalationItem {
  const createdAt = parseDate(signal.detectedAt)
  const dueAt = parseDate(signal.dueAt)
  const slaMinutes = Math.max(1, Math.round((dueAt.getTime() - createdAt.getTime()) / 60000))
  const timing = calculateTiming(createdAt, dueAt, slaMinutes, now)
  const status = signal.status === 'Snoozed'
    ? 'Paused'
    : signal.status === 'Acknowledged'
      ? 'Acknowledged'
      : timing.status
  const level = status === 'Overdue' && signal.priority === 'Critical'
    ? 'Executive Review'
    : status === 'Overdue'
      ? 'Action Handoff'
      : status === 'Due Soon'
        ? 'Owner Review'
        : 'Monitor'

  return {
    id: `sla:${signal.id}`,
    title: signal.title,
    description: signal.description,
    itemType: 'Watch Signal',
    owner: signal.owner,
    priority: signal.priority,
    ...timing,
    status,
    reviewStatus: 'Open',
    level,
    sensitivity: signal.sensitivity,
    targetPage: signal.targetPage,
    targetLabel: targetPageLabels[signal.targetPage],
    permission: signal.permission,
    scope: signal.scope,
    createdAt: createdAt.toISOString(),
    dueAt: dueAt.toISOString(),
    slaMinutes,
    escalationSteps: [
      {
        label: 'Owner review',
        owner: signal.owner,
        dueAt: dueAt.toISOString(),
        action: signal.recommendedAction,
        level: 'Owner Review',
      },
      {
        label: 'Executive review',
        owner: 'Owner',
        dueAt: addMinutes(dueAt, Math.max(60, Math.round(slaMinutes / 2))).toISOString(),
        action: 'Review unresolved high-priority watch item and decide escalation path.',
        level: 'Executive Review',
      },
    ],
    evidence: signal.evidence,
    sourceId: signal.id,
    actionHandoffRequired: signal.priority === 'Critical' || signal.source === 'Action Requests',
    localNote: signal.localNote,
  }
}

function buildRuleItem(rule: WatchRuleDefinition, now: Date): SlaEscalationItem {
  const createdAt = parseDate(rule.updatedAt)
  const dueAt = addMinutes(createdAt, rule.slaMinutes)
  const timing = calculateTiming(createdAt, dueAt, rule.slaMinutes, now)
  const status = rule.status === 'Paused'
    ? 'Paused'
    : rule.status === 'Needs Review' || rule.status === 'Draft'
      ? 'Needs Review'
      : timing.status
  const level = rule.escalationSteps.some(step => step.channel === 'Action Request')
    ? 'Action Handoff'
    : rule.escalationSteps.some(step => step.channel === 'Executive Review')
      ? 'Executive Review'
      : status === 'Due Soon'
        ? 'Owner Review'
        : 'Monitor'

  return {
    id: `sla-rule:${rule.id}`,
    title: rule.name,
    description: rule.description,
    itemType: 'Watch Rule',
    owner: rule.owner,
    priority: rule.priority,
    ...timing,
    status,
    reviewStatus: 'Open',
    level,
    sensitivity: rule.sensitivity,
    targetPage: rule.targetPage,
    targetLabel: targetPageLabels[rule.targetPage],
    permission: rule.permission,
    scope: rule.signalSource,
    createdAt: createdAt.toISOString(),
    dueAt: dueAt.toISOString(),
    slaMinutes: rule.slaMinutes,
    escalationSteps: rule.escalationSteps.map(step => ({
      label: step.channel,
      owner: step.owner,
      dueAt: addMinutes(createdAt, step.afterMinutes).toISOString(),
      action: step.action,
      level: step.channel === 'Executive Review'
        ? 'Executive Review'
        : step.channel === 'Action Request'
          ? 'Action Handoff'
          : step.channel === 'Command Review'
            ? 'Owner Review'
            : 'Monitor',
    })),
    evidence: [
      `Trigger: ${rule.trigger.metric} ${rule.trigger.operator} ${rule.trigger.value}`,
      `Window: ${rule.trigger.window}`,
      `False positive risk: ${rule.falsePositiveRisk}`,
      `Handler: ${rule.serverHandler}`,
    ],
    sourceId: rule.id,
    actionHandoffRequired: rule.escalationSteps.some(step => step.channel === 'Action Request'),
    handoffHandlerKey: rule.serverHandler,
    rollbackNotes: 'Server-side policy changes must preserve the existing rule until validation and audit recording succeed.',
  }
}

function buildPlaybookItem(playbook: ResponsePlaybookDefinition, now: Date): SlaEscalationItem {
  const createdAt = parseDate(playbook.updatedAt)
  const reviewMinutes = playbook.status === 'Needs Review' ? 72 * 60 : playbook.status === 'Draft' ? 7 * 1440 : 30 * 1440
  const dueAt = addMinutes(createdAt, reviewMinutes)
  const timing = calculateTiming(createdAt, dueAt, reviewMinutes, now)
  const status = playbook.status === 'Paused'
    ? 'Paused'
    : playbook.status === 'Needs Review' || playbook.status === 'Draft'
      ? 'Needs Review'
      : timing.status
  const level = playbook.handoff.required
    ? 'Action Handoff'
    : playbook.steps.some(step => step.stage === 'Executive Review')
      ? 'Executive Review'
      : 'Owner Review'

  return {
    id: `sla-playbook:${playbook.id}`,
    title: playbook.title,
    description: playbook.description,
    itemType: 'Response Playbook',
    owner: playbook.owner,
    priority: playbook.sensitivity === 'Restricted' ? 'High' : 'Medium',
    ...timing,
    status,
    reviewStatus: 'Open',
    level,
    sensitivity: playbook.sensitivity,
    targetPage: playbook.targetPage,
    targetLabel: targetPageLabels[playbook.targetPage],
    permission: playbook.permission,
    scope: playbook.category,
    createdAt: createdAt.toISOString(),
    dueAt: dueAt.toISOString(),
    slaMinutes: reviewMinutes,
    escalationSteps: playbook.steps.map(step => ({
      label: step.stage,
      owner: step.owner,
      dueAt: addMinutes(createdAt, Math.round((playbook.steps.indexOf(step) + 1) * reviewMinutes / playbook.steps.length)).toISOString(),
      action: step.action,
      level: step.stage === 'Executive Review'
        ? 'Executive Review'
        : step.stage === 'Server Handoff'
          ? 'Action Handoff'
          : step.stage === 'Triage'
            ? 'Owner Review'
            : 'Monitor',
    })),
    evidence: [
      `Goal: ${playbook.responseGoal}`,
      `Trigger: ${playbook.triggerSummary}`,
      `Blocked actions: ${playbook.blockedActions.length}`,
      `Success criteria: ${playbook.successCriteria.length}`,
    ],
    sourceId: playbook.id,
    actionHandoffRequired: playbook.handoff.required,
    handoffActionType: playbook.handoff.actionType,
    handoffPermission: playbook.handoff.permission,
    handoffHandlerKey: playbook.handoff.handlerKey,
    rollbackNotes: playbook.handoff.rollbackNotes,
  }
}

function calculateTiming(createdAt: Date, dueAt: Date, slaMinutes: number, now: Date) {
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60000))
  const minutesRemaining = Math.round((dueAt.getTime() - now.getTime()) / 60000)
  const progress = Math.min(100, Math.max(0, Math.round(elapsedMinutes / slaMinutes * 100)))
  const status: SlaEscalationStatus = minutesRemaining < 0
    ? 'Overdue'
    : minutesRemaining <= Math.max(60, Math.round(slaMinutes * 0.2))
      ? 'Due Soon'
      : 'On Track'

  return { elapsedMinutes, minutesRemaining, progress, status }
}

function applyLocalState(item: SlaEscalationItem, state: SlaEscalationLocalState | undefined): SlaEscalationItem {
  if (!state) return item
  return {
    ...item,
    reviewStatus: state.reviewStatus,
    level: state.reviewStatus === 'Escalated' ? 'Owner Review' : item.level,
    localNote: state.note ?? item.localNote,
  }
}

function sortSlaItems(a: SlaEscalationItem, b: SlaEscalationItem) {
  return statusWeight(a.status) - statusWeight(b.status)
    || levelWeight(a.level) - levelWeight(b.level)
    || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

function statusWeight(status: SlaEscalationStatus) {
  if (status === 'Overdue') return 0
  if (status === 'Due Soon') return 1
  if (status === 'Needs Review') return 2
  if (status === 'On Track') return 3
  if (status === 'Acknowledged') return 4
  return 5
}

function levelWeight(level: SlaEscalationLevel) {
  if (level === 'Executive Review') return 0
  if (level === 'Action Handoff') return 1
  if (level === 'Owner Review') return 2
  return 3
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000)
}

function parseDate(value: string) {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) return date
  return new Date()
}

function isSlaEscalationLocalState(value: unknown): value is SlaEscalationLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.itemId === 'string'
    && typeof record.reviewStatus === 'string'
    && typeof record.updatedAt === 'string'
}

const targetPageLabels: Record<WatchTargetPage, string> = {
  attention: 'Attention Queue',
  support: 'Support Center',
  revenue: 'Revenue',
  health: 'Client Health',
  'action-requests': 'Action Requests',
  audit: 'Audit Logs',
  'saved-views': 'Saved Views',
  'data-quality': 'Data Quality',
  usage: 'Usage Analytics',
}
