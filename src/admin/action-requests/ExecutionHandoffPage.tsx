import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Database, FileCheck2, PlayCircle, RotateCcw, Send, ServerCog, ShieldCheck, XCircle } from 'lucide-react'
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
  type ActionExecutionPacket,
} from '../../lib/admin-actions/actionExecutionContract'
import {
  buildActionRequestGovernance,
  getGovernanceReadinessTone,
  getGovernanceRiskTone,
  type ActionRequestGovernanceRecord,
} from '../../lib/admin-actions/actionRequestGovernance'
import {
  formatAdminActionType,
  updateAdminActionRequestStatus,
  useLocalAdminActionRequests,
  type AdminActionRequest,
} from '../../lib/admin-actions/actionRequests'
import {
  getLatestMockServerExecution,
  getMockServerExecutionStatusTone,
  runMockServerExecution,
  useLocalMockServerExecutions,
} from '../../lib/admin-actions/mockServerExecutor'
import {
  buildExecutionHandoffReadinessPack,
  executionHandoffReadinessBoundaryRule,
  getExecutionHandoffChecklistTone,
  getExecutionHandoffReadinessTone,
  summarizeExecutionHandoffReadiness,
  useLocalExecutionHandoffReadinessStates,
  type ExecutionHandoffChecklistItem,
  type ExecutionHandoffReadinessPack,
} from '../../lib/admin-actions/executionHandoffReadiness'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ExecutionHandoffPageProps {
  session: AdminSession
}

interface ExecutionHandoffRow {
  request: AdminActionRequest
  governance: ActionRequestGovernanceRecord
  packet: ActionExecutionPacket
  lane: HandoffLane
}

type HandoffLane = 'Server Ready' | 'Review Only' | 'Pending Approval' | 'Blocked' | 'Executing' | 'Completed'

interface ExecutionHandoffRecord {
  reviewedBy?: string
  reviewedAt?: string
  auditEventId?: string
  lane?: HandoffLane
  posture?: string
  endpointLabel?: string
  idempotencyKey?: string
  correlationId?: string
  note?: string
}

