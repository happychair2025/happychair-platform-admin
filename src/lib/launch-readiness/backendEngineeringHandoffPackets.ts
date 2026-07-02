import { useSyncExternalStore } from 'react'
import type { AdminSession } from '../../App'
import type {
  BackendHandlerSpec,
  BackendHandlerSpecRegister,
} from './backendHandlerSpecs'
import type {
  BackendHandlerReadinessBoard,
  BackendHandlerReadinessCard,
} from './backendHandlerReadinessBoard'
import type { BackendImplementationPriority } from './backendImplementationWorkbench'

export type BackendEngineeringHandoffPacketStatus = 'Blocked' | 'Draft' | 'Review' | 'Ready For Handoff' | 'Accepted'
export type BackendEngineeringChecklistStatus = 'Ready' | 'Review' | 'Blocked'

export interface BackendEngineeringChecklistItem {
  id: string
  label: string
  status: BackendEngineeringChecklistStatus
  detail: string
}

export interface BackendEngineeringHandoffPacket {
  id: string
  specId: string
  readinessCardId: string
  title: string
  status: BackendEngineeringHandoffPacketStatus
  recommendedStatus: BackendEngineeringHandoffPacketStatus
  risk: BackendImplementationPriority
  productOwner: string
  engineeringOwner: string
  handlerKey: string
  handlerLabel: string
  method: string
  endpoint: string
  permission: string
  mutationMode: string
  handoffSummary: string
  implementationSteps: string[]
  testChecklist: BackendEngineeringChecklistItem[]
  launchAcceptanceCriteria: BackendEngineeringChecklistItem[]
  evidenceRefs: string[]
  rollbackPlan: string
  auditPlan: string
  dryRunRequired: boolean
  humanConfirmationRequired: boolean
  idempotencyRequired: boolean
  blockerCount: number
  reviewGateCount: number
  readyGateCount: number
  generatedAt: string
  auditBacked: boolean
  reviewedAt?: string
  reviewedByRole?: string
  note?: string
  auditEventId?: string
}

export interface BackendEngineeringHandoffRegister {
  status: BackendEngineeringHandoffPacketStatus
  summary: string
  generatedAt: string
  packets: BackendEngineeringHandoffPacket[]
  nextPacket?: BackendEngineeringHandoffPacket
  totalCount: number
  blockedCount: number
  draftCount: number
  reviewCount: number
  readyCount: number
  acceptedCount: number
  criticalCount: number
  auditBackedCount: number
}

export interface BackendEngineeringHandoffPacketReview {
  id: string
  packetId: string
  status: BackendEngineeringHandoffPacketStatus
  engineeringOwner: string
  note: string
  auditEventId: string
  recordedBy: string
  recordedByEmail: string
  recordedByRole: string
  recordedAt: string
}

interface BuildBackendEngineeringHandoffRegisterInput {
  specRegister: BackendHandlerSpecRegister
  readinessBoard: BackendHandlerReadinessBoard
  reviews: BackendEngineeringHandoffPacketReview[]
}

interface SaveBackendEngineeringHandoffPacketReviewInput {
  packet: BackendEngineeringHandoffPacket
  status: BackendEngineeringHandoffPacketStatus
  engineeringOwner: string
  note: string
  session: AdminSession
  actorRole: string
  auditEventId: string
}

const storageKey = 'hc_platform_launch_backend_engineering_handoff_reviews'
const listeners = new Set<() => void>()
let cachedRawReviews = ''
let cachedReviews: BackendEngineeringHandoffPacketReview[] = []

export const backendEngineeringHandoffPacketBoundaryRule =
  'Engineering handoff packets are implementation planning artifacts only. They do not deploy code, create endpoints, execute handlers, mutate production data, change billing, alter modules, change permissions, impersonate users, or run agent actions.'

export const backendEngineeringHandoffPacketStatuses: BackendEngineeringHandoffPacketStatus[] = [
  'Blocked',
  'Draft',
  'Review',
  'Ready For Handoff',
  'Accepted',
]

