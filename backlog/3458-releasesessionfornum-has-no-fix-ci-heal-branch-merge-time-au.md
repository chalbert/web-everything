---
bornAs: xm33exe
kind: task
status: open
blockedBy: ["3332"]
relatedTo: ["3165"]
scope: ["we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-02"
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# releaseSessionForNum has no fix/ci-heal branch — merge-time auto-release would use the wrong session slug

`we:scripts/conveyor/tick-core.mjs#releaseSessionForNum` derives the lane-lease session slug a merged PR's
watcher hands `pr-watch --release-session` to auto-release at merge (#2700). It branches only on
`prepareKindByNum` (`prepare-decision-<num>` / `prepare-<num>` / else `conveyor-<num>`) — built solely from the
LIVE PREPARE guards (`we:scripts/conveyor/tick-core.mjs:605`). It has no branch for a fix or CI-heal dispatch,
whose slug (`we:scripts/operations/dispatch-lane.mjs#sessionSlugFor`, wired by #3332) is `fix-<pr>` /
`ci-heal-<pr>` — keyed on the PR, not the item, and not derivable from `prepareKindByNum` at all. Its own
docblock already asserts the aspirational shape ("A fix lease (`fix-<num>`) … ride the periodic lease-reaper
backstop") without the code to back it.

**Filed as a named, non-waived cost of #3332** (which routes `fix`/`ci-heal` dispatch through
`we:scripts/operations/dispatch-lane.mjs` for the first time): #3332 does not strand a fix/ci-heal agent's own
freshly-acquired repair lane at merge, because that lane is never watcher-auto-released to begin with — both
fix briefs (`we:skills-src/conveyor/fix-agent-brief.md`, `we:skills-src/conveyor/fix-agent-ci-brief.md`)
explicitly say "Do NOT release the lane" and rely on the periodic lease-reaper stall backstop instead, same as
a build's lane. So this gap is real but latent: it costs nothing until something ELSE calls
`releaseSessionForNum` for a PR whose owning dispatch was a fix/ci-heal — e.g. a future auto-release path, or a
person reading the function's own claim about what it does.

## Done when

1. **Executable** — a unit test in `we:scripts/conveyor/__tests__/tick-core.test.mjs` (or the file that already
   covers `releaseSessionForNum`) that hands it a `num` with a live fix/ci-heal guard and asserts the slug
   matches `fix-<pr>` / `ci-heal-<pr>` from `we:scripts/operations/dispatch-lane.mjs#sessionSlugFor` — failing
   before this item lands (today it falls through to `conveyor-<num>`), passing after.
2. `releaseSessionForNum`'s own docblock no longer states a shape (`fix-<num>`) the code does not implement —
   it either implements the PR-keyed slug or corrects the docblock to say the gap is still open, not both.
