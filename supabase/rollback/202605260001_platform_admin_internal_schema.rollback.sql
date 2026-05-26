-- Rollback for Platform Admin draft schema.
-- This removes only Platform Admin-owned views and the platform_admin schema.
-- Do not run if production Platform Admin data has been created without a backup.

drop view if exists public.platform_admin_usage_analytics_read;
drop view if exists public.platform_admin_activity_events_read;
drop view if exists public.platform_admin_support_notes_read;
drop view if exists public.platform_admin_agent_events_read;
drop view if exists public.platform_admin_agent_definitions_read;
drop view if exists public.platform_admin_feature_flags_read;
drop view if exists public.platform_admin_internal_admin_users_read;
drop view if exists public.platform_admin_impersonation_sessions_read;
drop view if exists public.platform_admin_impersonation_targets_read;
drop view if exists public.platform_admin_health_signals_read;
drop view if exists public.platform_admin_support_issues_read;
drop view if exists public.platform_admin_billing_risks_read;
drop view if exists public.platform_admin_revenue_metrics_read;
drop view if exists public.platform_admin_registrations_read;
drop view if exists public.platform_admin_module_usage_gaps_read;
drop view if exists public.platform_admin_module_adoption_read;
drop view if exists public.platform_admin_module_activations_read;
drop view if exists public.platform_admin_venues_read;
drop view if exists public.platform_admin_properties_read;
drop view if exists public.platform_admin_organizations_read;

drop schema if exists platform_admin cascade;
