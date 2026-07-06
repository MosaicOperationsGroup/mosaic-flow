// Renders the blog archive index — a list of past daily briefings, newest
// first. Reads from an inline <script type="application/json"
// id="page-data"> embedded at build time (see scripts/inline-content.mjs),
// same reasoning as briefing-page.js: never a separately fetched file.

async function main() {
  const root = document.getElementById('blog-root');

  let content;
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('no embedded page-data script found');
    content = JSON.parse(dataEl.textContent);
  } catch (e) {
    root.innerHTML = `
      <div class="wrap not-found">
        <p class="kicker">Not available</p>
        <h2>No archive yet.</h2>
        <p class="lede"><a class="back-link" href="../">Back to overview</a></p>
      </div>`;
    return;
  }

  const entries = (content.entries || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  const rowsHtml = entries.length
    ? entries.map(e => {
        const label = e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : e.date;
        return `
        <a class="brief-row brief-row-link" href="${escapeAttr(e.date)}/">
          <div class="brief-row-main">${escapeHtml(label)}</div>
          ${e.summary ? `<div class="brief-row-meta">${escapeHtml(e.summary)}</div>` : ''}
        </a>`;
      }).join('')
    : '<p class="no-oracle">No briefings archived yet.</p>';

  root.innerHTML = `
    <div class="wrap page-header">
      <a class="back-link reveal" href="../">Back to overview</a>
      <p class="kicker reveal">Archive</p>
      <h2 class="reveal">Past daily briefings.</h2>
      <p class="journey reveal">One entry per day the nightly sweep found ledger activity worth summarising.</p>
    </div>
    <section>
      <div class="wrap">
        <div class="subfeatures reveal">${rowsHtml}</div>
      </div>
    </section>`;

  document.title = 'Briefing archive · Mosaic';
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
function escapeAttr(s) { return escapeHtml(s); }

main();
