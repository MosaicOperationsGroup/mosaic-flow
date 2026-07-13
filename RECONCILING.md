# Reconciling this site against the private repo

Maintainer guide for keeping mosaic-flow accurate. Everything in this repo is
public — the redaction rules below are not optional. Last full reconcile:
2026-07-13.

## The two content streams

**Automated — never hand-edit.** `data/status.json` is pushed by a GitHub
Action in the private MosaicPlaybook repo (on merges and on a 06/12/18 UTC
cron). `data/pages.json` is regenerated at deploy from the real `features/`
directories. Both get overwritten; hand edits are wasted. The homepage shows
an amber warning automatically if the snapshot goes more than a day stale —
if that fires, check the private repo's `publish-status` workflow runs, and
remember a local clone that merely hasn't been pulled looks identical to a
dead pipeline (`git fetch` first).

**Hand-curated — this document's subject.** `features/<slug>/content.json`,
`docs-insight/content.json`, and the other per-page content files. These are
written by a person, for non-technical readers, and go stale as the private
docs move. The site detects that drift itself (see hashes, below) — the job
here is closing it.

## Reconciling a feature page

1. **Clone the private repo somewhere OUTSIDE this working tree** (a temp
   directory). Never inside this repo — one wrong `git add` publishes it.
   Delete the clone when done. On Windows you may need
   `git config core.longpaths true` (long filenames under
   `adversarial-review/`).
2. Read `docs/features/<slug>/` in the clone: `README.md`, `product-spec.md`,
   `progress.md`, `subfeatures.md`, `expected-outcomes.md`.
3. Update the page's `content.json`: `status` / subfeature statuses are
   `planned | in-progress | shipped` (the renderer knows only those three),
   `statusLabel` is the honest one-line headline, `journey` only changes if
   now inaccurate, `testing` reflects the current expected-outcomes register.
   Keep the warm plain-English voice; change only what is now wrong, missing,
   or materially incomplete.
4. **Redaction check — hard rules, no exceptions:**
   - no personal names, usernames, or initials (private READMEs name the
     owner — strip it);
   - no AI vendor or model names;
   - no GitHub issue/PR numbers, gate IDs, or internal doc paths;
   - no verbatim sentences from private docs — always paraphrase;
   - no security-weakness or incident details (protections described in
     general terms are fine);
   - `tests/*.spec.ts`-style test names are the established allowance in
     `enforcedBy`; internal script paths are not — describe those generically
     ("the automated database-permissions suite").
5. **Stamp the page.** Set `reconciledAt` to today and `reconciledSourceHash`
   to the hash of the private-doc state you just reviewed:

   ```js
   // Run from the PRIVATE clone's root. CRITICAL: hash git blobs, not
   // working-tree files — a Windows checkout converts line endings to CRLF
   // and silently produces wrong hashes. This mirrors featureContentHash()
   // in the private repo's scripts/build-public-status.mjs.
   const { createHash } = require('crypto');
   const { execSync } = require('child_process');
   function blob(p) { try { return execSync(`git show HEAD:${JSON.stringify(p)}`,
     { maxBuffer: 1e8, stdio: ['pipe','pipe','ignore'] }); } catch { return null; } }
   function featureHash(slug) {
     const h = createHash('sha256'); let any = false;
     for (const n of ['subfeatures.md','product-spec.md','progress.md',
                      'expected-outcomes.md','decisions/role-catalogue.md']) {
       const b = blob(`docs/features/${slug}/${n}`); if (b) { any = true; h.update(b); }
     }
     const g = blob('docs/testing/golden-fixture.md'); if (g) { any = true; h.update(g); }
     return any ? h.digest('hex').slice(0, 16) : null;
   }
   ```

   `assets/feature-page.js` compares this stamp against the live snapshot's
   `content_hash` and shows the stale/fresh badge. Note the shared
   golden-fixture file is hashed into *every* feature — one edit to it shifts
   all ten hashes at once; that's by design, not a bug.
6. **Expect "stale" immediately after stamping.** You reconciled against the
   private repo's HEAD, which is newer than the last published snapshot. The
   badge flips to fresh when the next snapshot lands with matching hashes —
   if it doesn't, the private docs moved again in between, and that's the
   badge telling the truth.

## Regenerating docs-insight

`docs-insight/content.json` is a mechanical transform of the private repo's
deterministic report — do not eyeball-edit the numbers. In the private clone:
`node scripts/doc-quality-report.mjs --json <out>`. Then map into the public
shape, preserving from the old public file: `intro`, `legend`,
`preConvergenceNote`, `judgmentNote`, and every `judgment` object.

Transform rules (match the existing file exactly):
- fields go snake_case → camelCase; `display` → `feature`;
- doc entries keep `label, status, present, expected, missing, note`, with
  `missing` section names Title-Cased;
- off-template docs get `missing` as-is plus the note
  `"doc has N sections of its own, none/few match the template"` (N =
  `actual`); all other docs get `note: null`;
- features sorted by readiness, descending; `tally` recounted from the ranked
  features' doc statuses; `preConvergence` mapped the same way, no judgment;
- `reconciledAt` set to today.

**Judgment scores are carried forward, never generated here.** They come only
from the private repo's human-verified doc-judgment publish step. If a
feature's report was re-run privately, the score arrives through that step —
copying numbers out of report files by hand skips the verification the
process requires.

## Build and verify locally

Gated pages get their `content.json` inlined and deleted at deploy
(`scripts/inline-content.mjs`), then encrypted (staticrypt, password in the
`STATICRYPT_PASSWORD` repo secret — if that secret is ever unset, the deploy
only *warns* and ships gated pages unencrypted; treat that warning as a
failure). So a raw local checkout renders feature pages as "not available".
To preview properly: copy the site to a temp dir, run
`node scripts/inline-content.mjs` there, and serve that copy
(`python -m http.server`). Never run the inline script in the working tree —
it deletes the content.json files it inlines.

## Known gaps (as of 2026-07-13)

- `briefing/`, `blog/`, `top-priorities/` are honest placeholders — no
  publisher exists for them yet in the private repo (only status.json is
  published). Populating them means extending the redaction boundary there;
  design that deliberately, not casually.
- EMAR calendar appears in the snapshot's governance table but has no public
  feature page yet; the homepage renders its row unlinked via
  `data/pages.json`. When its page is eventually added under `features/`,
  the link starts working with no other change needed.
