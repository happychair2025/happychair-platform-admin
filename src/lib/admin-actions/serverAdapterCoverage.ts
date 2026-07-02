import type { AuditEvent } from '../audit/auditLog'
import type { AdminActionRequest } from './actionRequests'
import type { MockServerExecutionRecord } from './mockServerExecutor'
import type { ServerAdapterCheckStatus, ServerAdapterContract } from './serverAdapterReadiness'

export type ServerAdapterCoverageStatus = 'Covered' | 'Needs Dry Run' | 'Blocked' | 'Ready For Wiring' | 'Idle'

export interface ServerAdapterCoverageCheck {
  id: string
  label: string
  status: ServerAdapterCheckStatus
  detail: string
}

export interface ServerAdapterCoverageRecord {
  handlerKey: string
  status: ServerAdapterCoverageStatus
  score: number
  requestCount: number
  approvedRequestCount: number
  blockedRequestCount: number
  dryRunCount: number
  dryRunPassedCount: number
  dryRunBlockedCount: number
  latestDryRun?: MockServerExecutionRecord
  latestReview?: AuditEvent
  checks: ServerAdapterCoverageCheck[]
  nextStep: string
}

export interface ServerAdapterCoverageSummary {
  total: number
  covered: number
  needsDryRun: number
  blocked: number
  readyForWiring: number
  idle: number
  dryRunCount: number
  reviewed: number
  averageScore: number
}

export const serverAdapterCoverageBoundaryRule =
  'Adapter coverage measures whether a future server handler has request demand, dry-run proof, audit review, and readiness evidence. It is still a review surface, not a production execution path.'

export function buildServerAdapterCoverage(input: {
  contracts: ServerAdapterContract[]
  requests: AdminActionRequest[]
  executions: MockServerExecutionRecord[]
  auditEvents: AuditEvent[]
}): ServerAdapterCoverageRecord[] {
  return input.contracts.map(contract => {
    const requests = input.requests.filter(request => (
      request.serverHandler.key === contract.key
      || request.actionType === contract.actionType
    ))
    const executions = input.executions.filter(execution => execution.handlerKey === contract.key)
    const reviews = input.auditEvents
      .filter(event => event.actionKey.includes('server_adapter_readiness')
        && readStringMetadata(event.metadata, 'handlerKey') === contract.key)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const latestDryRun = executions
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    const dryRunPassedCount = executions.filter(execution => execution.status === 'Dry Run Passed' || execution.status === 'Completed Snapshot').length
    const dryRunBlockedCount = executions.filter(execution => execution.status === 'Dry Run Blocked').length
    const approvedRequestCount = requests.filter(request => request.status === 'Approved' || request.status === 'Running' || request.status === 'Completed').length
    const blockedRequestCount = requests.filter(request => request.status === 'Blocked' || request.status === 'Failed').length
    const checks = buildCoverageChecks({
      contract,
      requestCount: requests.length,
      approvedRequestCount,
      blockedRequestCount,
      dryRunCount: executions.length,
      dryRunPassedCount,
      dryRunBlockedCount,
      latestDryRun,
      latestReview: reviews[0],
    })

    return {
      handlerKey: contract.key,
      status: getCoverageStatus({
        contract,
        requestCount: requests.length,
        blockedRequestCount,
        dryRunCount: executions.length,
        dryRunPassedCount,
        dryRunBlockedCount,
      }),
      score: getCoverageScore(checks),
      requestCount: requests.length,
      approvedRequestCount,
      blockedRequestCount,
      dryRunCount: executions.length,
      dryRunPassedCount,
      dryRunBlockedCount,
      latestDryRun,
      latestReview: reviews[0],
      checks,
      nextStep: getNextStep(contract, requests.length, executions.length, dryRunPassedCount, dryRunBlockedCount, reviews[0]),
    }
  })
}

export function summarizeServerAdapterCoverage(records: ServerAdapterCoverageRecord[]): ServerAdapterCoverageSummary {
  return {
    total: records.length,
    covered: records.filter(record => record.status === 'Covered').length,
    needsDryRun: records.filter(record => record.status === 'Needs Dry Run').length,
    blocked: records.filter(record => record.status === 'Blocked').length,
    readyForWiring: records.filter(record => record.status === 'Ready For Wiring').length,
    idle: records.filter(record => record.status === 'Idle').length,
    dryRunCount: records.reduce((total, record) => total + record.dryRunCount, 0),
    reviewed: records.filter(record => record.latestReview).length,
    averageScore: records.length
      ? Math.round(records.reduce((total, record) => total + record.score, 0) / records.length)
      : 0,
  }
}

export function getServerAdapterCoverageTone(status: ServerAdapterCoverageStatus) {
  if (status === 'Ready For Wiring' || status === 'Covered') return 'ok' as const
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Needs Dry Run') return 'warn' as const
  return 'neutral' as const
}

