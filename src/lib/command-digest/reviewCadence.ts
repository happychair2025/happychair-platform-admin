import { useEffect, useState } from 'react'
import type { AdminActionRequestType } from '../admin-actions/actionRequests'
import type { PermissionKey } from '../permissions/permissions'
import type { CommandBriefSnapshot } from './briefArchive'

export type DigestReviewFrequency = 'Daily' | 'Weekdays' | 'Weekly'
export type DigestReviewCadenceStatus = 'Active' | 'Paused' | 'Draft'
export type DigestReviewWindowStatus =
  | 'On Track'
  | 'Due Today'
  | 'Missed'
  | 'Escalation Ready'
  | 'Acknowledged'
  | 'Paused'
  | 'Needs Setup'
export type DigestReviewRequirement = 'Snapshot Created' | 'Reviewed Snapshot' | 'Export Ready Snapshot'

export interface DigestReviewCadenceRule {
  id: string
  name: string
  description: string
  status: DigestReviewCadenceStatus
  frequency: DigestReviewFrequency
  dayOfWeek?: number
  windowStart: string
  windowEnd: string
  timezone: string
  owner: string
  backupOwner: string
  requiredSnapshotStatus: DigestReviewRequirement
  escalationAfterMinutes: number
  permission: PermissionKey
  followUpPermission: PermissionKey
  followUpActionType: AdminActionRequestType
  evidence: string[]
}

export interface DigestReviewCadenceLocalState {
  ruleId: string
  status?: DigestReviewCadenceStatus
  lastAcknowledgedAt?: string
  lastSnapshotId?: string
  note?: string
  updatedAt: string
}

export interface DigestReviewWindow {
  id: string
  rule: DigestReviewCadenceRule
  status: DigestReviewWindowStatus
  windowStartAt: string
  dueAt: string
  nextWindowAt: string
  minutesUntilDue: number
  minutesLate: number
  latestSnapshot?: CommandBriefSnapshot
  localState?: DigestReviewCadenceLocalState
  satisfiedBy: 'Snapshot' | 'Acknowledgement' | 'None'
  requiredAction: string
}

export interface DigestReviewCadenceSummary {
  total: number
  active: number
  dueToday: number
  missed: number
  escalationReady: number
  acknowledged: number
  paused: number
  exportReadyRequired: number
  nextReviewAt?: string
}

export interface BuildDigestReviewCadenceInput {
  snapshots: CommandBriefSnapshot[]
  localStates?: DigestReviewCadenceLocalState[]
  now?: Date
}

const localStorageKey = 'hc_platform_digest_review_cadence_state_v1'

export const digestReviewCadenceBoundaryRule =
  'Digest Review Cadence schedules review ownership and acknowledgement only. It can record local review state and queue governed follow-ups, but it does not publish briefs, alter production data, or bypass Action Request approval.'

