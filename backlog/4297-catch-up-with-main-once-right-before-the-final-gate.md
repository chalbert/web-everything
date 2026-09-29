---
bornAs: xwktayt
kind: story
size: 3
status: resolved
scope: ["we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Catch up with main once, right before the final gate

Evidence: inside the same 48-minute daemon-fix session card 4294 documents, a mid-work merge of main (#2818/#2819 landing meanwhile) forced a fresh full we:scripts/verify-lane.mjs run under today's exact-sha marker keying and conflicted on we:scripts/operations/ci-heal-pr-dispatch.mjs. Change the generic worker/fixer procedure (we:skills-src/conveyor/delivery-agent-brief-v2.md, we:skills-src/conveyor/delivery-agent-brief.md, we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md) so a lane merges origin/main at most once, immediately before the final gate, never speculatively mid-work, unless an active conflict is actually blocking the worker's own edits (the sole sanctioned exception). Pairs with 4296 (marker keying) so an unavoidable mid-work merge that touches none of the lane's files does not cost a re-run either way; this card is the procedure change, that one is the marker mechanism.

## Done when

1. **Executable** — after this item lands, the ONLY command anyone ever needs is the plain green check:
   `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest related
   we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs --run --passWithNoTests` (stays green
   forever after, since the four briefs now carry the policy). The RED/GREEN proof below is the ONE-TIME
   verification this delivery itself used before landing — a `git stash` dance that only makes sense
   pre-commit, while the four brief edits are still uncommitted local changes; it is NOT a perpetual command
   to re-run post-land (nothing would be left to stash). Reproduce that pre-land RED state by stashing only
   the four brief edits (never the test file itself — an absent test file would exit 0 under
   `--passWithNoTests`, not fail):
   ```bash
   # run from the WE checkout root, ONLY while the four brief edits below are still uncommitted local
   # changes (i.e. before/during this delivery, never after it has landed on main):
   git stash push -- skills-src/conveyor/delivery-agent-brief-v2.md skills-src/conveyor/delivery-agent-brief.md \
     skills-src/conveyor/fix-agent-brief.md skills-src/conveyor/fix-agent-ci-brief.md
   node scripts/readiness/heavy-admission.mjs run -- npx vitest related \
     scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs --run --passWithNoTests   # RED: 7 failures
   git stash pop
   node scripts/readiness/heavy-admission.mjs run -- npx vitest related \
     scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs --run --passWithNoTests   # GREEN: 7 pass
   ```

## Progress

- Added an explicit "catch up with `main` once, immediately before the gate" step/callout to all four briefs
  (`we:skills-src/conveyor/delivery-agent-brief.md` step 4a — reworked so the exception and the normal case are
  explicitly alternatives, never additive, after review found the first draft's wording implied a possible
  second merge; `we:skills-src/conveyor/delivery-agent-brief-v2.md`'s wrapper-does-it-once-after-`done`-report
  note; a tightened paragraph in `we:skills-src/conveyor/fix-agent-brief.md` step 3; a note on
  `we:skills-src/conveyor/fix-agent-ci-brief.md` step 2 explaining why its single rebase is front-loaded rather
  than gate-adjacent, and why no mid-run exception applies there).
- Added `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs` (7 `it` cases across the four briefs:
  3 for the delivery brief, 1 each for v2 and the fix brief, 2 for the ci-heal fix brief) asserting all four
  state the policy. Verified RED against the pre-edit files (all 7 failed) and GREEN after the edits (all 7
  pass), plus the pre-existing `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` (94 tests)
  still green.
- Ran `/converge` (care=elevated) over the diff across three panel+red-team passes (two runs after driving
  mistakes of my own — resent stale material once, dropped a required carry-forward field once — cost nothing
  but a re-init; neither was a finding about the delivered content). Fixed every concrete defect surfaced:
  - Round 1 (first pass): a genuine self-contradiction in the first draft of
    `we:skills-src/conveyor/delivery-agent-brief.md`'s step 4a ("at most once" sitting next to an exception
    that was itself a second merge) — reworded so the exception and the normal case are explicit alternatives.
  - Round 1 (second pass): the Done-when's stated test count (4) didn't match the actual file (7 `it` cases);
    a factually wrong claim in `we:skills-src/conveyor/fix-agent-ci-brief.md` that `--force-with-lease` guards
    against `main` advancing (it guards the remote branch ref, not `main`) — removed; a brittle test regex
    that hard-coded a markdown line-wrap position — loosened.
  - Round 1 (third pass): the Done-when's `git stash` reproduction read as a perpetual command, but it only
    works pre-land (nothing to stash once the four briefs are committed) — reworded to state the plain
    post-land regression command separately from the one-time pre-land RED/GREEN proof.
  - Dismissed, with reasons, findings that recurred without a code fix resolving them: (1)
    `we:skills-src/conveyor/fix-agent-brief.md` only touches `main` when a conflict already blocks it, unlike
    the delivery brief's unconditional pre-gate merge — intentional, since the fix brief reconstitutes an
    already-open PR's ref rather than forking fresh from `main`, so an unconditional merge there would be a
    scope increase beyond this card's evidenced problem (speculative mid-work merges in build/fix sessions),
    and its conflict-gated behaviour already satisfies "at most once, never speculative"; (2)
    `we:skills-src/conveyor/delivery-agent-brief-v2.md`'s wrapper-catch-up note describes behaviour no code in
    this diff implements or tests — expected and disclosed by that file's own header ("a PROTOTYPE, not a live
    template... not spawned by the conveyor"): every bullet in it describes a not-yet-built wrapper, and
    holding this one new sentence to a higher bar than the rest of the file would be inconsistent, not a real
    gap; (3) a couple of absolute claims ("the only point in this brief where...") cannot be verified from a
    diff view alone — true of prose review in general, not specific to this change.
