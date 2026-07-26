import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { DOCS_INSIGHT_CONTRACT, validateDocsInsight } from './validate-docs-insight.mjs';

const hash = 'a'.repeat(64);
const docKeys = ['readme', 'product_spec', 'subfeatures', 'progress', 'expected_outcomes', 'version_map', 'data_model_adr', 'ux_adr'];

function candidate() {
  return {
    schema: 2,
    generatedAt: '2026-07-25T12:00:00.000Z',
    sourceRevision: 'b'.repeat(40),
    registryHash: hash,
    tally: { conformant: 8, partial: 0, off_template: 0, thin: 0, missing: 0 },
    features: [{
      slug: 'task-management',
      cohort: 'ranked',
      coverage: 100,
      readiness: 95,
      presentSections: 40,
      expectedSections: 40,
      readinessVerdict: 'build_ready',
      adversarialReview: 'present',
      openDecisionCount: 0,
      blockerCount: 0,
      tbdCount: 0,
      emptySectionCount: 0,
      statusAlignment: 'matched',
      sourceHash: hash,
      docs: docKeys.map((key) => ({ key, status: 'conformant', present: 5, expected: 5, actual: 5, missingCount: 0 })),
      judgmentState: 'current',
      judgment: { score: 90, verdict: 'substantively_complete', reviewed: '2026-07-25', reportHash: hash, sourceHashAtReview: hash },
    }],
  };
}

function renderPayload(payload) {
  const renderer = readFileSync(new URL('../assets/docs-insight.js', import.meta.url), 'utf8');
  const root = { innerHTML: '' };
  const pageData = { textContent: JSON.stringify(payload) };
  const document = {
    title: '',
    getElementById(id) {
      if (id === 'docs-insight-root') return root;
      if (id === 'page-data') return pageData;
      return null;
    },
    querySelectorAll() { return []; },
  };
  vm.runInNewContext(renderer, {
    document,
    matchMedia: () => ({ matches: true }),
    window: {},
  });
  return root.innerHTML;
}

test('accepts a strict schema-2 candidate', () => assert.equal(validateDocsInsight(candidate()).schema, 2));
test('accepts the committed legacy payload only with transition flag', () => {
  const legacy = JSON.parse(readFileSync(new URL('../docs-insight/content.json', import.meta.url)));
  assert.doesNotThrow(() => validateDocsInsight(legacy, { allowLegacy: true }));
  assert.throws(() => validateDocsInsight(legacy), /unsupported/);
});
test('recursively rejects unknown properties and enum values', () => {
  const extra = candidate(); extra.features[0].docs[0].note = 'PRIVATE_CANARY';
  assert.throws(() => validateDocsInsight(extra), /unknown property/);
  const unknown = candidate(); unknown.features[0].readinessVerdict = 'PRIVATE_CANARY';
  assert.throws(() => validateDocsInsight(unknown), /unsupported value/);
});
test('rejects malformed numbers, hashes, dates, duplicate docs, and judgment shape mismatches', () => {
  const fractional = candidate(); fractional.features[0].coverage = 1.5;
  assert.throws(() => validateDocsInsight(fractional), /integer/);
  const badHash = candidate(); badHash.registryHash = 'A'.repeat(64);
  assert.throws(() => validateDocsInsight(badHash), /SHA-256/);
  const badDate = candidate(); badDate.features[0].judgment.reviewed = '2026-99-99';
  assert.throws(() => validateDocsInsight(badDate), /ISO date/);
  const duplicate = candidate(); duplicate.features[0].docs[1].key = 'readme';
  assert.throws(() => validateDocsInsight(duplicate), /every standard document/);
  const absent = candidate(); absent.features[0].judgmentState = 'never_verified';
  assert.throws(() => validateDocsInsight(absent), /must be absent/);
});
test('requires schema 2 when requested and rejects unsupported schemas', () => {
  assert.throws(() => validateDocsInsight({ schema: 3 }, { allowLegacy: true }), /legacy|unsupported/);
  assert.throws(() => validateDocsInsight({ features: [], tally: {}, reconciledAt: '2026-07-13' }, { requireSchema: 2 }), /schema 2 is required/);
});
test('renderer keeps scores separate, labels freshness locally, and has an unsupported-schema denial state', () => {
  const renderer = readFileSync(new URL('../assets/docs-insight.js', import.meta.url), 'utf8');
  assert.match(renderer, /Judgment <strong>/);
  assert.match(renderer, /Readiness/);
  assert.match(renderer, /docs_changed_and_newer_unverified_report/);
  assert.match(renderer, /No partial data has been shown/);
  assert.doesNotMatch(renderer, /\\(f\\.readiness\\s*\\+\\s*j\\.score\\)|average/i);
});