export function buildBackendEngineeringHandoffRegister({
  specRegister,
  readinessBoard,
  reviews,
}: BuildBackendEngineeringHandoffRegisterInput): BackendEngineeringHandoffRegister {
  const generatedAt = new Date().toISOString()
  const specById = new Map(specRegister.specs.map(spec => [spec.id, spec]))
  const latestReviewByPacket = getLatestReviewByPacket(reviews)
  const packets = readinessBoard.cards
    .map(card => {
      const spec = specById.get(card.specId)
      return spec ? withLatestReview(createPacket(card, spec, generatedAt), latestReviewByPacket.get(getPacketId(card))) : undefined
    })
    .filter((packet): packet is BackendEngineeringHandoffPacket => Boolean(packet))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || priorityRank(b.risk) - priorityRank(a.risk) || a.handlerLabel.localeCompare(b.handlerLabel))
  const openPackets = packets.filter(packet => packet.status !== 'Accepted')
  const blockedCount = packets.filter(packet => packet.status === 'Blocked').length
  const draftCount = packets.filter(packet => packet.status === 'Draft').length
  const reviewCount = packets.filter(packet => packet.status === 'Review').length
  const readyCount = packets.filter(packet => packet.status === 'Ready For Handoff').length
  const acceptedCount = packets.filter(packet => packet.status === 'Accepted').length
  const status: BackendEngineeringHandoffPacketStatus = blockedCount
    ? 'Blocked'
    : reviewCount
      ? 'Review'
      : draftCount
        ? 'Draft'
        : readyCount
          ? 'Ready For Handoff'
          : 'Accepted'

  return {
    status,
    summary: getRegisterSummary(status, blockedCount, reviewCount, draftCount, readyCount, acceptedCount),
    generatedAt,
    packets,
    nextPacket: openPackets[0],
    totalCount: packets.length,
    blockedCount,
    draftCount,
    reviewCount,
    readyCount,
    acceptedCount,
    criticalCount: openPackets.filter(packet => packet.risk === 'Critical').length,
    auditBackedCount: packets.filter(packet => packet.auditBacked).length,
  }
}

export function getBackendEngineeringHandoffPacketReviews(): BackendEngineeringHandoffPacketReview[] {
  if (typeof localStorage === 'undefined') return []
  const rawReviews = localStorage.getItem(storageKey) ?? '[]'
  if (rawReviews === cachedRawReviews) return cachedReviews

  try {
    cachedRawReviews = rawReviews
    cachedReviews = JSON.parse(rawReviews) as BackendEngineeringHandoffPacketReview[]
    return cachedReviews
  } catch {
    cachedRawReviews = rawReviews
    cachedReviews = []
    return []
  }
}

export function saveBackendEngineeringHandoffPacketReview(input: SaveBackendEngineeringHandoffPacketReviewInput) {
  const review: BackendEngineeringHandoffPacketReview = {
    id: crypto.randomUUID(),
    packetId: input.packet.id,
    status: input.status,
    engineeringOwner: input.engineeringOwner,
    note: input.note.trim() || defaultPacketNote(input.status, input.packet),
    auditEventId: input.auditEventId,
    recordedBy: input.session.name,
    recordedByEmail: input.session.email,
    recordedByRole: input.actorRole,
    recordedAt: new Date().toISOString(),
  }
  const reviews = [review, ...getBackendEngineeringHandoffPacketReviews()].slice(0, 160)

  cachedReviews = reviews
  cachedRawReviews = JSON.stringify(reviews)
  localStorage.setItem(storageKey, cachedRawReviews)
  emitBackendEngineeringHandoffPacketReviewChange()
  return review
}

export function subscribeToBackendEngineeringHandoffPacketReviews(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useBackendEngineeringHandoffPacketReviews() {
  return useSyncExternalStore(subscribeToBackendEngineeringHandoffPacketReviews, getBackendEngineeringHandoffPacketReviews, () => [])
}

export function getBackendEngineeringHandoffPacketTone(status: BackendEngineeringHandoffPacketStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Accepted' || status === 'Ready For Handoff') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Review') return 'warn'
  return 'neutral'
}

