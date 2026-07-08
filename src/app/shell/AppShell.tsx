import {
  Activity,
  Archive,
  Bell,
  BellRing,
  Bot,
  BookmarkCheck,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Code2,
  CreditCard,
  DatabaseZap,
  Download,
  FileCheck2,
  FileBarChart,
  Flag,
  Gauge,
  GitBranch,
  HeartHandshake,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MapPinned,
  Newspaper,
  PackageCheck,
  RadioTower,
  Search,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Store,
  TimerReset,
  UserPlus,
  UserRoundSearch,
  Workflow,
  Wrench,
  ScrollText,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import type { ActiveImpersonationSession } from '../../admin/impersonation/ImpersonationPage'
import { queueAdminActionRequest } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope } from '../../lib/admin-actions/actionRequests'
import { moduleRegistry } from '../../lib/modules/registry'
import type { ImpersonationTarget } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission, roleLabels, type PermissionKey } from '../../lib/permissions/permissions'

type PageId =
  | 'dashboard'
  | 'executive-morning-review'
  | 'owner-decision-room'
  | 'owner-commitment-ledger'
  | 'action-request-launchpad'
  | 'command-work'
  | 'decision-briefs'
  | 'operator-daily-brief'
  | 'owner-action-calendar'
  | 'command-handoff-timeline'
  | 'operating-exceptions'
  | 'exception-sla-policies'
  | 'command-digest'
  | 'brief-archive'
  | 'digest-cadence'
  | 'escalation-inbox'
  | 'notification-routing'
  | 'on-call-schedule'
  | 'coverage-ledger'
  | 'watch-center'
  | 'watch-rules'
  | 'response-playbooks'
  | 'sla-board'
  | 'attention'
  | 'command-cadence'
  | 'registrations'
  | 'lifecycle'
  | 'revenue'
  | 'client-360'
  | 'client-success'
  | 'clients'
  | 'organizations'
  | 'properties'
  | 'venues'
  | 'modules'
  | 'usage'
  | 'health'
  | 'support'
  | 'venue-support'
  | 'ownership-sla'
  | 'incidents'
  | 'troubleshooting'
  | 'action-requests'
  | 'approval-center'
  | 'execution-handoff'
  | 'server-adapters'
  | 'execution-ledger'
  | 'action-timeline'
  | 'impersonation'
  | 'audit'
  | 'agents'
  | 'launch-readiness'
  | 'reports'
  | 'export-center'
  | 'saved-views'
  | 'billing'
  | 'feature-flags'
  | 'permission-simulator'
  | 'data-quality'
  | 'system-health'
  | 'settings'

interface NavItem {
  id: PageId
  label: string
  permission: PermissionKey
  icon: typeof LayoutDashboard
  group: 'Command' | 'Clients' | 'Operations' | 'Company'
}

type GlobalSearchResultType = 'Organization' | 'Registration' | 'Property' | 'Venue' | 'Support' | 'Module'

