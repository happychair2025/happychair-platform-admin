# Platform Admin Database Change Plan

## Purpose

Create a reviewed, additive database foundation for Happy Chair Platform Admin without crossing wires with the customer-facing Venue Admin app.

This plan supports:

- Internal admin users, roles, and permissions.
- Organization, property, and venue read contracts for platform operations.
- Module activation tracking.
- Usage, revenue, registration, support, health, impersonation, audit, and agent event models.
- Read-only views that match the frontend data layer.

## Affected Tables

New schema:

- `platform_admin`

New Platform Admin-owned tables:

- `platform_admin.internal_admin_users`
- `platform_admin.admin_role_permissions`
- `platform_admin.organizations`
- `platform_admin.properties`
- `platform_admin.venues`
- `platform_admin.modules`
- `platform_admin.module_activations`
- `platform_admin.usage_events`
- `platform_admin.financial_metrics`
- `platform_admin.billing_risks`
- `platform_admin.registrations`
- `platform_admin.client_health_scores`
- `platform_admin.impersonation_targets`
- `platform_admin.impersonation_sessions`
- `platform_admin.audit_logs`
- `platform_admin.support_notes`
- `platform_admin.activity_events`
- `platform_admin.support_issues`
- `platform_admin.health_checks`
- `platform_admin.agent_definitions`
- `platform_admin.agent_events`
- `platform_admin.feature_flags`

New public read views:

- `platform_admin_organizations_read`
- `platform_admin_properties_read`
- `platform_admin_venues_read`
- `platform_admin_module_activations_read`
- `platform_admin_module_adoption_read`
- `platform_admin_module_usage_gaps_read`
- `platform_admin_registrations_read`
- `platform_admin_revenue_metrics_read`
- `platform_admin_billing_risks_read`
- `platform_admin_support_issues_read`
- `platform_admin_health_signals_read`
- `platform_admin_impersonation_targets_read`
- `platform_admin_impersonation_sessions_read`
- `platform_admin_agent_definitions_read`
- `platform_admin_agent_events_read`
- `platform_admin_internal_admin_users_read`
- `platform_admin_feature_flags_read`
- `platform_admin_support_notes_read`
- `platform_admin_activity_events_read`
- `platform_admin_usage_analytics_read`

## Production Data Boundary

The draft migrations do not alter existing production tables.

When mapping real production data, prefer replacing the draft internal source tables behind the read views with reviewed select statements against existing Supabase tables, RPCs, or service interfaces. Do not weaken customer-facing RLS policies.

## RLS Impact

RLS is enabled on all new `platform_admin` tables.

No broad anonymous or authenticated grants are included in these draft migrations. Production Platform Admin cross-tenant visibility must be served through explicit internal admin auth, server-side permission checks, and auditable service paths.

## Audit Impact

`platform_admin.audit_logs` is append-only through database triggers that block update and delete.

Future mutations for modules, billing, impersonation, support actions, feature flags, and AI-agent actions must write audit events.

## Rollback Plan

Use:

```bash
supabase/rollback/202605260001_platform_admin_internal_schema.rollback.sql
```

Rollback removes only Platform Admin-owned read views and the `platform_admin` schema. Do not run after production Platform Admin data exists unless a backup and migration plan have been approved.

## Review Checklist

- Purpose documented.
- Affected tables listed.
- Rollback plan included.
- RLS impact documented.
- Audit impact documented.
- No production table drops.
- No production column renames.
- No customer-facing RLS policy rewrites.
- No direct app-to-app dependencies.
