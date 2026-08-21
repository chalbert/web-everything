---
bornAs: xa7ygu6
kind: task
parent: "2288"
status: open
dateOpened: "2026-08-21"
tags: []
---

# check:standards errors on stranded hashes during the drain window, training the operator to race the drain

The drain JIT-numbers a merged PR's cards in a **separate commit** pushed some minutes after the merge commit. In that window main legitimately carries hash-named cards, and `strandedHashesOnMain` (`we:scripts/check-standards-rules.mjs`) reports each one as an **error** whose remedy text names `node we:scripts/backlog.mjs number-stranded`.

Running it there races the drain. Both allocate from the same free-number pool against **different views of main**, and neither takes a lock.

## Twice this session, both outcomes

- **Diverged.** Main's drain gave `3250` → #3250; a local `number-stranded` run, started before that commit was visible, gave it #3251 and handed #3250 to a different card. Result: `#3250` used by two files and `3250` as the `bornAs` of two cards. CI went red on PR #1523 — caught by the `duplicateBornAs` gate added in #1519, which is the only reason it did not land. Repair cost a revert, a rebase and two `--skip`s.
- **Agreed by luck.** An hour later, three cards from #1523 (`3251`, `3252`, `3253`) showed the same error. A local run numbered them #3251/#3252/#3253; the drain's own commit landed ~1 minute later with **identical** numbers, because both happened to walk the same allocation order. The local commit rebased away as already-applied. No damage, and no mechanism prevented damage — the two runs simply did not interleave.

The second case is the concerning one: it looks like the workflow working.

## Why this is the error text's problem

The check cannot see whether a drain is in flight, so it reports a transient state in the same words and at the same severity as a permanent one, and it prescribes the action that causes the collision. An operator following the message exactly is doing the wrong thing most of the time, because most stranded hashes on main are seconds old and about to be numbered by their own drain.

Nothing here argues the check is wrong to notice — a genuinely stranded hash IS an error (#2319). The question is how to tell the two apart.

## Directions (not ruled)

- **Age the finding.** A hash whose card landed within the drain's window is a `warn` naming the in-flight drain; older than that, an `error` as today. Cheap, and it makes the severity mean something.
- **Lock the allocator.** `number-stranded` takes the same machine/branch lock the drain does, so the second one waits and re-reads main rather than allocating against a stale view. Fixes the collision rather than the advice.
- **Refuse when a drain is in flight.** `number-stranded` checks for a recently-merged PR whose numbering commit has not landed and declines with that reason.

The lock is the only one that makes a concurrent run *safe* rather than *discouraged*; the other two reduce how often it is attempted. They compose.

## Done when

1. **Executable** — a test drives two `number-stranded` allocations against the same main view and asserts they cannot both claim one number: the loser either waits and re-reads, or refuses with a stated reason. Red today (both allocate freely), green after.
2. **Executable** — `strandedHashesOnMain` reports a hash younger than the drain window at `warn` with the in-flight drain named, and one older at `error`. A test that pins both sides of the boundary.
3. The remedy text no longer prescribes `number-stranded` unconditionally — it says when running it is correct and when it is a race.
