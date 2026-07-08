// Renderer for top-priorities/index.html. Reads content from an inline
// <script type="application/json" id="page-data"> embedded at build time
// (see scripts/inline-content.mjs) — never a separate fetched content.json,
// same reason as every other gated page on this site.
//
// No ranking logic exists yet — this renders an honest "not compiled" state
// until one does, same pattern as briefing/ before the nightly sweep's
// first real run.

async function main() {
  const root = document.getElementById('top-priorities-root');

  let content;
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('no embedded page-data script found');
    content = JSON.parse(dataEl.textContent);
  } catch (e) {
    content = { summary: 'This page has not been compiled yet.', priorities: [] };
  }

  const priorities = content.priorities || [];
  const listHtml = priorities.length
    ? priorities.map(p => `
      <div class="brief-row reveal">
        <div class="brief-row-main">${escapeHtml(p.title)}</div>
        <div class="brief-row-meta">${escapeHtml(p.reasoning || '')}</div>
      </div>`).join('')
    : '<p class="no-oracle">No priorities compiled yet — tracked as an open gap, not a hidden one.</p>';

  root.innerHTML = `
    <div class="wrap page-header">
      <a class="back-link reveal" href="../">Back to overview</a>
      <p class="kicker reveal">Top priorities</p>
      <h2 class="reveal">What matters most, next.</h2>
      <p class="journey reveal">${escapeHtml(content.summary || '')}</p>
    </div>
    <section>
      <div class="wrap">
        <div class="subfeatures reveal">${listHtml}</div>
      </div>
    </section>`;

  document.title = 'Top priorities · Mosaic';

  document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && !reduced) {
    document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 0; el.style.transform = 'translateY(20px)'; });
    gsap.to('.reveal', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

main();
