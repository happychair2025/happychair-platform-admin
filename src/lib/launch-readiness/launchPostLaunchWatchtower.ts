import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { BackendWatchMonitor } from './backendWatchMonitor'
import type { LaunchClosureModel } from './launchClosureChecklist'
import type { LaunchEvidencePacket } from './launchEvidencePacketAssembler'
import type { LaunchFollowUpRegisterModel } from './launchFollowUpRegister'
import type { LaunchWarRoomTimeline } from './launchWarRoomTimeline'
import type { LaunchWatchCheck, LaunchWatchModel } from './launchWatchtower'

export type LaunchPostLaunchWatchtowerStatus = 'Critical' | 'Active Watch' | 'Monitoring' | 'Stable'
export type LaunchPostLaunchSignalStatus = 'Critical' | 'Watch' | 'Monitoring' | 'Stable'
export type LaunchPostLaunchSignalLane =
  | 'Launch Baseline'
  | 'Platform Health'
  | 'Support'
  | 'Billing'
  | 'Usage'
  | 'Action Queue'
  | 'Backend Watch'
  | 'Owner Follow-Up'
  | 'Feature Flags'
  | 'War Room'

export type LaunchPostLaunchSurface =
  | 'command'
  | 'backendWatch'
  | 'productionGuardrails'
  | 'warRoom'
  | 'evidencePacket'
  | 'closure'
  | 'followup'
  | 'watch'
  | 'detail'

export interface LaunchPostLaunchSignal {
  id: string
  lane: LaunchPostLaunchSignalLane
  status: LaunchPostLaunchSignalStatus
  title: string
  owner: string
  reference: string
  evidence: string
  nextStep: string
  responseWindow: string
  updatedAt: string
  auditBacked: boolean
  localOnly: boolean
  actionRequired: boolean
  surface: LaunchPostLaunchSurface
}

export interface LaunchPostLaunchLaneGroup {
  lane: LaunchPostLaunchSignalLane
  total: number
  critical: number
  watch: number
  monitoring: number
  stable: number
  nextStep: string
}

export interface LaunchPostLaunchOwnerGroup {
  owner: string
  total: number
  critical: number
  watch: number
  monitoring: number
  stable: number
  actionRequired: number
  nextStep: string
}

