import {
  Activity,
  Bell,
  Bot,
  Building2,
  CircleDollarSign,
  CreditCard,
  FileBarChart,
  Flag,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPinned,
  PackageCheck,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Store,
  UserPlus,
  UserRoundSearch,
  Wrench,
  ScrollText,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import AgentsPage from '../../admin/agents/AgentsPage'
import AuditLogsPage from '../../admin/audit/AuditLogsPage'
import ClientsPage from '../../admin/clients/ClientsPage'
import ExecutiveDashboard from '../../admin/dashboard/ExecutiveDashboard'
import SystemHealthPage from '../../admin/health/SystemHealthPage'
import ImpersonationPage, { type ActiveImpersonationSession } from '../../admin/impersonation/ImpersonationPage'
import ModulesPage from '../../admin/modules/ModulesPage'
import PlaceholderPage from '../../admin/placeholder/PlaceholderPage'
import RegistrationsPage from '../../admin/registrations/RegistrationsPage'
import RevenuePage from '../../admin/revenue/RevenuePage'
import SupportCenterPage from '../../admin/support/SupportCenterPage'
import VenueSupportPage from '../../admin/support/VenueSupportPage'
import TroubleshootingPage from '../../admin/troubleshooting/TroubleshootingPage'
import UsageAnalyticsPage from '../../admin/usage/UsageAnalyticsPage'
import { appendAuditEvent } from '../../lib/audit/auditLog'
import type { ImpersonationTarget } from '../../lib/mock-data/mockPlatform'
import { hasPermission, roleLabels, type PermissionKey } from '../../lib/permissions/permissions'

type PageId =
  | 'dashboard'
  | 'registrations'
  | 'revenue'
  | 'clients'
  | 'organizations'
  | 'properties'
  | 'venues'
  | 'modules'
  | 'usage'
  | 'health'
  | 'support'
  | 'troubleshooting'
  | 'impersonation'
  | 'audit'
  | 'agents'
  | 'reports'
  | 'billing'
  | 'feature-flags'
  | 'system-health'
  | 'settings'

interface NavItem {
  id: PageId
  label: string
  permission: PermissionKey
  icon: typeof LayoutDashboard
  group: 'Command' | 'Clients' | 'Operations' | 'Company'
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', permission: 'dashboard.view', icon: LayoutDashboard, group: 'Command' },
  { id: 'registrations', label: 'Registrations', permission: 'registrations.view', icon: UserPlus, group: 'Command' },
  { id: 'revenue', label: 'Revenue', permission: 'revenue.view', icon: CircleDollarSign, group: 'Command' },
  { id: 'clients', label: 'Clients', permission: 'clients.view', icon: Building2, group: 'Clients' },
  { id: 'organizations', label: 'Organizations', permission: 'organizations.view', icon: Building2, group: 'Clients' },
  { id: 'properties', label: 'Properties', permission: 'properties.view', icon: MapPinned, group: 'Clients' },
  { id: 'venues', label: 'Venues / Outlets', permission: 'venues.view', icon: Store, group: 'Clients' },
  { id: 'modules', label: 'Modules', permission: 'modules.view', icon: PackageCheck, group: 'Operations' },
  { id: 'usage', label: 'Usage Analytics', permission: 'usage.view', icon: Activity, group: 'Operations' },
  { id: 'health', label: 'Client Health', permission: 'health.view', icon: HeartPulse, group: 'Operations' },
  { id: 'support', label: 'Support Center', permission: 'support.view', icon: LifeBuoy, group: 'Operations' },
  { id: 'troubleshooting', label: 'Troubleshooting', permission: 'troubleshooting.view', icon: Wrench, group: 'Operations' },
  { id: 'impersonation', label: 'Impersonation', permission: 'impersonation.start', icon: UserRoundSearch, group: 'Operations' },
  { id: 'audit', label: 'Audit Logs', permission: 'audit.view', icon: ScrollText, group: 'Operations' },
  { id: 'agents', label: 'AI Agents', permission: 'agents.view', icon: Bot, group: 'Company' },
  { id: 'reports', label: 'Reports', permission: 'reports.view', icon: FileBarChart, group: 'Company' },
  { id: 'billing', label: 'Billing', permission: 'billing.view', icon: CreditCard, group: 'Company' },
  { id: 'feature-flags', label: 'Feature Flags', permission: 'feature_flags.view', icon: Flag, group: 'Company' },
  { id: 'system-health', label: 'System Health', permission: 'health.view', icon: ServerCog, group: 'Company' },
  { id: 'settings', label: 'Admin Settings', permission: 'settings.view', icon: Settings, group: 'Company' },
]

const groupOrder: NavItem['group'][] = ['Command', 'Clients', 'Operations', 'Company']

interface AppShellProps {
  session: AdminSession
  onLogout: () => void
}

export default function AppShell({ session, onLogout }: AppShellProps) {
  const visibleItems = useMemo(() => navItems.filter(item => hasPermission(session.role, item.permission)), [session.role])
  const [firstItem] = visibleItems
  const getInitialPage = (): PageId => {
    const saved = sessionStorage.getItem('hc_platform_active_page') as PageId | null
    if (saved && visibleItems.some(item => item.id === saved)) return saved
    return firstItem?.id ?? 'dashboard'
  }
  const [activePage, setActivePageState] = useState<PageId>(getInitialPage)
  const [impersonationSession, setImpersonationSession] = useState<ActiveImpersonationSession | null>(null)

  const setActivePage = (page: PageId) => {
    sessionStorage.setItem('hc_platform_active_page', page)
    setActivePageState(page)
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

    appendAuditEvent({
      actor: session.name,
      actorRole: roleLabels[session.role],
      scope: target.venueName ?? target.organizationName,
      actionKey: 'impersonation.started.mock',
      actionLabel: `Started view-as session for ${target.name}`,
      severity: 'warning',
    })
    setImpersonationSession(nextSession)
  }

  const endImpersonationSession = (source: 'manual' | 'expired' = 'manual') => {
    if (!impersonationSession) return
    appendAuditEvent({
      actor: session.name,
      actorRole: roleLabels[session.role],
      scope: impersonationSession.venueName ?? impersonationSession.organizationName,
      actionKey: source === 'expired' ? 'impersonation.expired.mock' : 'impersonation.ended.mock',
      actionLabel: `${source === 'expired' ? 'Expired' : 'Ended'} view-as session for ${impersonationSession.targetName}`,
      severity: source === 'expired' ? 'warning' : 'notice',
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
      case 'registrations':
        return <RegistrationsPage />
      case 'revenue':
        return <RevenuePage />
      case 'clients':
      case 'organizations':
      case 'properties':
        return <ClientsPage session={session} />
      case 'venues':
        return <VenueSupportPage session={session} />
      case 'support':
        return <SupportCenterPage session={session} />
      case 'troubleshooting':
        return <TroubleshootingPage session={session} />
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
        return <ModulesPage session={session} />
      case 'usage':
        return <UsageAnalyticsPage />
      case 'system-health':
        return <SystemHealthPage />
      case 'audit':
        return <AuditLogsPage />
      case 'agents':
        return <AgentsPage session={session} />
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
          <label className="global-search">
            <Search size={16} strokeWidth={1.8} />
            <input placeholder="Search clients, venues, modules" />
          </label>
          <div className="topbar-actions">
            <span className="mock-badge">Mock data</span>
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
        <div className="main-content">{renderPage()}</div>
      </main>
    </div>
  )
}
