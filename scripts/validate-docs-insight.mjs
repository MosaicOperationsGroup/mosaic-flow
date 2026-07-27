#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DOCS_INSIGHT_CONTRACT = Object.freeze({
  slugs: [
    'task-management', 'calendar', 'self-evaluation', 'analytics',
    'roles-and-permissions', 'cover-module', 'reporting-gradebook',
    'lesson-observations', 'school-development-action-planning',
    'onboarding-and-school-config', 'career-counseling', 'emar-calendar',
  ],
  docKeys: ['readme', 'product_spec', 'subfeatures', 'progress', 'expected_outcomes', 'version_map', 'data_model_adr', 'ux_adr'],
  statuses: ['conformant', 'partial', 'off_template', 'thin', 'missing'],
  readiness: ['build_ready', 'reviewed_gaps_remain', 'structurally_complete_unreviewed', 'drafting_substantial_unreviewed', 'drafting_early'],
  judgmentStates: ['never_verified', 'current', 'docs_changed', 'newer_unverified_report', 'docs_changed_and_newer_unverified_report'],
  judgmentVerdicts: ['substantively_complete', 'usable_with_named_gaps', 'drafting', 'not_build_ready'],
  rootRequired: ['schema', 'generatedAt', 'sourceRevision', 'registryHash', 'tally', 'features'],
  featureRequired: [
    'slug', 'cohort', 'coverage', 'readiness', 'presentSections', 'expectedSections',
    'readinessVerdict', 'adversarialReview', 'openDecisionCount', 'blockerCount',
    'tbdCount', 'emptySectionCount', 'statusAlignment', 'sourceHash', 'docs', 'judgmentState',
  ],
  docRequired: ['key', 'status', 'present', 'expected', 'actual', 'missingCount'],
  judgmentRequired: ['score', 'verdict', 'reviewed', 'reportHash', 'sourceHashAtReview'],
  bounds: {
    percentage: [0, 100],
    boundedCount: [0, 1000],
    docCount: [0, 100],
    features: [1, 12],
  },
});

const SLUGS = new Set(DOCS_INSIGHT_CONTRACT.slugs);
const DOC_KEYS = DOCS_INSIGHT_CONTRACT.docKeys;
const STATUSES = DOCS_INSIGHT_CONTRACT.statuses;
const READINESS = DOCS_INSIGHT_CONTRACT.readiness;
const JUDGMENT_STATES = DOCS_INSIGHT_CONTRACT.judgmentStates;
const JUDGMENT_VERDICTS = DOCS_INSIGHT_CONTRACT.judgmentVerdicts;
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_HASH = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function closed(value, path, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown property');
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'required');
}

function enumValue(value, values, path) {
  if (!values.includes(value)) fail(path, `unsupported value ${JSON.stringify(value)}`);
}

function integer(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) fail(path, `must be an integer from ${min} to ${max}`);
}

function date(value, path) {
  if (typeof value !== 'string' || !ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) fail(path, 'must be an ISO date');
}

function validateJudgment(value, path) {
  closed(value, path, DOCS_INSIGHT_CONTRACT.judgmentRequired);
  integer(value.score, 0, 100, `${path}.score`);
  enumValue(value.verdict, JUDGMENT_VERDICTS, `${path}.verdict`);
  date(value.reviewed, `${path}.reviewed`);
  if (!SHA256.test(value.reportHash)) fail(`${path}.reportHash`, 'must be a lowercase SHA-256');
  if (!SHA256.test(value.sourceHashAtReview)) fail(`${path}.sourceHashAtReview`, 'must be a lowercase SHA-256');
}

function validateDoc(value, path) {
  closed(value, path, DOCS_INSIGHT_CONTRACT.docRequired);
  enumValue(value.key, DOC_KEYS, `${path}.key`);
  enumValue(value.status, STATUSES, `${path}.status`);
  for (const key of ['present', 'expected', 'actual', 'missingCount']) integer(value[key], 0, 100, `${path}.${key}`);
}

