import { hasPermission, roleLabels, rolePermissions, type AdminRole, type PermissionKey } from './permissions'

export type PermissionCapabilityArea = 'Command' | 'Clients' | 'Operations' | 'Security' | 'Company' | 'Settings'
export type PermissionCapabilityRisk = 'Critical' | 'High' | 'Medium' | 'Low'

export interface PermissionCapability {
  id: string
  label: string
  area: PermissionCapabilityArea
  permission: PermissionKey
  risk: PermissionCapabilityRisk
  description: string
  auditExpectation: string
}

export interface PermissionSimulationRow extends PermissionCapability {
  allowed: boolean
}

export interface PermissionComparison {
  added: PermissionKey[]
  removed: PermissionKey[]
  shared: PermissionKey[]
}

export interface PermissionSimulationResult {
  role: AdminRole
  rows: PermissionSimulationRow[]
  allowedCount: number
  blockedCount: number
  sensitiveAllowedCount: number
  crossTenantAllowedCount: number
}

export const permissionCapabilities: PermissionCapability[] = [
  {
    id: 'executive-dashboard',
    label: 'View executive dashboard',
    area: 'Command',
    permission: 'dashboard.view',
    risk: 'Low',
    description: 'View ownership-level operating metrics and command summaries.',
    auditExpectation: 'Read-only dashboard access can be audited through page review events when needed.',
  },
  {
    id: 'registrations-view',
    label: 'View registration funnel',
    area: 'Command',
    permission: 'registrations.view',
    risk: 'Medium',
    description: 'Review signups, trials, campaigns, setup state, and conversion signals.',
    auditExpectation: 'Exports and bulk follow-up actions require separate audit paths.',
  },
  {
    id: 'revenue-manage',
    label: 'Manage revenue records',
    area: 'Command',
    permission: 'revenue.manage',
    risk: 'High',
    description: 'Review or prepare revenue-affecting provider operations and reporting adjustments.',
    auditExpectation: 'Every revenue-affecting action must capture source, provider, amount, and rollback context.',
  },
  {
    id: 'client-360',
    label: 'View Client 360',
    area: 'Clients',
    permission: 'clients.view',
    risk: 'Medium',
    description: 'View cross-tenant client, property, venue, module, support, and finance context.',
    auditExpectation: 'Sensitive client review can be recorded as a scoped audit event.',
  },
  {
    id: 'client-manage',
    label: 'Manage client records',
    area: 'Clients',
    permission: 'clients.manage',
    risk: 'High',
    description: 'Prepare client record changes, ownership notes, lifecycle state, or success follow-up changes.',
    auditExpectation: 'Client-changing work must flow through permissioned server handlers or durable support notes.',
  },
  {
    id: 'property-manage',
    label: 'Manage properties',
    area: 'Clients',
    permission: 'properties.manage',
    risk: 'High',
    description: 'Prepare property-level operations, setup state, and internal ownership changes.',
    auditExpectation: 'Property mutations must preserve tenant scope and visible activity history.',
  },
  {
    id: 'venue-manage',
    label: 'Manage venues',
    area: 'Clients',
    permission: 'venues.manage',
    risk: 'High',
    description: 'Prepare venue-level lifecycle, troubleshooting, and configuration changes.',
    auditExpectation: 'Venue mutations must be scoped to the correct property and organization.',
  },
  {
    id: 'module-manage',
    label: 'Enable or disable modules',
    area: 'Operations',
    permission: 'modules.manage',
    risk: 'Critical',
    description: 'Change module activation, entitlement, scope, dependencies, or rollout state.',
    auditExpectation: 'Requires dependency checks, human approval, rollback notes, and server-side execution.',
  },
  {
    id: 'support-manage',
    label: 'Manage support lifecycle',
    area: 'Operations',
    permission: 'support.manage',
    risk: 'High',
    description: 'Assign, investigate, escalate, or resolve support issues.',
    auditExpectation: 'Lifecycle changes require visible activity records and owner/status history.',
  },
  {
    id: 'troubleshooting-run',
    label: 'Run troubleshooting actions',
    area: 'Operations',
    permission: 'troubleshooting.run',
    risk: 'High',
    description: 'Queue support-safe remediation, runbook packets, diagnostics, or engineering handoff.',
    auditExpectation: 'Runbook outcomes must preserve evidence, blocked actions, and server-action readiness.',
  },
  {
    id: 'admin-action-manage',
    label: 'Manage action requests',
    area: 'Operations',
    permission: 'admin_actions.manage',
    risk: 'Critical',
    description: 'Approve, block, run, complete, or retry server action requests.',
    auditExpectation: 'Governance readiness, approvers, rollback, and transition audit events are required.',
  },
  {
    id: 'impersonation-start',
    label: 'Start support view-as',
    area: 'Security',
    permission: 'impersonation.start',
    risk: 'Critical',
    description: 'Start a scoped support view-as session for customer troubleshooting.',
    auditExpectation: 'Requires reason, tenant scope, expiry, sensitive-action block, and immutable audit trail.',
  },
  {
    id: 'impersonation-destructive',
    label: 'Allow destructive view-as actions',
    area: 'Security',
    permission: 'impersonation.destructive_actions',
    risk: 'Critical',
    description: 'Permit destructive actions while impersonating a customer user.',
    auditExpectation: 'This should be owner-only and blocked by default unless explicitly approved.',
  },
  {
    id: 'audit-export',
    label: 'Export audit logs',
    area: 'Security',
    permission: 'audit.export',
    risk: 'High',
    description: 'Export audit, security, impersonation, and action history.',
    auditExpectation: 'Exports must capture actor, filters, destination, and sensitivity scope.',
  },
  {
    id: 'agents-manage',
    label: 'Manage agent workflows',
    area: 'Company',
    permission: 'agents.manage',
    risk: 'Critical',
    description: 'Approve or operate human-reviewed agent recommendations.',
    auditExpectation: 'Agents may recommend only; state-changing recommendations require human approval and audit.',
  },
  {
    id: 'billing-manage',
    label: 'Manage billing review',
    area: 'Company',
    permission: 'billing.manage',
    risk: 'Critical',
    description: 'Review provider-affecting billing, discount, credit, or recovery actions.',
    auditExpectation: 'Finance actions must capture provider, amount, owner approval, and reconciliation status.',
  },
  {
    id: 'feature-flags-manage',
    label: 'Manage feature flags',
    area: 'Company',
    permission: 'feature_flags.manage',
    risk: 'Critical',
    description: 'Change internal/staging/production feature flags and rollout controls.',
    auditExpectation: 'Requires blast-radius review, rollout plan, rollback path, and owner/engineering approval.',
  },
  {
    id: 'settings-manage',
    label: 'Manage admin settings',
    area: 'Settings',
    permission: 'settings.manage',
    risk: 'Critical',
    description: 'Change internal control, permission, data-source, or deployment settings.',
    auditExpectation: 'Permission-affecting changes require simulator review and approval records.',
  },
]

