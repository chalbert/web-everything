---
kind: story
size: 2
status: open
dateOpened: "2026-08-02"
relatedTo: ["2884", "2883", "2409", "2198"]
tags: [backlog, review, gate, fork, batchable]
scope:
  - we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md
  - we:backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md
---

# Carve #2884's three-option fork into a decision item and repair the scope it leaves unsound

#2884 weighs three options with no default while computing `batchable`, and its declared scope covers only one of the three — so a build agent gets an item with nothing to build and a lease that is wrong for the two options the item itself prefers.

## Where this came from

A `/review` pass over PR #1003, red-teamed afterwards. This is one of the three findings of six that
survived. The red-team tried hard to refute it — checked the real `batchable` derivation, checked whether
the existing lint already catches it, checked whether an outcome-stated Definition of done excuses a missing
default — and every angle failed.

## The fork is live and the item is dispatchable

[we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md](backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md)
lists three options — content-keyed coverage via patch-id, keep sha-identity and remove the race, or
auto-re-stamp on a provably-identical rebase — all three bolded, so bolding marks no default. Its closing
line states only a negative constraint ("this should not be filed as switch-to-patch-id"), never a pick.

It is nonetheless dispatchable. Running the real loader,
[we:src/_data/backlog.js](src/_data/backlog.js#L461) derives `{ tier: 'A', batchable: true }` for #2884
(`story` + `size <= 8` + clear blockers + no `projectPending` + no human gate). So the conveyor hands it to
a build agent that has three approaches and no ruling — the stop-risk
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md#L514) names for exactly this shape.

[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md#L541) is the governing rule: "A fork
lives in a `kind: decision` item — never inline in an idea/epic/story body… Carve instead: (1) scaffold a
separate `kind: decision` item holding the fork(s) in the prepared-fork shape (options + bold default +
concrete refs); (2) make the original `blockedBy` that decision; (3) trim the fork out of the original's
body."

## The scope is the proof, not just the discipline

This is what makes it more than an authoring nit. #2884's `scope` is
`[we:scripts/lib/review-escalation.mjs]` — which covers **option 1 only**. Option 2 ("do not rebase a PR
that carries a live acceptance") and option 3 ("the drain re-stamps the marker") both live in the
drain/lander, `we:scripts/merge-ai-prs.mjs` and `we:scripts/lane-drain.mjs`, outside the declared lease. The
item's own body says the second and third are the ones that keep #2409's safety posture intact. So the
unmade choice leaves the machine-read field wrong for the two options the item prefers.

## #2883 carries a milder instance of the same shape

[we:backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md](backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md)'s
third Definition-of-done bullet — "The operator retains a documented way out, and it is named in the refusal
message" — names no way out, and its body defers the choice ("it should be a deliberate call, not a side
effect. Cross-check with the sibling question in the companion item"). A build agent would have to invent
the escape hatch for a gate whose whole purpose is refusing waivers. It is also a genuinely cross-item fork:
which escape survives depends on how #2884's fork is ruled.

## Definition of done

- A `kind: decision` item holds #2884's fork in the prepared-fork shape — the three options with their
  stated tradeoffs, a **bold default**, and the concrete refs already gathered in #2884's body.
- #2884 is `blockedBy` that decision and the fork is trimmed out of its body, leaving the evidence (the
  #983 livelock: `main` advanced four times in ~20 minutes, the #2198 rebase-drop re-rebased each time, the
  acceptance never converged) which is what #2884 is genuinely for.
- #2884's `scope` matches whichever option the decision rules — including `we:scripts/merge-ai-prs.mjs` /
  `we:scripts/lane-drain.mjs` if it lands on option 2 or 3.
- #2883's third DoD bullet either names the operator escape or is made `blockedBy` the same decision, so it
  no longer reads as buildable while the call is open.
- Neither item still computes `batchable: true` while carrying an open fork.
