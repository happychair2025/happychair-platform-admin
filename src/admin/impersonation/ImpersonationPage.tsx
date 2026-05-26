import { AlertTriangle, Clock, Eye, LockKeyhole, ShieldCheck, TimerReset, UserRoundSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import type { ImpersonationTarget } from '../../lib/mock-data/mockPlatform'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission } from '../../lib/permissions/permissions'

export interface ActiveImpersonationSession {
  id: string
  targetId: string
  targetUserId: string
  targetName: string
  targetEmail: string
  targetRole: string
  organizationName: string
  propertyName?: string
  venueName?: string
  scopeLabel: string
  reason: string
  startedAt: string
  expiresAt: string
}

interface ImpersonationPageProps {
  session: AdminSession
  activeSession: ActiveImpersonationSession | null
  onStartSession: (target: ImpersonationTarget, reason: string) => void
  onEndSession: (source?: 'manual' | 'expired') => void
}

const quickReasons = [
  'Troubleshoot notification delivery.',
  'Verify setup checklist.',
  'Review support issue with client.',
  'Confirm module behavior during support call.',
]

function accountTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'At Risk' || status === 'Paused') return 'danger'
  if (status === 'Trial') return 'warn'
  return 'ok'
}

function sessionTone(status: string): 'ok' | 'warn' | 'info' {
  if (status === 'Expired') return 'warn'
  if (status === 'Active') return 'info'
  return 'ok'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ImpersonationPage({ session, activeSession, onStartSession, onEndSession }: ImpersonationPageProps) {
  const { data } = usePlatformData()
  const { impersonationSessions, impersonationTargets } = data
  const [selectedTargetId, setSelectedTargetId] = useState(impersonationTargets[0]?.id ?? '')
  const [reason, setReason] = useState(quickReasons[0])
  const [validationMessage, setValidationMessage] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const selectedTarget = useMemo(
    () => impersonationTargets.find(target => target.id === selectedTargetId) ?? impersonationTargets[0],
    [selectedTargetId],
  )
  const canStart = hasPermission(session.role, 'impersonation.start')
  const canUseDestructiveActions = hasPermission(session.role, 'impersonation.destructive_actions')
  const activeWindowMinutes = 15
  const targetRoles = new Set(impersonationTargets.map(target => target.role))
  const activeOrMockSessions = activeSession ? [{ status: 'Active' }, ...impersonationSessions] : impersonationSessions
  const blockedActionCount = impersonationSessions.reduce((total, item) => total + item.destructiveActionsBlocked, 0)

  const startSession = () => {
    const safeReason = reason.trim()
    if (!safeReason) {
      setValidationMessage('A support reason is required before starting impersonation.')
      return
    }
    if (!selectedTarget || !canStart) return
    setValidationMessage('')
    setActionNotice('')
    onStartSession(selectedTarget, safeReason)
  }

  const testDestructiveAction = () => {
    if (!activeSession) {
      setActionNotice('Start an impersonation session before testing action blocking.')
      return
    }

    if (!canUseDestructiveActions) {
      const result = runAdminAction(session, {
        permission: 'impersonation.destructive_actions',
        scope: activeSession.venueName ?? activeSession.organizationName,
        actionKey: 'impersonation.destructive_action_reviewed.mock',
        blockedActionKey: 'impersonation.destructive_action_blocked.mock',
        actionLabel: `destructive action while viewing as ${activeSession.targetName}`,
        severity: 'critical',
      })
      setActionNotice(result.ok ? 'Owner override recorded. Production still requires server confirmation and allowlisting.' : 'Blocked and audited. This role cannot run destructive actions during impersonation.')
      return
    }

    const result = runAdminAction(session, {
      permission: 'impersonation.destructive_actions',
      scope: activeSession.venueName ?? activeSession.organizationName,
      actionKey: 'impersonation.destructive_action_reviewed.mock',
      actionLabel: `Reviewed allowlisted destructive action while viewing as ${activeSession.targetName}`,
      severity: 'critical',
    })
    setActionNotice(result.ok ? 'Owner override recorded. Production still requires server confirmation and allowlisting.' : result.message)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Secure Support Access"
        title="Secure Impersonation"
        description="Reason-required internal view-as workflow with time limits, visible session state, destructive action blocking, and audit logging."
        action={
          activeSession ? (
            <button className="ghost-action" onClick={() => onEndSession('manual')}>
              <TimerReset size={16} strokeWidth={1.8} />
              End Session
            </button>
          ) : undefined
        }
      />

      <div className="metrics-grid compact">
        <MetricCard label="Active Sessions" value={String(activeSession ? 1 : 0)} delta="Current browser session" tone={activeSession ? 'warn' : 'ok'} icon={<Eye size={16} />} />
        <MetricCard label="Available Targets" value={String(impersonationTargets.length)} delta="Mock access contracts" tone="neutral" icon={<UserRoundSearch size={16} />} />
        <MetricCard label="Allowed Roles" value={String(targetRoles.size)} delta="Org, property, venue, staff" tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Blocked Actions" value={String(blockedActionCount)} delta="Historical mock sessions" tone={blockedActionCount ? 'warn' : 'ok'} icon={<LockKeyhole size={16} />} />
      </div>

      {activeSession && (
        <section className="status-band impersonation-session-panel">
          <div>
            <p className="eyebrow">Active View-As Session</p>
            <h2>{activeSession.targetName}</h2>
            <span>{activeSession.targetRole} / {activeSession.scopeLabel} / expires {formatDateTime(activeSession.expiresAt)}</span>
          </div>
          <div className="status-band-actions">
            <StatusPill label={activeSession.organizationName} tone="info" />
            <StatusPill label="Destructive actions blocked by default" tone="warn" />
            <button className="ghost-action" onClick={() => onEndSession('manual')}>End Session</button>
          </div>
        </section>
      )}

      <div className="impersonation-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Target Access</h2>
              <span>Select a customer account and record the support reason before starting.</span>
            </div>
            <StatusPill label={canStart ? 'Permissioned' : 'Blocked'} tone={canStart ? 'ok' : 'danger'} />
          </div>

          <div className="target-list">
            {impersonationTargets.map(target => (
              <button
                key={target.id}
                className={`target-card${selectedTarget?.id === target.id ? ' selected' : ''}`}
                onClick={() => setSelectedTargetId(target.id)}
              >
                <span>
                  <strong>{target.name}</strong>
                  <small>{target.email}</small>
                </span>
                <span>
                  <StatusPill label={target.role} tone="info" />
                  <StatusPill label={target.accountStatus} tone={accountTone(target.accountStatus)} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Session Review</p>
              <h2>{selectedTarget?.name}</h2>
            </div>
            <StatusPill label={`${activeWindowMinutes} min limit`} tone="warn" />
          </div>

          {selectedTarget && (
            <>
              <dl className="signal-list">
                <div><dt>Role</dt><dd>{selectedTarget.role}</dd></div>
                <div><dt>Scope</dt><dd>{selectedTarget.scopeLabel}</dd></div>
                <div><dt>Organization</dt><dd>{selectedTarget.organizationName}</dd></div>
                <div><dt>Last Active</dt><dd>{selectedTarget.lastActive}</dd></div>
              </dl>

              <div className="detail-section">
                <h3>Reason</h3>
                <div className="reason-button-grid">
                  {quickReasons.map(item => (
                    <button
                      key={item}
                      className={reason === item ? 'selected' : ''}
                      onClick={() => {
                        setReason(item)
                        setValidationMessage('')
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="field compact-field">
                  <span>Support reason</span>
                  <textarea
                    value={reason}
                    onChange={event => {
                      setReason(event.target.value)
                      setValidationMessage('')
                    }}
                  />
                </label>
                {validationMessage && <p className="warning-copy">{validationMessage}</p>}
              </div>

              <div className="safety-rule-list">
                <div>
                  <ShieldCheck size={16} strokeWidth={1.8} />
                  <span>Server-side permission check required before production activation.</span>
                </div>
                <div>
                  <Clock size={16} strokeWidth={1.8} />
                  <span>Session is time-limited and must record start and end events.</span>
                </div>
                <div>
                  <LockKeyhole size={16} strokeWidth={1.8} />
                  <span>Destructive actions are blocked unless explicitly allowlisted.</span>
                </div>
              </div>

              <button className="primary-action" disabled={!canStart || !selectedTarget || Boolean(activeSession)} onClick={startSession}>
                {activeSession ? 'Session Active' : 'Start Mock Session'}
              </button>
            </>
          )}
        </aside>
      </div>

      <section className="panel blocked-action-panel">
        <div>
          <p className="eyebrow">Destructive Action Guard</p>
          <h2>Impersonation cannot silently change customer state</h2>
          <span>Production actions that affect billing, modules, permissions, support records, or customer settings require permission checks, human confirmation, and audit entries.</span>
        </div>
        <button className="ghost-action" onClick={testDestructiveAction}>
          <AlertTriangle size={16} strokeWidth={1.8} />
          Test Action Guard
        </button>
        {actionNotice && <p className="warning-copy">{actionNotice}</p>}
      </section>

      <DataTable
        label="Session History"
        rows={impersonationSessions}
        columns={[
          {
            key: 'target',
            header: 'Target',
            sortable: true,
            searchValue: row => row.targetName,
            render: row => <strong>{row.targetName}</strong>,
          },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            searchValue: row => row.targetRole,
            render: row => row.targetRole,
          },
          {
            key: 'client',
            header: 'Client',
            sortable: true,
            searchValue: row => row.organizationName,
            render: row => row.venueName ?? row.organizationName,
          },
          {
            key: 'reason',
            header: 'Reason',
            searchValue: row => row.reason,
            render: row => row.reason,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={sessionTone(row.status)} />,
          },
        ]}
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Session Controls</h2>
            <span>{activeOrMockSessions.length} active or historical sessions in the current mock model.</span>
          </div>
        </div>
        <div className="session-control-grid">
          <div><StatusPill label="Reason Required" tone="ok" /><strong>Every session starts with a support reason.</strong></div>
          <div><StatusPill label="Visible Banner" tone="ok" /><strong>Active sessions are shown globally across the admin shell.</strong></div>
          <div><StatusPill label="Audit Log" tone="ok" /><strong>Start, end, and blocked action events are written immediately.</strong></div>
        </div>
      </section>
    </div>
  )
}
