// docs-insight consumer. Schema 2 is machine-published from a default-deny
// private boundary; labels and explanatory copy are defined here, publicly.
// The isolated legacy adapter remains only for the consumer-first rollout.

const STATUS_LABEL = {
  conformant: 'Conformant',
  partial: 'Partial',
  off_template: 'Off-template',
  'off-template': 'Off-template',
  thin: 'Thin',
  missing: 'Missing',
};
const FEATURE_LABEL = {
  'task-management': 'Task management',
  calendar: 'Calendar',
  'self-evaluation': 'Self evaluation',
  analytics: 'Analytics',
  'roles-and-permissions': 'Roles & permissions',
  'cover-module': 'Cover module',
  'reporting-gradebook': 'Reporting & gradebook',
  'lesson-observations': 'Lesson observations',
  'school-development-action-planning': 'School development & action planning',
  'onboarding-and-school-config': 'Onboarding and school config',
  'career-counseling': 'Career counseling',
  'emar-calendar': 'EMAR calendar',
};
const DOC_LABEL = {
  readme: 'README',
  product_spec: 'Product spec',
  subfeatures: 'Subfeatures',
  progress: 'Progress',
  expected_outcomes: 'Expected outcomes',
  version_map: 'Version map',
  data_model_adr: 'Data-model ADR',
  ux_adr: 'UX ADR',
};
const READINESS_LABEL = {
  build_ready: 'Build-ready',
  reviewed_gaps_remain: 'Reviewed; named gaps remain',
  structurally_complete_unreviewed: 'Structurally complete; review pending',
  drafting_substantial_unreviewed: 'Substantial draft; review pending',
  drafting_early: 'Early drafting',
};
const JUDGMENT_LABEL = {
  substantively_complete: 'Substantively complete',
  usable_with_named_gaps: 'Usable with named gaps',
  drafting: 'Drafting',
  not_build_ready: 'Not build-ready',
};
const FRESHNESS_LABEL = {
  current: 'Judgment current',
  docs_changed: 'Documentation changed since judgment',
  newer_unverified_report: 'Newer report awaiting independent verification',
  docs_changed_and_newer_unverified_report: 'Documentation changed and a newer report awaits verification',
  never_verified: 'No independently verified judgment',
};
const V2_DOC_KEYS = Object.keys(DOC_LABEL);
const V2_STATUSES = ['conformant', 'partial', 'off_template', 'thin', 'missing'];

function unavailable(root) {
  root.innerHTML = `
    <div class="wrap not-found">
      <p class="kicker">Not available</p>
      <h2>Documentation insight is temporarily unavailable.</h2>
      <p class="lede">The published data version is unsupported or invalid. No partial data has been shown.</p>
      <p class="lede"><a class="back-link" href="../">Back to overview</a></p>
    </div>`;
}

function schema2(content) {
  if (!content || content.schema !== 2 || !Array.isArray(content.features) || content.features.length > 12) throw new Error('unsupported schema');
  const seen = new Set();
  const features = content.features.map((f) => {
    if (!FEATURE_LABEL[f.slug] || seen.has(f.slug) || !['ranked', 'pre_convergence'].includes(f.cohort)) throw new Error('invalid feature');
    seen.add(f.slug);
    if (!READINESS_LABEL[f.readinessVerdict] || !FRESHNESS_LABEL[f.judgmentState]) throw new Error('invalid enum');
    if (!Array.isArray(f.docs) || f.docs.length !== 8) throw new Error('invalid docs');
    const docs = f.docs.map((d) => {
      if (!DOC_LABEL[d.key] || !V2_STATUSES.includes(d.status)) throw new Error('invalid doc');
      return { ...d, label: DOC_LABEL[d.key], status: d.status.replace('_', '-') };
    });
    if (new Set(docs.map((d) => d.key)).size !== 8 || V2_DOC_KEYS.some((key) => !docs.some((d) => d.key === key))) throw new Error('invalid doc set');
    if (f.judgmentState === 'never_verified' && f.judgment !== undefined) throw new Error('invalid judgment state');
    if (f.judgmentState !== 'never_verified' && (!f.judgment || !JUDGMENT_LABEL[f.judgment.verdict])) throw new Error('missing verified judgment');
    return {
      feature: FEATURE_LABEL[f.slug],
      cohort: f.cohort,
      coverage: f.coverage,
      readiness: f.readiness,
      verdict: READINESS_LABEL[f.readinessVerdict],
      adversarialReview: f.adversarialReview === 'present',
      openDecisions: f.openDecisionCount,
      blockers: f.blockerCount,
      tbdCount: f.tbdCount,
      statusMismatch: f.statusAlignment === 'mismatched',
      docs,
      judgmentState: f.judgmentState,
      judgment: f.judgment && {
        score: f.judgment.score,
        verdict: JUDGMENT_LABEL[f.judgment.verdict],
        reviewed: f.judgment.reviewed,
      },
    };
  });
  const tally = Object.fromEntries(V2_STATUSES.map((status) => [status.replace('_', '-'), content.tally[status]]));
  return {
    generatedAt: content.generatedAt,
    tally,
    features: features.filter((f) => f.cohort === 'ranked'),
    preConvergence: features.filter((f) => f.cohort === 'pre_convergence'),
    intro: 'A deterministic view of how completely each feature follows the standard documentation structure.',
    judgmentNote: 'Structural readiness and independently verified substantive judgment are separate signals.',
  };
}

