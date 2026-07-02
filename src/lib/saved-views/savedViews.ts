import { useEffect, useState } from 'react'
import type { AdminRole, PermissionKey } from '../permissions/permissions'

export type SavedViewTargetPage =
  | 'attention'
  | 'command-cadence'
  | 'clients'
  | 'client-success'
  | 'support'
  | 'action-requests'
  | 'action-timeline'
  | 'audit'
  | 'reports'
  | 'export-center'
  | 'revenue'
  | 'registrations'
  | 'data-quality'

export type SavedViewAudience = 'Personal' | 'Role' | 'Team'
export type SavedViewStatus = 'Active' | 'Draft' | 'Needs Review'
export type SavedViewSensitivity = 'Standard' | 'Restricted'
export type SavedViewCategory = 'Command' | 'Clients' | 'Support' | 'Finance' | 'Security' | 'Engineering'

export interface SavedViewFilter {
  field: string
  operator: 'is' | 'is not' | 'contains' | 'greater than' | 'less than' | 'within'
  value: string
}

export interface SavedViewDefinition {
  id: string
  name: string
  description: string
  category: SavedViewCategory
  targetPage: SavedViewTargetPage
  targetLabel: string
  owner: string
  ownerRole: AdminRole
  audience: SavedViewAudience
  status: SavedViewStatus
  sensitivity: SavedViewSensitivity
  permission: PermissionKey
  filters: SavedViewFilter[]
  columns: string[]
  sort: string
  cadence: string
  lastUsedAt: string
  source: 'System Template' | 'Local Saved View'
  pinned: boolean
}

export interface SavedViewsSummary {
  total: number
  active: number
  local: number
  restricted: number
  team: number
  needsReview: number
  pinned: number
}

const localStorageKey = 'hc_platform_saved_views_v1'

export const savedViewsBoundaryRule =
  'Saved views store internal filter contracts and local preferences only. Applying a view never mutates customer data, billing state, modules, permissions, or support records.'