function buildCoverageChecks(input: {
  contract: ServerAdapterContract
  requestCount: number
  approvedRequestCount: number
  blockedRequestCount: number
  dryRunCount: number
  dryRunPassedCount: number
  dryRunBlockedCount: number
  latestDryRun?: MockServerExecutionRecord
  latestReview?: AuditEvent
}): ServerAdapterCoverageCheck[] {
  return [
    {
      id: 'adapter_contract',
      label: 'Adapter contract',
      status: input.contract.status === 'Blocked' ? 'fail' : 'pass',
      detail: input.contract.status === 'Blocked'
        ? input.contract.blockers[0] ?? 'Adapter contract is blocked.'
        : `${input.contract.label} has a registered contract and ${input.contract.checks.length} readiness checks.`,
    },
    {
      id: 'request_demand',
      label: 'Request demand',
      status: input.requestCount ? 'pass' : 'warn',
      detail: input.requestCount
        ? `${input.requestCount} action request${input.requestCount === 1 ? '' : 's'} currently use this handler; ${input.approvedRequestCount} approved or beyond.`
        : 'No action requests currently use this handler.',
    },
    {
      id: 'blocked_requests',
      label: 'Blocked requests',
      status: input.blockedRequestCount ? 'fail' : 'pass',
      detail: input.blockedRequestCount
        ? `${input.blockedRequestCount} linked request${input.blockedRequestCount === 1 ? '' : 's'} are blocked or failed.`
        : 'No linked requests are blocked or failed.',
    },
    {
      id: 'dry_run_coverage',
      label: 'Dry-run coverage',
      status: input.dryRunPassedCount
        ? 'pass'
        : input.requestCount
          ? 'warn'
          : 'warn',
      detail: input.dryRunCount
        ? `${input.dryRunCount} dry run${input.dryRunCount === 1 ? '' : 's'} captured; ${input.dryRunPassedCount} passed.`
        : 'No dry-run execution record is linked yet.',
    },
    {
      id: 'dry_run_blockers',
      label: 'Dry-run blockers',
      status: input.dryRunBlockedCount ? 'fail' : 'pass',
      detail: input.dryRunBlockedCount
        ? `${input.dryRunBlockedCount} dry run${input.dryRunBlockedCount === 1 ? '' : 's'} were blocked.`
        : 'No blocked dry runs are linked to this handler.',
    },
    {
      id: 'latest_dry_run',
      label: 'Latest dry run',
      status: input.latestDryRun
        ? input.latestDryRun.status === 'Dry Run Blocked' ? 'fail' : input.latestDryRun.status === 'Needs Approval' ? 'warn' : 'pass'
        : 'warn',
      detail: input.latestDryRun
        ? `${input.latestDryRun.status}: ${input.latestDryRun.outcomeSummary}`
        : 'Run a mock server dry run before backend wiring.',
    },
    {
      id: 'adapter_review',
      label: 'Adapter review',
      status: input.latestReview ? 'pass' : 'warn',
      detail: input.latestReview
        ? `Latest adapter review recorded by ${input.latestReview.actorEmail ?? input.latestReview.actor}.`
        : 'No adapter review audit event is linked yet.',
    },
    {
      id: 'mutation_boundary',
      label: 'Mutation boundary',
      status: 'pass',
      detail: 'Coverage review never applies production mutations from the browser.',
    },
  ]
}

function getCoverageStatus(input: {
  contract: ServerAdapterContract
  requestCount: number
  blockedRequestCount: number
  dryRunCount: number
  dryRunPassedCount: number
  dryRunBlockedCount: number
}): ServerAdapterCoverageStatus {
  if (input.contract.status === 'Blocked' || input.blockedRequestCount > 0 || input.dryRunBlockedCount > 0) return 'Blocked'
  if (input.dryRunPassedCount > 0 && input.contract.status === 'Ready For Wiring') return 'Ready For Wiring'
  if (input.dryRunPassedCount > 0 || input.dryRunCount > 0) return 'Covered'
  if (input.requestCount > 0) return 'Needs Dry Run'
  return 'Idle'
}

function getCoverageScore(checks: ServerAdapterCoverageCheck[]) {
  const points = checks.reduce((total, check) => {
    if (check.status === 'pass') return total + 1
    if (check.status === 'warn') return total + 0.5
    return total
  }, 0)
  return Math.round((points / checks.length) * 100)
}

function getNextStep(
  contract: ServerAdapterContract,
  requestCount: number,
  dryRunCount: number,
  dryRunPassedCount: number,
  dryRunBlockedCount: number,
  latestReview: AuditEvent | undefined,
) {
  if (contract.status === 'Blocked') return contract.blockers[0] ?? 'Resolve adapter contract blockers.'
  if (dryRunBlockedCount) return 'Resolve blocked dry-run checks before backend wiring.'
  if (requestCount && !dryRunCount) return 'Run a mock server dry run for at least one linked request.'
  if (dryRunPassedCount && !latestReview) return 'Record an adapter review to anchor coverage in the audit ledger.'
  if (dryRunPassedCount && contract.status === 'Ready For Wiring') return 'Ready for server implementation planning with human approval gates intact.'
  if (dryRunPassedCount) return 'Keep review-only until the trusted server endpoint is configured.'
  return 'Monitor for action requests that need this handler.'
}

function readStringMetadata(metadata: AuditEvent['metadata'] | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : undefined
}
