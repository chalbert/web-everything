---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# HIGH: stacked-base conflict-fix cap hardcodes currentSha null, exhausting the cap across different tips

HIGH — can suppress a stacked PR's repair indefinitely once the cap is exhausted against stale tips. Still-open Codex advisory finding from chalbert/web-everything#2797 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/conveyor/reconcile-core.mjs's conflict-fix dispatch has two branches that call countStaleConflictFixRounds(pr?.comments, { currentRef, currentSha }) to decide whether a round counted against a PR still targets the SAME conflict (and so should count against the smaller per-target cap) or a genuinely NEW one (and should only count against the hard ceiling). The main-base branch correctly threads a real, freshly-resolved SHA (currentSha: mainSha, resolved once per pass via resolveMainSha). The STACKED-base branch — for a PR conflicting against its own stacked lane base rather than the default branch — still hardcodes currentSha: null, so countStaleConflictFixRounds's sha-vs-sha comparison never fires and every recorded round matching the ref alone counts as "the same conflict", even across repairs run against DIFFERENT, since-rebased tips of that same stacked base. Three repairs against three different tips of a repeatedly-rebased stacked base exhaust the smaller per-target cap and the PR is refused further mechanical repair, even though each repair genuinely targeted a NEW tip and none of them was actually stale.

EVIDENCE: read the stacked-base conflict-fix branch directly off origin/main in we:scripts/conveyor/reconcile-core.mjs — it still calls countStaleConflictFixRounds(pr?.comments, { currentRef: baseRefName, currentSha: null }), in contrast to the main-base branch a few hundred lines later in the same file, which passes { currentRef: defaultBranch, currentSha: mainSha }.

PREVENTION (from the reviewer, still owed): resolve a real per-PR base SHA for the stacked-base branch too (e.g. locally resolving origin/<baseRefName>, mirroring resolveMainSha) and add a deterministic planReconcile regression test with three recorded repairs against successively older SHAs of the same stacked base plus a known newer current base SHA, asserting dispatch still proceeds below the absolute ceiling.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
