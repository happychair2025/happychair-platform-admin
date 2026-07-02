import type { AdminSession } from '../../App'
import type { LaunchExecutiveBriefModel, LaunchExecutiveBriefPoint } from './launchExecutiveBrief'

interface BuildLaunchExecutiveBriefHtmlInput {
  brief: LaunchExecutiveBriefModel
  session: AdminSession
}

export function buildLaunchExecutiveBriefHtml({ brief, session }: BuildLaunchExecutiveBriefHtmlInput) {
  const toneClass = getToneClass(brief.recommendation)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Happy Chair Executive Launch Brief</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5f6f83;
      --line: #d7dee8;
      --panel: #f8fafc;
      --ok: #047857;
      --warn: #b45309;
      --danger: #b91c1c;
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
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 28px;
      align-items: start;
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
    .recommendation,
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
    .tone-ok { background: var(--ok); }
    .tone-warn { background: var(--warn); }
    .tone-danger { background: var(--danger); }
    .meta-grid,
    .source-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .meta-card,
    .source-card,
    .point-card,
    .guardrails {
      padding: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta-card span,
    .source-card span,
    .point-card span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-card strong,
    .source-card strong {
      display: block;
      margin-top: 5px;
      overflow-wrap: anywhere;
      font-size: 16px;
    }
    .point-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .point-card {
      border-left: 5px solid var(--muted);
    }
    .point-card.tone-ok { border-left-color: var(--ok); background: var(--panel); }
    .point-card.tone-warn { border-left-color: var(--warn); background: var(--panel); }
    .point-card.tone-danger { border-left-color: var(--danger); background: var(--panel); }
    .point-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .point-card p {
      margin-top: 9px;
      color: var(--muted);
      font-size: 13px;
    }
    .point-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .guardrails {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      background: #ecfeff;
      border-color: #a5f3fc;
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
      .point-card, .meta-card, .source-card, .guardrails { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { width: min(100% - 28px, 1080px); padding-top: 24px; }
      header,
      .meta-grid,
      .source-grid,
      .point-meta { grid-template-columns: 1fr; }
      .recommendation { justify-self: start; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Happy Chair Platform Admin</p>
        <h1>Executive Launch Brief</h1>
        <p class="summary">${escapeHtml(brief.narrative)}</p>
      </div>
      <span class="recommendation ${toneClass}">${escapeHtml(brief.recommendation)}</span>
    </header>

    <section class="meta-grid" aria-label="Brief metadata">
      ${metadataCard('Generated', formatDateTime(brief.generatedAt))}
      ${metadataCard('Generated By', `${session.name} / ${session.email}`)}
      ${metadataCard('Actor Role', session.role)}
      ${metadataCard('Blockers', brief.blockerCount)}
      ${metadataCard('Needs Review', brief.reviewCount)}
      ${metadataCard('Snapshots', brief.snapshotCount)}
    </section>

    <section>
      <h2>Talking Points</h2>
      <div class="point-list">
        ${brief.talkingPoints.map(pointCard).join('')}
      </div>
    </section>

    <section>
      <h2>Required Decisions</h2>
      ${brief.requiredDecisions.length
        ? `<div class="point-list">${brief.requiredDecisions.map(pointCard).join('')}</div>`
        : '<p class="summary">No required decisions are currently waiting.</p>'}
    </section>

    <section>
      <h2>Brief Sources</h2>
      <div class="source-grid">
        ${brief.sources.map(source => `<div class="source-card"><span>${escapeHtml(source.label)}</span><strong>${escapeHtml(source.value)}</strong></div>`).join('')}
      </div>
    </section>

    <section>
      <h2>Operating Guardrails</h2>
      <div class="guardrails">
        <span>This brief summarizes internal launch evidence and does not mutate production data.</span>
        <span>Any follow-up that changes client state, billing, modules, permissions, support records, messaging, or agent behavior still requires approved server-side handlers and audit records.</span>
        <span>Use this brief with Launch Review Reports, Closure Snapshots, and Decision Packet exports for executive approval.</span>
      </div>
    </section>

    <footer>
      Generated ${escapeHtml(formatDateTime(brief.generatedAt))}. Keep this artifact with the launch closure packet used for final review.
    </footer>
  </main>
</body>
</html>`
}

export function getLaunchExecutiveBriefFilename(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `happy-chair-executive-launch-brief-${stamp}.html`
}

function pointCard(point: LaunchExecutiveBriefPoint) {
  return `
    <article class="point-card tone-${point.tone}">
      <div class="point-top">
        <div>
          <strong>${escapeHtml(point.title)}</strong>
          <p>${escapeHtml(point.body)}</p>
        </div>
        <span class="status tone-${point.tone}">${escapeHtml(point.tone)}</span>
      </div>
      <div class="point-meta">
        <div><span>Owner</span><strong>${escapeHtml(point.owner)}</strong></div>
        <div><span>Reference</span><strong>${escapeHtml(point.reference)}</strong></div>
      </div>
    </article>
  `
}

function metadataCard(label: string, value: string | number) {
  return `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function getToneClass(recommendation: string) {
  if (recommendation === 'Hold') return 'tone-danger'
  if (recommendation === 'Proceed With Conditions') return 'tone-warn'
  return 'tone-ok'
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