export interface LaunchPostLaunchWatchtowerRecord {
  id: string
  status: LaunchPostLaunchWatchtowerStatus
  headline: string
  signalId?: string
  signalTitle?: string
  signalStatus?: LaunchPostLaunchSignalStatus
  signalLane?: LaunchPostLaunchSignalLane
  criticalCount: number
  watchCount: number
  monitoringCount: number
  stableCount: number
  actionRequiredCount: number
  auditBackedCount: number
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

export interface LaunchPostLaunchWatchtower {
  status: LaunchPostLaunchWatchtowerStatus
  headline: string
  summary: string
  generatedAt: string
  signals: LaunchPostLaunchSignal[]
  nextSignal?: LaunchPostLaunchSignal
  criticalCount: number
  watchCount: number
  monitoringCount: number
  stableCount: number
  actionRequiredCount: number
  auditBackedCount: number
  localOnlyCount: number
  recordCount: number
  latestRecord?: LaunchPostLaunchWatchtowerRecord
  laneGroups: LaunchPostLaunchLaneGroup[]
  ownerGroups: LaunchPostLaunchOwnerGroup[]
}

interface BuildLaunchPostLaunchWatchtowerInput {
  data: PlatformAdminReadModel
  launchEvidencePacket: LaunchEvidencePacket
  launchWatchtower: LaunchWatchModel
  watchChecks: LaunchWatchCheck[]
  backendWatchMonitor: BackendWatchMonitor
  followUpRegister: LaunchFollowUpRegisterModel
  launchWarRoomTimeline: LaunchWarRoomTimeline
  closureModel: LaunchClosureModel
  actionRequests: AdminActionRequest[]
  records: LaunchPostLaunchWatchtowerRecord[]
}

interface SaveLaunchPostLaunchWatchtowerRecordInput {
  watchtower: LaunchPostLaunchWatchtower
  signal?: LaunchPostLaunchSignal
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_post_launch_watchtower_records'
const listeners = new Set<() => void>()
const openActionStatuses = new Set(['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'])
let cachedRawRecords = ''
let cachedRecords: LaunchPostLaunchWatchtowerRecord[] = []

export const launchPostLaunchWatchtowerBoundaryRule =
  'Post-Launch Watchtower records are monitoring and response-planning artifacts only. Recording, exporting, or queueing a response does not deploy code, execute handlers, roll back production, mutate customer data, change billing, alter modules, change permissions, impersonate users, close support records, or execute agent actions.'

export function buildLaunchPostLaunchWatchtower(input: BuildLaunchPostLaunchWatchtowerInput): LaunchPostLaunchWatchtower {
  const generatedAt = new Date().toISOString()
  const signals = buildSignals(input, generatedAt)
    .sort((a, b) => signalStatusRank(b.status) - signalStatusRank(a.status) || Number(b.actionRequired) - Number(a.actionRequired) || a.lane.localeCompare(b.lane))
  const criticalCount = signals.filter(signal => signal.status === 'Critical').length
  const watchCount = signals.filter(signal => signal.status === 'Watch').length
  const monitoringCount = signals.filter(signal => signal.status === 'Monitoring').length
  const stableCount = signals.filter(signal => signal.status === 'Stable').length
  const actionRequiredCount = signals.filter(signal => signal.actionRequired).length
  const status = criticalCount ? 'Critical' : watchCount ? 'Active Watch' : monitoringCount ? 'Monitoring' : 'Stable'

  return {
    status,
    headline: getHeadline(status, criticalCount, watchCount, actionRequiredCount),
    summary: getSummary(status, signals.length, criticalCount, watchCount, monitoringCount),
    generatedAt,
    signals,
    nextSignal: signals.find(signal => signal.status === 'Critical' || signal.status === 'Watch') ?? signals[0],
    criticalCount,
    watchCount,
    monitoringCount,
    stableCount,
    actionRequiredCount,
    auditBackedCount: signals.filter(signal => signal.auditBacked).length,
    localOnlyCount: signals.filter(signal => signal.localOnly).length,
    recordCount: input.records.length,
    latestRecord: input.records[0],
    laneGroups: buildLaneGroups(signals),
    ownerGroups: buildOwnerGroups(signals),
  }
}

export function getLaunchPostLaunchWatchtowerRecords(): LaunchPostLaunchWatchtowerRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as LaunchPostLaunchWatchtowerRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveLaunchPostLaunchWatchtowerRecord(input: SaveLaunchPostLaunchWatchtowerRecordInput) {
  const record: LaunchPostLaunchWatchtowerRecord = {
    id: crypto.randomUUID(),
    status: input.watchtower.status,
    headline: input.watchtower.headline,
    signalId: input.signal?.id,
    signalTitle: input.signal?.title,
    signalStatus: input.signal?.status,
    signalLane: input.signal?.lane,
    criticalCount: input.watchtower.criticalCount,
    watchCount: input.watchtower.watchCount,
    monitoringCount: input.watchtower.monitoringCount,
    stableCount: input.watchtower.stableCount,
    actionRequiredCount: input.watchtower.actionRequiredCount,
    auditBackedCount: input.watchtower.auditBackedCount,
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getLaunchPostLaunchWatchtowerRecords()].slice(0, 160)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitLaunchPostLaunchWatchtowerRecordChange()
  return record
}

export function subscribeToLaunchPostLaunchWatchtowerRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLaunchPostLaunchWatchtowerRecords() {
  return useSyncExternalStore(subscribeToLaunchPostLaunchWatchtowerRecords, getLaunchPostLaunchWatchtowerRecords, () => [])
}

export function getLaunchPostLaunchWatchtowerTone(status: LaunchPostLaunchWatchtowerStatus | LaunchPostLaunchSignalStatus) {
  if (status === 'Critical') return 'danger' as const
  if (status === 'Active Watch' || status === 'Watch') return 'warn' as const
  if (status === 'Monitoring') return 'info' as const
  return 'ok' as const
}

export function getLaunchPostLaunchWatchtowerMetricTone(status: LaunchPostLaunchWatchtowerStatus) {
  if (status === 'Critical') return 'danger' as const
  if (status === 'Active Watch') return 'warn' as const
  if (status === 'Monitoring') return 'neutral' as const
  return 'ok' as const
}

export function getLaunchPostLaunchWatchtowerFilename(watchtower: LaunchPostLaunchWatchtower) {
  return `launch-post-launch-watchtower-${watchtower.status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildLaunchPostLaunchWatchtowerHtml(watchtower: LaunchPostLaunchWatchtower, session: AdminSession) {
  const signalRows = watchtower.signals.map(signal => `
    <tr>
      <td>${escapeHtml(signal.lane)}</td>
      <td>${escapeHtml(signal.status)}</td>
      <td>${escapeHtml(signal.title)}</td>
      <td>${escapeHtml(signal.owner)}</td>
      <td>${escapeHtml(signal.responseWindow)}</td>
      <td>${escapeHtml(signal.evidence)}</td>
      <td>${escapeHtml(signal.nextStep)}</td>
    </tr>
  `).join('')
  const ownerRows = watchtower.ownerGroups.map(owner => `
    <tr>
      <td>${escapeHtml(owner.owner)}</td>
      <td>${owner.total}</td>
      <td>${owner.critical}</td>
      <td>${owner.watch}</td>
      <td>${owner.actionRequired}</td>
      <td>${escapeHtml(owner.nextStep)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Post-Launch Watchtower</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17211c; margin: 40px; background: #f8faf7; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 28px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { border: 1px solid #d8e0d7; border-radius: 8px; padding: 14px; background: #fff; }
      .card span { display: block; color: #66736b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .card strong { display: block; margin-top: 8px; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8e0d7; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e8eee7; vertical-align: top; }
      th { color: #516157; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .notice { border-left: 4px solid #7a8f5f; padding: 14px; background: #fff; margin: 20px 0; }
    </style>
  </head>
  <body>
    <p>Happy Chair Platform Admin</p>
    <h1>${escapeHtml(watchtower.headline)}</h1>
    <p>${escapeHtml(watchtower.summary)}</p>
    <div class="grid">
      <div class="card"><span>Status</span><strong>${escapeHtml(watchtower.status)}</strong></div>
      <div class="card"><span>Critical</span><strong>${watchtower.criticalCount}</strong></div>
      <div class="card"><span>Watch</span><strong>${watchtower.watchCount}</strong></div>
      <div class="card"><span>Action Required</span><strong>${watchtower.actionRequiredCount}</strong></div>
    </div>
    <div class="notice">
      Generated ${escapeHtml(watchtower.generatedAt)} by ${escapeHtml(session.name)} (${escapeHtml(session.email)}). This export is monitoring evidence only and does not execute production changes.
    </div>
    <h2>Post-Launch Signals</h2>
    <table>
      <thead><tr><th>Lane</th><th>Status</th><th>Signal</th><th>Owner</th><th>Window</th><th>Evidence</th><th>Next Step</th></tr></thead>
      <tbody>${signalRows}</tbody>
    </table>
    <h2>Owner Load</h2>
    <table>
      <thead><tr><th>Owner</th><th>Total</th><th>Critical</th><th>Watch</th><th>Action Required</th><th>Next Step</th></tr></thead>
      <tbody>${ownerRows}</tbody>
    </table>
  </body>
</html>`
}

function buildSignals(input: BuildLaunchPostLaunchWatchtowerInput, generatedAt: string): LaunchPostLaunchSignal[] {
  const openActions = input.actionRequests.filter(request => openActionStatuses.has(request.status))
  const blockedActions = openActions.filter(request => request.status === 'Blocked' || request.status === 'Failed')
  const failingHealth = input.data.platformHealthSignals.filter(signal => signal.status === 'Failing')
  const warningHealth = input.data.platformHealthSignals.filter(signal => signal.status === 'Warning' || signal.status === 'Unknown')
  const openSupport = input.data.supportIssues.filter(issue => issue.status !== 'Resolved')
  const criticalSupport = openSupport.filter(issue => issue.severity === 'critical' || issue.status === 'Escalated')
  const billingCritical = input.data.billingRisks.filter(risk => risk.billingStatus === 'Failed Payment' || risk.billingStatus === 'Past Due')
  const decliningUsage = input.data.usageAnalytics.filter(row => row.usageTrend === 'Declining' || row.inactiveDays >= 7 || row.escalations7d > 4)
  const highRiskFlags = input.data.featureFlags.filter(flag => flag.enabled && flag.environment === 'Production' && flag.blastRadius === 'High')
  const activeFollowUps = input.followUpRegister.openCount + input.followUpRegister.inProgressCount
  const latestWatchCheck = input.watchChecks[0]

  return [
    {
      id: 'post-launch-packet-baseline',
      lane: 'Launch Baseline',
      status: input.launchEvidencePacket.status === 'Blocked' ? 'Critical' : input.launchEvidencePacket.status === 'Incomplete' ? 'Watch' : input.launchEvidencePacket.status === 'Ready For Review' ? 'Monitoring' : 'Stable',
      title: 'Launch evidence packet baseline',
      owner: 'Owner',
      reference: 'Launch Evidence Packet',
      evidence: `${input.launchEvidencePacket.status}: ${input.launchEvidencePacket.requiredSatisfiedCount}/${input.launchEvidencePacket.requiredCount} required evidence items satisfied, ${input.launchEvidencePacket.missingCount} missing.`,
      nextStep: input.launchEvidencePacket.nextItem?.nextStep ?? 'Keep the evidence packet attached to post-launch monitoring.',
      responseWindow: input.launchEvidencePacket.status === 'Blocked' ? 'Before launch close' : 'Daily review',
      updatedAt: input.launchEvidencePacket.latestRecord?.recordedAt ?? input.launchEvidencePacket.generatedAt,
      auditBacked: input.launchEvidencePacket.recordCount > 0 || input.launchEvidencePacket.auditBackedCount > 0,
      localOnly: true,
      actionRequired: input.launchEvidencePacket.status === 'Blocked' || input.launchEvidencePacket.status === 'Incomplete',
      surface: 'evidencePacket',
    },
    {
      id: 'post-launch-watch-drift',
      lane: 'Launch Baseline',
      status: input.launchWatchtower.status === 'Critical Drift' ? 'Critical' : input.launchWatchtower.status === 'Drift' ? 'Watch' : latestWatchCheck ? 'Stable' : 'Monitoring',
      title: 'Approval drift watch',
      owner: 'Owner',
      reference: 'Launch Watchtower',
      evidence: `${input.launchWatchtower.status}: ${input.launchWatchtower.criticalCount} critical, ${input.launchWatchtower.watchCount} watch, ${formatSigned(input.launchWatchtower.scoreDrift)} score drift.`,
      nextStep: input.launchWatchtower.summary,
      responseWindow: input.launchWatchtower.status === 'Critical Drift' ? '1h' : input.launchWatchtower.status === 'Drift' ? '24h' : 'Next check',
      updatedAt: latestWatchCheck?.recordedAt ?? input.launchWatchtower.generatedAt,
      auditBacked: Boolean(latestWatchCheck),
      localOnly: true,
      actionRequired: input.launchWatchtower.status !== 'Stable',
      surface: 'watch',
    },
    {
      id: 'post-launch-backend-watch',
      lane: 'Backend Watch',
      status: input.backendWatchMonitor.status === 'Critical Drift' ? 'Critical' : input.backendWatchMonitor.status === 'Watch' ? 'Watch' : input.backendWatchMonitor.status === 'Verified' ? 'Stable' : 'Monitoring',
      title: 'Backend release watch',
      owner: input.backendWatchMonitor.nextItem?.watchOwner ?? 'Engineering',
      reference: 'Backend Watch Monitor',
      evidence: `${input.backendWatchMonitor.status}: ${input.backendWatchMonitor.criticalCount} critical, ${input.backendWatchMonitor.watchCount} watch, ${input.backendWatchMonitor.rollbackReadyCount}/${input.backendWatchMonitor.totalCount} rollback-ready.`,
      nextStep: input.backendWatchMonitor.nextItem?.nextStep ?? 'Keep backend watch evidence available until closure.',
      responseWindow: input.backendWatchMonitor.criticalCount ? '1h' : input.backendWatchMonitor.watchCount ? '24h' : 'Daily review',
      updatedAt: input.backendWatchMonitor.generatedAt,
      auditBacked: input.backendWatchMonitor.auditBackedCount > 0,
      localOnly: true,
      actionRequired: input.backendWatchMonitor.status === 'Critical Drift' || input.backendWatchMonitor.status === 'Watch',
      surface: 'backendWatch',
    },
    {
      id: 'post-launch-platform-health',
      lane: 'Platform Health',
      status: failingHealth.length ? 'Critical' : warningHealth.length ? 'Watch' : 'Stable',
      title: 'Platform health after launch',
      owner: 'Engineering',
      reference: 'System Health',
      evidence: `${failingHealth.length} failing, ${warningHealth.length} warning or unknown, ${input.data.platformHealthSignals.length} total health checks.`,
      nextStep: failingHealth[0]?.recommendedAction ?? warningHealth[0]?.recommendedAction ?? 'No platform health response is waiting.',
      responseWindow: failingHealth.length ? '1h' : warningHealth.length ? '24h' : 'Daily review',
      updatedAt: failingHealth[0]?.checkedAt ?? warningHealth[0]?.checkedAt ?? input.data.platformHealthSignals[0]?.checkedAt ?? generatedAt,
      auditBacked: input.data.auditEvents.some(event => auditEventMatches(event, 'health')),
      localOnly: false,
      actionRequired: failingHealth.length > 0 || warningHealth.length > 0,
      surface: 'detail',
    },
    {
      id: 'post-launch-support-pressure',
      lane: 'Support',
      status: criticalSupport.length ? 'Critical' : openSupport.length ? 'Watch' : 'Stable',
      title: 'Support pressure after launch',
      owner: criticalSupport[0]?.owner ?? openSupport[0]?.owner ?? 'Support',
      reference: 'Support Center',
      evidence: `${criticalSupport.length} critical or escalated issues, ${openSupport.length} open support issues, ${openSupport.reduce((total, issue) => total + issue.affectedUsers, 0)} affected users.`,
      nextStep: criticalSupport[0]?.recommendedAction ?? openSupport[0]?.recommendedAction ?? 'No launch support pressure is active.',
      responseWindow: criticalSupport.length ? '1h' : openSupport.length ? '24h' : 'Daily review',
      updatedAt: criticalSupport[0]?.detectedAt ?? openSupport[0]?.detectedAt ?? generatedAt,
      auditBacked: input.data.auditEvents.some(event => auditEventMatches(event, 'support')),
      localOnly: false,
      actionRequired: criticalSupport.length > 0 || openSupport.length > 0,
      surface: 'followup',
    },
    {
      id: 'post-launch-billing-risk',
      lane: 'Billing',
      status: billingCritical.some(risk => risk.billingStatus === 'Failed Payment') ? 'Critical' : billingCritical.length ? 'Watch' : input.data.billingRisks.length ? 'Monitoring' : 'Stable',
      title: 'Billing risk after launch',
      owner: billingCritical[0]?.owner ?? input.data.billingRisks[0]?.owner ?? 'Finance',
      reference: 'Revenue / Billing Risks',
      evidence: `${billingCritical.length} failed or past-due risks, ${formatMoney(billingCritical.reduce((total, risk) => total + risk.amountAtRisk, 0))} at risk.`,
      nextStep: billingCritical[0]?.nextAction ?? input.data.billingRisks[0]?.nextAction ?? 'No billing risk is tied to launch watch.',
      responseWindow: billingCritical.some(risk => risk.billingStatus === 'Failed Payment') ? '4h' : billingCritical.length ? '24h' : 'Daily review',
      updatedAt: billingCritical[0]?.lastPaymentAttempt ?? input.data.billingRisks[0]?.lastPaymentAttempt ?? generatedAt,
      auditBacked: input.data.auditEvents.some(event => auditEventMatches(event, 'billing')),
      localOnly: false,
      actionRequired: billingCritical.length > 0,
      surface: 'detail',
    },
    {
      id: 'post-launch-usage-drift',
      lane: 'Usage',
      status: decliningUsage.some(row => row.status === 'At Risk' || row.inactiveDays >= 14) ? 'Critical' : decliningUsage.length ? 'Watch' : 'Stable',
      title: 'Usage and adoption drift',
      owner: 'Client Success',
      reference: 'Usage Analytics',
      evidence: `${decliningUsage.length} accounts declining, ${decliningUsage.filter(row => row.inactiveDays >= 7).length} inactive 7d+, ${decliningUsage.reduce((total, row) => total + row.escalations7d, 0)} escalations.`,
      nextStep: decliningUsage[0] ? `Review ${decliningUsage[0].organizationName} adoption and response metrics.` : 'No usage drift is active after launch.',
      responseWindow: decliningUsage.some(row => row.status === 'At Risk' || row.inactiveDays >= 14) ? '4h' : decliningUsage.length ? '24h' : 'Daily review',
      updatedAt: decliningUsage[0]?.lastActive ?? input.data.usageAnalytics[0]?.lastActive ?? generatedAt,
      auditBacked: input.data.auditEvents.some(event => auditEventMatches(event, 'usage')),
      localOnly: false,
      actionRequired: decliningUsage.length > 0,
      surface: 'detail',
    },
    {
      id: 'post-launch-action-queue',
      lane: 'Action Queue',
      status: blockedActions.length ? 'Critical' : openActions.length ? 'Watch' : 'Stable',
      title: 'Governed action queue',
      owner: 'Operations',
      reference: 'Admin Action Requests',
      evidence: `${openActions.length} open action requests, ${blockedActions.length} blocked or failed.`,
      nextStep: blockedActions[0]?.statusReason ?? openActions[0]?.reason ?? 'No open action queue response is waiting.',
      responseWindow: blockedActions.length ? '1h' : openActions.length ? '24h' : 'Daily review',
      updatedAt: blockedActions[0]?.updatedAt ?? openActions[0]?.updatedAt ?? generatedAt,
      auditBacked: openActions.some(request => Boolean(request.auditEventId)),
      localOnly: true,
      actionRequired: blockedActions.length > 0 || openActions.length > 0,
      surface: 'command',
    },
    {
      id: 'post-launch-owner-follow-up',
      lane: 'Owner Follow-Up',
      status: input.followUpRegister.blockedCount ? 'Critical' : activeFollowUps ? 'Watch' : input.followUpRegister.resolvedCount ? 'Stable' : 'Monitoring',
      title: 'Owner follow-up register',
      owner: input.followUpRegister.nextItem?.owner ?? 'Owner',
      reference: 'Follow-Up Register',
      evidence: `${input.followUpRegister.blockedCount} blocked, ${activeFollowUps} active, ${input.followUpRegister.resolvedCount} resolved follow-ups.`,
      nextStep: input.followUpRegister.nextItem?.nextStep ?? 'Keep follow-up ledger available for post-launch close.',
      responseWindow: input.followUpRegister.blockedCount ? '1h' : activeFollowUps ? '24h' : 'Daily review',
      updatedAt: input.followUpRegister.nextItem?.updatedAt ?? input.followUpRegister.nextItem?.createdAt ?? generatedAt,
      auditBacked: input.followUpRegister.items.some(item => item.auditBacked),
      localOnly: true,
      actionRequired: input.followUpRegister.blockedCount > 0 || activeFollowUps > 0,
      surface: 'followup',
    },
    {
      id: 'post-launch-production-flags',
      lane: 'Feature Flags',
      status: highRiskFlags.length ? 'Watch' : 'Stable',
      title: 'High blast-radius production flags',
      owner: highRiskFlags[0]?.owner ?? 'Engineering',
      reference: 'Feature Flags',
      evidence: `${highRiskFlags.length} enabled high blast-radius production flags.`,
      nextStep: highRiskFlags[0] ? `Review ${highRiskFlags[0].name} rollout and audit posture.` : 'No high blast-radius production flag is active.',
      responseWindow: highRiskFlags.length ? '24h' : 'Daily review',
      updatedAt: highRiskFlags[0]?.updatedAt ?? generatedAt,
      auditBacked: highRiskFlags.every(flag => flag.requiresAudit),
      localOnly: false,
      actionRequired: highRiskFlags.length > 0,
      surface: 'productionGuardrails',
    },
    {
      id: 'post-launch-war-room',
      lane: 'War Room',
      status: input.launchWarRoomTimeline.status === 'Critical' ? 'Critical' : input.launchWarRoomTimeline.status === 'Review' ? 'Watch' : input.launchWarRoomTimeline.status === 'Active' ? 'Monitoring' : 'Stable',
      title: 'War room continuity',
      owner: input.launchWarRoomTimeline.nextEvent?.owner ?? 'Owner',
      reference: 'Launch War Room',
      evidence: `${input.launchWarRoomTimeline.criticalCount} critical, ${input.launchWarRoomTimeline.actionNeededCount} action needed, ${input.launchWarRoomTimeline.auditBackedCount} audit backed events.`,
      nextStep: input.launchWarRoomTimeline.nextEvent?.nextStep ?? 'No active war room escalation is waiting.',
      responseWindow: input.launchWarRoomTimeline.criticalCount ? '1h' : input.launchWarRoomTimeline.actionNeededCount ? '24h' : 'Daily review',
      updatedAt: input.launchWarRoomTimeline.nextEvent?.occurredAt ?? input.launchWarRoomTimeline.generatedAt,
      auditBacked: input.launchWarRoomTimeline.auditBackedCount > 0,
      localOnly: input.launchWarRoomTimeline.localOnlyCount > 0,
      actionRequired: input.launchWarRoomTimeline.criticalCount > 0 || input.launchWarRoomTimeline.actionNeededCount > 0,
      surface: 'warRoom',
    },
    {
      id: 'post-launch-closure-decision',
      lane: 'Launch Baseline',
      status: input.closureModel.decision === 'No Go' ? 'Critical' : input.closureModel.decision === 'Conditional Go' ? 'Watch' : input.closureModel.readyForExecutiveSignOff ? 'Stable' : 'Monitoring',
      title: 'Closure decision posture',
      owner: 'Owner',
      reference: 'Launch Closure',
      evidence: `${input.closureModel.decision}: ${input.closureModel.completeRequiredCount}/${input.closureModel.requiredCount} required checks complete, ${input.closureModel.openActionCount} open actions.`,
      nextStep: input.closureModel.checklist.find(item => item.status !== 'Complete')?.nextStep ?? 'Keep closure decision attached to post-launch watch.',
      responseWindow: input.closureModel.decision === 'No Go' ? 'Before launch close' : input.closureModel.decision === 'Conditional Go' ? '24h' : 'Daily review',
      updatedAt: input.closureModel.generatedAt,
      auditBacked: input.closureModel.evidenceItemCount > 0,
      localOnly: true,
      actionRequired: input.closureModel.decision !== 'Go' || !input.closureModel.readyForExecutiveSignOff,
      surface: 'closure',
    },
  ]
}

function buildLaneGroups(signals: LaunchPostLaunchSignal[]): LaunchPostLaunchLaneGroup[] {
  const lanes = Array.from(new Set(signals.map(signal => signal.lane)))
  return lanes.map(lane => {
    const laneSignals = signals.filter(signal => signal.lane === lane)
    const openSignal = laneSignals.find(signal => signal.status === 'Critical' || signal.status === 'Watch') ?? laneSignals[0]
    return {
      lane,
      total: laneSignals.length,
      critical: laneSignals.filter(signal => signal.status === 'Critical').length,
      watch: laneSignals.filter(signal => signal.status === 'Watch').length,
      monitoring: laneSignals.filter(signal => signal.status === 'Monitoring').length,
      stable: laneSignals.filter(signal => signal.status === 'Stable').length,
      nextStep: openSignal?.nextStep ?? 'No response required.',
    }
  }).sort((a, b) => b.critical - a.critical || b.watch - a.watch || a.lane.localeCompare(b.lane))
}

function buildOwnerGroups(signals: LaunchPostLaunchSignal[]): LaunchPostLaunchOwnerGroup[] {
  const owners = Array.from(new Set(signals.map(signal => signal.owner)))
  return owners.map(owner => {
    const ownerSignals = signals.filter(signal => signal.owner === owner)
    const openSignal = ownerSignals.find(signal => signal.status === 'Critical' || signal.status === 'Watch') ?? ownerSignals[0]
    return {
      owner,
      total: ownerSignals.length,
      critical: ownerSignals.filter(signal => signal.status === 'Critical').length,
      watch: ownerSignals.filter(signal => signal.status === 'Watch').length,
      monitoring: ownerSignals.filter(signal => signal.status === 'Monitoring').length,
      stable: ownerSignals.filter(signal => signal.status === 'Stable').length,
      actionRequired: ownerSignals.filter(signal => signal.actionRequired).length,
      nextStep: openSignal?.nextStep ?? 'No response required.',
    }
  }).sort((a, b) => b.critical - a.critical || b.watch - a.watch || b.actionRequired - a.actionRequired || a.owner.localeCompare(b.owner))
}

function getHeadline(status: LaunchPostLaunchWatchtowerStatus, criticalCount: number, watchCount: number, actionRequiredCount: number) {
  if (status === 'Critical') return `${criticalCount} post-launch signal${criticalCount === 1 ? '' : 's'} require immediate review`
  if (status === 'Active Watch') return `${watchCount} post-launch signal${watchCount === 1 ? '' : 's'} need owner follow-up`
  if (status === 'Monitoring') return `${actionRequiredCount} monitored signal${actionRequiredCount === 1 ? '' : 's'} remain open`
  return 'Post-launch watch is stable'
}

function getSummary(status: LaunchPostLaunchWatchtowerStatus, total: number, criticalCount: number, watchCount: number, monitoringCount: number) {
  if (status === 'Critical') return `${criticalCount} of ${total} post-launch signals are critical. Route response ownership before launch close.`
  if (status === 'Active Watch') return `${watchCount} of ${total} post-launch signals need same-day review.`
  if (status === 'Monitoring') return `${monitoringCount} of ${total} post-launch signals remain in monitoring.`
  return `All ${total} post-launch signals are stable.`
}

function signalStatusRank(status: LaunchPostLaunchSignalStatus) {
  if (status === 'Critical') return 4
  if (status === 'Watch') return 3
  if (status === 'Monitoring') return 2
  return 1
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function auditEventMatches(event: PlatformAdminReadModel['auditEvents'][number], key: string) {
  const haystack = `${event.actionKey} ${event.actionLabel} ${event.scope}`.toLowerCase()
  return haystack.includes(key.toLowerCase())
}

function emitLaunchPostLaunchWatchtowerRecordChange() {
  listeners.forEach(listener => listener())
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
