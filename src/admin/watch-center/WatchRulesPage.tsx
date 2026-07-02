import { BellRing, Clock3, Eye, GitBranch, ListChecks, PauseCircle, RotateCcw, Route, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { hasPermission } from '../../lib/permissions/permissions'
import {
  getWatchPriorityTone,
  getWatchSensitivityTone,
  getWatchSourceTone,
  type WatchSignalSource,
  type WatchTargetPage,
} from '../../lib/watch-center/watchCenter'
import {
  buildWatchRules,
  formatSla,
  getWatchRuleRiskTone,
  getWatchRuleStatusTone,
  summarizeWatchRules,
  useLocalWatchRuleStates,
  watchRulesBoundaryRule,
  type WatchRuleDefinition,
  type WatchRuleStatus,
} from '../../lib/watch-center/watchRules'

interface WatchRulesPageProps {
  session: AdminSession
  onOpenTarget?: (page: WatchTargetPage) => void
}

const sourceFilters: Array<'All' | WatchSignalSource> = ['All', 'Support', 'Billing', 'Health', 'Action Requests', 'Audit', 'Saved Views', 'Usage']

export default function WatchRulesPage({ session, onOpenTarget }: WatchRulesPageProps) {
  const [localStates, setLocalStates] = useLocalWatchRuleStates()
  const [selectedId, setSelectedId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | WatchSignalSource>('All')
  const [notice, setNotice] = useState('')
  const canManageRules = hasPermission(session.role, 'notifications.manage')

  const rules = useMemo(() => buildWatchRules(localStates), [localStates])
  const summary = useMemo(() => summarizeWatchRules(rules), [rules])
  const sourceCounts = useMemo(() => {
    const counts = new Map<WatchSignalSource, number>()
    rules.forEach(rule => counts.set(rule.signalSource, (counts.get(rule.signalSource) ?? 0) + 1))
    return counts
  }, [rules])
  const filteredRules = useMemo(() => sourceFilter === 'All'
    ? rules
    : rules.filter(rule => rule.signalSource === sourceFilter),
  [rules, sourceFilter])
  const selectedRule = filteredRules.find(rule => rule.id === selectedId)
    ?? rules.find(rule => rule.id === selectedId)
    ?? filteredRules[0]
    ?? rules[0]
  const canOpenSelected = selectedRule ? hasPermission(session.role, selectedRule.permission) : false

  const updateRuleState = (rule: WatchRuleDefinition, status: WatchRuleStatus, note: string) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: rule.name,
      actionKey: `watch_rules.${rule.id}.${status.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${status} watch rule: ${rule.name}`,
      severity: rule.sensitivity === 'Restricted' || status === 'Paused' ? 'warning' : 'notice',
      metadata: buildWatchRuleMetadata(rule, {
        watchRuleStatus: status,
        note,
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => [
      {
        ruleId: rule.id,
        status,
        note,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.ruleId !== rule.id),
    ])
    setNotice(`${rule.name} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetRuleState = (rule: WatchRuleDefinition) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: rule.name,
      actionKey: `watch_rules.${rule.id}.reset_local.mock`,
      actionLabel: `Reset local watch rule override: ${rule.name}`,
      severity: 'notice',
      metadata: buildWatchRuleMetadata(rule, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => current.filter(state => state.ruleId !== rule.id))
    setNotice(`${rule.name} restored to the system rule state and recorded in Audit Logs.`)
  }

  const openTargetWorkspace = (rule: WatchRuleDefinition) => {
    const result = runAdminAction(session, {
      permission: rule.permission,
      scope: rule.name,
      actionKey: `watch_rules.${rule.id}.opened_target.mock`,
      actionLabel: `Opened target workspace for watch rule: ${rule.name}`,
      severity: rule.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildWatchRuleMetadata(rule, {
        targetPage: rule.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${rule.name} target opened in ${targetPageLabels[rule.targetPage]}.`)
    onOpenTarget?.(rule.targetPage)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Watch Governance"
        title="Watch Rules"
        description="Configurable operating rules for signal thresholds, owners, SLA windows, and escalation paths behind Watch Center."
        action={<StatusPill label={canManageRules ? 'Local policy review enabled' : 'Read only'} tone={canManageRules ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Rules" value={String(summary.total)} delta="System policy contracts" tone="neutral" icon={<SlidersHorizontal size={16} />} />
        <MetricCard label="Active" value={String(summary.active)} delta="Currently governing watches" tone="ok" icon={<BellRing size={16} />} />
        <MetricCard label="Needs Review" value={String(summary.needsReview)} delta="Policy review queue" tone={summary.needsReview ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Paused" value={String(summary.paused)} delta="Local override only" tone={summary.paused ? 'warn' : 'ok'} icon={<PauseCircle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Restricted" value={String(summary.restricted)} delta="Sensitive signals" tone={summary.restricted ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Action Escalations" value={String(summary.actionRequestEscalations)} delta="Can route into action requests" tone="neutral" icon={<GitBranch size={16} />} />
        <MetricCard label="Avg SLA" value={formatSla(summary.averageSlaMinutes)} delta="Across all rules" tone="neutral" icon={<Clock3 size={16} />} />
        <MetricCard label="Local Overrides" value={String(summary.localOverrides)} delta="Browser-local policy state" tone={summary.localOverrides ? 'warn' : 'ok'} icon={<Route size={16} />} />
      </div>

      <section className="panel watch-rules-boundary-panel">
        <div>
          <p className="eyebrow">Rule Boundary</p>
          <h2>Rules define attention policy, not production alert delivery</h2>
          <span>{watchRulesBoundaryRule}</span>
        </div>
        <StatusPill label="Server policy pending" tone="warn" />
      </section>

      <div className="timeline-filter-bar" aria-label="Watch rule sources">
        {sourceFilters.map(source => (
          <button
            key={source}
            className={sourceFilter === source ? 'selected' : ''}
            onClick={() => {
              setSourceFilter(source)
              setSelectedId('')
            }}
          >
            {source}
            <span>{source === 'All' ? rules.length : sourceCounts.get(source) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="watch-rules-layout">
        <DataTable
          label="Watch Rule Library"
          rows={filteredRules}
          pageSize={8}
          emptyTitle="No watch rules match this source."
          columns={[
            {
              key: 'rule',
              header: 'Rule',
              sortable: true,
              searchValue: row => `${row.name} ${row.description}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.name}
                </button>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              sortable: true,
              searchValue: row => row.signalSource,
              render: row => <StatusPill label={row.signalSource} tone={getWatchSourceTone(row.signalSource)} />,
            },
            {
              key: 'priority',
              header: 'Priority',
              sortable: true,
              searchValue: row => prioritySortValue(row.priority),
              render: row => <StatusPill label={row.priority} tone={getWatchPriorityTone(row.priority)} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getWatchRuleStatusTone(row.status)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'sla',
              header: 'SLA',
              sortable: true,
              searchValue: row => String(row.slaMinutes).padStart(5, '0'),
              render: row => formatSla(row.slaMinutes),
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => row.falsePositiveRisk,
              render: row => <StatusPill label={row.falsePositiveRisk} tone={getWatchRuleRiskTone(row.falsePositiveRisk)} />,
            },
          ]}
        />

        <aside className="detail-panel watch-rule-detail-panel">
          {selectedRule ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Rule Detail</p>
                  <h2>{selectedRule.name}</h2>
                </div>
                <StatusPill label={selectedRule.status} tone={getWatchRuleStatusTone(selectedRule.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Source</span><strong>{selectedRule.signalSource}</strong></div>
                <div><span>Owner</span><strong>{selectedRule.owner}</strong></div>
                <div><span>Priority</span><strong>{selectedRule.priority}</strong></div>
                <div><span>SLA</span><strong>{formatSla(selectedRule.slaMinutes)}</strong></div>
                <div><span>Permission</span><strong>{selectedRule.permission}</strong></div>
                <div><span>Policy Source</span><strong>{selectedRule.source}</strong></div>
              </div>

              <section className={`panel watch-rule-status-panel tone-${selectedRule.status === 'Needs Review' || selectedRule.status === 'Paused' ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Trigger Contract</p>
                  <h2>{selectedRule.trigger.metric}</h2>
                  <span>{selectedRule.trigger.operator} {selectedRule.trigger.value} / {selectedRule.trigger.window}</span>
                </div>
                <div className="watch-rule-status-meta">
                  <StatusPill label={selectedRule.sensitivity} tone={getWatchSensitivityTone(selectedRule.sensitivity)} />
                  <strong>{selectedRule.impactedSignals} current signals</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Escalation Path</h3>
                <div className="watch-rule-escalation-list">
                  {selectedRule.escalationSteps.map(step => (
                    <div key={`${step.afterMinutes}-${step.owner}-${step.channel}`}>
                      <span>{formatSla(step.afterMinutes)}</span>
                      <strong>{step.owner} / {step.channel}</strong>
                      <p>{step.action}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence Fields</h3>
                <div className="adapter-chip-grid">
                  {selectedRule.evidenceFields.map(field => <span key={field}>{field}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Implementation Contract</h3>
                <div className="settings-rule-list">
                  <div><Route size={16} strokeWidth={1.8} /><strong>Handler: {selectedRule.serverHandler}</strong></div>
                  <div><Eye size={16} strokeWidth={1.8} /><strong>Target: {targetPageLabels[selectedRule.targetPage]}</strong></div>
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Permission and audit checks required before server-side policy changes.</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canOpenSelected}
                    onClick={() => openTargetWorkspace(selectedRule)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageRules}
                    onClick={() => updateRuleState(selectedRule, 'Active', 'Reviewed from Watch Rules.')}
                  >
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Mark Reviewed
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageRules}
                    onClick={() => updateRuleState(selectedRule, 'Paused', 'Paused locally from Watch Rules.')}
                  >
                    <PauseCircle size={15} strokeWidth={1.8} />
                    Pause Local
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageRules}
                    onClick={() => resetRuleState(selectedRule)}
                  >
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset
                  </button>
                  <span className="muted-copy">Actions record audit events and update local rule-review state only.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No watch rule selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

const targetPageLabels: Record<WatchTargetPage, string> = {
  attention: 'Attention Queue',
  support: 'Support Center',
  revenue: 'Revenue',
  health: 'Client Health',
  'action-requests': 'Action Requests',
  audit: 'Audit Logs',
  'saved-views': 'Saved Views',
  'data-quality': 'Data Quality',
  usage: 'Usage Analytics',
}

function buildWatchRuleMetadata(rule: WatchRuleDefinition, extra: Record<string, unknown>) {
  return {
    watchRuleId: rule.id,
    watchRuleName: rule.name,
    signalSource: rule.signalSource,
    owner: rule.owner,
    priority: rule.priority,
    sensitivity: rule.sensitivity,
    permission: rule.permission,
    trigger: rule.trigger,
    slaMinutes: rule.slaMinutes,
    escalationSteps: rule.escalationSteps,
    serverHandler: rule.serverHandler,
    ...extra,
  }
}

function prioritySortValue(priority: WatchRuleDefinition['priority']) {
  if (priority === 'Critical') return '0 Critical'
  if (priority === 'High') return '1 High'
  if (priority === 'Medium') return '2 Medium'
  return '3 Low'
}
