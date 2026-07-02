import { BookOpenCheck, CheckCircle2, Eye, GitBranch, ListChecks, PauseCircle, RotateCcw, ShieldCheck, UsersRound, Workflow } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { hasPermission } from '../../lib/permissions/permissions'
import {
  buildResponsePlaybooks,
  getResponsePlaybookCategoryTone,
  getResponsePlaybookStatusTone,
  responsePlaybookBoundaryRule,
  summarizeResponsePlaybooks,
  useLocalResponsePlaybookStates,
  type ResponsePlaybookCategory,
  type ResponsePlaybookDefinition,
  type ResponsePlaybookStatus,
} from '../../lib/watch-center/responsePlaybooks'
import {
  getWatchSensitivityTone,
  type WatchTargetPage,
} from '../../lib/watch-center/watchCenter'

interface ResponsePlaybooksPageProps {
  session: AdminSession
  onOpenTarget?: (page: WatchTargetPage) => void
  onOpenActionRequests?: () => void
}

const categoryFilters: Array<'All' | ResponsePlaybookCategory> = ['All', 'Support', 'Finance', 'Engineering', 'Security', 'Client Success', 'Admin Ops']

export default function ResponsePlaybooksPage({ session, onOpenTarget, onOpenActionRequests }: ResponsePlaybooksPageProps) {
  const [localStates, setLocalStates] = useLocalResponsePlaybookStates()
  const [selectedId, setSelectedId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'All' | ResponsePlaybookCategory>('All')
  const [notice, setNotice] = useState('')
  const canManagePlaybooks = hasPermission(session.role, 'notifications.manage')

  const playbooks = useMemo(() => buildResponsePlaybooks(localStates), [localStates])
  const summary = useMemo(() => summarizeResponsePlaybooks(playbooks), [playbooks])
  const categoryCounts = useMemo(() => {
    const counts = new Map<ResponsePlaybookCategory, number>()
    playbooks.forEach(playbook => counts.set(playbook.category, (counts.get(playbook.category) ?? 0) + 1))
    return counts
  }, [playbooks])
  const filteredPlaybooks = useMemo(() => categoryFilter === 'All'
    ? playbooks
    : playbooks.filter(playbook => playbook.category === categoryFilter),
  [categoryFilter, playbooks])
  const selectedPlaybook = filteredPlaybooks.find(playbook => playbook.id === selectedId)
    ?? playbooks.find(playbook => playbook.id === selectedId)
    ?? filteredPlaybooks[0]
    ?? playbooks[0]
  const canOpenSelected = selectedPlaybook ? hasPermission(session.role, selectedPlaybook.permission) : false
  const canQueueSelected = selectedPlaybook?.handoff.required
    && selectedPlaybook.handoff.permission
    && hasPermission(session.role, selectedPlaybook.handoff.permission)

  const updatePlaybookState = (playbook: ResponsePlaybookDefinition, status: ResponsePlaybookStatus, note: string) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: playbook.title,
      actionKey: `response_playbooks.${playbook.id}.${status.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${status} response playbook: ${playbook.title}`,
      severity: playbook.sensitivity === 'Restricted' || status === 'Paused' ? 'warning' : 'notice',
      metadata: buildResponsePlaybookMetadata(playbook, {
        responsePlaybookStatus: status,
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
        playbookId: playbook.id,
        status,
        note,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter(state => state.playbookId !== playbook.id),
    ])
    setNotice(`${playbook.title} marked ${status.toLowerCase()} locally and recorded in Audit Logs.`)
  }

  const resetPlaybookState = (playbook: ResponsePlaybookDefinition) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: playbook.title,
      actionKey: `response_playbooks.${playbook.id}.reset_local.mock`,
      actionLabel: `Reset local response playbook override: ${playbook.title}`,
      severity: 'notice',
      metadata: buildResponsePlaybookMetadata(playbook, {
        mutationApplied: false,
        localOnly: true,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalStates(current => current.filter(state => state.playbookId !== playbook.id))
    setNotice(`${playbook.title} restored to the system playbook state and recorded in Audit Logs.`)
  }

  const openTargetWorkspace = (playbook: ResponsePlaybookDefinition) => {
    const result = runAdminAction(session, {
      permission: playbook.permission,
      scope: playbook.title,
      actionKey: `response_playbooks.${playbook.id}.opened_target.mock`,
      actionLabel: `Opened target workspace for response playbook: ${playbook.title}`,
      severity: playbook.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildResponsePlaybookMetadata(playbook, {
        targetPage: playbook.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${playbook.title} target opened in ${targetPageLabels[playbook.targetPage]}.`)
    onOpenTarget?.(playbook.targetPage)
  }

  const queueHandoff = (playbook: ResponsePlaybookDefinition) => {
    if (!playbook.handoff.required || !playbook.handoff.actionType || !playbook.handoff.permission) {
      setNotice(`${playbook.title} does not require an action-request handoff.`)
      return
    }

    const result = queueAdminActionRequest(session, {
      actionType: playbook.handoff.actionType,
      title: `${playbook.title} handoff`,
      permission: playbook.handoff.permission,
      scope: createAdminActionScope({ label: playbook.title }),
      reason: `${playbook.title} requires a governed server-side handoff. The playbook blocks browser-side production mutations and requires audit-visible execution.`,
      rollbackNotes: playbook.handoff.rollbackNotes,
      severity: playbook.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildResponsePlaybookMetadata(playbook, {
        handoffRequired: playbook.handoff.required,
        humanConfirmationRequired: playbook.handoff.humanConfirmationRequired,
      }),
      handlerKey: playbook.handoff.handlerKey,
      handlerLabel: `${playbook.title} handler`,
      handlerDescription: `Server-side placeholder for ${playbook.title}.`,
    })

    setNotice(result.ok ? `${playbook.title} handoff queued in Action Requests.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Guided Response"
        title="Response Playbooks"
        description="Governed response paths for Watch Center signals, with steps, owners, blocked actions, audit expectations, and action-request handoff contracts."
        action={<StatusPill label={canManagePlaybooks ? 'Local review enabled' : 'Read only'} tone={canManagePlaybooks ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Playbooks" value={String(summary.total)} delta="System response paths" tone="neutral" icon={<BookOpenCheck size={16} />} />
        <MetricCard label="Active" value={String(summary.active)} delta="Ready for operators" tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Needs Review" value={String(summary.needsReview)} delta="Policy queue" tone={summary.needsReview ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
        <MetricCard label="Restricted" value={String(summary.restricted)} delta="Sensitive workflows" tone={summary.restricted ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Handoffs" value={String(summary.handoffRequired)} delta="Queue action requests" tone={summary.handoffRequired ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
        <MetricCard label="Customer Visible" value={String(summary.customerVisible)} delta="Needs careful messaging" tone={summary.customerVisible ? 'warn' : 'ok'} icon={<UsersRound size={16} />} />
        <MetricCard label="Avg Steps" value={String(summary.averageSteps)} delta="Per playbook" tone="neutral" icon={<Workflow size={16} />} />
        <MetricCard label="Local Overrides" value={String(summary.localOverrides)} delta="Browser-local state" tone={summary.localOverrides ? 'warn' : 'ok'} icon={<PauseCircle size={16} />} />
      </div>

      <section className="panel response-playbook-boundary-panel">
        <div>
          <p className="eyebrow">Playbook Boundary</p>
          <h2>Playbooks guide response, then hand off governed changes</h2>
          <span>{responsePlaybookBoundaryRule}</span>
        </div>
        <StatusPill label="Human confirmation first" tone="warn" />
      </section>

      <div className="timeline-filter-bar" aria-label="Response playbook categories">
        {categoryFilters.map(category => (
          <button
            key={category}
            className={categoryFilter === category ? 'selected' : ''}
            onClick={() => {
              setCategoryFilter(category)
              setSelectedId('')
            }}
          >
            {category}
            <span>{category === 'All' ? playbooks.length : categoryCounts.get(category) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="response-playbooks-layout">
        <DataTable
          label="Response Playbook Library"
          rows={filteredPlaybooks}
          pageSize={8}
          emptyTitle="No response playbooks match this category."
          columns={[
            {
              key: 'playbook',
              header: 'Playbook',
              sortable: true,
              searchValue: row => `${row.title} ${row.description}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              searchValue: row => row.category,
              render: row => <StatusPill label={row.category} tone={getResponsePlaybookCategoryTone(row.category)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getResponsePlaybookStatusTone(row.status)} />,
            },
            {
              key: 'steps',
              header: 'Steps',
              sortable: true,
              searchValue: row => String(row.steps.length).padStart(2, '0'),
              render: row => row.steps.length,
            },
            {
              key: 'handoff',
              header: 'Handoff',
              sortable: true,
              searchValue: row => row.handoff.required ? 'Required' : 'Optional',
              render: row => <StatusPill label={row.handoff.required ? 'Required' : 'Optional'} tone={row.handoff.required ? 'warn' : 'neutral'} />,
            },
            {
              key: 'sensitivity',
              header: 'Sensitivity',
              sortable: true,
              searchValue: row => row.sensitivity,
              render: row => <StatusPill label={row.sensitivity} tone={getWatchSensitivityTone(row.sensitivity)} />,
            },
          ]}
        />

        <aside className="detail-panel response-playbook-detail-panel">
          {selectedPlaybook ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Playbook Detail</p>
                  <h2>{selectedPlaybook.title}</h2>
                </div>
                <StatusPill label={selectedPlaybook.status} tone={getResponsePlaybookStatusTone(selectedPlaybook.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Category</span><strong>{selectedPlaybook.category}</strong></div>
                <div><span>Owner</span><strong>{selectedPlaybook.owner}</strong></div>
                <div><span>Target</span><strong>{targetPageLabels[selectedPlaybook.targetPage]}</strong></div>
                <div><span>Permission</span><strong>{selectedPlaybook.permission}</strong></div>
                <div><span>Mapped Rules</span><strong>{selectedPlaybook.mappedRuleIds.length}</strong></div>
                <div><span>Source</span><strong>{selectedPlaybook.source}</strong></div>
              </div>

              <section className={`panel response-playbook-status-panel tone-${selectedPlaybook.status === 'Paused' || selectedPlaybook.status === 'Needs Review' ? 'warn' : 'ok'}`}>
                <div>
                  <p className="eyebrow">Response Goal</p>
                  <h2>{selectedPlaybook.responseGoal}</h2>
                  <span>{selectedPlaybook.triggerSummary}</span>
                </div>
                <div className="response-playbook-status-meta">
                  <StatusPill label={selectedPlaybook.sensitivity} tone={getWatchSensitivityTone(selectedPlaybook.sensitivity)} />
                  <strong>{selectedPlaybook.handoff.required ? 'Handoff required' : 'Guidance only'}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Response Steps</h3>
                <div className="response-step-list">
                  {selectedPlaybook.steps.map(step => (
                    <div key={step.id}>
                      <span>{step.stage}</span>
                      <strong>{step.owner}</strong>
                      <p>{step.action}</p>
                      <small>{step.auditExpectation}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Handoff Contract</h3>
                <div className="settings-rule-list">
                  <div><GitBranch size={16} strokeWidth={1.8} /><strong>Handler: {selectedPlaybook.handoff.handlerKey}</strong></div>
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Confirmation: {selectedPlaybook.handoff.humanConfirmationRequired ? 'Required' : 'Not required'}</strong></div>
                  <div><RotateCcw size={16} strokeWidth={1.8} /><strong>Rollback: {selectedPlaybook.handoff.rollbackNotes}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Blocked Actions</h3>
                <div className="adapter-chip-grid">
                  {selectedPlaybook.blockedActions.map(action => <span key={action}>{action}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Success Criteria</h3>
                <div className="settings-rule-list">
                  {selectedPlaybook.successCriteria.map(item => (
                    <div key={item}><CheckCircle2 size={16} strokeWidth={1.8} /><strong>{item}</strong></div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canOpenSelected}
                    onClick={() => openTargetWorkspace(selectedPlaybook)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Open Target
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePlaybooks}
                    onClick={() => updatePlaybookState(selectedPlaybook, 'Active', 'Reviewed from Response Playbooks.')}
                  >
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Mark Reviewed
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePlaybooks}
                    onClick={() => updatePlaybookState(selectedPlaybook, 'Paused', 'Paused locally from Response Playbooks.')}
                  >
                    <PauseCircle size={15} strokeWidth={1.8} />
                    Pause Local
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManagePlaybooks}
                    onClick={() => resetPlaybookState(selectedPlaybook)}
                  >
                    <RotateCcw size={15} strokeWidth={1.8} />
                    Reset
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canQueueSelected}
                    onClick={() => queueHandoff(selectedPlaybook)}
                  >
                    <GitBranch size={15} strokeWidth={1.8} />
                    Queue Handoff
                  </button>
                  <button className="ghost-action" onClick={onOpenActionRequests}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Action Requests
                  </button>
                  <span className="muted-copy">Handoffs queue action requests and never execute production mutations from this page.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No response playbook selected.</div>
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

function buildResponsePlaybookMetadata(playbook: ResponsePlaybookDefinition, extra: Record<string, unknown>) {
  return {
    responsePlaybookId: playbook.id,
    responsePlaybookTitle: playbook.title,
    category: playbook.category,
    owner: playbook.owner,
    sensitivity: playbook.sensitivity,
    permission: playbook.permission,
    targetPage: playbook.targetPage,
    mappedRuleIds: playbook.mappedRuleIds,
    handoff: playbook.handoff,
    blockedActions: playbook.blockedActions,
    successCriteria: playbook.successCriteria,
    ...extra,
  }
}