export const savedViewTemplates: SavedViewDefinition[] = [
  {
    id: 'sv_attention_red_accounts',
    name: 'Red Accounts Watch',
    description: 'Executive watch list for clients with urgent risk, failed billing, or unresolved support load.',
    category: 'Command',
    targetPage: 'attention',
    targetLabel: 'Attention Queue',
    owner: 'Executive Ops',
    ownerRole: 'owner',
    audience: 'Team',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'dashboard.view',
    filters: [
      { field: 'Priority', operator: 'is', value: 'Critical' },
      { field: 'Health', operator: 'is not', value: 'Healthy' },
      { field: 'Open Work', operator: 'greater than', value: '0' },
    ],
    columns: ['Client', 'Risk', 'Owner', 'SLA', 'Next action'],
    sort: 'SLA ascending, MRR descending',
    cadence: 'Daily command review',
    lastUsedAt: '2026-06-09T14:05:00.000Z',
    source: 'System Template',
    pinned: true,
  },
  {
    id: 'sv_client_success_expansion',
    name: 'Expansion Ready Clients',
    description: 'Client success view for healthy accounts with module adoption momentum and upsell signals.',
    category: 'Clients',
    targetPage: 'client-success',
    targetLabel: 'Client Success',
    owner: 'Client Success',
    ownerRole: 'client_success',
    audience: 'Role',
    status: 'Active',
    sensitivity: 'Standard',
    permission: 'clients.view',
    filters: [
      { field: 'Health score', operator: 'greater than', value: '79' },
      { field: 'Usage trend', operator: 'is', value: 'Growing' },
      { field: 'Module gap', operator: 'contains', value: 'Upsell' },
    ],
    columns: ['Client', 'Plan', 'MRR', 'Usage', 'Module gap', 'CS owner'],
    sort: 'Expansion score descending',
    cadence: 'Weekly success pipeline',
    lastUsedAt: '2026-06-08T18:22:00.000Z',
    source: 'System Template',
    pinned: true,
  },
  {
    id: 'sv_support_breached_sla',
    name: 'Support SLA Breach Watch',
    description: 'Support operating view for critical or aging issues that need ownership before client escalation.',
    category: 'Support',
    targetPage: 'support',
    targetLabel: 'Support Center',
    owner: 'Support Lead',
    ownerRole: 'support_lead',
    audience: 'Team',
    status: 'Active',
    sensitivity: 'Standard',
    permission: 'support.view',
    filters: [
      { field: 'Severity', operator: 'is', value: 'critical' },
      { field: 'Status', operator: 'is not', value: 'Resolved' },
      { field: 'SLA', operator: 'within', value: 'Next 4 hours' },
    ],
    columns: ['Client', 'Venue', 'Issue', 'Severity', 'SLA', 'Owner'],
    sort: 'SLA ascending',
    cadence: 'Twice daily support standup',
    lastUsedAt: '2026-06-09T16:40:00.000Z',
    source: 'System Template',
    pinned: true,
  },
  {
    id: 'sv_finance_failed_payment',
    name: 'Failed Payment Recovery',
    description: 'Finance view for revenue leakage, failed payments, and recovery owner assignment.',
    category: 'Finance',
    targetPage: 'revenue',
    targetLabel: 'Revenue',
    owner: 'Finance',
    ownerRole: 'finance',
    audience: 'Role',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'revenue.view',
    filters: [
      { field: 'Billing status', operator: 'is', value: 'Failed Payment' },
      { field: 'MRR', operator: 'greater than', value: '$0' },
      { field: 'Recovery owner', operator: 'is not', value: 'None' },
    ],
    columns: ['Client', 'MRR', 'Billing status', 'Days overdue', 'Owner'],
    sort: 'MRR at risk descending',
    cadence: 'Monday finance review',
    lastUsedAt: '2026-06-07T13:12:00.000Z',
    source: 'System Template',
    pinned: false,
  },
  {
    id: 'sv_actions_waiting_approval',
    name: 'Action Requests Waiting Approval',
    description: 'Governance view for queued internal actions that require human approval before server execution.',
    category: 'Security',
    targetPage: 'action-requests',
    targetLabel: 'Action Requests',
    owner: 'Admin Ops',
    ownerRole: 'admin',
    audience: 'Team',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'admin_actions.view',
    filters: [
      { field: 'Status', operator: 'is', value: 'Queued' },
      { field: 'Approval', operator: 'is', value: 'Required' },
      { field: 'Permission', operator: 'contains', value: 'manage' },
    ],
    columns: ['Request', 'Type', 'Scope', 'Permission', 'Requester', 'Age'],
    sort: 'Created ascending',
    cadence: 'Daily approval sweep',
    lastUsedAt: '2026-06-09T19:18:00.000Z',
    source: 'System Template',
    pinned: true,
  },
  {
    id: 'sv_audit_sensitive_activity',
    name: 'Sensitive Activity Audit',
    description: 'Security review view for blocked, restricted, impersonation, export, and permission events.',
    category: 'Security',
    targetPage: 'audit',
    targetLabel: 'Audit Logs',
    owner: 'Engineering',
    ownerRole: 'engineering',
    audience: 'Team',
    status: 'Active',
    sensitivity: 'Restricted',
    permission: 'audit.view',
    filters: [
      { field: 'Severity', operator: 'is', value: 'critical' },
      { field: 'Action key', operator: 'contains', value: 'blocked' },
      { field: 'Permission', operator: 'contains', value: 'export' },
    ],
    columns: ['Time', 'Actor', 'Role', 'Action', 'Permission', 'Outcome'],
    sort: 'Time descending',
    cadence: 'Weekly security review',
    lastUsedAt: '2026-06-06T20:30:00.000Z',
    source: 'System Template',
    pinned: false,
  },
  {
    id: 'sv_exports_restricted',
    name: 'Restricted Export Review',
    description: 'Export governance view for restricted datasets and audit-controlled downloads.',
    category: 'Security',
    targetPage: 'export-center',
    targetLabel: 'Export Center',
    owner: 'Admin Ops',
    ownerRole: 'admin',
    audience: 'Team',
    status: 'Needs Review',
    sensitivity: 'Restricted',
    permission: 'reports.view',
    filters: [
      { field: 'Sensitivity', operator: 'is', value: 'Restricted' },
      { field: 'Permission', operator: 'contains', value: 'export' },
      { field: 'Status', operator: 'is', value: 'Ready' },
    ],
    columns: ['Dataset', 'Owner', 'Rows', 'Permission', 'Sensitivity', 'Status'],
    sort: 'Sensitivity descending, rows descending',
    cadence: 'Before external reporting',
    lastUsedAt: '2026-06-09T12:44:00.000Z',
    source: 'System Template',
    pinned: false,
  },
  {
    id: 'sv_engineering_data_quality',
    name: 'Data Quality Gaps',
    description: 'Engineering view for stale mappings, missing ownership, and substrate issues that affect support confidence.',
    category: 'Engineering',
    targetPage: 'data-quality',
    targetLabel: 'Data Quality',
    owner: 'Engineering',
    ownerRole: 'engineering',
    audience: 'Role',
    status: 'Draft',
    sensitivity: 'Standard',
    permission: 'health.view',
    filters: [
      { field: 'Severity', operator: 'is not', value: 'Info' },
      { field: 'Owner', operator: 'is', value: 'Engineering' },
      { field: 'Status', operator: 'is not', value: 'Resolved' },
    ],
    columns: ['Signal', 'Severity', 'Owner', 'Affected records', 'Next step'],
    sort: 'Severity descending',
    cadence: 'Weekly engineering triage',
    lastUsedAt: '2026-06-05T15:10:00.000Z',
    source: 'System Template',
    pinned: false,
  },
]

