---
bornAs: xc99yfx
kind: story
size: 5
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
   3166's correction, but can't resolve a real we:AGENTS.md inventory conflict) — fetch, merge/rebase
   origin/main, regenerate the inventory, commit, push. Done by hand ~5 times across #1437/#1436/#1426/#1443/#1447.
2. **Stale-review-park** (#2409's `staleAcceptance` re-park — we:scripts/merge-ai-prs.mjs:209-213 — fires
   whenever the head advances past the reviewed commit, even for a purely mechanical rebase with no real
   content change, and is deliberately never waivable by the pending-relief valve) — fresh-session-id
   `we:scripts/review-set-label.mjs --to=accepted`. Same 5 PRs, same night.
3. **Infra-blocked with an unusable resumeHandle** (3169's bug: descriptively-named lane refs silently lose
   their infra-block record, so there is often NO PR yet to address by number — we:lane/resolve-3015-stale-status
   sat unresumed for exactly this reason tonight) — checkout the pushed lane ref directly, write a fresh body,
   re-run we:scripts/pr-land.mjs. Done by hand 3 times (#1443, #1446, #1450). Addressed by **ref name**, not PR
   number — resume from the ref alone, never assuming a trustworthy resumeHandle exists (that assumption is
   exactly 3169's bug).
4. **Stuck background build behind a never-opened PR** (the dispatch-lane session itself is dead, per
   #3149/#3162's detection — no PR exists to address by number here either) — kill, release the lane,
   redispatch. Done by hand ~3 times (#3151, #3154, and twice for #3150/#3151 again tonight). Addressed by
   **backlog item number**, matching `dispatch-lane --num=<item>`'s own addressing.

**Proving ground (2026-08-17):** rather than fixture-only tests, two live PRs are being deliberately left
in their broken state specifically to prove this operation against real cases once built: #1451 (a clean
BEHIND case) and #1445 (BEHIND *and* `review:human` — a genuine edge case for whether the operation
correctly leaves a human-parked review alone rather than touching its label).

## Done when

1. **Executable — three addressing modes, not one.** A `recover-pr` operation (registered in
   we:scripts/operations/run.mjs) accepts `--pr=<n>` (states 1–2, a PR already exists), `--ref=<lane-ref>`
   (state 3, resumes from the ref name alone — never assumes a resumeHandle exists, per 3169), and
   `--num=<item>` (state 4, matching `dispatch-lane --num=<item>`'s own addressing) — a single `--pr=<n>`-only
   interface cannot reach states 3 or 4, both of which have no PR yet by definition. A test per addressing mode
   asserts the operation reads the right input and classifies correctly.
2. Each state's fixture test asserts the correct branch: a `mergeStateStatus`/label fixture for states 1–2, a
   pushed-ref-no-PR fixture for state 3, and a dead-session fixture for state 4. A **fifth, safety-critical**
   fixture — a background session that's merely slow, not dead — asserts the operation explicitly refuses to
   kill it, distinct from the generic "matches none of the four states" no-op.
3. Proven against the two live PRs left open for this purpose (#1451, #1445) before either item's own
   independent resolution — the run record or output names which state it detected and which fix it applied,
   checked against what a human already knows is true about each PR.
4. The command is idempotent — running it twice on an already-recovered PR is a no-op, not a duplicate
   commit, duplicate re-accept, or duplicate redispatch.
5. Depends on #3149 or #3162 for the liveness check (state 4) — this item is the unified diagnose-and-fix
   surface, not a re-implementation of either.
6. `npm run check:standards` is 0 errors and the relevant new test file is green.
