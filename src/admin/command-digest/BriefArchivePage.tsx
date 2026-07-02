import {
  Archive,
  CheckCircle2,
  Clipboard,
  FileText,
  GitBranch,
  ListChecks,
  Newspaper,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalAgentRuns } from '../../lib/agents/localAgentRuntime'
import { buildAttentionQueue } from '../../lib/attention/attentionQueue'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import {
  appendCommandBriefFollowUp,
  appendCommandBriefReviewEvent,
  buildCommandBriefExportPacket,
  buildCommandBriefSnapshot,
  commandBriefArchiveBoundaryRule,
  formatBriefCurrency,
  getBriefPostureTone,
  getBriefSnapshotStatusTone,
  summarizeCommandBriefArchive,
  useLocalCommandBriefSnapshots,
  type CommandBriefSnapshot,
} from '../../lib/command-digest/briefArchive'
import { buildCommandCadence } from '../../lib/command-cadence/commandCadence'
import {
  buildCommandDigest,
  buildCommandDigestHeadlines,
  buildCommandDigestNarrative,
  summarizeCommandDigest,
  useLocalCommandDigestStates,
} from '../../lib/command-digest/commandDigest'
import { roleLabels } from '../../lib/permissions/permissions'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { savedViewTemplates, useLocalSavedViews } from '../../lib/saved-views/savedViews'
import { buildResponsePlaybooks, useLocalResponsePlaybookStates } from '../../lib/watch-center/responsePlaybooks'
import { buildSlaEscalationBoard, useLocalSlaEscalationStates } from '../../lib/watch-center/slaEscalations'
import { buildWatchSignals, useLocalWatchSignalStates } from '../../lib/watch-center/watchCenter'
import { buildWatchRules, useLocalWatchRuleStates } from '../../lib/watch-center/watchRules'

interface BriefArchivePageProps {
  session: AdminSession
  onOpenCommandDigest?: () => void
  onOpenActionRequests?: () => void
}