export const digestReviewCadenceRules: DigestReviewCadenceRule[] = [
  {
    id: 'owner-daily-command-brief',
    name: 'Owner daily command brief',
    description: 'Morning owner review of command posture, critical decisions, revenue risk, and handoff readiness.',
    status: 'Active',
    frequency: 'Daily',
    windowStart: '08:30',
    windowEnd: '09:15',
    timezone: 'America/New_York',
    owner: 'Owner',
    backupOwner: 'Admin',
    requiredSnapshotStatus: 'Export Ready Snapshot',
    escalationAfterMinutes: 60,
    permission: 'dashboard.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Requires current Command Digest snapshot.',
      'Requires export-ready packet before the morning review is complete.',
      'Escalates to Admin Action Requests if the review window is missed.',
    ],
  },
  {
    id: 'finance-risk-review',
    name: 'Finance risk review',
    description: 'Finance-owned review for billing exposure, failed payments, credit review, and revenue leakage.',
    status: 'Active',
    frequency: 'Weekdays',
    windowStart: '11:00',
    windowEnd: '11:30',
    timezone: 'America/New_York',
    owner: 'Finance',
    backupOwner: 'Owner',
    requiredSnapshotStatus: 'Reviewed Snapshot',
    escalationAfterMinutes: 120,
    permission: 'revenue.view',
    followUpPermission: 'billing.manage',
    followUpActionType: 'billing_review_action',
    evidence: [
      'Checks revenue risk in the latest Command Digest.',
      'Requires Finance acknowledgement before close of business.',
      'Billing-impacting actions remain server-side and permissioned.',
    ],
  },
  {
    id: 'support-escalation-review',
    name: 'Support escalation review',
    description: 'Support lead review for open escalations, stuck support issues, device risk, and venue-impacting incidents.',
    status: 'Active',
    frequency: 'Weekdays',
    windowStart: '15:00',
    windowEnd: '15:30',
    timezone: 'America/New_York',
    owner: 'Support Lead',
    backupOwner: 'Admin Ops',
    requiredSnapshotStatus: 'Reviewed Snapshot',
    escalationAfterMinutes: 60,
    permission: 'support.view',
    followUpPermission: 'support.manage',
    followUpActionType: 'support_troubleshooting_action',
    evidence: [
      'Checks support and platform health lanes.',
      'Requires explicit acknowledgement for open escalations.',
      'Remediation remains governed by support/troubleshooting handlers.',
    ],
  },
  {
    id: 'weekly-executive-readout',
    name: 'Weekly executive readout',
    description: 'Friday executive review of posture movement, archived briefs, follow-up trace, and decision throughput.',
    status: 'Active',
    frequency: 'Weekly',
    dayOfWeek: 5,
    windowStart: '14:00',
    windowEnd: '15:00',
    timezone: 'America/New_York',
    owner: 'Owner',
    backupOwner: 'Admin',
    requiredSnapshotStatus: 'Export Ready Snapshot',
    escalationAfterMinutes: 180,
    permission: 'reports.view',
    followUpPermission: 'admin_actions.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Requires export-ready archive packet.',
      'Reviews follow-up trace against Action Requests.',
      'Captures weekly owner-visible operating record.',
    ],
  },
  {
    id: 'automation-agent-review',
    name: 'AI and automation review',
    description: 'Engineering and admin review for agent recommendations, automation findings, and action handoff safety.',
    status: 'Draft',
    frequency: 'Weekly',
    dayOfWeek: 2,
    windowStart: '13:00',
    windowEnd: '13:30',
    timezone: 'America/New_York',
    owner: 'Engineering',
    backupOwner: 'Admin Ops',
    requiredSnapshotStatus: 'Snapshot Created',
    escalationAfterMinutes: 240,
    permission: 'agents.view',
    followUpPermission: 'agents.manage',
    followUpActionType: 'agent_recommended_action',
    evidence: [
      'Reviews agent findings in the Command Digest.',
      'Keeps agent recommendations human-confirmed.',
      'Draft until server-side agent review cadence is approved.',
    ],
  },
]

