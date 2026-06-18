---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: scripts/validation-normalize/reexport.mjs + adapter emit() + shop()
tags: [dev-experience, devtools, validation, linting, adapters, normalization, no-lock-in]
parent: "236"
---

# Validation-normalize: re-export leg (emit equivalent config for a different tool)

Second leg of the adapter-as-normalization-hub (spun out of #236, whose see leg shipped). Reverse the adapters: given the internal pivot model, emit an equivalent config for a DIFFERENT incumbent (eslint -> oxlint/biome, etc.). Must report round-trip loss honestly per cell (best-effort, never promise lossless) using the confidence/coverage grades already in we:knowledge.mjs. Adapters today only ingest; add an emit() per adapter. Engine + pivot model live in scripts/validation-normalize/.

## Progress

Shipped the re-export leg (2026-06-13) — full validation-normalize suite 25/25 (7 new), check:standards green:

- **`emit()` per adapter** — added to [we:eslint.mjs](../scripts/validation-normalize/adapters/eslint.mjs) and [we:oxlint.mjs](../scripts/validation-normalize/adapters/oxlint.mjs), the exact inverse of `ingest()`: resolved `{ rule, severity }` pairs → that tool's `{ rules }` config (verified `ingest∘emit` round-trips).
- **Re-export engine** — [we:reexport.mjs](../scripts/validation-normalize/reexport.mjs): `reExport(model, targetToolId)` maps the model's *enforced* concerns onto the target tool's rules via the existing `mappings`/`confidence` knowledge base and grades each cell — **exact** (1:1), **lossy** (`partial`/`approx`, carries the divergence note), **dropped** (target has no equivalent → reported, never faked into the config). Returns `{ tool, config, loss, summary{exact,lossy,dropped} }`; the emitted `config` carries only expressible rules, with the source severities preserved.
- **One-call `shop(configs, target)`** — wired into [we:index.mjs](../scripts/validation-normalize/index.mjs) (ingest source → pivot → re-export); throws on an unknown target tool.
- **Honesty proven** — the canonical eslint→oxlint case grades 4 exact / 1 lossy (`hook-deps`: eslint `react-hooks/exhaustive-deps` → oxlint `react/exhaustive-deps`, partial) / 1 **dropped** (`import-boundaries`: oxlint has no equivalent — surfaced, not smuggled in). README updated; the `see` leg is unchanged.

**Note:** the interactive *Shop UI* stays deferred (gated on the Technical Configurator past POC, #236 → #150 Q6) — the `shop()` *engine* call is what this leg delivers.
