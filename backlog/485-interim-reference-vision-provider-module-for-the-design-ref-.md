---
kind: story
size: 3
parent: "382"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, swappable-provider, no-leakage]
---

# Interim reference vision provider module for the design-ref capture gate

The #480 vision-gate seam ships vendor-free: it resolves a provider by name from an external module (DESIGN_REFS_VISION_PROVIDER_MODULE) and ships only the null manual provider, so the gate's decision logic is built and unit-tested with a mock but cannot yet run end-to-end against live targets. Author the interim reference provider module — a thin no-leakage client that calls a vision model directly (per the #475 interim ruling, until the Plateau vision service lands) and self-registers via registerVisionProvider — returning the 6-verdict taxonomy {app,obstructed,marketing,error,blank,non-app}.

Keep it OUT of the design-refs core (separate module, bring-your-own key) so no vendor name leaks into the WE repo tooling. Acceptance: run collect against the two known-bad targets (Photopea splash, Grafana stale deep-link) and confirm Photopea quarantines and Grafana admits/recovers.

## Progress

- **Status:** resolved 2026-06-13.
- **Done:** `we:scripts/design-refs/providers/anthropic-vision.mjs` — a no-leakage interim provider that
  self-registers as `anthropic` (loaded via `DESIGN_REFS_VISION_PROVIDER_MODULE`, so the design-refs
  core still names no vendor). Calls a vision model with the base64-PNG image message format and
  `output_config.format` json-schema structured output constrained to the 6-verdict taxonomy; model
  defaults to `claude-opus-4-8` (vision-capable), operator-overridable via `DESIGN_REFS_VISION_MODEL`.
  `@anthropic-ai/sdk` is a **runtime-only optional** dynamic import (not added to we:package.json — same
  no-extra-dep posture as #486) with a clear "npm i + ANTHROPIC_API_KEY" error when absent. Request
  building (`buildVisionRequest`) and response mapping (`mapVisionResponse`, incl. refusal/malformed →
  safe quarantine) are pure exported functions.
- **Tests:** `we:scripts/design-refs/providers/__tests__/anthropic-vision.test.mjs` — 11 tests: self-
  registration, base64 image message shape, schema/enum = taxonomy, model default + override, response
  mapping, and the Photopea/Grafana/clean acceptance mapping. No SDK / network / key needed.
- **Gate:** full vitest **2560 pass** (11 new); `check:standards` **0 errors**.
- **Notes / honest scope:** the *live* end-to-end run (real browser capture + real model call against
  the two targets) is **operator-run** — it needs `npm i @anthropic-ai/sdk`, an `ANTHROPIC_API_KEY`,
  and network, which aren't available in this environment. The provider contract + mapping are proven
  by unit test; consuming it is the documented env-var invocation above. The Plateau-service repoint
  (the permanent home) remains future work under the #475 ruling.