function legacy(content) {
  if (!content || content.schema !== undefined || !Array.isArray(content.features) || !content.tally) throw new Error('unsupported legacy data');
  return { ...content, generatedAt: content.reconciledAt };
}

function render(content) {
  const tallyHtml = ['conformant', 'partial', 'off-template', 'thin', 'missing'].map((status) => `
    <div class="dq-tally-item reveal">
      <div class="n dq-${status}">${content.tally[status] ?? 0}</div>
      <div class="l">${STATUS_LABEL[status]}</div>
    </div>`).join('');

  const legendHtml = Object.entries(STATUS_LABEL)
    .filter(([status]) => status !== 'off_template')
    .map(([status, label]) => `<span class="dq-legend-item"><span class="dq-dot dq-${status}"></span>${label}</span>`)
    .join('');

  const featureHtml = (f) => {
    const chips = f.docs.map((d) => `
      <div class="dq-chip dq-${d.status}">
        <span class="dq-chip-label">${escapeHtml(d.label)}</span>
        <span class="dq-chip-count">${d.present}/${d.expected}</span>
      </div>`).join('');
    const badges = [
      f.adversarialReview ? '<span class="dq-badge dq-badge-good">Adversarially reviewed</span>' : '<span class="dq-badge dq-badge-bad">Not adversarially reviewed</span>',
      f.openDecisions > 0 ? `<span class="dq-badge">${f.openDecisions} open decision${f.openDecisions === 1 ? '' : 's'}</span>` : '',
      f.blockers > 0 ? `<span class="dq-badge">${f.blockers} blocker${f.blockers === 1 ? '' : 's'} / risk${f.blockers === 1 ? '' : 's'}</span>` : '',
      f.tbdCount > 0 ? `<span class="dq-badge">${f.tbdCount} TBDs</span>` : '',
      f.statusMismatch ? '<span class="dq-badge dq-badge-warn">Spec/progress status mismatch</span>' : '',
    ].filter(Boolean).join('');
    const j = f.judgment;
    const freshness = f.judgmentState ? `<span class="dq-badge ${f.judgmentState === 'current' ? 'dq-badge-good' : 'dq-badge-warn'}">${FRESHNESS_LABEL[f.judgmentState]}</span>` : '';
    const scores = j
      ? `<span class="dq-judgment">Judgment <strong>${j.score}</strong></span><span class="dq-readiness secondary">Readiness ${f.readiness}</span>`
      : `<span class="dq-readiness">Readiness <strong>${f.readiness}</strong></span>`;
    const verdict = j
      ? `<p class="dq-verdict"><span class="dq-verdict-strong">${escapeHtml(j.verdict)}</span> · independently reviewed ${escapeHtml(j.reviewed)}. Structural readiness ${f.readiness}; coverage ${f.coverage}%.</p>`
      : `<p class="dq-verdict">${escapeHtml(f.verdict)}</p><p class="dq-unjudged">No independently verified substantive score is available. Structural readiness is not a content judgment.</p>`;
    return `
      <div class="dq-feature reveal">
        <div class="dq-feature-head"><h3 class="dq-feature-name">${escapeHtml(f.feature)}</h3><span class="dq-scores">${scores}</span></div>
        ${verdict}
        <div class="dq-badges">${freshness}${badges}</div>
        <div class="dq-coverage-row"><span class="dq-coverage-label">Template coverage</span><div class="dq-bar"><div class="dq-bar-fill" style="width:${f.coverage}%"></div></div><span class="dq-score">${f.coverage}%</span></div>
        <div class="dq-chips">${chips}</div>
      </div>`;
  };
  const ranked = content.features.map(featureHtml).join('');
  const preConvergence = (content.preConvergence || []).map(featureHtml).join('');
  return `
    <div class="wrap page-header dq-header">
      <a class="back-link reveal" href="../">Back to overview</a>
      <p class="kicker reveal">Detailed documentation insight</p>
      <h2 class="reveal">Where each feature's docs stand.</h2>
      <p class="journey reveal">${escapeHtml(content.intro)}</p>
      <p class="journey reveal">${escapeHtml(content.judgmentNote)}</p>
      <div class="dq-tally reveal">${tallyHtml}</div>
      <div class="dq-legend reveal">${legendHtml}</div>
      <p class="dq-reviewed reveal">Generated ${escapeHtml(content.generatedAt || 'at an unknown time')}.</p>
    </div>
    <section class="dq-list-section"><div class="wrap">${ranked}</div></section>
    ${preConvergence ? `<section><div class="wrap"><p class="kicker reveal">Not yet ranked</p><h2 class="reveal">Pre-convergence features.</h2>${preConvergence}</div></section>` : ''}`;
}

async function main() {
  const root = document.getElementById('docs-insight-root');
  try {
    const dataEl = document.getElementById('page-data');
    if (!dataEl) throw new Error('missing embedded data');
    const raw = JSON.parse(dataEl.textContent);
    const content = raw.schema === 2 ? schema2(raw) : legacy(raw);
    root.innerHTML = render(content);
  } catch {
    unavailable(root);
    return;
  }
  document.title = 'Detailed documentation insight · Mosaic';
  document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && !reduced) {
    document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = 0; el.style.transform = 'translateY(20px)'; });
    gsap.to('.reveal', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05 });
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

main();
