-- Rollback for Platform Admin action request queue.
-- Removes only the additive action request read view and table.

drop view if exists public.platform_admin_admin_action_requests_read;
drop table if exists platform_admin.admin_action_requests;
