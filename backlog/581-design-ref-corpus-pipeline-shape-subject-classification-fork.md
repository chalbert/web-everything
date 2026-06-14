---
type: decision
workItem: story
size: 3
parent: "382"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-design-ref-corpus-taxonomy-seed.md
tags: [design-reference, corpus, decision, pipeline, classification, screenshots]
---

# Design-ref corpus — pipeline shape, subject & classification forks

The design-reference corpus's foundational design call: the committed-WebP / content-addressed /
one-sidecar-per-shot pipeline shape (settled defaults), Fork 1 (subject = web-app UIs only, source
open), and Fork 2 (deterministic-only at collect time, visual tagging deferred — refined by #475 to
add a collect-time vision QC gate). **Extracted from epic [#382](382-design-reference-screenshot-corpus-collect-dedup-codify.md)
on 2026-06-14** so the decision resolves cleanly while the build umbrella (#382) stays open until its
slices land — a decision and an epic can't be one item (the gate forbids resolving an epic with open
children). Fork 3 (first-run scope / taxonomy) was delegated to [#394](394-design-ref-corpus-first-run-scope-taxonomy-seed-grow-targets.md).
**All forks ratified — this decision is resolved.**

## Settled defaults (agreed)

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

## Resolved forks

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

### Fork 3 — First-run scope & taxonomy seed → delegated ✅ *(resolved 2026-06-13 via [#394](394-design-ref-corpus-first-run-scope-taxonomy-seed-grow-targets.md))*

Carved to **#394** and ratified 2026-06-13 (B / C / B / A): split `designRegister` →
`productRegister` (deterministic) + `visualStyle` (vision-pass); open-growing controlled vocab in
keyed `design-refs/taxonomy.json`; scarcity-weighted grow-targets (~30–50, ≥3/cell); coarse
~10-domain hand-rolled category seed lightly anchored to G2/Capterra. The mechanical build is carved
to [#509](509-design-ref-taxonomy-seed-re-key-scarcity-targets-build-394-r.md).
