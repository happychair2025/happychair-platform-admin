import { Database, Download, FileDown, FileSpreadsheet, LockKeyhole, ShieldAlert, ShieldCheck, TableProperties } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { buildActionTimeline } from '../../lib/admin-actions/actionTimeline'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import {
  buildCsv,
  buildExportDatasets,
  exportCenterBoundaryRule,
  getExportDatasetTone,
  getExportFilename,
  getExportSensitivityTone,
  summarizeExportDatasets,
  type ExportDatasetDefinition,
  type ExportRow,
} from '../../lib/reports/exportCenter'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ExportCenterPageProps {
  session: AdminSession
}

export default function ExportCenterPage({ session }: ExportCenterPageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAuditEvents = useLocalAuditEvents()
  const localMockExecutions = useLocalMockServerExecutions()
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')

  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const timelineEvents = useMemo(() => buildActionTimeline({
    requests: actionRequests,
    auditEvents,
    mockExecutions: localMockExecutions,
  }), [actionRequests, auditEvents, localMockExecutions])

  const datasets = useMemo(() => buildExportDatasets({
    data,
    actionRequests,
    auditEvents,
    timelineEvents,
  }), [actionRequests, auditEvents, data, timelineEvents])

  const summary = useMemo(() => summarizeExportDatasets(datasets), [datasets])
  const selectedDataset = datasets.find(dataset => dataset.id === selectedId) ?? datasets[0]
  const canExportSelected = selectedDataset ? hasPermission(session.role, selectedDataset.permission) : false
  const previewRows = selectedDataset?.rows.slice(0, 6) ?? []
  const previewFields = selectedDataset?.fields.slice(0, 7) ?? []

  const exportDataset = (dataset: ExportDatasetDefinition) => {
    const result = runAdminAction(session, {
      permission: dataset.permission,
      scope: dataset.name,
      actionKey: `export_center.${dataset.id}.csv_exported.mock`,
      actionLabel: `Exported ${dataset.name}`,
      severity: dataset.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: {
        datasetId: dataset.id,
        datasetName: dataset.name,
        category: dataset.category,
        sensitivity: dataset.sensitivity,
        source: dataset.source,
        rowCount: dataset.rows.length,
        fields: dataset.fields,
        exportFormat: 'csv',
        destination: 'local_browser_download',
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const csv = buildCsv(dataset.fields, dataset.rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getExportFilename(dataset)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${dataset.name} exported as CSV and recorded in Audit Logs.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Permissioned Exports"
        title="Export Center"
        description="Permissioned, audit-recorded local CSV exports for platform views, operating history, action requests, and audit records."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Datasets" value={String(summary.total)} delta="Export definitions" tone="neutral" icon={<FileSpreadsheet size={16} />} />
        <MetricCard label="Ready" value={String(summary.ready)} delta={`${sourceLabel} plus local ledgers`} tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Restricted" value={String(summary.restricted)} delta="Requires tighter permissions" tone={summary.restricted ? 'warn' : 'ok'} icon={<ShieldAlert size={16} />} />
        <MetricCard label="Rows Available" value={String(summary.totalRows)} delta="Across exportable datasets" tone="neutral" icon={<TableProperties size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Audit-Controlled" value={String(summary.auditControlled)} delta="Requires audit.export" tone="warn" icon={<LockKeyhole size={16} />} />
        <MetricCard label="Browser Secrets" value="0" delta="No service-role keys in client" tone="ok" icon={<Database size={16} />} />
        <MetricCard label="External Delivery" value="Off" delta="No email/provider transmission" tone="ok" icon={<FileDown size={16} />} />
        <MetricCard label="Production Writes" value="0" delta="Exports are read-only artifacts" tone="ok" icon={<Download size={16} />} />
      </div>

      <section className="panel export-boundary-panel">
        <div>
          <p className="eyebrow">Export Boundary</p>
          <h2>Exports are local artifacts with audit records, not external delivery jobs</h2>
          <span>{exportCenterBoundaryRule}</span>
        </div>
        <StatusPill label="CSV local download" tone="ok" />
      </section>

      <div className="export-center-layout">
        <DataTable
          label="Export Datasets"
          rows={datasets}
          pageSize={8}
          emptyTitle="No export datasets are registered."
          columns={[
            {
              key: 'dataset',
              header: 'Dataset',
              sortable: true,
              searchValue: row => `${row.name} ${row.description}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.name}
                </button>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              searchValue: row => row.category,
              render: row => row.category,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'rows',
              header: 'Rows',
              sortable: true,
              searchValue: row => String(row.rows.length).padStart(6, '0'),
              render: row => row.rows.length,
            },
            {
              key: 'permission',
              header: 'Permission',
              sortable: true,
              searchValue: row => row.permission,
              render: row => <code>{row.permission}</code>,
            },
            {
              key: 'sensitivity',
              header: 'Sensitivity',
              sortable: true,
              searchValue: row => row.sensitivity,
              render: row => <StatusPill label={row.sensitivity} tone={getExportSensitivityTone(row.sensitivity)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getExportDatasetTone(row.status)} />,
            },
          ]}
        />

        <aside className="detail-panel export-center-detail-panel">
          {selectedDataset ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Export Detail</p>
                  <h2>{selectedDataset.name}</h2>
                </div>
                <StatusPill label={selectedDataset.sensitivity} tone={getExportSensitivityTone(selectedDataset.sensitivity)} />
              </div>

              <div className="request-scope-list">
                <div><span>Category</span><strong>{selectedDataset.category}</strong></div>
                <div><span>Owner</span><strong>{selectedDataset.owner}</strong></div>
                <div><span>Rows</span><strong>{selectedDataset.rows.length}</strong></div>
                <div><span>Fields</span><strong>{selectedDataset.fields.length}</strong></div>
                <div><span>Permission</span><strong>{selectedDataset.permission}</strong></div>
                <div><span>Source</span><strong>{selectedDataset.source}</strong></div>
              </div>

              <section className={`panel export-status-panel tone-${canExportSelected ? 'ok' : 'warn'}`}>
                <div>
                  <p className="eyebrow">Export Readiness</p>
                  <h2>{canExportSelected ? 'Permission Available' : 'Review Only'}</h2>
                  <span>{selectedDataset.description}</span>
                </div>
                <div className="export-status-meta">
                  <StatusPill label={canExportSelected ? 'Can export' : selectedDataset.permission} tone={canExportSelected ? 'ok' : 'warn'} />
                  <strong>{selectedDataset.status}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Fields</h3>
                <div className="adapter-chip-grid">
                  {selectedDataset.fields.map(field => <span key={field}>{field}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Preview</h3>
                <DataTable
                  key={selectedDataset.id}
                  label="CSV Preview"
                  rows={previewRows}
                  pageSize={6}
                  emptyTitle="No rows available for this dataset."
                  columns={previewFields.map(field => ({
                    key: field,
                    header: field,
                    sortable: true,
                    searchValue: (row: ExportRow) => formatPreviewValue(row, field),
                    render: (row: ExportRow) => formatPreviewValue(row, field),
                  }))}
                />
              </div>

              <div className="detail-section">
                <h3>Guardrails</h3>
                <div className="settings-rule-list">
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Permission checked before CSV generation.</strong></div>
                  <div><Database size={16} strokeWidth={1.8} /><strong>Audit event written before local download.</strong></div>
                  <div><LockKeyhole size={16} strokeWidth={1.8} /><strong>No service-role keys or external destinations in browser.</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canExportSelected || selectedDataset.status !== 'Ready'}
                    onClick={() => exportDataset(selectedDataset)}
                  >
                    <Download size={15} strokeWidth={1.8} />
                    Export CSV
                  </button>
                  <span className="muted-copy">CSV export records an audit event and downloads locally. No external delivery is performed.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No export dataset selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function formatPreviewValue(row: ExportRow, field: string) {
  const value = row[field]
  if (value === null || typeof value === 'undefined') return ''
  return String(value)
}
