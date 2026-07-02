import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type { AdminActionRequest } from '../admin-actions/actionRequests'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'
import type {
  BackendExecutionReadinessDashboard,
  BackendExecutionReadinessRow,
  BackendExecutionReadinessStatus,
} from './backendExecutionReadinessDashboard'

export type TrustedHandlerDeploymentStatus =
  | 'Blocked'
  | 'Needs Build Plan'
  | 'Ready For Build'
  | 'Build Queued'
  | 'Release Candidate'
  | 'Verified'

export type TrustedHandlerDeploymentCheckStatus = 'Blocked' | 'Review' | 'Ready' | 'Verified'
export type TrustedHandlerDeploymentCheckCategory = 'Security' | 'Execution' | 'Audit' | 'Rollback' | 'Operations' | 'Release'

export interface TrustedHandlerDeploymentCheck {
  id: string
  category: TrustedHandlerDeploymentCheckCategory
  label: string
  status: TrustedHandlerDeploymentCheckStatus
  required: boolean
  detail: string
  implementationNote: string
}

export interface TrustedHandlerDeploymentItem {
  id: string
  executionReadinessRowId: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  status: TrustedHandlerDeploymentStatus
  recommendedStatus: TrustedHandlerDeploymentStatus
  readinessStatus: BackendExecutionReadinessStatus
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  endpointConfigured: boolean
  queuedRequestCount: number
  dryRunProofCount: number
  auditEventCount: number
  blockerCount: number
  reviewCount: number
  readyCount: number
  verifiedCount: number
  requiredCheckCount: number
  checks: TrustedHandlerDeploymentCheck[]
  buildPlan: string
  serverRoutePlan: string
  securityPlan: string
  observabilityPlan: string
  releasePlan: string
  rollbackPlan: string
  auditPlan: string
  nextStep: string
  generatedAt: string
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface TrustedHandlerDeploymentChecklist {
  status: TrustedHandlerDeploymentStatus
  summary: string
  generatedAt: string
  items: TrustedHandlerDeploymentItem[]
  nextItem?: TrustedHandlerDeploymentItem
  totalCount: number
  blockedCount: number
  needsBuildPlanCount: number
  readyForBuildCount: number
  buildQueuedCount: number
  releaseCandidateCount: number
  verifiedCount: number
  criticalCount: number
  requiredCheckCount: number
  readyOrVerifiedCheckCount: number
  auditBackedCount: number
  ownerGroups: TrustedHandlerDeploymentOwnerGroup[]
  categoryGroups: TrustedHandlerDeploymentCategoryGroup[]
}

export interface TrustedHandlerDeploymentOwnerGroup {
  owner: string
  total: number
  blocked: number
  needsBuildPlan: number
  readyForBuild: number
  buildQueued: number
  releaseCandidate: number
  verified: number
  criticalCount: number
  nextStep: string
}

export interface TrustedHandlerDeploymentCategoryGroup {
  category: TrustedHandlerDeploymentCheckCategory
  total: number
  blocked: number
  review: number
  ready: number
  verified: number
  requiredCount: number
  nextStep: string
}

export interface TrustedHandlerDeploymentRecord {
  id: string
  itemId: string
  status: TrustedHandlerDeploymentStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildTrustedHandlerDeploymentChecklistInput {
  executionDashboard: BackendExecutionReadinessDashboard
  actionRequests: AdminActionRequest[]
  records: TrustedHandlerDeploymentRecord[]
}

interface SaveTrustedHandlerDeploymentRecordInput {
  item: TrustedHandlerDeploymentItem
  status: TrustedHandlerDeploymentStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_trusted_handler_deployment_records'
const listeners = new Set<() => void>()
let cachedRawRecords = ''
let cachedRecords: TrustedHandlerDeploymentRecord[] = []

export const trustedHandlerDeploymentBoundaryRule =
  'Trusted handler deployment checklist records are engineering handoff artifacts only. They do not deploy code, call server handlers, mutate production data, change billing, alter modules, change permissions, impersonate users, or execute agent actions from Platform Admin.'

export const trustedHandlerDeploymentStatuses: TrustedHandlerDeploymentStatus[] = [
  'Blocked',
  'Needs Build Plan',
  'Ready For Build',
  'Build Queued',
  'Release Candidate',
  'Verified',
]

export function buildTrustedHandlerDeploymentChecklist({
  executionDashboard,
  actionRequests,
  records,
}: BuildTrustedHandlerDeploymentChecklistInput): TrustedHandlerDeploymentChecklist {
  const generatedAt = new Date().toISOString()
  const latestRecordByItem = getLatestRecordByItem(records)
  const items = executionDashboard.rows
    .map(row => withLatestRecord(createItem(row, actionRequests, generatedAt), latestRecordByItem.get(getItemId(row))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openItems = items.filter(item => item.status !== 'Verified')
  const blockedCount = items.filter(item => item.status === 'Blocked').length
  const needsBuildPlanCount = items.filter(item => item.status === 'Needs Build Plan').length
  const readyForBuildCount = items.filter(item => item.status === 'Ready For Build').length
  const buildQueuedCount = items.filter(item => item.status === 'Build Queued').length
  const releaseCandidateCount = items.filter(item => item.status === 'Release Candidate').length
  const verifiedCount = items.filter(item => item.status === 'Verified').length
  const status = getAggregateStatus(items)

  return {
    status,
    summary: getChecklistSummary(status, blockedCount, needsBuildPlanCount, readyForBuildCount, buildQueuedCount, releaseCandidateCount, verifiedCount),
    generatedAt,
    items,
    nextItem: openItems[0],
    totalCount: items.length,
    blockedCount,
    needsBuildPlanCount,
    readyForBuildCount,
    buildQueuedCount,
    releaseCandidateCount,
    verifiedCount,
    criticalCount: openItems.filter(item => item.risk === 'Critical').length,
    requiredCheckCount: items.reduce((total, item) => total + item.requiredCheckCount, 0),
    readyOrVerifiedCheckCount: items.reduce((total, item) => total + item.readyCount + item.verifiedCount, 0),
    auditBackedCount: items.filter(item => Boolean(item.auditEventId) || item.auditEventCount > 0).length,
    ownerGroups: buildOwnerGroups(items),
    categoryGroups: buildCategoryGroups(items),
  }
}

export function getTrustedHandlerDeploymentRecords(): TrustedHandlerDeploymentRecord[] {
  if (typeof localStorage === 'undefined') return []
  const rawRecords = localStorage.getItem(storageKey) ?? '[]'
  if (rawRecords === cachedRawRecords) return cachedRecords

  try {
    cachedRawRecords = rawRecords
    cachedRecords = JSON.parse(rawRecords) as TrustedHandlerDeploymentRecord[]
    return cachedRecords
  } catch {
    cachedRawRecords = rawRecords
    cachedRecords = []
    return []
  }
}

export function saveTrustedHandlerDeploymentRecord(input: SaveTrustedHandlerDeploymentRecordInput) {
  const record: TrustedHandlerDeploymentRecord = {
    id: crypto.randomUUID(),
    itemId: input.item.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultDeploymentRecordNote(input.status, input.item),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const records = [record, ...getTrustedHandlerDeploymentRecords()].slice(0, 180)

  cachedRecords = records
  cachedRawRecords = JSON.stringify(records)
  localStorage.setItem(storageKey, cachedRawRecords)
  emitTrustedHandlerDeploymentRecordChange()
  return record
}

export function subscribeToTrustedHandlerDeploymentRecords(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useTrustedHandlerDeploymentRecords() {
  return useSyncExternalStore(subscribeToTrustedHandlerDeploymentRecords, getTrustedHandlerDeploymentRecords, () => [])
}

export function getTrustedHandlerDeploymentTone(status: TrustedHandlerDeploymentStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Release Candidate' || status === 'Ready For Build' || status === 'Build Queued') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Build Plan') return 'warn'
  return 'neutral'
}

export function getTrustedHandlerDeploymentCheckTone(status: TrustedHandlerDeploymentCheckStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Verified' || status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getTrustedHandlerDeploymentRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getTrustedHandlerDeploymentFilename(item: TrustedHandlerDeploymentItem) {
  return `trusted-handler-deployment-checklist-${item.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildTrustedHandlerDeploymentHtml(item: TrustedHandlerDeploymentItem, session: AdminSession) {
  const checkRows = item.checks.map(check => `
    <tr>
      <td>${escapeHtml(check.category)}</td>
      <td>${escapeHtml(check.label)}</td>
      <td>${escapeHtml(check.status)}</td>
      <td>${check.required ? 'Required' : 'Optional'}</td>
      <td>${escapeHtml(check.detail)}</td>
      <td>${escapeHtml(check.implementationNote)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.handlerLabel)} trusted handler deployment checklist</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1120px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
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
        <p>Happy Chair Platform Admin / Trusted Handler Deployment Checklist</p>
        <h1>${escapeHtml(item.handlerLabel)}</h1>
        <p>${escapeHtml(trustedHandlerDeploymentBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(item.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(item.engineeringOwner)}</strong></div>
        <div><span>Readiness</span><strong>${escapeHtml(item.readinessStatus)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(item.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(item.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${item.method} ${item.endpoint}`)}</strong></div>
        <div><span>Checks</span><strong>${item.readyCount + item.verifiedCount}/${item.requiredCheckCount} ready</strong></div>
      </section>
      <section>
        <h2>Deployment Checks</h2>
        <table><thead><tr><th>Category</th><th>Check</th><th>Status</th><th>Required</th><th>Detail</th><th>Implementation Note</th></tr></thead><tbody>${checkRows}</tbody></table>
      </section>
      <section>
        <h2>Build Plan</h2>
        <p>${escapeHtml(item.buildPlan)}</p>
        <p>${escapeHtml(item.serverRoutePlan)}</p>
      </section>
      <section>
        <h2>Security, Audit, Release</h2>
        <p><strong>Security:</strong> ${escapeHtml(item.securityPlan)}</p>
        <p><strong>Observability:</strong> ${escapeHtml(item.observabilityPlan)}</p>
        <p><strong>Release:</strong> ${escapeHtml(item.releasePlan)}</p>
        <p><strong>Rollback:</strong> ${escapeHtml(item.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(item.auditPlan)}</p>
        <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createItem(
  row: BackendExecutionReadinessRow,
  actionRequests: AdminActionRequest[],
  generatedAt: string,
): TrustedHandlerDeploymentItem {
  const handlerRequests = actionRequests.filter(request => request.serverHandler.key === row.handlerKey || request.metadata?.handlerKey === row.handlerKey)
  const checks = buildDeploymentChecks(row, handlerRequests)
  const blockerCount = checks.filter(check => check.status === 'Blocked').length
  const reviewCount = checks.filter(check => check.status === 'Review').length
  const readyCount = checks.filter(check => check.status === 'Ready').length
  const verifiedCount = checks.filter(check => check.status === 'Verified').length
  const requiredCheckCount = checks.filter(check => check.required).length
  const recommendedStatus = getRecommendedStatus(row, blockerCount, reviewCount, handlerRequests.length)

  return {
    id: getItemId(row),
    executionReadinessRowId: row.id,
    handlerKey: row.handlerKey,
    handlerLabel: row.handlerLabel,
    method: row.method,
    endpoint: row.endpoint,
    permission: row.permission,
    mutationMode: row.mutationMode,
    status: recommendedStatus,
    recommendedStatus,
    readinessStatus: row.status,
    risk: row.risk,
    productOwner: row.productOwner,
    engineeringOwner: row.engineeringOwner,
    endpointConfigured: row.endpointConfigured,
    queuedRequestCount: row.queuedRequestCount,
    dryRunProofCount: row.passedDryRunCount,
    auditEventCount: row.auditEventCount,
    blockerCount,
    reviewCount,
    readyCount,
    verifiedCount,
    requiredCheckCount,
    checks,
    buildPlan: `Implement ${row.handlerKey} as a trusted server handler behind ${row.permission}, with schema validation, idempotency, dry-run mode, rollback metadata, and audit writes before any production mutation path is enabled.`,
    serverRoutePlan: `Route ${row.method} ${row.endpoint} must terminate on the server using service credentials. Platform Admin browser controls may only queue, review, and export handoff evidence.`,
    securityPlan: `Enforce ${row.permission}, tenant scope, actor role, and human confirmation${row.humanConfirmationRequired ? '' : ' if the handler becomes production-changing'} before handler execution.`,
    observabilityPlan: `Emit structured handler outcome, duration, permission outcome, mutationApplied, correlationId, and rollback reference for ${row.handlerKey}.`,
    releasePlan: `Ship behind an internal feature flag or allowlist, run dry-run proof, then enable production mutation only after owner approval and visible audit evidence.`,
    rollbackPlan: row.rollbackPlan,
    auditPlan: row.auditPlan,
    nextStep: getNextStep(recommendedStatus, row.handlerLabel, blockerCount, reviewCount),
    generatedAt,
  }
}

function buildDeploymentChecks(
  row: BackendExecutionReadinessRow,
  handlerRequests: AdminActionRequest[],
): TrustedHandlerDeploymentCheck[] {
  const activeRequestCount = handlerRequests.filter(request => request.status === 'Queued' || request.status === 'Approved' || request.status === 'Running').length
  const completedRequestCount = handlerRequests.filter(request => request.status === 'Completed').length
  const readinessBlocked = row.status === 'Blocked'

  return [
    deploymentCheck(
      'readiness',
      'Release',
      'Execution readiness accepted',
      readinessBlocked ? 'Blocked' : row.status === 'Verified' ? 'Verified' : row.status === 'Review Only' ? 'Review' : 'Ready',
      true,
      `${row.handlerLabel} execution readiness is ${row.status}.`,
      'Do not start production handler work until execution readiness blockers are resolved.',
    ),
    deploymentCheck(
      'route',
      'Execution',
      'Trusted server route',
      row.endpointConfigured ? 'Ready' : 'Review',
      true,
      row.endpointConfigured ? `${row.method} ${row.endpoint} is mapped to the trusted endpoint contract.` : 'Trusted server endpoint is not configured yet.',
      'Create the server route and keep browser controls limited to queue/review/export.',
    ),
    deploymentCheck(
      'secret-boundary',
      'Security',
      'Secret-key boundary',
      readinessBlocked ? 'Blocked' : 'Ready',
      true,
      'Service-role credentials and mutation authority must remain server-side only.',
      'Never expose service credentials or mutation authority to the Platform Admin browser bundle.',
    ),
    deploymentCheck(
      'permission-middleware',
      'Security',
      'Permission middleware',
      row.blockerCount ? 'Blocked' : 'Ready',
      true,
      `${row.permission} must be checked before handler execution.`,
      'Use centralized permission checks and record denied attempts in audit logs.',
    ),
    deploymentCheck(
      'tenant-scope',
      'Security',
      'Tenant scope validation',
      row.blockerCount ? 'Blocked' : 'Ready',
      true,
      'Handler must validate organization, property, venue, and actor scope before touching shared data.',
      'Do not weaken customer-facing RLS policies; cross-tenant access must be explicit and auditable.',
    ),
    deploymentCheck(
      'payload-validation',
      'Execution',
      'Payload validation',
      row.reviewCount ? 'Review' : 'Ready',
      true,
      'Server route must reject malformed payloads before permissioned work begins.',
      'Validate request schema, required identifiers, reason, rollback notes, and correlation metadata.',
    ),
    deploymentCheck(
      'idempotency',
      'Execution',
      'Idempotency store',
      row.idempotencyRequired && !row.passedDryRunCount ? 'Review' : 'Ready',
      row.idempotencyRequired,
      row.idempotencyRequired ? 'Duplicate submissions must be guarded by a server-side idempotency key.' : 'Idempotency is optional for this handler class unless it becomes production-changing.',
      'Persist idempotency key, request hash, actor, and outcome for retry-safe execution.',
    ),
    deploymentCheck(
      'dry-run-mode',
      'Execution',
      'Dry-run mode',
      row.dryRunRequired && !row.passedDryRunCount ? 'Review' : row.passedDryRunCount ? 'Verified' : 'Ready',
      row.dryRunRequired,
      row.dryRunRequired ? `${row.passedDryRunCount} passing dry-run proof record${row.passedDryRunCount === 1 ? '' : 's'} attached.` : 'Dry-run is optional for this handler class.',
      'Keep dry-run available after launch for support-safe previews and diagnostics.',
    ),
    deploymentCheck(
      'audit-writer',
      'Audit',
      'Immutable audit writer',
      row.auditBacked || row.auditEventCount ? 'Verified' : 'Review',
      true,
      row.auditBacked || row.auditEventCount ? `${row.auditEventCount} matching audit event${row.auditEventCount === 1 ? '' : 's'} found.` : 'Audit evidence is not yet attached.',
      'Write actor, role, permission, handler key, scope, mutationApplied, rollback reference, and correlationId.',
    ),
    deploymentCheck(
      'rollback',
      'Rollback',
      'Rollback path',
      row.rollbackPlan ? 'Ready' : 'Blocked',
      true,
      row.rollbackPlan || 'No rollback plan is attached.',
      'Attach rollback notes, reversal owner, recovery steps, and affected data scope.',
    ),
    deploymentCheck(
      'release-toggle',
      'Release',
      'Release toggle',
      activeRequestCount || completedRequestCount ? 'Ready' : 'Review',
      true,
      activeRequestCount || completedRequestCount ? `${activeRequestCount + completedRequestCount} action request${activeRequestCount + completedRequestCount === 1 ? '' : 's'} can anchor rollout review.` : 'No queued or completed action request is available for rollout anchoring.',
      'Ship behind internal allowlist or feature flag and require owner approval before enabling production mutation.',
    ),
    deploymentCheck(
      'monitoring',
      'Operations',
      'Monitoring and alerting',
      row.auditEventCount || row.passedDryRunCount ? 'Ready' : 'Review',
      true,
      'Operations needs visible status, failures, duration, and rollback references for each handler.',
      'Add structured logs, metrics, failure notices, and support-visible activity when a handler runs.',
    ),
  ]
}

function deploymentCheck(
  id: string,
  category: TrustedHandlerDeploymentCheckCategory,
  label: string,
  status: TrustedHandlerDeploymentCheckStatus,
  required: boolean,
  detail: string,
  implementationNote: string,
): TrustedHandlerDeploymentCheck {
  return { id, category, label, status, required, detail, implementationNote }
}

function withLatestRecord(
  item: TrustedHandlerDeploymentItem,
  record: TrustedHandlerDeploymentRecord | undefined,
): TrustedHandlerDeploymentItem {
  if (!record) return item
  return {
    ...item,
    status: record.status,
    engineeringOwner: record.owner,
    note: record.note,
    auditEventId: record.auditEventId,
    reviewedAt: record.recordedAt,
    reviewedByRole: record.recordedByRole,
  }
}

function buildOwnerGroups(items: TrustedHandlerDeploymentItem[]): TrustedHandlerDeploymentOwnerGroup[] {
  const owners = Array.from(new Set(items.map(item => item.engineeringOwner)))
  return owners.map(owner => {
    const ownerItems = items.filter(item => item.engineeringOwner === owner)
    const blocked = ownerItems.filter(item => item.status === 'Blocked').length
    const needsBuildPlan = ownerItems.filter(item => item.status === 'Needs Build Plan').length
    const readyForBuild = ownerItems.filter(item => item.status === 'Ready For Build').length
    const buildQueued = ownerItems.filter(item => item.status === 'Build Queued').length
    const releaseCandidate = ownerItems.filter(item => item.status === 'Release Candidate').length
    const verified = ownerItems.filter(item => item.status === 'Verified').length
    return {
      owner,
      total: ownerItems.length,
      blocked,
      needsBuildPlan,
      readyForBuild,
      buildQueued,
      releaseCandidate,
      verified,
      criticalCount: ownerItems.filter(item => item.risk === 'Critical' && item.status !== 'Verified').length,
      nextStep: blocked
        ? 'Clear blocked deployment checklist items.'
        : needsBuildPlan
          ? 'Write missing server build plans.'
          : readyForBuild
            ? 'Queue server implementation work.'
            : buildQueued
              ? 'Monitor queued build work.'
              : releaseCandidate
                ? 'Collect release approval and verification evidence.'
                : 'Monitor verified deployment checklists.',
    }
  }).sort((a, b) => b.blocked - a.blocked || b.needsBuildPlan - a.needsBuildPlan || b.readyForBuild - a.readyForBuild || a.owner.localeCompare(b.owner))
}

function buildCategoryGroups(items: TrustedHandlerDeploymentItem[]): TrustedHandlerDeploymentCategoryGroup[] {
  const checks = items.flatMap(item => item.checks)
  const categories = Array.from(new Set(checks.map(check => check.category)))
  return categories.map(category => {
    const categoryChecks = checks.filter(check => check.category === category)
    const blocked = categoryChecks.filter(check => check.status === 'Blocked').length
    const review = categoryChecks.filter(check => check.status === 'Review').length
    const ready = categoryChecks.filter(check => check.status === 'Ready').length
    const verified = categoryChecks.filter(check => check.status === 'Verified').length
    return {
      category,
      total: categoryChecks.length,
      blocked,
      review,
      ready,
      verified,
      requiredCount: categoryChecks.filter(check => check.required).length,
      nextStep: blocked
        ? `Clear blocked ${category.toLowerCase()} checks.`
        : review
          ? `Review ${category.toLowerCase()} implementation gaps.`
          : ready
            ? `Queue ${category.toLowerCase()} checks for build verification.`
            : `Monitor verified ${category.toLowerCase()} checks.`,
    }
  }).sort((a, b) => b.blocked - a.blocked || b.review - a.review || a.category.localeCompare(b.category))
}

function getRecommendedStatus(
  row: BackendExecutionReadinessRow,
  blockerCount: number,
  reviewCount: number,
  handlerRequestCount: number,
): TrustedHandlerDeploymentStatus {
  if (row.status === 'Blocked' || blockerCount) return 'Blocked'
  if (row.status === 'Verified') return 'Release Candidate'
  if (row.status === 'Execution Queued' || handlerRequestCount) return 'Build Queued'
  if (row.status === 'Ready For Server' && !reviewCount) return 'Ready For Build'
  return 'Needs Build Plan'
}

function getAggregateStatus(items: TrustedHandlerDeploymentItem[]): TrustedHandlerDeploymentStatus {
  if (!items.length) return 'Verified'
  if (items.some(item => item.status === 'Blocked')) return 'Blocked'
  if (items.some(item => item.status === 'Needs Build Plan')) return 'Needs Build Plan'
  if (items.some(item => item.status === 'Ready For Build')) return 'Ready For Build'
  if (items.some(item => item.status === 'Build Queued')) return 'Build Queued'
  if (items.some(item => item.status === 'Release Candidate')) return 'Release Candidate'
  return 'Verified'
}

function getChecklistSummary(
  status: TrustedHandlerDeploymentStatus,
  blockedCount: number,
  needsBuildPlanCount: number,
  readyForBuildCount: number,
  buildQueuedCount: number,
  releaseCandidateCount: number,
  verifiedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} trusted handler checklist${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Needs Build Plan') return `${needsBuildPlanCount} handler${needsBuildPlanCount === 1 ? '' : 's'} need server build plans.`
  if (status === 'Ready For Build') return `${readyForBuildCount} handler${readyForBuildCount === 1 ? '' : 's'} are ready for server build.`
  if (status === 'Build Queued') return `${buildQueuedCount} handler${buildQueuedCount === 1 ? '' : 's'} are queued for build.`
  if (status === 'Release Candidate') return `${releaseCandidateCount} handler${releaseCandidateCount === 1 ? '' : 's'} are release candidates.`
  return `${verifiedCount} trusted handler checklist${verifiedCount === 1 ? '' : 's'} are verified.`
}

function getNextStep(
  status: TrustedHandlerDeploymentStatus,
  handlerLabel: string,
  blockerCount: number,
  reviewCount: number,
) {
  if (status === 'Blocked') return `Clear ${blockerCount} blocked check${blockerCount === 1 ? '' : 's'} before ${handlerLabel} can move to build.`
  if (status === 'Needs Build Plan') return `Resolve ${reviewCount} review check${reviewCount === 1 ? '' : 's'} and complete the server build plan.`
  if (status === 'Ready For Build') return `Queue ${handlerLabel} for server implementation work.`
  if (status === 'Build Queued') return `${handlerLabel} is queued for trusted handler build review.`
  if (status === 'Release Candidate') return `Collect owner release approval and final verification for ${handlerLabel}.`
  return `${handlerLabel} trusted handler deployment checklist is verified.`
}

function defaultDeploymentRecordNote(
  status: TrustedHandlerDeploymentStatus,
  item: TrustedHandlerDeploymentItem,
) {
  if (status === 'Verified') return `${item.handlerLabel} trusted handler deployment checklist verified.`
  if (status === 'Release Candidate') return `${item.handlerLabel} is ready for release candidate review.`
  if (status === 'Build Queued') return `${item.handlerLabel} server build work queued.`
  if (status === 'Ready For Build') return `${item.handlerLabel} ready for trusted server build.`
  if (status === 'Needs Build Plan') return `${item.handlerLabel} needs a server build plan.`
  return `${item.handlerLabel} deployment checklist remains blocked.`
}

function getLatestRecordByItem(records: TrustedHandlerDeploymentRecord[]) {
  const latestRecordByItem = new Map<string, TrustedHandlerDeploymentRecord>()
  records.forEach(record => {
    if (!latestRecordByItem.has(record.itemId)) latestRecordByItem.set(record.itemId, record)
  })
  return latestRecordByItem
}

function getItemId(row: BackendExecutionReadinessRow) {
  return `trusted-handler-deployment-${row.id}`
}

function statusRank(status: TrustedHandlerDeploymentStatus) {
  if (status === 'Blocked') return 6
  if (status === 'Needs Build Plan') return 5
  if (status === 'Ready For Build') return 4
  if (status === 'Build Queued') return 3
  if (status === 'Release Candidate') return 2
  return 1
}

function priorityRank(priority: BackendImplementationPriority) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function emitTrustedHandlerDeploymentRecordChange() {
  listeners.forEach(listener => listener())
}
