---
type: idea
workItem: story
size: 8
parent: "382"
status: resolved
blockedBy: ["480"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: scripts/design-refs.mjs codify command + analyzeForCodification seam method + scripts/design-refs/codification.mjs
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, codification, paradigm-harvest]
---

# Build the design-ref codification pass (per #396 ruling)

Implement the codification pass ruled in [#396](396-design-ref-phase-3-vision-codification-of-the-corpus-into-in/):
the `analyzeForCodification` call on the shared Plateau vision client (a no-leakage second client,
per #475) over the gated corpus, turning reference screenshots into standards input. Per shot it
fills the *reliable* taxonomy facets + loose pattern notes; cross-shot it proposes candidate intents
for human ratification. Blocked on **#480** (wants the gated corpus + the shared vision-client seam).

## Spec (per #396 ruling — all forks ratified)

- **Per shot (F1):** fill only the reliable facets (`surface`, `productRegister`/`visualStyle`,
  `theme`, `layout`) into the `meta.json` sidecars + **loose, lossy-OK pattern observations** (free
  tags/notes). **No formal per-shot neutral structure** (would couple to unbuilt #086 and bake
  low-fidelity structure into the corpus).
- **Provider (F2):** `analyzeForCodification` is the *second method* on the shared vision client #480
  establishes — no separate integration; **no-leakage invariant** holds (only outputs reach the standard).
- **Harvest → candidate (F3):** cluster recurring paradigms across shots; propose candidates as a
  **session report + scaffolded `type:idea` candidate items** for human ratification via the
  new-standard flow. The formal standard-vocabulary / #086-neutral-structure expression lives **only
  at this reviewed promotion boundary**.
- **Soft dep:** the formal-promotion half leans on #086's neutral structure existing; until then,
  promotion proposes in loose form for a human to formalise.

## Progress

Resolved 2026-06-15. WE locus (commit → webeverything). Built on the #480 vision-client seam; proven at the **seam + mock-provider** level (the same offline/CI boundary #480 set — live end-to-end needs #485's interim provider + a real run, deliberately deferred, no-leakage).

- **`scripts/design-refs/vision.mjs`** — the **second method on the shared client (F2)**: `analyzeForCodification(provider, input)` + `normalizeCodification` + `CODIFICATION_FACETS` (`surface`/`productRegister`/`visualStyle`/`theme`/`layout`). Facets are constrained to the reliable key set (unknown keys dropped, trimmed-or-null); patterns are loose, deduped free-text; an `ungated` envelope marks "no provider ran". The built-in null `manual` provider gained an `analyzeForCodification` → `{ ungated: true }`, so the pass is a true no-op offline / in CI. No vendor name in core (no-leakage intact).
- **`scripts/design-refs/codification.mjs`** (new, pure/dependency-free) — `applyCodificationToMeta` (F1: folds reliable facets + `patternObservations` into a shot's meta; never clobbers an authored facet with null; **stamps only a real analysis**, so an ungated run leaves the corpus untouched; idempotent), `harvestCandidates` (F3: clusters pattern observations across distinct shots by a support floor, ranked), `candidateToScaffold` (a `type:idea` descriptor citing supporting shots), and `renderCodificationReport` (the session report).
- **`scripts/design-refs.mjs`** — a new **`codify`** command + CLI/usage: per-shot `analyzeForCodification` (cached by `contentHash` in `codification.json`, idempotent re-runs re-pay no model) → `applyCodificationToMeta`; cross-shot `harvestCandidates` → a `reports/<date>-design-ref-codification.md` session report; optional `--scaffold` files each candidate as a `type:idea` item via `backlog.mjs scaffold` (default report-only — the human-ratification boundary, F3). `--min-support=N` (default 3).
- **`scripts/design-refs/__tests__/codification.test.mjs`** (new) — 13 tests via an injected **mock provider**: facet normalization (drop unknown keys, dedup patterns), the provider seam (real / method-absent / `manual` / default-resolved all behave), per-shot idempotent meta fold (+ no-clobber), cross-shot clustering (support floor, distinct-shot counting), report rendering, scaffold descriptor.

**Soft dep handled:** the formal #086 neutral-structure expression stays out of the per-shot pass; promotion proposes **loose** candidates (pattern + supporting shots) for a human to formalise via the new-standard flow.

Verification: `npx vitest run scripts/design-refs/__tests__/codification.test.mjs scripts/design-refs/__tests__/vision.test.mjs` = **29 passed** (13 new + 16 #480, unbroken); `npm run check:standards` = 0 errors. Ran `node scripts/design-refs.mjs codify` against the live 16-shot corpus under the null provider → **16 shots, 0 meta updated, 0 candidates** (the advertised no-op; the corpus was left byte-identical, run artifacts not committed). A real run (a populated `DESIGN_REFS_VISION_PROVIDER` + the corpus) fills facets + harvests candidates — the deferred live boundary.
