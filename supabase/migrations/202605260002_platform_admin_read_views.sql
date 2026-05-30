-- Happy Chair Platform Admin read contract views.
-- These views are shaped for the frontend adapter and are read-only by convention.
-- Do not grant broad browser access to these views until internal admin auth is server-gated.

create or replace view public.platform_admin_organizations_read
with (security_invoker = true)
as
select
  o.id,
  o.name,
  o.account_status,
  coalesce(o.plan_id, 'Starter') as plan,
  o.billing_status,
  coalesce(o.market_type, 'Other') as market_type,
  coalesce((
    select sum(
      case
        when fm.metric_type = 'churned_mrr' then -fm.amount
        else fm.amount
      end
    )
    from platform_admin.financial_metrics fm
    where fm.organization_id = o.id
      and fm.metric_type in ('mrr', 'new_mrr', 'expansion_mrr', 'churned_mrr', 'reactivated_mrr')
  ), 0) as mrr,
  (select count(*)::integer from platform_admin.properties p where p.organization_id = o.id) as properties,
  (
    select count(*)::integer
    from platform_admin.venues v
    join platform_admin.properties p on p.id = v.property_id
    where p.organization_id = o.id
  ) as venues,
  0::integer as users,
  0::integer as staff,
  coalesce(h.score, 0)::integer as health_score,
  coalesce(h.status, 'Needs Attention') as health_status,
  coalesce(h.usage_score, 0)::integer as usage_score,
  0::integer as expansion_score,
  coalesce((
    select max(ue.created_at)::text
    from platform_admin.usage_events ue
    where ue.organization_id = o.id
  ), 'No activity') as last_active,
  coalesce((
    select array_agg(m.name order by m.name)
    from platform_admin.module_activations ma
    join platform_admin.modules m on m.id = ma.module_id
    where ma.organization_id = o.id
      and ma.enabled = true
  ), array[]::text[]) as enabled_modules
from platform_admin.organizations o
left join lateral (
  select score, status, usage_score
  from platform_admin.client_health_scores hs
  where hs.organization_id = o.id
    and hs.property_id is null
    and hs.venue_id is null
  order by hs.calculated_at desc
  limit 1
) h on true;

create or replace view public.platform_admin_properties_read
with (security_invoker = true)
as
select
  p.id,
  p.organization_id,
  p.name,
  coalesce(p.location, '') as location,
  p.status,
  (select count(*)::integer from platform_admin.venues v where v.property_id = p.id) as venues,
  0::integer as staff,
  coalesce(h.score, 0)::integer as health_score,
  coalesce((
    select max(ue.created_at)::text
    from platform_admin.usage_events ue
    where ue.property_id = p.id
  ), 'No activity') as last_active
from platform_admin.properties p
left join lateral (
  select score
  from platform_admin.client_health_scores hs
  where hs.property_id = p.id
    and hs.venue_id is null
  order by hs.calculated_at desc
  limit 1
) h on true;

create or replace view public.platform_admin_venues_read
with (security_invoker = true)
as
select
  v.id,
  p.organization_id,
  p.id as property_id,
  p.name as property_name,
  v.name,
  coalesce(v.venue_type, 'Other') as venue_type,
  v.status,
  0::integer as active_requests,
  0::integer as staff_online,
  0::integer as devices_online,
  0::integer as devices_offline,
  0::integer as qr_scans_today,
  0::integer as sessions_today,
  0::integer as open_escalations,
  'Unknown'::text as notification_health,
  coalesce((
    select max(ue.created_at)::text
    from platform_admin.usage_events ue
    where ue.venue_id = v.id
  ), 'No activity') as last_activity,
  0::integer as average_response_seconds,
  coalesce((
    select array_agg(m.name order by m.name)
    from platform_admin.module_activations ma
    join platform_admin.modules m on m.id = ma.module_id
    where ma.venue_id = v.id
      and ma.enabled = true
  ), array[]::text[]) as enabled_modules
from platform_admin.venues v
join platform_admin.properties p on p.id = v.property_id;

create or replace view public.platform_admin_module_activations_read
with (security_invoker = true)
as
select
  ma.id,
  case
    when ma.venue_id is not null then 'venue'
    when ma.property_id is not null then 'property'
    else 'organization'
  end as scope_type,
  coalesce(ma.venue_id, ma.property_id, ma.organization_id) as scope_id,
  m.name as module_name,
  ma.enabled,
  case
    when ma.venue_id is not null then 'Venue'
    when ma.property_id is not null then 'Property'
    else 'Organization'
  end as activation_level,
  ma.usage_last_7_days,
  ma.revenue_attributed,
  ma.activated_at
from platform_admin.module_activations ma
join platform_admin.modules m on m.id = ma.module_id;

create or replace view public.platform_admin_module_adoption_read
with (security_invoker = true)
as
select
  m.name as module_name,
  count(distinct ma.organization_id)::integer as enabled_clients,
  count(distinct ma.organization_id) filter (where ma.usage_last_7_days > 0)::integer as active_clients_7d,
  coalesce(sum(ma.usage_last_7_days), 0)::integer as usage_events_7d,
  coalesce(sum(ma.revenue_attributed), 0) as revenue_attributed,
  case
    when count(distinct ma.organization_id) = 0 then 0
    else round(
      count(distinct ma.organization_id) filter (where ma.usage_last_7_days > 0)::numeric
      / count(distinct ma.organization_id)::numeric
      * 100
    )::integer
  end as adoption_rate
