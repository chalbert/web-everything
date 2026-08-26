---
bornAs: x70498i
kind: story
size: 2
parent: "3029"
status: open
relatedTo: ["3273", "2678"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, scope, parallelism, gate]
---

# A card claims its slices build in parallel without naming a scope shape the dispatcher will actually run concurrently

A planning card can promise its slices "build in parallel" while every slice names the same file in `scope:` — and the dispatcher then runs them one at a time. `we:scripts/readiness/scope-lease.mjs:197` matches at **file** granularity, not line, and `we:scripts/readiness/dispatch-plan.mjs` holds any queued item overlapping an active lease or a launched rival. So "same file, different line" is not a false collision; it serializes. Prevention owed by a CONFIRMED finding on PR #1562, where `#3273` asserted parallel-safety and quoted `#2678`'s definition of that exact lock point two sentences later without reconciling them.

## Why prose is where this goes wrong

The dispatcher's behaviour is not in doubt and is not the defect. The defect is a **card** that plans work
against a model of the scheduler that is one granularity finer than the real one. Nobody notices until the
batch is queued and the second slice sits behind the first, at which point the slicing decision has already
been made and paid for.

The tell is textual and narrow: a section promising **parallel** delivery, in a card whose own `scope:` (or
whose described per-slice scope) names a file that other queued items also name. Both halves are already
mechanical — the promise is a phrase, and the overlap is exactly the `scopesOverlap` the dispatcher runs.

## What it must not do

**It must not flag every card that mentions parallelism.** A card observing that two *existing* items run in
parallel, or explaining why something cannot, is not making a scheduling promise about its own slices.

**It must not re-implement the overlap test.** Call `scopesOverlap` from
`we:scripts/readiness/scope-lease.mjs`. A second copy of that predicate drifting from the dispatcher's is a
worse bug than the one being prevented — it would report parallelism the scheduler does not deliver, which is
precisely this defect with a gate's authority behind it.

**It should point at the remedy, not just refuse.** `#2678`'s answer is to split the shared file; `#3273`'s
interim answer is one wiring slice that collects the shared-file edits. A finding that names neither leaves
the author where they started.

## Done when

1. **Executable** — a card asserting its slices "build in parallel" whose `scope:` names a file that ≥2 other
   queued items also name produces exactly one finding, and the finding names the colliding file and the
   count. `#3273`'s pre-fix text is the fixture.
2. **Executable** — the same card with the shared file removed from the described per-slice `scope:` produces
   none. `#3273`'s post-fix text is that fixture, so the two cases are one card either side of the finding.
3. **Executable** — a card that mentions parallelism *without* promising it for its own slices produces none.
4. **Executable** — the overlap decision comes from `scopesOverlap`, not a local copy: a case pinning that a
   module-level pattern and a file path that the shared predicate calls overlapping are reported as
   overlapping here too.
5. **Mutation** — replacing `scopesOverlap` with an exact-string equality reddens case 4 by name; dropping
   the "promises it for its own slices" narrowing reddens case 3.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
