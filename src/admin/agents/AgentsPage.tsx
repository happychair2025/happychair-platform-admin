import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  HeartHandshake,
  LifeBuoy,
  Mail,
  Megaphone,
  MousePointerClick,
  PlayCircle,
  SearchCheck,
  Share2,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { localAgentRuntimeRule, runLocalAgent, saveLocalAgentRun, useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import type { AgentCategory, AgentDefinition } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

interface AgentsPageProps {
  session: AdminSession
}

const agentIcons = {
  marketing: Megaphone,
  website_content: FileText,
  social_media: Share2,
  seo_geo: SearchCheck,
  sem: MousePointerClick,
  sales_sdr: UserRoundPlus,
  email: Mail,
  support: LifeBuoy,
  finance: CircleDollarSign,
  client_success: HeartHandshake,
} as const

const agentCategoryOrder: AgentCategory[] = [
  'Growth',
  'Sales',
  'Client Success',
  'Support',
  'Finance',
  'Product / Platform',
  'Risk / Trust',
]

function statusTone(status: string): 'ok' | 'warn' | 'info' | 'neutral' {
  if (status === 'Monitoring Ready' || status === 'Reviewed') return 'ok'
  if (status === 'Needs Review' || status === 'Draft Only') return 'warn'
  if (status === 'Queued') return 'info'
  return 'neutral'
}

export default function AgentsPage({ session }: AgentsPageProps) {
  const { data } = usePlatformData()
  const { agentDefinitions, agentEvents } = data
  const localAgentRuns = useLocalAgentRuns()
  const [selectedKey, setSelectedKey] = useState(agentDefinitions[0]?.key ?? 'marketing')
  const [notice, setNotice] = useState('')
  const selectedAgent = useMemo(
    () => agentDefinitions.find(agent => agent.key === selectedKey) ?? agentDefinitions[0],
    [agentDefinitions, selectedKey],
  )
  const groupedAgents = useMemo(
    () => agentCategoryOrder
      .map(category => ({
        category,
        agents: agentDefinitions.filter(agent => agent.category === category),
      }))
      .filter(group => group.agents.length > 0),
    [agentDefinitions],
  )
  const localAgentEvents = useMemo(() => localAgentRuns.flatMap(run => run.generatedEvents), [localAgentRuns])
  const allAgentEvents = useMemo(() => {
    const localIds = new Set(localAgentEvents.map(event => event.id))
    return [
      ...localAgentEvents,
      ...agentEvents.filter(event => !localIds.has(event.id)),
    ]
  }, [agentEvents, localAgentEvents])
  const selectedEvents = selectedAgent ? allAgentEvents.filter(event => event.agentKey === selectedAgent.key) : []
  const monitoringReady = agentDefinitions.filter(agent => agent.status === 'Monitoring Ready').length
  const needsReview = allAgentEvents.filter(event => event.status === 'Needs Review' || event.status === 'Queued').length
  const auditRequired = allAgentEvents.filter(event => event.auditRequired).length
  const canManageAgents = hasPermission(session.role, 'agents.manage')

  const runAgentScan = (agent: AgentDefinition) => {
    const run = saveLocalAgentRun(runLocalAgent(agent, data))
    setNotice(run.summary)
  }

  const runReadyAgentScans = () => {
    const readyAgents = agentDefinitions.filter(agent => agent.status === 'Monitoring Ready')
    const runs = readyAgents.map(agent => saveLocalAgentRun(runLocalAgent(agent, data)))
    const generatedCount = runs.reduce((sum, run) => sum + run.generatedEvents.length, 0)
    setNotice(`Local ready-agent scan completed: ${runs.length} agents ran and generated ${generatedCount} reviewable finding${generatedCount === 1 ? '' : 's'}.`)
  }

  const auditAgentAction = (agent: AgentDefinition, action: string) => {
    const result = runAdminAction(session, {
      permission: 'agents.view',
      scope: agent.name,
      actionKey: `agent.${action}.mock`,
      actionLabel: `${agent.name} ${action.replace(/_/g, ' ')}`,
      severity: 'notice',
    })
    setNotice(result.ok ? `${agent.name} review recorded in Audit Logs.` : result.message)
  }

  const queueAgentRecommendation = (agent: AgentDefinition) => {
    const reviewEvent = selectedEvents.find(event => event.status === 'Needs Review' || event.status === 'Queued') ?? selectedEvents[0]
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Approve ${agent.name} recommendation`,
      permission: 'agents.manage',
      scope: createAdminActionScope({
        organizationName: reviewEvent?.organizationName,
        propertyName: reviewEvent?.propertyName,
        venueName: reviewEvent?.venueName,
        label: reviewEvent?.venueName ?? reviewEvent?.propertyName ?? reviewEvent?.organizationName ?? agent.name,
      }),
      reason: reviewEvent?.outputSummary ?? `${agent.name} recommendation requires human approval before any client-state change.`,
      rollbackNotes: 'Keep the agent event in review state. Do not send customer messages, change modules, alter billing, or mutate support records unless the server handler is explicitly approved.',
      severity: 'warning',
      metadata: {
        agentKey: agent.key,
        agentName: agent.name,
        agentEventId: reviewEvent?.id,
        eventType: reviewEvent?.eventType,
      },
    })
    setNotice(result.ok ? `${agent.name} recommendation queued for approval.` : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Agent Foundation"
        title="Agent Foundation"
        description="Local read-only agents can scan platform signals, create reviewable findings, and queue human-approved recommendations. LLM/provider execution comes later."
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Agent Workflows" value={String(agentDefinitions.length)} delta={`${groupedAgents.length} grouped categories`} tone="neutral" icon={<Bot size={16} />} />
        <MetricCard label="Local Runs" value={String(localAgentRuns.length)} delta="Deterministic scans" tone="ok" icon={<PlayCircle size={16} />} />
        <MetricCard label="Needs Review" value={String(needsReview)} delta="Human approval queue" tone={needsReview ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Audit Required" value={String(auditRequired)} delta="Events with future audit hooks" tone="warn" icon={<CheckCircle2 size={16} />} />
      </div>

      <section className="panel agent-safety-panel">
        <div>
          <p className="eyebrow">Agent Safety Rules</p>
          <h2>Agents can recommend, summarize, draft, classify, and flag only</h2>
          <span>Any future action that changes billing, modules, permissions, messaging, support records, or client state must require a permission check, human confirmation, audit log entry, and visible activity record.</span>
        </div>
        <StatusPill label="No silent mutations" tone="danger" />
      </section>

      <section className="panel agent-runtime-panel">
        <div>
          <p className="eyebrow">Runtime Status</p>
          <h2>Local read-only agents are active</h2>
          <span>{localAgentRuntimeRule}</span>
        </div>
        <div className="runtime-status-grid">
          <div><StatusPill label="Present" tone="ok" /><strong>Local rules runtime</strong></div>
          <div><StatusPill label="Present" tone="ok" /><strong>Durable browser run ledger</strong></div>
          <div><StatusPill label="Missing" tone="warn" /><strong>LLM/provider adapter</strong></div>
          <div><StatusPill label="Missing" tone="warn" /><strong>Server job scheduler</strong></div>
        </div>
        <div className="support-actions">
          <button className="ghost-action" onClick={runReadyAgentScans}>
            <PlayCircle size={15} strokeWidth={1.8} />
            Run Ready Agents
          </button>
        </div>
      </section>

      <div className="agent-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Agent Registry</h2>
              <span>Safe operating contracts for future Claude workflows</span>
            </div>
          </div>

          <div className="agent-card-grid">
            {groupedAgents.map(group => (
              <div className="agent-category-section" key={group.category}>
                <div className="agent-category-header">
                  <div>
                    <p className="eyebrow">{group.category}</p>
                    <h3>{group.agents.length} sub-agent{group.agents.length === 1 ? '' : 's'}</h3>
                  </div>
                  <StatusPill label={`${group.agents.filter(agent => agent.status === 'Monitoring Ready').length} ready`} tone="info" />
                </div>

                {group.agents.map(agent => {
                  const Icon = agentIcons[agent.key]
                  return (
                    <button
                      key={agent.key}
                      className={`agent-card${agent.key === selectedAgent?.key ? ' selected' : ''}`}
                      onClick={() => setSelectedKey(agent.key)}
                    >
                      <span className="module-icon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <span>
                        <strong>{agent.name}</strong>
                        <small>{agent.purpose}</small>
                      </span>
                      <StatusPill label={agent.status} tone={statusTone(agent.status)} />
                    </button>
                  )
                })}
              </div>
            ))}
            {!groupedAgents.length && (
              <div className="empty-state compact">No agent contracts are available yet.</div>
            )}
          </div>
        </section>

        {selectedAgent ? <aside className="detail-panel agent-detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Agent Contract</p>
              <h2>{selectedAgent.name}</h2>
            </div>
            <div className="agent-detail-pills">
              <StatusPill label={selectedAgent.category} tone="neutral" />
              <StatusPill label={selectedAgent.owner} tone="info" />
            </div>
          </div>

          <p className="muted-copy">{selectedAgent.purpose}</p>

          <div className="detail-section">
            <h3>Monitors</h3>
            <div className="agent-chip-list">
              {selectedAgent.monitors.map(item => <span key={item}>{item}</span>)}
            </div>
          </div>

          <div className="agent-rule-columns">
            <div>
              <h3>Allowed</h3>
              {selectedAgent.allowedActions.map(item => (
                <p key={item}><CheckCircle2 size={15} strokeWidth={1.8} />{item}</p>
              ))}
            </div>
            <div>
              <h3>Blocked</h3>
              {selectedAgent.blockedActions.map(item => (
                <p key={item}><ShieldCheck size={15} strokeWidth={1.8} />{item}</p>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>Activity Hooks</h3>
            <div className="usage-gap-list">
              {selectedEvents.length ? selectedEvents.map(event => (
                <article key={event.id} className="usage-gap-item">
                  <strong>{event.eventType}</strong>
                  <p>{event.inputSummary}</p>
                  <span>{event.outputSummary}</span>
                </article>
              )) : <p className="muted-copy">No mock events for this agent yet.</p>}
            </div>
          </div>

          <div className="support-actions">
            <button className="ghost-action" onClick={() => runAgentScan(selectedAgent)}>
              <PlayCircle size={15} strokeWidth={1.8} />
              Run Local Scan
            </button>
            <button className="ghost-action" onClick={() => auditAgentAction(selectedAgent, 'draft_reviewed')}>
              <CheckCircle2 size={15} strokeWidth={1.8} />
              Record Review
            </button>
            <button className="ghost-action" disabled={!canManageAgents} onClick={() => queueAgentRecommendation(selectedAgent)}>
              <ClipboardCheck size={15} strokeWidth={1.8} />
              Queue Recommendation
            </button>
          </div>
        </aside> : <aside className="detail-panel"><div className="empty-state compact">No agent contracts are available yet.</div></aside>}
      </div>

      <DataTable
        label="Agent Event Hooks"
        rows={allAgentEvents}
        columns={[
          {
            key: 'agent',
            header: 'Agent',
            sortable: true,
            searchValue: row => row.agentName,
            render: row => <strong>{row.agentName}</strong>,
          },
          {
            key: 'event',
            header: 'Event',
            sortable: true,
            searchValue: row => row.eventType,
            render: row => row.eventType,
          },
          {
            key: 'client',
            header: 'Client',
            sortable: true,
            searchValue: row => row.organizationName ?? '',
            render: row => row.venueName ?? row.propertyName ?? row.organizationName ?? 'Platform',
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={statusTone(row.status)} />,
          },
          {
            key: 'audit',
            header: 'Audit',
            sortable: true,
            searchValue: row => row.auditRequired ? 'Required' : 'Optional',
            render: row => <StatusPill label={row.auditRequired ? 'Required' : 'Optional'} tone={row.auditRequired ? 'warn' : 'neutral'} />,
          },
        ]}
      />

      <DataTable
        label="Local Agent Runs"
        rows={localAgentRuns}
        pageSize={5}
        emptyTitle="No local agent runs have been recorded yet."
        columns={[
          {
            key: 'agent',
            header: 'Agent',
            sortable: true,
            searchValue: row => row.agentName,
            render: row => <strong>{row.agentName}</strong>,
          },
          {
            key: 'runtime',
            header: 'Runtime',
            sortable: true,
            searchValue: row => row.runtime,
            render: row => <StatusPill label="Local Rules" tone="ok" />,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={row.status === 'Completed' ? 'ok' : 'neutral'} />,
          },
          {
            key: 'findings',
            header: 'Findings',
            sortable: true,
            searchValue: row => String(row.generatedEvents.length),
            render: row => row.generatedEvents.length,
          },
          {
            key: 'created',
            header: 'Created',
            sortable: true,
            searchValue: row => row.createdAt,
            render: row => new Date(row.createdAt).toLocaleString(),
          },
        ]}
      />
    </div>
  )
}
