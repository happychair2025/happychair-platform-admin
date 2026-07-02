import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Download, FileText, GitBranch, Search, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import type { LaunchCommsApprovalAudience } from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import {
  getLaunchClosureEvidenceAudienceTone,
  getLaunchClosureEvidenceCheckTone,
  getLaunchClosureEvidenceItemTone,
  getLaunchClosureEvidencePackTone,
  launchClosureEvidenceBoundaryRule,
  type LaunchClosureEvidenceItem,
  type LaunchClosureEvidenceItemStatus,
  type LaunchClosureEvidencePack,
  type LaunchClosureEvidenceRecord,
  type LaunchClosureEvidenceSection,
} from '../../lib/launch-readiness/launchClosureEvidencePack'
import type { LaunchPostLaunchSurface } from '../../lib/launch-readiness/launchPostLaunchWatchtower'

interface LaunchClosureEvidencePackViewProps {
  pack: LaunchClosureEvidencePack
  records: LaunchClosureEvidenceRecord[]
  selectedItem?: LaunchClosureEvidenceItem
  canRecordClosure: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchClosureEvidenceItem) => void
  onRecordClosure: (item?: LaunchClosureEvidenceItem, status?: LaunchClosureEvidenceItemStatus) => void
  onQueueClosureReview: (item: LaunchClosureEvidenceItem) => void
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

