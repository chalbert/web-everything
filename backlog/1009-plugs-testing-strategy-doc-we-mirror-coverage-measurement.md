---
kind: story
size: 3
parent: "1002"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:docs/agent/plugs-testing-strategy.md"
tags: []
---

# Plugs testing-strategy doc + WE-mirror coverage measurement

Foundational slice of #1002. Author `we:docs/agent/plugs-testing-strategy.md` (unit happy-dom vs e2e real-browser layering, plugged-vs-unplugged per layer, per-plug coverage bar, patch-interaction invariants, new-plug checklist) AND measure the WE `we:plugs/` mirror per-plug coverage in both modes — producing the per-plug gap table the FUI snapshot lacks. This artifact defines the bar and exposes the per-plug seams for the deferred coverage wave (re-/slice #1002 after this lands).

## Progress (batch-2026-06-18)

- Authored `we:docs/agent/plugs-testing-strategy.md` — the two axes (unplugged vs plugged #606; unit/
  happy-dom vs e2e/real-browser), the per-plug bar (dual-mode gate + 80% aggregate floor + patch-
  interaction invariants + e2e expectation), the patch-interaction invariant list (#960 `Node.*`-statics
  class, the #1011 harness scope), and the new-plug checklist.
- **Measured the WE `we:plugs/` mirror** (11 domains) via the gate's own dual-mode classification +
  src-module / unit-file / unit-case counts → the per-plug gap table in the doc. Finding: **all 11 plugs
  now clear the #606 dual-mode gate**; the open seam is the **real-browser e2e** layer — five plugs are
  unit/unplugged-only (webvalidation, webdirectives, webexpressions, webguards, webanalytics) — plus a
  thin-plug tail (webexpressions: 8 modules / 5 unit files). #1010 fills webvalidation's e2e; #1011 builds
  the cross-plug patch-interaction harness.
- Per-plug line-% is governed by the single 80% aggregate in `we:vitest.config.ts`; a clean one-shot
  per-plug line breakdown needs a quiescent tree (full happy-dom suite green), so it is captured per-plug
  as each coverage slice lands rather than snapshotted here (noted in the doc). #1002 re-slice deferred to
  its own turn — #1010/#1011 are already its first two slices.
