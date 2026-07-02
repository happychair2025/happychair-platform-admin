import { AlertTriangle, CheckCircle2, Clock3, Database, FileSearch, ListChecks, ServerCog, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import {
  buildActionExecutionPackets,
  getActionExecutionConfig,
} from '../../lib/admin-actions/actionExecutionContract'
import { buildActionRequestGovernance } from '../../lib/admin-actions/actionRequestGovernance'
import {
  formatAdminActionType,
  useLocalAdminActionRequests,
  type AdminActionRequest,
} from '../../lib/admin-actions/actionRequests'
import {
  buildApprovalEvidencePack,
  getApprovalChecklistStatusTone,
  useLocalApprovalChecklistStates,
} from '../../lib/admin-actions/approvalEvidencePacks'
import {
  buildExecutionHandoffReadinessPack,
  getExecutionHandoffReadinessTone,
  useLocalExecutionHandoffReadinessStates,
} from '../../lib/admin-actions/executionHandoffReadiness'
import {
  buildExecutionLedgerEvidenceChain,
  executionLedgerEvidenceBoundaryRule,
  getExecutionEvidenceTone,
  summarizeExecutionEvidenceChains,
} from '../../lib/admin-actions/executionLedgerEvidence'
import {
  getLatestMockServerExecution,
  getMockServerCheckTone,
  getMockServerExecutionStatusTone,
  mockServerExecutionBoundaryRule,
  summarizeMockServerExecutions,
  useLocalMockServerExecutions,
  type MockServerExecutionRecord,
} from '../../lib/admin-actions/mockServerExecutor'
import { useLocalAuditEvents, type AuditEvent } from '../../lib/audit/auditLog'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ExecutionLedgerPageProps {
  session: AdminSession
}

interface ExecutionLedgerRow {
  execution: MockServerExecutionRecord
  request?: AdminActionRequest
  auditEvent?: AuditEvent
  requestTitle: string
  requestStatus: string
  requestScope: string
  auditActor: string
  auditScope: string
  source: 'Local Dry Run Ledger'
}

export default function ExecutionLedgerPage({ session }: ExecutionLedgerPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localExecutions = useLocalMockServerExecutions()
  const localAuditEvents = useLocalAuditEvents()
  const [localApprovalStates] = useLocalApprovalChecklistStates()
  const [localReadinessStates] = useLocalExecutionHandoffReadinessStates()
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const canReview = hasPermission(session.role, 'admin_actions.view')

  const requests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const governanceRecords = useMemo(() => buildActionRequestGovernance(requests, data), [data, requests])
  const governanceByRequestId = useMemo(() => new Map(governanceRecords.map(record => [record.requestId, record])), [governanceRecords])
  const executionConfig = getActionExecutionConfig(import.meta.env)
  const packets = useMemo(() => buildActionExecutionPackets(requests, governanceByRequestId, executionConfig), [executionConfig, governanceByRequestId, requests])
  const packetByRequestId = useMemo(() => new Map(packets.map(packet => [packet.requestId, packet])), [packets])
  const approvalPackByRequestId = useMemo(() => new Map(requests
    .map(request => {
      const governance = governanceByRequestId.get(request.id)
      if (!governance) return null
      return buildApprovalEvidencePack(
        request,
        governance,
        localApprovalStates.find(state => state.requestId === request.id),
      )
    })
    .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack))
    .map(pack => [pack.requestId, pack])),
  [governanceByRequestId, localApprovalStates, requests])
  const readinessPackByRequestId = useMemo(() => new Map(requests
    .map(request => {
      const governance = governanceByRequestId.get(request.id)
      const packet = packetByRequestId.get(request.id)
      if (!governance || !packet) return null
      return buildExecutionHandoffReadinessPack({
        request,
        governance,
        packet,
        latestDryRun: getLatestMockServerExecution(request.id, localExecutions),
        localState: localReadinessStates.find(state => state.requestId === request.id),
      })
    })
    .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack))
    .map(pack => [pack.requestId, pack])),
  [governanceByRequestId, localExecutions, localReadinessStates, packetByRequestId, requests])

  const rows = useMemo<ExecutionLedgerRow[]>(() => {
    const requestById = new Map(requests.map(request => [request.id, request]))
    const auditEventById = new Map(auditEvents.map(event => [event.id, event]))

    return localExecutions.map(execution => {
      const request = requestById.get(execution.requestId)
      const auditEvent = auditEventById.get(execution.auditEventId)
      return {
        execution,
        request,
        auditEvent,
        requestTitle: request?.title ?? execution.requestId,
        requestStatus: request?.status ?? 'Request not found',
        requestScope: request?.scope.label ?? auditEvent?.scope ?? 'Unknown scope',
        auditActor: auditEvent?.actorEmail ?? auditEvent?.actor ?? execution.actorEmail,
        auditScope: auditEvent?.scope ?? request?.scope.label ?? 'Unknown scope',
        source: 'Local Dry Run Ledger' as const,
      }
    }).sort((a, b) => new Date(b.execution.createdAt).getTime() - new Date(a.execution.createdAt).getTime())
  }, [auditEvents, localExecutions, requests])

  const evidenceChainByExecutionId = useMemo(() => new Map(rows.map(row => [
    row.execution.id,
    buildExecutionLedgerEvidenceChain({
      request: row.request,
      governance: row.request ? governanceByRequestId.get(row.request.id) : undefined,
      packet: row.request ? packetByRequestId.get(row.request.id) : undefined,
      approvalPack: row.request ? approvalPackByRequestId.get(row.request.id) : undefined,
      readinessPack: row.request ? readinessPackByRequestId.get(row.request.id) : undefined,
      execution: row.execution,
      auditEvent: row.auditEvent,
    }),
  ])), [approvalPackByRequestId, governanceByRequestId, packetByRequestId, readinessPackByRequestId, rows])
  const evidenceSummary = useMemo(
    () => summarizeExecutionEvidenceChains(Array.from(evidenceChainByExecutionId.values())),
    [evidenceChainByExecutionId],
  )
  const summary = useMemo(() => summarizeMockServerExecutions(localExecutions), [localExecutions])
  const selectedRow = rows.find(row => row.execution.id === selectedId) ?? rows[0]
  const selectedEvidenceChain = selectedRow ? evidenceChainByExecutionId.get(selectedRow.execution.id) : undefined
  const auditLinkedCount = rows.filter(row => row.auditEvent).length
  const requestLinkedCount = rows.filter(row => row.request).length

  const recordLedgerReview = (row: ExecutionLedgerRow) => {
    const evidenceChain = evidenceChainByExecutionId.get(row.execution.id)
    const result = runAdminAction(session, {
      permission: 'admin_actions.view',
      scope: row.requestScope,
      actionKey: 'execution_ledger.review_recorded.mock',
      actionLabel: `Reviewed execution ledger record for ${row.requestTitle}`,
      severity: row.execution.status === 'Dry Run Blocked' ? 'warning' : 'notice',
      metadata: {
        executionId: row.execution.id,
        requestId: row.execution.requestId,
        auditEventId: row.execution.auditEventId,
        serverHandlerKey: row.execution.handlerKey,
        executionStatus: row.execution.status,
        mutationApplied: row.execution.mutationApplied,
        dryRun: row.execution.dryRun,
        evidenceStatus: evidenceChain?.status,
        evidenceScore: evidenceChain?.evidenceScore,
        evidenceVerifiedCount: evidenceChain?.verifiedCount,
        evidenceWarningCount: evidenceChain?.warningCount,
        evidenceBlockedCount: evidenceChain?.blockedCount,
        evidenceMissingCount: evidenceChain?.missingCount,
        evidenceAuditEventIds: evidenceChain?.auditEventIds,
      },
    })
    setNotice(result.ok ? 'Ledger review recorded in the audit action ledger.' : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Execution Traceability"
        title="Execution Ledger"
        description="Dry-run server execution history for action requests, handler checks, audit links, response previews, and mutation-boundary proof."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Execution Records" value={String(summary.total)} delta="Local dry-run ledger" tone="neutral" icon={<ServerCog size={16} />} />
        <MetricCard label="Dry Run Passed" value={String(summary.passed)} delta="Handlers returned clean previews" tone={summary.passed ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Needs Approval" value={String(summary.needsApproval)} delta="Safe preview before approval" tone={summary.needsApproval ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Dry Run Blocked" value={String(summary.blocked)} delta="Handler checks failed" tone={summary.blocked ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Audit Linked" value={String(auditLinkedCount)} delta={`${sourceLabel} plus local audit`} tone={auditLinkedCount === rows.length ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Request Linked" value={String(requestLinkedCount)} delta="Action request lineage" tone={requestLinkedCount === rows.length ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
        <MetricCard label="Mutations Applied" value="0" delta="Browser execution path is dry-run only" tone="ok" icon={<Database size={16} />} />
        <MetricCard label="Latest Record" value={summary.latest ? formatDateTime(summary.latest.createdAt) : 'None'} delta="Most recent dry-run execution" tone="neutral" icon={<FileSearch size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Evidence Verified" value={String(evidenceSummary.verified)} delta={`${evidenceSummary.averageScore}% average evidence score`} tone={evidenceSummary.verified ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Evidence Warnings" value={String(evidenceSummary.warning)} delta="Review gaps before server handoff" tone={evidenceSummary.warning ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Evidence Blocked" value={String(evidenceSummary.blocked)} delta="Broken or unsafe chain items" tone={evidenceSummary.blocked ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Evidence Missing" value={String(evidenceSummary.missing)} delta="Unlinked request, audit, approval, or readiness proof" tone={evidenceSummary.missing ? 'warn' : 'ok'} icon={<FileSearch size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Execution Boundary</p>
          <h2>Execution history is traceability, not mutation</h2>
          <span>{mockServerExecutionBoundaryRule}</span>
          <span>{executionLedgerEvidenceBoundaryRule}</span>
          <span>Production handlers must still run server-side, permissioned, confirmed where required, and audit-logged before changing customer or billing state.</span>
        </div>
        <StatusPill label="Mutation Applied: 0" tone="ok" />
      </section>

      <div className="execution-ledger-layout">
        <DataTable
          label="Execution Ledger"
          rows={rows}
          pageSize={8}
          emptyTitle="No execution records yet. Run a mock server dry run from Action Requests."
          columns={[
            {
              key: 'created',
              header: 'Created',
              sortable: true,
              searchValue: row => row.execution.createdAt,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.execution.id)}>
                  {formatDateTime(row.execution.createdAt)}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.execution.status,
              render: row => <StatusPill label={row.execution.status} tone={getMockServerExecutionStatusTone(row.execution.status)} />,
            },
            {
              key: 'evidence',
              header: 'Evidence',
              sortable: true,
              searchValue: row => evidenceChainByExecutionId.get(row.execution.id)?.status ?? 'Missing',
              render: row => {
                const chain = evidenceChainByExecutionId.get(row.execution.id)
                return chain
                  ? <StatusPill label={`${chain.status} ${chain.evidenceScore}%`} tone={getExecutionEvidenceTone(chain.status)} />
                  : <StatusPill label="Missing" tone="neutral" />
              },
            },
            {
              key: 'handler',
              header: 'Handler',
              sortable: true,
              searchValue: row => `${row.execution.handlerLabel} ${row.execution.handlerKey}`,
              render: row => <div><strong>{row.execution.handlerLabel}</strong><span className="cell-subtext">{row.execution.handlerKey}</span></div>,
            },
            {
              key: 'request',
              header: 'Request',
              sortable: true,
              searchValue: row => `${row.requestTitle} ${formatAdminActionType(row.execution.actionType)}`,
              render: row => <div><strong>{row.requestTitle}</strong><span className="cell-subtext">{formatAdminActionType(row.execution.actionType)}</span></div>,
            },
            {
              key: 'actor',
              header: 'Actor',
              sortable: true,
              searchValue: row => row.auditActor,
              render: row => row.auditActor,
            },
            {
              key: 'target',
              header: 'Target',
              sortable: true,
              searchValue: row => row.execution.simulatedWriteTarget,
              render: row => <code>{row.execution.simulatedWriteTarget}</code>,
            },
            {
              key: 'duration',
              header: 'Duration',
              sortable: true,
              searchValue: row => String(row.execution.durationMs),
              render: row => `${row.execution.durationMs} ms`,
            },
            {
              key: 'mutation',
              header: 'Mutation',
              sortable: true,
              searchValue: row => String(row.execution.mutationApplied),
              render: row => <StatusPill label={row.execution.mutationApplied ? 'Applied' : 'Not applied'} tone={row.execution.mutationApplied ? 'danger' : 'ok'} />,
            },
          ]}
        />

        <aside className="detail-panel execution-ledger-detail-panel">
          {selectedRow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Execution Detail</p>
                  <h2>{selectedRow.requestTitle}</h2>
                </div>
                <StatusPill
                  label={selectedRow.execution.status}
                  tone={getMockServerExecutionStatusTone(selectedRow.execution.status)}
                />
              </div>

              <div className="request-scope-list">
                <div><span>Action Type</span><strong>{formatAdminActionType(selectedRow.execution.actionType)}</strong></div>
                <div><span>Request Status</span><strong>{selectedRow.requestStatus}</strong></div>
                <div><span>Scope</span><strong>{selectedRow.requestScope}</strong></div>
                <div><span>Actor</span><strong>{selectedRow.auditActor}</strong></div>
                <div><span>Route</span><strong>{selectedRow.execution.route}</strong></div>
                <div><span>Source</span><strong>{selectedRow.source}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Outcome</h3>
                <p className="muted-copy">{selectedRow.execution.outcomeSummary}</p>
              </div>

              {selectedEvidenceChain && (
                <div className="detail-section">
                  <h3>Evidence Chain</h3>
                  <section className={`panel execution-evidence-panel tone-${selectedEvidenceChain.status.toLowerCase()}`}>
                    <div>
                      <p className="eyebrow">Evidence Drilldown</p>
                      <h2>{selectedEvidenceChain.status}</h2>
                      <span>{selectedEvidenceChain.verifiedCount} verified, {selectedEvidenceChain.warningCount} warnings, {selectedEvidenceChain.blockedCount} blocked, {selectedEvidenceChain.missingCount} missing.</span>
                    </div>
                    <div className="execution-evidence-meta">
                      <StatusPill label={`${selectedEvidenceChain.evidenceScore}% score`} tone={getExecutionEvidenceTone(selectedEvidenceChain.status)} />
                      <strong>{selectedEvidenceChain.auditEventIds.length} audit id{selectedEvidenceChain.auditEventIds.length === 1 ? '' : 's'}</strong>
                    </div>
                  </section>

                  <div className="execution-evidence-chain-list">
                    {selectedEvidenceChain.items.map(item => (
                      <article key={item.id} className={`execution-evidence-chain-item tone-${item.status.toLowerCase()}`}>
                        <div>
                          <strong>{item.label}</strong>
                          <div>
                            <StatusPill label={item.status} tone={getExecutionEvidenceTone(item.status)} />
                          </div>
                        </div>
                        <p>{item.detail}</p>
                        <div className="execution-evidence-foot">
                          <span>{item.reference}</span>
                          {item.actor && <span>{item.actor}</span>}
                          {item.timestamp && <span>{formatDateTime(item.timestamp)}</span>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {selectedRow.request && approvalPackByRequestId.get(selectedRow.request.id) && (
                <div className="detail-section">
                  <h3>Approval Checklist Snapshot</h3>
                  <div className="execution-evidence-chain-list">
                    {approvalPackByRequestId.get(selectedRow.request.id)?.checklist.map(item => (
                      <article key={item.id} className={`execution-evidence-chain-item tone-${item.status.toLowerCase()}`}>
                        <div>
                          <strong>{item.label}</strong>
                          <div>
                            {item.required && <StatusPill label="Required" tone="info" />}
                            <StatusPill label={item.status} tone={getApprovalChecklistStatusTone(item.status)} />
                          </div>
                        </div>
                        <p>{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {selectedRow.request && readinessPackByRequestId.get(selectedRow.request.id) && (
                <div className="detail-section">
                  <h3>Readiness Snapshot</h3>
                  <div className="response-preview-list">
                    <div><span>Status</span><strong>{readinessPackByRequestId.get(selectedRow.request.id)?.status}</strong></div>
                    <div><span>Assigned</span><strong>{readinessPackByRequestId.get(selectedRow.request.id)?.assignedExecutor ?? 'Not assigned'}</strong></div>
                    <div><span>Required Confirmed</span><strong>{readinessPackByRequestId.get(selectedRow.request.id)?.confirmedRequiredCount} / {readinessPackByRequestId.get(selectedRow.request.id)?.requiredCount}</strong></div>
                    <div><span>Ready For Server</span><strong>{readinessPackByRequestId.get(selectedRow.request.id)?.readyForServer ? 'Yes' : 'No'}</strong></div>
                  </div>
                  <div className="support-actions">
                    <StatusPill
                      label={readinessPackByRequestId.get(selectedRow.request.id)?.status ?? 'Missing'}
                      tone={getExecutionHandoffReadinessTone(readinessPackByRequestId.get(selectedRow.request.id)?.status ?? 'Blocked')}
                    />
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Execution Record</h3>
                <div className="mock-execution-grid">
                  <div><span>Handler</span><strong>{selectedRow.execution.handlerKey}</strong></div>
                  <div><span>Target</span><strong>{selectedRow.execution.simulatedWriteTarget}</strong></div>
                  <div><span>Duration</span><strong>{selectedRow.execution.durationMs} ms</strong></div>
                  <div><span>Dry Run</span><strong>{selectedRow.execution.dryRun ? 'Yes' : 'No'}</strong></div>
                  <div><span>Mutation Applied</span><strong>{selectedRow.execution.mutationApplied ? 'Yes' : 'No'}</strong></div>
                  <div><span>Created</span><strong>{formatDateTime(selectedRow.execution.createdAt)}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Handler Checks</h3>
                <div className="governance-check-list">
                  {selectedRow.execution.checks.map(check => (
                    <article key={check.id} className={`governance-check-item tone-${check.status}`}>
                      <div>
                        <strong>{check.label}</strong>
                        <StatusPill label={check.status} tone={getMockServerCheckTone(check.status)} />
                      </div>
                      <p>{check.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Response Preview</h3>
                <div className="response-preview-list">
                  {Object.entries(selectedRow.execution.responsePreview).map(([key, value]) => (
                    <div key={key}>
                      <span>{key}</span>
                      <strong>{formatPreviewValue(value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Audit Lineage</h3>
                <div className="settings-rule-list">
                  <div>
                    <ShieldCheck size={16} strokeWidth={1.8} />
                    <strong>Audit event: {selectedRow.execution.auditEventId}</strong>
                  </div>
                  <div>
                    <ListChecks size={16} strokeWidth={1.8} />
                    <strong>Action request: {selectedRow.execution.requestId}</strong>
                  </div>
                  <div>
                    <Database size={16} strokeWidth={1.8} />
                    <strong>Idempotency key: {selectedRow.execution.idempotencyKey}</strong>
                  </div>
                  <div>
                    <ServerCog size={16} strokeWidth={1.8} />
                    <strong>Correlation id: {selectedRow.execution.correlationId}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canReview}
                    onClick={() => recordLedgerReview(selectedRow)}
                  >
                    <FileSearch size={15} strokeWidth={1.8} />
                    Record Ledger Review
                  </button>
                  <span className="muted-copy">Review records audit visibility only. It does not execute or mutate customer data.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No execution record selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPreviewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => formatPreviewValue(item)).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