test('renderer rejects malformed numeric fields before interpolating HTML', () => {
  const poison = '0%"><script>PRIVATE_CANARY</script>';
  const mutations = [
    (value) => { value.features[0].coverage = poison; },
    (value) => { value.features[0].readiness = poison; },
    (value) => { value.features[0].judgment.score = poison; },
    (value) => { value.features[0].openDecisionCount = poison; },
    (value) => { value.features[0].docs[0].present = poison; },
    (value) => { value.tally.conformant = poison; },
  ];
  for (const mutate of mutations) {
    const injected = candidate();
    mutate(injected);
    const html = renderPayload(injected);
    assert.match(html, /temporarily unavailable/);
    assert.doesNotMatch(html, /PRIVATE_CANARY|<script>/);
  }
});

test('committed JSON Schema stays aligned with the executable validator contract', () => {
  const schema = JSON.parse(readFileSync(new URL('../docs-insight/schema-v2.json', import.meta.url)));
  assert.deepEqual(schema.required, DOCS_INSIGHT_CONTRACT.rootRequired);
  assert.deepEqual(schema.$defs.slug.enum, DOCS_INSIGHT_CONTRACT.slugs);
  assert.deepEqual(schema.$defs.doc.properties.key.enum, DOCS_INSIGHT_CONTRACT.docKeys);
  assert.deepEqual(schema.$defs.doc.properties.status.enum, DOCS_INSIGHT_CONTRACT.statuses);
  assert.deepEqual(schema.$defs.feature.properties.readinessVerdict.enum, DOCS_INSIGHT_CONTRACT.readiness);
  assert.deepEqual(schema.$defs.feature.properties.judgmentState.enum, DOCS_INSIGHT_CONTRACT.judgmentStates);
  assert.deepEqual(schema.$defs.judgment.properties.verdict.enum, DOCS_INSIGHT_CONTRACT.judgmentVerdicts);
  assert.deepEqual(schema.$defs.feature.required, DOCS_INSIGHT_CONTRACT.featureRequired);
  assert.deepEqual(schema.$defs.doc.required, DOCS_INSIGHT_CONTRACT.docRequired);
  assert.deepEqual(schema.$defs.judgment.required, DOCS_INSIGHT_CONTRACT.judgmentRequired);
  assert.deepEqual(
    [schema.$defs.boundedCount.minimum, schema.$defs.boundedCount.maximum],
    DOCS_INSIGHT_CONTRACT.bounds.boundedCount,
  );
  assert.deepEqual(
    [schema.$defs.docCount.minimum, schema.$defs.docCount.maximum],
    DOCS_INSIGHT_CONTRACT.bounds.docCount,
  );
  assert.deepEqual(
    [schema.properties.features.minItems, schema.properties.features.maxItems],
    DOCS_INSIGHT_CONTRACT.bounds.features,
  );
  for (const key of ['coverage', 'readiness']) {
    assert.deepEqual(
      [schema.$defs.feature.properties[key].minimum, schema.$defs.feature.properties[key].maximum],
      DOCS_INSIGHT_CONTRACT.bounds.percentage,
    );
  }
  assert.deepEqual(
    [schema.$defs.judgment.properties.score.minimum, schema.$defs.judgment.properties.score.maximum],
    DOCS_INSIGHT_CONTRACT.bounds.percentage,
  );
});

test('Pages validation command rejects the deliberately invalid fixture before inlining', () => {
  const fixture = new URL('./fixtures/docs-insight-invalid.json', import.meta.url);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./validate-docs-insight.mjs', import.meta.url)),
    fileURLToPath(fixture),
    '--allow-legacy',
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /docs-insight validation failed/);

  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.ok(
    workflow.indexOf('node --test scripts/validate-docs-insight.test.mjs')
      < workflow.indexOf('node scripts/inline-content.mjs'),
    'invalid-fixture test must run before inlining',
  );
});
