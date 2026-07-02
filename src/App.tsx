import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import AppShell from './app/shell/AppShell'
import { PlatformDataProvider } from './lib/platform-data/PlatformDataContext'
import { internalAdminUsers } from './lib/mock-data/mockPlatform'
import { useManagedInternalAdminUsers } from './lib/admin-users/internalAccess'
import {
  buildInternalAuthAdapterStatus,
  getInternalAuthConfig,
  verifyPreviewInternalSession,
} from './lib/admin-users/internalAuthAdapter'
import { roleLabels, type AdminRole } from './lib/permissions/permissions'

export interface AdminSession {
  name: string
  email: string
  role: AdminRole
  adminUserId?: string
  accessMode?: 'managed_internal_preview'
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const managedAdminUsers = useManagedInternalAdminUsers(internalAdminUsers)
  const authConfig = getInternalAuthConfig(import.meta.env)
  const authAdapterStatus = buildInternalAuthAdapterStatus(authConfig, managedAdminUsers)
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('admin-owner')
  const [accessNotice, setAccessNotice] = useState('')
  const selectedAdminUser = managedAdminUsers.find(user => user.id === selectedAdminUserId) ?? managedAdminUsers[0]

  useEffect(() => {
    if (!selectedAdminUser && managedAdminUsers.length) {
      setSelectedAdminUserId(managedAdminUsers[0].id)
    }
  }, [managedAdminUsers, selectedAdminUser])

  const enterAdmin = () => {
    const result = verifyPreviewInternalSession(selectedAdminUserId, managedAdminUsers)
    if (!result.ok || !result.session) {
      setAccessNotice(result.message)
      return
    }
    sessionStorage.setItem('hc_platform_active_page', 'dashboard')
    setSession({
      name: result.session.name,
      email: result.session.email,
      role: result.session.role,
      adminUserId: result.session.adminUserId,
      accessMode: 'managed_internal_preview',
    })
  }

  if (session) {
    return (
      <PlatformDataProvider>
        <AppShell session={session} onLogout={() => setSession(null)} />
      </PlatformDataProvider>
    )
  }

  return (
    <main className="login-wrap">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <ShieldCheck size={23} strokeWidth={1.8} />
        </div>
        <p className="eyebrow">Internal Access</p>
        <h1 id="login-title">Happy Chair Platform Admin</h1>
        <p className="login-copy">Managed internal access preview for role, permission, and audit workflow testing.</p>

        <div className="login-access-preview">
          <div><span>Auth</span><strong>{authAdapterStatus.providerLabel}</strong></div>
          <div><span>Verify</span><strong>{authAdapterStatus.source === 'supabase' ? 'Supabase token' : 'Preview roster'}</strong></div>
          <div><span>Writes</span><strong>{authAdapterStatus.serverEndpointLabel}</strong></div>
        </div>

        <label className="field">
          <span>Internal admin user</span>
          <select
            value={selectedAdminUser?.id ?? ''}
            onChange={event => {
              setSelectedAdminUserId(event.target.value)
              setAccessNotice('')
            }}
          >
            {managedAdminUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} / {roleLabels[user.role]} / {user.status}
              </option>
            ))}
          </select>
        </label>

        {selectedAdminUser && (
          <div className="login-access-preview">
            <div><span>Email</span><strong>{selectedAdminUser.email}</strong></div>
            <div><span>Role</span><strong>{roleLabels[selectedAdminUser.role]}</strong></div>
            <div><span>Status</span><strong>{selectedAdminUser.status}</strong></div>
          </div>
        )}

        {accessNotice && <p className="warning-copy">{accessNotice}</p>}

        <button
          className="primary-action"
          onClick={enterAdmin}
        >
          Enter Platform Admin
        </button>
      </section>
    </main>
  )
}
