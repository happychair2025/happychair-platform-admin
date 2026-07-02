import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Download, FileText, GitBranch, MessageSquare, Search, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import type { LaunchCommsApprovalAudience } from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import type { LaunchPostLaunchSurface } from '../../lib/launch-readiness/launchPostLaunchWatchtower'
import {
  getLaunchRecipientResponseAudienceTone,
  getLaunchRecipientResponseCheckTone,
  getLaunchRecipientResponseItemTone,
  getLaunchRecipientResponseMonitorTone,
  launchRecipientResponseBoundaryRule,
  type LaunchRecipientResponseItem,
  type LaunchRecipientResponseItemStatus,
  type LaunchRecipientResponseMonitor,
  type LaunchRecipientResponseRecord,
} from '../../lib/launch-readiness/launchRecipientResponseMonitor'

interface LaunchRecipientResponseMonitorViewProps {
  monitor: LaunchRecipientResponseMonitor
  records: LaunchRecipientResponseRecord[]
  selectedItem?: LaunchRecipientResponseItem
  canRecordResponse: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchRecipientResponseItem) => void
  onRecordResponse: (item?: LaunchRecipientResponseItem, status?: LaunchRecipientResponseItemStatus) => void
  onQueueFollowUp: (item: LaunchRecipientResponseItem) => void
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