from platform_admin.modules m
left join platform_admin.module_activations ma on ma.module_id = m.id and ma.enabled = true
group by m.id, m.name;

create or replace view public.platform_admin_module_usage_gaps_read
with (security_invoker = true)
as
select
  ma.id,
  o.name as organization_name,
  m.name as module_name,
  ma.activated_at as enabled_at,
  ma.usage_last_7_days,
  'Review configuration and schedule enablement follow-up.'::text as recommended_action,
  'Client Success'::text as owner
from platform_admin.module_activations ma
join platform_admin.organizations o on o.id = ma.organization_id
join platform_admin.modules m on m.id = ma.module_id
where ma.enabled = true
  and ma.usage_last_7_days <= 2;

create or replace view public.platform_admin_registrations_read
with (security_invoker = true)
as
select
  id,
  email,
  company_name,
  source,
  campaign,
  market_type,
  selected_plan,
  property_type,
  status,
  created_at,
  setup_completion,
  projected_mrr
from platform_admin.registrations;

create or replace view public.platform_admin_revenue_metrics_read
with (security_invoker = true)
as
select
  fm.id,
  o.name as organization_name,
  fm.metric_type,
  fm.amount,
  fm.currency,
  fm.source,
  fm.period_start,
  fm.period_end,
  coalesce(fm.plan, o.plan_id, 'Starter') as plan,
  fm.module_name,
  coalesce(fm.market_type, o.market_type, 'Other') as market_type,
  coalesce(fm.acquisition_channel, o.acquisition_channel, 'Unattributed') as acquisition_channel
from platform_admin.financial_metrics fm
left join platform_admin.organizations o on o.id = fm.organization_id;

create or replace view public.platform_admin_billing_risks_read
with (security_invoker = true)
as
select
  br.id,
  o.name as organization_name,
  br.billing_status,
  br.amount_at_risk,
  br.mrr,
  br.last_payment_attempt,
  br.next_action,
  coalesce(br.owner, 'Finance') as owner
from platform_admin.billing_risks br
left join platform_admin.organizations o on o.id = br.organization_id;

create or replace view public.platform_admin_support_issues_read
with (security_invoker = true)
as
select
  si.id,
  o.name as organization_name,
  p.name as property_name,
  v.name as venue_name,
  si.issue_type,
  si.severity,
  si.status,
  si.detected_at,
  si.affected_users,
  si.probable_cause,
  si.recommended_action,
  si.related_signal,
  coalesce(si.owner, 'Support') as owner
from platform_admin.support_issues si
left join platform_admin.organizations o on o.id = si.organization_id
left join platform_admin.properties p on p.id = si.property_id
left join platform_admin.venues v on v.id = si.venue_id;

create or replace view public.platform_admin_health_signals_read
with (security_invoker = true)
as
select
  id,
  check_key,
  label,
  status,
  severity,
  affected_clients,
  affected_venues,
  message,
  probable_cause,
  recommended_action,
  checked_at
from platform_admin.health_checks;

create or replace view public.platform_admin_remediation_packets_read
with (security_invoker = true)
as
select
  id,
  packet_type as type,
  title,
  runbook_title,
  organization_name,
  property_name,
  venue_name,
  issue_type,
  status,
  severity,
  owner,
  scope,
  created_at,
  updated_at,
  primary_message,
  evidence,
  next_steps,
  blocked_actions,
  audit_action_key,
  persistence_status,
  persistence_target
from platform_admin.remediation_packets;

create or replace view public.platform_admin_impersonation_targets_read
with (security_invoker = true)
as
select
  it.id,
  it.target_user_id as user_id,
  it.name,
  it.email,
  it.role,
  it.organization_id,
  o.name as organization_name,
  it.property_id,
  p.name as property_name,
  it.venue_id,
  v.name as venue_name,
  it.scope_label,
  coalesce(it.account_status, o.account_status) as account_status,
  coalesce(it.last_active, 'No activity') as last_active
from platform_admin.impersonation_targets it
left join platform_admin.organizations o on o.id = it.organization_id
left join platform_admin.properties p on p.id = it.property_id
left join platform_admin.venues v on v.id = it.venue_id;

create or replace view public.platform_admin_impersonation_sessions_read
with (security_invoker = true)
as
select
  s.id,
  au.name as admin_name,
  au.role as admin_role,
  coalesce(t.name, s.target_user_id::text) as target_name,
  coalesce(t.role, 'Staff User') as target_role,
  o.name as organization_name,
  p.name as property_name,
  v.name as venue_name,
  s.reason,
  s.started_at,
  s.ended_at,
  initcap(s.status) as status,
  s.destructive_actions_blocked
