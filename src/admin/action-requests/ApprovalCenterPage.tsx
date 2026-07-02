import { AlertTriangle, CheckCircle2, Clock3, ClipboardCheck, Eye, FileCheck2, ListChecks, RotateCcw, ShieldCheck, UserCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import {
  approvalEvidencePackBoundaryRule,
  buildApprovalEvidencePack,
  getApprovalChecklistStatusTone,
  summarizeApprovalEvidencePacks,
  useLocalApprovalChecklistStates,
  type ApprovalChecklistItem,
  type ApprovalEvidencePack,
} from '../../lib/admin-actions/approvalEvidencePacks'
import {
  buildActionRequestGovernance,
  getGovernanceCheckTone,
  getGovernanceReadinessTone,
  getGovernanceRiskTone,
  type ActionRequestGovernanceRecord,
} from '../../lib/admin-actions/actionRequestGovernance'
import {
  formatAdminActionType,
  updateAdminActionRequestStatus,
  useLocalAdminActionRequests,
  type AdminActionRequest,
  type AdminActionRequestStatus,
} from '../../lib/admin-actions/actionRequests'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ApprovalCenterPageProps {
  session: AdminSession
}

interface ApprovalQueueRow {
  request: AdminActionRequest
  governance: ActionRequestGovernanceRecord
  lane: ApprovalLane
  approverFit: boolean
}

type ApprovalLane = 'Needs Approval' | 'Approved' | 'Blocked' | 'Draft Review' | 'Safety Review'
type ApprovalDecision = 'approved' | 'blocked'

interface ApprovalDecisionRecord {
  decision?: ApprovalDecision
  decidedBy?: string
  decidedByRole?: string
  decidedAt?: string
  note?: string
  auditEventId?: string
  riskLevel?: string
}

export default function ApprovalCenterPage({ session }: ApprovalCenterPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const [localChecklistStates, setLocalChecklistStates] = useLocalApprovalChecklistStates()
  const [selectedId, setSelectedId] = useState('')
  const [approvalNote, setApprovalNote] = useState('')
  const [notice, setNotice] = useState('')
  const canManageApprovals = hasPermission(session.role, 'admin_actions.manage')
  const currentRoleLabel = roleLabels[session.role]

  const requests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [data.adminActionRequests, localRequests])

  const governanceRecords = useMemo(() => buildActionRequestGovernance(requests, data), [data, requests])
  const governanceByRequestId = useMemo(() => new Map(governanceRecords.map(record => [record.requestId, record])), [governanceRecords])

  const rows = useMemo<ApprovalQueueRow[]>(() => requests
    .map(request => {
      const governance = governanceByRequestId.get(request.id)
      if (!governance) return null
      const lane = getApprovalLane(request.status, governance)
      const approverFit = canRoleApprove(currentRoleLabel, governance)
      return { request, governance, lane, approverFit }
    })
    .filter((row): row is ApprovalQueueRow => Boolean(row))
    .filter(row => row.request.status !== 'Completed')
    .sort((a, b) => getLanePriority(a.lane) - getLanePriority(b.lane)
      || new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime()),
  [currentRoleLabel, governanceByRequestId, requests])

  const selectedRow = rows.find(row => row.request.id === selectedId) ?? rows[0]
  const evidencePacks = useMemo(() => rows.map(row => buildApprovalEvidencePack(
    row.request,
    row.governance,
    localChecklistStates.find(state => state.requestId === row.request.id),
  )), [localChecklistStates, rows])
  const evidencePackByRequestId = useMemo(() => new Map(evidencePacks.map(pack => [pack.requestId, pack])), [evidencePacks])
  const evidenceSummary = useMemo(() => summarizeApprovalEvidencePacks(evidencePacks), [evidencePacks])
  const selectedEvidencePack = selectedRow ? evidencePackByRequestId.get(selectedRow.request.id) : undefined
  const pendingCount = rows.filter(row => row.lane === 'Needs Approval').length
  const approverFitCount = rows.filter(row => row.approverFit && row.lane === 'Needs Approval').length
  const highRiskCount = rows.filter(row => row.governance.riskLevel === 'Critical' || row.governance.riskLevel === 'High').length
  const blockedCount = rows.filter(row => row.lane === 'Blocked').length
  const approvedCount = rows.filter(row => row.request.status === 'Approved').length

  const recordDecision = (row: ApprovalQueueRow, decision: ApprovalDecision) => {
    if (decision === 'approved' && row.governance.hardBlockers.length) {
      setNotice(`Approval blocked: ${row.governance.hardBlockers[0]}`)
      return
    }
    if (decision === 'approved' && !row.approverFit) {
      setNotice(`${currentRoleLabel} is not listed as an approver for this policy.`)
      return
    }
    if (decision === 'approved' && row.request.status !== 'Queued') {
      setNotice('Approval requires a queued request.')
      return
    }
    const evidencePack = evidencePackByRequestId.get(row.request.id)
    if (decision === 'approved' && evidencePack && !evidencePack.readyForApproval) {
      setNotice('Approval requires the reviewer checklist to be fully confirmed.')
      return
    }

    const nextStatus: AdminActionRequestStatus = decision === 'approved' ? 'Approved' : 'Blocked'
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `approval_center.${decision}.mock`,
      actionLabel: `${decision === 'approved' ? 'Approved' : 'Blocked'} ${row.request.title}`,
      severity: decision === 'blocked' ? 'warning' : 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        previousStatus: row.request.status,
        nextStatus,
        riskLevel: row.governance.riskLevel,
        requiredApprovers: row.governance.requiredApprovers,
        approverRole: currentRoleLabel,
        approverFit: row.approverFit,
        humanConfirmationRequired: row.governance.humanConfirmationRequired,
        evidencePackSource: evidencePack?.source,
        checklistRequiredCount: evidencePack?.requiredCount,
        checklistConfirmedRequiredCount: evidencePack?.confirmedRequiredCount,
        checklistBlockedCount: evidencePack?.blockedCount,
        checklistReadyForApproval: evidencePack?.readyForApproval,
        approvalNote: approvalNote.trim(),
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const decisionRecord: ApprovalDecisionRecord = {
      decision,
      decidedBy: session.email,
      decidedByRole: currentRoleLabel,
      decidedAt: new Date().toISOString(),
      note: approvalNote.trim(),
      auditEventId: result.auditEvent.id,
      riskLevel: row.governance.riskLevel,
    }

    const updated = updateAdminActionRequestStatus(row.request, nextStatus, {
      transitionAuditEventId: result.auditEvent.id,
      statusReason: decision === 'blocked'
        ? approvalNote.trim() || 'manual_approval_block'
        : 'human_approval_recorded',
      metadata: {
        previousStatus: row.request.status,
        approvalDecision: decisionRecord,
        approvalEvidencePack: evidencePack ? {
          source: evidencePack.source,
          sourceCommitmentId: evidencePack.sourceCommitmentId,
          requiredCount: evidencePack.requiredCount,
          confirmedRequiredCount: evidencePack.confirmedRequiredCount,
          blockedCount: evidencePack.blockedCount,
          readyForApproval: evidencePack.readyForApproval,
        } : undefined,
      },
    })
    setSelectedId(updated.id)
    setApprovalNote('')
    setNotice(`${row.request.title} ${decision === 'approved' ? 'approved' : 'blocked'} and audit-recorded.`)
  }

  const confirmChecklistItems = (
    row: ApprovalQueueRow,
    pack: ApprovalEvidencePack,
    items: ApprovalChecklistItem[],
  ) => {
    const confirmableItems = items.filter(item => item.status !== 'Blocked')
    if (!confirmableItems.length) {
      setNotice('No confirmable checklist items are available for this request.')
      return
    }

    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `approval_center.checklist.confirm.${sanitizeActionKey(row.request.id)}.mock`,
      actionLabel: `Confirmed approval checklist for ${row.request.title}`,
      severity: pack.blockedCount ? 'warning' : 'notice',
      metadata: {
        actionRequestId: row.request.id,
        actionType: row.request.actionType,
        evidencePackSource: pack.source,
        sourceCommitmentId: pack.sourceCommitmentId,
        confirmedItemIds: confirmableItems.map(item => item.id),
        checklistRequiredCount: pack.requiredCount,
        checklistConfirmedRequiredCount: pack.confirmedRequiredCount,
        checklistBlockedCount: pack.blockedCount,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const updatedAt = new Date().toISOString()
    setLocalChecklistStates(current => {
      const existing = current.find(state => state.requestId === row.request.id)
      const confirmedItemIds = new Set(existing?.confirmedItemIds ?? [])
      confirmableItems.forEach(item => confirmedItemIds.add(item.id))
      return [
        {
          requestId: row.request.id,
          confirmedItemIds: [...confirmedItemIds],
          reviewedBy: session.email,
          reviewedAt: updatedAt,
          updatedAt,
        },
        ...current.filter(state => state.requestId !== row.request.id),
      ]
    })
    setSelectedId(row.request.id)
    setNotice(`${confirmableItems.length} checklist item${confirmableItems.length === 1 ? '' : 's'} confirmed and audit-recorded.`)
  }

  const resetChecklist = (row: ApprovalQueueRow) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: row.request.scope.label,
      actionKey: `approval_center.checklist.reset.${sanitizeActionKey(row.request.id)}.mock`,
      actionLabel: `Reset approval checklist for ${row.request.title}`,
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

    setLocalChecklistStates(current => current.filter(state => state.requestId !== row.request.id))
    setSelectedId(row.request.id)
    setNotice('Reviewer checklist reset locally and audit-recorded.')
  }

  const selectedDecision = selectedRow ? getApprovalDecision(selectedRow.request) : undefined
  const approveDisabled = !selectedRow
    || !canManageApprovals
    || !selectedRow.approverFit
    || selectedRow.request.status !== 'Queued'
    || Boolean(selectedRow.governance.hardBlockers.length)
    || !selectedEvidencePack?.readyForApproval
  const blockDisabled = !selectedRow
    || !canManageApprovals
    || selectedRow.request.status === 'Completed'
    || selectedRow.request.status === 'Running'

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Human Approval"
        title="Approval Center"
        description="Policy gate for high-impact action requests before server handlers can execute customer, billing, module, access, or agent-recommended changes."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Pending Approval" value={String(pendingCount)} delta={`${sourceLabel} plus local queue`} tone={pendingCount ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="My Review Fit" value={String(approverFitCount)} delta={`${currentRoleLabel} approval policy match`} tone={approverFitCount ? 'ok' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Critical / High Risk" value={String(highRiskCount)} delta="Requires deliberate sign-off" tone={highRiskCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Blocked" value={String(blockedCount)} delta="Stopped before execution" tone={blockedCount ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Approved" value={String(approvedCount)} delta="Eligible for execution packet review" tone={approvedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Human Gate" value={String(rows.filter(row => row.governance.humanConfirmationRequired).length)} delta="Policies requiring explicit confirmation" tone="neutral" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Audit Decisions" value={String(rows.filter(row => getApprovalDecision(row.request)?.auditEventId).length)} delta="Approval records with audit anchors" tone="ok" icon={<FileCheck2 size={16} />} />
        <MetricCard label="Production Writes" value="0" delta="Approval is not execution" tone="ok" icon={<ListChecks size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Launchpad Evidence" value={String(evidenceSummary.launchpad)} delta="Requests with commitment-origin packets" tone={evidenceSummary.launchpad ? 'ok' : 'neutral'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Checklist Ready" value={String(evidenceSummary.ready)} delta="Required reviewer items confirmed" tone={evidenceSummary.ready ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Checklist Blocked" value={String(evidenceSummary.blocked)} delta="Hard review blockers present" tone={evidenceSummary.blocked ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
        <MetricCard label="Evidence Items" value={String(evidenceSummary.evidenceItems)} delta="Attached source facts" tone={evidenceSummary.evidenceItems ? 'ok' : 'warn'} icon={<Eye size={16} />} />
      </div>

      <section className="panel approval-boundary-panel">
        <div>
          <p className="eyebrow">Approval Boundary</p>
          <h2>Approval unlocks review; it does not mutate production</h2>
          <span>Approval decisions update the local action-request ledger and write audit events. Real execution still belongs in server-side handlers with permission checks, rollback metadata, and immutable audit writes.</span>
          <span>{approvalEvidencePackBoundaryRule}</span>
        </div>
        <StatusPill label={canManageApprovals ? 'Decision controls enabled' : 'Review only'} tone={canManageApprovals ? 'ok' : 'warn'} />
      </section>

      <div className="approval-center-layout">
        <DataTable
          label="Approval Queue"
          rows={rows}
          pageSize={8}
          emptyTitle="No approval-relevant action requests are available."
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
              render: row => <StatusPill label={row.lane} tone={approvalLaneTone(row.lane)} />,
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => row.governance.riskLevel,
              render: row => <StatusPill label={row.governance.riskLevel} tone={getGovernanceRiskTone(row.governance.riskLevel)} />,
            },
            {
              key: 'readiness',
              header: 'Governance',
              sortable: true,
              searchValue: row => row.governance.readiness,
              render: row => <StatusPill label={row.governance.readiness} tone={getGovernanceReadinessTone(row.governance.readiness)} />,
            },
            {
              key: 'evidence',
              header: 'Evidence',
              sortable: true,
              searchValue: row => evidencePackByRequestId.get(row.request.id)?.source ?? 'None',
              render: row => {
                const pack = evidencePackByRequestId.get(row.request.id)
                return <StatusPill label={pack?.readyForApproval ? 'Checklist Ready' : pack?.source ?? 'No Pack'} tone={pack?.readyForApproval ? 'ok' : pack?.blockedCount ? 'danger' : pack?.source === 'Launchpad' ? 'warn' : 'neutral'} />
              },
            },
            {
              key: 'approvers',
              header: 'Approvers',
              sortable: true,
              searchValue: row => row.governance.requiredApprovers.join(' '),
              render: row => <div><strong>{row.governance.requiredApprovers.join(', ')}</strong><span className="cell-subtext">{row.approverFit ? 'Current role matches' : 'Different approver needed'}</span></div>,
            },
            {
              key: 'scope',
              header: 'Scope',
              sortable: true,
              searchValue: row => row.request.scope.label,
              render: row => row.request.scope.label,
            },
            {
              key: 'requestedBy',
              header: 'Requested By',
              sortable: true,
              searchValue: row => `${row.request.requestedBy.name} ${row.request.requestedBy.email ?? ''} ${row.request.requestedBy.role}`,
              render: row => <div><strong>{row.request.requestedBy.name}</strong><span className="cell-subtext">{row.request.requestedBy.role}</span></div>,
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

        <aside className="detail-panel approval-center-detail-panel">
          {selectedRow ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Approval Detail</p>
                  <h2>{selectedRow.request.title}</h2>
                </div>
                <StatusPill label={selectedRow.lane} tone={approvalLaneTone(selectedRow.lane)} />
              </div>

              <div className="request-scope-list">
                <div><span>Action Type</span><strong>{formatAdminActionType(selectedRow.request.actionType)}</strong></div>
                <div><span>Status</span><strong>{selectedRow.request.status}</strong></div>
                <div><span>Risk</span><strong>{selectedRow.governance.riskLevel}</strong></div>
                <div><span>Scope</span><strong>{selectedRow.request.scope.label}</strong></div>
                <div><span>Permission</span><strong>{selectedRow.request.permissionRequired}</strong></div>
                <div><span>Current Role</span><strong>{currentRoleLabel}</strong></div>
              </div>

              <section className={`panel approval-policy-panel tone-${selectedRow.governance.hardBlockers.length ? 'danger' : selectedRow.lane === 'Needs Approval' ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Policy</p>
                  <h2>{selectedRow.governance.humanConfirmationRequired ? 'Human confirmation required' : 'Safety-oriented approval'}</h2>
                  <span>{selectedRow.governance.policyReason}</span>
                </div>
                <div className="approval-policy-meta">
                  <StatusPill label={selectedRow.approverFit ? 'Role matches policy' : 'Different approver needed'} tone={selectedRow.approverFit ? 'ok' : 'warn'} />
                  <strong>{selectedRow.governance.requiredApprovers.join(', ')}</strong>
                </div>
              </section>

              {selectedEvidencePack && (
                <>
                  <div className="detail-section">
                    <h3>Evidence Pack</h3>
                    <div className="approval-context-grid">
                      {selectedEvidencePack.context.map(item => (
                        <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Source Evidence</h3>
                    {selectedEvidencePack.evidence.length ? (
                      <div className="settings-rule-list">
                        {selectedEvidencePack.evidence.map(item => (
                          <div key={item}>
                            <Eye size={16} strokeWidth={1.8} />
                            <strong>{item}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state compact">No launchpad evidence items are attached.</div>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Reviewer Checklist</h3>
                    <section className={`panel approval-checklist-summary-panel tone-${selectedEvidencePack.blockedCount ? 'danger' : selectedEvidencePack.readyForApproval ? 'ok' : 'warn'}`}>
                      <div>
                        <p className="eyebrow">Checklist Gate</p>
                        <h2>{selectedEvidencePack.confirmedRequiredCount} of {selectedEvidencePack.requiredCount} required items confirmed</h2>
                        <span>Approval stays disabled until required checklist items are confirmed and hard blockers are cleared.</span>
                      </div>
                      <StatusPill label={selectedEvidencePack.readyForApproval ? 'Ready for approval' : selectedEvidencePack.blockedCount ? 'Blocked' : 'Needs review'} tone={selectedEvidencePack.readyForApproval ? 'ok' : selectedEvidencePack.blockedCount ? 'danger' : 'warn'} />
                    </section>
                    <div className="support-actions approval-checklist-actions">
                      <button
                        className="ghost-action"
                        disabled={!canManageApprovals || !selectedEvidencePack.checklist.some(item => item.required && item.status === 'Pending')}
                        onClick={() => confirmChecklistItems(selectedRow, selectedEvidencePack, selectedEvidencePack.checklist.filter(item => item.required && item.status === 'Pending'))}
                      >
                        <ClipboardCheck size={15} strokeWidth={1.8} />
                        Confirm Required
                      </button>
                      <button
                        className="ghost-action"
                        disabled={!canManageApprovals || !selectedEvidencePack.localState?.confirmedItemIds.length}
                        onClick={() => resetChecklist(selectedRow)}
                      >
                        <RotateCcw size={15} strokeWidth={1.8} />
                        Reset Checklist
                      </button>
                    </div>
                    <div className="approval-checklist-list">
                      {selectedEvidencePack.checklist.map(item => (
                        <article key={item.id} className={`approval-checklist-item tone-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          <div>
                            <strong>{item.label}</strong>
                            <div>
                              {item.required && <StatusPill label="Required" tone="warn" />}
                              <StatusPill label={item.status} tone={getApprovalChecklistStatusTone(item.status)} />
                            </div>
                          </div>
                          <p>{item.detail}</p>
                          <button
                            className="ghost-action"
                            disabled={!canManageApprovals || item.status !== 'Pending'}
                            onClick={() => confirmChecklistItems(selectedRow, selectedEvidencePack, [item])}
                          >
                            <CheckCircle2 size={15} strokeWidth={1.8} />
                            Confirm
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="detail-section">
                <h3>Readiness Summary</h3>
                <div className="governance-summary-grid">
                  <div><span>Readiness</span><StatusPill label={selectedRow.governance.readiness} tone={getGovernanceReadinessTone(selectedRow.governance.readiness)} /></div>
                  <div><span>Risk</span><StatusPill label={selectedRow.governance.riskLevel} tone={getGovernanceRiskTone(selectedRow.governance.riskLevel)} /></div>
                  <div><span>Passed Checks</span><strong>{selectedRow.governance.passCount}</strong></div>
                  <div><span>Warnings</span><strong>{selectedRow.governance.warningCount}</strong></div>
                  <div><span>Hard Blockers</span><strong>{selectedRow.governance.hardBlockers.length}</strong></div>
                  <div><span>Audit Anchor</span><strong>{selectedRow.request.auditEventId}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Approval Checks</h3>
                <div className="governance-check-list">
                  {selectedRow.governance.checks.map(check => (
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

              <div className="detail-section">
                <h3>Request Context</h3>
                <div className="approval-context-grid">
                  <div><span>Reason</span><strong>{selectedRow.request.reason}</strong></div>
                  <div><span>Rollback</span><strong>{selectedRow.request.rollbackNotes}</strong></div>
                  <div><span>Server Handler</span><strong>{selectedRow.request.serverHandler.key}</strong></div>
                  <div><span>Handler Status</span><strong>{selectedRow.request.serverHandler.status}</strong></div>
                </div>
              </div>

              {selectedDecision?.auditEventId && (
                <div className="detail-section">
                  <h3>Latest Decision</h3>
                  <div className="approval-context-grid">
                    <div><span>Decision</span><strong>{selectedDecision.decision}</strong></div>
                    <div><span>Decided By</span><strong>{selectedDecision.decidedBy ?? 'Unknown'}</strong></div>
                    <div><span>Role</span><strong>{selectedDecision.decidedByRole ?? 'Unknown'}</strong></div>
                    <div><span>Audit</span><strong>{selectedDecision.auditEventId}</strong></div>
                    <div><span>Decided At</span><strong>{selectedDecision.decidedAt ? formatDateTime(selectedDecision.decidedAt) : 'Unknown'}</strong></div>
                    <div><span>Note</span><strong>{selectedDecision.note || 'No note recorded'}</strong></div>
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Decision Panel</h3>
                <label className="approval-note-field">
                  <span>Review note</span>
                  <textarea
                    value={approvalNote}
                    onChange={event => setApprovalNote(event.target.value)}
                    rows={4}
                    placeholder="Decision context, evidence, or blocker"
                  />
                </label>
                <div className="support-actions approval-actions">
                  <button
                    className="ghost-action"
                    disabled={approveDisabled}
                    onClick={() => recordDecision(selectedRow, 'approved')}
                    title={approveDisabled ? getApproveDisabledReason(selectedRow, canManageApprovals, currentRoleLabel, selectedEvidencePack) : undefined}
                  >
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Approve
                  </button>
                  <button
                    className="ghost-action"
                    disabled={blockDisabled}
                    onClick={() => recordDecision(selectedRow, 'blocked')}
                    title={blockDisabled ? 'Blocking is available for draft, queued, or approved requests.' : undefined}
                  >
                    <XCircle size={15} strokeWidth={1.8} />
                    Block
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No approval request selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function getApprovalLane(
  status: AdminActionRequestStatus,
  governance: ActionRequestGovernanceRecord,
): ApprovalLane {
  if (status === 'Blocked' || status === 'Failed' || governance.readiness === 'Blocked') return 'Blocked'
  if (status === 'Approved' || governance.readiness === 'Ready') return 'Approved'
  if (status === 'Draft') return 'Draft Review'
  if (governance.readiness === 'Needs Approval') return 'Needs Approval'
  return 'Safety Review'
}

function approvalLaneTone(lane: ApprovalLane): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (lane === 'Approved') return 'ok'
  if (lane === 'Blocked') return 'danger'
  if (lane === 'Needs Approval') return 'warn'
  if (lane === 'Safety Review') return 'info'
  return 'neutral'
}

function canRoleApprove(roleLabel: string, governance: ActionRequestGovernanceRecord) {
  return roleLabel === 'Owner'
    || roleLabel === 'Admin'
    || governance.requiredApprovers.includes(roleLabel)
    || (governance.requiredApprovers.includes('Domain Owner') && roleLabel !== 'Read Only')
}

function getLanePriority(lane: ApprovalLane) {
  if (lane === 'Needs Approval') return 0
  if (lane === 'Draft Review') return 1
  if (lane === 'Blocked') return 2
  if (lane === 'Approved') return 3
  return 4
}

function getApprovalDecision(request: AdminActionRequest): ApprovalDecisionRecord | undefined {
  const decision = request.metadata?.approvalDecision
  if (!decision || typeof decision !== 'object') return undefined
  return decision as ApprovalDecisionRecord
}

function getApproveDisabledReason(
  row: ApprovalQueueRow,
  canManageApprovals: boolean,
  roleLabel: string,
  evidencePack: ApprovalEvidencePack | undefined,
) {
  if (!canManageApprovals) return `${roleLabel} cannot record approval decisions.`
  if (!row.approverFit) return `${roleLabel} is not listed as an approver for this policy.`
  if (row.request.status !== 'Queued') return 'Approval requires a queued request.'
  if (row.governance.hardBlockers.length) return row.governance.hardBlockers[0]
  if (!evidencePack?.readyForApproval) return 'Approval requires the reviewer checklist to be fully confirmed.'
  return undefined
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