export function getBackendEngineeringChecklistTone(status: BackendEngineeringChecklistStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'Ready') return 'ok'
  if (status === 'Blocked') return 'danger'
  return 'warn'
}

export function getBackendEngineeringHandoffPacketRiskTone(risk: BackendImplementationPriority): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High' || risk === 'Medium') return 'warn'
  return 'ok'
}

export function getBackendEngineeringHandoffPacketFilename(packet: BackendEngineeringHandoffPacket) {
  return `engineering-handoff-${packet.handlerKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
}

export function buildBackendEngineeringHandoffPacketHtml(packet: BackendEngineeringHandoffPacket, session: AdminSession) {
  const listItems = (items: string[]) => items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
  const checklistRows = (items: BackendEngineeringChecklistItem[]) => items.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.detail)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(packet.title)}</title>
    <style>
      body { margin: 0; padding: 32px; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; }
      main { max-width: 1040px; margin: 0 auto; display: grid; gap: 18px; }
      section { padding: 18px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
      h1, h2 { margin: 0; }
      h1 { font-size: 26px; }
      h2 { font-size: 17px; }
      p, li { line-height: 1.55; }
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
        <p>Happy Chair Platform Admin / Engineering Handoff Packet</p>
        <h1>${escapeHtml(packet.title)}</h1>
        <p>${escapeHtml(backendEngineeringHandoffPacketBoundaryRule)}</p>
      </section>
      <section class="meta">
        <div><span>Status</span><strong>${escapeHtml(packet.status)}</strong></div>
        <div><span>Risk</span><strong>${escapeHtml(packet.risk)}</strong></div>
        <div><span>Engineering Owner</span><strong>${escapeHtml(packet.engineeringOwner)}</strong></div>
        <div><span>Handler</span><strong>${escapeHtml(packet.handlerKey)}</strong></div>
        <div><span>Permission</span><strong>${escapeHtml(packet.permission)}</strong></div>
        <div><span>Endpoint</span><strong>${escapeHtml(`${packet.method} ${packet.endpoint}`)}</strong></div>
      </section>
      <section>
        <h2>Handoff Summary</h2>
        <p>${escapeHtml(packet.handoffSummary)}</p>
      </section>
      <section>
        <h2>Implementation Steps</h2>
        <ol>${listItems(packet.implementationSteps)}</ol>
      </section>
      <section>
        <h2>Test Checklist</h2>
        <table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${checklistRows(packet.testChecklist)}</tbody></table>
      </section>
      <section>
        <h2>Launch Acceptance Criteria</h2>
        <table><thead><tr><th>Criteria</th><th>Status</th><th>Detail</th></tr></thead><tbody>${checklistRows(packet.launchAcceptanceCriteria)}</tbody></table>
      </section>
      <section>
        <h2>Rollback And Audit</h2>
        <p><strong>Rollback:</strong> ${escapeHtml(packet.rollbackPlan)}</p>
        <p><strong>Audit:</strong> ${escapeHtml(packet.auditPlan)}</p>
        <p><strong>Generated by:</strong> ${escapeHtml(session.name)} / ${escapeHtml(session.email)}</p>
      </section>
    </main>
  </body>
</html>`
}