export default function ExecutionHandoffPage({ session }: ExecutionHandoffPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localMockServerExecutions = useLocalMockServerExecutions()
  const [localReadinessStates, setLocalReadinessStates] = useLocalExecutionHandoffReadinessStates()
  const [selectedId, setSelectedId] = useState('')
  const [handoffNote, setHandoffNote] = useState('')
  const [notice, setNotice] = useState('')
  const canManage = hasPermission(session.role, 'admin_actions.manage')

  const requests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [data.adminActionRequests, localRequests])

  const governanceRecords = useMemo(() => buildActionRequestGovernance(requests, data), [data, requests])
  const governanceByRequestId = useMemo(() => new Map(governanceRecords.map(record => [record.requestId, record])), [governanceRecords])
  const executionConfig = getActionExecutionConfig(import.meta.env)
  const packets = useMemo(() => buildActionExecutionPackets(requests, governanceByRequestId, executionConfig), [executionConfig, governanceByRequestId, requests])
  const packetByRequestId = useMemo(() => new Map(packets.map(packet => [packet.requestId, packet])), [packets])
  const executionSummary = useMemo(() => summarizeActionExecution(packets), [packets])

  const rows = useMemo<ExecutionHandoffRow[]>(() => requests
    .map(request => {
      const governance = governanceByRequestId.get(request.id)
      const packet = packetByRequestId.get(request.id)
      if (!governance || !packet) return null
      return {
        request,
        governance,
        packet,
        lane: getHandoffLane(request, governance, packet),
      }
    })
    .filter((row): row is ExecutionHandoffRow => Boolean(row))
    .sort((a, b) => getLanePriority(a.lane) - getLanePriority(b.lane)
      || new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime()),
  [governanceByRequestId, packetByRequestId, requests])

  const selectedRow = rows.find(row => row.request.id === selectedId) ?? rows[0]
  const selectedMockExecution = selectedRow ? getLatestMockServerExecution(selectedRow.request.id, localMockServerExecutions) : undefined
  const selectedHandoff = selectedRow ? getExecutionHandoffRecord(selectedRow.request) : undefined
  const readinessPacks = useMemo(() => rows.map(row => buildExecutionHandoffReadinessPack({
    request: row.request,
    governance: row.governance,
    packet: row.packet,
    latestDryRun: getLatestMockServerExecution(row.request.id, localMockServerExecutions),
    localState: localReadinessStates.find(state => state.requestId === row.request.id),
  })), [localMockServerExecutions, localReadinessStates, rows])
  const readinessPackByRequestId = useMemo(() => new Map(readinessPacks.map(pack => [pack.requestId, pack])), [readinessPacks])
  const readinessSummary = useMemo(() => summarizeExecutionHandoffReadiness(readinessPacks), [readinessPacks])
  const selectedReadinessPack = selectedRow ? readinessPackByRequestId.get(selectedRow.request.id) : undefined
  const candidatesCount = rows.filter(row => row.request.status === 'Approved' || row.request.status === 'Running').length
  const reviewOnlyCount = rows.filter(row => row.lane === 'Review Only').length
  const blockedCount = rows.filter(row => row.lane === 'Blocked').length
  const handoffRecordedCount = rows.filter(row => getExecutionHandoffRecord(row.request)?.auditEventId).length
  const dryRunCount = rows.filter(row => getLatestMockServerExecution(row.request.id, localMockServerExecutions)).length

  const recordHandoffReview = (row: ExecutionHandoffRow) => {
    const readinessPack = readinessPackByRequestId.get(row.request.id)
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: 'execution_handoff.review_recorded.mock',
      actionLabel: `Reviewed execution handoff for ${row.request.title}`,
      severity: row.packet.blockers.length ? 'warning' : 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        serverHandlerKey: row.packet.handlerKey,
        executionPosture: row.packet.posture,
        handoffLane: row.lane,
        endpointLabel: row.packet.endpointLabel,
        idempotencyKey: row.packet.idempotencyKey,
        correlationId: row.packet.correlationId,
        blockers: row.packet.blockers,
        warnings: row.packet.warnings,
        readinessStatus: readinessPack?.status,
        readinessReadyForDryRun: readinessPack?.readyForDryRun,
        readinessReadyForServer: readinessPack?.readyForServer,
        readinessRequiredCount: readinessPack?.requiredCount,
        readinessConfirmedRequiredCount: readinessPack?.confirmedRequiredCount,
        mutationApplied: false,
        handoffNote: handoffNote.trim(),
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const handoffRecord: ExecutionHandoffRecord = {
      reviewedBy: session.email,
      reviewedAt: new Date().toISOString(),
      auditEventId: result.auditEvent.id,
      lane: row.lane,
      posture: row.packet.posture,
      endpointLabel: row.packet.endpointLabel,
      idempotencyKey: row.packet.idempotencyKey,
      correlationId: row.packet.correlationId,
      note: handoffNote.trim(),
    }

    const updated = updateAdminActionRequestStatus(row.request, row.request.status, {
      transitionAuditEventId: result.auditEvent.id,
      statusReason: row.packet.blockers.length ? 'execution_handoff_review_blocked' : 'execution_handoff_review_recorded',
      metadata: {
        executionHandoff: handoffRecord,
      },
    })
    setSelectedId(updated.id)
    setHandoffNote('')
    setNotice(`Handoff review recorded for ${row.request.title}.`)
  }

  const assignExecutor = (row: ExecutionHandoffRow) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `execution_handoff.readiness.assign.${sanitizeActionKey(row.request.id)}.mock`,
      actionLabel: `Assigned execution handoff owner for ${row.request.title}`,
      severity: 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        assignedExecutor: session.email,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalReadinessStates(current => {
      const existing = current.find(state => state.requestId === row.request.id)
      return [
        {
          requestId: row.request.id,
          confirmedItemIds: existing?.confirmedItemIds ?? [],
          assignedExecutor: session.email,
          handoffWindow: existing?.handoffWindow ?? scheduleInHours(2),
          note: existing?.note,
          reviewedBy: session.email,
          reviewedAt: updatedAt,
          updatedAt,
        },
        ...current.filter(state => state.requestId !== row.request.id),
      ]
    })
    setSelectedId(row.request.id)
    setNotice(`${row.request.title} assigned to ${session.email} for execution handoff.`)
  }

  const confirmReadinessItems = (
    row: ExecutionHandoffRow,
    pack: ExecutionHandoffReadinessPack,
    items: ExecutionHandoffChecklistItem[],
  ) => {
    const confirmableItems = items.filter(item => item.status !== 'Blocked')
    if (!confirmableItems.length) {
      setNotice('No confirmable readiness items are available for this handoff.')
      return
    }

    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `execution_handoff.readiness.confirm.${sanitizeActionKey(row.request.id)}.mock`,
      actionLabel: `Confirmed execution readiness for ${row.request.title}`,
      severity: pack.blockedCount ? 'warning' : 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        readinessStatus: pack.status,
        confirmedItemIds: confirmableItems.map(item => item.id),
        readinessRequiredCount: pack.requiredCount,
        readinessConfirmedRequiredCount: pack.confirmedRequiredCount,
        readinessBlockedCount: pack.blockedCount,
        dryRunStatus: pack.dryRunStatus,
        readyForDryRun: pack.readyForDryRun,
        readyForServer: pack.readyForServer,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalReadinessStates(current => {
      const existing = current.find(state => state.requestId === row.request.id)
      const confirmedItemIds = new Set(existing?.confirmedItemIds ?? [])
      confirmableItems.forEach(item => confirmedItemIds.add(item.id))
      return [
        {
          requestId: row.request.id,
          confirmedItemIds: [...confirmedItemIds],
          assignedExecutor: existing?.assignedExecutor,
          handoffWindow: existing?.handoffWindow,
          note: handoffNote.trim() || existing?.note,
          reviewedBy: session.email,
          reviewedAt: updatedAt,
          updatedAt,
        },
        ...current.filter(state => state.requestId !== row.request.id),
      ]
    })
    setSelectedId(row.request.id)
    setNotice(`${confirmableItems.length} readiness item${confirmableItems.length === 1 ? '' : 's'} confirmed and audit-recorded.`)
  }

  const resetReadiness = (row: ExecutionHandoffRow) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `execution_handoff.readiness.reset.${sanitizeActionKey(row.request.id)}.mock`,
      actionLabel: `Reset execution handoff readiness for ${row.request.title}`,
      severity: 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalReadinessStates(current => current.filter(state => state.requestId !== row.request.id))
    setSelectedId(row.request.id)
    setNotice('Execution readiness reset locally and audit-recorded.')
  }

  const simulateServerDryRun = (row: ExecutionHandoffRow) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: 'execution_handoff.mock_server.dry_run',
      actionLabel: `Dry-run handoff packet for ${row.request.title}`,
      severity: row.packet.blockers.length ? 'warning' : 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        serverHandlerKey: row.packet.handlerKey,
        executionPosture: row.packet.posture,
        handoffLane: row.lane,
        idempotencyKey: row.packet.idempotencyKey,
        dryRun: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = runMockServerExecution({
      request: row.request,
      packet: row.packet,
      governance: row.governance,
      data,
      auditEvent: result.auditEvent,
    })
    setSelectedId(row.request.id)
    setNotice(`${record.status}: ${record.outcomeSummary}`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Server Execution Review"
        title="Execution Handoff"
        description="Final packet review before mock or future server handlers receive approved action requests, with endpoint posture, idempotency, correlation, audit, and rollback checks in one place."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Handoff Candidates" value={String(candidatesCount)} delta={`${sourceLabel} plus local queue`} tone={candidatesCount ? 'warn' : 'neutral'} icon={<Send size={16} />} />
        <MetricCard label="Server Ready" value={String(executionSummary.readyForServer)} delta={executionConfig.endpoint ? 'Endpoint configured' : 'Endpoint not configured'} tone={executionSummary.readyForServer ? 'ok' : 'neutral'} icon={<ServerCog size={16} />} />
        <MetricCard label="Review Only" value={String(reviewOnlyCount)} delta="Browser-visible contracts" tone={reviewOnlyCount ? 'warn' : 'ok'} icon={<FileCheck2 size={16} />} />
        <MetricCard label="Blocked" value={String(blockedCount)} delta="Preflight blockers present" tone={blockedCount ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Executing / Done" value={String(executionSummary.executing + executionSummary.completed)} delta="Server-state placeholders" tone={executionSummary.executing ? 'neutral' : 'ok'} icon={<PlayCircle size={16} />} />
        <MetricCard label="Dry Runs" value={String(dryRunCount)} delta="Linked mock server previews" tone={dryRunCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Handoff Reviews" value={String(handoffRecordedCount)} delta="Audit-recorded reviews" tone={handoffRecordedCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Production Writes" value="0" delta="Handoff is not execution" tone="ok" icon={<Database size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Assigned" value={String(readinessSummary.assigned)} delta="Human executor selected" tone={readinessSummary.assigned ? 'ok' : 'warn'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Ready For Dry Run" value={String(readinessSummary.readyForDryRun)} delta={`${readinessSummary.needsReview} need review`} tone={readinessSummary.readyForDryRun ? 'ok' : 'warn'} icon={<ServerCog size={16} />} />
        <MetricCard label="Ready For Server" value={String(readinessSummary.readyForServer)} delta="Endpoint and dry run clear" tone={readinessSummary.readyForServer ? 'ok' : 'neutral'} icon={<Send size={16} />} />
        <MetricCard label="Readiness Blocked" value={String(readinessSummary.blocked)} delta="Assignment, approval, governance, or rollback blocker" tone={readinessSummary.blocked ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <section className="panel handoff-boundary-panel">
        <div>
          <p className="eyebrow">Handoff Boundary</p>
          <h2>Handoff prepares server work; it never runs customer-state mutations in the browser</h2>
          <span>{actionExecutionBoundaryRule}</span>
          <span>{executionHandoffReadinessBoundaryRule}</span>
        </div>
        <StatusPill label={canManage ? 'Handoff controls enabled' : 'Review only'} tone={canManage ? 'ok' : 'warn'} />
      </section>

      <div className="execution-handoff-layout">
        <DataTable
          label="Execution Handoff Queue"
          rows={rows}
          pageSize={8}
          emptyTitle="No action requests are available for execution handoff."
          columns={[
            {
              key: 'request',
              header: 'Request',
              sortable: true,
              searchValue: row => `${row.request.title} ${formatAdminActionType(row.request.actionType)}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.request.id)}>
                  {row.request.title}
                </button>
              ),
            },
            {
              key: 'lane',
              header: 'Lane',
              sortable: true,
              searchValue: row => row.lane,
              render: row => <StatusPill label={row.lane} tone={handoffLaneTone(row.lane)} />,
            },
            {
              key: 'posture',
              header: 'Posture',
              sortable: true,
              searchValue: row => row.packet.posture,
              render: row => <StatusPill label={row.packet.posture} tone={getExecutionPostureTone(row.packet.posture)} />,
            },
            {
              key: 'governance',
              header: 'Governance',
              sortable: true,
              searchValue: row => row.governance.readiness,
              render: row => <StatusPill label={row.governance.readiness} tone={getGovernanceReadinessTone(row.governance.readiness)} />,
            },
            {
              key: 'readiness',
              header: 'Readiness',
              sortable: true,
              searchValue: row => readinessPackByRequestId.get(row.request.id)?.status ?? 'Needs Review',
              render: row => {
                const pack = readinessPackByRequestId.get(row.request.id)
                return <StatusPill label={pack?.status ?? 'Needs Review'} tone={pack ? getExecutionHandoffReadinessTone(pack.status) : 'warn'} />
              },
            },
            {
              key: 'handler',
              header: 'Handler',
              sortable: true,
              searchValue: row => `${row.request.serverHandler.label} ${row.packet.handlerKey}`,
              render: row => <div><strong>{row.request.serverHandler.label}</strong><span className="cell-subtext">{row.packet.handlerKey}</span></div>,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.request.scope.label,
              render: row => row.request.scope.label,
            },
            {
              key: 'dryRun',
              header: 'Dry Run',
              sortable: true,
              searchValue: row => getLatestMockServerExecution(row.request.id, localMockServerExecutions)?.status ?? 'Not simulated',
              render: row => {
                const record = getLatestMockServerExecution(row.request.id, localMockServerExecutions)
                return record
                  ? <StatusPill label={record.status} tone={getMockServerExecutionStatusTone(record.status)} />
                  : <StatusPill label="Not simulated" tone="neutral" />
              },
            },
            {
              key: 'created',
              header: 'Created',
              sortable: true,
              searchValue: row => row.request.createdAt,
              render: row => formatDateTime(row.request.createdAt),
            },
          ]}
        />

        <aside className="detail-panel execution-handoff-detail-panel">
          {selectedRow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Handoff Detail</p>
                  <h2>{selectedRow.request.title}</h2>
                </div>
                <StatusPill label={selectedRow.lane} tone={handoffLaneTone(selectedRow.lane)} />
              </div>

              <div className="request-scope-list">
                <div><span>Action Type</span><strong>{formatAdminActionType(selectedRow.request.actionType)}</strong></div>
                <div><span>Status</span><strong>{selectedRow.request.status}</strong></div>
                <div><span>Risk</span><strong>{selectedRow.governance.riskLevel}</strong></div>
                <div><span>Scope</span><strong>{selectedRow.request.scope.label}</strong></div>
                <div><span>Permission</span><strong>{selectedRow.request.permissionRequired}</strong></div>
                <div><span>Endpoint</span><strong>{selectedRow.packet.endpointLabel}</strong></div>
              </div>

              <section className={`panel handoff-status-panel tone-${selectedRow.packet.blockers.length ? 'danger' : selectedRow.packet.warnings.length ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Packet Posture</p>
                  <h2>{selectedRow.packet.posture}</h2>
                  <span>{getHandoffNarrative(selectedRow)}</span>
                </div>
                <div className="handoff-status-meta">
                  <StatusPill label={`${selectedRow.packet.blockers.length} blockers`} tone={selectedRow.packet.blockers.length ? 'danger' : 'ok'} />
                  <strong>{selectedRow.packet.warnings.length} warnings</strong>
                </div>
              </section>

              {selectedReadinessPack && (
                <div className="detail-section">
                  <h3>Readiness Pack</h3>
                  <section className={`panel handoff-readiness-panel tone-${getExecutionHandoffReadinessTone(selectedReadinessPack.status)}`}>
                    <div>
                      <p className="eyebrow">Execution Readiness</p>
                      <h2>{selectedReadinessPack.status}</h2>
                      <span>{selectedReadinessPack.confirmedRequiredCount} of {selectedReadinessPack.requiredCount} required items confirmed. Assigned executor: {selectedReadinessPack.assignedExecutor ?? 'Not assigned'}.</span>
                    </div>
                    <div className="handoff-readiness-meta">
                      <StatusPill label={selectedReadinessPack.dryRunStatus} tone={selectedReadinessPack.dryRunStatus === 'Dry Run Passed' || selectedReadinessPack.dryRunStatus === 'Completed Snapshot' ? 'ok' : selectedReadinessPack.dryRunStatus === 'Dry Run Blocked' ? 'danger' : 'warn'} />
                      <strong>{selectedReadinessPack.handoffWindow ? formatDateTime(selectedReadinessPack.handoffWindow) : 'No window set'}</strong>
                    </div>
                  </section>

                  <div className="support-actions handoff-readiness-actions">
                    <button
                      className="ghost-action"
                      disabled={!canManage}
                      onClick={() => assignExecutor(selectedRow)}
                    >
                      <ClipboardCheck size={15} strokeWidth={1.8} />
                      Assign To Me
                    </button>
                    <button
                      className="ghost-action"
                      disabled={!canManage || !selectedReadinessPack.checklist.some(item => item.required && item.status === 'Pending')}
                      onClick={() => confirmReadinessItems(selectedRow, selectedReadinessPack, selectedReadinessPack.checklist.filter(item => item.required && item.status === 'Pending'))}
                    >
                      <CheckCircle2 size={15} strokeWidth={1.8} />
                      Confirm Required
                    </button>
                    <button
                      className="ghost-action"
                      disabled={!canManage || !selectedReadinessPack.localState}
                      onClick={() => resetReadiness(selectedRow)}
                    >
                      <RotateCcw size={15} strokeWidth={1.8} />
                      Reset Readiness
                    </button>
                  </div>

                  <div className="handoff-readiness-list">
                    {selectedReadinessPack.checklist.map(item => (
                      <article key={item.id} className={`handoff-readiness-item tone-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div>
                          <strong>{item.label}</strong>
                          <div>
                            {item.required && <StatusPill label="Required" tone="warn" />}
                            <StatusPill label={item.status} tone={getExecutionHandoffChecklistTone(item.status)} />
                          </div>
                        </div>
                        <p>{item.detail}</p>
                        <button
                          className="ghost-action"
                          disabled={!canManage || item.status !== 'Pending'}
                          onClick={() => confirmReadinessItems(selectedRow, selectedReadinessPack, [item])}
                        >
                          <CheckCircle2 size={15} strokeWidth={1.8} />
                          Confirm
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Execution Packet</h3>
                <div className="execution-packet-grid">
                  <div><span>Route</span><strong>{selectedRow.packet.method} {selectedRow.packet.route}</strong></div>
                  <div><span>Handler</span><strong>{selectedRow.packet.handlerKey}</strong></div>
                  <div><span>Idempotency</span><strong>{selectedRow.packet.idempotencyKey}</strong></div>
                  <div><span>Correlation</span><strong>{selectedRow.packet.correlationId}</strong></div>
                  <div><span>Browser Mutation</span><strong>{selectedRow.packet.browserMutationAllowed ? 'Allowed' : 'Disabled'}</strong></div>
                  <div><span>Audit</span><strong>{selectedRow.packet.payloadPreview.auditEventId}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Preflight Stages</h3>
                <div className="governance-check-list">
                  {selectedRow.packet.stages.map(stage => (
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
                <h3>Governance Snapshot</h3>
                <div className="governance-summary-grid">
                  <div><span>Readiness</span><StatusPill label={selectedRow.governance.readiness} tone={getGovernanceReadinessTone(selectedRow.governance.readiness)} /></div>
                  <div><span>Risk</span><StatusPill label={selectedRow.governance.riskLevel} tone={getGovernanceRiskTone(selectedRow.governance.riskLevel)} /></div>
                  <div><span>Approvers</span><strong>{selectedRow.governance.requiredApprovers.join(', ')}</strong></div>
                  <div><span>Human Gate</span><strong>{selectedRow.governance.humanConfirmationRequired ? 'Required' : 'Not required'}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Payload Preview</h3>
                <div className="execution-payload-preview">
                  <div><span>Request</span><strong>{selectedRow.packet.payloadPreview.requestId}</strong></div>
                  <div><span>Action</span><strong>{formatAdminActionType(selectedRow.packet.payloadPreview.actionType)}</strong></div>
                  <div><span>Scope</span><strong>{selectedRow.packet.payloadPreview.scope}</strong></div>
                  <div><span>Requested By</span><strong>{selectedRow.packet.payloadPreview.requestedBy}</strong></div>
                  <div><span>Permission</span><strong>{selectedRow.packet.payloadPreview.permissionRequired}</strong></div>
                  <div><span>Metadata Keys</span><strong>{selectedRow.packet.payloadPreview.metadataKeys.join(', ') || 'None'}</strong></div>
                </div>
              </div>

              {selectedMockExecution && (
                <div className="detail-section">
                  <h3>Latest Dry Run</h3>
                  <div className="mock-execution-grid">
                    <div><span>Status</span><StatusPill label={selectedMockExecution.status} tone={getMockServerExecutionStatusTone(selectedMockExecution.status)} /></div>
                    <div><span>Target</span><strong>{selectedMockExecution.simulatedWriteTarget}</strong></div>
                    <div><span>Duration</span><strong>{selectedMockExecution.durationMs} ms</strong></div>
                    <div><span>Mutation Applied</span><strong>{selectedMockExecution.mutationApplied ? 'Yes' : 'No'}</strong></div>
                  </div>
                  <p className="muted-copy">{selectedMockExecution.outcomeSummary}</p>
                </div>
              )}

              {selectedHandoff?.auditEventId && (
                <div className="detail-section">
                  <h3>Latest Handoff Review</h3>
                  <div className="settings-rule-list">
                    <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Audit event: {selectedHandoff.auditEventId}</strong></div>
                    <div><Send size={16} strokeWidth={1.8} /><strong>Reviewed by: {selectedHandoff.reviewedBy ?? 'Unknown'}</strong></div>
                    <div><Clock3 size={16} strokeWidth={1.8} /><strong>Reviewed at: {selectedHandoff.reviewedAt ? formatDateTime(selectedHandoff.reviewedAt) : 'Unknown'}</strong></div>
                    <div><ServerCog size={16} strokeWidth={1.8} /><strong>{selectedHandoff.lane ?? 'Unknown'} / {selectedHandoff.posture ?? 'Unknown'}</strong></div>
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Handoff Note</h3>
                <label className="approval-note-field">
                  <span>Review note</span>
                  <textarea
                    value={handoffNote}
                    onChange={event => setHandoffNote(event.target.value)}
                    rows={4}
                    placeholder="Packet review notes, endpoint readiness, or server handoff concern"
                  />
                </label>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canManage}
                    onClick={() => recordHandoffReview(selectedRow)}
                  >
                    <FileCheck2 size={15} strokeWidth={1.8} />
                    Record Handoff Review
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManage}
                    onClick={() => simulateServerDryRun(selectedRow)}
                  >
                    <ServerCog size={15} strokeWidth={1.8} />
                    Simulate Server Dry Run
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No handoff record selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function getHandoffLane(
  request: AdminActionRequest,
  governance: ActionRequestGovernanceRecord,
  packet: ActionExecutionPacket,
): HandoffLane {
  if (request.status === 'Completed') return 'Completed'
  if (request.status === 'Running') return packet.blockers.length ? 'Blocked' : 'Executing'
  if (packet.blockers.length || governance.readiness === 'Blocked') return 'Blocked'
  if (request.status !== 'Approved') return 'Pending Approval'
  if (packet.posture === 'Ready For Server') return 'Server Ready'
  return 'Review Only'
}

function handoffLaneTone(lane: HandoffLane): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (lane === 'Server Ready' || lane === 'Completed') return 'ok'
  if (lane === 'Executing') return 'info'
  if (lane === 'Blocked') return 'danger'
  if (lane === 'Review Only' || lane === 'Pending Approval') return 'warn'
  return 'neutral'
}

function getLanePriority(lane: HandoffLane) {
  if (lane === 'Server Ready') return 0
  if (lane === 'Review Only') return 1
  if (lane === 'Blocked') return 2
  if (lane === 'Pending Approval') return 3
  if (lane === 'Executing') return 4
  return 5
}

function getExecutionHandoffRecord(request: AdminActionRequest): ExecutionHandoffRecord | undefined {
  const handoff = request.metadata?.executionHandoff
  if (!handoff || typeof handoff !== 'object') return undefined
  return handoff as ExecutionHandoffRecord
}

function getHandoffNarrative(row: ExecutionHandoffRow) {
  if (row.packet.blockers.length) return row.packet.blockers[0]
  if (row.lane === 'Server Ready') return 'This approved request has a configured endpoint and passed execution preflight.'
  if (row.lane === 'Review Only') return 'This request is approved, but no server endpoint is configured, so it remains a review-only handoff packet.'
  if (row.lane === 'Pending Approval') return 'This request still needs approval before server handoff.'
  if (row.lane === 'Executing') return 'This request is marked running in the action queue.'
  return 'Execution handoff is complete or waiting for a safer queue state.'
}

function scheduleInHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function sanitizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
