---
bornAs: xfs4w9z
kind: story
size: 2
parent: "3484"
status: open
blockedBy: ["3484"]
scope: ["we:scripts/operations/verify.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-04"
tags: []
---

# Fold the gate's request/check modes into the declared we:scripts/operations/verify.mjs operation

**CORRECTION (2026-09-07, see Progress) — the "already fully drafted" claim below is FALSE.** Only the
backlog card (`backlog/xab3jh7-*`) exists on `origin/lane/mechanical-dispatcher`; `git diff` on
`we:scripts/operations/verify.mjs` / `we:skills-src/conveyor/delivery-agent-brief.md` between `main` and the
branch is EMPTY. This is real, un-started implementation work, not a port.

Already fully drafted (unlanded) on origin/lane/mechanical-dispatcher as backlog/xab3jh7-*; re-filed here as a real numbered child once its prerequisite slice lands, rather than cherry-picked verbatim. #3105 added request/check/reset CLI modes to we:scripts/verify-lane.mjs so a dispatched agent hands the long-running gate to the mechanical runner instead of blocking on it (see the sibling slice graduating that work). The delivery brief calls these on the raw script, not the declared verify operation (we:scripts/operations/verify.mjs) -- #3224 flags this as an undelegated raw home, marked @operation-home-ok:#xab3jh7 meanwhile on the branch. Fold request/check into verifys own shape so the brief and any future caller share one declaration, per operations-declared-once-callers-generated in we:docs/agent/platform-decisions.md.

## Done when

1. **Executable** — `we:scripts/operations/verify.mjs` declares a mode (or a sibling operation) covering `request`/`check`, with its own unit tests, and `we:skills-src/conveyor/delivery-agent-brief.md`'s two `@operation-home-ok:` markers for these lines are removed.
2. `npm run check:standards` — 0 errors, and the #3224 rule no longer needs a marker for these two lines.

## Progress

- 2026-09-07: While working #3488 (a sibling #3443 graduation slice), checked this card's "already fully
  drafted (unlanded) on origin/lane/mechanical-dispatcher" claim before queuing it, since the #3443 loop was
  about to treat it as a straightforward port like its siblings. It is not: `git diff origin/main
  origin/lane/mechanical-dispatcher -- we:scripts/operations/verify.mjs
  we:skills-src/conveyor/delivery-agent-brief.md` is empty — the branch carries only the `backlog/xab3jh7-*`
  planning card (also `status: open`, no implementation), not the working code this card's prose implies. Whoever
  builds this needs to design and write `we:scripts/operations/verify.mjs`'s `request`/`check` mode from
  scratch, using the already-landed `we:scripts/verify-lane.mjs`/`we:scripts/conveyor/verify-dispatch.mjs`
  (#3484) as the reference shape, not go hunting for a branch port that does not exist. Queued into the live
  conveyor regardless (it is unblocked, #3484 landed) — flagging here so the builder budgets real design time.
