---
type: decision
workItem: epic
status: open
dateOpened: "2026-06-12"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-design-ref-corpus-taxonomy-seed.md
tags: [design-reference, corpus, screenshots, collection, dedup, classification, tooling, codification]
---

# Design-reference screenshot corpus — collect, dedup, codify

## Digest

Build a **re-runnable corpus of real web-app screenshots** with rich metadata, so design
patterns can be analysed and codified into Web Everything later. **Phase 1** (this epic's first
slice) = collect + light-classify into a deduplicated, idempotently re-runnable collection;
**later phases** = perceptual-dedup consolidation and vision-based codification. The pipeline
design is mostly settled (see *Settled defaults*). **Fork 1 (surface) is resolved (2026-06-12):
the corpus subject is web-application UIs only — _no static / marketing / brochure sites_ — with
the source left open and flexible to maximise volume.** Remaining open forks are minor
(collect-time classification depth, first-run scope).

## Goal

A growing, deduplicated set of high-quality, *unzoomed* web-app screenshots, each carrying as
much metadata as we can capture (collected date, publication date if known, source, app,
company, application type, design register, surface, theme, viewport, …). The collection must be
**re-runnable again and again** — new runs append, never churn, and consolidate without dupes.
Phase 1 is collection + general classification only; deep analysis/codification is deferred.

## Settled defaults (agreed — will build unless revisited)

- **Commit everything**, in-repo. Safe because the collection is **append-only +
  content-addressed** (filename = content hash → identical re-capture skips, changed capture is a
  new file → no path is ever overwritten → git history grows linearly, never churns). The bloat
  failure mode (rewriting the same path) is designed out.
- **Format: WebP q90** — visually indistinguishable for reference use, 3–5× smaller than PNG;
  decided now because committed bytes are hard to re-encode later.
- **Layout (mirrors `backlog/*.md` one-file-per-item):**
  ```
  design-refs/
    items/<id>/screenshot.webp
    items/<id>/meta.json     # one committed sidecar per shot
    index.json               # generated from sidecars (cf. gen:inventory)
    ledger.json              # seen sourceURLs + content hashes → idempotent re-run
    targets.json             # the worklist we grow each run
  scripts/design-refs.mjs    # collect | dedup | index | report
  ```
- **`meta.json` fields:** `id`, `contentHash` (sha256), `sourceUrl`, `captureMethod`
  (playwright|gallery), `dateCollected`, `datePublished` (best-effort, nullable), `app`,
  `company`, `category` (domain), `surface` (dashboard/list/settings/landing/onboarding…),
  `designRegister` (enterprise-dense / modern-saas / minimal / playful…), `theme`,
  `viewport`+`dpr`, `imageDims`, `tags[]`, `attribution`/`sourceCredit`, `collectionRun`.
- **Dedup v1:** exact sha256 + source-URL ledger → skip. Near-dup (perceptual aHash/dHash via
  `sharp`) deferred to a later consolidation pass; `sharp` not yet a dep.
- **Tooling:** `scripts/design-refs.mjs` CLI, following the existing `scripts/*.mjs` convention
  (backlog.mjs, check-readiness, gen-inventory).

## Resolved decisions

### Fork 1 — Surface ✅ *(resolved 2026-06-12)*

**Subject = web-application UIs only; source open + flexible.** The filter is on *subject, not
source*: collect from anywhere that yields real app screenshots (curated galleries for
auth-walled interiors, live Playwright capture for publicly reachable apps / demos / playgrounds /
guest modes), and maximise volume. **Excluded: static / marketing / landing / brochure / blog /
content / portfolio sites** — even when they belong to an app's company, we want the *app
surface*, not its marketing skin.

This adds one pipeline requirement: an **inclusion gate** that classifies each candidate as
*app* vs *static site* and rejects the latter. Operational working definition (refine in build):

- **App (include):** interactive, stateful, tool-like product UI — dashboards, consoles, admin
  panels, editors, inboxes, project/CRM/analytics tools, settings, data tables, in-product flows.
- **Static (exclude):** marketing homepages, pricing/landing pages, blogs, docs-as-content,
  news, portfolios, brochureware.
- Edge: same company often has both; keep only the app screens.

### Fork 2 — Classification depth ✅ *(resolved 2026-06-12; refined by [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality.md) 2026-06-13)*

**Deterministic-only at collect time** (source, dates, app, company, viewport, hashes); **defer
visual tagging to the phase-3 vision pass.** Collection stays cheap and fast; category / surface /
register / theme get filled during codification.