function createPacket(
  card: BackendHandlerReadinessCard,
  spec: BackendHandlerSpec,
  generatedAt: string,
): BackendEngineeringHandoffPacket {
  const recommendedStatus = getRecommendedPacketStatus(card, spec)
  const testChecklist = buildTestChecklist(card, spec)
  const launchAcceptanceCriteria = buildLaunchAcceptanceCriteria(card, spec)

  return {
    id: getPacketId(card),
    specId: spec.id,
    readinessCardId: card.id,
    title: `${spec.handlerLabel} engineering handoff`,
    status: recommendedStatus,
    recommendedStatus,
    risk: spec.risk,
    productOwner: spec.owner,
    engineeringOwner: 'Engineering',
    handlerKey: spec.handlerKey,
    handlerLabel: spec.handlerLabel,
    method: spec.method,
    endpoint: spec.endpoint,
    permission: spec.permission,
    mutationMode: spec.mutationMode,
    handoffSummary: `${spec.handlerLabel} is ${card.handoffStatus.toLowerCase()} with ${card.blockerCount} blocked gates, ${card.reviewGateCount} review gates, and ${card.readyGateCount}/${card.gateCount} ready gates.`,
    implementationSteps: [
      `Implement trusted server handler ${spec.handlerKey} at ${spec.method} ${spec.endpoint}.`,
      `Enforce ${spec.permission} server-side before any handler work continues.`,
      'Require idempotency key, dry-run support, and immutable audit event creation.',
      'Preserve browser mutation boundary: Platform Admin may review, queue, and export only.',
      'Attach rollback reference before any production-changing execution is enabled.',
    ],
    testChecklist,
    launchAcceptanceCriteria,
    evidenceRefs: [
      spec.id,
      spec.workItemId,
      spec.matrixRowId,
      card.id,
      spec.auditEventId ?? 'spec_review_pending',
    ],
    rollbackPlan: spec.rollbackPlan,
    auditPlan: `Write audit event server_handler.${spec.handlerKey}.executed with actor, permission, scope, outcome, mutationApplied, rollbackPlan, and productionWritePath=server_action_required.`,
    dryRunRequired: spec.dryRunRequired,
    humanConfirmationRequired: spec.humanConfirmationRequired,
    idempotencyRequired: spec.idempotencyRequired,
    blockerCount: card.blockerCount,
    reviewGateCount: card.reviewGateCount,
    readyGateCount: card.readyGateCount,
    generatedAt,
    auditBacked: spec.auditBacked || card.auditBacked,
  }
}

function withLatestReview(
  packet: BackendEngineeringHandoffPacket,
  review: BackendEngineeringHandoffPacketReview | undefined,
): BackendEngineeringHandoffPacket {
  if (!review) return packet
  return {
    ...packet,
    status: review.status,
    engineeringOwner: review.engineeringOwner,
    note: review.note,
    auditEventId: review.auditEventId,
    reviewedAt: review.recordedAt,
    reviewedByRole: review.recordedByRole,
    auditBacked: true,
  }
}

function buildTestChecklist(
  card: BackendHandlerReadinessCard,
  spec: BackendHandlerSpec,
): BackendEngineeringChecklistItem[] {
  return [
    item('permission_check', 'Server permission check', 'Ready', `Require ${spec.permission} before handler execution.`),
    item('idempotency', 'Idempotency coverage', spec.idempotencyRequired ? 'Ready' : 'Review', 'Handler must reject or dedupe duplicate submissions.'),
    item('dry_run', 'Dry-run path', spec.dryRunRequired ? 'Ready' : 'Review', spec.dryRunRequired ? 'Dry-run evidence is required before production execution.' : 'Confirm whether this review-only handler needs dry-run coverage.'),
    item('audit_log', 'Immutable audit log', 'Ready', `Audit metadata must include ${spec.handlerKey}, mutationApplied, rollbackPlan, and productionWritePath.`),
    item('blocked_gates', 'Blocked gates cleared', card.blockerCount ? 'Blocked' : 'Ready', `${card.blockerCount} blocked gate${card.blockerCount === 1 ? '' : 's'} attached to readiness card.`),
    item('review_gates', 'Review gates cleared', card.reviewGateCount ? 'Review' : 'Ready', `${card.reviewGateCount} review gate${card.reviewGateCount === 1 ? '' : 's'} attached to readiness card.`),
  ]
}

