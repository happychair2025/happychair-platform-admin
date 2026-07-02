import type { AdminSession } from '../../App'
import type { LaunchDecisionPacket } from './launchDecisionPackets'

interface BuildLaunchDecisionPacketHtmlInput {
  packet: LaunchDecisionPacket
  session: AdminSession
  sourceLabel: string
  dataSourceKind: string
  dataStatus: string
}

export function buildLaunchDecisionPacketHtml({
  packet,
  session,
  sourceLabel,
  dataSourceKind,
  dataStatus,
}: BuildLaunchDecisionPacketHtmlInput) {
  const generatedAt = new Date().toISOString()
  const statusClass = getStatusClass(packet.status)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(packet.title)} - Launch Decision Packet</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5f6f83;
      --line: #d7dee8;
      --panel: #f8fafc;
      --drafted: #2563eb;
      --queued: #b45309;
      --approved: #047857;
      --assigned: #0e7490;
      --deferred: #b45309;
      --accent: #0891b2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main {
      width: min(960px, calc(100% - 48px));
      margin: 0 auto;
      padding: 42px 0 56px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 28px;
      align-items: start;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--line);
    }
    h1, h2, h3, p { margin: 0; }
    h1 {
      font-size: 32px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    h2 {
      margin-top: 30px;
      font-size: 20px;
    }
    h3 {
      font-size: 15px;
    }
    .eyebrow {
      margin-bottom: 7px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .summary {
      margin-top: 12px;
      max-width: 760px;
      color: var(--muted);
      font-size: 15px;
    }
    .status {
      display: inline-block;
      padding: 7px 12px;
      color: #ffffff;
      background: var(--muted);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .status.drafted { background: var(--drafted); }
    .status.queued { background: var(--queued); }
    .status.approved { background: var(--approved); }
    .status.assigned { background: var(--assigned); }
    .status.deferred { background: var(--deferred); }
    .meta-grid,
    .field-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .meta-card,
    .field-card,
    .callout,
    .narrative {
      padding: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta-card span,
    .field-card span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-card strong,
    .field-card strong {
      display: block;
      margin-top: 5px;
      overflow-wrap: anywhere;
      font-size: 15px;
    }
    .decision-list,
    .guardrail-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .narrative {
      border-left: 5px solid ${statusColor(packet.status)};
    }
    .narrative p {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .callout {
      display: grid;
      gap: 8px;
      background: #ecfeff;
      border-color: #a5f3fc;
      color: #164e63;
      font-size: 13px;
    }
    .callout.warning {
      background: #fff7ed;
      border-color: #fed7aa;
      color: #7c2d12;
    }
    footer {
      margin-top: 34px;
      padding-top: 18px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      font-size: 12px;
    }
    @media print {
      main { width: 100%; padding: 24px; }
      .narrative, .callout, .field-card, .meta-card { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { width: min(100% - 28px, 960px); padding-top: 24px; }
      header,
      .meta-grid,
      .field-grid { grid-template-columns: 1fr; }
      .status { justify-self: start; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Happy Chair Platform Admin</p>
        <h1>Launch Decision Packet</h1>
        <p class="summary">${escapeHtml(packet.title)} is packaged for internal review, approval routing, and launch evidence. This artifact is not a production mutation.</p>
      </div>
      <span class="status ${statusClass}">${escapeHtml(packet.status)}</span>
    </header>

    <section class="meta-grid" aria-label="Packet metadata">
      ${metadataCard('Generated', formatDateTime(generatedAt))}
      ${metadataCard('Generated By', `${session.name} / ${session.email}`)}
      ${metadataCard('Data Source', sourceLabel)}
      ${metadataCard('Provider State', `${dataSourceKind} / ${dataStatus}`)}
      ${metadataCard('Packet Owner', packet.owner)}
      ${metadataCard('Reference', packet.reference)}
    </section>

    <section>
      <h2>Decision Summary</h2>
      <div class="decision-list">
        <article class="narrative">
          <h3>${escapeHtml(packet.type)} / ${escapeHtml(packet.reference)}</h3>
          <p>${escapeHtml(packet.evidence)}</p>
        </article>
        <article class="narrative">
          <h3>Next Decision</h3>
          <p>${escapeHtml(packet.nextDecision)}</p>
        </article>
        <article class="narrative">
          <h3>Server Action Recommendation</h3>
          <p>${escapeHtml(packet.serverActionRecommendation)}</p>
        </article>
      </div>
    </section>

    <section class="field-grid" aria-label="Approval context">
      ${metadataCard('Approval Path', packet.approvalPath.join(' / '), 'field-card')}
      ${metadataCard('Created', formatDateTime(packet.createdAt), 'field-card')}
      ${metadataCard('Updated', packet.updatedAt ? formatDateTime(packet.updatedAt) : 'Not updated', 'field-card')}
      ${metadataCard('Drafted By', `${packet.generatedBy} / ${packet.generatedByRole}`, 'field-card')}
      ${metadataCard('Actor Email', packet.generatedByEmail, 'field-card')}
      ${metadataCard('Audit Event', packet.auditEventId, 'field-card')}
    </section>

    ${reviewSection(packet)}

    <section>
      <h2>Rollback Notes</h2>
      <div class="callout warning">
        <strong>${escapeHtml(packet.rollbackNotes)}</strong>
        <span>If follow-up changes client state, billing, modules, permissions, support records, messaging, or agent actions, the work must be executed by an approved server-side handler with its own rollback plan.</span>
      </div>
    </section>

    <section>
      <h2>Required Guardrails</h2>
      <div class="guardrail-list">
        <div class="callout"><span>Permission checks remain required before approval, queueing, export, or execution.</span></div>
        <div class="callout"><span>Human confirmation is required before any production-changing follow-up unless explicitly allowlisted.</span></div>
        <div class="callout"><span>Every meaningful admin, support, finance, impersonation, module, feature flag, troubleshooting, export, or agent action must write an audit record.</span></div>
      </div>
    </section>

    <footer>
      Generated ${escapeHtml(formatDateTime(generatedAt))}. Mock and partial-read states must be treated as internal review signals until Supabase read-only views and server handlers are approved.
    </footer>
  </main>
</body>
</html>`
}

export function getLaunchDecisionPacketFilename(packet: LaunchDecisionPacket, date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  const slug = `${packet.reference}-${packet.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'decision-packet'

  return `happy-chair-launch-decision-packet-${slug}-${stamp}.html`
}

function metadataCard(label: string, value: string, className = 'meta-card') {
  return `<div class="${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function getStatusClass(status: LaunchDecisionPacket['status']) {
  if (status === 'Approved For Follow-Up') return 'approved'
  if (status === 'Assigned Follow-Up') return 'assigned'
  if (status === 'Deferred') return 'deferred'
  if (status === 'Queued For Review') return 'queued'
  return 'drafted'
}

function statusColor(status: LaunchDecisionPacket['status']) {
  if (status === 'Approved For Follow-Up') return 'var(--approved)'
  if (status === 'Assigned Follow-Up') return 'var(--assigned)'
  if (status === 'Deferred') return 'var(--deferred)'
  if (status === 'Queued For Review') return 'var(--queued)'
  return 'var(--drafted)'
}

function reviewSection(packet: LaunchDecisionPacket) {
  if (!packet.reviewedAt) {
    return `
    <section>
      <h2>Packet Review</h2>
      <div class="callout">
        <span>This packet has not been reviewed yet. Approval, deferral, or follow-up assignment must be recorded in Platform Admin before it is treated as launch evidence.</span>
      </div>
    </section>
  `
  }

  return `
    <section>
      <h2>Packet Review</h2>
      <div class="decision-list">
        <article class="narrative">
          <h3>Recorded Review</h3>
          <p>${escapeHtml(packet.reviewNote ?? 'Review recorded without additional notes.')}</p>
        </article>
      </div>
      <section class="field-grid" aria-label="Review metadata">
        ${metadataCard('Reviewed', formatDateTime(packet.reviewedAt), 'field-card')}
        ${metadataCard('Reviewed By', `${packet.reviewedBy ?? 'Unknown'} / ${packet.reviewedByRole ?? 'Unknown role'}`, 'field-card')}
        ${metadataCard('Follow-Up Owner', packet.followUpOwner ?? packet.owner, 'field-card')}
      </section>
    </section>
  `
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
