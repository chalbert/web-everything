---
kind: story
size: 5
status: open
blockedBy: []
locus: webeverything
humanGate: { kind: setup, short: "Build in a focused session that boots its own WE+FUI cross-origin pair on the #1999/6000 + #1997 lane ports.", what: "Acceptance = a headless Playwright run that BOOTS a WE+FUI cross-origin pair (the `.fui-card` frame lands cross-origin only) on the #1997 Fork-2 ports and asserts the frame from the CLI. A concurrent serial batch cannot own that dev-server lifecycle (don't-kill/own-the-user's-dev-server), and the running FUI server is on pre-#1999 ports until a restart this session must not perform — so the harness must spin its own coupled pair. Same 'focused session that owns servers' bucket as #1695/#1696/#1697/#1545. The `fixed pass` fixture is also entangled with the unresolved #1895/#1982 visual state; a faithful #1895 reproduction wants #1982 settled first." }
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Per-lane cross-origin visual render-check in the landing gate (#1895 acceptance)

Implements #1996 Fork 5 (a). Join a headless Playwright render check to the auto-merge landing gate so a visual-touching lane (*.njk/*.css/template surfaces) auto-merges ONLY when it render-verifies on its booted WE+FUI cross-origin pair (Fork 2 ports, so #1997 is a prerequisite). Bounded 'done' = reproduce the #1895 transparent-.fui-card regression AND its fixed pass from the CLI with no human screen. Files under #1933 / the explorer-judge epics #1167/#1552. Catches the gross-regression class only; the human eye still wins on design nuance.

## Grounding — server-owning build, not serial-batchable (batch-2026-06-30)

Prerequisite #1997 (per-lane env-driven ports) is now **resolved**, so `blockedBy` is cleared. But this is the Fork-5 **visual-harness build itself**, and its acceptance makes it a focused-session, server-owning item rather than a serial-batch top-up:

- **It must own a cross-origin dev-server lifecycle.** Acceptance = a headless Playwright run that BOOTS a WE + FUI **cross-origin** pair (the `.fui-card` frame lands cross-origin only, `we:backlog/1895-…`) on the #1997 Fork-2 ports and asserts the frame from the CLI. A concurrent serial batch cannot own that lifecycle (don't-kill/own-the-user's-dev-server), and the user's currently-running FUI server is still on the **pre-#1999** ports (`3001/8082`) until a restart this session must not perform — so the new `6000`-band harness would have to spin its own coupled pair. That is the "focused session that owns servers" pattern (same bucket as the dev-browser items #1695/#1696/#1697/#1545), not a static-gate batch item.
- **The `fixed pass` fixture is entangled with the unresolved #1895/#1982 visual state.** "Reproduce the #1895 regression AND its fixed pass" wants a settled known-good `.fui-card` frame, but #1895 (the dead-CSS sweep) is **reverted** and its prerequisite #1982 (bare-surface `.fui-card` migration) is an **open fork** (see #1982). The harness can self-fixture a synthetic regression, but a faithful #1895 reproduction wants #1982 landed first.
- **It wires the parallel integrator.** The render check joins the auto-merge landing gate in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (the #1933 integrator), a load-bearing surface that itself wants the live multi-lane validation (#1153) to exercise it.

Recommend: build in a focused session that boots its own WE+FUI cross-origin pair on the #1999/6000 + #1997 lane ports, after #1982 settles the `.fui-card` fixture.
