-- Happy Chair Platform Admin internal schema foundation.
-- Additive only. Do not modify customer-facing Venue Admin tables or policies.

create extension if not exists pgcrypto;

create schema if not exists platform_admin;

create or replace function platform_admin.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists platform_admin.internal_admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null check (role in (
    'owner',
    'admin',
    'support_lead',
    'support_agent',
    'client_success',
    'finance',
    'marketing',
    'engineering',
    'read_only'
  )),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.admin_role_permissions (
  role text not null,
  permission_key text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists platform_admin.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_status text not null default 'trial',
  plan_id text,
  billing_status text not null default 'trial',
  market_type text,
  acquisition_channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform_admin.organizations(id) on delete cascade,
  name text not null,
  location text,
  status text not null default 'setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.venues (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references platform_admin.properties(id) on delete cascade,
  name text not null,
  venue_type text,
  status text not null default 'setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text,
  status text not null default 'planned',
  plan_required text,
  beta_flag boolean not null default false,
  internal_only boolean not null default false,
  client_visible boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.module_activations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete cascade,
  venue_id uuid references platform_admin.venues(id) on delete cascade,
  module_id uuid not null references platform_admin.modules(id) on delete restrict,
  enabled boolean not null default false,
  plan_required text,
  beta_enabled boolean not null default false,
  usage_last_7_days integer not null default 0,
  revenue_attributed numeric(12, 2) not null default 0,
  activated_at timestamptz,
  disabled_at timestamptz,
  created_by uuid references platform_admin.internal_admin_users(id),
  updated_by uuid references platform_admin.internal_admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (property_id is null or organization_id is not null),
  check (venue_id is null or property_id is not null)
);

create table if not exists platform_admin.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete cascade,
  venue_id uuid references platform_admin.venues(id) on delete cascade,
  user_id uuid,
  module_key text,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  metric_type text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  source text not null default 'internal',
  plan text,
  module_name text,
  market_type text,
  acquisition_channel text,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.billing_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  billing_status text not null,
  amount_at_risk numeric(12, 2) not null default 0,
  mrr numeric(12, 2) not null default 0,
  last_payment_attempt date,
  next_action text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete set null,
  email text not null,
  company_name text not null,
  source text,
  campaign text,
  market_type text,
  selected_plan text,
  property_type text,
  status text not null,
  setup_completion integer not null default 0 check (setup_completion between 0 and 100),
  projected_mrr numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.client_health_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete cascade,
  venue_id uuid references platform_admin.venues(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  status text not null,
  usage_score integer not null default 0 check (usage_score between 0 and 100),
  billing_score integer not null default 0 check (billing_score between 0 and 100),
  support_score integer not null default 0 check (support_score between 0 and 100),
  adoption_score integer not null default 0 check (adoption_score between 0 and 100),
  setup_score integer not null default 0 check (setup_score between 0 and 100),
  calculated_at timestamptz not null default now()
);

create table if not exists platform_admin.impersonation_targets (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  name text not null,
  email text not null,
  role text not null,
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete cascade,
  venue_id uuid references platform_admin.venues(id) on delete cascade,
  scope_label text not null,
  account_status text,
  last_active text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references platform_admin.internal_admin_users(id) on delete restrict,
  target_user_id uuid not null,
  organization_id uuid references platform_admin.organizations(id) on delete set null,
  property_id uuid references platform_admin.properties(id) on delete set null,
  venue_id uuid references platform_admin.venues(id) on delete set null,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'revoked')),
  destructive_actions_blocked integer not null default 0
);

