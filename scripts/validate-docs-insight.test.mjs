import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateDocsInsight } from './validate-docs-insight.mjs';

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
