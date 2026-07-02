import type { LaunchClosureSnapshot } from './launchClosureSnapshots'

export function buildLaunchClosureSnapshotHtml(snapshot: LaunchClosureSnapshot) {
  const statusClass = getDecisionClass(snapshot.decision)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Happy Chair Launch Closure Snapshot</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5f6f83;
      --line: #d7dee8;
      --panel: #f8fafc;
      --go: #047857;
      --conditional: #b45309;
      --nogo: #b91c1c;
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
    .decision {
      display: inline-block;
      padding: 8px 12px;
      color: #ffffff;
      background: var(--muted);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .decision.go { background: var(--go); }
    .decision.conditional { background: var(--conditional); }
    .decision.nogo { background: var(--nogo); }
    .meta-grid,
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .meta-card,
    .metric-card,
    .check-card,
    .guardrails {
      padding: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta-card span,
    .metric-card span,
    .check-card span {
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
      font-size: 16px;
    }
    .metric-card strong {
      font-size: 28px;
    }
    .check-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .check-card {
      border-left: 5px solid var(--muted);
    }
    .check-card.complete { border-left-color: var(--go); }
    .check-card.review { border-left-color: var(--conditional); }
    .check-card.blocked { border-left-color: var(--nogo); }
    .check-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
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
    .status.complete { background: var(--go); }
    .status.review { background: var(--conditional); }
    .status.blocked { background: var(--nogo); }
    .check-card p {
      margin-top: 9px;
      color: var(--muted);
      font-size: 13px;
    }
    .check-meta {
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
      .check-card, .meta-card, .metric-card, .guardrails { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { width: min(100% - 28px, 1080px); padding-top: 24px; }
      header,
      .meta-grid,
      .metric-grid,
      .check-meta { grid-template-columns: 1fr; }
      .decision { justify-self: start; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Happy Chair Platform Admin</p>
        <h1>Launch Closure Snapshot</h1>
        <p class="summary">${escapeHtml(snapshot.summary)} This artifact records the closure state at the time of review and does not execute production changes.</p>
      </div>
      <span class="decision ${statusClass}">${escapeHtml(snapshot.decision)}</span>
    </header>

    <section class="meta-grid" aria-label="Snapshot metadata">
      ${metadataCard('Recorded', formatDateTime(snapshot.recordedAt))}
      ${metadataCard('Recorded By', `${snapshot.recordedBy} / ${snapshot.recordedByEmail}`)}
      ${metadataCard('Actor Role', snapshot.recordedByRole)}
      ${metadataCard('Audit Event', snapshot.auditEventId)}
      ${metadataCard('Generated', formatDateTime(snapshot.generatedAt))}
      ${metadataCard('Data Source', snapshot.sourceLabel)}
      ${metadataCard('Provider State', `${snapshot.dataSourceKind} / ${snapshot.dataStatus}`)}
      ${metadataCard('Launch Status', `${snapshot.readinessScore}% / ${snapshot.launchStatus}`)}
    </section>

    <section class="metric-grid" aria-label="Closure metrics">
      ${metricCard('Required Complete', `${snapshot.completeRequiredCount}/${snapshot.requiredCount}`)}
      ${metricCard('Blocked Checks', snapshot.blockedCount)}
      ${metricCard('Needs Review', snapshot.reviewCount)}
      ${metricCard('Open Actions', snapshot.openActionCount)}
      ${metricCard('Missing Approvals', snapshot.missingApprovalCount)}
      ${metricCard('Unresolved Deferrals', snapshot.unresolvedDeferralCount)}
      ${metricCard('Evidence Items', snapshot.evidenceItemCount)}
      ${metricCard('Ready For Sign-Off', snapshot.readyForExecutiveSignOff ? 'Yes' : 'No')}
    </section>

    <section>
      <h2>Closure Guardrails</h2>
      <div class="guardrails">
        <span>Go/no-go snapshots are decision records only.</span>
        <span>Production-changing follow-up must go through scoped permissions, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
        <span>Mock, fallback, and partial-read states are internal review signals until Supabase read-only views and server handlers are approved.</span>
      </div>
    </section>

    <section>
      <h2>Checklist Evidence</h2>
      <div class="check-list">
        ${snapshot.checklist.map(checkCard).join('')}
      </div>
    </section>

    <footer>
      Snapshot recorded ${escapeHtml(formatDateTime(snapshot.recordedAt))}. Keep this artifact with the Launch Review Report and any decision packet exports used for executive approval.
    </footer>
  </main>
</body>
</html>`
}

export function getLaunchClosureSnapshotFilename(snapshot: LaunchClosureSnapshot, date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  const slug = snapshot.decision
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `happy-chair-launch-closure-${slug}-${stamp}.html`
}

function checkCard(item: LaunchClosureSnapshot['checklist'][number]) {
  const statusClass = getCheckStatusClass(item.status)

  return `
    <article class="check-card ${statusClass}">
      <div class="check-top">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.evidence)}</p>
        </div>
        <span class="status ${statusClass}">${escapeHtml(item.status)}</span>
      </div>
      <p><strong>Next step:</strong> ${escapeHtml(item.nextStep)}</p>
      <div class="check-meta">
        <div><span>Category</span><strong>${escapeHtml(item.category)}</strong></div>
        <div><span>Owner</span><strong>${escapeHtml(item.owner)}</strong></div>
        <div><span>Reference</span><strong>${escapeHtml(item.reference)}</strong></div>
        <div><span>Required</span><strong>${item.required ? 'Yes' : 'No'}</strong></div>
      </div>
    </article>
  `
}

function metadataCard(label: string, value: string) {
  return `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function metricCard(label: string, value: string | number) {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function getDecisionClass(decision: LaunchClosureSnapshot['decision']) {
  if (decision === 'No Go') return 'nogo'
  if (decision === 'Conditional Go') return 'conditional'
  return 'go'
}

function getCheckStatusClass(status: LaunchClosureSnapshot['checklist'][number]['status']) {
  if (status === 'Blocked') return 'blocked'
  if (status === 'Needs Review') return 'review'
  return 'complete'
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