export function buildDigestReviewCadence(input: BuildDigestReviewCadenceInput): DigestReviewWindow[] {
  const now = input.now ?? new Date()
  const localStateByRuleId = new Map((input.localStates ?? []).map(state => [state.ruleId, state]))

  return digestReviewCadenceRules
    .map(rule => buildWindow(rule, input.snapshots, localStateByRuleId.get(rule.id), now))
    .sort((a, b) => windowStatusWeight(a.status) - windowStatusWeight(b.status)
      || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

export function summarizeDigestReviewCadence(windows: DigestReviewWindow[]): DigestReviewCadenceSummary {
  const nextReviewAt = windows
    .filter(window => window.status !== 'Paused' && window.status !== 'Needs Setup' && window.status !== 'Acknowledged')
    .sort((a, b) => new Date(a.windowStartAt).getTime() - new Date(b.windowStartAt).getTime())[0]?.windowStartAt

  return {
    total: windows.length,
    active: windows.filter(window => window.rule.status === 'Active' && window.status !== 'Paused').length,
    dueToday: windows.filter(window => window.status === 'Due Today').length,
    missed: windows.filter(window => window.status === 'Missed').length,
    escalationReady: windows.filter(window => window.status === 'Escalation Ready').length,
    acknowledged: windows.filter(window => window.status === 'Acknowledged').length,
    paused: windows.filter(window => window.status === 'Paused').length,
    exportReadyRequired: windows.filter(window => window.rule.requiredSnapshotStatus === 'Export Ready Snapshot').length,
    nextReviewAt,
  }
}

export function getDigestReviewWindowTone(status: DigestReviewWindowStatus) {
  if (status === 'Escalation Ready' || status === 'Missed') return 'danger' as const
  if (status === 'Due Today' || status === 'Needs Setup') return 'warn' as const
  if (status === 'Acknowledged') return 'ok' as const
  if (status === 'Paused') return 'neutral' as const
  return 'info' as const
}

export function getDigestReviewFrequencyTone(frequency: DigestReviewFrequency) {
  if (frequency === 'Daily') return 'warn' as const
  if (frequency === 'Weekdays') return 'info' as const
  return 'neutral' as const
}

export function getDigestReviewRequirementTone(requirement: DigestReviewRequirement) {
  if (requirement === 'Export Ready Snapshot') return 'warn' as const
  if (requirement === 'Reviewed Snapshot') return 'info' as const
  return 'neutral' as const
}

export function formatDigestReviewTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDigestReviewWindow(rule: DigestReviewCadenceRule) {
  const day = rule.frequency === 'Weekly' ? `${dayLabels[rule.dayOfWeek ?? 1]} / ` : ''
  return `${day}${rule.windowStart}-${rule.windowEnd} ${rule.timezone.replace('America/', '')}`
}

export function loadLocalDigestReviewCadenceStates(): DigestReviewCadenceLocalState[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDigestReviewCadenceLocalState)
  } catch {
    return []
  }
}

export function saveLocalDigestReviewCadenceStates(states: DigestReviewCadenceLocalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(states.slice(0, 80)))
}

export function useLocalDigestReviewCadenceStates() {
  const [states, setStates] = useState<DigestReviewCadenceLocalState[]>(() => loadLocalDigestReviewCadenceStates())

  useEffect(() => {
    saveLocalDigestReviewCadenceStates(states)
  }, [states])

  return [states, setStates] as const
}

function buildWindow(
  rule: DigestReviewCadenceRule,
  snapshots: CommandBriefSnapshot[],
  localState: DigestReviewCadenceLocalState | undefined,
  now: Date,
): DigestReviewWindow {
  const effectiveStatus = localState?.status ?? rule.status
  const effectiveRule = { ...rule, status: effectiveStatus }
  const windowStartAt = getCurrentWindowStart(rule, now)
  const dueAt = withTime(windowStartAt, rule.windowEnd)
  const nextWindowAt = getNextWindowStart(rule, now)
  const latestSnapshot = snapshots.find(snapshot => snapshotQualifies(snapshot, rule, windowStartAt))
  const acknowledgedAt = parseDate(localState?.lastAcknowledgedAt)
  const acknowledged = Boolean(acknowledgedAt && acknowledgedAt.getTime() >= windowStartAt.getTime())
  const satisfiedBy = latestSnapshot ? 'Snapshot' : acknowledged ? 'Acknowledgement' : 'None'
  const minutesUntilDue = Math.round((dueAt.getTime() - now.getTime()) / 60000)
  const minutesLate = Math.max(0, Math.round((now.getTime() - dueAt.getTime()) / 60000))

  return {
    id: `digest-review:${rule.id}`,
    rule: effectiveRule,
    status: getWindowStatus(effectiveRule, now, windowStartAt, dueAt, latestSnapshot, acknowledged, minutesLate),
    windowStartAt: windowStartAt.toISOString(),
    dueAt: dueAt.toISOString(),
    nextWindowAt: nextWindowAt.toISOString(),
    minutesUntilDue,
    minutesLate,
    latestSnapshot,
    localState,
    satisfiedBy,
    requiredAction: getRequiredAction(rule, latestSnapshot, acknowledged),
  }
}

