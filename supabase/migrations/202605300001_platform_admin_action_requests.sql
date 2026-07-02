-- Happy Chair Platform Admin action request queue.
-- Additive only. This creates the server-action bridge without mutating production tenant data.

create table if not exists platform_admin.admin_action_requests (
  id text primary key default ('admin-action-request-' || gen_random_uuid()::text),
  action_type text not null check (action_type in (
    'module_activation_change',
    'remediation_server_action',
    'support_troubleshooting_action',
    'impersonation_start',
    'impersonation_end',
    'feature_flag_change',
    'billing_review_action',
    'agent_recommended_action'
  )),
  title text not null,
  requested_by jsonb not null default '{}'::jsonb,
  permission_required text not null,
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'Queued' check (status in (
    'Draft',
    'Queued',
    'Approved',
    'Running',
    'Completed',
    'Failed',
    'Blocked'
  )),
  reason text not null,
  audit_event_id uuid references platform_admin.audit_logs(id) on delete set null,
  rollback_notes text not null,
  server_handler jsonb not null default '{"status":"placeholder_only"}'::jsonb,
  status_reason text,
  transition_audit_event_id uuid references platform_admin.audit_logs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  persistence_status text not null default 'server_recorded',
  persistence_target text not null default 'platform_admin.admin_action_requests',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_admin_admin_action_requests_status_idx
  on platform_admin.admin_action_requests (status, created_at desc);

create index if not exists platform_admin_admin_action_requests_type_idx
  on platform_admin.admin_action_requests (action_type, created_at desc);

create index if not exists platform_admin_admin_action_requests_audit_idx
  on platform_admin.admin_action_requests (audit_event_id);

drop trigger if exists set_updated_at_admin_action_requests on platform_admin.admin_action_requests;
create trigger set_updated_at_admin_action_requests
before update on platform_admin.admin_action_requests
for each row execute function platform_admin.set_updated_at();

alter table platform_admin.admin_action_requests enable row level security;

create or replace view public.platform_admin_admin_action_requests_read
with (security_invoker = true)
as
select
  id,
  action_type,
  title,
  requested_by,
  permission_required,
  scope,
  status,
  reason,
  audit_event_id,
  rollback_notes,
  server_handler,
  status_reason,
  transition_audit_event_id,
  metadata,
  persistence_status,
  persistence_target,
  created_at,
  updated_at
from platform_admin.admin_action_requests;

comment on table platform_admin.admin_action_requests is 'Central queue for future Platform Admin production mutations. Browser clients create requests; server handlers perform real work after permission, audit, approval, and rollback checks.';
comment on view public.platform_admin_admin_action_requests_read is 'Read contract for Admin Action Requests / Server Action Queue.';
