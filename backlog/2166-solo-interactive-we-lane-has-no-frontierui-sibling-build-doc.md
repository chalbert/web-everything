---
kind: task
status: resolved
relatedTo: ["1943", "2123", "1933"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
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

**Resolved (2026-07-03):** `we:scripts/lane-pool.mjs` now auto-provisions the render-sibling. `provision`
and `refresh` call a new `ensureFuiSibling(repo)` step that, for the WE pool (identified by its `PORT_BANDS`
entry), symlinks the primary checkout's real `frontierui` (`~/workspace/frontierui`, the sibling of the WE
repo root) into the pool root (`~/workspace/.lanes/web-everything/frontierui`). One symlink at the pool root
serves every `lane-N` — each lane's `../frontierui` resolves to it — so the FIXED relative artifact path in
`we:scripts/lib/component-render-build-hook.cjs` resolves without hand-wiring. Idempotent: a correct existing
link is left untouched, a stale/wrong symlink is repointed, a non-symlink squatting the path is left alone
with a warning, and a missing FUI source warns (build FUI first) rather than failing (the pool stays usable
for non-render work). The manual `ln -sfn …` workaround in `we:docs/agent/testing.md` is now a fallback only;
you still need FUI *built* (`cd ~/workspace/frontierui && npm run build:tools`) — the symlink is automatic.