function validateFeature(value, path) {
  closed(value, path, DOCS_INSIGHT_CONTRACT.featureRequired, ['judgment']);
  if (!SLUGS.has(value.slug)) fail(`${path}.slug`, 'unknown feature slug');
  enumValue(value.cohort, ['ranked', 'pre_convergence'], `${path}.cohort`);
  integer(value.coverage, 0, 100, `${path}.coverage`);
  integer(value.readiness, 0, 100, `${path}.readiness`);
  for (const key of ['presentSections', 'expectedSections', 'openDecisionCount', 'blockerCount', 'tbdCount', 'emptySectionCount']) {
    integer(value[key], 0, 1000, `${path}.${key}`);
  }
  enumValue(value.readinessVerdict, READINESS, `${path}.readinessVerdict`);
  enumValue(value.adversarialReview, ['present', 'absent'], `${path}.adversarialReview`);
  enumValue(value.statusAlignment, ['matched', 'mismatched'], `${path}.statusAlignment`);
  if (!SHA256.test(value.sourceHash)) fail(`${path}.sourceHash`, 'must be a lowercase SHA-256');
  enumValue(value.judgmentState, JUDGMENT_STATES, `${path}.judgmentState`);
  if (!Array.isArray(value.docs) || value.docs.length !== 8) fail(`${path}.docs`, 'must contain exactly eight standard documents');
  value.docs.forEach((doc, index) => validateDoc(doc, `${path}.docs[${index}]`));
  if (new Set(value.docs.map((doc) => doc.key)).size !== 8 || DOC_KEYS.some((key) => !value.docs.some((doc) => doc.key === key))) {
    fail(`${path}.docs`, 'must contain every standard document key exactly once');
  }
  if (value.judgmentState === 'never_verified') {
    if (Object.hasOwn(value, 'judgment')) fail(`${path}.judgment`, 'must be absent when judgmentState is never_verified');
  } else {
    if (!Object.hasOwn(value, 'judgment')) fail(`${path}.judgment`, 'required for a verified lineage');
    validateJudgment(value.judgment, `${path}.judgment`);
  }
}

export function validateSchema2(value) {
  closed(value, '$', DOCS_INSIGHT_CONTRACT.rootRequired);
  if (value.schema !== 2) fail('$.schema', 'must equal 2');
  if (typeof value.generatedAt !== 'string' || !value.generatedAt.endsWith('Z') || Number.isNaN(Date.parse(value.generatedAt))) {
    fail('$.generatedAt', 'must be an ISO-8601 UTC timestamp');
  }
  if (!GIT_HASH.test(value.sourceRevision)) fail('$.sourceRevision', 'must be a lowercase 40-character Git hash');
  if (!SHA256.test(value.registryHash)) fail('$.registryHash', 'must be a lowercase SHA-256');
  closed(value.tally, '$.tally', STATUSES.map((status) => status.replace('-', '_')));
  for (const key of Object.keys(value.tally)) integer(value.tally[key], 0, 1000, `$.tally.${key}`);
  if (!Array.isArray(value.features) || value.features.length < 1 || value.features.length > 12) fail('$.features', 'must contain 1 to 12 features');
  value.features.forEach((feature, index) => validateFeature(feature, `$.features[${index}]`));
  const slugs = value.features.map((feature) => feature.slug);
  if (new Set(slugs).size !== slugs.length) fail('$.features', 'contains duplicate feature slugs');
  return value;
}

export function validateLegacy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== undefined) fail('$', 'not a legacy payload');
  if (!Array.isArray(value.features) || !value.tally || typeof value.reconciledAt !== 'string') fail('$', 'legacy payload is missing required fields');
  return value;
}

export function validateDocsInsight(value, { allowLegacy = false, requireSchema } = {}) {
  if (value?.schema === 2) return validateSchema2(value);
  if (requireSchema === 2) fail('$.schema', 'schema 2 is required');
  if (allowLegacy) return validateLegacy(value);
  fail('$.schema', 'unsupported or absent schema');
}

function cli() {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith('--'));
  const requireIndex = args.indexOf('--require-schema');
  const requireSchema = requireIndex >= 0 ? Number(args[requireIndex + 1]) : undefined;
  if (!path) throw new Error('usage: validate-docs-insight.mjs <file> [--allow-legacy] [--require-schema 2]');
  validateDocsInsight(JSON.parse(readFileSync(path, 'utf8')), {
    allowLegacy: args.includes('--allow-legacy'),
    requireSchema,
  });
  process.stdout.write(`Valid docs-insight schema ${requireSchema ?? (args.includes('--allow-legacy') ? '2 or legacy' : '2')}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { cli(); } catch (error) {
    process.stderr.write(`docs-insight validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