from platform_admin.impersonation_sessions s
join platform_admin.internal_admin_users au on au.id = s.admin_user_id
left join platform_admin.impersonation_targets t on t.target_user_id = s.target_user_id
left join platform_admin.organizations o on o.id = s.organization_id
left join platform_admin.properties p on p.id = s.property_id
left join platform_admin.venues v on v.id = s.venue_id;

create or replace view public.platform_admin_audit_logs_read
with (security_invoker = true)
as
select
  al.id,
  coalesce(al.actor_label, al.actor_type) as actor,
  al.actor_role,
  coalesce(v.name, p.name, o.name, al.metadata ->> 'scope', 'Platform') as scope,
  al.action_key,
  al.action_label,
  al.severity,
  al.metadata,
  coalesce(al.metadata ->> 'permission', al.metadata ->> 'requiredPermission') as permission,
  coalesce(al.metadata ->> 'outcome', 'recorded') as outcome,
  'server_recorded' as persistence_status,
  'platform_admin.audit_logs' as persistence_target,
  al.created_at
from platform_admin.audit_logs al
left join platform_admin.organizations o on o.id = al.organization_id
left join platform_admin.properties p on p.id = al.property_id
left join platform_admin.venues v on v.id = al.venue_id;

create or replace view public.platform_admin_agent_definitions_read
with (security_invoker = true)
as
select
  key,
  name,
  category,
  owner,
  status,
  purpose,
  monitors,
  allowed_actions,
  blocked_actions
from platform_admin.agent_definitions;

create or replace view public.platform_admin_agent_events_read
with (security_invoker = true)
as
select
  ae.id,
  ae.agent_key,
  ad.name as agent_name,
  o.name as organization_name,
  p.name as property_name,
  v.name as venue_name,
  ae.event_type,
  ae.status,
  coalesce(ae.input_payload ->> 'summary', ae.input_payload::text) as input_summary,
  coalesce(ae.output_payload ->> 'summary', ae.output_payload::text) as output_summary,
  ae.audit_required,
  ae.created_at
from platform_admin.agent_events ae
join platform_admin.agent_definitions ad on ad.key = ae.agent_key
left join platform_admin.organizations o on o.id = ae.organization_id
left join platform_admin.properties p on p.id = ae.property_id
left join platform_admin.venues v on v.id = ae.venue_id;

create or replace view public.platform_admin_support_notes_read
with (security_invoker = true)
as
select
  id,
  scope_type,
  scope_id,
  author,
  author_role,
  body,
  created_at
from platform_admin.support_notes;

create or replace view public.platform_admin_activity_events_read
with (security_invoker = true)
as
select
  id,
  scope_type,
  scope_id,
  type,
  label,
  detail,
  created_at
from platform_admin.activity_events;

create or replace view public.platform_admin_usage_analytics_read
with (security_invoker = true)
as
select
  o.id,
  o.id as organization_id,
  o.name as organization_name,
  coalesce(o.market_type, 'Other') as market_type,
  o.account_status as status,
  count(distinct ue.user_id) filter (where ue.created_at >= now() - interval '7 days')::integer as active_users_7d,
  0::integer as staff_adoption,
  count(*) filter (where ue.event_type = 'manager_login' and ue.created_at >= now() - interval '7 days')::integer as manager_logins_7d,
  count(*) filter (where ue.event_type = 'guest_interaction' and ue.created_at >= now() - interval '7 days')::integer as guest_interactions_7d,
  count(*) filter (where ue.event_type = 'qr_scan' and ue.created_at >= now() - interval '7 days')::integer as qr_scans_7d,
  count(*) filter (where ue.event_type = 'service_request_created' and ue.created_at >= now() - interval '7 days')::integer as service_requests_7d,
  count(*) filter (where ue.event_type = 'service_request_resolved' and ue.created_at >= now() - interval '7 days')::integer as resolved_requests_7d,
  count(*) filter (where ue.event_type = 'service_request_ignored' and ue.created_at >= now() - interval '7 days')::integer as ignored_requests_7d,
  0::integer as average_response_seconds,
  count(*) filter (where ue.event_type = 'escalation_created' and ue.created_at >= now() - interval '7 days')::integer as escalations_7d,
  count(*) filter (where ue.event_type = 'report_viewed' and ue.created_at >= now() - interval '7 days')::integer as reports_viewed_7d,
  count(*) filter (where ue.module_key is not null and ue.created_at >= now() - interval '7 days')::integer as module_usage_7d,
  'Flat'::text as usage_trend,
  coalesce(max(ue.created_at)::text, 'No activity') as last_active,
  coalesce(extract(day from now() - max(ue.created_at))::integer, 999) as inactive_days
from platform_admin.organizations o
left join platform_admin.usage_events ue on ue.organization_id = o.id
group by o.id, o.name, o.market_type, o.account_status;

comment on schema platform_admin is 'Internal Happy Chair Platform Admin schema. Additive only; do not use for customer-facing Venue Admin workflows.';
comment on view public.platform_admin_organizations_read is 'Read contract for Platform Admin organization dashboard. Review grants before production use.';
comment on view public.platform_admin_usage_analytics_read is 'Read contract for Platform Admin usage analytics. Derived from platform_admin.usage_events.';
