---
bornAs: xg5ml6o
kind: task
parent: "3383"
status: active
dateOpened: "2026-09-01"
dateStarted: "2026-09-02"
tags: []
scope:
  - we:skills-src/conveyor/delivery-agent-brief.md
  - we:scripts/backlog.mjs
---

# A build-dispatch agent whose PR merges must resolve its own backlog item, not leave it active forever

Found live 2026-09-01, closing out this same session. `#3412`'s own build agent (`conveyor-3412`) opened
`PR #1765`, which merged hours ago — but the backlog item stayed `status: active` and the dispatched session
stayed `state: working` the entire time, never releasing its lane, never resolving the item, never exiting.
Both had to be cleaned up by hand at session close (`claude stop`, then `node we:scripts/backlog.mjs resolve`).
The operator, 2026-09-01: "we'll have to make sure our mechanic closes the item once done." Distinct from
`#3435` (mechanically REAP a finished session's process registration) — this is about the ITEM's own
status, not the session's; a dispatch could in principle exit cleanly while still leaving its backlog item
`active` forever, or vice versa. Related, not the same gap.

## Done when

1. **Executable** — `we:skills-src/conveyor/dispatched-agent-system-prompt.md` (or the build-dispatch brief,
   wherever the actual "your job is done" step lives) instructs a dispatch to resolve the backlog item it
   built (`node we:scripts/backlog.mjs resolve <NNN> --graduated-to=<what it became>`) as part of its own
   normal exit sequence, once its PR has actually merged — not just release the lane and stop.
2. A real test or a live-fire proof that a build dispatch's own item transitions to `resolved` without a
   human doing it by hand, mirroring how `#3412` had to be resolved manually tonight.

## Progress

- **Status:** built, PR open — pending drain.
- **Root cause found, not the one guessed at filing time.** The resolve-on-land mechanism already existed
  (`resolveLandedItem`, #2748/#2899) and the label lander (`we:scripts/merge-ai-prs.mjs`, the drain
  `ready-to-merge` actually runs) already called it — but only for `we:.lane-manifest.json`-carrying PRs
  (cross-locus couples). A **plain single-locus WE PR** — the delivery-agent-brief's default path, and what
  `#3412` was — carries no manifest, so `v.item` was always `null` for it and it never entered
  `landedThisPass` at all. The gap was never "the dispatch doesn't resolve its own item at exit" (the brief's
  exit sequence never waits for the merge in the first place — waiting would contradict its own
  exit-without-merging guardrail); it was "the drain's already-built resolve-on-land only recognized couples."
- **Fix:** `we:scripts/merge-ai-prs.mjs` — new pure `landedIdsForCandidate(c, { isLocalRepo })`, reusing the
  already-single-sourced `itemNumsFromPr` branch/title extractor (`we:scripts/lib/open-pr-items.mjs`) to derive
  an item id for a non-manifest WE-repo merge, restricted to the local repo so a cross-locus impl half never
  self-resolves. Wired into the 3 `landedThisPass` call sites in the merge cascade. `planResolveOnLand` needed
  no change — it was already generic over non-couple ids.
- **Proof:** 9 new unit tests in `we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs` covering the manifest
  path (unchanged), the plain single-locus path (the `#3412` shape, from both headRef and title), the
  impl-half exemption, batch refs, and the empty/null edges. A live end-to-end proof needs an actual PR merge
  through the resident drain, which this session cannot trigger.
- **`we:skills-src/conveyor/delivery-agent-brief.md` / `we:scripts/backlog.mjs` (the predicted scope) were not
  touched** — the fix lives entirely on the drain side; nothing about the delivery agent's own exit sequence
  needed to change.
