import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileText, GitBranch, Gauge, Search, ShieldCheck, UserCheck } from 'lucide-react'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import StatusPill from '../../components/admin/StatusPill'
import {
  getLaunchAuditArchiveCheckTone,
  getLaunchAuditArchiveItemTone,
  getLaunchAuditArchiveVaultTone,
  launchAuditArchiveBoundaryRule,
  type LaunchAuditArchiveCategory,
  type LaunchAuditArchiveItem,
  type LaunchAuditArchiveItemStatus,
  type LaunchAuditArchiveRecord,
  type LaunchAuditArchiveVault,
} from '../../lib/launch-readiness/launchAuditArchiveVault'

interface LaunchAuditArchiveVaultViewProps {
  vault: LaunchAuditArchiveVault
  records: LaunchAuditArchiveRecord[]
  selectedItem?: LaunchAuditArchiveItem
  canRecordArchive: boolean
  canExport: boolean
  canQueueAction: boolean
  onSelectItem: (itemId: string) => void
  onOpenSource: (item: LaunchAuditArchiveItem) => void
  onRecordArchive: (item?: LaunchAuditArchiveItem, status?: LaunchAuditArchiveItemStatus) => void
  onQueueArchiveReview: (item: LaunchAuditArchiveItem) => void
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

export default function LaunchAuditArchiveVaultView({
  vault,
  records,
  selectedItem,
  canRecordArchive,
  canExport,
  canQueueAction,
  onSelectItem,
  onOpenSource,
  onRecordArchive,
  onQueueArchiveReview,
  onExport,
}: LaunchAuditArchiveVaultViewProps) {
  return (
    <>
      <div className="metrics-grid compact">
        <MetricCard label="Archive Status" value={vault.status} delta={vault.headline} tone={getLaunchAuditArchiveVaultTone(vault.status)} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Final Audit Score" value={`${vault.finalAuditScore}%`} delta={vault.finalAuditStatus} tone={vault.finalAuditScore === 100 ? 'ok' : vault.blockedCount ? 'danger' : 'warn'} icon={<Gauge size={16} />} />
        <MetricCard label="Blocked" value={String(vault.blockedCount)} delta="Must resolve first" tone={vault.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Needs Archive" value={String(vault.needsArchiveCount + vault.reviewCount)} delta="Retention work" tone={vault.needsArchiveCount + vault.reviewCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Ready / Archived" value={`${vault.readyCount}/${vault.archivedCount}`} delta="Archive items" tone={vault.readyCount || vault.archivedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Customer-Facing" value={String(vault.customerFacingCount)} delta="Retain with care" tone={vault.customerFacingCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Audit Records" value={String(vault.auditRecordCount)} delta="Upstream retained evidence" tone={vault.auditRecordCount ? 'ok' : 'warn'} icon={<FileText size={16} />} />
        <MetricCard label="Archive Records" value={String(vault.recordCount)} delta={vault.latestRecord ? formatDateTime(vault.latestRecord.recordedAt) : 'No archive record'} tone={vault.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
      </div>

      <section className={`panel launch-watch-panel tone-${getLaunchAuditArchiveVaultTone(vault.status)}`}>
        <div>
          <p className="eyebrow">Launch Audit Archive Vault</p>
          <h2>{vault.headline}</h2>
          <span>{vault.summary}</span>
          <span>Generated {formatDateTime(vault.generatedAt)} from Final Audit Room evidence, closure handoff state, and archive retention records.</span>
        </div>
        <div className="launch-command-meta">
          <StatusPill label={vault.status} tone={getLaunchAuditArchiveVaultTone(vault.status)} />
          <strong>{vault.nextItem?.title ?? 'No archive follow-up pending'}</strong>
          <button className="ghost-action" disabled={!canRecordArchive} onClick={() => onRecordArchive()}>
            <ShieldCheck size={15} strokeWidth={1.8} />
            Record Archive
          </button>
          <button className="ghost-action" disabled={!canExport} onClick={onExport}>
            <Download size={15} strokeWidth={1.8} />
            Export Vault
          </button>
        </div>
      </section>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Archive Boundary</p>
          <h2>Archive records retention; it does not execute</h2>
          <span>{launchAuditArchiveBoundaryRule}</span>
        </div>
        <StatusPill label="Retention only" tone="ok" />
      </section>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Audit Archive Items"
          rows={vault.items}
          pageSize={10}
          emptyTitle="No archive items are available."
          columns={[
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              searchValue: row => categorySortValue(row.category),
              render: row => (
                <button className="table-link" onClick={() => onSelectItem(row.id)}>
                  {row.category}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Archive Status',
              sortable: true,
              searchValue: row => archiveStatusSortValue(row.status),
              render: row => <StatusPill label={row.status} tone={getLaunchAuditArchiveItemTone(row.status)} />,
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
              header: 'Archive Evidence',
              searchValue: row => row.archiveEvidence,
              render: row => <span className={row.status === 'Blocked' || row.status === 'Needs Archive' ? 'warning-copy' : 'muted-copy'}>{row.archiveEvidence}</span>,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Archive Item</p>
                  <h2>{selectedItem.title}</h2>
                </div>
                <div className="launch-command-meta">
                  <StatusPill label={selectedItem.category} tone={getCategoryTone(selectedItem.category)} />
                  <StatusPill label={selectedItem.status} tone={getLaunchAuditArchiveItemTone(selectedItem.status)} />
                </div>
              </div>

              <div className="request-scope-list">
                <div><span>Category</span><strong>{selectedItem.category}</strong></div>
                <div><span>Source Status</span><strong>{selectedItem.sourceStatus}</strong></div>
                <div><span>Final Audit Stage</span><strong>{selectedItem.sourceFinalAuditStage ?? 'Vault level'}</strong></div>
                <div><span>Owner</span><strong>{selectedItem.owner}</strong></div>
                <div><span>Reference</span><strong>{selectedItem.reference}</strong></div>
                <div><span>Target View</span><strong>{selectedItem.targetView}</strong></div>
                <div><span>Audit Records</span><strong>{selectedItem.auditRecordCount}</strong></div>
                <div><span>Customer Facing</span><strong>{selectedItem.customerFacingCount}</strong></div>
                <div><span>Coverage</span><strong>{selectedItem.readyCount}/{selectedItem.totalCount}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Archive Requirement</h3>
                <p className={selectedItem.status === 'Blocked' || selectedItem.status === 'Needs Archive' ? 'warning-copy' : 'muted-copy'}>{selectedItem.archiveRequirement}</p>
              </div>

              <div className="detail-section">
                <h3>Archive Evidence</h3>
                <p className="muted-copy">{selectedItem.archiveEvidence}</p>
              </div>

              <div className="detail-section">
                <h3>Handoff Plan</h3>
                <p className="muted-copy">{selectedItem.handoffPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Retention Plan</h3>
                <p className="muted-copy">{selectedItem.retentionPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Next Step</h3>
                <p className={selectedItem.actionRequired ? 'warning-copy' : 'muted-copy'}>{selectedItem.nextStep}</p>
              </div>

              <div className="detail-section">
                <h3>Rollback Plan</h3>
                <p className="muted-copy">{selectedItem.rollbackPlan}</p>
              </div>

              <div className="detail-section">
                <h3>Archive Checks</h3>
                <div className="settings-rule-list">
                  {selectedItem.checks.map(check => (
                    <div key={check.id}>
                      <ClipboardCheck size={16} strokeWidth={1.8} />
                      <div>
                        <strong>{check.label}</strong>
                        <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                        <StatusPill label={check.status} tone={getLaunchAuditArchiveCheckTone(check.status)} />
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
                  <button className="ghost-action" disabled={!canRecordArchive} onClick={() => onRecordArchive(selectedItem, 'Archive Review')}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Mark Review
                  </button>
                  <button className="ghost-action" disabled={!canRecordArchive} onClick={() => onRecordArchive(selectedItem, 'Archive Ready')}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Mark Ready
                  </button>
                  <button className="ghost-action" disabled={!canRecordArchive} onClick={() => onRecordArchive(selectedItem, 'Archived')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Mark Archived
                  </button>
                  <button className="ghost-action" disabled={!canRecordArchive} onClick={() => onRecordArchive(selectedItem, 'Blocked')}>
                    <AlertTriangle size={15} strokeWidth={1.8} />
                    Block Archive
                  </button>
                  <button className="ghost-action" disabled={!canQueueAction} onClick={() => onQueueArchiveReview(selectedItem)}>
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Review
                  </button>
                  <button className="ghost-action" disabled={!canExport} onClick={onExport}>
                    <Download size={15} strokeWidth={1.8} />
                    Export Vault
                  </button>
                  <span className="muted-copy">These actions record or route archive review only. They do not close production launch state or execute customer-facing changes.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No archive item selected.</div>
          )}
        </aside>
      </div>

      <DataTable
        label="Archive Categories"
        rows={vault.categoryGroups}
        pageSize={8}
        emptyTitle="No archive categories are available."
        columns={[
          {
            key: 'category',
            header: 'Category',
            sortable: true,
            searchValue: row => categorySortValue(row.category),
            render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.itemCount} item{row.itemCount === 1 ? '' : 's'}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => archiveStatusSortValue(row.status),
            render: row => <StatusPill label={row.status} tone={getLaunchAuditArchiveItemTone(row.status)} />,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
          {
            key: 'evidence',
            header: 'Evidence',
            searchValue: row => row.archiveEvidence,
            render: row => <span className="muted-copy">{row.archiveEvidence}</span>,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.status === 'Blocked' || row.status === 'Needs Archive' || row.status === 'Archive Review' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Archive Owner Load"
        rows={vault.ownerGroups}
        pageSize={8}
        emptyTitle="No archive owner load is available."
        columns={[
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} archive item{row.total === 1 ? '' : 's'}</span></div>,
          },
          {
            key: 'blocked',
            header: 'Blocked',
            sortable: true,
            searchValue: row => String(row.blocked),
            render: row => row.blocked,
          },
          {
            key: 'needs',
            header: 'Needs Archive',
            sortable: true,
            searchValue: row => String(row.needsArchive),
            render: row => row.needsArchive,
          },
          {
            key: 'review',
            header: 'Review',
            sortable: true,
            searchValue: row => String(row.review),
            render: row => row.review,
          },
          {
            key: 'ready',
            header: 'Ready',
            sortable: true,
            searchValue: row => String(row.ready + row.archived),
            render: row => `${row.ready}/${row.archived}`,
          },
          {
            key: 'next',
            header: 'Next Step',
            searchValue: row => row.nextStep,
            render: row => <span className={row.blocked || row.needsArchive || row.review ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
          },
        ]}
      />

      <DataTable
        label="Archive Ledger"
        rows={records}
        pageSize={6}
        emptyTitle="No archive records have been captured yet."
        columns={[
          {
            key: 'recorded',
            header: 'Recorded',
            sortable: true,
            searchValue: row => row.recordedAt,
            render: row => formatDateTime(row.recordedAt),
          },
          {
            key: 'category',
            header: 'Category',
            sortable: true,
            searchValue: row => `${row.category ?? ''} ${row.itemTitle ?? ''}`,
            render: row => <div><strong>{row.category ?? 'Archive snapshot'}</strong><span className="cell-subtext">{row.itemTitle ?? row.vaultStatus}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => archiveStatusSortValue(row.itemStatus),
            render: row => <StatusPill label={row.itemStatus} tone={getLaunchAuditArchiveItemTone(row.itemStatus)} />,
          },
          {
            key: 'counts',
            header: 'Counts',
            sortable: true,
            searchValue: row => `${row.blockedCount} ${row.needsArchiveCount} ${row.reviewCount} ${row.readyCount} ${row.archivedCount}`,
            render: row => <div><strong>{row.blockedCount} blocked / {row.needsArchiveCount + row.reviewCount} review</strong><span className="cell-subtext">{row.readyCount} ready / {row.archivedCount} archived</span></div>,
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

function archiveStatusSortValue(status: LaunchAuditArchiveItemStatus) {
  if (status === 'Blocked') return '0 Blocked'
  if (status === 'Needs Archive') return '1 Needs Archive'
  if (status === 'Archive Review') return '2 Archive Review'
  if (status === 'Archive Ready') return '3 Archive Ready'
  return '4 Archived'
}

function categorySortValue(category: LaunchAuditArchiveCategory) {
  if (category === 'Final Audit') return '0 Final Audit'
  if (category === 'Evidence Export') return '1 Evidence Export'
  if (category === 'Owner Signoff') return '2 Owner Signoff'
  if (category === 'Operations Handoff') return '3 Operations Handoff'
  return '4 Retention'
}

function getCategoryTone(category: LaunchAuditArchiveCategory) {
  if (category === 'Final Audit' || category === 'Owner Signoff') return 'warn' as const
  if (category === 'Evidence Export' || category === 'Operations Handoff') return 'info' as const
  return 'neutral' as const
}
