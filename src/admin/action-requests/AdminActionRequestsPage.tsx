import { AlertTriangle, CheckCircle2, Clock3, Database, HardDrive, ListChecks, PlayCircle, ServerCog, ShieldCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import {
  actionExecutionBoundaryRule,
  buildActionExecutionPackets,
  getActionExecutionConfig,
  getExecutionPostureTone,
  getExecutionStageTone,
  summarizeActionExecution,
} from '../../lib/admin-actions/actionExecutionContract'
import {
  getLatestMockServerExecution,
  getMockServerCheckTone,
  getMockServerExecutionStatusTone,
  mockServerExecutionBoundaryRule,
  mockServerHandlerRegistry,
  runMockServerExecution,
  summarizeMockServerExecutions,
  useLocalMockServerExecutions,
} from '../../lib/admin-actions/mockServerExecutor'
import {
  buildActionRequestGovernance,
  getGovernanceCheckTone,
  getGovernanceReadinessTone,
  getGovernanceRiskTone,
} from '../../lib/admin-actions/actionRequestGovernance'
import {
  adminActionRequestConnectionRule,
  formatAdminActionType,
  serverActionHandlerPlaceholders,
  updateAdminActionRequestStatus,
  useLocalAdminActionRequests,
  type AdminActionRequest,
  type AdminActionRequestStatus,
  type AdminActionRequestType,
} from '../../lib/admin-actions/actionRequests'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import {
  durableLedgerBoundaryRule,
  getDurableLedgerConfig,
  getLedgerPersistenceLabel,
  getLedgerPersistenceTone,
} from '../../lib/platform-ledger/durableLedger'
import { hasPermission } from '../../lib/permissions/permissions'

interface AdminActionRequestsPageProps {
  session: AdminSession
}

const openStatuses: AdminActionRequestStatus[] = ['Draft', 'Queued', 'Approved', 'Running']

function statusTone(status: AdminActionRequestStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Completed') return 'ok'
  if (status === 'Failed' || status === 'Blocked') return 'danger'
  if (status === 'Running' || status === 'Approved') return 'info'
  if (status === 'Queued') return 'warn'
  return 'neutral'
}

function actionTypeTone(actionType: AdminActionRequestType): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (actionType === 'impersonation_start' || actionType === 'impersonation_end') return 'danger'
  if (actionType === 'billing_review_action' || actionType === 'feature_flag_change') return 'warn'
  if (actionType === 'module_activation_change' || actionType === 'agent_recommended_action') return 'info'
  return 'neutral'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function persistenceLabel(request: AdminActionRequest) {
  return getLedgerPersistenceLabel(request.persistenceStatus, request.persistenceTarget)
}

function ledgerSyncLabel(request: AdminActionRequest) {
  return request.metadata?.ledgerSyncRequired ? 'Server sync required' : 'No server sync required'
}

function getAvailableTransitions(status: AdminActionRequestStatus): AdminActionRequestStatus[] {
  if (status === 'Draft') return ['Queued', 'Blocked']
  if (status === 'Queued') return ['Approved', 'Blocked']
  if (status === 'Approved') return ['Running', 'Blocked']
  if (status === 'Running') return ['Completed', 'Failed']
  if (status === 'Failed' || status === 'Blocked') return ['Queued']
  return []
}

export default function AdminActionRequestsPage({ session }: AdminActionRequestsPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localMockServerExecutions = useLocalMockServerExecutions()
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const canManage = hasPermission(session.role, 'admin_actions.manage')
  const rows = useMemo(() => {
    return [
      ...localRequests,
      ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data.adminActionRequests, localRequests])
  const governanceRecords = useMemo(() => buildActionRequestGovernance(rows, data), [data, rows])
  const governanceByRequestId = useMemo(() => new Map(governanceRecords.map(record => [record.requestId, record])), [governanceRecords])
  const executionConfig = getActionExecutionConfig(import.meta.env)
  const durableLedgerConfig = getDurableLedgerConfig(import.meta.env)
  const executionPackets = useMemo(() => buildActionExecutionPackets(rows, governanceByRequestId, executionConfig), [executionConfig, governanceByRequestId, rows])
  const executionByRequestId = useMemo(() => new Map(executionPackets.map(packet => [packet.requestId, packet])), [executionPackets])
  const executionSummary = useMemo(() => summarizeActionExecution(executionPackets), [executionPackets])
  const mockExecutionSummary = useMemo(() => summarizeMockServerExecutions(localMockServerExecutions), [localMockServerExecutions])
  const selectedRequest = rows.find(row => row.id === selectedId) ?? rows[0]
  const selectedGovernance = selectedRequest ? governanceByRequestId.get(selectedRequest.id) : undefined
  const selectedExecutionPacket = selectedRequest ? executionByRequestId.get(selectedRequest.id) : undefined
  const selectedMockExecution = selectedRequest ? getLatestMockServerExecution(selectedRequest.id, localMockServerExecutions) : undefined
  const openCount = rows.filter(row => openStatuses.includes(row.status)).length
  const readyCount = rows.filter(row => row.status === 'Approved' || row.status === 'Running').length
  const blockedCount = rows.filter(row => row.status === 'Blocked' || row.status === 'Failed').length
  const completedCount = rows.filter(row => row.status === 'Completed').length
  const governanceReadyCount = governanceRecords.filter(record => record.readiness === 'Ready').length
  const needsApprovalCount = governanceRecords.filter(record => record.readiness === 'Needs Approval').length
  const governanceBlockedCount = governanceRecords.filter(record => record.readiness === 'Blocked').length
  const highRiskCount = governanceRecords.filter(record => record.riskLevel === 'Critical' || record.riskLevel === 'High').length
  const serverPendingCount = rows.filter(row => row.persistenceStatus === 'server_pending').length
  const serverRecordedCount = rows.filter(row => row.persistenceStatus === 'server_recorded').length
  const localQueueCount = rows.filter(row => row.persistenceStatus === 'local_durable' || !row.persistenceStatus).length
  const handlerList = Object.values(serverActionHandlerPlaceholders)

  const transitionRequest = (request: AdminActionRequest, nextStatus: AdminActionRequestStatus) => {
    const governance = governanceByRequestId.get(request.id)
    const executionPacket = executionByRequestId.get(request.id)
    const blocksExecution = nextStatus === 'Approved' || nextStatus === 'Running' || nextStatus === 'Completed'
    if (blocksExecution && governance?.hardBlockers.length) {
      setNotice(`Governance blocked ${nextStatus}: ${governance.hardBlockers[0]}`)
      return
    }
    if (nextStatus === 'Running' && executionPacket?.posture !== 'Ready For Server') {
      setNotice(`Execution blocked: ${executionPacket?.warnings[0] ?? 'server execution packet is not ready.'}`)
      return
    }
    if (nextStatus === 'Completed' && executionPacket?.posture !== 'Executing') {
      setNotice('Completion requires an executing server packet.')
      return
    }

    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: request.scope.label,
      actionKey: `admin_action_request.status.${nextStatus.toLowerCase()}.mock`,
      actionLabel: `${request.title} moved from ${request.status} to ${nextStatus}`,
      severity: nextStatus === 'Failed' || nextStatus === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        actionRequestId: request.id,
        actionType: request.actionType,
        previousStatus: request.status,
        nextStatus,
        serverHandlerKey: request.serverHandler.key,
        executionPosture: executionPacket?.posture,
        idempotencyKey: executionPacket?.idempotencyKey,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updated = updateAdminActionRequestStatus(request, nextStatus, {
      transitionAuditEventId: result.auditEvent.id,
      statusReason: nextStatus === 'Failed' || nextStatus === 'Blocked'
        ? 'manual_queue_transition'
        : request.statusReason,
      metadata: {
        previousStatus: request.status,
        lastTransitionedBy: session.email,
      },
    })
    setSelectedId(updated.id)
    setNotice(`${request.title} moved to ${nextStatus}.`)
  }

  const simulateServerDryRun = (request: AdminActionRequest) => {
    const governance = governanceByRequestId.get(request.id)
    const executionPacket = executionByRequestId.get(request.id)
    if (!executionPacket) {
      setNotice('Execution packet is not available for this request.')
      return
    }

    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: request.scope.label,
      actionKey: 'admin_action_request.mock_server.dry_run',
      actionLabel: `Dry-run mock server handler for ${request.title}`,
      severity: executionPacket.blockers.length ? 'warning' : 'notice',
      metadata: {
        actionRequestId: request.id,
        actionType: request.actionType,
        serverHandlerKey: request.serverHandler.key,
        executionPosture: executionPacket.posture,
        idempotencyKey: executionPacket.idempotencyKey,
        mutationApplied: false,
        dryRun: true,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = runMockServerExecution({
      request,
      packet: executionPacket,
      governance,
      data,
      auditEvent: result.auditEvent,
    })
    setSelectedId(request.id)
    setNotice(`${record.status}: ${record.outcomeSummary}`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Server Action Queue"
        title="Admin Action Requests"
        description="Central queue for future production mutations: modules, remediation, troubleshooting, impersonation, feature flags, billing review, and human-approved agent actions."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Open Requests" value={String(openCount)} delta={`${sourceLabel} plus local queue`} tone="warn" icon={<Clock3 size={16} />} />
        <MetricCard label="Ready To Execute" value={String(readyCount)} delta="Approved or running placeholders" tone="neutral" icon={<PlayCircle size={16} />} />
        <MetricCard label="Blocked / Failed" value={String(blockedCount)} delta="Needs review before retry" tone={blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Completed" value={String(completedCount)} delta="Recorded actions" tone="ok" icon={<CheckCircle2 size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Governance Ready" value={String(governanceReadyCount)} delta="Passed hard checks" tone={governanceReadyCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Needs Approval" value={String(needsApprovalCount)} delta="Human approval gate" tone={needsApprovalCount ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Governance Blocked" value={String(governanceBlockedCount)} delta="Hard blockers present" tone={governanceBlockedCount ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
        <MetricCard label="High Risk" value={String(highRiskCount)} delta="Critical or high policy" tone={highRiskCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Server Ready" value={String(executionSummary.readyForServer)} delta={executionConfig.endpoint ? 'Endpoint configured' : 'Endpoint not configured'} tone={executionSummary.readyForServer ? 'ok' : 'neutral'} icon={<ServerCog size={16} />} />
        <MetricCard label="Review Only" value={String(executionSummary.reviewOnly)} delta="Browser contract packets" tone="warn" icon={<ListChecks size={16} />} />
        <MetricCard label="Execution Blocked" value={String(executionSummary.blocked)} delta="Preflight blockers present" tone={executionSummary.blocked ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
        <MetricCard label="Executing / Done" value={String(executionSummary.executing + executionSummary.completed)} delta="Server-state placeholders" tone={executionSummary.executing ? 'neutral' : 'ok'} icon={<PlayCircle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Ledger Mode" value={durableLedgerConfig.mode === 'trusted_server_ready' ? 'Server Ready' : 'Local Review'} delta={durableLedgerConfig.endpointLabel} tone={durableLedgerConfig.endpointConfigured ? 'ok' : 'warn'} icon={<Database size={16} />} />
        <MetricCard label="Server Pending" value={String(serverPendingCount)} delta="Ready to sync through trusted handler" tone={serverPendingCount ? 'warn' : 'neutral'} icon={<ServerCog size={16} />} />
        <MetricCard label="Server Recorded" value={String(serverRecordedCount)} delta="Trusted audit/read-view records" tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Local Queue" value={String(localQueueCount)} delta="Browser-held review records" tone={localQueueCount ? 'warn' : 'ok'} icon={<HardDrive size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Mock Dry Runs" value={String(mockExecutionSummary.total)} delta="Local server simulations" tone="neutral" icon={<ServerCog size={16} />} />
        <MetricCard label="Dry Run Passed" value={String(mockExecutionSummary.passed)} delta="Handlers returned clean previews" tone={mockExecutionSummary.passed ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Needs Approval" value={String(mockExecutionSummary.needsApproval)} delta="Previewed before approval" tone={mockExecutionSummary.needsApproval ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Dry Run Blocked" value={String(mockExecutionSummary.blocked)} delta="Handler checks failed" tone={mockExecutionSummary.blocked ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <section className="panel action-request-boundary-panel">
        <div>
          <p className="eyebrow">Mutation Boundary</p>
          <h2>Browser actions create requests, not production writes</h2>
          <span>{adminActionRequestConnectionRule}</span>
          <span>{actionExecutionBoundaryRule}</span>
          <span>{mockServerExecutionBoundaryRule}</span>
          <span>{durableLedgerBoundaryRule}</span>
        </div>
        <StatusPill label={durableLedgerConfig.endpointLabel} tone={durableLedgerConfig.endpointConfigured ? 'ok' : 'warn'} />
      </section>

      <div className="action-requests-layout">
        <DataTable
          label="Server Action Queue"
          rows={rows}
          pageSize={8}
          emptyTitle="No admin action requests have been recorded yet."
          columns={[
            {
              key: 'request',
              header: 'Request',
              sortable: true,
              searchValue: row => `${row.title} ${formatAdminActionType(row.actionType)}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              sortable: true,
              searchValue: row => formatAdminActionType(row.actionType),
              render: row => <StatusPill label={formatAdminActionType(row.actionType)} tone={actionTypeTone(row.actionType)} />,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => `${row.scope.label} ${row.scope.organizationName ?? ''} ${row.scope.propertyName ?? ''} ${row.scope.venueName ?? ''}`,
              render: row => <strong>{row.scope.label}</strong>,
            },
            {
              key: 'permission',
              header: 'Permission',
              sortable: true,
              searchValue: row => row.permissionRequired,
              render: row => <code>{row.permissionRequired}</code>,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
            },
            {
              key: 'persistence',
              header: 'Persistence',
              sortable: true,
              searchValue: row => `${row.persistenceStatus ?? ''} ${row.persistenceTarget ?? ''}`,
              render: row => <StatusPill label={persistenceLabel(row)} tone={getLedgerPersistenceTone(row.persistenceStatus)} />,
            },
            {
              key: 'governance',
              header: 'Governance',
              sortable: true,
              searchValue: row => governanceByRequestId.get(row.id)?.readiness ?? 'Unscored',
              render: row => {
                const governance = governanceByRequestId.get(row.id)
                return <StatusPill label={governance?.readiness ?? 'Unscored'} tone={governance ? getGovernanceReadinessTone(governance.readiness) : 'neutral'} />
              },
            },
            {
              key: 'execution',
              header: 'Execution',
              sortable: true,
              searchValue: row => executionByRequestId.get(row.id)?.posture ?? 'Unscored',
              render: row => {
                const packet = executionByRequestId.get(row.id)
                return <StatusPill label={packet?.posture ?? 'Unscored'} tone={packet ? getExecutionPostureTone(packet.posture) : 'neutral'} />
              },
            },
            {
              key: 'dryRun',
              header: 'Dry Run',
              sortable: true,
              searchValue: row => getLatestMockServerExecution(row.id, localMockServerExecutions)?.status ?? 'Not simulated',
              render: row => {
                const record = getLatestMockServerExecution(row.id, localMockServerExecutions)
                return record
                  ? <StatusPill label={record.status} tone={getMockServerExecutionStatusTone(record.status)} />
                  : <StatusPill label="Not simulated" tone="neutral" />
              },
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => governanceByRequestId.get(row.id)?.riskLevel ?? 'Unscored',
              render: row => {
                const governance = governanceByRequestId.get(row.id)
                return <StatusPill label={governance?.riskLevel ?? 'Unscored'} tone={governance ? getGovernanceRiskTone(governance.riskLevel) : 'neutral'} />
              },
            },
            {
              key: 'requestedBy',
              header: 'Requested By',
              sortable: true,
              searchValue: row => `${row.requestedBy.name} ${row.requestedBy.email ?? ''} ${row.requestedBy.role}`,
              render: row => <div><strong>{row.requestedBy.name}</strong><span className="cell-subtext">{row.requestedBy.role}</span></div>,
            },
            {
              key: 'created',
              header: 'Created',
              sortable: true,
              searchValue: row => row.createdAt,
              render: row => formatDateTime(row.createdAt),
            },
          ]}
        />

        <aside className="detail-panel action-request-detail-panel">
          {selectedRequest ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Request Detail</p>
                  <h2>{selectedRequest.title}</h2>
                </div>
                <StatusPill label={selectedRequest.status} tone={statusTone(selectedRequest.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Action Type</span><strong>{formatAdminActionType(selectedRequest.actionType)}</strong></div>
                <div><span>Scope</span><strong>{selectedRequest.scope.label}</strong></div>
                <div><span>Permission</span><strong>{selectedRequest.permissionRequired}</strong></div>
                <div><span>Persistence</span><strong>{persistenceLabel(selectedRequest)}</strong></div>
                <div><span>Ledger Target</span><strong>{selectedRequest.persistenceTarget ?? 'local_storage'}</strong></div>
                <div><span>Ledger Sync</span><strong>{ledgerSyncLabel(selectedRequest)}</strong></div>
              </div>

              {selectedGovernance && (
                <>
                  <div className="governance-summary-grid">
                    <div>
                      <span>Readiness</span>
                      <StatusPill label={selectedGovernance.readiness} tone={getGovernanceReadinessTone(selectedGovernance.readiness)} />
                    </div>
                    <div>
                      <span>Risk</span>
                      <StatusPill label={selectedGovernance.riskLevel} tone={getGovernanceRiskTone(selectedGovernance.riskLevel)} />
                    </div>
                    <div>
                      <span>Checks</span>
                      <strong>{selectedGovernance.passCount} passed / {selectedGovernance.warningCount} warnings</strong>
                    </div>
                    <div>
                      <span>Blockers</span>
                      <strong>{selectedGovernance.hardBlockers.length}</strong>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Approval Policy</h3>
                    <p className="muted-copy">{selectedGovernance.policyReason}</p>
                    <div className="pill-row">
                      {selectedGovernance.requiredApprovers.map(approver => <StatusPill key={approver} label={approver} tone="info" />)}
                      <StatusPill label={selectedGovernance.humanConfirmationRequired ? 'Human confirmation required' : 'Safety action'} tone={selectedGovernance.humanConfirmationRequired ? 'warn' : 'ok'} />
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Execution Checks</h3>
                    <div className="governance-check-list">
                      {selectedGovernance.checks.map(check => (
                        <article key={check.id} className={`governance-check-item tone-${check.status}`}>
                          <div>
                            <strong>{check.label}</strong>
                            <StatusPill label={check.status} tone={getGovernanceCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedExecutionPacket && (
                <>
                  <div className="detail-section">
                    <h3>Execution Packet</h3>
                    <div className="execution-packet-grid">
                      <div><span>Posture</span><StatusPill label={selectedExecutionPacket.posture} tone={getExecutionPostureTone(selectedExecutionPacket.posture)} /></div>
                      <div><span>Endpoint</span><strong>{selectedExecutionPacket.endpointLabel}</strong></div>
                      <div><span>Route</span><strong>{selectedExecutionPacket.method} {selectedExecutionPacket.route}</strong></div>
                      <div><span>Handler</span><strong>{selectedExecutionPacket.handlerKey}</strong></div>
                      <div><span>Idempotency</span><strong>{selectedExecutionPacket.idempotencyKey}</strong></div>
                      <div><span>Correlation</span><strong>{selectedExecutionPacket.correlationId}</strong></div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Server Preflight</h3>
                    <div className="governance-check-list">
                      {selectedExecutionPacket.stages.map(stage => (
                        <article key={stage.id} className={`governance-check-item tone-${stage.status}`}>
                          <div>
                            <strong>{stage.label}</strong>
                            <StatusPill label={stage.status} tone={getExecutionStageTone(stage.status)} />
                          </div>
                          <p>{stage.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Payload Preview</h3>
                    <div className="execution-payload-preview">
                      <div><span>Request</span><strong>{selectedExecutionPacket.payloadPreview.requestId}</strong></div>
                      <div><span>Action</span><strong>{formatAdminActionType(selectedExecutionPacket.payloadPreview.actionType)}</strong></div>
                      <div><span>Permission</span><strong>{selectedExecutionPacket.payloadPreview.permissionRequired}</strong></div>
                      <div><span>Requested By</span><strong>{selectedExecutionPacket.payloadPreview.requestedBy}</strong></div>
                      <div><span>Metadata Keys</span><strong>{selectedExecutionPacket.payloadPreview.metadataKeys.join(', ') || 'None'}</strong></div>
                    </div>
                  </div>
                </>
              )}

              {selectedMockExecution && (
                <>
                  <div className="detail-section">
                    <h3>Latest Mock Server Dry Run</h3>
                    <div className="mock-execution-grid">
                      <div><span>Status</span><StatusPill label={selectedMockExecution.status} tone={getMockServerExecutionStatusTone(selectedMockExecution.status)} /></div>
                      <div><span>Target</span><strong>{selectedMockExecution.simulatedWriteTarget}</strong></div>
                      <div><span>Duration</span><strong>{selectedMockExecution.durationMs} ms</strong></div>
                      <div><span>Mutation Applied</span><strong>{selectedMockExecution.mutationApplied ? 'Yes' : 'No'}</strong></div>
                      <div><span>Idempotency</span><strong>{selectedMockExecution.idempotencyKey}</strong></div>
                      <div><span>Audit</span><strong>{selectedMockExecution.auditEventId}</strong></div>
                    </div>
                    <p className="muted-copy">{selectedMockExecution.outcomeSummary}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Dry Run Checks</h3>
                    <div className="governance-check-list">
                      {selectedMockExecution.checks.map(check => (
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
                      {Object.entries(selectedMockExecution.responsePreview).map(([key, value]) => (
                        <div key={key}>
                          <span>{key}</span>
                          <strong>{Array.isArray(value) ? value.join(', ') : String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="detail-section">
                <h3>Reason</h3>
                <p className="muted-copy">{selectedRequest.reason}</p>
              </div>

              <div className="detail-section">
                <h3>Rollback Notes</h3>
                <p className="muted-copy">{selectedRequest.rollbackNotes}</p>
              </div>

              <div className="settings-rule-list">
                <div>
                  <ServerCog size={16} strokeWidth={1.8} />
                  <strong>{selectedRequest.serverHandler.label}: {selectedRequest.serverHandler.key}</strong>
                </div>
                <div>
                  <ListChecks size={16} strokeWidth={1.8} />
                  <strong>{selectedRequest.serverHandler.description}</strong>
                </div>
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <strong>Audit event: {selectedRequest.auditEventId}</strong>
                </div>
                {selectedRequest.transitionAuditEventId && (
                  <div>
                    <Database size={16} strokeWidth={1.8} />
                    <strong>Last transition audit: {selectedRequest.transitionAuditEventId}</strong>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canManage}
                    onClick={() => simulateServerDryRun(selectedRequest)}
                  >
                    <ServerCog size={15} strokeWidth={1.8} />
                    Simulate Server Dry Run
                  </button>
                  {getAvailableTransitions(selectedRequest.status).map(nextStatus => (
                    (() => {
                      const blocksExecution = nextStatus === 'Approved' || nextStatus === 'Running' || nextStatus === 'Completed'
                      const governanceBlocked = Boolean(blocksExecution && selectedGovernance?.hardBlockers.length)
                      const runningBlocked = nextStatus === 'Running' && selectedExecutionPacket?.posture !== 'Ready For Server'
                      const completionBlocked = nextStatus === 'Completed' && selectedExecutionPacket?.posture !== 'Executing'
                      return (
                        <button
                          key={nextStatus}
                          className="ghost-action"
                          disabled={!canManage || governanceBlocked || runningBlocked || completionBlocked}
                          title={
                            governanceBlocked
                              ? selectedGovernance?.hardBlockers[0]
                              : runningBlocked
                                ? selectedExecutionPacket?.warnings[0] ?? 'Server packet is not ready.'
                                : completionBlocked
                                  ? 'Completion requires an executing server packet.'
                                  : undefined
                          }
                          onClick={() => transitionRequest(selectedRequest, nextStatus)}
                        >
                          {nextStatus === 'Blocked' || nextStatus === 'Failed'
                            ? <XCircle size={15} strokeWidth={1.8} />
                            : <CheckCircle2 size={15} strokeWidth={1.8} />}
                          {nextStatus}
                        </button>
                      )
                    })()
                  ))}
                  {!getAvailableTransitions(selectedRequest.status).length && (
                    <span className="muted-copy">No further placeholder transitions are available.</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No action request selected.</div>
          )}
        </aside>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Server-Side Handler Placeholders</h2>
            <span>Execution contracts to replace with real server actions after auth, permissions, audit, and rollback behavior are stable</span>
          </div>
        </div>
        <div className="action-handler-grid">
          {handlerList.map(handler => (
            <article key={handler.key} className="handler-card">
              <StatusPill label={mockServerHandlerRegistry[handler.key] ? 'Dry-run registered' : 'Placeholder'} tone={mockServerHandlerRegistry[handler.key] ? 'ok' : 'warn'} />
              <strong>{handler.label}</strong>
              <code>{handler.key}</code>
              <span>{mockServerHandlerRegistry[handler.key]?.simulatedWriteTarget ?? handler.description}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
