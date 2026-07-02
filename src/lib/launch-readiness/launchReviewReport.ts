import type { AdminSession } from '../../App'
import type { LaunchEvidenceLedger, LaunchEvidenceEntry } from './launchEvidenceLedger'
import type {
  LaunchGate,
  LaunchGateArea,
  LaunchReadinessModel,
} from './launchReadiness'

interface BuildLaunchReviewReportInput {
  model: LaunchReadinessModel
  session: AdminSession
  sourceLabel: string
  dataSourceKind: string
  dataStatus: string
  evidenceLedger?: LaunchEvidenceLedger
}

const areaOrder: LaunchGateArea[] = ['Data', 'Security', 'Operations', 'Support', 'Finance', 'Agents', 'Integrations']

export function buildLaunchReviewReportHtml({
  model,
  session,
  sourceLabel,
  dataSourceKind,
  dataStatus,
  evidenceLedger,
}: BuildLaunchReviewReportInput) {
  const generatedAt = new Date().toISOString()
  const blockers = model.gates.filter(gate => gate.status === 'Blocked')
  const watchItems = model.gates.filter(gate => gate.status === 'Watch')
  const readyItems = model.gates.filter(gate => gate.status === 'Ready')
  const gatesByArea = areaOrder.map(area => ({
    area,
    gates: model.gates.filter(gate => gate.area === area),
  })).filter(group => group.gates.length)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Happy Chair Launch Review Report</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5f6f83;
      --line: #d7dee8;
      --panel: #f8fafc;
      --ready: #047857;
      --watch: #b45309;
      --blocked: #b91c1c;
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
      width: min(1080px, calc(100% - 48px));
      margin: 0 auto;
      padding: 42px 0 56px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 142px;
      gap: 28px;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--line);
    }
    h1, h2, h3, p { margin: 0; }
    h1 {
      font-size: 34px;
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
    .score {
      min-height: 142px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 6px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-left: 6px solid ${statusColor(model.status)};
      border-radius: 8px;
    }
    .score strong {
      font-size: 42px;
      line-height: 1;
    }
    .score span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-grid,
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .meta-card,
    .metric-card,
    .gate-card {
      padding: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta-card span,
    .metric-card span,
    .gate-card span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-card strong,
    .metric-card strong {
      display: block;
      margin-top: 5px;
      overflow-wrap: anywhere;
      font-size: 18px;
    }
    .metric-card strong {
      font-size: 28px;
    }
    .status {
      display: inline-block;
      padding: 3px 8px;
      color: #ffffff;
      background: var(--muted);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .status.ready { background: var(--ready); }
    .status.watch { background: var(--watch); }
    .status.blocked { background: var(--blocked); }
    .gate-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .gate-card {
      border-left: 5px solid var(--muted);
    }
    .gate-card.ready { border-left-color: var(--ready); }
    .gate-card.watch { border-left-color: var(--watch); }
    .gate-card.blocked { border-left-color: var(--blocked); }
    .gate-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .gate-top div {
      min-width: 0;
    }
    .gate-top strong {
      display: block;
      font-size: 15px;
    }
    .gate-card p {
      margin-top: 9px;
      color: var(--muted);
      font-size: 13px;
    }
    .gate-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .guardrails {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      padding: 14px;
      background: #ecfeff;
      border: 1px solid #a5f3fc;
      border-radius: 8px;
      color: #164e63;
      font-size: 13px;
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
      .gate-card { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { width: min(100% - 28px, 1080px); padding-top: 24px; }
      header,
      .meta-grid,
      .metric-grid,
      .gate-meta { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Happy Chair Platform Admin</p>
        <h1>Launch Review Report</h1>
        <p class="summary">${escapeHtml(model.summary)} This report is generated from the current Launch Gate model and is intended for internal readiness review.</p>
      </div>
      <div class="score">
        <strong>${model.score}</strong>
        <span>${escapeHtml(model.status)}</span>
      </div>
    </header>

    <section class="meta-grid" aria-label="Report metadata">
      ${metadataCard('Generated', formatDateTime(generatedAt))}
      ${metadataCard('Generated By', `${session.name} / ${session.email}`)}
      ${metadataCard('Data Source', sourceLabel)}
      ${metadataCard('Provider State', `${dataSourceKind} / ${dataStatus}`)}
    </section>

    <section class="metric-grid" aria-label="Launch summary">
      ${metricCard('Ready Gates', model.readyCount)}
      ${metricCard('Watch Gates', model.watchCount)}
      ${metricCard('Blocked Gates', model.blockedCount)}
      ${metricCard('Critical Gates', model.criticalCount)}
    </section>

    <section>
      <h2>Executive Decision</h2>
      <div class="guardrails">
        <strong>${escapeHtml(getDecisionLine(model.status))}</strong>
        <span>Production-changing work remains outside this report. Use Admin Action Requests for server-side handlers, permission checks, human approval, audit writes, and rollback notes.</span>
      </div>
    </section>

    ${gateSection('Launch Blockers', blockers, 'No launch blockers are currently detected.')}
    ${gateSection('Owner Watch Items', watchItems, 'No watch items are currently detected.')}
    ${gateSection('Ready Gates', readyItems, 'No ready gates are currently detected.')}

    <section>
      <h2>Gate Detail By Area</h2>
      ${gatesByArea.map(group => `
        <h3>${escapeHtml(group.area)}</h3>
        <div class="gate-list">
          ${group.gates.map(gateCard).join('')}
        </div>
      `).join('')}
    </section>

    <section>
      <h2>Evidence Ledger</h2>
      ${evidenceLedger?.entries.length
        ? `<div class="gate-list">${evidenceLedger.entries.map(evidenceCard).join('')}</div>`
        : '<p class="summary">No launch evidence records are currently available.</p>'}
    </section>

    <section>
      <h2>Audit Posture</h2>
      <div class="guardrails">
        <span>Export permission checked: reports.export.</span>
        <span>Export action should be recorded in the local audit ledger by Platform Admin.</span>
        <span>Customer state, billing state, module entitlements, permissions, support records, and agent actions are not changed by this report.</span>
      </div>
    </section>

    <footer>
      Generated ${escapeHtml(formatDateTime(generatedAt))}. Mock and partial-read states must be treated as internal review signals until Supabase read-only views and server handlers are approved.
    </footer>
  </main>
</body>
</html>`
}

function evidenceCard(entry: LaunchEvidenceEntry) {
  const statusClass = entry.status.toLowerCase()
  return `
    <article class="gate-card ${statusClass}">
      <div class="gate-top">
        <div>
          <strong>${escapeHtml(entry.type)} / ${escapeHtml(entry.reference)}</strong>
          <p>${escapeHtml(entry.evidence)}</p>
        </div>
        <span class="status ${statusClass}">${escapeHtml(entry.status)}</span>
      </div>
      <p><strong>Next step:</strong> ${escapeHtml(entry.nextStep)}</p>
      <div class="gate-meta">
        <div><span>Source</span><strong>${escapeHtml(entry.source)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(entry.owner)}</strong></div>
        <div><span>Severity</span><strong>${escapeHtml(entry.severity)}</strong></div>
        <div><span>Date</span><strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong></div>
      </div>
    </article>
  `
}

export function getLaunchReviewReportFilename(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `happy-chair-launch-review-${stamp}.html`
}

function gateSection(title: string, gates: LaunchGate[], emptyMessage: string) {
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${gates.length
        ? `<div class="gate-list">${gates.map(gateCard).join('')}</div>`
        : `<p class="summary">${escapeHtml(emptyMessage)}</p>`}
    </section>
  `
}

function gateCard(gate: LaunchGate) {
  const statusClass = gate.status.toLowerCase()
  return `
    <article class="gate-card ${statusClass}">
      <div class="gate-top">
        <div>
          <strong>${escapeHtml(gate.title)}</strong>
          <p>${escapeHtml(gate.evidence)}</p>
        </div>
        <span class="status ${statusClass}">${escapeHtml(gate.status)}</span>
      </div>
      <p><strong>Next step:</strong> ${escapeHtml(gate.nextStep)}</p>
      <div class="gate-meta">
        <div><span>Area</span><strong>${escapeHtml(gate.area)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(gate.owner)}</strong></div>
        <div><span>Severity</span><strong>${escapeHtml(gate.severity)}</strong></div>
        <div><span>Surface</span><strong>${escapeHtml(gate.linkedSurface)}</strong></div>
      </div>
    </article>
  `
}

function metadataCard(label: string, value: string) {
  return `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function metricCard(label: string, value: number) {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`
}

function statusColor(status: string) {
  if (status === 'Blocked') return 'var(--blocked)'
  if (status === 'Watch') return 'var(--watch)'
  return 'var(--ready)'
}

function getDecisionLine(status: string) {
  if (status === 'Blocked') return 'Launch is blocked until critical gates are cleared.'
  if (status === 'Watch') return 'Launch can proceed only after owner review of watch items.'
  return 'Launch is ready for executive approval.'
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
