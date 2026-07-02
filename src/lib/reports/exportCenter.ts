import type { PermissionKey } from '../permissions/permissions'
import type { PlatformAdminReadModel } from '../supabase/readContracts'
import type { AuditEvent } from '../audit/auditLog'
import type { ActionTimelineEvent } from '../admin-actions/actionTimeline'
import type { AdminActionRequest } from '../admin-actions/actionRequests'

export type ExportDatasetCategory = 'Command' | 'Clients' | 'Finance' | 'Support' | 'Security'
export type ExportSensitivity = 'Internal' | 'Restricted'
export type ExportDatasetStatus = 'Ready' | 'Empty'
export type ExportCell = string | number | boolean | null | undefined
export type ExportRow = Record<string, ExportCell>

export interface ExportDatasetDefinition {
  id: string
  name: string
  category: ExportDatasetCategory
  owner: string
  permission: PermissionKey
  sensitivity: ExportSensitivity
  status: ExportDatasetStatus
  description: string
  source: string
  fields: string[]
  rows: ExportRow[]
}

export interface ExportCenterSummary {
  total: number
  ready: number
  restricted: number
  totalRows: number
  auditControlled: number
}

export interface BuildExportDatasetsInput {
  data: PlatformAdminReadModel
  actionRequests: AdminActionRequest[]
  auditEvents: AuditEvent[]
  timelineEvents: ActionTimelineEvent[]
}

export const exportCenterBoundaryRule =
  'Exports are local CSV artifacts generated only after permission checks and audit records. Production delivery, scheduled exports, and external transmission require server-side export workers and explicit destination controls.'

export function buildExportDatasets(input: BuildExportDatasetsInput): ExportDatasetDefinition[] {
  return [
    buildDataset({
      id: 'organizations',
      name: 'Organizations Export',
      category: 'Clients',
      owner: 'Client Success',
      permission: 'reports.export',
      sensitivity: 'Internal',
      source: 'platform_admin_organizations_read',
      description: 'Client account status, plan, billing, health, usage, expansion, and module footprint.',
      rows: input.data.organizations.map(org => ({
        id: org.id,
        name: org.name,
        accountStatus: org.accountStatus,
        plan: org.plan,
        billingStatus: org.billingStatus,
        marketType: org.marketType,
        mrr: org.mrr,
        properties: org.properties,
        venues: org.venues,
        users: org.users,
        staff: org.staff,
        healthScore: org.healthScore,
        healthStatus: org.healthStatus,
        usageScore: org.usageScore,
        expansionScore: org.expansionScore,
        lastActive: org.lastActive,
        enabledModules: org.enabledModules.join('; '),
      })),
    }),
    buildDataset({
      id: 'registrations',
      name: 'Registrations Export',
      category: 'Command',
      owner: 'Marketing',
      permission: 'reports.export',
      sensitivity: 'Internal',
      source: 'platform_admin_registrations_read',
      description: 'Signup source, campaign, status, setup completion, projected MRR, and plan intent.',
      rows: input.data.registrations.map(registration => ({
        id: registration.id,
        email: registration.email,
        companyName: registration.companyName,
        source: registration.source,
        campaign: registration.campaign,
        marketType: registration.marketType,
        selectedPlan: registration.selectedPlan,
        propertyType: registration.propertyType,
        status: registration.status,
        createdAt: registration.createdAt,
        setupCompletion: registration.setupCompletion,
        projectedMrr: registration.projectedMrr,
      })),
    }),
    buildDataset({
      id: 'revenue',
      name: 'Revenue Metrics Export',
      category: 'Finance',
      owner: 'Finance',
      permission: 'reports.export',
      sensitivity: 'Restricted',
      source: 'platform_admin_revenue_metrics_read',
      description: 'MRR, expansion, churn, reactivation, market, acquisition channel, and pending provider source.',
      rows: input.data.revenueMetrics.map(metric => ({
        id: metric.id,
        organizationName: metric.organizationName,
        metricType: metric.metricType,
        amount: metric.amount,
        currency: metric.currency,
        source: metric.source,
        periodStart: metric.periodStart,
        periodEnd: metric.periodEnd,
        plan: metric.plan,
        moduleName: metric.moduleName,
        marketType: metric.marketType,
        acquisitionChannel: metric.acquisitionChannel,
      })),
    }),
    buildDataset({
      id: 'billing-risks',
      name: 'Billing Risk Export',
      category: 'Finance',
      owner: 'Finance',
      permission: 'reports.export',
      sensitivity: 'Restricted',
      source: 'platform_admin_billing_risks_read',
      description: 'Failed payments, past due accounts, discount reviews, amount at risk, and finance next actions.',
      rows: input.data.billingRisks.map(risk => ({
        id: risk.id,
        organizationName: risk.organizationName,
        billingStatus: risk.billingStatus,
        amountAtRisk: risk.amountAtRisk,
        mrr: risk.mrr,
        lastPaymentAttempt: risk.lastPaymentAttempt,
        nextAction: risk.nextAction,
        owner: risk.owner,
      })),
    }),
    buildDataset({
      id: 'support-issues',
      name: 'Support Issues Export',
      category: 'Support',
      owner: 'Support',
      permission: 'reports.export',
      sensitivity: 'Internal',
      source: 'platform_admin_support_issues_read',
      description: 'Support issue status, severity, affected users, probable cause, owner, and recommended action.',
      rows: input.data.supportIssues.map(issue => ({
        id: issue.id,
        organizationName: issue.organizationName,
        propertyName: issue.propertyName,
        venueName: issue.venueName,
        issueType: issue.issueType,
        severity: issue.severity,
        status: issue.status,
        detectedAt: issue.detectedAt,
        affectedUsers: issue.affectedUsers,
        probableCause: issue.probableCause,
        recommendedAction: issue.recommendedAction,
        relatedSignal: issue.relatedSignal,
        owner: issue.owner,
      })),
    }),
    buildDataset({
      id: 'action-requests',
      name: 'Action Requests Export',
      category: 'Security',
      owner: 'Operations',
      permission: 'audit.export',
      sensitivity: 'Restricted',
      source: 'platform_admin_admin_action_requests_read + local_action_requests',
      description: 'Action request state, required permission, scope, handler, audit anchors, and rollback notes.',
      rows: input.actionRequests.map(request => ({
        id: request.id,
        actionType: request.actionType,
        title: request.title,
        requestedBy: request.requestedBy.email ?? request.requestedBy.name,
        requestedByRole: request.requestedBy.role,
        permissionRequired: request.permissionRequired,
        scope: request.scope.label,
        status: request.status,
        reason: request.reason,
        auditEventId: request.auditEventId,
        transitionAuditEventId: request.transitionAuditEventId,
        rollbackNotes: request.rollbackNotes,
        serverHandler: request.serverHandler.key,
        persistenceStatus: request.persistenceStatus,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })),
    }),
    buildDataset({
      id: 'action-timeline',
      name: 'Action Timeline Export',
      category: 'Security',
      owner: 'Operations',
      permission: 'audit.export',
      sensitivity: 'Restricted',
      source: 'action_timeline_composite',
      description: 'Chronological operating history across requests, approvals, handoffs, adapter reviews, dry-runs, and audit events.',
      rows: input.timelineEvents.map(event => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        title: event.title,
        detail: event.detail,
        actor: event.actor,
        actorRole: event.actorRole,
        scope: event.scope,
        statusLabel: event.statusLabel,
        severity: event.severity,
        source: event.source,
        actionRequestId: event.actionRequestId,
        auditEventId: event.auditEventId,
        handlerKey: event.handlerKey,
        persistenceLabel: event.persistenceLabel,
      })),
    }),
    buildDataset({
      id: 'audit-events',
      name: 'Audit Events Export',
      category: 'Security',
      owner: 'Operations',
      permission: 'audit.export',
      sensitivity: 'Restricted',
      source: 'platform_admin_audit_logs_read + local_audit_events',
      description: 'Immutable audit events, actor, permission, scope, outcome, persistence, and action metadata summary.',
      rows: input.auditEvents.map(event => ({
        id: event.id,
        actor: event.actor,
        actorEmail: event.actorEmail,
        actorRole: event.actorRole,
        scope: event.scope,
        actionKey: event.actionKey,
        actionLabel: event.actionLabel,
        severity: event.severity,
        permission: event.permission,
        outcome: event.outcome,
        persistenceStatus: event.persistenceStatus,
        persistenceTarget: event.persistenceTarget,
        metadataKeys: Object.keys(event.metadata ?? {}).join('; '),
        createdAt: event.createdAt,
      })),
    }),
  ]
}

