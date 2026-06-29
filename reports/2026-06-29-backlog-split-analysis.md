# Backlog split analysis — 2026-06-29

Focused run: `/split 1608`.

## Candidate

| NNN | workItem | size | title |
|-----|----------|------|-------|
| 1608 | story | 13 | Migrate project-* include card surfaces to product components (standard-card / standard-section) |

`parent: 1601`, `status: open`. Re-sized 13 on grounding (carry note from batch-2026-06-28-1905-1945),
explicitly flagged "needs /split".

## Work-investigation pass (read before slicing)

- **Surface is real and uniform.** `we:src/_includes/project-*.njk` carry two content-card surfaces:
  - `.section-card` — `<section id="…" class="section-card"><hN id="…">…</section>` content wrappers with
    deep-link `:target` anchors. **225 occurrences** across **44 files** (e.g.
    we:src/_includes/project-webportals.njk:21 — `id="when-needed"` + `<h3 id="when-you-need-portals">`).
  - `.standard-card` — `<div class="standard-card …"><h4 id="…">…</div>` prose cards. **31 occurrences**
    across ~12 files (e.g. we:src/_includes/project-webcharts.njk:23).
  - Total **~256 occurrences / 44 files**. The 7 `<a class="standard-card">` link tiles stay `<a>` (#1820
    catalog-tile pattern) — out of scope, untouched.
- **All design forks are resolved** — size is volume, not an unresolved decision:
  - #1886 (card = root-agnostic structure+style; product composes FUI primitive) — **resolved**,
    `codifiedIn we:docs/agent/platform-decisions.md#identity-semantic-look-composable`.
  - #1871 (which surfaces migrate + how anchors/headings survive) — **resolved**.
  - #1903 (FUI `we-section-card` `<section>` primitive) — **resolved** (locus frontierui).
  - #1786 (FUI card transient-CE embed entry / SSR baseline) — **resolved**.
  - #1820 (catalog-tile vocabulary mapping; carves link tiles out) — **resolved**.
- **The two product components do not exist yet.** No `standard-card` / `standard-section` source under
  `we:src/` (grep clean). They live in the **WE website's own frontend** (not WE/FUI), namespaced via a
  config knob (default empty → unprefixed) — a decided shape, no open fork. They compose the already-shipped
  FUI `we-card` / `we-section-card` primitives. **⇒ every migration depends on the component slice landing first.**
- **Per-file migration is mechanical-but-careful**: swap the wrapper element to the product component,
  keep the `<section>` landmark + wrapper `id` + each `<hN id>` verbatim (so `#anchor` TOC links and
  `.section-card:target` survive), verify with a `:8080` render check. Files are mutually independent
  (one per standard) → whole-file ownership makes slices provably disjoint and parallel-batchable.

## Could split — 1608 → storied epic + 7 slices

Rubric: (1) volume not decision ✓ · (2) ≥2 nameable slices w/ real home ✓ · (3) each ≤3 / task ✓ ·
(4) clean DAG, real independence ✓ · (5) every slice leaves a valid demoable state ✓.

| Slice | workItem · size | scope | blocked-by |
|-------|-----------------|-------|------------|
| **A** | story · 3 | Author `standard-card` + `standard-section` product components (composing FUI `we-card` / `we-section-card`) + the namespace config knob; **pilot-migrate the heaviest file we:src/_includes/project-webportals.njk (21 occ)** as the end-to-end proof (exercises landmark + `:target` + heading anchors). Gate `npm run verify` + `:8080` render check on `/webportals`. | — |
| **B** | story · 2 | Migrate 7 files (~42 occ): webexpressions, webregistries, webmanifests, webtraces, webtheme, webintents, weblayout. Own render check. | A |
| **C** | story · 2 | Migrate 7 files (~40 occ): webadapters, webgraph, range-anchor, webvalidation, webreporting, webplugs, webblocks. Own render check. | A |
| **D** | story · 2 | Migrate 7 files (~38 occ): webcontexts, webbehaviors, webreliability, webworkflows, webpositioning, webcases, webprocess. Own render check. | A |
| **E** | story · 2 | Migrate 7 files (~40 occ): webcomponents, webrouting, webrealtime, webresources, webpolicy, webcompliance, webanalytics. Own render check. | A |
| **F** | story · 2 | Migrate 7 files (~37 occ): webcharts, webdirectives, webnotifications, webstates, weblifecycle, webdecisions, webediting. Own render check. | A |
| **G** | story · 2 | Migrate 8 files (~38 occ): webevents, webinjectors, webintl, webaudit, webidentity, webguards, webtraits, webdocs. Own render check. | A |

Buckets are volume-balanced (~38–42 occ each) and **file-disjoint** — no two migration slices touch the
same `.njk`, so B–G are mutually independent and batch in parallel once A lands.

**DAG**

```
A ──┬── B
    ├── C
    ├── D
    ├── E
    ├── F
    └── G        (B–G mutually independent → parallel-batchable)
```

**Demoable state per slice:** A ships the two components + knob and proves them on `/webportals`; each of
B–G leaves every migrated page rendering with landmarks, `:target`, and heading anchors intact (own
`:8080` check). Net flow on execution: **+7** (1608 story → storied epic, scope moves to children).

## Could not split

None. The one candidate splits cleanly; no rubric condition failed, no pending decision to register.

## Execution (on "go")

1. Convert **1608** `story` → **storied epic** in place: `workItem: story → epic`, drop `size`, refresh
   digest to umbrella framing, keep `status: open`, keep the NNN. (1608 already has `parent: 1601`; it
   converts to an epic nesting under 1601, with A–G as its children. The no-double-`size` guard is
   satisfied since `size` is removed on conversion.)
2. Scaffold A–G via `node we:scripts/backlog.mjs scaffold --workitem=story --size=… --parent=1608
   --blocked-by=… --title=… --digest=…`.
3. Gate `npm run check:standards`; confirm backlog count rose by 7.