export default function BriefArchivePage({ session, onOpenCommandDigest, onOpenActionRequests }: BriefArchivePageProps) {
  const { data, sourceLabel } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAgentRuns = useLocalAgentRuns()
  const localAuditEvents = useLocalAuditEvents()
  const [localSavedViews] = useLocalSavedViews()
  const [localWatchStates] = useLocalWatchSignalStates()
  const [localRuleStates] = useLocalWatchRuleStates()
  const [localPlaybookStates] = useLocalResponsePlaybookStates()
  const [localSlaStates] = useLocalSlaEscalationStates()
  const [localDigestStates] = useLocalCommandDigestStates()
  const [snapshots, setSnapshots] = useLocalCommandBriefSnapshots()
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')

  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])

  const agentEvents = useMemo(() => {
    const localEvents = localAgentRuns.flatMap(run => run.generatedEvents)
    return [
      ...localEvents,
      ...data.agentEvents.filter(event => !localEvents.some(localEvent => localEvent.id === event.id)),
    ]
  }, [data.agentEvents, localAgentRuns])

  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])

  const savedViews = useMemo(() => [
    ...localSavedViews,
    ...savedViewTemplates.filter(template => !localSavedViews.some(localView => localView.id === template.id)),
  ], [localSavedViews])

  const attentionItems = useMemo(() => buildAttentionQueue(data, actionRequests, agentEvents), [actionRequests, agentEvents, data])
  const cadenceItems = useMemo(() => buildCommandCadence(attentionItems), [attentionItems])
  const watchSignals = useMemo(() => buildWatchSignals({
    data,
    actionRequests,
    auditEvents,
    savedViews,
    localStates: localWatchStates,
  }), [actionRequests, auditEvents, data, localWatchStates, savedViews])
  const watchRules = useMemo(() => buildWatchRules(localRuleStates), [localRuleStates])
  const responsePlaybooks = useMemo(() => buildResponsePlaybooks(localPlaybookStates), [localPlaybookStates])
  const slaItems = useMemo(() => buildSlaEscalationBoard({
    signals: watchSignals,
    rules: watchRules,
    playbooks: responsePlaybooks,
    localStates: localSlaStates,
  }), [localSlaStates, responsePlaybooks, watchRules, watchSignals])
  const digestItems = useMemo(() => buildCommandDigest({
    data,
    attentionItems,
    cadenceItems,
    slaItems,
    localStates: localDigestStates,
  }), [attentionItems, cadenceItems, data, localDigestStates, slaItems])
  const digestSummary = useMemo(() => summarizeCommandDigest(digestItems, data), [data, digestItems])
  const digestHeadlines = useMemo(() => buildCommandDigestHeadlines(digestSummary, digestItems), [digestItems, digestSummary])
  const digestNarrative = useMemo(() => buildCommandDigestNarrative(digestSummary, digestItems), [digestItems, digestSummary])
  const archiveSummary = useMemo(() => summarizeCommandBriefArchive(snapshots), [snapshots])
  const selectedSnapshot = snapshots.find(snapshot => snapshot.id === selectedId) ?? snapshots[0]
  const exportPacket = selectedSnapshot ? buildCommandBriefExportPacket(selectedSnapshot) : ''

  const createSnapshot = () => {
    const result = runAdminAction(session, {
      permission: 'dashboard.view',
      scope: 'Command Digest',
      actionKey: 'command_brief_archive.snapshot_created.mock',
      actionLabel: 'Created command brief archive snapshot',
      severity: digestSummary.posture === 'Critical' ? 'warning' : 'notice',
      metadata: {
        posture: digestSummary.posture,
        readinessScore: digestSummary.readinessScore,
        itemCount: digestSummary.total,
        criticalCount: digestSummary.critical,
        mutationApplied: false,
        localOnly: true,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const snapshot = buildCommandBriefSnapshot({
      sourceLabel,
      generatedBy: session.name,
      generatedByRole: roleLabels[session.role],
      summary: digestSummary,
      narrative: digestNarrative,
      headlines: digestHeadlines,
      items: digestItems,
      actionRequests,
    })
    const snapshotWithAudit = {
      ...snapshot,
      reviewEvents: snapshot.reviewEvents.map(event => event.action === 'Created'
        ? { ...event, auditEventId: result.auditEvent.id }
        : event),
    }

    setSnapshots(current => [snapshotWithAudit, ...current.filter(item => item.id !== snapshotWithAudit.id)].slice(0, 60))
    setSelectedId(snapshotWithAudit.id)
    setNotice(`${snapshotWithAudit.title} saved locally and recorded in Audit Logs.`)
  }

  const markSnapshot = (snapshot: CommandBriefSnapshot, action: 'Reviewed' | 'Export Ready') => {
    const result = runAdminAction(session, {
      permission: action === 'Export Ready' ? 'reports.view' : 'dashboard.view',
      scope: snapshot.title,
      actionKey: `command_brief_archive.${sanitizeActionKey(snapshot.id)}.${sanitizeActionKey(action)}.mock`,
      actionLabel: `${action} command brief snapshot: ${snapshot.title}`,
      severity: snapshot.posture === 'Critical' ? 'warning' : 'notice',
      metadata: {
        snapshotId: snapshot.id,
        snapshotStatus: snapshot.status,
        nextStatus: action,
        posture: snapshot.posture,
        readinessScore: snapshot.readinessScore,
        mutationApplied: false,
        localOnly: true,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const nextSnapshot = appendCommandBriefReviewEvent(snapshot, {
      action,
      actor: session.name,
      actorRole: roleLabels[session.role],
      note: action === 'Export Ready'
        ? 'Snapshot packet marked export ready for executive review.'
        : 'Snapshot reviewed by command owner.',
      auditEventId: result.auditEvent.id,
    })
    setSnapshots(current => current.map(item => item.id === snapshot.id ? nextSnapshot : item))
    setNotice(`${snapshot.title} marked ${action.toLowerCase()} and recorded in Audit Logs.`)
  }

  const copyPacket = async (snapshot: CommandBriefSnapshot) => {
    const result = runAdminAction(session, {
      permission: 'reports.view',
      scope: snapshot.title,
      actionKey: `command_brief_archive.${sanitizeActionKey(snapshot.id)}.packet_copied.mock`,
      actionLabel: `Prepared export packet for ${snapshot.title}`,
      severity: 'notice',
      metadata: {
        snapshotId: snapshot.id,
        packetFormat: 'markdown',
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    try {
      await navigator.clipboard.writeText(buildCommandBriefExportPacket(snapshot))
      setNotice(`${snapshot.title} export packet copied and audit recorded.`)
    } catch {
      setNotice(`${snapshot.title} export packet is ready below. Clipboard access was unavailable in this browser.`)
    }
  }

  const queueArchiveFollowUp = (snapshot: CommandBriefSnapshot) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Brief archive follow-up: ${snapshot.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: snapshot.title }),
      reason: `${snapshot.title} is ${snapshot.posture}. Review export packet and confirm owners for ${snapshot.decisionCount} decision items.`,
      rollbackNotes: 'No production state changes from Brief Archive. Follow-up remains governed by Admin Action Request approval and server-side execution rules.',
      severity: snapshot.posture === 'Critical' ? 'warning' : 'notice',
      metadata: {
        commandBriefSnapshotId: snapshot.id,
        source: 'brief_archive',
        posture: snapshot.posture,
        readinessScore: snapshot.readinessScore,
        itemCount: snapshot.itemCount,
      },
      handlerKey: 'server.command_brief_archive.follow_up',
      handlerLabel: 'Brief archive follow-up handler',
      handlerDescription: `Server-side placeholder for archived brief follow-up: ${snapshot.title}.`,
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const nextSnapshot = appendCommandBriefFollowUp(snapshot, result.request)
    setSnapshots(current => current.map(item => item.id === snapshot.id ? nextSnapshot : item))
    setNotice(`${snapshot.title} follow-up queued in Action Requests.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Executive Record"
        title="Brief Archive"
        description="Saved Command Digest snapshots with review history, follow-up trace, and export-ready executive packets."
        action={(
          <button className="ghost-action" onClick={createSnapshot}>
            <Plus size={15} strokeWidth={1.8} />
            Create Snapshot
          </button>
        )}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Snapshots" value={String(archiveSummary.total)} delta="Local executive records" tone="neutral" icon={<Archive size={16} />} />
        <MetricCard label="Export Ready" value={String(archiveSummary.exportReady)} delta="Packet-ready reviews" tone={archiveSummary.exportReady ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
        <MetricCard label="Reviewed" value={String(archiveSummary.reviewed)} delta="Owner review history" tone={archiveSummary.reviewed ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Open Follow-Ups" value={String(archiveSummary.openFollowUps)} delta={`${archiveSummary.archivedItems} archived items`} tone={archiveSummary.openFollowUps ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
      </div>

      <section className={`panel command-brief-archive-panel tone-${getBriefPostureTone(archiveSummary.latestPosture)}`}>
        <div>
          <p className="eyebrow">Archive Boundary</p>
          <h2>Snapshots preserve the brief; Action Requests control execution</h2>
          <span>{commandBriefArchiveBoundaryRule}</span>
        </div>
        <div className="command-brief-archive-meta">
          <StatusPill label={`${digestSummary.posture} current`} tone={getBriefPostureTone(digestSummary.posture)} />
          <strong>{digestSummary.total} current items</strong>
        </div>
      </section>

      <div className="command-brief-archive-layout">
        <DataTable
          label="Brief Snapshots"
          rows={snapshots}
          pageSize={8}
          emptyTitle="No command brief snapshots saved yet."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getBriefSnapshotStatusTone(row.status)} />,
            },
            {
              key: 'title',
              header: 'Brief',
              sortable: true,
              searchValue: row => `${row.title} ${row.narrative}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            {
              key: 'posture',
              header: 'Posture',
              sortable: true,
              searchValue: row => row.posture,
              render: row => <StatusPill label={row.posture} tone={getBriefPostureTone(row.posture)} />,
            },
            {
              key: 'items',
              header: 'Items',
              sortable: true,
              searchValue: row => String(row.itemCount).padStart(3, '0'),
              render: row => <strong>{row.itemCount}</strong>,
            },
            {
              key: 'risk',
              header: 'Risk',
              sortable: true,
              searchValue: row => String(row.criticalCount).padStart(3, '0'),
              render: row => <div><strong>{row.criticalCount} critical</strong><span className="cell-subtext">{formatBriefCurrency(row.revenueAtRisk)} at risk</span></div>,
            },
            {
              key: 'generated',
              header: 'Generated',
              sortable: true,
              searchValue: row => row.generatedAt,
              render: row => <div><strong>{formatDateTime(row.generatedAt)}</strong><span className="cell-subtext">{row.generatedByRole}</span></div>,
            },
          ]}
        />

        <aside className="detail-panel command-brief-detail-panel">
          {selectedSnapshot ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Export Packet</p>
                  <h2>{selectedSnapshot.title}</h2>
                </div>
                <StatusPill label={selectedSnapshot.status} tone={getBriefSnapshotStatusTone(selectedSnapshot.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Posture</span><strong>{selectedSnapshot.posture}</strong></div>
                <div><span>Readiness</span><strong>{selectedSnapshot.readinessScore}%</strong></div>
                <div><span>Decisions</span><strong>{selectedSnapshot.decisionCount}</strong></div>
                <div><span>Generated</span><strong>{formatDateTime(selectedSnapshot.generatedAt)}</strong></div>
              </div>

              <section className={`panel command-brief-status-panel tone-${getBriefPostureTone(selectedSnapshot.posture)}`}>
                <div>
                  <p className="eyebrow">Narrative</p>
                  <h2>{selectedSnapshot.narrative}</h2>
                  <span>{selectedSnapshot.generatedBy} / {selectedSnapshot.sourceLabel}</span>
                </div>
                <div className="command-brief-status-meta">
                  <StatusPill label={`${selectedSnapshot.handoffCount} handoffs`} tone={selectedSnapshot.handoffCount ? 'warn' : 'ok'} />
                  <strong>{selectedSnapshot.topItems.length} packet items</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Top Decisions</h3>
                <div className="settings-rule-list">
                  {selectedSnapshot.topItems.slice(0, 5).map(item => (
                    <div key={item.id}>
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      <strong>{item.title} / {item.decision} / {item.owner}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Follow-Up Trace</h3>
                <div className="settings-rule-list">
                  {selectedSnapshot.followUpTrace.length ? selectedSnapshot.followUpTrace.slice(0, 5).map(trace => (
                    <div key={trace.id}>
                      <ListChecks size={16} strokeWidth={1.8} />
                      <strong>{trace.status}: {trace.title}</strong>
                    </div>
                  )) : (
                    <div>
                      <ListChecks size={16} strokeWidth={1.8} />
                      <strong>No follow-ups were attached when this brief was archived.</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Review History</h3>
                <div className="settings-rule-list">
                  {selectedSnapshot.reviewEvents.map(event => (
                    <div key={event.id}>
                      <ShieldCheck size={16} strokeWidth={1.8} />
                      <strong>{event.action} / {event.actor}: {event.note}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" onClick={() => markSnapshot(selectedSnapshot, 'Reviewed')}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    Mark Reviewed
                  </button>
                  <button className="ghost-action" onClick={() => markSnapshot(selectedSnapshot, 'Export Ready')}>
                    <FileText size={15} strokeWidth={1.8} />
                    Mark Export Ready
                  </button>
                  <button className="ghost-action" onClick={() => void copyPacket(selectedSnapshot)}>
                    <Clipboard size={15} strokeWidth={1.8} />
                    Copy Packet
                  </button>
                  <button className="ghost-action" onClick={() => queueArchiveFollowUp(selectedSnapshot)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Queue Follow-Up
                  </button>
                  {onOpenCommandDigest && (
                    <button className="ghost-action" onClick={onOpenCommandDigest}>
                      <Newspaper size={15} strokeWidth={1.8} />
                      Open Digest
                    </button>
                  )}
                  {onOpenActionRequests && (
                    <button className="ghost-action" onClick={onOpenActionRequests}>
                      <Send size={15} strokeWidth={1.8} />
                      Action Requests
                    </button>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Packet Preview</h3>
                <pre className="command-brief-packet-preview">{exportPacket}</pre>
              </div>
            </>
          ) : (
            <div className="empty-state compact">
              Create a snapshot to archive the current Command Digest and generate an export packet.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function sanitizeActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
