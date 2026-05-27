# Happy Chair Platform Admin Master Plan

Last updated: May 25, 2026

## 1. Product Definition

Happy Chair Platform Admin is the internal SaaS operations console for Team Happy Chair.

It is not the Venue Admin app and it is not a customer-facing admin panel. It is the company command center for managing clients, revenue, support, module activation, usage, health, troubleshooting, auditability, and future AI-agent workflows across every Happy Chair tenant.

Primary goal:

Create a scalable, multi-tenant admin foundation that can grow with every future Happy Chair module and every client SaaS instance without major rewrites.

The system must help Team Happy Chair answer:

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

## 2. Repo Boundary

This repo owns only the internal Platform Admin.

Out of scope:

- Venue Admin floor management
- Tableside guest flows
- Kitchen display workflows
- Staff mobile workflows
- Customer-facing account management, unless exposed as internal support context

Important boundary:

- `happychair-admin` remains the venue/operator console.
- `happychair-platform-admin` is for Happy Chair internal users.
- Both apps can use the shared Supabase project.
- No direct app-to-app communication.
- Prefer additive platform data changes.
- Do not remove or rewrite existing production flows.

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

## Architecture Rules

### Database Safety Rules

- Prefer read-only views first when surfacing existing production data.
- Use additive tables for internal admin concepts.
- Use migrations that are reversible where possible.
- Never drop columns, rename columns, rewrite policies, or alter existing production behavior without explicit approval.
- Any change touching shared tenant data must include purpose, affected tables, rollback plan, RLS impact, and audit impact.

## 3. Users And Roles

Internal roles:

- Owner
- Admin
- Support Lead
- Support Agent
- Client Success
- Finance
- Marketing
- Engineering
- Read Only

Role intent:

| Role | Primary Work | Sensitive Access |
| --- | --- | --- |
| Owner | Business-wide visibility and control | Full access |
| Admin | Platform operations and configuration | Full access except owner-only controls if needed |
| Support Lead | Support queue, troubleshooting, escalations, impersonation approval | Broad support access |
| Support Agent | Venue troubleshooting and client support | Limited support access |
| Client Success | Adoption, health, upsell, notes, outreach | Client and usage access |
| Finance | Revenue, billing, failed payments, refunds, discounts | Finance access |
| Marketing | Registrations, campaigns, signup sources, lifecycle triggers | Marketing analytics access |
| Engineering | Health checks, logs, diagnostics, feature flags | Technical access |
| Read Only | Visibility without mutation | No destructive actions |

Every route, loader, action, and mutation must be permission-checked.

## 4. Permission Model

Use permission keys rather than role-specific hardcoding.

Recommended permission groups:

- `dashboard.view`
- `registrations.view`
- `revenue.view`
- `revenue.manage`
- `clients.view`
- `clients.manage`
- `organizations.view`
- `organizations.manage`
- `properties.view`
- `properties.manage`
- `venues.view`
- `venues.manage`
- `modules.view`
- `modules.manage`
- `usage.view`
- `health.view`
- `support.view`
- `support.manage`
- `troubleshooting.view`
- `troubleshooting.run`
- `impersonation.start`
- `impersonation.destructive_actions`
- `impersonation.end_any`
- `audit.view`
- `audit.export`
- `agents.view`
- `agents.manage`
- `reports.view`
- `reports.export`
- `billing.view`
- `billing.manage`
- `feature_flags.view`
- `feature_flags.manage`
- `admin_users.view`
- `admin_users.manage`
- `settings.view`
- `settings.manage`

All permission checks should be centralized so UI gating and server/data actions share the same source of truth.

## 5. Main Navigation

Navigation structure:

- Executive Dashboard
- Registrations
- Revenue
- Clients
- Organizations
- Properties
- Venues / Outlets
- Modules
- Usage Analytics
- Client Health
- Support Center
- Troubleshooting
- Impersonation
- Audit Logs
- AI Agents
  - Marketing Agent
  - Social Media Agent
  - SEO / GEO Agent
  - SEM Agent
  - Sales SDR Agent
  - Email Agent
  - Support Agent
  - Finance Agent
  - Client Success Agent
- Reports
- Billing
- Feature Flags
- System Health
- Admin Settings

