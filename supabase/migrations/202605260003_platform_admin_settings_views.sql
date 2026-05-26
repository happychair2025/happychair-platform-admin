-- Happy Chair Platform Admin settings and feature flag read views.
-- Additive views for internal control surfaces.

create or replace view public.platform_admin_internal_admin_users_read
with (security_invoker = true)
as
select
  id,
  name,
  email,
  role,
  initcap(status) as status,
  coalesce(last_login_at::text, 'Pending') as last_login_at,
  created_at
from platform_admin.internal_admin_users;

create or replace view public.platform_admin_feature_flags_read
with (security_invoker = true)
as
select
  key as id,
  key,
  name,
  coalesce(description, '') as description,
  coalesce(metadata ->> 'category', 'Admin Shell') as category,
  enabled,
  case
    when enabled then 'Active'
    when metadata ->> 'status' is not null then metadata ->> 'status'
    else 'Planned'
  end as status,
  coalesce(metadata ->> 'environment', 'Internal') as environment,
  coalesce((metadata ->> 'rollout')::integer, case when enabled then 100 else 0 end) as rollout,
  coalesce(metadata ->> 'owner', 'Engineering') as owner,
  coalesce(metadata ->> 'blastRadius', metadata ->> 'blast_radius', 'Medium') as blast_radius,
  true as requires_audit,
  updated_at
from platform_admin.feature_flags;

comment on view public.platform_admin_internal_admin_users_read is 'Read contract for Platform Admin internal users. Review grants before production use.';
comment on view public.platform_admin_feature_flags_read is 'Read contract for Platform Admin feature flags. Review grants before production use.';
