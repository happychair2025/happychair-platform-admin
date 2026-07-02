import { useSyncExternalStore } from 'react'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { AgentDefinition, AgentEventRecord, AgentKey } from '../mock-data/mockPlatform'

export type LocalAgentRunStatus = 'Completed' | 'No Findings' | 'Blocked'
export type LocalAgentRuntimeKind = 'local_rules'

export interface LocalAgentRun {
  id: string
  agentKey: AgentKey
  agentName: string
  runtime: LocalAgentRuntimeKind
  status: LocalAgentRunStatus
  summary: string
  generatedEvents: AgentEventRecord[]
  createdAt: string
}

const storageKey = 'hc_platform_admin_local_agent_runs'
const listeners = new Set<() => void>()
let cachedRawRuns = ''
let cachedRuns: LocalAgentRun[] = []

export const localAgentRuntimeRule =
  'Local agents run deterministic, read-only scans over the Platform Admin read model. They may create reviewable recommendations, but they do not call an LLM, run background jobs, or mutate customer state.'

export function runLocalAgent(agent: AgentDefinition, data: PlatformAdminReadModel): LocalAgentRun {
  const createdAt = new Date().toISOString()
  const generatedEvents = buildAgentEvents(agent, data, createdAt)
  const status: LocalAgentRunStatus = generatedEvents.length ? 'Completed' : 'No Findings'

  return {
    id: `local-agent-run-${agent.key}-${crypto.randomUUID()}`,
    agentKey: agent.key,
    agentName: agent.name,
    runtime: 'local_rules',
    status,
    summary: generatedEvents.length
      ? `${agent.name} generated ${generatedEvents.length} reviewable finding${generatedEvents.length === 1 ? '' : 's'}.`
      : `${agent.name} scanned current read-model signals and found no new reviewable items.`,
    generatedEvents,
    createdAt,
  }
}

export function getLocalAgentRuns(): LocalAgentRun[] {
  if (typeof localStorage === 'undefined') return []
  const rawRuns = localStorage.getItem(storageKey) ?? '[]'
  if (rawRuns === cachedRawRuns) return cachedRuns

  try {
    cachedRawRuns = rawRuns
    cachedRuns = JSON.parse(rawRuns) as LocalAgentRun[]
    return cachedRuns
  } catch {
    cachedRawRuns = rawRuns
    cachedRuns = []
    return []
  }
}

export function saveLocalAgentRun(run: LocalAgentRun) {
  const runs = [
    run,
    ...getLocalAgentRuns().filter(item => item.id !== run.id),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 60)

  cachedRuns = runs
  cachedRawRuns = JSON.stringify(runs)
  localStorage.setItem(storageKey, cachedRawRuns)
  emitLocalAgentRunChange()
  return run
}

