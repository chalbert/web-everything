---
kind: story
size: 8
parent: "1033"
locus: plateau-app
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau-app:src/review-harness/"
tags: [design-reference, vision, design-critique, human-in-the-loop, plateau, training-data]
---

# Design-critique correction surface — build on shared review harness (preserve-both records)

Build the plateau-app surface that shows a page's #1034 design critique, lets a human comment + correct it (8 closed axes 1-5 + open findings CRUD incl. drag-box regions), and persists each pair preserve-both per the #1036 ruling: { proposed (read-only), corrected (gold), comment, annotator/timestamp/verdict }. Per Fork-1A, extract the contract-agnostic review harness (queue / screenshot-canvas / persist / no-leakage shell) shared with plateau:src/vision-review/ (#1084) and migrate the twin onto it; the critique editor composes it. Phase-1 localStorage (key plateau.design-review.v1) + seed queue; corpus read/write-back parked to #554. Un-parks the #513 distillation loop.

## Progress — built (2026-06-20, batch-2026-06-20-1219-1228-1231-1227-1222)

Set `locus: plateau-app` (was unset → mis-homed to webeverything; this is plateau-app work, gated by `npm test`). Built all three halves of Fork-1A; the plateau gate (`npm test`) is **259 tests green**.

**Shared review harness (the contract-agnostic shell, #1036) — `plateau:src/review-harness/`:**
- `plateau:src/review-harness/geometry.ts` — normalized 0..1 box + pixel-drag ⇄ unit-box helpers (extracted from `plateau:src/vision-review/data.ts`).
- `plateau:src/review-harness/harness.ts` — `mountReviewHarness(root, config)`: owns the queue nav, the screenshot canvas + region drag/edit overlay, the comment field, **preserve-both** persistence (`PreserveBothRecord<P,C> = { proposed (read-only), corrected (gold), comment, annotator, updatedAt, timeSpentMs }`, #1036), and save/copy/revert. The ONLY per-surface part is `config.renderEditor` (the output-contract editor) + region accessors. No-leakage (#475): handles a screenshot + the provider's proposed output in, the gold out — never the model.
- `plateau:src/review-harness/harness.css` (`rh-` shell styles), `plateau:src/review-harness/index.ts` barrel, `plateau:src/review-harness/harness.test.ts` (geometry + the preserve-both persistence: proposal kept read-only alongside the gold, round-trip, immutability, malformed-storage).

**Design-critique surface — `plateau:src/design-review/` (composes the harness):**
- `plateau:src/design-review/data.ts` — the #1034 critique shape (the 8 ratified closed axes scored 1-5, tier-tagged; open findings `{ dimension, elementRef, problem, severity 0-4 Nielsen, box, verdict accept|fix|reject }`), version-stamped (#1034 Fork-3 escape hatch), pure helpers (clamp/clone/withAllAxes/findingRegions/addFindingRegion). `plateau:src/design-review/seed.ts` (2 inline-SVG screenshots + proposed critiques), `plateau:src/design-review/design-review.ts` (the editor: 8 axis sliders + findings CRUD with per-element verdict + drag-to-localize), `plateau:src/design-review/design-review.css`, `plateau:src/design-review/data.test.ts`.
- Persists preserve-both under `plateau.design-review.v1`; corpus write-back parked to #554.

**Migrated the vision-review twin (#1084) onto the shared harness:** `plateau:src/vision-review/data.ts` now re-exports geometry from the harness and keeps only the RichOutput label helpers (its queue/canvas/persistence are the harness's); `plateau:src/vision-review/vision-review.ts` composes `mountReviewHarness` supplying just the description/tags/regions editor; `plateau:src/vision-review/seed.ts` `modelOutput`→`proposed`; `plateau:src/vision-review/data.test.ts` trimmed to the helpers it still owns. The shell is no longer duplicated — exactly the #1036 "one shared review harness" rule.

**Routing:** `/design-review` wired (nav link + route template + mount div in `plateau:index.html`; import + dispatch + `tryMountDesignReview` + breadcrumb in `plateau:src/main.ts`).

**Verification:** `npm test` 259/259 green (22 of them new/migrated across the harness + both surfaces); every new module transforms clean through Vite on `:4000` (200). A live in-browser render of the mounted surface could NOT be confirmed this session: the shared `:4000` dev server was 500-ing on a **concurrent cross-repo edit** — `Failed to resolve import "@webeverything/capability-manifest" from "fui:plugs/webvalidation/index.ts"` — which broke `plateau:src/main.ts`'s import graph upstream of EVERY surface (the known-good `/vision-review` route was equally unmounted). FIXED post-batch (see the §below): `plateau:vite.config.mts` was missing the `@webeverything/*` aliases the bootstrap-loaded FUI plugs need. Re-check the live mount after a `:4000` restart. Un-parks the #513 distillation loop (preserve-both pairs now accumulate).