create table if not exists platform_admin.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id uuid,
  actor_label text,
  actor_role text,
  organization_id uuid references platform_admin.organizations(id) on delete set null,
  property_id uuid references platform_admin.properties(id) on delete set null,
  venue_id uuid references platform_admin.venues(id) on delete set null,
  action_key text not null,
  action_label text not null,
  severity text not null default 'info' check (severity in ('info', 'notice', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.support_notes (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('organization', 'property', 'venue')),
  scope_id uuid not null,
  author_id uuid references platform_admin.internal_admin_users(id) on delete set null,
  author text not null,
  author_role text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.activity_events (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('organization', 'property', 'venue')),
  scope_id uuid not null,
  type text not null,
  label text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.support_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete set null,
  venue_id uuid references platform_admin.venues(id) on delete set null,
  issue_type text not null,
  severity text not null default 'notice',
  status text not null default 'open',
  detected_at timestamptz not null default now(),
  affected_users integer not null default 0,
  probable_cause text,
  recommended_action text,
  related_signal text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.health_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform_admin.organizations(id) on delete cascade,
  property_id uuid references platform_admin.properties(id) on delete set null,
  venue_id uuid references platform_admin.venues(id) on delete set null,
  check_key text not null,
  label text not null,
  status text not null,
  severity text not null default 'info',
  affected_clients integer not null default 0,
  affected_venues integer not null default 0,
  message text,
  probable_cause text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table if not exists platform_admin.agent_definitions (
  key text primary key,
  name text not null,
  owner text not null,
  status text not null default 'planned',
  purpose text,
  monitors text[] not null default array[]::text[],
  allowed_actions text[] not null default array[]::text[],
  blocked_actions text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references platform_admin.agent_definitions(key) on delete cascade,
  organization_id uuid references platform_admin.organizations(id) on delete set null,
  property_id uuid references platform_admin.properties(id) on delete set null,
  venue_id uuid references platform_admin.venues(id) on delete set null,
  event_type text not null,
  status text not null default 'queued',
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  audit_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin.feature_flags (
  key text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  internal_only boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_admin_properties_org_idx on platform_admin.properties (organization_id);
create index if not exists platform_admin_venues_property_idx on platform_admin.venues (property_id);
create index if not exists platform_admin_module_activations_org_idx on platform_admin.module_activations (organization_id);
create index if not exists platform_admin_usage_events_scope_idx on platform_admin.usage_events (organization_id, property_id, venue_id, created_at desc);
create index if not exists platform_admin_financial_metrics_org_period_idx on platform_admin.financial_metrics (organization_id, period_start, period_end);
create index if not exists platform_admin_audit_logs_scope_idx on platform_admin.audit_logs (organization_id, property_id, venue_id, created_at desc);
create index if not exists platform_admin_health_checks_scope_idx on platform_admin.health_checks (organization_id, property_id, venue_id, checked_at desc);
create index if not exists platform_admin_agent_events_agent_idx on platform_admin.agent_events (agent_key, created_at desc);

drop trigger if exists set_updated_at_internal_admin_users on platform_admin.internal_admin_users;
create trigger set_updated_at_internal_admin_users
before update on platform_admin.internal_admin_users
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_admin_role_permissions on platform_admin.admin_role_permissions;
create trigger set_updated_at_admin_role_permissions
before update on platform_admin.admin_role_permissions
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_organizations on platform_admin.organizations;
create trigger set_updated_at_organizations
before update on platform_admin.organizations
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_properties on platform_admin.properties;
create trigger set_updated_at_properties
before update on platform_admin.properties
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_venues on platform_admin.venues;
create trigger set_updated_at_venues
before update on platform_admin.venues
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_modules on platform_admin.modules;
create trigger set_updated_at_modules
before update on platform_admin.modules
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_module_activations on platform_admin.module_activations;
create trigger set_updated_at_module_activations
before update on platform_admin.module_activations
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_billing_risks on platform_admin.billing_risks;
create trigger set_updated_at_billing_risks
before update on platform_admin.billing_risks
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_impersonation_targets on platform_admin.impersonation_targets;
create trigger set_updated_at_impersonation_targets
before update on platform_admin.impersonation_targets
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_support_issues on platform_admin.support_issues;
create trigger set_updated_at_support_issues
before update on platform_admin.support_issues
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_agent_definitions on platform_admin.agent_definitions;
create trigger set_updated_at_agent_definitions
before update on platform_admin.agent_definitions
for each row execute function platform_admin.set_updated_at();

drop trigger if exists set_updated_at_feature_flags on platform_admin.feature_flags;
create trigger set_updated_at_feature_flags
before update on platform_admin.feature_flags
for each row execute function platform_admin.set_updated_at();

alter table platform_admin.internal_admin_users enable row level security;
alter table platform_admin.admin_role_permissions enable row level security;
alter table platform_admin.organizations enable row level security;
alter table platform_admin.properties enable row level security;
alter table platform_admin.venues enable row level security;
alter table platform_admin.modules enable row level security;
alter table platform_admin.module_activations enable row level security;
alter table platform_admin.usage_events enable row level security;
alter table platform_admin.financial_metrics enable row level security;
alter table platform_admin.billing_risks enable row level security;
alter table platform_admin.registrations enable row level security;
alter table platform_admin.client_health_scores enable row level security;
alter table platform_admin.impersonation_targets enable row level security;
alter table platform_admin.impersonation_sessions enable row level security;
alter table platform_admin.audit_logs enable row level security;
alter table platform_admin.support_notes enable row level security;
alter table platform_admin.activity_events enable row level security;
alter table platform_admin.support_issues enable row level security;
alter table platform_admin.health_checks enable row level security;
alter table platform_admin.agent_definitions enable row level security;
alter table platform_admin.agent_events enable row level security;
alter table platform_admin.feature_flags enable row level security;

create or replace function platform_admin.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;

drop trigger if exists prevent_audit_log_update on platform_admin.audit_logs;
create trigger prevent_audit_log_update
before update on platform_admin.audit_logs
for each row execute function platform_admin.prevent_audit_log_mutation();

drop trigger if exists prevent_audit_log_delete on platform_admin.audit_logs;
create trigger prevent_audit_log_delete
before delete on platform_admin.audit_logs
for each row execute function platform_admin.prevent_audit_log_mutation();
