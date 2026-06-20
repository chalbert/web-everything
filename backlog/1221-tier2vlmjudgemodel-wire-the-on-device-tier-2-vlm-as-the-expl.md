---
type: idea
workItem: story
size: 5
locus: frontierui
status: open
dateOpened: "2026-06-20"
crossRef: { url: /backlog/1176-layer-2-conformance-vector-oracle-layer-3-advisory-llm-judge/, label: "#1176 Layer-3 advisory-judge seam (resolved) — this is its first real model" }
tags: [fui-devtool, exploratory-testing, vision, tier-2-vlm, on-device, no-leakage]
---

# Tier2VlmJudgeModel — wire the on-device Tier-2 VLM as the explorer Layer-3 advisory judge

Give the autonomous tester's Layer-3 advisory judge real eyes — the **on-device Tier-2 VLM** (epic #1073), not a hosted API. The `JudgeModel` seam in `fui:tools/explorer/oracles/advisoryJudge.ts` was built for exactly this swap ("hosted/on-device judge is a swap, not a rewrite") and ships only the inert `NullJudgeModel`. Implement a `Tier2VlmJudgeModel` adapter fulfilling `JudgeModel.judge(...)` by driving the resolved Tier-2 provider — `analyzeRich({pngBase64, dims})` at `we:scripts/design-refs/providers/transformers-vlm.mjs` (#1082, Florence-2) — and mapping its rich envelope (description / tags / regions / critique) into `AdvisoryCandidate[]`. Wired into the explore harness, **explore mode only** (#1172 keeps the deterministic close gate at Layer-1).

## Design realities (settled in the discussion, not forks)

- **Browser-side execution.** Tier-2 is WebGPU + Transformers.js + an opt-in ~2 GB model download — it runs *in a page*, not in Node. The adapter runs the VLM via Playwright `page.evaluate()` inside the driven (or a sidecar) page; the Node-side `Tier2VlmJudgeModel` just proxies into it and passes the per-state screenshot. The resolved demo `we:demos/tier2-vlm-demo.html` (#1142) already proves this in-browser path.
- **Rides the provider, not the open epic.** Tier-2 the epic (#1073) is still open/unsliced, but the provider core (#1082) and demo (#1142) are resolved and runnable — this is their **first real consumer**, no wait on #1073.
- **No-leakage compliant.** Vision is a Plateau no-leakage service (#475): the adapter consumes vision *outputs* (the critique envelope) through the provider seam; the capability never crosses into the standard. Advisory output stays `severity:'advisory'`, never a gate verdict — matching Tier-2's device-gated, opt-in, dev-browser-only nature (unrunnable in CI, which is fine for an explore-mode-only layer).

Scope is the **judge (eyes)** role — flag/rank bad-looking states the explorer reaches. Tier-2 as a *navigator* (deciding where to click next) is out of scope (Florence-2 tags/describes, it doesn't plan actions) — that would need an action-policy layer, filed separately if wanted. Blocked on #1219 for a runnable explore-mode entrypoint to exercise it.
