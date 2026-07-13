# mosaic-flow

**How Mosaic gets built — explained, and live.** A single-page site for non-technical stakeholders: the stack, the development flow, who (and what) does each step, the rules no change can skip, and a live view of where things are up to.

Published via GitHub Pages from this repo's `main` branch.

## How the live section works

`data/status.json` is a **curated snapshot** pushed automatically by a GitHub Action in the private MosaicPlaybook repo (on merges and three times daily). The generating script is a strict allowlist — aggregate counts and stage names only:

- no source code, file paths, or commit contents;
- no issue titles or free text;
- no personal names, model identifiers, or evidence details.

This repo has **no access** to the private repo — data flows one way, and only through that allowlist. Do not commit anything sensitive here; treat every file in this repo as public.

## Editing

The whole site is `index.html` (self-contained; GSAP and fonts from CDNs). `data/status.json` is machine-written — don't edit it by hand, it gets overwritten on the next publish.

The hand-curated pages (`features/*/content.json`, `docs-insight/`, …) have their own maintenance procedure — hash stamping, redaction rules, local preview — documented in [RECONCILING.md](RECONCILING.md).