export default function LaunchRecipientResponseMonitorView({
  monitor,
  records,
  selectedItem,
  canRecordResponse,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordResponse,
  onQueueFollowUp,
  onExport,
}: LaunchRecipientResponseMonitorViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Response Status" value={monitor.status} delta={monitor.headline} tone={getLaunchRecipientResponseMonitorTone(monitor.status)} icon={<MessageSquare size={16} />} />
        <MetricCard label="Awaiting" value={String(monitor.awaitingCount)} delta="Acknowledgement or expiry" tone={monitor.awaitingCount ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
        <MetricCard label="Needs Follow-Up" value={String(monitor.followUpCount)} delta="Human owner required" tone={monitor.followUpCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Escalated" value={String(monitor.escalatedCount)} delta="Response risk" tone={monitor.escalatedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Acknowledged" value={String(monitor.acknowledgedCount)} delta="Ready to close" tone={monitor.acknowledgedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Closed" value={String(monitor.closedCount)} delta="Retained in packet" tone={monitor.closedCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Evidence Complete" value={`${monitor.evidenceCompleteCount}/${monitor.items.length}`} delta="Response monitor inputs" tone={monitor.evidenceCompleteCount ? 'ok' : 'warn'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Response Records" value={String(monitor.recordCount)} delta={monitor.latestRecord ? formatDateTime(monitor.latestRecord.recordedAt) : 'No response record'} tone={monitor.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchRecipientResponseMonitorTone(monitor.status)}`}>
        <div>
          <p className="eyebrow">Launch Recipient Response Monitor</p>
          <h2>{monitor.headline}</h2>
          <span>{monitor.summary}</span>
          <span>Generated {formatDateTime(monitor.generatedAt)} from delivery evidence, expected acknowledgement paths, response windows, and local response records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={monitor.status} tone={getLaunchRecipientResponseMonitorTone(monitor.status)} />
          <strong>{monitor.nextItem?.title ?? 'No recipient response pending'}</strong>
          <button className="ghost-action" disabled={!canRecordResponse} onClick={() => onRecordResponse()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Monitor
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Monitor
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Response Boundary</p>
          <h2>Track responses without sending replies</h2>
          <span>{launchRecipientResponseBoundaryRule}</span>
        </div>
        <StatusPill label="Monitor only" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Recipient Response Items"
          rows={monitor.items}
          pageSize={12}
          emptyTitle="No delivery evidence items are ready for recipient response monitoring."
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
              searchValue: row => responseAudienceSortValue(row.audience),
              render: row => <StatusPill label={row.audience} tone={getLaunchRecipientResponseAudienceTone(row.audience)} />,
            },
            {
              key: 'status',
              header: 'Response Status',
              sortable: true,
              searchValue: row => responseStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchRecipientResponseItemTone(row.status)} />,
            },
            {
              key: 'evidence',
              header: 'Delivery Proof',
              sortable: true,
              searchValue: row => sourceEvidenceStatusSortValue(row.sourceDeliveryEvidenceStatus),
              render: row => <StatusPill label={row.sourceDeliveryEvidenceStatus} tone={getSourceEvidenceTone(row.sourceDeliveryEvidenceStatus)} />,
            },
            {
              key: 'owner',
              header: 'Response Owner',
              sortable: true,
              searchValue: row => `${row.responseOwner} ${row.proofOwner}`,
              render: row => <div><strong>{row.responseOwner}</strong><span className="cell-subtext">Proof: {row.proofOwner}</span></div>,
            },
            {
              key: 'expected',
              header: 'Expected Response',
              searchValue: row => row.expectedResponse,
              render: row => <span className={row.customerFacing ? 'warning-copy' : 'muted-copy'}>{row.expectedResponse}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Recipient Response Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.audience} tone={getLaunchRecipientResponseAudienceTone(selectedItem.audience)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchRecipientResponseItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Audience</span><strong>{selectedItem.audience}</strong></div>
                <div><span>Channel</span><strong>{selectedItem.channel}</strong></div>
                <div><span>Response Owner</span><strong>{selectedItem.responseOwner}</strong></div>
                <div><span>Proof Owner</span><strong>{selectedItem.proofOwner}</strong></div>
                <div><span>Draft</span><strong>{selectedItem.sourceDraftTitle}</strong></div>
                <div><span>Incident</span><strong>{selectedItem.sourceIncidentTitle}</strong></div>
                <div><span>Severity</span><strong>{selectedItem.severity}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedItem.surface)}</strong></div>
                <div><span>Audit</span><strong>{selectedItem.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                <div><span>Delivery Proof</span><strong>{selectedItem.sourceDeliveryEvidenceStatus}</strong></div>
                <div><span>Response Window</span><strong>{selectedItem.responseWindow}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Response State</h3>
                <p className={selectedItem.status === 'Escalated' || selectedItem.status === 'Needs Follow-Up' ? 'warning-copy' : 'muted-copy'}>{selectedItem.responseState}</p>
              </div>

              <div className="detail-section">
                <h3>Expected Response</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.expectedResponse}</p>
              </div>

              <div className="detail-section">
                <h3>Follow-Up Plan</h3>
                <p className="muted-copy">{selectedItem.followUpPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Escalation Plan</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.escalationPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Source Evidence</h3>
                <p className="muted-copy">{selectedItem.evidence}</p>
              </div>

              <div className="detail-section">
                <h3>Response Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchRecipientResponseCheckTone(check.status)} />
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
                  <button className="ghost-action" disabled={!canRecordResponse} onClick={() => onRecordResponse(selectedItem, 'Acknowledged')}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Acknowledge
                  </button>
                  <button className="ghost-action" disabled={!canRecordResponse} onClick={() => onRecordResponse(selectedItem, 'Needs Follow-Up')}>
                    <MessageSquare size={15} strokeWidth={1.8} />
                    Needs Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canRecordResponse} onClick={() => onRecordResponse(selectedItem, 'Escalated')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Escalate
                  </button>
                  <button className="ghost-action" disabled={!canRecordResponse} onClick={() => onRecordResponse(selectedItem, 'Closed')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Close
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueFollowUp(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Monitor
                  </button>
                  <span className="muted-copy">These actions record or route response follow-up only. No customer reply, notice, or production mutation is sent from this screen.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch recipient response item selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Recipient Response Audience Coverage"
        rows={monitor.audienceGroups}
        pageSize={8}
        emptyTitle="No recipient response audience coverage is available."
        columns={[
          {
            key: 'audience',
            header: 'Audience',
            sortable: true,
            searchValue: row => responseAudienceSortValue(row.audience),
            render: row => <StatusPill label={row.audience} tone={getLaunchRecipientResponseAudienceTone(row.audience)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.total} ${row.awaiting} ${row.acknowledged} ${row.followUp} ${row.escalated} ${row.closed}`,
            render: row => <div><strong>{row.total} total / {row.awaiting} awaiting</strong><span className="cell-subtext">{row.followUp} follow-up / {row.escalated} escalated / {row.closed} closed</span></div>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.escalated || row.followUp || row.awaiting ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Recipient Response Owner Load"
        rows={monitor.ownerGroups}
        pageSize={8}
        emptyTitle="No recipient response owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Response Owner',
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
            key: 'awaiting',
            header: 'Awaiting',
            sortable: true,
            searchValue: row => String(row.awaiting),
            render: row => row.awaiting,
          },
          {
            key: 'follow',
            header: 'Follow-Up',
            sortable: true,
            searchValue: row => String(row.followUp),
            render: row => row.followUp,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.escalated || row.followUp || row.awaiting ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Recipient Response Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No recipient response records have been captured yet."
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
            render: row => <div><strong>{row.itemTitle ?? 'Recipient response snapshot'}</strong><span className="cell-subtext">{row.audience ?? row.monitorStatus} / {row.channel ?? 'Snapshot'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => responseStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchRecipientResponseItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.awaitingCount} ${row.acknowledgedCount} ${row.followUpCount} ${row.escalatedCount} ${row.closedCount}`,
            render: row => <div><strong>{row.awaitingCount} awaiting / {row.followUpCount} follow-up</strong><span className="cell-subtext">{row.acknowledgedCount} acknowledged / {row.escalatedCount} escalated / {row.closedCount} closed</span></div>,
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

function responseStatusSortValue(status: LaunchRecipientResponseItemStatus) {
  if (status === 'Escalated') return '0 Escalated'
  if (status === 'Needs Follow-Up') return '1 Needs Follow-Up'
  if (status === 'Awaiting Response') return '2 Awaiting Response'
  if (status === 'Acknowledged') return '3 Acknowledged'
  return '4 Closed'
}

function sourceEvidenceStatusSortValue(status: LaunchRecipientResponseItem['sourceDeliveryEvidenceStatus']) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Proof') return '1 Needs Proof'
  if (status === 'Proof Review') return '2 Proof Review'
  return '3 Evidence Complete'
}

function responseAudienceSortValue(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return '0 Customer'
  if (audience === 'Owner') return '1 Owner'
  return '2 Internal'
}

function getSourceEvidenceTone(status: LaunchRecipientResponseItem['sourceDeliveryEvidenceStatus']) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Proof' || status === 'Proof Review') return 'warn' as const
  return 'ok' as const
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
