# AGENTS.md - happychair-platform-admin

This repo is the internal Happy Chair Platform Admin.

It is separate from `happychair-admin`, which is the customer-facing Venue Admin app. Do not edit, import from, or depend on the Venue Admin repo unless the user explicitly asks for a coordinated migration.

## Product Boundary

Happy Chair Platform Admin is the internal SaaS operations console for Team Happy Chair.

It exists for:

- ownership and executive visibility
- support operations
- client success
- finance and billing visibility
- marketing and registration tracking
- engineering troubleshooting
- module activation and entitlement management
- secure support impersonation
- audit logging
- future AI-agent workflows

It does not exist for:

- restaurant operator floor management
- guest tableside flows
- kitchen display workflows
- customer-facing staff workflows
- duplicating Venue Admin screens

## Non-Breaking Change Rules

This repo must be treated as a separate internal product.

Before making any change, confirm:

- The change is additive.
- The change does not modify customer-facing Venue Admin behavior.
- The change does not alter existing guest, staff, table, floor, kitchen, or venue workflows.
- The change does not require imports from `happychair-admin`.
- The change does not rename, delete, or reshape existing production tables without explicit approval.
- The change does not introduce direct app-to-app dependencies.

If existing platform data is needed, access it through Supabase tables, views, RPCs, or clearly defined service interfaces only.

## Core Principle

Do not build a basic admin panel.

Build the internal operating system for Happy Chair.

Every feature should help Team Happy Chair answer:

- Who signed up?
- Who converted?
- Who is paying?
- Who is using the platform?
- Who is not using it?
- Who needs support?
- Who is ready for upsell?
- Which modules are working?
- Which modules need improvement?
- Where is revenue growing?
- Where is revenue leaking?
- What should Happy Chair do next?

## Architecture Rules

- Keep this repo isolated from `happychair-admin`.
- Use the shared Happy Chair Supabase project as the platform data interface.
- Do not create app-to-app calls.
- Prefer additive database changes.
- Do not remove or rewrite existing production flows.
- Reuse existing platform tables where they already represent the correct concept.
- Add internal admin tables only where the existing product model does not cover the internal use case.
- Keep internal admin routes separate from any client route.
- Permission-check every sensitive action.
- Audit-log every meaningful admin, support, finance, impersonation, module, feature flag, export, troubleshooting, and future AI-agent action.
- Never store or expose customer passwords.
- Use secure impersonation, not actual customer login.

## Database Safety Rules

- Prefer read-only views first when surfacing existing production data.
- Use additive tables for internal admin concepts.
- Use migrations that are reversible where possible.
- Never drop columns, rename columns, rewrite policies, or alter existing production behavior without explicit approval.
- Any change touching shared tenant data must include purpose, affected tables, rollback plan, RLS impact, and audit impact.

## Security Rules

### Cross-Tenant Access Rule

Platform Admin may require cross-tenant visibility, but that access must be explicit, permissioned, server-side, and auditable.

Do not weaken existing customer-facing RLS policies to make admin screens easier to build.

## Internal Roles

The app must support role-based access control for:

- Owner
- Admin
- Support Lead
- Support Agent
- Client Success
- Finance
- Marketing
- Engineering
- Read Only

Owner and Admin can manage broad platform configuration. Other roles should receive the narrowest permissions needed for their workflows.

## Data Rules

- Do not hardcode client names.
- Do not hardcode module behavior.
- Treat modules as registry-driven capabilities with activation records.
- Clearly label mock and placeholder data.
- Keep future Stripe, QuickBooks, analytics, and AI-agent integrations behind clean internal interfaces.
- Use immutable audit records for important activity.

## AI Agent Safety Rules

- Claude agents may recommend, summarize, draft, classify, and flag.
- Claude agents must not silently mutate production data.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must require a permission check.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must require human confirmation unless explicitly allowlisted.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must write an audit log entry and visible activity record.

## UI Rules

The UI should feel:

- premium
- calm
- operational
- clean
- information-dense
- fast
- enterprise-ready

Use Happy Chair design language and avoid random styling. Prefer reusable admin components for cards, tables, status pills, filters, sidebars, breadcrumbs, modals, and action panels.

Every table should include search, filters, sorting, pagination, export-ready structure, and a clear empty state.

Every detail page should include a status header, key metrics, recent activity, action panel, and audit/history section.

## Domain Organization

Keep files organized by domain:

- `admin/dashboard`
- `admin/registrations`
- `admin/revenue`
- `admin/clients`
- `admin/organizations`
- `admin/properties`
- `admin/venues`
- `admin/modules`
- `admin/usage`
- `admin/health`
- `admin/support`
- `admin/troubleshooting`
- `admin/impersonation`
- `admin/audit`
- `admin/agents`
- `admin/reports`
- `admin/billing`
- `admin/feature-flags`
- `admin/settings`

## MVP Build Order

Follow the phased plan in [PLATFORM_ADMIN_MASTER_PLAN.md](PLATFORM_ADMIN_MASTER_PLAN.md).

## Implementation Rule

- Build UI and mock data contracts first.
- Connect to Supabase only after the screen structure, permissions, and data contracts are stable.
- When connecting real data, start with read-only views before enabling mutations.