export default function LaunchClosureEvidencePackView({
  pack,
  records,
  selectedItem,
  canRecordClosure,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordClosure,
  onQueueClosureReview,
  onExport,
}: LaunchClosureEvidencePackViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Closure Pack Status" value={pack.status} delta={pack.headline} tone={getLaunchClosureEvidencePackTone(pack.status)} icon={<FileText size={16} />} />
        <MetricCard label="Needs Packet" value={String(pack.needsPacketCount)} delta="Evidence assembly required" tone={pack.needsPacketCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Closure Review" value={String(pack.reviewCount)} delta="Human closure review" tone={pack.reviewCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Packet Ready" value={String(pack.readyCount)} delta="Ready for final closure" tone={pack.readyCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Blocked" value={String(pack.blockedCount)} delta="Response or proof issue" tone={pack.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Response Clear" value={`${pack.responseClearCount}/${pack.items.length}`} delta="Acknowledged or closed" tone={pack.responseClearCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Audit Backed" value={`${pack.auditBackedCount}/${pack.items.length}`} delta="Evidence has audit trail" tone={pack.auditBackedCount ? 'ok' : 'warn'} icon={<Clock3 size={16} />} />
        <MetricCard label="Closure Records" value={String(pack.recordCount)} delta={pack.latestRecord ? formatDateTime(pack.latestRecord.recordedAt) : 'No closure record'} tone={pack.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchClosureEvidencePackTone(pack.status)}`}>
        <div>
          <p className="eyebrow">Launch Closure Evidence Pack</p>
          <h2>{pack.headline}</h2>
          <span>{pack.summary}</span>
          <span>Generated {formatDateTime(pack.generatedAt)} from delivery proof, recipient response state, response follow-up status, and local closure records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={pack.status} tone={getLaunchClosureEvidencePackTone(pack.status)} />
          <strong>{pack.nextItem?.title ?? 'No closure packet pending'}</strong>
          <button className="ghost-action" disabled={!canRecordClosure} onClick={() => onRecordClosure()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Pack
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Pack
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Closure Boundary</p>
          <h2>Assemble evidence without closing production</h2>
          <span>{launchClosureEvidenceBoundaryRule}</span>
        </div>
        <StatusPill label="Evidence only" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Closure Evidence Items"
          rows={pack.items}
          pageSize={12}
          emptyTitle="No recipient response items are ready for closure evidence packing."
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
              searchValue: row => closureAudienceSortValue(row.audience),
              render: row => <StatusPill label={row.audience} tone={getLaunchClosureEvidenceAudienceTone(row.audience)} />,
            },
            {
              key: 'status',
              header: 'Packet Status',
              sortable: true,
              searchValue: row => closureStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchClosureEvidenceItemTone(row.status)} />,
            },
            {
              key: 'section',
              header: 'Section',
              sortable: true,
              searchValue: row => closureSectionSortValue(row.packetSection),
              render: row => <StatusPill label={row.packetSection} tone={getSectionTone(row.packetSection)} />,
            },
            {
              key: 'owner',
              header: 'Closure Owner',
              sortable: true,
              searchValue: row => `${row.closureOwner} ${row.responseOwner} ${row.proofOwner}`,
              render: row => <div><strong>{row.closureOwner}</strong><span className="cell-subtext">Response: {row.responseOwner}</span></div>,
            },
            {
              key: 'requirement',
              header: 'Packet Requirement',
              searchValue: row => row.packetRequirement,
              render: row => <span className={row.status === 'Blocked' || row.customerFacing ? 'warning-copy' : 'muted-copy'}>{row.packetRequirement}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Closure Evidence Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.packetSection} tone={getSectionTone(selectedItem.packetSection)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchClosureEvidenceItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Audience</span><strong>{selectedItem.audience}</strong></div>
                <div><span>Channel</span><strong>{selectedItem.channel}</strong></div>
                <div><span>Packet Section</span><strong>{selectedItem.packetSection}</strong></div>
                <div><span>Closure Owner</span><strong>{selectedItem.closureOwner}</strong></div>
                <div><span>Response Owner</span><strong>{selectedItem.responseOwner}</strong></div>
                <div><span>Proof Owner</span><strong>{selectedItem.proofOwner}</strong></div>
                <div><span>Draft</span><strong>{selectedItem.sourceDraftTitle}</strong></div>
                <div><span>Incident</span><strong>{selectedItem.sourceIncidentTitle}</strong></div>
                <div><span>Severity</span><strong>{selectedItem.severity}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedItem.surface)}</strong></div>
                <div><span>Audit</span><strong>{selectedItem.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                <div><span>Response</span><strong>{selectedItem.sourceRecipientResponseStatus}</strong></div>
                <div><span>Delivery Proof</span><strong>{selectedItem.sourceDeliveryEvidenceStatus}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Closure State</h3>
                <p className={selectedItem.status === 'Blocked' || selectedItem.status === 'Closure Review' ? 'warning-copy' : 'muted-copy'}>{selectedItem.closureState}</p>
              </div>

              <div className="detail-section">
                <h3>Closure Evidence</h3>
                <p className={selectedItem.customerFacing ? 'warning-copy' : 'muted-copy'}>{selectedItem.closureEvidence}</p>
              </div>

              <div className="detail-section">
                <h3>Response Summary</h3>
                <p className="muted-copy">{selectedItem.responseSummary}</p>
              </div>

              <div className="detail-section">
                <h3>Signoff Plan</h3>
                <p className="muted-copy">{selectedItem.signoffPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Retention Plan</h3>
                <p className="muted-copy">{selectedItem.retentionPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Correction Path</h3>
                <p className={selectedItem.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedItem.rollbackPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Closure Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchClosureEvidenceCheckTone(check.status)} />
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
                  <button className="ghost-action" disabled={!canRecordClosure} onClick={() => onRecordClosure(selectedItem, 'Closure Review')}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Mark Review
                  </button>
                  <button className="ghost-action" disabled={!canRecordClosure} onClick={() => onRecordClosure(selectedItem, 'Packet Ready')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Packet Ready
                  </button>
                  <button className="ghost-action" disabled={!canRecordClosure} onClick={() => onRecordClosure(selectedItem, 'Closed')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Close Pack
                  </button>
                  <button className="ghost-action" disabled={!canRecordClosure} onClick={() => onRecordClosure(selectedItem, 'Blocked')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block Pack
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueClosureReview(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Review
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Pack
                  </button>
                  <span className="muted-copy">These actions record or route closure review only. No production incident is closed and no customer message is sent from this screen.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch closure evidence item selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Closure Evidence Sections"
        rows={pack.sectionGroups}
        pageSize={8}
        emptyTitle="No closure evidence sections are available."
        columns={[
          {
            key: 'section',
            header: 'Section',
            sortable: true,
            searchValue: row => closureSectionSortValue(row.section),
            render: row => <StatusPill label={row.section} tone={getSectionTone(row.section)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.total} ${row.needsPacket} ${row.review} ${row.ready} ${row.closed} ${row.blocked}`,
            render: row => <div><strong>{row.total} total / {row.needsPacket} packet</strong><span className="cell-subtext">{row.review} review / {row.ready} ready / {row.blocked} blocked</span></div>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.blocked || row.needsPacket || row.review ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Closure Evidence Owner Load"
        rows={pack.ownerGroups}
        pageSize={8}
        emptyTitle="No closure evidence owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Closure Owner',
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
            key: 'packet',
            header: 'Needs Packet',
            sortable: true,
            searchValue: row => String(row.needsPacket),
            render: row => row.needsPacket,
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
            render: row => <span className={row.blocked || row.needsPacket || row.review ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Closure Evidence Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No closure evidence records have been captured yet."
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
            searchValue: row => `${row.itemTitle ?? ''} ${row.audience ?? ''} ${row.section ?? ''}`,
            render: row => <div><strong>{row.itemTitle ?? 'Closure evidence snapshot'}</strong><span className="cell-subtext">{row.audience ?? row.packStatus} / {row.section ?? 'Snapshot'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => closureStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchClosureEvidenceItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.needsPacketCount} ${row.reviewCount} ${row.readyCount} ${row.closedCount} ${row.blockedCount}`,
            render: row => <div><strong>{row.needsPacketCount} packet / {row.reviewCount} review</strong><span className="cell-subtext">{row.readyCount} ready / {row.closedCount} closed / {row.blockedCount} blocked</span></div>,
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

function closureStatusSortValue(status: LaunchClosureEvidenceItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Packet') return '1 Needs Packet'
  if (status === 'Closure Review') return '2 Closure Review'
  if (status === 'Packet Ready') return '3 Packet Ready'
  return '4 Closed'
}

function closureAudienceSortValue(audience: LaunchCommsApprovalAudience) {
  if (audience === 'Customer') return '0 Customer'
  if (audience === 'Owner') return '1 Owner'
  return '2 Internal'
}

function closureSectionSortValue(section: LaunchClosureEvidenceSection) {
  if (section === 'Customer Response') return '0 Customer Response'
  if (section === 'Owner Decision') return '1 Owner Decision'
  return '2 Internal Handoff'
}

function getSectionTone(section: LaunchClosureEvidenceSection) {
  if (section === 'Customer Response') return 'warn' as const
  if (section === 'Internal Handoff') return 'info' as const
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
