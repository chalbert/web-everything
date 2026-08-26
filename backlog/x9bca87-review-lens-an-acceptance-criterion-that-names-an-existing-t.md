---
kind: story
size: 2
status: open
relatedTo: ["3280", "2638"]
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-08-25"
tags: [review-quality, citation-verification, acceptance-criteria, jury]
---

# Review lens: an acceptance criterion that names an existing test must quote the assertion it relies on

A criterion saying *"the existing `we:path/to.test.mjs:NNN` case must not be weakened"* reads as surveyed
fact. Nothing makes the author open the test. When the named case does not assert the property the criterion
leans on, the criterion set silently becomes unsatisfiable — and the contradiction survives review because
every citation resolves. Extend the `correctness` lens's pre-registered expectation
(`we:scripts/lib/review-core.mjs:1847`) so a criterion naming a concrete test location must quote the
assertion it relies on, and a reviewer rejects it when the quote is absent or does not match.

## The incident that produced this

`we:backlog/x3884p1-the-lease-reaper-reclaims-a-lane-seconds-after-it-is-acquire.md` shipped this criterion:

> *"a lane whose item is genuinely finished **and** whose holder is gone is still reaped … the existing
> `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73` case must not be weakened."*

That case has **no holder-is-gone condition**. It mints its ghost with `acquire(1, 'conveyor-9999')`
milliseconds before the reaping acquire, so the ghost is seconds old and `DEFAULT_LEASE_TTL_MINUTES = 240`
(`we:scripts/lib/lane-lease.mjs:35`) — structurally the same liveness state as the lease the card's
Criterion 1 says must **not** be reaped. The two criteria therefore pinned opposite outcomes for the same
state, and an implementer could not satisfy both. Caught by an independent reviewer on round 3 of
chalbert/web-everything#1567, after two earlier rounds had passed over it.

## Why the existing bars do not catch it

Three checks all pass on the bad criterion, and that is the point:

- `we:agent-memory-src/grep-every-name-you-cite-in-prose.md` — the name resolves; the file and the line
  both exist.
- `#3280` (`we:backlog/3280-review-lens-an-x-already-handles-this-claim-must-line-cite-t.md`) — that lens
  covers an *"X already handles this"* claim about **production code**, answered by line-citing the code
  performing X. Here the citation is already a line cite, and it points at a **test**; what is false is not
  the location but what the test is said to **prove**.
- `we:backlog/x6fm4mx-gate-a-backlog-filing-that-asserts-existing-code-behaviour-m.md` — that gate fires on
  an existing-code-behaviour claim carrying **no** citation. This claim carries one.

The failure is one level down from all three: the citation resolves, the test is real, and the sentence
about it is still wrong.

## Decided design

A lens-expectation clause, not a `check:standards` rule — matching a criterion's prose claim against a
named test's assertions is a semantic judgement, the same reasoning `#3280` gives for putting its bar at
review time rather than in the gate.

Extend the `correctness` entry in `LENS_EXPECTATIONS` (`we:scripts/lib/review-core.mjs:1846-1854`, frozen
pure data at `:1847`) so it also commits the juror to:

> an acceptance criterion that names a concrete test location (`<file>:NNN`) must quote the assertion it
> relies on, and the quote must actually appear in that test — a criterion whose named test does not assert
> the stated property is a finding, even when the citation resolves.

The current `correctness` bar (`:1847`) already covers *"no test is missing, weakened, or gamed to pass
while the behaviour is wrong"*, which is about the **diff's** tests. This clause is about a **criterion's
description of a test that already exists**, which that wording does not reach.

## Tasks

1. Extend `LENS_EXPECTATIONS[MANDATE_LENSES.CORRECTNESS]` (`we:scripts/lib/review-core.mjs:1847`) with the
   clause above. The wording IS the commitment (`:1843-1844`), so this is the only edit needed — the charter
   the human sees and the mandate the juror runs are both single-sourced from it.
2. Extend the existing `LENS_EXPECTATIONS` suite
   (`we:scripts/lib/__tests__/review-core.test.mjs:1663-1675`) with a case asserting the correctness
   expectation carries the named-test clause, so the wording cannot be silently dropped.

## Done when

1. **Executable** — `npx vitest run review-core` passes, including a new case asserting
   `expectationForLens('correctness')` contains the named-test clause.
2. **Executable** — the charter a `correctness` juror is seated with (`materializeRoster`, asserted at
   `we:scripts/lib/__tests__/review-core.test.mjs:1696`) carries the clause, with no second call site added.
3. **Mutation** — deleting the clause from `we:scripts/lib/review-core.mjs:1847` reddens the case added in
   Task 2 by name.
4. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
