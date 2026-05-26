import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import AppShell from './app/shell/AppShell'
import { roleLabels, type AdminRole } from './lib/permissions/permissions'

export interface AdminSession {
  name: string
  email: string
  role: AdminRole
}

const roleOptions: AdminRole[] = [
  'owner',
  'admin',
  'support_lead',
  'support_agent',
  'client_success',
  'finance',
  'marketing',
  'engineering',
  'read_only',
]

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [email, setEmail] = useState('owner@happychair.internal')
  const [role, setRole] = useState<AdminRole>('owner')

  const enterAdmin = () => {
    sessionStorage.setItem('hc_platform_active_page', 'dashboard')
    setSession({ name: 'Team Happy Chair', email, role })
  }

  if (session) {
    return <AppShell session={session} onLogout={() => setSession(null)} />
  }

  return (
    <main className="login-wrap">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <ShieldCheck size={23} strokeWidth={1.8} />
        </div>
        <p className="eyebrow">Internal Access</p>
        <h1 id="login-title">Happy Chair Admin</h1>
        <p className="login-copy">Mock Phase 1 access for internal role and permission testing.</p>

        <label className="field">
          <span>Email</span>
          <input value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={role} onChange={event => setRole(event.target.value as AdminRole)}>
            {roleOptions.map(option => (
              <option key={option} value={option}>{roleLabels[option]}</option>
            ))}
          </select>
        </label>

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