interface GlobalSearchResult {
  id: string
  type: GlobalSearchResultType
  label: string
  detail: string
  page: PageId
  targetId?: string
  moduleKey?: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', permission: 'dashboard.view', icon: LayoutDashboard, group: 'Command' },
  { id: 'executive-morning-review', label: 'Morning Review', permission: 'dashboard.view', icon: Gauge, group: 'Command' },
  { id: 'owner-decision-room', label: 'Decision Room', permission: 'dashboard.view', icon: FileCheck2, group: 'Command' },
  { id: 'owner-commitment-ledger', label: 'Commitments', permission: 'dashboard.view', icon: ListChecks, group: 'Command' },
  { id: 'action-request-launchpad', label: 'Action Launchpad', permission: 'admin_actions.view', icon: Send, group: 'Command' },
  { id: 'command-work', label: 'Command Queue', permission: 'dashboard.view', icon: ListChecks, group: 'Command' },
  { id: 'decision-briefs', label: 'Decision Briefs', permission: 'dashboard.view', icon: FileCheck2, group: 'Command' },
  { id: 'operator-daily-brief', label: 'Daily Brief', permission: 'dashboard.view', icon: Newspaper, group: 'Command' },
  { id: 'owner-action-calendar', label: 'Owner Calendar', permission: 'dashboard.view', icon: CalendarClock, group: 'Command' },
  { id: 'command-handoff-timeline', label: 'Handoff Timeline', permission: 'dashboard.view', icon: GitBranch, group: 'Command' },
  { id: 'operating-exceptions', label: 'Exceptions Inbox', permission: 'dashboard.view', icon: Siren, group: 'Command' },
  { id: 'exception-sla-policies', label: 'Exception SLA', permission: 'notifications.view', icon: TimerReset, group: 'Command' },
  { id: 'command-digest', label: 'Command Digest', permission: 'dashboard.view', icon: Newspaper, group: 'Command' },
  { id: 'brief-archive', label: 'Brief Archive', permission: 'dashboard.view', icon: Archive, group: 'Command' },
  { id: 'digest-cadence', label: 'Review Cadence', permission: 'dashboard.view', icon: CalendarClock, group: 'Command' },
  { id: 'escalation-inbox', label: 'Escalation Inbox', permission: 'dashboard.view', icon: Siren, group: 'Command' },
  { id: 'notification-routing', label: 'Routing Center', permission: 'notifications.view', icon: RadioTower, group: 'Command' },
  { id: 'on-call-schedule', label: 'On-Call Schedule', permission: 'notifications.view', icon: CalendarClock, group: 'Command' },
  { id: 'coverage-ledger', label: 'Coverage Ledger', permission: 'notifications.view', icon: BookOpenCheck, group: 'Command' },
  { id: 'watch-center', label: 'Watch Center', permission: 'notifications.view', icon: BellRing, group: 'Command' },
  { id: 'watch-rules', label: 'Watch Rules', permission: 'notifications.view', icon: SlidersHorizontal, group: 'Command' },
  { id: 'response-playbooks', label: 'Response Playbooks', permission: 'notifications.view', icon: BookOpenCheck, group: 'Command' },
  { id: 'sla-board', label: 'SLA Board', permission: 'notifications.view', icon: TimerReset, group: 'Command' },
  { id: 'attention', label: 'Attention Queue', permission: 'dashboard.view', icon: BellRing, group: 'Command' },
  { id: 'command-cadence', label: 'Command Cadence', permission: 'dashboard.view', icon: CalendarClock, group: 'Command' },
  { id: 'registrations', label: 'Registrations', permission: 'registrations.view', icon: UserPlus, group: 'Command' },
  { id: 'lifecycle', label: 'Lifecycle Command', permission: 'registrations.view', icon: Workflow, group: 'Command' },
  { id: 'revenue', label: 'Revenue', permission: 'revenue.view', icon: CircleDollarSign, group: 'Command' },
  { id: 'client-360', label: 'Client 360', permission: 'clients.view', icon: GitBranch, group: 'Clients' },
  { id: 'client-success', label: 'Client Success', permission: 'clients.view', icon: HeartHandshake, group: 'Clients' },
  { id: 'clients', label: 'Clients', permission: 'clients.view', icon: Building2, group: 'Clients' },
  { id: 'organizations', label: 'Organizations', permission: 'organizations.view', icon: Building2, group: 'Clients' },
  { id: 'properties', label: 'Properties', permission: 'properties.view', icon: MapPinned, group: 'Clients' },
  { id: 'venues', label: 'Venues / Outlets', permission: 'venues.view', icon: Store, group: 'Clients' },
  { id: 'modules', label: 'Modules', permission: 'modules.view', icon: PackageCheck, group: 'Operations' },
  { id: 'usage', label: 'Usage Analytics', permission: 'usage.view', icon: Activity, group: 'Operations' },
  { id: 'health', label: 'Client Health', permission: 'health.view', icon: HeartPulse, group: 'Operations' },
  { id: 'support', label: 'Support Center', permission: 'support.view', icon: LifeBuoy, group: 'Operations' },
  { id: 'venue-support', label: 'Venue Workbench', permission: 'support.view', icon: Store, group: 'Operations' },
  { id: 'ownership-sla', label: 'Ownership / SLA', permission: 'dashboard.view', icon: TimerReset, group: 'Operations' },
  { id: 'incidents', label: 'Incident Command', permission: 'support.view', icon: Siren, group: 'Operations' },
  { id: 'troubleshooting', label: 'Troubleshooting', permission: 'troubleshooting.view', icon: Wrench, group: 'Operations' },
  { id: 'action-requests', label: 'Action Requests', permission: 'admin_actions.view', icon: ListChecks, group: 'Operations' },
  { id: 'approval-center', label: 'Approval Center', permission: 'admin_actions.view', icon: ShieldCheck, group: 'Operations' },
  { id: 'execution-handoff', label: 'Execution Handoff', permission: 'admin_actions.view', icon: FileCheck2, group: 'Operations' },
  { id: 'server-adapters', label: 'Server Adapters', permission: 'admin_actions.view', icon: Code2, group: 'Operations' },
  { id: 'execution-ledger', label: 'Execution Ledger', permission: 'admin_actions.view', icon: ServerCog, group: 'Operations' },
  { id: 'action-timeline', label: 'Action Timeline', permission: 'admin_actions.view', icon: CalendarClock, group: 'Operations' },
  { id: 'impersonation', label: 'Impersonation', permission: 'impersonation.start', icon: UserRoundSearch, group: 'Operations' },
  { id: 'audit', label: 'Audit Logs', permission: 'audit.view', icon: ScrollText, group: 'Operations' },
  { id: 'agents', label: 'Agent Foundation', permission: 'agents.view', icon: Bot, group: 'Company' },
  { id: 'launch-readiness', label: 'Launch Gate', permission: 'settings.view', icon: Gauge, group: 'Company' },
  { id: 'reports', label: 'Reports', permission: 'reports.view', icon: FileBarChart, group: 'Company' },
  { id: 'export-center', label: 'Export Center', permission: 'reports.view', icon: Download, group: 'Company' },
  { id: 'saved-views', label: 'Saved Views', permission: 'saved_views.view', icon: BookmarkCheck, group: 'Company' },
  { id: 'billing', label: 'Billing', permission: 'billing.view', icon: CreditCard, group: 'Company' },
  { id: 'feature-flags', label: 'Feature Flags', permission: 'feature_flags.view', icon: Flag, group: 'Company' },
  { id: 'permission-simulator', label: 'Permission Simulator', permission: 'settings.view', icon: KeyRound, group: 'Company' },
  { id: 'data-quality', label: 'Data Quality', permission: 'health.view', icon: DatabaseZap, group: 'Company' },
  { id: 'system-health', label: 'System Health', permission: 'health.view', icon: ServerCog, group: 'Company' },
  { id: 'settings', label: 'Internal Access', permission: 'settings.view', icon: Settings, group: 'Company' },
]

