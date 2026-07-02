import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, DatabaseZap, Download, FileText, GitBranch, Search, Send, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import type { LaunchCommsApprovalAudience } from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import {
  getLaunchSendReviewAudienceTone,
  getLaunchSendReviewCheckTone,
  getLaunchSendReviewItemTone,
  getLaunchSendReviewMetricTone,
  getLaunchSendReviewQueueTone,
  launchSendReviewBoundaryRule,
  type LaunchSendReviewItem,
  type LaunchSendReviewItemStatus,
  type LaunchSendReviewQueue,
  type LaunchSendReviewRecord,
} from '../../lib/launch-readiness/launchSendReviewQueue'
import type { LaunchPostLaunchSurface } from '../../lib/launch-readiness/launchPostLaunchWatchtower'

interface LaunchSendReviewQueueViewProps {
  queue: LaunchSendReviewQueue
  records: LaunchSendReviewRecord[]
  selectedItem?: LaunchSendReviewItem
  canRecordReview: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchSendReviewItem) => void
  onRecordReview: (item?: LaunchSendReviewItem, status?: LaunchSendReviewItemStatus) => void
  onQueueHandoff: (item: LaunchSendReviewItem) => void
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

export default function LaunchSendReviewQueueView({
  queue,
  records,
  selectedItem,
  canRecordReview,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordReview,
  onQueueHandoff,
  onExport,
}: LaunchSendReviewQueueViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Send Review Status" value={queue.status} delta={queue.headline} tone={getLaunchSendReviewMetricTone(queue.status)} icon={<Send size={16} />} />
        <MetricCard label="Needs Review" value={String(queue.pendingReviewCount)} delta="Approved drafts awaiting handoff" tone={queue.pendingReviewCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
        <MetricCard label="Handoff Queued" value={String(queue.handoffQueuedCount)} delta="Governed follow-up requests" tone={queue.handoffQueuedCount ? 'ok' : 'neutral'} icon={<GitBranch size={16} />} />
        <MetricCard label="Customer Facing" value={String(queue.customerFacingCount)} delta="Final human confirmation required" tone={queue.customerFacingCount ? 'warn' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Approved For Send" value={String(queue.approvedCount)} delta="Ready, not sent" tone={queue.approvedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Blocked" value={String(queue.blockedCount)} delta="Scope or evidence issue" tone={queue.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Audit Backed" value={`${queue.auditBackedCount}/${queue.items.length}`} delta="Items with source evidence" tone={queue.auditBackedCount ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
        <MetricCard label="Review Records" value={String(queue.recordCount)} delta={queue.latestRecord ? formatDateTime(queue.latestRecord.recordedAt) : 'No send review record'} tone={queue.recordCount ? 'ok' : 'neutral'} icon={<Clock3 size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchSendReviewMetricTone(queue.status)}`}>
        <div>
          <p className="eyebrow">Launch Send Review Queue</p>
          <h2>{queue.headline}</h2>
          <span>{queue.summary}</span>
          <span>Generated {formatDateTime(queue.generatedAt)} from approved launch communication drafts, delivery guardrails, audience scope, and local send-review records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={queue.status} tone={getLaunchSendReviewQueueTone(queue.status)} />
          <strong>{queue.nextItem?.title ?? 'No handoff pending'}</strong>
          <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordReview()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Queue
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Queue
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Send Boundary</p>
          <h2>Send review is a handoff, not delivery</h2>
          <span>{launchSendReviewBoundaryRule}</span>
        </div>
        <StatusPill label="No send path" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Send Review Items"
          rows={queue.items}
          pageSize={12}
          emptyTitle="No approved communication drafts are ready for send review."
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
              searchValue: row => sendAudienceSortValue(row.audience),
              render: row => <StatusPill label={row.audience} tone={getLaunchSendReviewAudienceTone(row.audience)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => sendReviewStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchSendReviewItemTone(row.status)} />,
            },
            {
              key: 'channel',
              header: 'Channel',
              sortable: true,
              searchValue: row => `${row.channel} ${row.responseWindow}`,
              render: row => <div><strong>{row.channel}</strong><span className="cell-subtext">{row.responseWindow}</span></div>,
            },
            {
              key: 'owner',
              header: 'Send Owner',
              sortable: true,
              searchValue: row => `${row.sendOwner} ${row.approvalOwner}`,
              render: row => <div><strong>{row.sendOwner}</strong><span className="cell-subtext">Approved by {row.approvalOwner}</span></div>,
            },
            {
              key: 'plan',
              header: 'Delivery Plan',
              searchValue: row => row.deliveryPlan,
              render: row => <span className={row.customerFacing ? 'warning-copy' : 'muted-copy'}>{row.deliveryPlan}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Send Review Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.audience} tone={getLaunchSendReviewAudienceTone(selectedItem.audience)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchSendReviewItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Audience</span><strong>{selectedItem.audience}</strong></div>
                <div><span>Channel</span><strong>{selectedItem.channel}</strong></div>
                <div><span>Send Owner</span><strong>{selectedItem.sendOwner}</strong></div>
                <div><span>Approver</span><strong>{selectedItem.approvalOwner}</strong></div>
                <div><span>Draft</span><strong>{selectedItem.sourceDraftTitle}</strong></div>
                <div><span>Incident</span><strong>{selectedItem.sourceIncidentTitle}</strong></div>
                <div><span>Severity</span><strong>{selectedItem.severity}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedItem.surface)}</strong></div>
                <div><span>Audit</span><strong>{selectedItem.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Approved Draft</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.draft}</p>
              </div>

              <div className="detail-section">
                <h3>Delivery Plan</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.deliveryPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Send Guardrail</h3>
                <p className="muted-copy">{selectedItem.sendGuardrail}</p>
              </div>

              <div className="detail-section">
                <h3>Correction Plan</h3>
                <p className="muted-copy">{selectedItem.rollbackPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Review Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchSendReviewCheckTone(check.status)} />
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
                  <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordReview(selectedItem, 'Approved For Send')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Approve Review
                  </button>
                  <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordReview(selectedItem, 'Blocked')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block Review
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueHandoff(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Handoff
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Queue
                  </button>
                  <span className="muted-copy">These actions record or route send review only. No customer message or notice is sent from this screen.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch send review item selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Send Review Audience Coverage"
        rows={queue.audienceGroups}
        pageSize={8}
        emptyTitle="No send review audience coverage is available."
        columns={[
          {
            key: 'audience',
            header: 'Audience',
            sortable: true,
            searchValue: row => sendAudienceSortValue(row.audience),
            render: row => <StatusPill label={row.audience} tone={getLaunchSendReviewAudienceTone(row.audience)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.total} ${row.needsReview} ${row.handoffQueued} ${row.approved} ${row.blocked}`,
            render: row => <div><strong>{row.total} total / {row.needsReview} review</strong><span className="cell-subtext">{row.handoffQueued} queued / {row.approved} approved / {row.blocked} blocked</span></div>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.needsReview || row.blocked ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Send Review Owner Load"
        rows={queue.ownerGroups}
        pageSize={8}
        emptyTitle="No send review owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Owner',
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
            key: 'review',
            header: 'Needs Review',
            sortable: true,
            searchValue: row => String(row.needsReview),
            render: row => row.needsReview,
          },
          {
            key: 'queued',
            header: 'Queued',
            sortable: true,
            searchValue: row => String(row.handoffQueued),
            render: row => row.handoffQueued,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.needsReview ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Send Review Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No send review records have been captured yet."
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
            render: row => <div><strong>{row.itemTitle ?? 'Send review snapshot'}</strong><span className="cell-subtext">{row.audience ?? row.queueStatus} / {row.channel ?? 'Snapshot'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => sendReviewStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchSendReviewItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.pendingReviewCount} ${row.handoffQueuedCount} ${row.approvedCount} ${row.blockedCount} ${row.customerFacingCount}`,
            render: row => <div><strong>{row.pendingReviewCount} review / {row.handoffQueuedCount} queued</strong><span className="cell-subtext">{row.approvedCount} approved / {row.blockedCount} blocked / {row.customerFacingCount} customer</span></div>,
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

function sendReviewStatusSortValue(status: LaunchSendReviewItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Send Review') return '1 Needs Send Review'
  if (status === 'Handoff Queued') return '2 Handoff Queued'
  return '3 Approved For Send'
}

function sendAudienceSortValue(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return '0 Customer'
  if (audience === 'Owner') return '1 Owner'
  return '2 Internal'
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
