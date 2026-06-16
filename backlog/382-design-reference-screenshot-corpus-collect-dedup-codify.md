---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-15"
graduatedTo: none
relatedReport: reports/2026-06-12-design-ref-corpus-taxonomy-seed.md
tags: [design-reference, corpus, screenshots, collection, dedup, classification, tooling, codification]
---

# Design-reference screenshot corpus — collect, dedup, codify

## Digest

Umbrella epic for the **re-runnable corpus of real web-app screenshots** with rich metadata, so
design patterns can be analysed and codified into Web Everything. **Phase 1** (collect + light-classify
into a deduplicated, idempotently re-runnable collection) **is shipped**; later phases are
perceptual-dedup consolidation (#395) and vision-based codification (#396 → #481). The foundational
design call — pipeline shape, subject filter, classification depth — resolved in
[#581](/backlog/581-design-ref-corpus-pipeline-shape-subject-classification-fork/) (+ delegated forks #394,
#396, #475). This epic stays `open` only as the build umbrella; it resolves when its last open slice
(#481) lands.

> **Structure note (2026-06-14).** This item was originally authored as one `type: decision` +
> `workItem: epic` — a conflation that can't close cleanly (a decision wants to *resolve* when
> ratified; an epic must stay *open* until its slices land, and the gate forbids resolving an epic
> with open children). It was split: the decision content moved to the resolved `type: decision`
> item **#581**, and this item is now a pure non-decision build umbrella.

## Goal

A growing, deduplicated set of high-quality, *unzoomed* web-app screenshots, each carrying as
much metadata as we can capture (collected date, publication date if known, source, app,
company, application type, design register, surface, theme, viewport, …). The collection must be
**re-runnable again and again** — new runs append, never churn, and consolidate without dupes.
Phase 1 is collection + general classification only; deep analysis/codification is deferred.

The pipeline shape, subject filter (web-app UIs only), and collect-time classification depth are
settled — see **[#581](/backlog/581-design-ref-corpus-pipeline-shape-subject-classification-fork/)** for the
resolved forks and agreed defaults.

## Build status — phase 1 (2026-06-12)

**Pipeline shipped & proven.** `scripts/design-refs.mjs` (`collect | index | dedup | report`,
npm: `design-refs`) captures via Playwright (viewport 1440×900 @2×), encodes **WebP q90 through
the system `cwebp`** (no new dep — sharp stays deferred), content-addresses by `sha256(webp)`,
writes `items/<id>/{screenshot.webp,meta.json}` + a spliced `ledger.json` + per-run record under
`runs/`, and regenerates `index.json`. First run: **16/16 public web apps captured, 0 failures,
2.0 MB total**; immediate re-run **skipped all 16** (idempotency by `sourceUrl` confirmed); dedup
reports 0 exact dups.

**Gate shipped (2026-06-12, same day).** `collect` now enforces the inclusion gate per target:
optional **`enterAction`** (click-through into the app), **`readySelector`** + `readyTimeout`/
`settleMs` (assert the app surface is present). Miss → **quarantine**: nothing written to the
corpus, the URL is recorded in `needs-review.json` and retried on the next run. Captures carry a
**`reviewState`** (`confirmed` when a selector matched, `ungated` when none was supplied — so
un-QC'd shots are never silently treated as confirmed). Added **`prune`** (corpus tracks the
worklist: drops items whose URL left `targets.json` or sits in `needs-review.json`, cleans the
ledger) and an **`--only=substr`** collect filter; refresh now does **orphan cleanup** (stale item
dir removed when a re-capture changes the hash). Outcome: **Grafana** re-captured → real dashboard,
`reviewState: confirmed`; **Photopea** correctly quarantined (kept out of corpus); `prune` removed
both stale items → **corpus = 15**, idempotent. **Open follow-up:** Photopea's selector/click-through
still needs tuning (currently parked in `needs-review.json` → #392); the 14 pre-gate shots are
`ungated` (re-capture would backfill `reviewState` → #393). The selector gate is superseded as the
general path by the vision QC gate (#475 ruling → #480, shipped).

**Browse page (2026-06-12).** A filterable gallery renders the corpus at **`/research/design-references/`**
(linked from the `/research/` index, "Design Reference Library"). Auto-generated: `src/_data/designRefs.js`
reads the `meta.json` sidecars fresh each build; `.eleventy.js` passes the WebP shots through to
`research/design-references/shots/` and watches `design-refs/` so new captures hot-reload. The page
offers text search + category / register / theme / reviewState filters and links each shot to its
source + full-size image. Note: it's an Eleventy **config** change (passthrough + watch), so a running
dev server must be restarted once to serve it.

## Phasing

1. **Collect + light-classify** (✅ shipped) — pipeline, schema, dedup v1, first run.
2. **Consolidate** — `sharp` perceptual-dedup pass, near-dup clustering, canonical selection → **#395**.
3. **Codify** — vision analysis → reusable patterns/intents (ties into existing codification work) → **#396 → #481**.

## Child items

The decision and the build slices are tracked as discrete children of this epic:

- **#581** — Pipeline shape, subject & classification forks · _decision, ✅ resolved_ — the foundational design call extracted from this epic.
- **#392** — Fix Photopea capture (tune `enterAction` + `readySelector`) · _task, agent-ready_
- **#393** — Backfill `reviewState` on the 14 pre-gate shots · _task, agent-ready_
- **#394** — First-run scope & taxonomy seed / grow `targets.json` · _decision/story, ✅ resolved_
- **#395** — Phase 2: `sharp` perceptual near-dup consolidation · _story, agent-ready_
- **#396** — Phase 3 vision codification decision · _✅ resolved 2026-06-13_ — ruled: per-shot = reliable facets + loose pattern notes (no formal per-shot structure); harvest → vision proposes candidates, human ratifies; formal vocabulary lives at the reviewed promotion boundary. Build → #481.
- **#481** — Build the codification pass (per #396 ruling) · _story, agent-ready_ — fills facets + harvests candidate intents. **Sole remaining open slice — the epic resolves when this lands.**
- **#489** — Archive quarantined frames + persist `{frame,verdict}` pairs as a labeled training corpus · _story, agent-ready_ — turns the gate into the distillation-data collector for the on-device model (#488).
- **#397** — Gallery-harvest `captureMethod` for auth-walled app interiors · _story, needs design_
- **#475** — Vision-gated capture QC decision · _✅ resolved 2026-06-13_ — ruled: vision is a **Plateau service** the WE pipeline consumes as a **no-leakage client** (governing invariant); final-frame gate, 6-verdict taxonomy + autoconsent remediation, selector fast-path + hash-cached verdict. Build → #480.
- **#480** — Build the vision-gated capture-QC client (per #475 ruling) · _story, ✅ resolved_ — thin swappable vision-client seam in `design-refs.mjs`; closed the open QC gap.

**Related (not a child):** **#488** — On-device UI-screenshot vision model as a Plateau capability
(linear-cost rule) · _decision_ — decides the *target provider* behind the #475 vision service; the
dev gate (#480/#485) stays interim regardless.

All the build slices run against the shipped phase-1 pipeline, so none is hard-blocked — they're
independently selectable (`parent: 382` is the only relation). The decision is resolved (#581) and
its sub-decisions ratified (#394/#396/#475).
