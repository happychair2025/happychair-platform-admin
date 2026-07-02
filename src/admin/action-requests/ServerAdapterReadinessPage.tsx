import { CheckCircle2, Code2, Database, FileCheck2, KeyRound, LockKeyhole, Route, ServerCog, ShieldCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { actionExecutionBoundaryRule, getActionExecutionConfig } from '../../lib/admin-actions/actionExecutionContract'
import { useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import {
  buildServerAdapterCoverage,
  getServerAdapterCoverageTone,
  serverAdapterCoverageBoundaryRule,
  summarizeServerAdapterCoverage,
} from '../../lib/admin-actions/serverAdapterCoverage'
import {
  buildServerAdapterReadiness,
  getServerAdapterCheckTone,
  getServerAdapterReadinessTone,
  serverAdapterBoundaryRule,
  summarizeServerAdapterReadiness,
  type ServerAdapterContract,
} from '../../lib/admin-actions/serverAdapterReadiness'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import { hasPermission } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'

interface ServerAdapterReadinessPageProps {
  session: AdminSession
}

export default function ServerAdapterReadinessPage({ session }: ServerAdapterReadinessPageProps) {
  const { data } = usePlatformData()
  const executionConfig = getActionExecutionConfig(import.meta.env)
  const localRequests = useLocalAdminActionRequests()
  const localExecutions = useLocalMockServerExecutions()
  const localAuditEvents = useLocalAuditEvents()
  const contracts = useMemo(() => buildServerAdapterReadiness(executionConfig), [executionConfig])
  const summary = useMemo(() => summarizeServerAdapterReadiness(contracts), [contracts])
  const requests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])
  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])
  const coverageRecords = useMemo(() => buildServerAdapterCoverage({
    contracts,
    requests,
    executions: localExecutions,
    auditEvents,
  }), [auditEvents, contracts, localExecutions, requests])
  const coverageSummary = useMemo(() => summarizeServerAdapterCoverage(coverageRecords), [coverageRecords])
  const coverageByHandlerKey = useMemo(() => new Map(coverageRecords.map(record => [record.handlerKey, record])), [coverageRecords])
  const [selectedKey, setSelectedKey] = useState('')
  const [notice, setNotice] = useState('')
  const selectedContract = contracts.find(contract => contract.key === selectedKey) ?? contracts[0]
  const selectedCoverage = selectedContract ? coverageByHandlerKey.get(selectedContract.key) : undefined
  const canReview = hasPermission(session.role, 'admin_actions.view')

  const recordAdapterReview = (contract: ServerAdapterContract) => {
    const coverage = coverageByHandlerKey.get(contract.key)
    const result = runAdminAction(session, {
      permission: 'admin_actions.view',
      scope: contract.simulatedWriteTarget,
      actionKey: 'server_adapter_readiness.review_recorded.mock',
      actionLabel: `Reviewed server adapter readiness for ${contract.label}`,
      severity: contract.status === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        handlerKey: contract.key,
        actionType: contract.actionType,
        adapterStatus: contract.status,
        endpointConfigured: contract.endpointConfigured,
        route: contract.route,
        requiredPermission: contract.requiredPermission,
        simulatedWriteTarget: contract.simulatedWriteTarget,
        blockers: contract.blockers,
        warnings: contract.warnings,
        coverageStatus: coverage?.status,
        coverageScore: coverage?.score,
        coverageRequestCount: coverage?.requestCount,
        coverageApprovedRequestCount: coverage?.approvedRequestCount,
        coverageDryRunCount: coverage?.dryRunCount,
        coverageDryRunPassedCount: coverage?.dryRunPassedCount,
        coverageDryRunBlockedCount: coverage?.dryRunBlockedCount,
        latestDryRunId: coverage?.latestDryRun?.id,
        mutationApplied: false,
      },
    })
    setNotice(result.ok ? `Adapter readiness review recorded for ${contract.label}.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Server Adapter Contracts"
        title="Server Adapter Readiness"
        description="Backend handler wiring map for future production actions: endpoints, permissions, dry-run registry, request and response shapes, audit events, rollback strategy, and mutation boundary checks."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Adapters" value={String(summary.total)} delta="Future trusted handlers" tone="neutral" icon={<ServerCog size={16} />} />
        <MetricCard label="Ready For Wiring" value={String(summary.readyForWiring)} delta={summary.endpointConfigured ? 'Endpoint configured' : 'Requires endpoint'} tone={summary.readyForWiring ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Review Only" value={String(summary.reviewOnly)} delta="No production execution path" tone={summary.reviewOnly ? 'warn' : 'ok'} icon={<FileCheck2 size={16} />} />
        <MetricCard label="Blocked" value={String(summary.blocked)} delta="Contract gaps" tone={summary.blocked ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Dry-Run Registered" value={String(summary.dryRunRegistered)} delta="Mock handler registry coverage" tone={summary.dryRunRegistered === summary.total ? 'ok' : 'warn'} icon={<Code2 size={16} />} />
        <MetricCard label="Endpoint" value={summary.endpointConfigured ? 'Set' : 'Unset'} delta={executionConfig.endpoint || 'VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT'} tone={summary.endpointConfigured ? 'ok' : 'warn'} icon={<Route size={16} />} />
        <MetricCard label="Browser Secrets" value="0" delta="No service-role keys in client" tone="ok" icon={<LockKeyhole size={16} />} />
        <MetricCard label="Production Writes" value="0" delta="Readiness is contract review only" tone="ok" icon={<Database size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Covered Handlers" value={String(coverageSummary.covered + coverageSummary.readyForWiring)} delta={`${coverageSummary.averageScore}% average coverage score`} tone={coverageSummary.covered + coverageSummary.readyForWiring ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Needs Dry Run" value={String(coverageSummary.needsDryRun)} delta="Requests exist without dry-run proof" tone={coverageSummary.needsDryRun ? 'warn' : 'ok'} icon={<FileCheck2 size={16} />} />
        <MetricCard label="Coverage Blocked" value={String(coverageSummary.blocked)} delta="Blocked request or dry-run evidence" tone={coverageSummary.blocked ? 'danger' : 'ok'} icon={<XCircle size={16} />} />
        <MetricCard label="Adapter Reviews" value={String(coverageSummary.reviewed)} delta={`${coverageSummary.dryRunCount} dry-run records linked`} tone={coverageSummary.reviewed ? 'ok' : 'warn'} icon={<KeyRound size={16} />} />
      </div>

      <section className="panel server-adapter-boundary-panel">
        <div>
          <p className="eyebrow">Adapter Boundary</p>
          <h2>Adapters define the backend contract before backend mutation exists</h2>
          <span>{serverAdapterBoundaryRule}</span>
          <span>{serverAdapterCoverageBoundaryRule}</span>
          <span>{actionExecutionBoundaryRule}</span>
        </div>
        <StatusPill label={summary.endpointConfigured ? 'Endpoint configured' : 'Review only'} tone={summary.endpointConfigured ? 'ok' : 'warn'} />
      </section>

      <div className="server-adapter-layout">
        <DataTable
          label="Adapter Contracts"
          rows={contracts}
          pageSize={8}
          emptyTitle="No server adapter contracts are registered."
          columns={[
            {
              key: 'adapter',
              header: 'Adapter',
              sortable: true,
              searchValue: row => `${row.label} ${row.key}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedKey(row.key)}>
                  {row.label}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getServerAdapterReadinessTone(row.status)} />,
            },
            {
              key: 'coverage',
              header: 'Coverage',
              sortable: true,
              searchValue: row => coverageByHandlerKey.get(row.key)?.status ?? 'Idle',
              render: row => {
                const coverage = coverageByHandlerKey.get(row.key)
                return coverage
                  ? <StatusPill label={`${coverage.status} ${coverage.score}%`} tone={getServerAdapterCoverageTone(coverage.status)} />
                  : <StatusPill label="Idle" tone="neutral" />
              },
            },
            {
              key: 'action',
              header: 'Action',
              sortable: true,
              searchValue: row => row.actionLabel,
              render: row => row.actionLabel,
            },
            {
              key: 'permission',
              header: 'Permission',
              sortable: true,
              searchValue: row => row.requiredPermission,
              render: row => <code>{row.requiredPermission}</code>,
            },
            {
              key: 'route',
              header: 'Route',
              sortable: true,
              searchValue: row => row.route,
              render: row => <code>{row.route}</code>,
            },
            {
              key: 'target',
              header: 'Target',
              sortable: true,
              searchValue: row => row.simulatedWriteTarget,
              render: row => row.simulatedWriteTarget,
            },
            {
              key: 'dryRun',
              header: 'Dry Run',
              sortable: true,
              searchValue: row => row.dryRunRegistered ? 'Registered' : 'Missing',
              render: row => <StatusPill label={row.dryRunRegistered ? 'Registered' : 'Missing'} tone={row.dryRunRegistered ? 'ok' : 'danger'} />,
            },
          ]}
        />

        <aside className="detail-panel server-adapter-detail-panel">
          {selectedContract ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Adapter Detail</p>
                  <h2>{selectedContract.label}</h2>
                </div>
                <StatusPill label={selectedContract.status} tone={getServerAdapterReadinessTone(selectedContract.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Action</span><strong>{selectedContract.actionLabel}</strong></div>
                <div><span>Handler Key</span><strong>{selectedContract.key}</strong></div>
                <div><span>Permission</span><strong>{selectedContract.requiredPermission}</strong></div>
                <div><span>Method</span><strong>{selectedContract.method}</strong></div>
                <div><span>Route</span><strong>{selectedContract.route}</strong></div>
                <div><span>Target</span><strong>{selectedContract.simulatedWriteTarget}</strong></div>
              </div>

              <section className={`panel server-adapter-status-panel tone-${selectedContract.blockers.length ? 'danger' : selectedContract.warnings.length ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Readiness</p>
                  <h2>{selectedContract.status}</h2>
                  <span>{getAdapterNarrative(selectedContract)}</span>
                </div>
                <div className="server-adapter-status-meta">
                  <StatusPill label={`${selectedContract.blockers.length} blockers`} tone={selectedContract.blockers.length ? 'danger' : 'ok'} />
                  <strong>{selectedContract.warnings.length} warnings</strong>
                </div>
              </section>

              {selectedCoverage && (
                <div className="detail-section">
                  <h3>Handler Coverage</h3>
                  <section className={`panel server-adapter-coverage-panel tone-${coverageToneClass(selectedCoverage.status)}`}>
                    <div>
                      <p className="eyebrow">Coverage</p>
                      <h2>{selectedCoverage.status}</h2>
                      <span>{selectedCoverage.nextStep}</span>
                    </div>
                    <div className="server-adapter-coverage-meta">
                      <StatusPill label={`${selectedCoverage.score}% score`} tone={getServerAdapterCoverageTone(selectedCoverage.status)} />
                      <strong>{selectedCoverage.dryRunCount} dry runs</strong>
                    </div>
                  </section>

                  <div className="server-adapter-coverage-grid">
                    <div><span>Requests</span><strong>{selectedCoverage.requestCount}</strong></div>
                    <div><span>Approved+</span><strong>{selectedCoverage.approvedRequestCount}</strong></div>
                    <div><span>Dry Runs Passed</span><strong>{selectedCoverage.dryRunPassedCount}</strong></div>
                    <div><span>Dry Runs Blocked</span><strong>{selectedCoverage.dryRunBlockedCount}</strong></div>
                    <div><span>Latest Dry Run</span><strong>{selectedCoverage.latestDryRun ? formatDateTime(selectedCoverage.latestDryRun.createdAt) : 'None'}</strong></div>
                    <div><span>Latest Review</span><strong>{selectedCoverage.latestReview ? formatDateTime(selectedCoverage.latestReview.createdAt) : 'None'}</strong></div>
                  </div>
                </div>
              )}

              {selectedCoverage && (
                <div className="detail-section">
                  <h3>Coverage Checks</h3>
                  <div className="governance-check-list">
                    {selectedCoverage.checks.map(check => (
                      <article key={check.id} className={`governance-check-item tone-${check.status}`}>
                        <div>
                          <strong>{check.label}</strong>
                          <StatusPill label={check.status} tone={getServerAdapterCheckTone(check.status)} />
                        </div>
                        <p>{check.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Readiness Checks</h3>
                <div className="governance-check-list">
                  {selectedContract.checks.map(check => (
                    <article key={check.id} className={`governance-check-item tone-${check.status}`}>
                      <div>
                        <strong>{check.label}</strong>
                        <StatusPill label={check.status} tone={getServerAdapterCheckTone(check.status)} />
                      </div>
                      <p>{check.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Request Schema</h3>
                <div className="adapter-chip-grid">
                  {selectedContract.requestSchema.map(field => <span key={field}>{field}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Response Schema</h3>
                <div className="adapter-chip-grid">
                  {selectedContract.responseSchema.map(field => <span key={field}>{field}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Required Server Controls</h3>
                <div className="settings-rule-list">
                  {selectedContract.requiredServerControls.map(control => (
                    <div key={control}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{control}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Audit Events</h3>
                <div className="adapter-chip-grid">
                  {selectedContract.auditEvents.map(event => <span key={event}>{event}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Rollback Strategy</h3>
                <p className="muted-copy">{selectedContract.rollbackStrategy}</p>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canReview}
                    onClick={() => recordAdapterReview(selectedContract)}
                  >
                    <KeyRound size={15} strokeWidth={1.8} />
                    Record Adapter Review
                  </button>
                  <span className="muted-copy">Adapter reviews document readiness only. They do not call server handlers.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No adapter selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function getAdapterNarrative(contract: ServerAdapterContract) {
  if (contract.blockers.length) return contract.blockers[0]
  if (contract.status === 'Ready For Wiring') return 'Endpoint and adapter contract are ready for future backend implementation.'
  return 'Adapter contract is documented and dry-run capable, but endpoint wiring remains review-only until the trusted backend exists.'
}

function coverageToneClass(status: string) {
  if (status === 'Ready For Wiring' || status === 'Covered') return 'ok'
  if (status === 'Blocked') return 'danger'
  if (status === 'Needs Dry Run') return 'warn'
  return 'neutral'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
