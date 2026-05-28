# Supabase Read-Only Data Setup

Platform Admin must connect to existing Happy Chair data through read-only Supabase views first.

## Guardrails

- Do not connect this app directly to the Venue Admin app.
- Do not weaken customer-facing RLS policies for internal admin screens.
- Do not expose write paths from the browser for platform support actions.
- Start with views that match the Platform Admin read contracts.
- Keep mock fallback available until every view is verified.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
VITE_PLATFORM_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-legacy-anon-key
```

With `VITE_PLATFORM_DATA_SOURCE=mock`, the app uses local mock data.

## Required Views

The current read layer expects these views:

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
- `platform_admin_audit_logs_read`
- `platform_admin_agent_definitions_read`
- `platform_admin_agent_events_read`
- `platform_admin_internal_admin_users_read`
- `platform_admin_feature_flags_read`
- `platform_admin_support_notes_read`
- `platform_admin_activity_events_read`
- `platform_admin_usage_analytics_read`

Views may expose snake_case columns. The client read adapter converts snake_case keys to camelCase for the UI.

## Draft Migrations

The repo includes draft, additive migrations:

- `supabase/migrations/202605260001_platform_admin_internal_schema.sql`
- `supabase/migrations/202605260002_platform_admin_read_views.sql`
- `supabase/migrations/202605260003_platform_admin_settings_views.sql`

Review [Database Change Plan](DATABASE_CHANGE_PLAN.md) before applying either migration to a shared Supabase project.

## Failure Behavior

If a read-only view fails to load, Platform Admin falls back to mock data and shows `Mock fallback` in the top bar. This keeps the UI usable while making connection problems visible.