function buildLaunchAcceptanceCriteria(
  card: BackendHandlerReadinessCard,
  spec: BackendHandlerSpec,
): BackendEngineeringChecklistItem[] {
  return [
    item('owner_acceptance', 'Owner acceptance', spec.auditBacked ? 'Ready' : 'Review', spec.auditBacked ? 'Spec has audit-backed review evidence.' : 'Record spec review before final handoff.'),
    item('engineering_intake', 'Engineering intake', card.status === 'Ready' || card.status === 'Approved' ? 'Ready' : card.status === 'Blocked' ? 'Blocked' : 'Review', card.handoffStatus),
    item('rollback_acceptance', 'Rollback acceptance', spec.rollbackPlan.length >= 24 ? 'Ready' : 'Review', spec.rollbackPlan),
    item('browser_boundary', 'Browser mutation boundary', 'Ready', 'Platform Admin remains planning and review only.'),
    item('launch_gate', 'Launch gate traceability', card.auditBacked ? 'Ready' : 'Review', card.auditBacked ? 'Readiness card is audit-backed.' : 'Record handler board or spec review for traceability.'),
  ]
}

function item(
  id: string,
  label: string,
  status: BackendEngineeringChecklistStatus,
  detail: string,
): BackendEngineeringChecklistItem {
  return { id, label, status, detail }
}

function getPacketId(card: BackendHandlerReadinessCard) {
  return `engineering-handoff-${card.specId}`
}

function getRecommendedPacketStatus(
  card: BackendHandlerReadinessCard,
  spec: BackendHandlerSpec,
): BackendEngineeringHandoffPacketStatus {
  if (card.status === 'Blocked' || spec.status === 'Blocked') return 'Blocked'
  if (card.status === 'Approved' || spec.status === 'Approved') return 'Accepted'
  if (card.status === 'Ready' || spec.status === 'Ready For Engineering') return 'Ready For Handoff'
  if (spec.status === 'Draft') return 'Draft'
  return 'Review'
}

function getLatestReviewByPacket(reviews: BackendEngineeringHandoffPacketReview[]) {
  const latestReviewByPacket = new Map<string, BackendEngineeringHandoffPacketReview>()
  reviews.forEach(review => {
    if (!latestReviewByPacket.has(review.packetId)) latestReviewByPacket.set(review.packetId, review)
  })
  return latestReviewByPacket
}

function getRegisterSummary(
  status: BackendEngineeringHandoffPacketStatus,
  blockedCount: number,
  reviewCount: number,
  draftCount: number,
  readyCount: number,
  acceptedCount: number,
) {
  if (status === 'Blocked') return `${blockedCount} engineering handoff packet${blockedCount === 1 ? '' : 's'} are blocked.`
  if (status === 'Review') return `${reviewCount} engineering handoff packet${reviewCount === 1 ? '' : 's'} need review.`
  if (status === 'Draft') return `${draftCount} engineering handoff packet${draftCount === 1 ? '' : 's'} are drafted.`
  if (status === 'Ready For Handoff') return `${readyCount} engineering handoff packet${readyCount === 1 ? '' : 's'} are ready for implementation intake.`
  return `${acceptedCount} engineering handoff packet${acceptedCount === 1 ? '' : 's'} are accepted.`
}

function defaultPacketNote(
  status: BackendEngineeringHandoffPacketStatus,
  packet: BackendEngineeringHandoffPacket,
) {
  if (status === 'Accepted') return `${packet.handlerLabel} handoff accepted for engineering implementation.`
  if (status === 'Ready For Handoff') return `${packet.handlerLabel} marked ready for engineering handoff.`
  if (status === 'Review') return `${packet.handlerLabel} needs review before engineering handoff.`
  if (status === 'Blocked') return `${packet.handlerLabel} remains blocked before implementation intake.`
  return `${packet.handlerLabel} returned to draft for handoff scoping.`
}

function statusRank(status: BackendEngineeringHandoffPacketStatus) {
  if (status === 'Blocked') return 5
  if (status === 'Review') return 4
  if (status === 'Draft') return 3
  if (status === 'Ready For Handoff') return 2
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

function emitBackendEngineeringHandoffPacketReviewChange() {
  listeners.forEach(listener => listener())
}