export function summarizeExportDatasets(datasets: ExportDatasetDefinition[]): ExportCenterSummary {
  return {
    total: datasets.length,
    ready: datasets.filter(dataset => dataset.status === 'Ready').length,
    restricted: datasets.filter(dataset => dataset.sensitivity === 'Restricted').length,
    totalRows: datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0),
    auditControlled: datasets.filter(dataset => dataset.permission === 'audit.export').length,
  }
}

export function buildCsv(fields: string[], rows: ExportRow[]) {
  return [
    fields.map(escapeCsvCell).join(','),
    ...rows.map(row => fields.map(field => escapeCsvCell(row[field])).join(',')),
  ].join('\n')
}

export function getExportFilename(dataset: ExportDatasetDefinition, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `happy-chair-platform-${dataset.id}-${stamp}.csv`
}

export function getExportDatasetTone(status: ExportDatasetStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  return status === 'Ready' ? 'ok' : 'warn'
}

export function getExportSensitivityTone(sensitivity: ExportSensitivity): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  return sensitivity === 'Restricted' ? 'warn' : 'info'
}

function buildDataset(input: Omit<ExportDatasetDefinition, 'fields' | 'status'>): ExportDatasetDefinition {
  return {
    ...input,
    fields: getFields(input.rows),
    status: input.rows.length ? 'Ready' : 'Empty',
  }
}

function getFields(rows: ExportRow[]) {
  const fields = new Set<string>()
  rows.forEach(row => Object.keys(row).forEach(key => fields.add(key)))
  return [...fields]
}

function escapeCsvCell(value: ExportCell) {
  const text = value === null || typeof value === 'undefined' ? '' : String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}