Navigation should be permission-aware. Users should not see pages they cannot access.

## 6. Information Architecture

Primary hierarchy:

```text
Organization
  -> Property
    -> Outlet / Venue
```

The UI should support both top-down navigation and fast search:

- Search by organization name
- Search by property name
- Search by venue/outlet name
- Search by contact email
- Search by billing status
- Search by module
- Search by health status
- Search by recent support activity

Global search should become a core workflow after the MVP shell is stable.

## 7. Executive Dashboard

Purpose:

Give ownership and leadership a decision surface, not just charts.

Metrics:

- Daily new registrations
- Daily trial starts
- Daily paid conversions
- Active clients
- Active properties
- Active venues/outlets
- MRR
- ARR
- New MRR
- Expansion MRR
- Churned MRR
- Failed payments
- Open support issues
- At-risk clients
- Module adoption
- Platform usage trend
- Top active clients
- Least active clients
- Clients with no activity in 7 days
- Clients ready for upsell

Insight cards:

- Clients that have not used a module in 7 days
- Trials likely to convert based on setup completion
- Failed payments and at-risk MRR
- Venues with high usage and premium module potential
- Accounts with declining usage
- Accounts with strong week-over-week growth
- Clients with setup incomplete after trial start

Decision-first layout:

1. Business health row: MRR, ARR, active clients, paid conversions, failed payments.
2. Attention row: at-risk clients, inactive trials, support issues, failed payments.
3. Growth row: upsell candidates, active modules, high-growth accounts, expansion MRR.
4. Activity row: usage trend, top clients, least active clients.
5. Action queue: recommended follow-ups for success, support, finance, and marketing.

## 8. Registrations Dashboard

Track:

- Daily signups
- Weekly signups
- Monthly signups
- Demo requests
- Trial starts
- Converted trials
- Abandoned signups
- Signup source
- Signup campaign
- Signup market type
- Signup plan
- Signup property type

Property types:

- Restaurant
- Hotel
- Casino
- Stadium
- Resort
- Senior Living
- Healthcare
- Private Club
- Event Venue
- Other

Views:

- Registration funnel
- Source performance
- Campaign performance
- Market type performance
- Trial conversion list
- Abandoned signup list
- Setup incomplete list

Future marketing-agent hooks:

- Campaign opportunity detected
- Source conversion changed
- Market segment showing traction
- Lifecycle email trigger ready

## 9. Client And Organization Dashboard

Organization profile should show:

- Account status
- Plan/package
- Billing status
- MRR
- Enabled modules
- Number of properties
- Number of venues/outlets
- Total users
- Staff count
- Recent activity
- Support history
- Health score
- Usage score
- Expansion opportunity score
- Internal notes

Organization detail layout:

1. Status header: name, status, plan, billing, health, MRR.
2. Key metrics: properties, venues, users, staff, modules, last active.
3. Module panel: enabled modules and adoption.
4. Usage panel: recent usage and trend.
5. Support panel: recent tickets, notes, escalations.
6. Billing panel: current MRR, failed payments, invoices when available.
7. Activity timeline: usage, support, module, billing, audit events.
8. Internal notes: support and success notes.

## 10. Property And Venue Support Workbench

The venue support detail page is the main support workbench.

Include:

- Venue overview
- Live operational status
- Active requests
- Staff online
- Devices online/offline
- QR/session activity
- Open escalations
- Notification health
- Last activity timestamp
- Enabled modules
- Recent errors
- Support notes
- Audit history
- Permission-gated impersonation button
- Troubleshooting panel
- Health check panel

Support detail layout:

1. Status header: venue name, org, property, health, last active, support severity.
2. Operational snapshot: active requests, response time, staff online, devices online.
3. Module status: enabled modules, configuration warnings, module usage.
4. Troubleshooting panel: detected issues, probable cause, recommended action.
5. Recent events: errors, escalations, notification failures, QR/session activity.
6. Support notes: internal-only notes.
7. Audit history: recent support and admin actions.
8. Action panel: run checks, add note, open escalation, start impersonation.

## 11. Module Activation System

Build a module management framework, not hardcoded toggles.

Each module supports:

- Enabled / disabled
- Plan availability
- Beta flag
- Internal-only flag
- Client-visible flag
- Activation date
- Disabled date
- Usage tracking
- Revenue attribution
- Dependency requirements
- Configuration options

