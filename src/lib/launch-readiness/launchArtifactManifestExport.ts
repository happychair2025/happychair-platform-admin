import type { AdminSession } from '../../App'
import type { LaunchArtifactManifestItem, LaunchArtifactManifestModel } from './launchArtifactManifest'
import { getLaunchArtifactStatusTone } from './launchArtifactManifest'

interface BuildLaunchArtifactManifestHtmlInput {
  manifest: LaunchArtifactManifestModel
  session: AdminSession
}

export function buildLaunchArtifactManifestHtml({ manifest, session }: BuildLaunchArtifactManifestHtmlInput) {
  const toneClass = getManifestToneClass(manifest.status)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Happy Chair Launch Artifact Manifest</title>
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
      --info: #0369a1;
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
      width: min(1120px, calc(100% - 48px));
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
      max-width: 780px;
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
    .tone-ok { background: var(--ok); }
    .tone-warn { background: var(--warn); }
    .tone-danger { background: var(--danger); }
    .tone-info { background: var(--info); }
    .meta-grid,
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .meta-card,
    .metric-card,
    .artifact-card,
    .gap-card,
    .guardrails {
      padding: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta-card span,
    .metric-card span,
    .artifact-card span,
    .gap-card span {
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
    .artifact-list,
    .gap-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .artifact-card,
    .gap-card {
      border-left: 5px solid var(--muted);
    }
    .artifact-card.tone-ok { border-left-color: var(--ok); }
    .artifact-card.tone-warn { border-left-color: var(--warn); }
    .artifact-card.tone-danger { border-left-color: var(--danger); }
    .artifact-top,
    .gap-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .artifact-card p,
    .gap-card p {
      margin-top: 9px;
      color: var(--muted);
      font-size: 13px;
    }
    .artifact-meta {
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
      .artifact-card, .gap-card, .meta-card, .metric-card, .guardrails { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      main { width: min(100% - 28px, 1120px); padding-top: 24px; }
      header,
      .meta-grid,
      .metric-grid,
      .artifact-meta { grid-template-columns: 1fr; }
      .status { justify-self: start; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Happy Chair Platform Admin</p>
        <h1>Launch Artifact Manifest</h1>
        <p class="summary">${escapeHtml(manifest.summary)} This artifact indexes the launch packet used for owner handoff and does not execute production changes.</p>
      </div>
      <span class="status ${toneClass}">${escapeHtml(manifest.status)}</span>
    </header>

    <section class="meta-grid" aria-label="Manifest metadata">
      ${metadataCard('Generated', formatDateTime(manifest.generatedAt))}
      ${metadataCard('Generated By', `${session.name} / ${session.email}`)}
      ${metadataCard('Actor Role', session.role)}
      ${metadataCard('Latest Snapshot', manifest.latestSnapshot ? `${manifest.latestSnapshot.decision} / ${formatDateTime(manifest.latestSnapshot.recordedAt)}` : 'Not recorded')}
    </section>

    <section class="metric-grid" aria-label="Manifest metrics">
      ${metricCard('Required Ready', `${manifest.readyRequiredCount}/${manifest.requiredCount}`)}
      ${metricCard('Blocked', manifest.blockedCount)}
      ${metricCard('Needs Review', manifest.reviewCount)}
      ${metricCard('Missing Required', manifest.missingRequiredCount)}
      ${metricCard('Exportable', manifest.exportableCount)}
      ${metricCard('Audit Backed', manifest.auditBackedCount)}
      ${metricCard('Gaps', manifest.gaps.length)}
      ${metricCard('Artifacts', manifest.artifacts.length)}
    </section>

    <section>
      <h2>Artifact Index</h2>
      <div class="artifact-list">
        ${manifest.artifacts.map(artifactCard).join('')}
      </div>
    </section>

    <section>
      <h2>Handoff Gaps</h2>
      ${manifest.gaps.length
        ? `<div class="gap-list">${manifest.gaps.map(gap => `
          <article class="gap-card">
            <div class="gap-top">
              <div>
                <span>${escapeHtml(gap.reference)}</span>
                <h3>${escapeHtml(gap.title)}</h3>
              </div>
              <span class="status ${gap.severity === 'Blocker' ? 'tone-danger' : 'tone-warn'}">${escapeHtml(gap.severity)}</span>
            </div>
            <p>${escapeHtml(gap.nextStep)}</p>
          </article>
        `).join('')}</div>`
        : '<p class="summary">No handoff gaps are currently waiting.</p>'}
    </section>

    <section>
      <h2>Operating Guardrails</h2>
      <div class="guardrails">
        <span>The manifest is an internal review index, not a production execution path.</span>
        <span>Any follow-up that changes client state, billing, modules, permissions, support records, messaging, or agent behavior still requires scoped permission checks, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
        <span>Keep this manifest with Launch Review Reports, Closure Snapshots, Executive Briefs, and Decision Packet exports used for final approval.</span>
      </div>
    </section>

    <footer>
      Generated ${escapeHtml(formatDateTime(manifest.generatedAt))}. Keep this artifact with the launch closure packet used for executive handoff.
    </footer>
  </main>
</body>
</html>`
}

export function getLaunchArtifactManifestFilename(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `happy-chair-launch-artifact-manifest-${stamp}.html`
}

function artifactCard(artifact: LaunchArtifactManifestItem) {
  const toneClass = `tone-${getLaunchArtifactStatusTone(artifact.status)}`

  return `
    <article class="artifact-card ${toneClass}">
      <div class="artifact-top">
        <div>
          <span>${escapeHtml(artifact.type)} / ${escapeHtml(artifact.reference)}</span>
          <h3>${escapeHtml(artifact.title)}</h3>
        </div>
        <span class="status ${toneClass}">${escapeHtml(artifact.status)}</span>
      </div>
      <p>${escapeHtml(artifact.evidence)}</p>
      <p>${escapeHtml(artifact.nextStep)}</p>
      <div class="artifact-meta">
        <div><span>Owner</span><strong>${escapeHtml(artifact.owner)}</strong></div>
        <div><span>Updated</span><strong>${escapeHtml(formatDateTime(artifact.updatedAt))}</strong></div>
        <div><span>Export</span><strong>${artifact.exportable ? 'Exportable' : 'Indexed'}</strong></div>
        <div><span>Audit</span><strong>${artifact.auditBacked ? 'Backed' : 'Pending'}</strong></div>
      </div>
    </article>
  `
}

function metadataCard(label: string, value: string | number) {
  return `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function metricCard(label: string, value: string | number) {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function getManifestToneClass(status: string) {
  if (status === 'Ready For Handoff') return 'tone-ok'
  if (status === 'Needs Owner Review') return 'tone-warn'
  return 'tone-danger'
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