export function subscribeToLocalAgentRuns(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useLocalAgentRuns() {
  return useSyncExternalStore(subscribeToLocalAgentRuns, getLocalAgentRuns, () => [])
}

function buildAgentEvents(agent: AgentDefinition, data: PlatformAdminReadModel, createdAt: string): AgentEventRecord[] {
  switch (agent.key) {
    case 'support':
      return data.supportIssues
        .filter(issue => issue.status !== 'Resolved')
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
        .slice(0, 3)
        .map(issue => createAgentEvent(agent, createdAt, {
          organizationName: issue.organizationName,
          propertyName: issue.propertyName,
          venueName: issue.venueName,
          eventType: 'Risk Flagged',
          status: 'Needs Review',
          inputSummary: `${issue.issueType} at ${issue.venueName}: ${issue.probableCause}`,
          outputSummary: issue.recommendedAction,
        }))
    case 'finance':
      return data.billingRisks.slice(0, 3).map(risk => createAgentEvent(agent, createdAt, {
        organizationName: risk.organizationName,
        eventType: 'Trigger Detected',
        status: 'Needs Review',
        inputSummary: `${risk.billingStatus} with ${formatCurrency(risk.amountAtRisk)} at risk.`,
        outputSummary: `${risk.nextAction} Hold billing-affecting automation until finance review is complete.`,
      }))
    case 'client_success':
      return [
        ...data.organizations
          .filter(org => org.healthStatus === 'Expansion Candidate' || org.expansionScore >= 80)
          .slice(0, 2)
          .map(org => createAgentEvent(agent, createdAt, {
            organizationName: org.name,
            eventType: 'Recommendation Created',
            status: 'Needs Review',
            inputSummary: `${org.name} has ${org.healthScore} health and ${org.expansionScore} expansion score.`,
            outputSummary: `Prepare a human-reviewed expansion plan around ${org.enabledModules.join(', ') || 'active modules'}.`,
          })),
        ...data.usageAnalytics
          .filter(row => row.usageTrend === 'Declining' || row.inactiveDays >= 7)
          .slice(0, 2)
          .map(row => createAgentEvent(agent, createdAt, {
            organizationName: row.organizationName,
            eventType: 'Risk Flagged',
            status: 'Needs Review',
            inputSummary: `${row.organizationName} has ${row.inactiveDays} inactive days and ${row.usageTrend.toLowerCase()} usage.`,
            outputSummary: 'Create a client-success follow-up plan before adoption risk becomes churn risk.',
          })),
      ].slice(0, 4)
    case 'marketing':
      return data.registrations
        .filter(row => row.status === 'Demo Requested' || row.status === 'Trial Started')
        .slice(0, 3)
        .map(row => createAgentEvent(agent, createdAt, {
          organizationName: row.companyName,
          eventType: 'Summary Drafted',
          status: 'Needs Review',
          inputSummary: `${row.companyName} came from ${row.source} / ${row.campaign} with ${row.setupCompletion}% setup.`,
          outputSummary: `${row.marketType} demand is worth reviewing for campaign follow-up and landing-page fit.`,
        }))
    case 'website_content':
      return data.moduleUsageGaps.slice(0, 2).map(gap => createAgentEvent(agent, createdAt, {
        organizationName: gap.organizationName,
        eventType: 'Recommendation Created',
        status: 'Draft Only',
        inputSummary: `${gap.moduleName} usage is low after activation for ${gap.organizationName}.`,
        outputSummary: 'Draft website/help-path copy that sets clearer onboarding expectations for this module.',
      }))
    case 'seo_geo':
      return unique(data.registrations.map(row => row.marketType)).slice(0, 3).map(marketType => createAgentEvent(agent, createdAt, {
        eventType: 'Recommendation Created',
        status: 'Draft Only',
        inputSummary: `${marketType} appears in current registration demand.`,
        outputSummary: `Prepare an answer-engine content brief for ${marketType} service operations workflows.`,
      }))
    case 'sem':
      return data.registrations
        .filter(row => row.projectedMrr >= 700)
        .slice(0, 3)
        .map(row => createAgentEvent(agent, createdAt, {
          organizationName: row.companyName,
          eventType: 'Summary Drafted',
          status: 'Draft Only',
          inputSummary: `${row.companyName} projects ${formatCurrency(row.projectedMrr)} MRR from ${row.source}.`,
          outputSummary: 'Draft paid-search review notes for owner approval before any spend changes.',
        }))
    case 'sales_sdr':
      return data.registrations
        .filter(row => row.status === 'Demo Requested' || row.projectedMrr >= 1000)
        .slice(0, 3)
        .map(row => createAgentEvent(agent, createdAt, {
          organizationName: row.companyName,
          eventType: 'Trigger Detected',
          status: 'Queued',
          inputSummary: `${row.companyName} has ${row.status.toLowerCase()} status and ${formatCurrency(row.projectedMrr)} projected MRR.`,
          outputSummary: 'Score as sales-ready and draft outreach context for human review.',
        }))
    case 'email':
      return data.registrations
        .filter(row => row.status === 'Setup Incomplete' || row.setupCompletion < 80)
        .slice(0, 3)
        .map(row => createAgentEvent(agent, createdAt, {
          organizationName: row.companyName,
          eventType: 'Lifecycle Drafted',
          status: 'Draft Only',
          inputSummary: `${row.companyName} setup is ${row.setupCompletion}% complete.`,
          outputSummary: 'Draft a setup-completion nudge for client-success approval.',
        }))
    case 'social_media':
      return data.organizations
        .filter(org => org.healthStatus === 'Expansion Candidate' || org.healthScore >= 85)
        .slice(0, 2)
        .map(org => createAgentEvent(agent, createdAt, {
          organizationName: org.name,
          eventType: 'Recommendation Created',
          status: 'Draft Only',
          inputSummary: `${org.name} has strong health and recent usage signals.`,
          outputSummary: 'Draft a no-client-name customer-proof post angle for owner review.',
        }))
    default:
      return []
  }
}

function createAgentEvent(
  agent: AgentDefinition,
  createdAt: string,
  input: Omit<AgentEventRecord, 'id' | 'agentKey' | 'agentName' | 'auditRequired' | 'createdAt'>,
): AgentEventRecord {
  return {
    id: `local-agent-event-${agent.key}-${crypto.randomUUID()}`,
    agentKey: agent.key,
    agentName: agent.name,
    auditRequired: true,
    createdAt,
    ...input,
  }
}

function severityRank(severity: string) {
  if (severity === 'critical') return 4
  if (severity === 'warning') return 3
  if (severity === 'notice') return 2
  return 1
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function emitLocalAgentRunChange() {
  listeners.forEach(listener => listener())
}