Initial modules:

- Service Requests
- Service Signal / Paging
- Staff Alerts
- Escalations
- Guest Sentiment
- Allergy Shield
- VIP Recognition
- Reputation Firewall
- Incident Replay
- Heatmaps
- Executive Reporting
- AI Recommendations
- Multi-Property Management

Module registry fields:

- key
- name
- description
- category
- lifecycle status
- plan rules
- dependencies
- default configuration schema
- visibility flags
- billing attribution fields

Activation scopes:

- Organization-wide
- Property-level
- Venue-level

Rules:

- Venue-level activation can inherit from property or organization.
- Explicit disabled state should override inherited enabled state when needed.
- Dependencies must be checked before activation.
- Module changes must create audit logs.
- Module changes should write usage/revenue attribution hooks where applicable.

## 12. Usage Analytics

Track usage at:

- Organization level
- Property level
- Venue level
- Module level
- User level

Metrics:

- Logins
- Active users
- Staff adoption
- Manager adoption
- Guest interactions
- QR scans
- Session starts
- Service requests created
- Service requests resolved
- Ignored requests
- Average response time
- Escalation count
- Emergency actions
- Reports viewed
- Settings configured
- Module usage
- Last active date

Views:

- Most active clients
- Least active clients
- Unused modules
- Inactive trials
- Active but underconfigured clients
- Clients with usage decline
- Clients with strong usage growth
- Module adoption by segment
- Usage by market type

Implementation notes:

- Treat usage events as append-only.
- Aggregate into summary views later for performance.
- Keep raw event payload flexible with JSON metadata.
- Clearly distinguish real data from mock or placeholder data during MVP.

## 13. Client Health Score

Create calculated health scores for:

- Organization
- Property
- Venue

Inputs:

- Usage frequency
- Staff adoption
- Manager logins
- Service request volume
- Response performance
- Module activation depth
- Billing status
- Support ticket volume
- Setup completion
- Last active date
- Sentiment trend when available

Statuses:

- Healthy
- Growing
- Needs Attention
- At Risk
- Expansion Candidate

Recommended scoring model:

- Usage score: 0-25
- Adoption score: 0-20
- Setup score: 0-15
- Performance score: 0-15
- Billing score: 0-10
- Support score: 0-10
- Sentiment score: 0-5

Status mapping:

- 85-100 with growth signals: Expansion Candidate
- 75-100: Healthy
- 60-84 with positive trend: Growing
- 40-59: Needs Attention
- 0-39 or severe billing/support issue: At Risk

The health score should expose both the final status and the reasons behind it.

## 14. Revenue And Finance Dashboard

Finance views:

- MRR
- ARR
- New MRR
- Expansion MRR
- Churned MRR
- Reactivated MRR
- Failed payments
- Past-due accounts
- Refunds
- Discounts
- Credits
- Revenue by module
- Revenue by plan
- Revenue by client segment
- Revenue by market type
- Revenue by acquisition channel
- Trial-to-paid conversion
- Average revenue per account
- Average revenue per venue

Provider strategy:

- Start with internal financial metric records.
- Add adapter boundaries for Stripe, QuickBooks, or future billing providers.
- Do not bind the UI directly to one billing provider.

Finance layout:

1. Revenue summary: MRR, ARR, new, expansion, churned, failed.
2. Risk panel: failed payments, past due, refunds, discounts.
3. Segmentation: module, plan, segment, market type, acquisition source.
4. Client table: account, plan, MRR, status, failed payments, last payment.
5. Trend charts: monthly revenue, conversion, churn, expansion.

## 15. Secure Impersonation

Build secure support impersonation, not password access.

Authorized internal users may view as:

- Organization admin
- Property admin
- Venue manager
- Staff user

Rules:

- Must require a reason before impersonation starts.
- Must log start time, end time, actor, target user, org, property, venue, and reason.
- Must show a visible internal banner while impersonating.
- Must prevent destructive actions unless explicitly allowed.
- Must be time-limited.
- Must be fully auditable.
- Must never expose customer passwords.
- Must make it obvious that the admin is in support mode.

Recommended implementation:

