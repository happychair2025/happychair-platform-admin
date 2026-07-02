import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileText, GitBranch, Gauge, Search, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import {
  getLaunchFinalAuditCheckTone,
  getLaunchFinalAuditItemTone,
  getLaunchFinalAuditRoomTone,
  launchFinalAuditBoundaryRule,
  type LaunchFinalAuditItem,
  type LaunchFinalAuditItemStatus,
  type LaunchFinalAuditRecord,
  type LaunchFinalAuditRoom,
  type LaunchFinalAuditStage,
} from '../../lib/launch-readiness/launchFinalAuditRoom'

interface LaunchFinalAuditRoomViewProps {
  room: LaunchFinalAuditRoom
  records: LaunchFinalAuditRecord[]
  selectedItem?: LaunchFinalAuditItem
  canRecordAudit: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchFinalAuditItem) => void
  onRecordAudit: (item?: LaunchFinalAuditItem, status?: LaunchFinalAuditItemStatus) => void
  onQueueAuditReview: (item: LaunchFinalAuditItem) => void
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

export default function LaunchFinalAuditRoomView({
  room,
  records,
  selectedItem,
  canRecordAudit,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordAudit,
  onQueueAuditReview,
  onExport,
}: LaunchFinalAuditRoomViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Final Audit Status" value={room.status} delta={room.headline} tone={getLaunchFinalAuditRoomTone(room.status)} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Audit Score" value={`${room.auditScore}%`} delta={`${room.requiredReadyCount}/${room.requiredCount} stages ready`} tone={room.auditScore === 100 ? 'ok' : room.blockedCount ? 'danger' : 'warn'} icon={<Gauge size={16} />} />
        <MetricCard label="Blocked" value={String(room.blockedCount)} delta="Must resolve before closure" tone={room.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Review / Evidence" value={String(room.reviewCount + room.needsEvidenceCount)} delta="Human audit work" tone={room.reviewCount + room.needsEvidenceCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Ready / Closed" value={`${room.readyCount}/${room.closedCount}`} delta="Final audit stages" tone={room.readyCount || room.closedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Customer-Facing" value={String(room.customerFacingCount)} delta="Requires extra care" tone={room.customerFacingCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Audit Records" value={String(room.auditRecordCount)} delta="Upstream local records" tone={room.auditRecordCount ? 'ok' : 'warn'} icon={<FileText size={16} />} />
        <MetricCard label="Room Records" value={String(room.recordCount)} delta={room.latestRecord ? formatDateTime(room.latestRecord.recordedAt) : 'No final audit record'} tone={room.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchFinalAuditRoomTone(room.status)}`}>
        <div>
          <p className="eyebrow">Final Launch Audit Room</p>
          <h2>{room.headline}</h2>
          <span>{room.summary}</span>
          <span>Generated {formatDateTime(room.generatedAt)} from Launch Gate, communications, send review, delivery proof, recipient replies, closure pack, and executive closure readiness.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={room.status} tone={getLaunchFinalAuditRoomTone(room.status)} />
          <strong>{room.nextItem?.title ?? 'No final audit follow-up pending'}</strong>
          <button className="ghost-action" disabled={!canRecordAudit} onClick={() => onRecordAudit()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Audit
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Audit
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Audit Boundary</p>
          <h2>Final audit summarizes; it does not execute</h2>
          <span>{launchFinalAuditBoundaryRule}</span>
        </div>
        <StatusPill label="Review only" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Final Launch Audit Stages"
          rows={room.items}
          pageSize={10}
          emptyTitle="No final audit stages are available."
          columns={[
            {
              key: 'stage',
              header: 'Stage',
              sortable: true,
              searchValue: row => stageSortValue(row.stage),
              render: row => (
                <button className="table-link" onClick={() => onSelectItem(row.id)}>
                  {row.stage}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Audit Status',
              sortable: true,
              searchValue: row => auditStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchFinalAuditItemTone(row.status)} />,
            },
            {
              key: 'source',
              header: 'Source Status',
              sortable: true,
              searchValue: row => row.sourceStatus,
              render: row => <span className="muted-copy">{row.sourceStatus}</span>,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.reference}</span></div>,
            },
            {
              key: 'evidence',
              header: 'Evidence',
              searchValue: row => row.evidence,
              render: row => <span className={row.status === 'Blocked' || row.status === 'Needs Evidence' ? 'warning-copy' : 'muted-copy'}>{row.evidence}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Final Audit Stage</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.stage} tone={getStageTone(selectedItem.stage)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchFinalAuditItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Stage</span><strong>{selectedItem.stage}</strong></div>
                <div><span>Source Status</span><strong>{selectedItem.sourceStatus}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Target View</span><strong>{selectedItem.targetView}</strong></div>
                <div><span>Audit Records</span><strong>{selectedItem.auditRecordCount}</strong></div>
                <div><span>Customer Facing</span><strong>{selectedItem.customerFacingCount}</strong></div>
                <div><span>Action Required</span><strong>{selectedItem.actionRequired ? 'Yes' : 'No'}</strong></div>
                <div><span>Coverage</span><strong>{selectedItem.readyCount}/{selectedItem.totalCount}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Summary</h3>
                <p className={selectedItem.status === 'Blocked' || selectedItem.status === 'Needs Evidence' ? 'warning-copy' : 'muted-copy'}>{selectedItem.summary}</p>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <p className="muted-copy">{selectedItem.evidence}</p>
              </div>

              <div className="detail-section">
                <h3>Next Step</h3>
                <p className={selectedItem.actionRequired ? 'warning-copy' : 'muted-copy'}>{selectedItem.nextStep}</p>
              </div>

              <div className="detail-section">
                <h3>Audit Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchFinalAuditCheckTone(check.status)} />
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
                  <button className="ghost-action" disabled={!canRecordAudit} onClick={() => onRecordAudit(selectedItem, 'Review')}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Mark Review
                  </button>
                  <button className="ghost-action" disabled={!canRecordAudit} onClick={() => onRecordAudit(selectedItem, 'Ready')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Ready
                  </button>
                  <button className="ghost-action" disabled={!canRecordAudit} onClick={() => onRecordAudit(selectedItem, 'Closed')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Close Audit
                  </button>
                  <button className="ghost-action" disabled={!canRecordAudit} onClick={() => onRecordAudit(selectedItem, 'Blocked')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block Audit
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueAuditReview(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Review
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Audit
                  </button>
                  <span className="muted-copy">These actions record or route final audit review only. They do not close production launch state or execute customer-facing changes.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No final audit stage selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Final Audit Owner Load"
        rows={room.ownerGroups}
        pageSize={8}
        emptyTitle="No final audit owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} stage{row.total === 1 ? '' : 's'}</span></div>,
          },
          {
            key: 'blocked',
            header: 'Blocked',
            sortable: true,
            searchValue: row => String(row.blocked),
            render: row => row.blocked,
          },
          {
            key: 'evidence',
            header: 'Needs Evidence',
            sortable: true,
            searchValue: row => String(row.needsEvidence),
            render: row => row.needsEvidence,
          },
          {
            key: 'review',
            header: 'Review',
            sortable: true,
            searchValue: row => String(row.review),
            render: row => row.review,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.blocked || row.needsEvidence || row.review ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Final Audit Records"
        rows={records}
        pageSize={6}
        emptyTitle="No final audit records have been captured yet."
        columns={[
          {
            key: 'recorded',
            header: 'Recorded',
            sortable: true,
            searchValue: row => row.recordedAt,
            render: row => formatDateTime(row.recordedAt),
          },
          {
            key: 'stage',
            header: 'Stage',
            sortable: true,
            searchValue: row => `${row.stage ?? ''} ${row.itemTitle ?? ''}`,
            render: row => <div><strong>{row.stage ?? 'Final audit snapshot'}</strong><span className="cell-subtext">{row.itemTitle ?? row.roomStatus}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => auditStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchFinalAuditItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.blockedCount} ${row.needsEvidenceCount} ${row.reviewCount} ${row.readyCount} ${row.closedCount}`,
            render: row => <div><strong>{row.auditScore}% score / {row.blockedCount} blocked</strong><span className="cell-subtext">{row.needsEvidenceCount} evidence / {row.reviewCount} review / {row.readyCount} ready</span></div>,
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

function auditStatusSortValue(status: LaunchFinalAuditItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Evidence') return '1 Needs Evidence'
  if (status === 'Review') return '2 Review'
  if (status === 'Ready') return '3 Ready'
  return '4 Closed'
}

function stageSortValue(stage: LaunchFinalAuditStage) {
  if (stage === 'Launch Gate') return '0 Launch Gate'
  if (stage === 'Communications') return '1 Communications'
  if (stage === 'Send Review') return '2 Send Review'
  if (stage === 'Delivery Proof') return '3 Delivery Proof'
  if (stage === 'Recipient Replies') return '4 Recipient Replies'
  if (stage === 'Closure Pack') return '5 Closure Pack'
  return '6 Executive Closure'
}

function getStageTone(stage: LaunchFinalAuditStage) {
  if (stage === 'Launch Gate' || stage === 'Executive Closure') return 'warn' as const
  if (stage === 'Communications' || stage === 'Recipient Replies') return 'info' as const
  return 'neutral' as const
}
