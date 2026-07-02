import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  BackendImplementationPriority,
  BackendImplementationWorkbench,
  BackendImplementationWorkItem,
} from './backendImplementationWorkbench'

export type BackendHandlerSpecStatus = 'Blocked' | 'Draft' | 'Needs Review' | 'Ready For Engineering' | 'Approved'
export type BackendHandlerSpecGateStatus = 'Ready' | 'Review' | 'Blocked'
export type BackendHandlerSpecMutationMode = 'Review Only' | 'Server Mutation Candidate' | 'Server Mutation Blocked'
export type BackendHandlerSpecMethod = 'POST'

export interface BackendHandlerSpecField {
  name: string
  type: string
  required: boolean
  description: string
}

export interface BackendHandlerSpecGate {
  id: string
  label: string
  status: BackendHandlerSpecGateStatus
  detail: string
}

export interface BackendHandlerSpec {
  id: string
  workItemId: string
  matrixRowId: string
  title: string
  status: BackendHandlerSpecStatus
  recommendedStatus: BackendHandlerSpecStatus
  risk: BackendImplementationPriority
  owner: string
  handlerKey: string
  handlerLabel: string
  permission: 'admin_actions.manage'
  method: BackendHandlerSpecMethod
  endpoint: string
  scope: string
  mutationMode: BackendHandlerSpecMutationMode
  humanConfirmationRequired: boolean
  dryRunRequired: boolean
  idempotencyRequired: boolean
  requestFields: BackendHandlerSpecField[]
  responseFields: BackendHandlerSpecField[]
  auditFields: BackendHandlerSpecField[]
  approvalGates: BackendHandlerSpecGate[]
  rollbackPlan: string
  executionBoundary: string
  acceptanceSummary: string
  generatedAt: string
  auditBacked: boolean
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendHandlerSpecRegister {
  status: BackendHandlerSpecStatus
  summary: string
  generatedAt: string
  specs: BackendHandlerSpec[]
  nextSpec?: BackendHandlerSpec
  totalCount: number
  blockedCount: number
  draftCount: number
  needsReviewCount: number
  readyCount: number
  approvedCount: number
  criticalCount: number
  auditBackedCount: number
}

export interface BackendHandlerSpecReview {
  id: string
  specId: string
  status: BackendHandlerSpecStatus
  owner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendHandlerSpecRegisterInput {
  workbench: BackendImplementationWorkbench
  reviews: BackendHandlerSpecReview[]
}

interface SaveBackendHandlerSpecReviewInput {
  spec: BackendHandlerSpec
  status: BackendHandlerSpecStatus
  owner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_handler_spec_reviews'
const listeners = new Set<() => void>()
let cachedRawReviews = ''
let cachedReviews: BackendHandlerSpecReview[] = []

export const backendHandlerSpecBoundaryRule =
  'Backend handler specs are generated implementation plans only. They do not create endpoints, deploy code, execute mutations, change customer state, change billing, alter modules, change permissions, impersonate users, or run agent actions.'

export const backendHandlerSpecStatuses: BackendHandlerSpecStatus[] = [
  'Blocked',
  'Draft',
  'Needs Review',
  'Ready For Engineering',
  'Approved',
]

export function buildBackendHandlerSpecRegister({
  workbench,
  reviews,
}: BuildBackendHandlerSpecRegisterInput): BackendHandlerSpecRegister {
  const generatedAt = new Date().toISOString()
  const latestReviewBySpec = getLatestReviewBySpec(reviews)
  const specs = workbench.items
    .map(item => withLatestReview(createHandlerSpec(item, generatedAt), latestReviewBySpec.get(getHandlerSpecId(item))))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerKey.localeCompare(b.handlerKey))
  const openSpecs = specs.filter(spec => spec.status !== 'Approved')
  const blockedCount = specs.filter(spec => spec.status === 'Blocked').length
  const draftCount = specs.filter(spec => spec.status === 'Draft').length
  const needsReviewCount = specs.filter(spec => spec.status === 'Needs Review').length
  const readyCount = specs.filter(spec => spec.status === 'Ready For Engineering').length
  const approvedCount = specs.filter(spec => spec.status === 'Approved').length
  const status: BackendHandlerSpecStatus = blockedCount
    ? 'Blocked'
    : needsReviewCount
      ? 'Needs Review'
      : draftCount
        ? 'Draft'
        : readyCount
          ? 'Ready For Engineering'
          : 'Approved'

