# mosaic-flow

**How Mosaic gets built — explained, and live.** A single-page site for non-technical stakeholders: the stack, the development flow, who (and what) does each step, the rules no change can skip, and a live view of where things are up to.

Published via GitHub Pages from this repo's `main` branch.

## How the live section works

`data/status.json` and `docs-insight/content.json` are **machine-written snapshots** pushed automatically by a GitHub Action in the private MosaicPlaybook repo (on relevant merges and three times daily). Their generating scripts are strict allowlists:

- no source code, file paths, or commit contents;
- no issue titles or free text;
- no personal names, model identifiers, or evidence details.

The docs-insight stream uses schema 2: structural readiness is kept separate from independently verified substantive judgment, and stale judgment lineage is labelled explicitly. The committed payload and Pages workflow require schema 2; unknown versions fail closed.

This repo has **no access** to the private repo — data flows one way, and only through those allowlists. Do not commit anything sensitive here; treat every file in this repo as public.

## Editing

The whole site is `index.html` (self-contained; GSAP and fonts from CDNs). `data/status.json` is machine-written — don't edit it by hand, it gets overwritten on the next publish.

The hand-curated feature pages (`features/*/content.json`, …) and the machine-owned docs-insight stream have their maintenance and recovery procedures documented in [RECONCILING.md](RECONCILING.md).
