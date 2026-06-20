---
type: idea
workItem: story
size: 5
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/oracles/tier2VlmJudgeModel.ts"
crossRef: { url: /backlog/1176-layer-2-conformance-vector-oracle-layer-3-advisory-llm-judge/, label: "#1176 Layer-3 advisory-judge seam (resolved) — this is its first real model" }
tags: [fui-devtool, exploratory-testing, vision, tier-2-vlm, on-device, no-leakage]
---

# Tier2VlmJudgeModel — wire the on-device Tier-2 VLM as the explorer Layer-3 advisory judge

Give the autonomous tester's Layer-3 advisory judge real eyes — the **on-device Tier-2 VLM** (epic #1073), not a hosted API. The `JudgeModel` seam in `fui:tools/explorer/oracles/advisoryJudge.ts` was built for exactly this swap ("hosted/on-device judge is a swap, not a rewrite") and ships only the inert `NullJudgeModel`. Implement a `Tier2VlmJudgeModel` adapter fulfilling `JudgeModel.judge(...)` by driving the resolved Tier-2 provider — `analyzeRich({pngBase64, dims})` at `we:scripts/design-refs/providers/transformers-vlm.mjs` (#1082, Florence-2) — and mapping its rich envelope (description / tags / regions / critique) into `AdvisoryCandidate[]`. Wired into the explore harness, **explore mode only** (#1172 keeps the deterministic close gate at Layer-1).

## Design realities (settled in the discussion, not forks)

- **Browser-side execution.** Tier-2 is WebGPU + the HF Transformers in-browser runtime + an opt-in ~2 GB model download — it runs *in a page*, not in Node. The adapter runs the VLM via Playwright `page.evaluate()` inside the driven (or a sidecar) page; the Node-side `Tier2VlmJudgeModel` just proxies into it and passes the per-state screenshot. The resolved demo `we:demos/tier2-vlm-demo.html` (#1142) already proves this in-browser path.
- **Rides the provider, not the open epic.** Tier-2 the epic (#1073) is still open/unsliced, but the provider core (#1082) and demo (#1142) are resolved and runnable — this is their **first real consumer**, no wait on #1073.
- **No-leakage compliant.** Vision is a Plateau no-leakage service (#475): the adapter consumes vision *outputs* (the critique envelope) through the provider seam; the capability never crosses into the standard. Advisory output stays `severity:'advisory'`, never a gate verdict — matching Tier-2's device-gated, opt-in, dev-browser-only nature (unrunnable in CI, which is fine for an explore-mode-only layer).

Scope is the **judge (eyes)** role — flag/rank bad-looking states the explorer reaches. Tier-2 as a *navigator* (deciding where to click next) is out of scope (Florence-2 tags/describes, it doesn't plan actions) — that would need an action-policy layer, filed separately if wanted. Blocked on #1219 for a runnable explore-mode entrypoint to exercise it.

## Resolved 2026-06-20 (batch-2026-06-20-1232-1220-1221)

Shipped `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts` — the first real `JudgeModel` (the seam's inert `NullJudgeModel` was the only impl). Pieces:
- **`Tier2VlmJudgeModel implements JudgeModel`** — a pure proxy: hands the per-state screenshot to an injected `RichVisionAnalyzer`, maps the envelope to `AdvisoryCandidate[]`.
- **`envelopeToCandidates`** — the real logic: maps the Florence-2 envelope (`description` / `tags` / `regions`, the #1080 contract shape) to advisory candidates. Honest scoping: Florence-2 *describes/tags/detects* — it does **not** emit a `critique` (the report's "critique" field doesn't exist on the provider), so the judge's "eyes" role here SURFACES the VLM's read of each state for human triage (description = primary candidate, low confidence), rather than asserting defects the model can't diagnose.
- **`playwrightTier2Analyzer(vlmPage, fallbackCapture)`** — the device-gated bridge: proxies a screenshot into `vlmPage.evaluate(() => window.__tier2AnalyzeRich(png))` (the #1142 in-browser WebGPU + HF-Transformers Florence-2 path) and reads the envelope out. Node side holds no SDK/model (no-leakage #475). WebGPU + ~2 GB download → unrunnable in CI, so it's injected + NOT unit-covered; the mapping it feeds IS.
- **Explore-harness wiring (explore-only):** `exploreAndAudit` gained an optional `judge?: JudgeModel` (run per state, accumulated into a new `AuditResult.advisory`, never the gate-eligible `findings`); `stressTestComponent` threads it; the GATE runner passes none, so #1172's deterministic Layer-1 close gate is untouched.

**Boundary note:** the rich envelope is replicated as a TYPE in FUI (`RichVisionEnvelope`) — the contract crosses the WE→FUI seam, the `we:scripts/design-refs/providers/transformers-vlm.mjs` runtime never does. **Verified:** `tsc` clean; 46/46 explorer tests pass incl. 9 new `fui:tools/explorer/oracles/__tests__/tier2VlmJudgeModel.test.ts` (mapping, data-URL strip, proxy, advisory-only composition, throwing-analyzer degradation). The live 2 GB Florence-2 run is device-gated/explore-only by design (not exercised here). Graduated to `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts`.
