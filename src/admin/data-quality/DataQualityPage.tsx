import { AlertTriangle, CheckCircle2, ClipboardCheck, DatabaseZap, ListChecks, ShieldCheck, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import {
  buildDataQualityModel,
  getDataQualitySeverityTone,
  getDataQualityStatusTone,
  type DataQualityArea,
  type DataQualityCheck,
} from '../../lib/data-quality/dataQuality'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'
import { readOnlyViewNames } from '../../lib/supabase/readContracts'

interface DataQualityPageProps {
  session: AdminSession
}

const areaFilters: Array<'All' | DataQualityArea> = ['All', 'Read Model', 'Hierarchy', 'Usage', 'Billing', 'Support', 'Registrations', 'Modules', 'Agents', 'Security']

export default function DataQualityPage({ session }: DataQualityPageProps) {
  const { data, sourceLabel, status, readViewDiagnostics } = usePlatformData()
  const [selectedArea, setSelectedArea] = useState<'All' | DataQualityArea>('All')
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const canQueue = hasPermission(session.role, 'admin_actions.manage')
  const model = useMemo(() => buildDataQualityModel(data, readViewDiagnostics), [data, readViewDiagnostics])
  const rows = useMemo(() => model.checks.filter(check => selectedArea === 'All' || check.area === selectedArea), [model.checks, selectedArea])
  const selectedCheck = rows.find(check => check.id === selectedId) ?? rows[0] ?? model.checks[0]
  const viewCount = Object.keys(readOnlyViewNames).length

  const recordReview = (check: DataQualityCheck) => {
    const result = runAdminAction(session, {
      permission: 'health.view',
      scope: check.area,
      actionKey: 'data_quality.check_reviewed.mock',
      actionLabel: `Reviewed data quality check: ${check.title}`,
      severity: check.severity === 'Critical' ? 'critical' : check.severity === 'High' ? 'warning' : 'notice',
      metadata: {
        checkId: check.id,
        area: check.area,
        status: check.status,
        affectedRecords: check.affectedRecords,
      },
    })
    setNotice(result.ok ? `${check.title} review recorded.` : result.message)
  }

  const queueFixPacket = (check: DataQualityCheck) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Data quality packet: ${check.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: check.area }),
      reason: check.remediation,
      rollbackNotes: 'Do not mutate production tenant data from the browser. Server-side repair must preserve prior records, write audit entries, and include rollback notes.',
      severity: check.severity === 'Critical' ? 'critical' : check.severity === 'High' ? 'warning' : 'notice',
      metadata: {
        checkId: check.id,
        area: check.area,
        status: check.status,
        affectedRecords: check.affectedRecords,
        owner: check.owner,
        dataQualityPacket: true,
      },
    })
    setNotice(result.ok ? `Data quality packet queued for ${check.title}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Platform Integrity"
        title="Data Quality"
        description="Read-model completeness, hierarchy integrity, scope resolution, provider mapping, feature flag risk, and future Data Quality Agent review."
        action={<StatusPill label={`${sourceLabel} / ${status}`} tone="info" />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Checks" value={String(model.checks.length)} delta={`${viewCount} read views tracked`} tone="neutral" icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Blocked" value={String(model.blockedCount)} delta="Must resolve before mutation" tone={model.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Needs Review" value={String(model.reviewCount)} delta="Human-owned checks" tone={model.reviewCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Affected Records" value={String(model.affectedRecords)} delta="Across current read model" tone={model.affectedRecords ? 'warn' : 'ok'} icon={<DatabaseZap size={16} />} />
      </div>

      <section className="panel data-quality-boundary-panel">
        <div>
          <p className="eyebrow">Integrity Boundary</p>
          <h2>Fix packets are queued, not executed in the browser</h2>
          <span>Read-model checks can identify bad scopes, missing summaries, or provider mapping gaps. Production repair still requires server-side permission checks and audit entries.</span>
        </div>
        <StatusPill label={canQueue ? 'Packets Allowed' : 'Review Only'} tone={canQueue ? 'ok' : 'warn'} />
      </section>

      <div className="support-selector" aria-label="Data quality area filters">
        {areaFilters.map(area => (
          <button key={area} className={selectedArea === area ? 'selected' : ''} onClick={() => setSelectedArea(area)}>
            <DatabaseZap size={15} strokeWidth={1.8} />
            {area}
          </button>
        ))}
      </div>

      <div className="data-quality-layout">
        <DataTable
          label="Data Quality Checks"
          rows={rows}
          pageSize={8}
          emptyTitle="No data quality checks match this area."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getDataQualityStatusTone(row.status)} />,
            },
            {
              key: 'check',
              header: 'Check',
              sortable: true,
              searchValue: row => `${row.title} ${row.reason} ${row.remediation}`,
              render: row => <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>,
            },
            {
              key: 'area',
              header: 'Area',
              sortable: true,
              searchValue: row => row.area,
              render: row => row.area,
            },
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => row.severity,
              render: row => <StatusPill label={row.severity} tone={getDataQualitySeverityTone(row.severity)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'affected',
              header: 'Affected',
              sortable: true,
              searchValue: row => String(row.affectedRecords),
              render: row => row.affectedRecords,
            },
          ]}
        />

        <aside className="detail-panel data-quality-detail-panel">
          {selectedCheck ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Integrity Check</p>
                  <h2>{selectedCheck.title}</h2>
                </div>
                <StatusPill label={selectedCheck.status} tone={getDataQualityStatusTone(selectedCheck.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Area</span><strong>{selectedCheck.area}</strong></div>
                <div><span>Owner</span><strong>{selectedCheck.owner}</strong></div>
                <div><span>Severity</span><strong>{selectedCheck.severity}</strong></div>
                <div><span>Affected</span><strong>{selectedCheck.affectedRecords}</strong></div>
                <div><span>Audit</span><strong>{selectedCheck.auditRequired ? 'Required' : 'Optional'}</strong></div>
                <div><span>Checked</span><strong>{new Date(selectedCheck.checkedAt).toLocaleTimeString()}</strong></div>
              </div>

              <div className="detail-section">
                <h3>Reason</h3>
                <p className="muted-copy">{selectedCheck.reason}</p>
              </div>

              <div className="detail-section">
                <h3>Remediation</h3>
                <p className="warning-copy">{selectedCheck.remediation}</p>
              </div>

              <div className="detail-section">
                <h3>Guardrails</h3>
                <div className="settings-rule-list">
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Keep cross-tenant visibility explicit and auditable.</strong></div>
                  <div><DatabaseZap size={16} strokeWidth={1.8} /><strong>Prefer read-only views before server-side repair handlers.</strong></div>
                  <div><Wrench size={16} strokeWidth={1.8} /><strong>Repair packets must include rollback notes before production execution.</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => recordReview(selectedCheck)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" disabled={!canQueue || selectedCheck.status === 'Passing'} onClick={() => queueFixPacket(selectedCheck)}>
                    <Wrench size={15} strokeWidth={1.8} />
                    Queue Fix Packet
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No data quality check selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}
