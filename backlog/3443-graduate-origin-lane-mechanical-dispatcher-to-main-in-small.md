---
bornAs: xo83x9i
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
---

# Graduate origin/lane/mechanical-dispatcher to main in small, independently reviewable pieces

origin/lane/mechanical-dispatcher (38 ahead of main, drifts session to session) has accumulated the conveyor runner/dispatch-loop infrastructure via direct pushes, not reviewed PRs -- every #3383 session update has flagged eventual graduation but never started it. Tracks that ongoing graduation: land stable, inert pieces first (e.g. the we:scripts/conveyor/review-round-tag.mjs / we:scripts/conveyor/review-status-tag.mjs informative PR labels, standalone with no we:skills-src/conveyor/runner.mjs wiring); hold back the reconcile-pass runner wiring (the continuous review-dispatch loop, commit 186801a0) until #3437's fix lands on main. Covers the whole ongoing effort, not one PR.

## Done when

1. **Executable** — `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reports `0` on the right (lane-branch-ahead) side: every commit unique to `origin/lane/mechanical-dispatcher` has landed on `main` through its own small reviewed PR, or this item is resolved with an explicit note naming which remaining commits were deliberately dropped/superseded and why.
2. The reconcile-pass runner wiring that dispatches `review`/`fix` continuously on a tick loop (`origin/lane/mechanical-dispatcher`'s `186801a0` and anything layered on it) is not cherry-picked to `main` until `git log main -- we:scripts/conveyor/reconcile-core.mjs` shows the `#3437` name-based-bind fix (or `backlog/3437-*.md` is `status: resolved`) — landing the continuous loop before that fix would reproduce `#3437`'s live double-dispatch bug on `main`'s own runner.
3. Each landed increment is its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline — never a bulk merge of the branch, and never a direct push to `main`.
