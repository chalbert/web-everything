---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/conformance.njk
tags: []
---

# Demo surface reframe — conformance = project-strength status page; /demos/ = WE protocols in real action

Today /demos/ conflates two surfaces: conformance playgrounds (headless proofs a standard is satisfied) and real showcases. Per #1078, conformance is better framed as a project-**strength status** surface (protocols live, tests green, vectors covered) — not a "demo". Visitors to /demos/ expect WE protocols in **real action** (compelling, real-usage showcases), not a conformance checklist. The data model already marks `kind:playground` vs showcase (`we:docs/agent/demo-workflow.md`). Split them: route playgrounds into a status/health view advertising WE's strength; reserve the /demos/ index for real-action showcases. Touches `we:demos.json`, the /demos/ index template, a new conformance-status surface, `we:docs/agent/demo-workflow.md`. Surfaced from #1078.

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

The two index surfaces are now split by `kind` (every demo keeps its `/demos/{id}/` detail page; only the *index* routing changed):

- **`we:src/demos.njk`** — `/demos/` now lists **showcases only** (`rejectattr kind == playground`); copy reframed to "WE protocols in real action" with a cross-link to /conformance/. 9 showcases.
- **`we:src/conformance.njk`** (new, `permalink: /conformance/`) — lists the 37 **playgrounds** framed as *project strength*: a counts banner (N playgrounds, N active & green) + "Proves: \<project\>" cards. Headless-proof framing, cross-links back to /demos/.
- **`we:src/_data/chrome.js`** — added a **Conformance** nav link under Explore (next to Demos).
- **`we:vite.config.mts`** — added `conformance` to the :3000→:8080 proxy alternation (catalog-route gate).
- **`we:docs/agent/demo-workflow.md`** — documented the `kind`-routes-the-surface rule; `kind:"demo"`/stray values are invalid (missing = showcase).
- **Data normalization** for a clean split: `we:src/_data/demos/reveal-nav-conformance.json` → `kind:playground` (was unkinded but a conformance proof); `we:src/_data/demos/webdirectives-virtual-elements-demo.json` → dropped the stray `kind:"demo"` (a real-action showcase).

Reconciles: 46 demos = 37 playgrounds + 9 showcases. Verified rendering live on :8080 (both indexes + nav). Gate green.
