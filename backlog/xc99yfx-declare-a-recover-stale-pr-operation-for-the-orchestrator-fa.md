---
kind: story
size: 3
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a recover-pr operation — diagnose a stuck PR's state, apply the matching fix

Surfaced by tonight's (2026-08-17) operations audit, then consolidated per operator direction from three
separately-filed items (this one, the resume-infra-blocked-PR item, and the kill-and-redispatch item) into
one operation — same shape `dispatch-lane` already uses: one `compute` step classifies which stuck-state
applies, `effect` steps apply the matching fix, rather than three independent operations for three symptoms
of the same underlying problem (a PR or its build is stuck and the orchestrating session has to notice and
fix it by hand).

**States to diagnose and their fixes**, each done by hand tonight:

1. **BEHIND-on-generated-file only** (we:scripts/merge-ai-prs.mjs already auto-rebase-drops BEHIND PRs per
   xj800x9's correction, but can't resolve a real we:AGENTS.md inventory conflict) — fetch, merge/rebase
   origin/main, regenerate the inventory, commit, push. Done by hand ~5 times across #1437/#1436/#1426/#1443/#1447.
2. **Stale-review-park** (#2832 auto-re-parks a PR whose head advanced past its reviewed commit, even for a
   purely mechanical rebase with no real content change) — fresh-session-id
   `we:scripts/review-set-label.mjs --to=accepted`. Same 5 PRs, same night.
3. **Infra-blocked with an unusable resumeHandle** (x6hczic's bug: descriptively-named lane refs silently lose
   their infra-block record) — checkout the pushed ref directly, write a fresh body, re-run
   we:scripts/pr-land.mjs. Done by hand 3 times (#1443, #1446, #1450).
4. **Stuck background build behind a never-opened PR** (the dispatch-lane session itself is dead, per
   #3149/#3162's detection) — kill, release the lane, redispatch. Done by hand ~3 times (#3151, #3154, and
   twice for #3150/#3151 again tonight).

**Proving ground (2026-08-17):** rather than fixture-only tests, two live PRs are being deliberately left
in their broken state specifically to prove this operation against real cases once built: #1451 (a clean
BEHIND case) and #1445 (BEHIND *and* `review:human` — a genuine edge case for whether the operation
correctly leaves a human-parked review alone rather than touching its label).

## Done when

1. **Executable** — a `recover-pr` operation (registered in we:scripts/operations/run.mjs, callable as
   `node we:scripts/operations/run.mjs recover-pr --pr=<n>`) reads a PR's `mergeStateStatus`/label state and
   the underlying dispatch session's liveness, classifies which of the four states above applies (or none),
   and performs the matching minimal recovery — a test with one fixture per state asserts the correct branch,
   and a PR matching none is left untouched with a clear "nothing to recover" result.
2. Proven against the two live PRs left open for this purpose (#1451, #1445) before either item's own
   independent resolution — the run record or output names which state it detected and which fix it applied,
   checked against what a human already knows is true about each PR.
3. The command is idempotent — running it twice on an already-recovered PR is a no-op, not a duplicate
   commit, duplicate re-accept, or duplicate redispatch.
4. Depends on #3149 or #3162 for the liveness check (state 4) and on x6hczic for a trustworthy resumeHandle
   (state 3) — this item is the unified diagnose-and-fix surface, not a re-implementation of either.
5. `npm run check:standards` is 0 errors and the relevant new test file is green.