export function buildPermissionSimulation(role: AdminRole): PermissionSimulationResult {
  const rows = permissionCapabilities.map(capability => ({
    ...capability,
    allowed: hasPermission(role, capability.permission),
  }))
  const allowedRows = rows.filter(row => row.allowed)

  return {
    role,
    rows,
    allowedCount: allowedRows.length,
    blockedCount: rows.length - allowedRows.length,
    sensitiveAllowedCount: allowedRows.filter(row => row.risk === 'Critical' || row.risk === 'High').length,
    crossTenantAllowedCount: allowedRows.filter(row => row.area === 'Clients' || row.area === 'Security' || row.permission === 'dashboard.view').length,
  }
}

export function comparePermissions(baseRole: AdminRole, compareRole: AdminRole): PermissionComparison {
  const basePermissions = new Set(rolePermissions[baseRole])
  const comparePermissions = new Set(rolePermissions[compareRole])
  return {
    added: rolePermissions[compareRole].filter(permission => !basePermissions.has(permission)),
    removed: rolePermissions[baseRole].filter(permission => !comparePermissions.has(permission)),
    shared: rolePermissions[baseRole].filter(permission => comparePermissions.has(permission)),
  }
}

export function roleOptionLabel(role: AdminRole) {
  return roleLabels[role]
}

export function riskTone(risk: PermissionCapabilityRisk): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (risk === 'Critical') return 'danger'
  if (risk === 'High') return 'warn'
  if (risk === 'Medium') return 'info'
  return 'neutral'
}
