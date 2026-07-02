---
kind: task
status: open
relatedTo: ["1943", "2123", "1933"]
dateOpened: "2026-07-02"
tags: [lanes, cross-repo, build, frontierui, dx]
---

# Solo/interactive WE lane has no frontierui sibling — build:docs & 11ty dev-serve hard-fail

#1943 (resolved) provisions per-repo lane pools when the **orchestrator** detects an item whose *impl* spans
the constellation. But a #2123 **solo/interactive** lane — an ad-hoc WE-docs-only edit picked into a WE lane,
never dispatched by the `/workflow` orchestrator — still fails to build: `we:scripts/lib/component-render-build-hook.cjs`
resolves the pinned FUI artifact `fui:dist/tools/component-render/cli.mjs` **relative to the lane's parent dir**,
and the WE lane pool (`~/workspace/.lanes/web-everything/lane-N`) has **no** `frontierui` sibling there. Result:

```
[component-render build] pinned FUI artifact missing — Wrote 0 files.
```

So `build:docs`, `eleventy --serve` (the #2123 lane dev-pair), and any rendered/visual verification are blocked
in a solo WE lane until FUI is present next to it.

**Manual workaround in use (2026-07-02):** symlink the real built FUI next to the WE lanes —
`ln -sfn ~/workspace/frontierui ~/workspace/.lanes/web-everything/frontierui` (requires FUI built via its
`build:tools`). Documented in `we:docs/agent/testing.md`.

**Fix:** `we:scripts/lane-pool.mjs provision` should ensure the FUI sibling for the WE pool (symlink the
primary's `frontierui`, or provision + build a FUI reference clone) so a solo WE lane builds without hand-wiring.
The render dependency is **unconditional** — every grid page SSRs via the FUI component-render CLI, independent
of whether the *edited* item's impl spans FUI — so it can't be gated behind orchestrator affected-repo detection.
