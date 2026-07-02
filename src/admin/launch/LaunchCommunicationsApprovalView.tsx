import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, DatabaseZap, Download, FileText, GitBranch, Search, Send, ScrollText, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import {
  getLaunchCommsApprovalAudienceTone,
  getLaunchCommsApprovalCenterTone,
  getLaunchCommsApprovalCheckTone,
  getLaunchCommsApprovalMetricTone,
  getLaunchCommsApprovalStatusTone,
  launchCommsApprovalBoundaryRule,
  type LaunchCommsApprovalAudience,
  type LaunchCommsApprovalCenter,
  type LaunchCommsApprovalDraft,
  type LaunchCommsApprovalRecord,
  type LaunchCommsApprovalStatus,
} from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import type { LaunchPostLaunchSurface } from '../../lib/launch-readiness/launchPostLaunchWatchtower'

interface LaunchCommunicationsApprovalViewProps {
  center: LaunchCommsApprovalCenter
  records: LaunchCommsApprovalRecord[]
  selectedDraft?: LaunchCommsApprovalDraft
  canRecordReview: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectDraft: (draftId: string) => void
  onOpenSource: (draft: LaunchCommsApprovalDraft) => void
  onRecordApproval: (draft?: LaunchCommsApprovalDraft, status?: LaunchCommsApprovalStatus) => void
  onQueueSendReview: (draft: LaunchCommsApprovalDraft) => void
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

export default function LaunchCommunicationsApprovalView({
  center,
  records,
  selectedDraft,
  canRecordReview,
  canExport,
  canQueueAction,
  onSelectDraft,
  onOpenSource,
  onRecordApproval,
  onQueueSendReview,
  onExport,
}: LaunchCommunicationsApprovalViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Comms Status" value={center.status} delta={center.headline} tone={getLaunchCommsApprovalMetricTone(center.status)} icon={<Send size={16} />} />
        <MetricCard label="Needs Review" value={String(center.pendingReviewCount)} delta="Human approval before send" tone={center.pendingReviewCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
        <MetricCard label="Approved Drafts" value={String(center.approvedDraftCount)} delta="Ready for governed follow-up" tone={center.approvedDraftCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Customer Facing" value={String(center.customerFacingCount)} delta="Requires highest review" tone={center.customerFacingCount ? 'warn' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Internal Updates" value={String(center.internalUpdateCount)} delta="Team-facing drafts" tone="neutral" icon={<ScrollText size={16} />} />
        <MetricCard label="Owner Updates" value={String(center.ownerUpdateCount)} delta="Decision-facing drafts" tone={center.ownerUpdateCount ? 'warn' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Audit Backed" value={`${center.auditBackedCount}/${center.drafts.length}`} delta="Drafts with source evidence" tone={center.auditBackedCount ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
        <MetricCard label="Comms Records" value={String(center.recordCount)} delta={center.latestRecord ? formatDateTime(center.latestRecord.recordedAt) : 'No comms record'} tone={center.recordCount ? 'ok' : 'neutral'} icon={<Clock3 size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchCommsApprovalMetricTone(center.status)}`}>
        <div>
          <p className="eyebrow">Launch Communications Approval Center</p>
          <h2>{center.headline}</h2>
          <span>{center.summary}</span>
          <span>Generated {formatDateTime(center.generatedAt)} from post-launch incident packets, customer impact statements, internal updates, owner updates, and local approval records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={center.status} tone={getLaunchCommsApprovalCenterTone(center.status)} />
          <strong>{center.nextDraft?.title ?? 'No draft pending'}</strong>
          <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordApproval()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Center
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Comms
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Communications Boundary</p>
          <h2>Approval records do not send messages</h2>
          <span>{launchCommsApprovalBoundaryRule}</span>
        </div>
        <StatusPill label="No browser send path" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Communication Drafts"
          rows={center.drafts}
          pageSize={12}
          emptyTitle="No launch communication drafts require review."
          columns={[
            {
              key: 'draft',
              header: 'Draft',
              sortable: true,
              searchValue: row => `${row.title} ${row.sourceIncidentTitle} ${row.reference}`,
              render: row => (
                <button className="table-link" onClick={() => onSelectDraft(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'audience',
              header: 'Audience',
              sortable: true,
              searchValue: row => launchCommsAudienceSortValue(row.audience),
              render: row => <StatusPill label={row.audience} tone={getLaunchCommsApprovalAudienceTone(row.audience)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => launchCommsStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchCommsApprovalStatusTone(row.status)} />,
            },
            {
              key: 'channel',
              header: 'Channel',
              sortable: true,
              searchValue: row => `${row.channel} ${row.responseWindow}`,
              render: row => <div><strong>{row.channel}</strong><span className="cell-subtext">{row.responseWindow}</span></div>,
            },
            {
              key: 'approver',
              header: 'Approver',
              sortable: true,
              searchValue: row => `${row.approvalOwner} ${row.owner}`,
              render: row => <div><strong>{row.approvalOwner}</strong><span className="cell-subtext">{row.owner}</span></div>,
            },
            {
              key: 'risk',
              header: 'Risk',
              searchValue: row => row.riskNote,
              render: row => <span className={row.audience === 'Customer' ? 'warning-copy' : 'muted-copy'}>{row.riskNote}</span>,
            },
            {
              key: 'next',
              header: 'Next Step',
              searchValue: row => row.nextStep,
              render: row => <span className={row.actionRequired ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedDraft ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Communication Draft</p>
                  <h2>{selectedDraft.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedDraft.audience} tone={getLaunchCommsApprovalAudienceTone(selectedDraft.audience)} />
                  <StatusPill label={selectedDraft.status} tone={getLaunchCommsApprovalStatusTone(selectedDraft.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Audience</span><strong>{selectedDraft.audience}</strong></div>
                <div><span>Channel</span><strong>{selectedDraft.channel}</strong></div>
                <div><span>Owner</span><strong>{selectedDraft.owner}</strong></div>
                <div><span>Approver</span><strong>{selectedDraft.approvalOwner}</strong></div>
                <div><span>Incident</span><strong>{selectedDraft.sourceIncidentTitle}</strong></div>
                <div><span>Severity</span><strong>{selectedDraft.severity}</strong></div>
                <div><span>Reference</span><strong>{selectedDraft.reference}</strong></div>
                <div><span>Response</span><strong>{selectedDraft.responseWindow}</strong></div>
                <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedDraft.surface)}</strong></div>
                <div><span>Audit</span><strong>{selectedDraft.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Draft</h3>
                <p className={selectedDraft.audience === 'Customer' ? 'warning-copy' : 'muted-copy'}>{selectedDraft.draft}</p>
              </div>

              <div className="detail-section">
                <h3>Risk Note</h3>
                <p className={selectedDraft.status === 'Hold' || selectedDraft.audience === 'Customer' ? 'warning-copy' : 'muted-copy'}>{selectedDraft.riskNote}</p>
              </div>

              <div className="detail-section">
                <h3>Next Step</h3>
                <p className={selectedDraft.actionRequired ? 'warning-copy' : 'muted-copy'}>{selectedDraft.nextStep}</p>
              </div>

              <div className="detail-section">
                <h3>Approval Checks</h3>
                <div className="settings-rule-list">
                  {selectedDraft.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchCommsApprovalCheckTone(check.status)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => onOpenSource(selectedDraft)}>
                    <Search size={15} strokeWidth={1.8} />
                    Open Source
                  </button>
                  <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordApproval(selectedDraft, 'Approved Draft')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Approve Draft
                  </button>
                  <button className="ghost-action" disabled={!canRecordReview} onClick={() => onRecordApproval(selectedDraft, 'Hold')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Hold Draft
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction || selectedDraft.status !== 'Approved Draft'} onClick={() => onQueueSendReview(selectedDraft)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Send Review
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Comms
                  </button>
                  <span className="muted-copy">Approving a draft records review evidence only. Queueing send review still does not send or publish a message.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch communication draft selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Communication Audience Coverage"
        rows={center.audienceGroups}
        pageSize={8}
        emptyTitle="No communication audience coverage is available."
        columns={[
          {
            key: 'audience',
            header: 'Audience',
            sortable: true,
            searchValue: row => launchCommsAudienceSortValue(row.audience),
            render: row => <StatusPill label={row.audience} tone={getLaunchCommsApprovalAudienceTone(row.audience)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.total} ${row.needsReview} ${row.approved} ${row.hold}`,
            render: row => <div><strong>{row.total} total / {row.needsReview} review</strong><span className="cell-subtext">{row.approved} approved / {row.hold} hold</span></div>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.needsReview || row.hold ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Communication Approval Owner Load"
        rows={center.ownerGroups}
        pageSize={8}
        emptyTitle="No communication owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} draft{row.total === 1 ? '' : 's'}</span></div>,
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
            key: 'approved',
            header: 'Approved',
            sortable: true,
            searchValue: row => String(row.approved),
            render: row => row.approved,
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
        label="Communications Approval Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No communication approval records have been captured yet."
        columns={[
          {
            key: 'recorded',
            header: 'Recorded',
            sortable: true,
            searchValue: row => row.recordedAt,
            render: row => formatDateTime(row.recordedAt),
          },
          {
            key: 'draft',
            header: 'Draft',
            sortable: true,
            searchValue: row => `${row.itemTitle ?? ''} ${row.audience ?? ''} ${row.channel ?? ''}`,
            render: row => <div><strong>{row.itemTitle ?? 'Comms center snapshot'}</strong><span className="cell-subtext">{row.audience ?? row.centerStatus} / {row.channel ?? 'Snapshot'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => launchCommsStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchCommsApprovalStatusTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.pendingReviewCount} ${row.approvedDraftCount} ${row.holdCount} ${row.customerFacingCount}`,
            render: row => <div><strong>{row.pendingReviewCount} review / {row.approvedDraftCount} approved</strong><span className="cell-subtext">{row.holdCount} hold / {row.customerFacingCount} customer</span></div>,
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

function launchCommsStatusSortValue(status: LaunchCommsApprovalStatus) {
  if (status === 'Hold') return '0 Hold'
  if (status === 'Needs Owner Review') return '1 Needs Owner Review'
  if (status === 'Approved Draft') return '2 Approved Draft'
  return '3 Not Required'
}

function launchCommsAudienceSortValue(audience: LaunchCommsApprovalAudience) {
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
