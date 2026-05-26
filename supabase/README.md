# Platform Admin Supabase Artifacts

These migrations are draft database artifacts for Happy Chair Platform Admin.

They are intentionally additive:

- Create a separate `platform_admin` schema for internal-only concepts.
- Create read views that match the frontend data contracts.
- Enable RLS on internal tables.
- Do not alter existing customer-facing Venue Admin tables or policies.
- Do not drop, rename, or reshape production tables.

Before applying to a shared Supabase project, review:

- Purpose of each table/view.
- Existing production table mappings for organizations, properties, venues, users, usage, billing, and health data.
- RLS impact.
- Rollback plan.
- Audit impact.

Platform Admin cross-tenant access must be explicit, permissioned, server-side, and auditable.
