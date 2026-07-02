export type AdminRole =
  | 'owner'
  | 'admin'
  | 'support_lead'
  | 'support_agent'
  | 'client_success'
  | 'finance'
  | 'marketing'
  | 'engineering'
  | 'read_only'

export type PermissionKey =
  | 'dashboard.view'
  | 'registrations.view'
  | 'revenue.view'
  | 'revenue.manage'
  | 'clients.view'
  | 'clients.manage'
  | 'organizations.view'
  | 'organizations.manage'
  | 'properties.view'
  | 'properties.manage'
  | 'venues.view'
  | 'venues.manage'
  | 'modules.view'
  | 'modules.manage'
  | 'usage.view'
  | 'health.view'
  | 'support.view'
  | 'support.manage'
  | 'troubleshooting.view'
  | 'troubleshooting.run'
  | 'admin_actions.view'
  | 'admin_actions.manage'
  | 'impersonation.start'
  | 'impersonation.destructive_actions'
  | 'impersonation.end_any'
  | 'audit.view'
  | 'audit.export'
  | 'agents.view'
  | 'agents.manage'
  | 'reports.view'
  | 'reports.export'
  | 'saved_views.view'
  | 'saved_views.manage'
  | 'notifications.view'
  | 'notifications.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'feature_flags.view'
  | 'feature_flags.manage'
  | 'admin_users.view'
  | 'admin_users.manage'
  | 'settings.view'
  | 'settings.manage'

export const roleLabels: Record<AdminRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  support_lead: 'Support Lead',
  support_agent: 'Support Agent',
  client_success: 'Client Success',
  finance: 'Finance',
  marketing: 'Marketing',
  engineering: 'Engineering',
  read_only: 'Read Only',
}

const allPermissions: PermissionKey[] = [
  'dashboard.view',
  'registrations.view',
  'revenue.view',
  'revenue.manage',
  'clients.view',
  'clients.manage',
  'organizations.view',
  'organizations.manage',
  'properties.view',
  'properties.manage',
  'venues.view',
  'venues.manage',
  'modules.view',
  'modules.manage',
  'usage.view',
  'health.view',
  'support.view',
  'support.manage',
  'troubleshooting.view',
  'troubleshooting.run',
  'admin_actions.view',
  'admin_actions.manage',
  'impersonation.start',
  'impersonation.destructive_actions',
  'impersonation.end_any',
  'audit.view',
  'audit.export',
  'agents.view',
  'agents.manage',
  'reports.view',
  'reports.export',
  'saved_views.view',
  'saved_views.manage',
  'notifications.view',
  'notifications.manage',
  'billing.view',
  'billing.manage',
  'feature_flags.view',
  'feature_flags.manage',
  'admin_users.view',
  'admin_users.manage',
  'settings.view',
  'settings.manage',
]

export const rolePermissions: Record<AdminRole, PermissionKey[]> = {
  owner: allPermissions,
  admin: allPermissions.filter(permission => permission !== 'impersonation.destructive_actions'),
  support_lead: [
    'dashboard.view',
    'clients.view',
    'organizations.view',
    'properties.view',
    'venues.view',
    'modules.view',
    'usage.view',
    'health.view',
    'support.view',
    'support.manage',
    'troubleshooting.view',
    'troubleshooting.run',
    'admin_actions.view',
    'admin_actions.manage',
    'impersonation.start',
    'impersonation.end_any',
    'audit.view',
    'reports.view',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  support_agent: [
    'dashboard.view',
    'clients.view',
    'organizations.view',
    'properties.view',
    'venues.view',
    'modules.view',
    'usage.view',
    'health.view',
    'support.view',
    'support.manage',
    'troubleshooting.view',
    'troubleshooting.run',
    'admin_actions.view',
    'audit.view',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  client_success: [
    'dashboard.view',
    'clients.view',
    'clients.manage',
    'organizations.view',
    'properties.view',
    'venues.view',
    'modules.view',
    'usage.view',
    'health.view',
    'support.view',
    'admin_actions.view',
    'reports.view',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  finance: [
    'dashboard.view',
    'revenue.view',
    'revenue.manage',
    'clients.view',
    'organizations.view',
    'billing.view',
    'billing.manage',
    'admin_actions.view',
    'admin_actions.manage',
    'reports.view',
    'reports.export',
    'audit.view',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  marketing: [
    'dashboard.view',
    'registrations.view',
    'clients.view',
    'organizations.view',
    'usage.view',
    'admin_actions.view',
    'reports.view',
    'agents.view',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  engineering: [
    'dashboard.view',
    'clients.view',
    'organizations.view',
    'properties.view',
    'venues.view',
    'modules.view',
    'usage.view',
    'health.view',
    'support.view',
    'troubleshooting.view',
    'troubleshooting.run',
    'admin_actions.view',
    'admin_actions.manage',
    'audit.view',
    'agents.view',
    'feature_flags.view',
    'feature_flags.manage',
    'saved_views.view',
    'saved_views.manage',
    'notifications.view',
    'notifications.manage',
  ],
  read_only: [
    'dashboard.view',
    'registrations.view',
    'revenue.view',
    'clients.view',
    'organizations.view',
    'properties.view',
    'venues.view',
    'modules.view',
    'usage.view',
    'health.view',
    'support.view',
    'troubleshooting.view',
    'admin_actions.view',
    'audit.view',
    'agents.view',
    'reports.view',
    'billing.view',
    'feature_flags.view',
    'saved_views.view',
    'notifications.view',
    'settings.view',
  ],
}

export function hasPermission(role: AdminRole, permission: PermissionKey) {
  return rolePermissions[role].includes(permission)
}