const groupOrder: NavItem['group'][] = ['Command', 'Clients', 'Operations', 'Company']

const ActionRequestLaunchpadPage = lazy(() => import('../../admin/action-requests/ActionRequestLaunchpadPage'))
const ActionTimelinePage = lazy(() => import('../../admin/action-requests/ActionTimelinePage'))
const AdminActionRequestsPage = lazy(() => import('../../admin/action-requests/AdminActionRequestsPage'))
const ApprovalCenterPage = lazy(() => import('../../admin/action-requests/ApprovalCenterPage'))
const ExecutionHandoffPage = lazy(() => import('../../admin/action-requests/ExecutionHandoffPage'))
const ExecutionLedgerPage = lazy(() => import('../../admin/action-requests/ExecutionLedgerPage'))
const ServerAdapterReadinessPage = lazy(() => import('../../admin/action-requests/ServerAdapterReadinessPage'))
const AgentsPage = lazy(() => import('../../admin/agents/AgentsPage'))
const AttentionQueuePage = lazy(() => import('../../admin/attention/AttentionQueuePage'))
const AuditLogsPage = lazy(() => import('../../admin/audit/AuditLogsPage'))
const BillingPage = lazy(() => import('../../admin/billing/BillingPage'))
const Client360Page = lazy(() => import('../../admin/client-360/Client360Page'))
const ClientSuccessWorkspacePage = lazy(() => import('../../admin/client-success/ClientSuccessWorkspacePage'))
const ClientsPage = lazy(() => import('../../admin/clients/ClientsPage'))
const CommandCadencePage = lazy(() => import('../../admin/command-cadence/CommandCadencePage'))
const BriefArchivePage = lazy(() => import('../../admin/command-digest/BriefArchivePage'))
const CommandDigestPage = lazy(() => import('../../admin/command-digest/CommandDigestPage'))
const DigestReviewCadencePage = lazy(() => import('../../admin/command-digest/DigestReviewCadencePage'))
const EscalationInboxPage = lazy(() => import('../../admin/command-digest/EscalationInboxPage'))
const CommandHandoffTimelinePage = lazy(() => import('../../admin/command-work/CommandHandoffTimelinePage'))
const CommandWorkQueuePage = lazy(() => import('../../admin/command-work/CommandWorkQueuePage'))
const DecisionBriefBuilderPage = lazy(() => import('../../admin/command-work/DecisionBriefBuilderPage'))
const ExceptionSlaPolicyBuilderPage = lazy(() => import('../../admin/command-work/ExceptionSlaPolicyBuilderPage'))
const ExecutiveMorningReviewPage = lazy(() => import('../../admin/command-work/ExecutiveMorningReviewPage'))
const OperatingExceptionsInboxPage = lazy(() => import('../../admin/command-work/OperatingExceptionsInboxPage'))
const OperatorDailyBriefPage = lazy(() => import('../../admin/command-work/OperatorDailyBriefPage'))
const OwnerActionCalendarPage = lazy(() => import('../../admin/command-work/OwnerActionCalendarPage'))
const OwnerCommitmentLedgerPage = lazy(() => import('../../admin/command-work/OwnerCommitmentLedgerPage'))
const OwnerDecisionRoomPage = lazy(() => import('../../admin/command-work/OwnerDecisionRoomPage'))
const DataQualityPage = lazy(() => import('../../admin/data-quality/DataQualityPage'))
const ExecutiveDashboard = lazy(() => import('../../admin/dashboard/ExecutiveDashboard'))
const FeatureFlagsPage = lazy(() => import('../../admin/feature-flags/FeatureFlagsPage'))
const ClientHealthPage = lazy(() => import('../../admin/health/ClientHealthPage'))
const SystemHealthPage = lazy(() => import('../../admin/health/SystemHealthPage'))
const IncidentCommandPage = lazy(() => import('../../admin/incidents/IncidentCommandPage'))
const ImpersonationPage = lazy(() => import('../../admin/impersonation/ImpersonationPage'))
const LaunchReadinessPage = lazy(() => import('../../admin/launch/LaunchReadinessPage'))
const LifecycleCommandPage = lazy(() => import('../../admin/lifecycle/LifecycleCommandPage'))
const ModulesPage = lazy(() => import('../../admin/modules/ModulesPage'))
const CoverageLedgerPage = lazy(() => import('../../admin/ownership/CoverageLedgerPage'))
const NotificationRoutingPage = lazy(() => import('../../admin/ownership/NotificationRoutingPage'))
const OnCallSchedulePage = lazy(() => import('../../admin/ownership/OnCallSchedulePage'))
const OwnershipSlaPage = lazy(() => import('../../admin/ownership/OwnershipSlaPage'))
const PlaceholderPage = lazy(() => import('../../admin/placeholder/PlaceholderPage'))
const PermissionSimulatorPage = lazy(() => import('../../admin/permissions/PermissionSimulatorPage'))
const PropertiesPage = lazy(() => import('../../admin/properties/PropertiesPage'))
const RegistrationsPage = lazy(() => import('../../admin/registrations/RegistrationsPage'))
const ExportCenterPage = lazy(() => import('../../admin/reports/ExportCenterPage'))
const ReportsPage = lazy(() => import('../../admin/reports/ReportsPage'))
const RevenuePage = lazy(() => import('../../admin/revenue/RevenuePage'))
const SavedViewsPage = lazy(() => import('../../admin/saved-views/SavedViewsPage'))
const AdminSettingsPage = lazy(() => import('../../admin/settings/AdminSettingsPage'))
const SupportCenterPage = lazy(() => import('../../admin/support/SupportCenterPage'))
const VenueSupportPage = lazy(() => import('../../admin/support/VenueSupportPage'))
const TroubleshootingPage = lazy(() => import('../../admin/troubleshooting/TroubleshootingPage'))
const UsageAnalyticsPage = lazy(() => import('../../admin/usage/UsageAnalyticsPage'))
const VenuesPage = lazy(() => import('../../admin/venues/VenuesPage'))
const ResponsePlaybooksPage = lazy(() => import('../../admin/watch-center/ResponsePlaybooksPage'))
const SlaEscalationBoardPage = lazy(() => import('../../admin/watch-center/SlaEscalationBoardPage'))
const WatchCenterPage = lazy(() => import('../../admin/watch-center/WatchCenterPage'))
const WatchRulesPage = lazy(() => import('../../admin/watch-center/WatchRulesPage'))