1. Create an impersonation session record.
2. Store admin actor separately from target user context.
3. Apply a short default expiry.
4. Display an always-visible banner.
5. Route all privileged mutations through permission checks.
6. Block destructive actions unless `impersonation.destructive_actions` is present and the action is explicitly allowlisted.
7. Log start, end, timeout, and blocked actions.

## 16. Audit Log

Audit logging must be immutable from the app layer.

Log:

- Module changes
- Billing changes
- User changes
- Role changes
- Impersonation
- Support actions
- Troubleshooting actions
- Client setting changes
- Deleted records
- Exports
- AI-agent actions
- Feature flag changes

Filters:

- Date
- Actor
- Client
- Venue
- Module
- Action type
- Severity

Severity levels:

- Info
- Notice
- Warning
- Critical

Audit record should include:

- Actor type
- Actor ID
- Scope IDs
- Action key
- Human-readable action label
- Severity
- Metadata JSON
- Timestamp

## 17. Troubleshooting And Health Checks

Health panels:

- Notification delivery
- Websocket/session status
- API errors
- Database sync
- QR scan failures
- Device offline status
- Stalled service queues
- High escalation rates
- Unusual inactivity
- Module configuration issues

Support should see:

- Issue detected
- Severity
- Affected client/venue
- Probable cause
- Recommended action
- Matching support runbook
- Impact scope assessment
- Safe support actions
- Blocked actions
- Packet lifecycle state
- Related logs/events
- Escalation option

Support runbook categories:

- Client/config issue: support can apply permissioned configuration repairs when safe.
- Data/queue issue: support can trigger server-side replay, reset, validation, or repair actions when allowlisted.
- Universal code issue: support cannot change shared code; Platform Admin should gather scope, logs, impacted clients, mitigation options, and create an engineering incident packet.

Health check model:

- check key
- scope
- status
- severity
- message
- metadata
- checked timestamp

Health check statuses:

- Passing
- Warning
- Failing
- Unknown

## 18. AI Agent Foundation

Do not build full AI automation in the MVP unless a formal agent framework already exists.

Build the admin structure and event hooks for future agents.

Agent sections:

- Marketing Agent
- Social Media Agent
- SEO / GEO Agent
- SEM Agent
- Sales SDR Agent
- Email Agent
- Support Agent
- Finance Agent
- Client Success Agent

Marketing Agent future scope:

- Monitor signup sources
- Monitor conversion trends
- Monitor channel performance
- Identify campaign opportunities
- Recommend landing page or lifecycle messaging ideas

Social Media Agent future scope:

- Monitor testimonial candidates
- Monitor launch moments and product proof
- Identify content calendar gaps
- Draft post ideas for human approval
- Flag customer proof that requires approval before public use

SEO / GEO Agent future scope:

- Monitor organic keyword themes
- Monitor answer-engine visibility
- Identify content gaps by market and property type
- Recommend content briefs and FAQ opportunities
- Flag pages or topics that need owner review before publishing

SEM Agent future scope:

- Monitor paid search intent
- Monitor acquisition cost and conversion quality
- Recommend ad group and negative keyword ideas
- Prepare spend-change recommendations for human review
- Never change ad spend or campaign status without explicit approval

Sales SDR Agent future scope:

- Monitor demo requests and qualified signups
- Score lead readiness
- Draft outbound sequences and call context
- Flag expansion or upsell handoff opportunities
- Never send outreach or change pipeline state without human approval

Email Agent future scope:

- Monitor lifecycle triggers
- New signup
- Inactive trial
- Setup incomplete
- Module unused
- Failed payment
- Trial ending
- Upsell opportunity

Support Agent future scope:

- Monitor errors
- Monitor support history
- Monitor venue health
- Review logs and audit trails
- Recommend likely cause, next action, escalation notes, and client-facing responses

Finance Agent future scope:

- Monitor MRR, ARR, failed payments, churn, discounts, refunds, forecasts
- Generate revenue summaries and financial alerts

Client Success Agent future scope:

- Monitor adoption, usage decline, expansion signals, incomplete setup, testimonial candidates
- Recommend outreach and account actions

Rules:

- Every future AI action writes to audit log.
- Every agent event writes to `agent_events`.
- Agent recommendations should remain reviewable before destructive action.
- Agent output should never silently mutate client state without explicit permissions and audit records.
- Claude agents may recommend, summarize, draft, classify, and flag.
- Claude agents must not silently mutate production data.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must require a permission check.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must require human confirmation unless explicitly allowlisted.
- Any future agent action that changes client state, billing, modules, permissions, messaging, or support records must write an audit log entry and visible activity record.

## 19. Data Model Plan

Prefer extending existing platform data models where they already exist. Add internal admin tables where the platform needs internal-only concepts.

### `internal_admin_users`

- `id`
- `name`
- `email`
- `role`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

### `admin_roles`

- `id`
- `name`
- `description`
- `created_at`
- `updated_at`

### `admin_permissions`

- `id`
- `permission_key`
- `description`
- `created_at`
- `updated_at`

### `admin_role_permissions`

- `role_id`
- `permission_key`
- `allowed`

### `organizations`

Use existing tenant table if present. If adding or extending:

- `id`
- `name`
- `account_status`
- `plan_id`
- `billing_status`
- `market_type`
- `created_at`
- `updated_at`

### `properties`

Use existing properties table if present. If adding or extending:

- `id`
- `organization_id`
- `name`
- `location`
- `status`
- `created_at`
- `updated_at`

### `venues`

Use existing venues/outlets table if present. If adding or extending:

- `id`
- `property_id`
- `name`
- `venue_type`
- `status`
- `created_at`
- `updated_at`

### `modules`

- `id`
- `key`
- `name`
- `description`
- `category`
- `status`
- `created_at`
- `updated_at`

### `module_activations`

- `id`
- `organization_id`
- `property_id` nullable
- `venue_id` nullable
- `module_id`
- `enabled`
- `plan_required`
- `beta_enabled`
- `internal_only`
- `client_visible`
- `activated_at`
- `disabled_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### `usage_events`

- `id`
- `organization_id`
- `property_id` nullable
- `venue_id` nullable
- `user_id` nullable
- `module_key` nullable
- `event_type`
- `event_payload` json
- `created_at`

### `financial_metrics`

- `id`
- `organization_id`
- `metric_type`
- `amount`
- `currency`
- `source`
- `period_start`
- `period_end`
- `created_at`

### `registrations`

- `id`
- `organization_id` nullable
- `email`
- `company_name`
- `source`
- `campaign`
- `market_type`
- `selected_plan`
- `property_type`
- `status`
- `created_at`

### `client_health_scores`

- `id`
- `organization_id`
- `property_id` nullable
- `venue_id` nullable
- `score`
- `status`
- `usage_score`
- `billing_score`
- `support_score`
- `adoption_score`
- `setup_score`
- `performance_score`
- `sentiment_score`
- `calculated_at`

### `impersonation_sessions`

- `id`
- `admin_user_id`
- `target_user_id`
- `organization_id`
- `property_id` nullable
- `venue_id` nullable
- `reason`
- `started_at`
- `ended_at`
- `expires_at`
- `status`

### `audit_logs`

- `id`
- `actor_type`
- `actor_id`
- `organization_id` nullable
- `property_id` nullable
- `venue_id` nullable
- `action_key`
- `action_label`
- `severity`
- `metadata` json
- `created_at`

### `health_checks`

- `id`
- `organization_id` nullable
- `property_id` nullable
- `venue_id` nullable
- `check_key`
- `status`
- `severity`
- `message`
- `metadata` json
- `checked_at`

### `agent_events`

- `id`
- `agent_key`
- `organization_id` nullable
- `property_id` nullable
- `venue_id` nullable
- `event_type`
- `status`
- `input_payload` json
- `output_payload` json
- `created_at`

## 20. Security And RLS Strategy

Internal admin data must be protected separately from client-facing venue access.

Security requirements:

- Separate internal admin login from client, venue, and staff login.
- No public admin routes.
- Server-side permission checks for every sensitive action.
- Database RLS policies must distinguish internal admin access from client tenant access.
- Audit logs should not be mutable through normal app code.
- Impersonation sessions must be time-limited and auditable.
- Finance, billing, export, feature flag, and destructive operations require elevated permissions.

Cross-tenant access rule:

Platform Admin may require cross-tenant visibility, but that access must be explicit, permissioned, server-side, and auditable. Do not weaken existing customer-facing RLS policies to make admin screens easier to build.

RLS policy direction:

- Internal admin tables readable only by authenticated internal admins with relevant permissions.
- Mutation access scoped by permission and role.
- Audit logs insertable by server/admin action utilities, not freely editable.
- Client tenant tables remain governed by existing tenant policies.
- Platform Admin should use internal admin views/functions when cross-tenant reads are needed.

## 21. UI System Requirements

The app should feel:

- Premium
- Calm
- Operational
- Clean
- Information-dense but not cluttered
- Fast
- Enterprise-ready

Use reusable components:

- App shell
- Sidebar
- Top bar
- Breadcrumbs
- Metric cards
- Insight cards
- Data tables
- Filter bars
- Search inputs
- Status pills
- Module pills
- Health score badges
- Detail page headers
- Action panels
- Timeline
- Notes panel
- Audit table
- Empty states
- Permission-gated buttons
- Confirmation modals
- Reason-required modals

Table requirements:

- Search
- Filter
- Sort
- Pagination
- Export-ready structure
- Clear empty state

Detail page requirements:

- Status header
- Key metrics
- Recent activity
- Action panel
- Audit/history section

## 22. Engineering Structure

Recommended structure:

```text
src/
  app/
    routes/
    shell/
    providers/
  admin/
    dashboard/
    registrations/
    revenue/
    clients/
    organizations/
    properties/
    venues/
    modules/
    usage/
    health/
    support/
    troubleshooting/
    impersonation/
    audit/
    agents/
    reports/
    billing/
    feature-flags/
    settings/
  components/
    admin/
    ui/
  lib/
    auth/
    permissions/
    audit/
    supabase/
    modules/
    health/
    usage/
    finance/
    mock-data/
  styles/