function getWindowStatus(
  rule: DigestReviewCadenceRule,
  now: Date,
  windowStartAt: Date,
  dueAt: Date,
  latestSnapshot: CommandBriefSnapshot | undefined,
  acknowledged: boolean,
  minutesLate: number,
): DigestReviewWindowStatus {
  if (rule.status === 'Paused') return 'Paused'
  if (rule.status === 'Draft') return 'Needs Setup'
  if (latestSnapshot || acknowledged) return 'Acknowledged'
  if (now.getTime() < windowStartAt.getTime()) return 'On Track'
  if (now.getTime() <= dueAt.getTime()) return 'Due Today'
  if (minutesLate >= rule.escalationAfterMinutes) return 'Escalation Ready'
  return 'Missed'
}

function getRequiredAction(
  rule: DigestReviewCadenceRule,
  latestSnapshot: CommandBriefSnapshot | undefined,
  acknowledged: boolean,
) {
  if (latestSnapshot) return `${rule.requiredSnapshotStatus} satisfied by ${latestSnapshot.title}.`
  if (acknowledged) return 'Review acknowledged locally for this window.'
  if (rule.requiredSnapshotStatus === 'Export Ready Snapshot') return 'Create or update an export-ready brief archive packet.'
  if (rule.requiredSnapshotStatus === 'Reviewed Snapshot') return 'Review a current brief archive snapshot.'
  return 'Create a current Command Digest snapshot or acknowledge review.'
}

function snapshotQualifies(snapshot: CommandBriefSnapshot, rule: DigestReviewCadenceRule, windowStartAt: Date) {
  if (new Date(snapshot.generatedAt).getTime() < windowStartAt.getTime()) return false
  if (rule.requiredSnapshotStatus === 'Export Ready Snapshot') return snapshot.status === 'Export Ready'
  if (rule.requiredSnapshotStatus === 'Reviewed Snapshot') return snapshot.status === 'Reviewed' || snapshot.status === 'Export Ready'
  return true
}

function getCurrentWindowStart(rule: DigestReviewCadenceRule, now: Date) {
  if (appliesOnDay(rule, now.getDay())) return withTime(now, rule.windowStart)

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(now, -offset)
    if (appliesOnDay(rule, candidate.getDay())) return withTime(candidate, rule.windowStart)
  }

  return withTime(now, rule.windowStart)
}

function getNextWindowStart(rule: DigestReviewCadenceRule, now: Date) {
  for (let offset = 0; offset <= 8; offset += 1) {
    const candidate = addDays(now, offset)
    if (!appliesOnDay(rule, candidate.getDay())) continue
    const windowStart = withTime(candidate, rule.windowStart)
    if (windowStart.getTime() > now.getTime()) return windowStart
  }

  return withTime(addDays(now, 1), rule.windowStart)
}

function appliesOnDay(rule: DigestReviewCadenceRule, day: number) {
  if (rule.frequency === 'Daily') return true
  if (rule.frequency === 'Weekdays') return day >= 1 && day <= 5
  return day === (rule.dayOfWeek ?? 1)
}

function withTime(value: Date, time: string) {
  const [hours = '0', minutes = '0'] = time.split(':')
  const date = new Date(value)
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date
}

function addDays(value: Date, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function parseDate(value: string | undefined) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function windowStatusWeight(status: DigestReviewWindowStatus) {
  if (status === 'Escalation Ready') return 0
  if (status === 'Missed') return 1
  if (status === 'Due Today') return 2
  if (status === 'Needs Setup') return 3
  if (status === 'On Track') return 4
  if (status === 'Acknowledged') return 5
  return 6
}

function isDigestReviewCadenceLocalState(value: unknown): value is DigestReviewCadenceLocalState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.ruleId === 'string'
    && typeof record.updatedAt === 'string'
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
