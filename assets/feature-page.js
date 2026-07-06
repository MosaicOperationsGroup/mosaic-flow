// Shared renderer for per-feature detail pages (features/<slug>/index.html).
// Reads the feature's content from an inline <script type="application/json"
// id="page-data"> embedded in this page at build time (see
// scripts/inline-content.mjs in the repo root) — never a separate fetched
// content.json. That's deliberate: this page is encrypted by staticrypt as
// a whole, so the data must live inside the same HTML file the gate
// protects, not in a standalone file anyone could fetch directly and
// bypass the password entirely.
// Also reads the published status.json (for the live content_hash) to
// detect staleness. Content itself is curated/hand-authored — never
// generated from the private repo's specs.

async function main() {
  const root = document.getElementById('feature-root');
  const slug = root.dataset.slug;

  let content;
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('no embedded page-data script found');
    content = JSON.parse(dataEl.textContent);
  } catch (e) {
    root.innerHTML = `
      <div class="wrap not-found">
        <p class="kicker">Not found</p>
        <h2>This feature page isn't available yet.</h2>
        <p class="lede"><a class="back-link" href="../../">Back to overview</a></p>
      </div>`;
    return;
  }

  let currentHash = null;
  try {
    const r = await fetch('../../data/status.json', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      const gov = (d.governance || []).find(f => f.slug === slug);
      currentHash = gov ? gov.content_hash : null;
    }
  } catch (e) { /* status snapshot optional for rendering; staleness just won't show */ }

  const statusClass = content.status === 'shipped' ? 'shipped' : '';
  const pillClass = (s) => s === 'shipped' ? 'pill-shipped' : s === 'in-progress' ? 'pill-progress' : 'pill-planned';
  const pillLabel = (s) => s === 'shipped' ? 'Shipped' : s === 'in-progress' ? 'In progress' : 'Planned';

  const subfeaturesHtml = (content.subfeatures || []).map(sf => `
    <div class="subfeature-row">
      <div>
        <div class="subfeature-name">${escapeHtml(sf.name)}</div>
        ${sf.note ? `<div class="subfeature-note">${escapeHtml(sf.note)}</div>` : ''}
      </div>
      <span class="pill ${pillClass(sf.status)}">${pillLabel(sf.status)}</span>
    </div>`).join('');

  const screenshotHtml = content.screenshot ? `
    <div class="screenshot-frame reveal">
      <img src="${escapeAttr(content.screenshot.src)}" alt="${escapeAttr(content.screenshot.alt || '')}" loading="lazy">
    </div>
    ${content.screenshot.caption ? `<p class="screenshot-caption">${escapeHtml(content.screenshot.caption)}</p>` : ''}
  ` : '';

  const testing = content.testing || {};
  const outcomes = testing.expectedOutcomes || [];
  const outcomesHtml = outcomes.length ? `
    <div class="outcomes">
      ${outcomes.map(o => `
        <div class="outcome-row">
          <div class="outcome-crit">${escapeHtml(o.criterion)}</div>
          <div class="outcome-expected">${escapeHtml(o.expected)}</div>
          ${o.enforcedBy ? `<div class="outcome-enforced">Enforced by <code>${escapeHtml(o.enforcedBy)}</code></div>` : ''}
        </div>`).join('')}
    </div>`
    : '<p class="no-oracle">No test-oracle register exists for this feature yet — tracked as an open gap, same as the ✗ on the overview table.</p>';

  const testingSectionHtml = `
    <section>
      <div class="wrap">
        <p class="kicker reveal">Proof, not promises</p>
        <h2 class="reveal">How this is tested.</h2>
        ${testing.fixtureNote ? `<p class="fixture-note reveal">${escapeHtml(testing.fixtureNote)}</p>` : ''}
        ${outcomesHtml}
      </div>
    </section>`;

  const staleHtml = (currentHash && content.reconciledSourceHash && currentHash !== content.reconciledSourceHash)
    ? `<div class="stale-badge">The underlying documentation has changed since this page was last reviewed (${escapeHtml(content.reconciledAt || 'unknown date')}) — some details here may be out of date.</div>`
    : (content.reconciledAt ? `<p class="fresh-badge">Reviewed against current docs as of ${escapeHtml(content.reconciledAt)}.</p>` : '');

  root.innerHTML = `
    <div class="wrap page-header">
      <a class="back-link reveal" href="../../">Back to overview</a>
      <p class="kicker reveal">Feature</p>
      <h2 class="reveal">${escapeHtml(content.title)}</h2>
      <span class="status-line ${statusClass} reveal">${escapeHtml(content.statusLabel || content.status || '')}</span>
      <p class="journey reveal">${escapeHtml(content.journey)}</p>
      ${staleHtml}
      ${content.draftNotice !== false ? '<p class="draft-notice reveal">Draft page — under review before wider sharing.</p>' : ''}
    </div>
    <section>
      <div class="wrap">
        ${screenshotHtml}
        <div class="subfeatures reveal">
          <p class="kicker">Sub-features</p>
          <h2>Where each part stands.</h2>
          ${subfeaturesHtml}
        </div>
      </div>
    </section>
    ${testingSectionHtml}`;

  document.title = `${content.title} · Mosaic`;

  document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && !reduced) {
    document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 0; el.style.transform = 'translateY(20px)'; });
    gsap.to('.reveal', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

main();