export function summarizeSavedViews(views: SavedViewDefinition[]): SavedViewsSummary {
  return {
    total: views.length,
    active: views.filter(view => view.status === 'Active').length,
    local: views.filter(view => view.source === 'Local Saved View').length,
    restricted: views.filter(view => view.sensitivity === 'Restricted').length,
    team: views.filter(view => view.audience === 'Team').length,
    needsReview: views.filter(view => view.status === 'Needs Review').length,
    pinned: views.filter(view => view.pinned).length,
  }
}

export function getSavedViewStatusTone(status: SavedViewStatus) {
  if (status === 'Active') return 'ok' as const
  if (status === 'Needs Review') return 'warn' as const
  return 'neutral' as const
}

export function getSavedViewSensitivityTone(sensitivity: SavedViewSensitivity) {
  return sensitivity === 'Restricted' ? 'warn' as const : 'info' as const
}

export function getSavedViewCategoryTone(category: SavedViewCategory) {
  if (category === 'Support' || category === 'Finance') return 'warn' as const
  if (category === 'Security') return 'danger' as const
  if (category === 'Engineering') return 'info' as const
  return 'ok' as const
}

export function createLocalSavedView(template: SavedViewDefinition, actorName: string): SavedViewDefinition {
  return {
    ...template,
    id: `local_${Date.now()}_${template.id}`,
    name: `${template.name} Copy`,
    owner: actorName,
    audience: 'Personal',
    status: 'Draft',
    source: 'Local Saved View',
    pinned: false,
    lastUsedAt: new Date().toISOString(),
  }
}

export function loadLocalSavedViews(): SavedViewDefinition[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedViewDefinition)
  } catch {
    return []
  }
}

export function saveLocalSavedViews(views: SavedViewDefinition[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(localStorageKey, JSON.stringify(views))
}

export function useLocalSavedViews() {
  const [views, setViews] = useState<SavedViewDefinition[]>(() => loadLocalSavedViews())

  useEffect(() => {
    saveLocalSavedViews(views)
  }, [views])

  return [views, setViews] as const
}

function isSavedViewDefinition(value: unknown): value is SavedViewDefinition {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.targetPage === 'string'
    && Array.isArray(record.filters)
    && Array.isArray(record.columns)
}