```

Rules:

- Do not hardcode client names.
- Do not hardcode module behavior.
- Use reusable components.
- Keep admin routes separate from client routes.
- Permission-check every sensitive action.
- Log every meaningful action.
- Keep feature flags extensible.
- Build mock data only where real data does not exist yet.
- Clearly label mock and placeholder data.
- Do not remove or rewrite existing production flows.
- Prefer additive changes.

## 23. MVP Build Order

Implementation rule:

- Build UI and mock data contracts first.
- Connect to Supabase only after the screen structure, permissions, and data contracts are stable.
- When connecting real data, start with read-only views before enabling mutations.

### Phase 1: Foundation

Build:

- Internal admin app shell
- Internal admin login foundation
- Role and permission model
- Permission-aware sidebar/nav
- Executive dashboard layout
- Reusable admin cards
- Reusable admin tables
- Reusable status pills
- Reusable detail page header
- Audit log utility
- Module registry structure
- Mock data layer clearly labeled as placeholder

Exit criteria:

- Internal users can enter the admin shell.
- Navigation is role-aware.
- Executive dashboard has real layout and placeholder-safe metrics.
- Audit utility can record meaningful local/admin events.
- Module registry can render modules without hardcoded UI behavior.

### Phase 2: Client And Venue Management

Build:

- Organization list
- Organization detail
- Property list
- Property detail
- Venue/outlet list
- Venue/outlet detail
- Venue support workbench
- Internal notes
- Basic health score placeholder
- Recent activity panels

Exit criteria:

- Support can find an organization, property, or venue quickly.
- Support can open a venue and understand its status.
- Internal notes and support context are visible.
- Health score placeholder is ready for real calculation.

### Phase 3: Modules And Usage

Build:

- Module list
- Module detail
- Module activation toggles
- Activation scope handling
- Usage event model
- Usage analytics dashboard
- Client not-using view
- Module adoption view

Exit criteria:

- Admin can safely enable/disable modules.
- Module changes are permission-checked.
- Module changes are audit-logged.
- Usage analytics can show adoption and inactivity.

### Phase 4: Revenue And Registrations

Build:

- Registration dashboard
- Finance dashboard
- Revenue metric model
- Billing status visibility
- Failed payment view
- Revenue by module
- Revenue by plan
- Revenue by client segment
- Signup source and campaign views

Exit criteria:

- Ownership can see SaaS performance.
- Finance can identify payment risk.
- Marketing can understand registration sources.
- Revenue model is ready for Stripe or QuickBooks adapters later.

### Phase 5: Support And Troubleshooting

Build:

- Health checks
- Troubleshooting panel
- Diagnose and remediate runbooks
- Impact scope detection
- Remediation packet queue
- Remediation packet lifecycle controls
- System status view
- Support action logging
- Issue severity states
- Probable-cause and recommended-action display
- Escalation workflow foundation

Exit criteria:

- Support can identify problems quickly.
- Support can distinguish client configuration, data/queue repair, and universal code issues.
- Support can see whether an issue is venue-scoped, client-scoped, module-wide, or universal before acting.
- Troubleshooting actions are audit-logged.
- Safe-fix and incident packets stay visible in a searchable support queue.
- Support can move packets through queued, handed-off, and resolved states.
- Universal code issues route to engineering incident packets instead of support-side mutation.
- System health can be shown by client and venue.

### Phase 6: Secure Impersonation

Build:

- Impersonation session model
- Reason-required modal
- Visible impersonation banner
- Session timeout
- Permission-gated start/end
- Destructive action blocking
- Full audit logging

Exit criteria:

- Authorized internal users can start a safe support session.
- Every session has reason, actor, target, scope, start, end, and status.
- Destructive actions are blocked unless explicitly allowed.
- Support mode is visually obvious.

### Phase 7: AI Agent Foundation

Build:

- AI Agents section
- Agent event model
- Marketing Agent placeholder
- Social Media Agent placeholder
- SEO / GEO Agent placeholder
- SEM Agent placeholder
- Sales SDR Agent placeholder
- Email Agent placeholder
- Support Agent placeholder
- Finance Agent placeholder
- Client Success Agent placeholder
- Agent activity log
- Audit hooks for future agent actions

Exit criteria:

- Future agents have a place to write events.
- Agent recommendations can be displayed without mutating state.
- Every future agent action has an audit path.

## 24. Reports And Exports

Reports should eventually support:

- Executive summary
- Revenue summary
- Client health summary
- Module adoption summary
- Registration funnel summary
- Support workload summary
- At-risk client report
- Expansion candidates report
- Failed payments report

Export rules:

- Export actions require permissions.
- Export actions write audit logs.
- Export scope must be visible before export.
- Sensitive exports should show confirmation.

## 25. Feature Flags

Feature flags should support:

- Global flags
- Organization-level flags
- Property-level flags
- Venue-level flags
- Internal-only flags
- Beta flags
- Rollout percentage later

Feature flag changes must be audit-logged.

## 26. Testing And Verification

Minimum verification per phase:

- Typecheck passes.
- Production build passes.
- Permission-gated routes deny unauthorized roles.
- Sensitive buttons are hidden and server/data actions are protected.
- Audit logs are written for meaningful actions.
- Empty states render cleanly.
- Tables support search, filter, sort, and pagination where applicable.
- Mock data is clearly labeled.
- Existing Happy Chair production data paths are not broken.

Manual workflows to verify:

- Owner dashboard overview.
- Support finds and opens a venue.
- Admin enables/disables a module.
- Finance reviews failed payments.
- Marketing reviews registrations by source.
- Support adds a note.
- Support runs a health check.
- Impersonation starts with reason and ends with audit trail.
- Read Only user cannot mutate data.

## 27. Acceptance Criteria

The admin is successful when:

- Owner can see daily signups, revenue, client health, and usage in one place.
- Support can open a venue and understand what is happening quickly.
- Admin can enable/disable modules safely.
- Every support/admin action is logged.
- Impersonation is secure, permissioned, and auditable.
- Usage analytics clearly show what clients are and are not using.
- Revenue views show SaaS performance by client, plan, module, and segment.
- The system can support future Claude agents without reworking the architecture.
- Existing Happy Chair app functionality remains intact.

## 28. First Implementation Recommendation

Start with a Vite + React + TypeScript app that mirrors Happy Chair's existing web stack, then layer in:

1. App shell and routing.
2. Design tokens and reusable admin UI components.
3. Mock data service with clear labels.
4. Permission model and role-gated navigation.
5. Executive dashboard using mock data.
6. Clients and venue support workbench.
7. Supabase integration after the screens and data contracts are stable.

This lets the internal product take shape quickly without risking the existing customer-facing Venue Admin app.
