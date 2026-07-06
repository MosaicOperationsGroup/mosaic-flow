// Shared renderer for the daily briefing (briefing/index.html) and each
// archived day (blog/<date>/index.html) — same schema, same rendering.
// Reads content from an inline <script type="application/json"
// id="page-data"> embedded at build time (see scripts/inline-content.mjs)
// — never a separate fetched content.json, for the same reason as the
// feature pages: this page is encrypted as a whole, so the data must live
// inside the same HTML the gate protects.
//
// Content itself is compiled nightly by the sweep from real signals (the
// work log, the gate ledger, the open issue tracker) — see
// docs/orchestration/pipeline/sweep.md in the private repo. "Suggested
// next task" and "open questions" are judgment calls, not a mechanical
// scan; they are the sweep's honest read of the day, not a guarantee.

async function main() {
  const root = document.getElementById('briefing-root');
  const isArchive = root.dataset.mode === 'archive';

  let content;
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('no embedded page-data script found');
    content = JSON.parse(dataEl.textContent);
  } catch (e) {
    root.innerHTML = `
      <div class="wrap not-found">
        <p class="kicker">Not available</p>
        <h2>No briefing has been compiled yet.</h2>
        <p class="lede">The nightly sweep writes this after its first real run. <a class="back-link" href="../../">Back to overview</a></p>
      </div>`;
    return;
  }

  const dateLabel = content.date
    ? new Date(content.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'No briefing yet';

  const workDoneHtml = (content.workDone || []).length
    ? (content.workDone || []).map(w => `
      <div class="brief-row">
        <div class="brief-row-main">
          <span class="brief-issue">#${escapeHtml(w.issue)}</span>
          ${w.title ? escapeHtml(w.title) : ''}
        </div>
        <div class="brief-row-meta">${escapeHtml(w.who || '')} — ${escapeHtml(w.outcome || '')}</div>
      </div>`).join('')
    : '<p class="no-oracle">No gate-ledger activity this day.</p>';

  const nextTasksHtml = (content.nextTasks || []).length
    ? (content.nextTasks || []).map(t => `
      <div class="tile reveal">
        <p class="t-kicker">${escapeHtml(t.person)}</p>
        <h3>${escapeHtml(t.suggestion)}</h3>
        ${t.reasoning ? `<p>${escapeHtml(t.reasoning)}</p>` : ''}
      </div>`).join('')
    : '<p class="no-oracle">No suggestions compiled for this day.</p>';

  const questionsHtml = (content.openQuestions || []).length
    ? `<div class="outcomes">${(content.openQuestions || []).map(q => `
      <div class="outcome-row">
        <div class="outcome-crit">${escapeHtml(q.question)}</div>
        ${q.context ? `<div class="outcome-expected">${escapeHtml(q.context)}</div>` : ''}
        ${q.relatedIssue ? `<div class="outcome-enforced">Related: #${escapeHtml(q.relatedIssue)}</div>` : ''}
      </div>`).join('')}</div>`
    : '<p class="no-oracle">No open questions flagged for this day.</p>';

  root.innerHTML = `
    <div class="wrap page-header">
      <a class="back-link reveal" href="../../">Back to overview</a>
      <p class="kicker reveal">${isArchive ? 'Archived briefing' : 'Daily briefing'}</p>
      <h2 class="reveal">${escapeHtml(dateLabel)}</h2>
      ${content.summary ? `<p class="journey reveal">${escapeHtml(content.summary)}</p>` : ''}
      <p class="draft-notice reveal">Compiled by the nightly sweep — a judgment call on priorities and open items, not a guarantee.</p>
    </div>
    <section>
      <div class="wrap">
        <p class="kicker reveal">What was done</p>
        <h2 class="reveal">Today's activity.</h2>
        <div class="subfeatures reveal">${workDoneHtml}</div>
      </div>
    </section>
    <section>
      <div class="wrap">
        <p class="kicker reveal">Suggested next</p>
        <h2 class="reveal">One task per person.</h2>
        <div class="grid grid-3">${nextTasksHtml}</div>
      </div>
    </section>
    <section>
      <div class="wrap">
        <p class="kicker reveal">Worth deciding</p>
        <h2 class="reveal">Open questions.</h2>
        ${questionsHtml}
      </div>
    </section>`;

  document.title = `Briefing — ${dateLabel} · Mosaic`;

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
