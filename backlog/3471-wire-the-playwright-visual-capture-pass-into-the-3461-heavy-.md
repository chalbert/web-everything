---
bornAs: x0s20du
kind: task
status: open
blockedBy: ["3461"]
scope: ["plateau-app:tests/visual/capture.mjs"]
dateOpened: "2026-09-03"
tags: []
---

# Wire the Playwright visual-capture pass into the #3461 heavy-command admission queue

#3461 built the heavy-command admission queue (we:scripts/readiness/heavy-admission.mjs) and wired it into WE's own check:standards/test:unit gate run (we:scripts/verify-lane.mjs), but the Playwright visual-capture pass named in #3456's closed heavy-command set lives in plateau-app, outside #3461's we:-only scope. This item wires plateau-app:tests/visual/capture.mjs to acquire/release a slot from the SAME shared admission queue (via its CLI, node we:scripts/readiness/heavy-admission.mjs acquire/release --repo=<checkout>) around the actual Playwright render pass, so all three named heavy commands are gated by one cap, not two of three.

## Done when

1. **Executable** — `plateau-app:tests/visual/capture.mjs` calls the admission queue (directly via its exported
   functions if importable cross-repo, else by shelling `node we:scripts/readiness/heavy-admission.mjs acquire
   --repo=<checkout> --lane=<n>` / `release`) around the actual Playwright render, mirroring the wiring
   `we:scripts/verify-lane.mjs` already does around its `execSync(GATE, …)` call. A regression test proves it:
   spawn N concurrent stubbed capture invocations past the shared cap and assert the plateau-app capture never
   exceeds its share of the same admission queue a concurrent `we:scripts/verify-lane.mjs` run is also drawing
   from (a cross-repo contention scenario, not just an in-repo one) — fails before this item lands (the capture
   script has no admission wiring at all), passes after.
2. **Assertable** — the PR body confirms all three heavy commands named by #3456 (`check:standards`,
   `verify-lane`/`test:unit`, the Playwright visual-capture pass) now draw from the SAME shared admission queue
   and cap, closing the one deferred piece #3461 named at build time.