> **Refinement (2026-06-13, [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality.md)):**
> the "defer visual *tagging*" half still holds (→ #396), but "deterministic-*only*" is superseded.
> The brittle hand-authored `readySelector` gate doesn't generalise and can't tell a clean app
> surface from a marketing splash / modal-obstructed / error frame — so a **cheap vision pass now
> runs at collect time as a quality *gate*** (admit / remediate / quarantine), with deterministic
> selectors kept only as an optional fast-path. Full visual tagging stays deferred to #396; both
> consume one shared swappable vision provider.

## Open decisions

### Fork 3 — First-run scope & taxonomy seed → **delegated to [#394](394-design-ref-corpus-first-run-scope-taxonomy-seed-grow-targets.md)** *(prepared 2026-06-12)*

This epic's last open fork was carved out to **#394**, which is now at the prepared-fork shape
(`✓ ready to ratify`): four forks — register-axis split, vocabulary openness, first-run scope, category
vocab source — grounded in the [`design-ref-taxonomy`](/research/design-ref-taxonomy/) research topic, each
with a bold default. With Forks 1 & 2 resolved here and Fork 3 prepared in #394, **all of 382's decidable
content is at the Definition of Ready** — ratify #394 (via `/next decision`), then this epic resolves.

_Original placeholder (superseded by #394):_ seed categories from the project's style-registers
(enterprise, modern-saas, …) and capture ~30–50 shots to prove the pipeline end-to-end before scaling.

## Build status — phase 1 (2026-06-12)

**Pipeline shipped & proven.** `scripts/design-refs.mjs` (`collect | index | dedup | report`,
npm: `design-refs`) captures via Playwright (viewport 1440×900 @2×), encodes **WebP q90 through
the system `cwebp`** (no new dep — sharp stays deferred), content-addresses by `sha256(webp)`,
writes `items/<id>/{screenshot.webp,meta.json}` + a spliced `ledger.json` + per-run record under
`runs/`, and regenerates `index.json`. First run: **16/16 public web apps captured, 0 failures,
2.0 MB total**; immediate re-run **skipped all 16** (idempotency by `sourceUrl` confirmed); dedup
reports 0 exact dups.

**Open QC gap (the real finding).** Live capture lands on the wrong surface for some targets —
the inclusion gate is not yet enforced at capture time. Of a 5-shot visual spot-check: draw.io,
Excalidraw, Tailwind Play = clean full app UIs ✅; **Grafana** = real app shell but a *stale
deep-link* → error panel ⚠️; **Photopea** = its *marketing splash*, not the editor ❌ (exactly the
excluded surface). Fix direction for the next iteration:
- **Per-target readiness selector** — wait for an app-specific element (canvas/toolbar/grid)
  before screenshot; if absent within timeout, mark `needs-review` instead of capturing a splash.
- **Per-target `enterAction`** — optional selector to click through a landing overlay (e.g.
  Photopea's "Start using Photopea") into the app.
- **Quarantine/review state** — capture to a holding area; promote to the corpus only once the
  surface is confirmed an app (manually now, vision pass later).
- Correct the two seed targets (valid Grafana dashboard URL; Photopea click-through).

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
still needs tuning (currently parked in `needs-review.json`); the 14 pre-gate shots are `ungated`
(re-capture would backfill `reviewState`).

**Browse page (2026-06-12).** A filterable gallery renders the corpus at **`/research/design-references/`**
(linked from the `/research/` index, "Design Reference Library"). Auto-generated: `src/_data/designRefs.js`
reads the `meta.json` sidecars fresh each build; `.eleventy.js` passes the WebP shots through to
`research/design-references/shots/` and watches `design-refs/` so new captures hot-reload. The page
offers text search + category / register / theme / reviewState filters and links each shot to its
source + full-size image. Note: it's an Eleventy **config** change (passthrough + watch), so a running
dev server must be restarted once to serve it.

## Phasing

1. **Collect + light-classify** (this slice, ✅ shipped) — pipeline, schema, dedup v1, first run.
2. **Consolidate** — `sharp` perceptual-dedup pass, near-dup clustering, canonical selection → **#395**.
3. **Codify** — vision analysis → reusable patterns/intents (ties into existing codification work) → **#396**.

## Child items (next stages)

The next stages are tracked as discrete children of this epic:

- **#392** — Fix Photopea capture (tune `enterAction` + `readySelector`) · _task, agent-ready_
- **#393** — Backfill `reviewState` on the 14 pre-gate shots · _task, agent-ready_
- **#394** — First-run scope & taxonomy seed / grow `targets.json` · _decision/story_
- **#395** — Phase 2: `sharp` perceptual near-dup consolidation · _story, agent-ready_
- **#396** — Phase 3: vision codification of the corpus into intents · _decision, ✓ ready to ratify (prepared 2026-06-13)_
- **#397** — Gallery-harvest `captureMethod` for auth-walled app interiors · _story, needs design_
- **#475** — Vision-gated capture QC: judge candidate surface quality (app vs marketing/modal/error) at collect time · _decision, ✓ ready to ratify (prepared 2026-06-13)_ — closes the open QC gap below; defines the shared vision provider #396 widens

All run against the shipped phase-1 pipeline, so none is hard-blocked — they're independently
selectable (no `blockedBy` edges; the `parent: 382` link is the only relation).

## Decision needed

Forks 1 & 2 settled (2026-06-12). Only **Fork 3 (first-run scope & taxonomy seed)** remains, and
it's low-stakes/curatorial — can be set at build time. Phase 1 is ready to build.
