// Renderer for docs-insight/index.html — per-feature documentation coverage
// against the canonical feature-doc template. Reads content from an inline
// <script type="application/json" id="page-data"> embedded at build time
// (see scripts/inline-content.mjs) — never a separate fetched content.json,
// same reason as every other gated page on this site.
//
// This is a DETERMINISTIC structural signal computed by the private repo's
// scripts/doc-quality-report.mjs (section-header coverage against
// docs/features/_template), then hand-curated into this page's content.json
// — the same "curated, never auto-rendered from the private repo" pattern
// as every other feature page. It is a drift signal, not a quality verdict:
// see the legend and per-status notes rendered below.

const STATUS_LABEL = {
  conformant: 'Conformant',
  partial: 'Partial',
  'off-template': 'Off-template',
  thin: 'Thin',
  missing: 'Missing',
};

async function main() {
  const root = document.getElementById('docs-insight-root');

  let content;
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('no embedded page-data script found');
    content = JSON.parse(dataEl.textContent);
  } catch (e) {
    root.innerHTML = `
      <div class="wrap not-found">
        <p class="kicker">Not available</p>
        <h2>This page isn't available yet.</h2>
        <p class="lede"><a class="back-link" href="../">Back to overview</a></p>
      </div>`;
    return;
  }

  const tally = content.tally || {};
  const tallyHtml = ['conformant', 'partial', 'off-template', 'thin', 'missing'].map(s => `
    <div class="dq-tally-item reveal">
      <div class="n dq-${s}">${tally[s] ?? 0}</div>
      <div class="l">${STATUS_LABEL[s]}</div>
    </div>`).join('');

  const legendHtml = (content.legend || []).map(l => `
    <span class="dq-legend-item"><span class="dq-dot dq-${l.status}"></span>${escapeHtml(l.label)} — ${escapeHtml(l.note)}</span>
  `).join('');

  const featureHtml = (f) => {
    const chips = f.docs.map(d => `
      <div class="dq-chip dq-${d.status}">
        <span class="dq-chip-label">${escapeHtml(d.label)}</span>
        <span class="dq-chip-count">${d.present}/${d.expected}</span>
      </div>`).join('');

    const rows = f.docs.filter(d => (d.missing && d.missing.length) || d.note).map(d => `
      <div class="dq-detail-row">
        <span class="dq-detail-label">${escapeHtml(d.label)}</span>
        <span class="dq-detail-text">${d.note ? escapeHtml(d.note) : `missing: ${d.missing.map(escapeHtml).join(', ')}`}</span>
      </div>`).join('');

    const details = rows ? `
      <details class="dq-details">
        <summary class="dq-details-toggle"><span class="dq-chevron" aria-hidden="true">›</span> What's missing</summary>
        <div class="dq-details-body">${rows}</div>
      </details>` : '';

    // Review-signal badges. Adversarial review is the one that caps the
    // verdict, so it's always shown, positively or negatively.
    const badges = [
      f.adversarialReview
        ? '<span class="dq-badge dq-badge-good">Adversarially reviewed</span>'
        : '<span class="dq-badge dq-badge-bad">Not adversarially reviewed</span>',
      f.openDecisions > 0 ? `<span class="dq-badge">${f.openDecisions} open decision${f.openDecisions === 1 ? '' : 's'}</span>` : '',
      f.blockers > 0 ? `<span class="dq-badge">${f.blockers} blocker${f.blockers === 1 ? '' : 's'} / risk${f.blockers === 1 ? '' : 's'}</span>` : '',
      f.tbdCount > 0 ? `<span class="dq-badge">${f.tbdCount} TBDs</span>` : '',
      f.statusMismatch ? '<span class="dq-badge dq-badge-warn">Spec/progress status mismatch</span>' : '',
    ].filter(Boolean).join('');

    return `
      <div class="dq-feature reveal">
        <div class="dq-feature-head">
          <h3 class="dq-feature-name">${escapeHtml(f.feature)}</h3>
          <span class="dq-readiness">Readiness <strong>${f.readiness}</strong></span>
        </div>
        <p class="dq-verdict">${escapeHtml(f.verdict)}</p>
        <div class="dq-badges">${badges}</div>
        <div class="dq-coverage-row">
          <span class="dq-coverage-label">Template coverage</span>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${f.coverage}%"></div></div>
          <span class="dq-score">${f.coverage}%</span>
        </div>
        <div class="dq-chips">${chips}</div>
        ${details}
      </div>`;
  };

  const featuresHtml = (content.features || []).map(featureHtml).join('');
  const preConvergenceHtml = (content.preConvergence || []).map(featureHtml).join('');

  root.innerHTML = `
    <div class="wrap page-header dq-header">
      <a class="back-link reveal" href="../">Back to overview</a>
      <p class="kicker reveal">Detailed documentation insight</p>
      <h2 class="reveal">Readiness, highest first.</h2>
      <p class="journey reveal">${escapeHtml(content.intro || '')}</p>
      <div class="dq-tally reveal">${tallyHtml}</div>
      <div class="dq-legend reveal">${legendHtml}</div>
      <p class="dq-reviewed reveal">Reviewed as of ${escapeHtml(content.reconciledAt || 'unknown date')}.</p>
    </div>
    <section class="dq-list-section">
      <div class="wrap">
        ${featuresHtml}
      </div>
    </section>
    ${preConvergenceHtml ? `
    <section>
      <div class="wrap">
        <p class="kicker reveal">Not yet ranked</p>
        <h2 class="reveal">Pre-convergence features.</h2>
        <p class="lede reveal">${escapeHtml(content.preConvergenceNote || '')}</p>
        ${preConvergenceHtml}
      </div>
    </section>` : ''}`;

  document.title = 'Detailed documentation insight · Mosaic';

  document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && !reduced) {
    document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 0; el.style.transform = 'translateY(20px)'; });
    gsap.to('.reveal', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05 });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

main();