interface AppShellProps {
  session: AdminSession
  onLogout: () => void
}

function PageLoadingFallback() {
  return (
    <div className="empty-state compact" role="status">
      Loading admin workspace...
    </div>
  )
}

export default function AppShell({ session, onLogout }: AppShellProps) {
  const { data, sourceLabel, status, error } = usePlatformData()
  const visibleItems = useMemo(() => navItems.filter(item => hasPermission(session.role, item.permission)), [session.role])
  const [firstItem] = visibleItems
  const getInitialPage = (): PageId => {
    const saved = sessionStorage.getItem('hc_platform_active_page') as PageId | null
    if (saved && visibleItems.some(item => item.id === saved)) return saved
    return firstItem?.id ?? 'dashboard'
  }
  const [activePage, setActivePageState] = useState<PageId>(getInitialPage)
  const [impersonationSession, setImpersonationSession] = useState<ActiveImpersonationSession | null>(null)
  const [globalQuery, setGlobalQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState<{
    organizationId?: string
    propertyId?: string
    venueId?: string
    moduleKey?: string
  }>({})

  const setActivePage = (page: PageId) => {
    sessionStorage.setItem('hc_platform_active_page', page)
    setActivePageState(page)
  }

  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const normalizedQuery = globalQuery.trim().toLowerCase()
    if (!normalizedQuery) return []

    const canOpenPage = (page: PageId) => visibleItems.some(item => item.id === page)
    const matches = (value: string | undefined) => value?.toLowerCase().includes(normalizedQuery) ?? false
    const organizationNameById = new Map(data.organizations.map(org => [org.id, org.name]))
    const venueIdByName = new Map(data.venues.map(venue => [venue.name, venue.id]))
    const results: GlobalSearchResult[] = []

    if (canOpenPage('client-360') || canOpenPage('organizations')) {
      data.organizations.forEach(org => {
        if (!matches(`${org.name} ${org.accountStatus} ${org.plan} ${org.billingStatus} ${org.marketType} ${org.healthStatus}`)) return
        results.push({
          id: `organization-${org.id}`,
          type: 'Organization',
          label: org.name,
          detail: `${org.accountStatus} / ${org.plan} / ${org.billingStatus} / ${org.healthStatus}`,
          page: canOpenPage('client-360') ? 'client-360' : 'organizations',
          targetId: org.id,
        })
      })
    }

    if (canOpenPage('registrations')) {
      data.registrations.forEach(registration => {
        if (!matches(`${registration.companyName} ${registration.email} ${registration.source} ${registration.campaign} ${registration.status} ${registration.marketType} ${registration.propertyType}`)) return
        results.push({
          id: `registration-${registration.id}`,
          type: 'Registration',
          label: registration.companyName,
          detail: `${registration.email} / ${registration.status} / ${registration.source}`,
          page: 'registrations',
        })
      })
    }

    if (canOpenPage('properties')) {
      data.properties.forEach(property => {
        const organizationName = organizationNameById.get(property.organizationId) ?? 'Unknown organization'
        if (!matches(`${property.name} ${organizationName} ${property.location} ${property.status}`)) return
        results.push({
          id: `property-${property.id}`,
          type: 'Property',
          label: property.name,
          detail: `${organizationName} / ${property.status} / ${property.venues} venues`,
          page: 'properties',
          targetId: property.id,
        })
      })
    }

    if (canOpenPage('venues')) {
      data.venues.forEach(venue => {
        const organizationName = organizationNameById.get(venue.organizationId) ?? 'Unknown organization'
        if (!matches(`${venue.name} ${organizationName} ${venue.propertyName} ${venue.venueType} ${venue.status} ${venue.notificationHealth}`)) return
        results.push({
          id: `venue-${venue.id}`,
          type: 'Venue',
          label: venue.name,
          detail: `${organizationName} / ${venue.propertyName} / ${venue.status}`,
          page: 'venues',
          targetId: venue.id,
        })
      })
    }

    if (canOpenPage('support') || canOpenPage('venue-support')) {
      data.supportIssues.forEach(issue => {
        if (!matches(`${issue.organizationName} ${issue.propertyName} ${issue.venueName} ${issue.issueType} ${issue.status} ${issue.severity} ${issue.relatedSignal}`)) return
        const venueId = venueIdByName.get(issue.venueName)
        results.push({
          id: `support-${issue.id}`,
          type: 'Support',
          label: issue.issueType,
          detail: `${issue.organizationName} / ${issue.venueName} / ${issue.status}`,
          page: venueId && canOpenPage('venue-support') ? 'venue-support' : 'support',
          targetId: venueId,
        })
      })
    }

    if (canOpenPage('modules')) {
      moduleRegistry.forEach(module => {
        if (!matches(`${module.name} ${module.description} ${module.category} ${module.status} ${module.planRequired}`)) return
        results.push({
          id: `module-${module.key}`,
          type: 'Module',
          label: module.name,
          detail: `${module.category} / ${module.status} / ${module.planRequired}`,
          page: 'modules',
          moduleKey: module.key,
        })
      })
    }

    return results.slice(0, 8)
  }, [data.organizations, data.properties, data.registrations, data.supportIssues, data.venues, globalQuery, visibleItems])

  const selectGlobalSearchResult = (result: GlobalSearchResult) => {
    setNavigationTarget({
      organizationId: result.type === 'Organization' ? result.targetId : undefined,
      propertyId: result.type === 'Property' ? result.targetId : undefined,
      venueId: result.type === 'Venue' || result.type === 'Support' ? result.targetId : undefined,
      moduleKey: result.moduleKey,
    })
    setActivePage(result.page)
    setGlobalQuery('')
    setSearchFocused(false)
  }

  const openVenueSupportWorkbench = (venueId?: string) => {
    setNavigationTarget({ venueId })
    setActivePage('venue-support')
  }

  const startImpersonationSession = (target: ImpersonationTarget, reason: string) => {
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + 15 * 60 * 1000)
    const nextSession: ActiveImpersonationSession = {
      id: crypto.randomUUID(),
      targetId: target.id,
      targetUserId: target.userId,
      targetName: target.name,
      targetEmail: target.email,
      targetRole: target.role,
      organizationName: target.organizationName,
      propertyName: target.propertyName,
      venueName: target.venueName,
      scopeLabel: target.scopeLabel,
      reason,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    const result = queueAdminActionRequest(session, {
      actionType: 'impersonation_start',
      title: `Start view-as session for ${target.name}`,
      permission: 'impersonation.start',
      scope: createAdminActionScope({
        organizationId: target.organizationId,
        organizationName: target.organizationName,
        propertyId: target.propertyId,
        propertyName: target.propertyName,
        venueId: target.venueId,
        venueName: target.venueName,
      }),
      reason,
      rollbackNotes: 'Expire the session immediately and preserve the audit trail if scoped impersonation setup fails.',
      status: 'Completed',
      severity: 'warning',
      metadata: {
        targetId: target.id,
        targetUserId: target.userId,
        targetRole: target.role,
        expiresAt: expiresAt.toISOString(),
      },
    })
    if (!result.ok) return
    setImpersonationSession(nextSession)
  }

  const endImpersonationSession = (source: 'manual' | 'expired' = 'manual') => {
    if (!impersonationSession) return
    queueAdminActionRequest(session, {
      actionType: 'impersonation_end',
      title: `${source === 'expired' ? 'Expire' : 'End'} view-as session for ${impersonationSession.targetName}`,
      permission: 'impersonation.start',
      scope: createAdminActionScope({
        organizationName: impersonationSession.organizationName,
        propertyName: impersonationSession.propertyName,
        venueName: impersonationSession.venueName,
      }),
      reason: `${source === 'expired' ? 'Automatic expiry' : 'Manual end'} for scoped support view-as session.`,
      rollbackNotes: 'Keep the session expired or ended. If server finalization fails, block continued access and preserve the audit entry.',
      status: 'Completed',
      severity: source === 'expired' ? 'warning' : 'notice',
      metadata: {
        impersonationSessionId: impersonationSession.id,
        targetUserId: impersonationSession.targetUserId,
        source,
      },
    })
    setImpersonationSession(null)
  }

  useEffect(() => {
    if (!impersonationSession) return
    const remaining = new Date(impersonationSession.expiresAt).getTime() - Date.now()
    if (remaining <= 0) {
      endImpersonationSession('expired')
      return
    }
    const timeout = window.setTimeout(() => endImpersonationSession('expired'), remaining)
    return () => window.clearTimeout(timeout)
  }, [impersonationSession])

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <ExecutiveDashboard />
      case 'executive-morning-review':
        return (
          <ExecutiveMorningReviewPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'owner-decision-room':
        return (
          <OwnerDecisionRoomPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'owner-commitment-ledger':
        return (
          <OwnerCommitmentLedgerPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'action-request-launchpad':
        return (
          <ActionRequestLaunchpadPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'command-work':
        return (
          <CommandWorkQueuePage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'decision-briefs':
        return (
          <DecisionBriefBuilderPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'operator-daily-brief':
        return (
          <OperatorDailyBriefPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'owner-action-calendar':
        return (
          <OwnerActionCalendarPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'command-handoff-timeline':
        return (
          <CommandHandoffTimelinePage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'operating-exceptions':
        return (
          <OperatingExceptionsInboxPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'exception-sla-policies':
        return (
          <ExceptionSlaPolicyBuilderPage
            session={session}
            onOpenTarget={(page) => setActivePage(page as PageId)}
          />
        )
      case 'command-digest':
        return (
          <CommandDigestPage
            session={session}
            onOpenTarget={(page) => setActivePage(page)}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'brief-archive':
        return (
          <BriefArchivePage
            session={session}
            onOpenCommandDigest={() => setActivePage('command-digest')}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'digest-cadence':
        return (
          <DigestReviewCadencePage
            session={session}
            onOpenBriefArchive={() => setActivePage('brief-archive')}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'escalation-inbox':
        return (
          <EscalationInboxPage
            session={session}
            onOpenTarget={(page) => setActivePage(page)}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'notification-routing':
        return (
          <NotificationRoutingPage
            session={session}
            onOpenOwnership={() => setActivePage('ownership-sla')}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'on-call-schedule':
        return (
          <OnCallSchedulePage
            session={session}
            onOpenRouting={() => setActivePage('notification-routing')}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'coverage-ledger':
        return (
          <CoverageLedgerPage
            session={session}
            onOpenRouting={() => setActivePage('notification-routing')}
            onOpenOnCall={() => setActivePage('on-call-schedule')}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'watch-center':
        return <WatchCenterPage session={session} onOpenTarget={(page) => setActivePage(page)} />
      case 'watch-rules':
        return <WatchRulesPage session={session} onOpenTarget={(page) => setActivePage(page)} />
      case 'response-playbooks':
        return (
          <ResponsePlaybooksPage
            session={session}
            onOpenTarget={(page) => setActivePage(page)}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'sla-board':
        return (
          <SlaEscalationBoardPage
            session={session}
            onOpenTarget={(page) => setActivePage(page)}
            onOpenActionRequests={() => setActivePage('action-requests')}
          />
        )
      case 'attention':
        return <AttentionQueuePage session={session} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'command-cadence':
        return <CommandCadencePage session={session} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'registrations':
        return <RegistrationsPage />
      case 'lifecycle':
        return <LifecycleCommandPage session={session} />
      case 'revenue':
        return <RevenuePage />
      case 'client-360':
        return <Client360Page session={session} initialOrganizationId={navigationTarget.organizationId} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'client-success':
        return (
          <ClientSuccessWorkspacePage
            session={session}
            onOpenClient360={(organizationId) => {
              setNavigationTarget({ organizationId })
              setActivePage('client-360')
            }}
          />
        )
      case 'clients':
      case 'organizations':
        return <ClientsPage session={session} initialOrganizationId={navigationTarget.organizationId} />
      case 'venues':
        return <VenuesPage session={session} initialVenueId={navigationTarget.venueId} onOpenSupportWorkbench={openVenueSupportWorkbench} />
      case 'properties':
        return <PropertiesPage session={session} initialPropertyId={navigationTarget.propertyId} />
      case 'support':
        return <SupportCenterPage session={session} onOpenVenueSupport={openVenueSupportWorkbench} />
      case 'venue-support':
        return <VenueSupportPage session={session} initialVenueId={navigationTarget.venueId} />
      case 'ownership-sla':
        return <OwnershipSlaPage session={session} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'incidents':
        return <IncidentCommandPage session={session} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'troubleshooting':
        return <TroubleshootingPage session={session} />
      case 'action-requests':
        return <AdminActionRequestsPage session={session} />
      case 'approval-center':
        return <ApprovalCenterPage session={session} />
      case 'execution-handoff':
        return <ExecutionHandoffPage session={session} />
      case 'server-adapters':
        return <ServerAdapterReadinessPage session={session} />
      case 'execution-ledger':
        return <ExecutionLedgerPage session={session} />
      case 'action-timeline':
        return <ActionTimelinePage />
      case 'impersonation':
        return (
          <ImpersonationPage
            session={session}
            activeSession={impersonationSession}
            onStartSession={startImpersonationSession}
            onEndSession={endImpersonationSession}
          />
        )
      case 'modules':
        return <ModulesPage session={session} initialSelectedKey={navigationTarget.moduleKey} />
      case 'usage':
        return <UsageAnalyticsPage />
      case 'health':
        return <ClientHealthPage session={session} />
      case 'system-health':
        return <SystemHealthPage />
      case 'audit':
        return <AuditLogsPage />
      case 'agents':
        return <AgentsPage session={session} />
      case 'launch-readiness':
        return <LaunchReadinessPage session={session} onOpenActionRequests={() => setActivePage('action-requests')} />
      case 'reports':
        return <ReportsPage session={session} />
      case 'export-center':
        return <ExportCenterPage session={session} />
      case 'saved-views':
        return <SavedViewsPage session={session} onOpenTarget={(page) => setActivePage(page)} />
      case 'billing':
        return <BillingPage session={session} />
      case 'feature-flags':
        return <FeatureFlagsPage session={session} />
      case 'permission-simulator':
        return <PermissionSimulatorPage session={session} />
      case 'data-quality':
        return <DataQualityPage session={session} />
      case 'settings':
        return <AdminSettingsPage session={session} />
      default:
        return <PlaceholderPage pageId={activePage} title={navItems.find(item => item.id === activePage)?.label ?? 'Admin View'} />
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Happy Chair Admin navigation">
        <div className="sidebar-brand">
          <div className="brand-mark small" aria-hidden="true">
            <ShieldCheck size={18} strokeWidth={1.8} />
          </div>
          <div>
            <strong>Happy Chair</strong>
            <span>Platform Admin</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groupOrder.map(group => {
            const groupItems = visibleItems.filter(item => item.group === group)
            if (!groupItems.length) return null
            return (
              <div key={group} className="nav-group">
                <p>{group}</p>
                {groupItems.map(item => {
                  const Icon = item.icon
                  const isActive = item.id === activePage
                  return (
                    <button
                      key={item.id}
                      className={`nav-item${isActive ? ' active' : ''}`}
                      onClick={() => setActivePage(item.id)}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-avatar" aria-hidden="true">HC</div>
          <div>
            <strong>{roleLabels[session.role]}</strong>
            <span>{session.email}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="global-search-shell">
            <label className="global-search">
              <Search size={16} strokeWidth={1.8} />
              <input
                value={globalQuery}
                onChange={event => {
                  setGlobalQuery(event.target.value)
                  setSearchFocused(true)
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                placeholder="Search clients, contacts, support, venues, modules"
              />
            </label>
            {searchFocused && globalQuery.trim() && (
              <div className="global-search-results" role="listbox" aria-label="Global search results">
                {globalSearchResults.length ? globalSearchResults.map(result => (
                  <button key={result.id} onClick={() => selectGlobalSearchResult(result)}>
                    <span className="search-result-type">{result.type}</span>
                    <span>
                      <strong>{result.label}</strong>
                      <small>{result.detail}</small>
                    </span>
                  </button>
                )) : (
                  <div className="search-empty">No matching admin records.</div>
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <span className={`mock-badge data-source-${status}`} title={error ?? sourceLabel}>{sourceLabel}</span>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={17} strokeWidth={1.8} />
            </button>
            <button className="ghost-action" onClick={onLogout}>
              <LogOut size={16} strokeWidth={1.8} />
              Sign Out
            </button>
          </div>
        </header>
        {impersonationSession && (
          <section className="impersonation-banner" role="status">
            <div>
              <strong>Support View-As Active</strong>
              <span>
                {impersonationSession.targetName} / {impersonationSession.targetRole} / {impersonationSession.venueName ?? impersonationSession.organizationName}
              </span>
            </div>
            <div>
              <span>Reason: {impersonationSession.reason}</span>
              <button className="ghost-action" onClick={() => endImpersonationSession('manual')}>End Session</button>
            </div>
          </section>
        )}
        <div className="main-content">
          <Suspense fallback={<PageLoadingFallback />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
