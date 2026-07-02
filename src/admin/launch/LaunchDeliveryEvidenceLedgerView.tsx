import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Download, FileText, GitBranch, Search, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import type { LaunchCommsApprovalAudience } from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import {
  getLaunchDeliveryEvidenceAudienceTone,
  getLaunchDeliveryEvidenceCheckTone,
  getLaunchDeliveryEvidenceItemTone,
  getLaunchDeliveryEvidenceLedgerTone,
  getLaunchDeliveryEvidenceMetricTone,
  launchDeliveryEvidenceBoundaryRule,
  type LaunchDeliveryEvidenceItem,
  type LaunchDeliveryEvidenceItemStatus,
  type LaunchDeliveryEvidenceLedger,
  type LaunchDeliveryEvidenceRecord,
} from '../../lib/launch-readiness/launchDeliveryEvidenceLedger'
import type { LaunchPostLaunchSurface } from '../../lib/launch-readiness/launchPostLaunchWatchtower'

interface LaunchDeliveryEvidenceLedgerViewProps {
  ledger: LaunchDeliveryEvidenceLedger
  records: LaunchDeliveryEvidenceRecord[]
  selectedItem?: LaunchDeliveryEvidenceItem
  canRecordEvidence: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchDeliveryEvidenceItem) => void
  onRecordEvidence: (item?: LaunchDeliveryEvidenceItem, status?: LaunchDeliveryEvidenceItemStatus) => void
  onQueueEvidenceReview: (item: LaunchDeliveryEvidenceItem) => void
  onExport: () => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function LaunchDeliveryEvidenceLedgerView({
  ledger,
  records,
  selectedItem,
  canRecordEvidence,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordEvidence,
  onQueueEvidenceReview,
  onExport,
}: LaunchDeliveryEvidenceLedgerViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Evidence Status" value={ledger.status} delta={ledger.headline} tone={getLaunchDeliveryEvidenceMetricTone(ledger.status)} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Needs Proof" value={String(ledger.needsProofCount)} delta="Delivery evidence not attached" tone={ledger.needsProofCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
        <MetricCard label="Proof Review" value={String(ledger.proofReviewCount)} delta="Human evidence review" tone={ledger.proofReviewCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Evidence Complete" value={String(ledger.completeCount)} delta="Ready for packet retention" tone={ledger.completeCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Blocked" value={String(ledger.blockedCount)} delta="Scope or proof issue" tone={ledger.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Customer Facing" value={String(ledger.customerFacingCount)} delta="Final evidence required" tone={ledger.customerFacingCount ? 'warn' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Handoff Backed" value={`${ledger.sourceHandoffCount}/${ledger.items.length}`} delta="Send review handoff exists" tone={ledger.sourceHandoffCount ? 'ok' : 'warn'} icon={<GitBranch size={16} />} />
        <MetricCard label="Evidence Records" value={String(ledger.recordCount)} delta={ledger.latestRecord ? formatDateTime(ledger.latestRecord.recordedAt) : 'No delivery evidence record'} tone={ledger.recordCount ? 'ok' : 'neutral'} icon={<Clock3 size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchDeliveryEvidenceMetricTone(ledger.status)}`}>
        <div>
          <p className="eyebrow">Launch Delivery Evidence Ledger</p>
          <h2>{ledger.headline}</h2>
          <span>{ledger.summary}</span>
          <span>Generated {formatDateTime(ledger.generatedAt)} from launch send-review handoffs, delivery proof expectations, recipient scope, and local evidence records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={ledger.status} tone={getLaunchDeliveryEvidenceLedgerTone(ledger.status)} />
          <strong>{ledger.nextItem?.title ?? 'No delivery proof pending'}</strong>
          <button className="ghost-action" disabled={!canRecordEvidence} onClick={() => onRecordEvidence()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Ledger
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Ledger
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Delivery Boundary</p>
          <h2>Delivery evidence proves work after handoff</h2>
          <span>{launchDeliveryEvidenceBoundaryRule}</span>
        </div>
        <StatusPill label="Proof only" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Delivery Evidence Items"
          rows={ledger.items}
          pageSize={12}
          emptyTitle="No send-review items are ready for delivery evidence."
          columns={[
            {
              key: 'item',
              header: 'Item',
              sortable: true,
              searchValue: row => `${row.title} ${row.sourceDraftTitle} ${row.reference}`,
              render: row => (
                <button className="table-link" onClick={() => onSelectItem(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'audience',
              header: 'Audience',
              sortable: true,
              searchValue: row => deliveryAudienceSortValue(row.audience),
              render: row => <StatusPill label={row.audience} tone={getLaunchDeliveryEvidenceAudienceTone(row.audience)} />,
            },
            {
              key: 'status',
              header: 'Proof Status',
              sortable: true,
              searchValue: row => deliveryEvidenceStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchDeliveryEvidenceItemTone(row.status)} />,
            },
            {
              key: 'source',
              header: 'Send Review',
              sortable: true,
              searchValue: row => sourceReviewStatusSortValue(row.sourceSendReviewStatus),
              render: row => <StatusPill label={row.sourceSendReviewStatus} tone={getSourceReviewTone(row.sourceSendReviewStatus)} />,
            },
            {
              key: 'owner',
              header: 'Proof Owner',
              sortable: true,
              searchValue: row => `${row.proofOwner} ${row.sendOwner} ${row.approvalOwner}`,
              render: row => <div><strong>{row.proofOwner}</strong><span className="cell-subtext">Send: {row.sendOwner}</span></div>,
            },
            {
              key: 'proof',
              header: 'Proof Requirement',
              searchValue: row => row.deliveryProof,
              render: row => <span className={row.customerFacing ? 'warning-copy' : 'muted-copy'}>{row.deliveryProof}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Delivery Evidence Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.audience} tone={getLaunchDeliveryEvidenceAudienceTone(selectedItem.audience)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchDeliveryEvidenceItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Audience</span><strong>{selectedItem.audience}</strong></div>
                <div><span>Channel</span><strong>{selectedItem.channel}</strong></div>
                <div><span>Proof Owner</span><strong>{selectedItem.proofOwner}</strong></div>
                <div><span>Send Owner</span><strong>{selectedItem.sendOwner}</strong></div>
                <div><span>Approver</span><strong>{selectedItem.approvalOwner}</strong></div>
                <div><span>Draft</span><strong>{selectedItem.sourceDraftTitle}</strong></div>
                <div><span>Incident</span><strong>{selectedItem.sourceIncidentTitle}</strong></div>
                <div><span>Severity</span><strong>{selectedItem.severity}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedItem.surface)}</strong></div>
                <div><span>Audit</span><strong>{selectedItem.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                <div><span>Source Review</span><strong>{selectedItem.sourceSendReviewStatus}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Delivery State</h3>
                <p className={selectedItem.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedItem.deliveryState}</p>
              </div>

              <div className="detail-section">
                <h3>Recipient Scope</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.recipientScope}</p>
              </div>

              <div className="detail-section">
                <h3>Delivery Proof</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.deliveryProof}</p>
              </div>

              <div className="detail-section">
                <h3>Correction Plan</h3>
                <p className="muted-copy">{selectedItem.correctionPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Source Evidence</h3>
                <p className="muted-copy">{selectedItem.evidence}</p>
              </div>

              <div className="detail-section">
                <h3>Evidence Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchDeliveryEvidenceCheckTone(check.status)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => onOpenSource(selectedItem)}>
                    <Search size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                  <button className="ghost-action" disabled={!canRecordEvidence} onClick={() => onRecordEvidence(selectedItem, 'Proof Review')}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Mark Proof Review
                  </button>
                  <button className="ghost-action" disabled={!canRecordEvidence} onClick={() => onRecordEvidence(selectedItem, 'Evidence Complete')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Complete
                  </button>
                  <button className="ghost-action" disabled={!canRecordEvidence} onClick={() => onRecordEvidence(selectedItem, 'Blocked')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block Evidence
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueEvidenceReview(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Review
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Ledger
                  </button>
                  <span className="muted-copy">These actions record or route evidence review only. No customer message, notice, or production mutation is sent from this screen.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch delivery evidence item selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Delivery Evidence Audience Coverage"
        rows={ledger.audienceGroups}
        pageSize={8}
        emptyTitle="No delivery evidence audience coverage is available."
        columns={[
          {
            key: 'audience',
            header: 'Audience',
            sortable: true,
            searchValue: row => deliveryAudienceSortValue(row.audience),
            render: row => <StatusPill label={row.audience} tone={getLaunchDeliveryEvidenceAudienceTone(row.audience)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.total} ${row.needsProof} ${row.proofReview} ${row.complete} ${row.blocked}`,
            render: row => <div><strong>{row.total} total / {row.needsProof} proof</strong><span className="cell-subtext">{row.proofReview} review / {row.complete} complete / {row.blocked} blocked</span></div>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.needsProof || row.blocked ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Delivery Evidence Owner Load"
        rows={ledger.ownerGroups}
        pageSize={8}
        emptyTitle="No delivery evidence owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Proof Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} item{row.total === 1 ? '' : 's'}</span></div>,
          },
          {
            key: 'customer',
            header: 'Customer Facing',
            sortable: true,
            searchValue: row => String(row.customerFacing),
            render: row => row.customerFacing,
          },
          {
            key: 'proof',
            header: 'Needs Proof',
            sortable: true,
            searchValue: row => String(row.needsProof),
            render: row => row.needsProof,
          },
          {
            key: 'review',
            header: 'Proof Review',
            sortable: true,
            searchValue: row => String(row.proofReview),
            render: row => row.proofReview,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.needsProof || row.blocked ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Delivery Evidence Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No delivery evidence records have been captured yet."
        columns={[
          {
            key: 'recorded',
            header: 'Recorded',
            sortable: true,
            searchValue: row => row.recordedAt,
            render: row => formatDateTime(row.recordedAt),
          },
          {
            key: 'item',
            header: 'Item',
            sortable: true,
            searchValue: row => `${row.itemTitle ?? ''} ${row.audience ?? ''} ${row.channel ?? ''}`,
            render: row => <div><strong>{row.itemTitle ?? 'Delivery evidence snapshot'}</strong><span className="cell-subtext">{row.audience ?? row.ledgerStatus} / {row.channel ?? 'Snapshot'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => deliveryEvidenceStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchDeliveryEvidenceItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.needsProofCount} ${row.proofReviewCount} ${row.completeCount} ${row.blockedCount} ${row.customerFacingCount}`,
            render: row => <div><strong>{row.needsProofCount} proof / {row.proofReviewCount} review</strong><span className="cell-subtext">{row.completeCount} complete / {row.blockedCount} blocked / {row.customerFacingCount} customer</span></div>,
          },
          {
            key: 'actor',
            header: 'Actor',
            sortable: true,
            searchValue: row => `${row.recordedByRole} ${row.recordedBy}`,
            render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
          },
          {
            key: 'audit',
            header: 'Audit Event',
            sortable: true,
            searchValue: row => row.auditEventId,
            render: row => <span className="muted-copy">{row.auditEventId}</span>,
          },
        ]}
      />
    </>
  )
}

function deliveryEvidenceStatusSortValue(status: LaunchDeliveryEvidenceItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Proof') return '1 Needs Proof'
  if (status === 'Proof Review') return '2 Proof Review'
  return '3 Evidence Complete'
}

function sourceReviewStatusSortValue(status: LaunchDeliveryEvidenceItem['sourceSendReviewStatus']) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Send Review') return '1 Needs Send Review'
  if (status === 'Handoff Queued') return '2 Handoff Queued'
  return '3 Approved For Send'
}

function deliveryAudienceSortValue(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return '0 Customer'
  if (audience === 'Owner') return '1 Owner'
  return '2 Internal'
}

function getSourceReviewTone(status: LaunchDeliveryEvidenceItem['sourceSendReviewStatus']) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Send Review') return 'warn' as const
  if (status === 'Handoff Queued' || status === 'Approved For Send') return 'ok' as const
  return 'neutral' as const
}

function getPostLaunchSurfaceLabel(surface: LaunchPostLaunchSurface) {
  if (surface === 'backendWatch') return 'Backend Watch'
  if (surface === 'productionGuardrails') return 'Guardrails'
  if (surface === 'warRoom') return 'War Room'
  if (surface === 'evidencePacket') return 'Evidence Packet'
  if (surface === 'closure') return 'Closure'
  if (surface === 'followup') return 'Follow-Up'
  if (surface === 'watch') return 'Launch Watch'
  if (surface === 'detail') return 'Full Detail'
  return 'Command Mode'
}
