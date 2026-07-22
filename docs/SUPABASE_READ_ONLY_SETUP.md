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
VITE_PLATFORM_AUTH_SOURCE=preview
VITE_PLATFORM_AUTH_SERVER_ENDPOINT=
VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT=
VITE_PLATFORM_LEDGER_SERVER_ENDPOINT=
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-legacy-anon-key
```

With `VITE_PLATFORM_DATA_SOURCE=mock`, the app uses local mock data.

`VITE_PLATFORM_AUTH_SOURCE=preview` keeps the managed internal access preview active. `VITE_PLATFORM_AUTH_SOURCE=supabase` prepares the app to verify internal sessions against Supabase Auth, but admin-user creation, invitation, suspension, role changes, and provider mutations must still route through a trusted server endpoint. Do not expose a Supabase secret/service-role key in browser config.

`VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT` is reserved for the future trusted Admin Action Request executor. When unset, the UI still builds execution packets, idempotency keys, preflight checks, and payload previews, but requests remain review-only browser contracts and cannot run production mutations from the client.

`VITE_PLATFORM_LEDGER_SERVER_ENDPOINT` is reserved for future trusted persistence of browser-created action, audit, remediation, and agent ledgers. When unset, those ledgers remain local review records. See [Trusted Server Action Adapter](TRUSTED_SERVER_ACTION_ADAPTER.md) before wiring either endpoint.

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
- `platform_admin_remediation_packets_read`
- `platform_admin_admin_action_requests_read`
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
- `supabase/migrations/202605300001_platform_admin_action_requests.sql`

Review [Database Change Plan](DATABASE_CHANGE_PLAN.md) before applying either migration to a shared Supabase project.

## Failure Behavior

Platform Admin now tracks each read-only view independently:

- `Read-only views`: every configured view loaded successfully.
- `Read-only partial`: at least one view loaded from Supabase and at least one view is using mock fallback.
- `Mock fallback`: all Supabase read views failed and the UI is using mock data.
- `Mock data`: `VITE_PLATFORM_DATA_SOURCE=mock`.

Open Admin Settings and review `Read View Diagnostics` to see the status, row count, view name, and error for each read contract. This keeps the UI usable while making connection problems specific enough to repair without weakening RLS or enabling browser writes.

## Verification

Before applying or changing read-view migrations, run:

```bash
npm run verify:read-contracts
```

This verifies the frontend read contracts, migration files, rollback files, and setup docs reference the same read-only views.

To also probe live Supabase views when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, run:

```bash
npm run verify:read-contracts -- --supabase
```