  return {
    status,
    summary: getSpecRegisterSummary(status, blockedCount, needsReviewCount, draftCount, readyCount, approvedCount),
    generatedAt,
    specs,
    nextSpec: openSpecs[0],
    totalCount: specs.length,
    blockedCount,
    draftCount,
    needsReviewCount,
    readyCount,
    approvedCount,
    criticalCount: openSpecs.filter(spec => spec.risk === 'Critical').length,
    auditBackedCount: specs.filter(spec => spec.auditBacked).length,
  }
}

export function getBackendHandlerSpecReviews(): BackendHandlerSpecReview[] {
  if (typeof localStorage === 'undefined') return []
  const rawReviews = localStorage.getItem(storageKey) ?? '[]'
  if (rawReviews === cachedRawReviews) return cachedReviews

  try {
    cachedRawReviews = rawReviews
    cachedReviews = JSON.parse(rawReviews) as BackendHandlerSpecReview[]
    return cachedReviews
  } catch {
    cachedRawReviews = rawReviews
    cachedReviews = []
    return []
  }
}

export function saveBackendHandlerSpecReview(input: SaveBackendHandlerSpecReviewInput) {
  const review: BackendHandlerSpecReview = {
    id: crypto.randomUUID(),
    specId: input.spec.id,
    status: input.status,
    owner: input.owner,
    note: input.note.trim() || defaultHandlerSpecNote(input.status, input.spec),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const reviews = [review, ...getBackendHandlerSpecReviews()].slice(0, 160)

  cachedReviews = reviews
  cachedRawReviews = JSON.stringify(reviews)
  localStorage.setItem(storageKey, cachedRawReviews)
  emitBackendHandlerSpecReviewChange()
  return review
}

export function subscribeToBackendHandlerSpecReviews(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendHandlerSpecReviews() {
  return useSyncExternalStore(subscribeToBackendHandlerSpecReviews, getBackendHandlerSpecReviews, () => [])
}

export function getBackendHandlerSpecStatusTone(status: BackendHandlerSpecStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Approved' || status === 'Ready For Engineering') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Review') return 'warn'
  return 'neutral'
}

export function getBackendHandlerSpecRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendHandlerSpecGateTone(status: BackendHandlerSpecGateStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  return 'warn'
}

export function getBackendHandlerSpecFilename(spec: BackendHandlerSpec) {
  return `backend-handler-spec-${spec.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendHandlerSpecHtml(spec: BackendHandlerSpec, session: AdminSession) {
  const fieldRows = (fields: BackendHandlerSpecField[]) => fields.map(field => `
    <tr>
      <td><code>${escapeHtml(field.name)}</code></td>
      <td>${escapeHtml(field.type)}</td>
      <td>${field.required ? 'Required' : 'Optional'}</td>
      <td>${escapeHtml(field.description)}</td>
    </tr>
  `).join('')
  const gateRows = spec.approvalGates.map(gate => `
    <tr>
      <td>${escapeHtml(gate.label)}</td>
      <td>${escapeHtml(gate.status)}</td>
      <td>${escapeHtml(gate.detail)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(spec.title)}</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1040px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
      h2 { font-size: 17px; }
      p { line-height: 1.55; }
      .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .meta div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .meta span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
      .meta strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      code { color: #0f766e; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>Happy Chair Platform Admin / Backend Handler Spec</p>
        <h1>${escapeHtml(spec.title)}</h1>
        <p>${escapeHtml(backendHandlerSpecBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(spec.status)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(spec.risk)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(spec.owner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(spec.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(spec.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${spec.method} ${spec.endpoint}`)}</strong></div>
      </section>
      <section>
        <h2>Request Shape</h2>
        <table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${fieldRows(spec.requestFields)}</tbody></table>
      </section>
      <section>
        <h2>Response Shape</h2>
        <table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${fieldRows(spec.responseFields)}</tbody></table>
      </section>
      <section>
        <h2>Audit Fields</h2>
        <table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${fieldRows(spec.auditFields)}</tbody></table>
      </section>
      <section>
        <h2>Approval Gates</h2>
        <table><thead><tr><th>Gate</th><th>Status</th><th>Detail</th></tr></thead><tbody>${gateRows}</tbody></table>
      </section>
      <section>
        <h2>Rollback And Boundary</h2>
        <p><strong>Rollback:</strong> ${escapeHtml(spec.rollbackPlan)}</p>
        <p><strong>Boundary:</strong> ${escapeHtml(spec.executionBoundary)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createHandlerSpec(item: BackendImplementationWorkItem, generatedAt: string): BackendHandlerSpec {
  const approvalGates = buildApprovalGates(item)
  const recommendedStatus = getRecommendedSpecStatus(item, approvalGates)

  return {
    id: getHandlerSpecId(item),
    workItemId: item.id,
    matrixRowId: item.matrixRowId,
    title: `${item.handlerLabel} handler spec`,
    status: recommendedStatus,
    recommendedStatus,
    risk: item.priority,
    owner: item.owner,
    handlerKey: item.handlerKey,
    handlerLabel: item.handlerLabel,
    permission: 'admin_actions.manage',
    method: 'POST',
    endpoint: `/api/platform-admin/actions/${item.handlerKey.replace(/\./g, '/')}`,
    scope: item.scope,
    mutationMode: getMutationMode(item, approvalGates),
    humanConfirmationRequired: true,
    dryRunRequired: item.type !== 'Audit',
    idempotencyRequired: true,
    requestFields: buildRequestFields(item),
    responseFields: buildResponseFields(item),
    auditFields: buildAuditFields(item),
    approvalGates,
    rollbackPlan: item.rollbackRequirement,
    executionBoundary: `${item.auditRequirement} Browser-side Platform Admin screens may only generate, review, and queue this spec; trusted server code must perform any production-changing work.`,
    acceptanceSummary: getAcceptanceSummary(approvalGates),
    generatedAt,
    auditBacked: false,
  }
}

function withLatestReview(
  spec: BackendHandlerSpec,
  review: BackendHandlerSpecReview | undefined,
): BackendHandlerSpec {
  if (!review) return spec
  return {
    ...spec,
    status: review.status,
    owner: review.owner,
    note: review.note,
    auditEventId: review.auditEventId,
    reviewedAt: review.recordedAt,
    reviewedByRole: review.recordedByRole,
    auditBacked: true,
  }
}

function buildApprovalGates(item: BackendImplementationWorkItem): BackendHandlerSpecGate[] {
  return [
    ...item.acceptanceChecks.map(check => ({
      id: check.id,
      label: check.label,
      status: check.status === 'Ready' ? 'Ready' as const : check.status === 'Blocked' ? 'Blocked' as const : 'Review' as const,
      detail: check.detail,
    })),
    {
      id: `${item.id}_human_confirmation`,
      label: 'Human confirmation',
      status: 'Ready',
      detail: 'Production-changing execution requires explicit human confirmation before the trusted server handler runs.',
    },
    {
      id: `${item.id}_idempotency`,
      label: 'Idempotency key',
      status: 'Ready',
      detail: 'Handler request must include an idempotency key so duplicate submissions do not repeat production work.',
    },
    {
      id: `${item.id}_rollback_plan`,
      label: 'Rollback plan',
      status: item.rollbackRequirement.length >= 24 ? 'Ready' : 'Review',
      detail: item.rollbackRequirement,
    },
  ]
}

function buildRequestFields(item: BackendImplementationWorkItem): BackendHandlerSpecField[] {
  return [
    field('handlerKey', 'string', true, `Must equal ${item.handlerKey}.`),
    field('scope', 'object', true, `Scoped to ${item.scope}.`),
    field('actor', '{ id: string; email: string; role: string }', true, 'Server-resolved internal admin actor.'),
    field('permission', 'string', true, 'Required permission: admin_actions.manage.'),
    field('reason', 'string', true, item.nextStep),
    field('evidenceRefs', 'string[]', true, 'Matrix, workbench, dry-run, approval, audit, and rollback evidence references.'),
    field('rollbackPlan', 'string', true, item.rollbackRequirement),
    field('idempotencyKey', 'string', true, 'Unique key supplied by the caller or generated server-side before execution.'),
    field('dryRun', 'boolean', true, 'When true, validates payload and records evidence without applying mutation.'),
    field('humanConfirmedAt', 'string | null', true, 'Timestamp for required human confirmation; null for review-only dry runs.'),
    field('payload', 'Record<string, unknown>', true, getPayloadDescription(item)),
  ]
}

function buildResponseFields(item: BackendImplementationWorkItem): BackendHandlerSpecField[] {
  return [
    field('ok', 'boolean', true, 'Whether the trusted server handler accepted the request.'),
    field('requestId', 'string', true, 'Server action request or implementation work identifier.'),
    field('handlerKey', 'string', true, `Echoes ${item.handlerKey}.`),
    field('status', '"dry_run" | "queued" | "blocked" | "executed"', true, 'Final server-side handling state.'),
    field('auditEventId', 'string', true, 'Immutable audit event written by the server path.'),
    field('mutationApplied', 'boolean', true, 'False for dry runs and review-only handlers; true only after trusted confirmed execution.'),
    field('rollbackReference', 'string | null', true, 'Reference to rollback plan, rollback action, or null when no mutation occurred.'),
    field('evidenceSummary', 'string', true, item.evidence),
  ]
}

function buildAuditFields(item: BackendImplementationWorkItem): BackendHandlerSpecField[] {
  return [
    field('actor', 'string', true, 'Internal admin actor name.'),
    field('actorEmail', 'string', true, 'Internal admin actor email.'),
    field('actorRole', 'string', true, 'Internal admin actor role label.'),
    field('scope', 'string', true, item.scope),
    field('actionKey', 'string', true, `server_handler.${item.handlerKey}.executed`),
    field('permission', 'string', true, 'admin_actions.manage'),
    field('outcome', '"allowed" | "blocked" | "recorded"', true, 'Audit outcome for permission and execution guardrail.'),
    field('metadata.handlerKey', 'string', true, item.handlerKey),
    field('metadata.matrixRowId', 'string', true, item.matrixRowId),
    field('metadata.mutationApplied', 'boolean', true, 'Must be false until trusted server execution applies an approved mutation.'),
    field('metadata.productionWritePath', 'string', true, 'server_action_required'),
    field('metadata.rollbackPlan', 'string', true, item.rollbackRequirement),
  ]
}

function field(
  name: string,
  type: string,
  required: boolean,
  description: string,
): BackendHandlerSpecField {
  return { name, type, required, description }
}

function getHandlerSpecId(item: BackendImplementationWorkItem) {
  return `backend-handler-spec-${item.id}`
}

function getRecommendedSpecStatus(
  item: BackendImplementationWorkItem,
  gates: BackendHandlerSpecGate[],
): BackendHandlerSpecStatus {
  if (gates.some(gate => gate.status === 'Blocked') || item.status === 'Blocked') return 'Blocked'
  if (item.status === 'Ready For Build' || item.status === 'Complete') {
    return gates.some(gate => gate.status === 'Review') ? 'Needs Review' : 'Ready For Engineering'
  }
  if (item.status === 'In Review') return 'Needs Review'
  return 'Draft'
}

function getMutationMode(
  item: BackendImplementationWorkItem,
  gates: BackendHandlerSpecGate[],
): BackendHandlerSpecMutationMode {
  if (item.status === 'Blocked' || gates.some(gate => gate.status === 'Blocked')) return 'Server Mutation Blocked'
  if (item.type === 'Audit' || item.type === 'Evidence') return 'Review Only'
  return 'Server Mutation Candidate'
}

function getPayloadDescription(item: BackendImplementationWorkItem) {
  if (item.type === 'Safety') return 'Safety-control payload. Must never bypass browser mutation boundary, rollback proof, or confirmation requirements.'
  if (item.type === 'Handler') return 'Server adapter payload. Must reference the contract, dry-run evidence, and requested mutation scope.'
  if (item.type === 'Audit') return 'Audit review payload. Must append evidence rather than rewrite historical audit records.'
  if (item.type === 'Evidence') return 'Evidence-linking payload. Must preserve immutable history and attach dry-run or approval references.'
  return 'Governance payload. Must include owner, approval, and readiness evidence before execution.'
}

function getAcceptanceSummary(gates: BackendHandlerSpecGate[]) {
  const blocked = gates.filter(gate => gate.status === 'Blocked').length
  const review = gates.filter(gate => gate.status === 'Review').length
  if (blocked) return `${blocked} blocked gate${blocked === 1 ? '' : 's'} must clear before engineering can wire this handler.`
  if (review) return `${review} gate${review === 1 ? '' : 's'} need review before engineering handoff.`
  return 'All generated gates are ready for engineering review.'
}

function getLatestReviewBySpec(reviews: BackendHandlerSpecReview[]) {
  const latestReviewBySpec = new Map<string, BackendHandlerSpecReview>()
  reviews.forEach(review => {
    if (!latestReviewBySpec.has(review.specId)) latestReviewBySpec.set(review.specId, review)
  })
  return latestReviewBySpec
}

function getSpecRegisterSummary(
  status: BackendHandlerSpecStatus,
  blockedCount: number,
  needsReviewCount: number,
  draftCount: number,
  readyCount: number,
  approvedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} handler spec${blockedCount === 1 ? '' : 's'} are blocked by safety or evidence gates.`
  if (status === 'Needs Review') return `${needsReviewCount} handler spec${needsReviewCount === 1 ? '' : 's'} need owner or engineering review.`
  if (status === 'Draft') return `${draftCount} handler spec${draftCount === 1 ? '' : 's'} are drafted from implementation work.`
  if (status === 'Ready For Engineering') return `${readyCount} handler spec${readyCount === 1 ? '' : 's'} are ready for trusted server implementation.`
  return `${approvedCount} handler spec${approvedCount === 1 ? '' : 's'} have approval evidence.`
}

function defaultHandlerSpecNote(status: BackendHandlerSpecStatus, spec: BackendHandlerSpec) {
  if (status === 'Approved') return `${spec.handlerLabel} spec approved for engineering handoff with current guardrails.`
  if (status === 'Ready For Engineering') return `${spec.handlerLabel} spec marked ready for trusted server implementation.`
  if (status === 'Needs Review') return `${spec.handlerLabel} spec needs review before engineering handoff.`
  if (status === 'Blocked') return `${spec.handlerLabel} spec remains blocked by acceptance or safety gates.`
  return `${spec.handlerLabel} spec returned to draft for additional scoping.`
}

function statusRank(status: BackendHandlerSpecStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Needs Review') return 4
  if (status === 'Draft') return 3
  if (status === 'Ready For Engineering') return 2
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

function emitBackendHandlerSpecReviewChange() {
  listeners.forEach(listener => listener())
}
