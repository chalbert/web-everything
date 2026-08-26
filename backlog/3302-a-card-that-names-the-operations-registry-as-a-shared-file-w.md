---
bornAs: xh25i14
kind: story
size: 2
parent: "3029"
status: open
relatedTo: ["3273", "2678", "3224"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, operations, gate, scope]
---

# A card that names the operations registry as a shared file without naming the declared-homes map beside it

An operation that REPLACES a raw call site touches two shared files, not one: the registry line in `we:scripts/operations/run.mjs` and the entry in `we:scripts/operations/declared-homes.mjs` that `we:scripts/check-standards.mjs:2171` reads for the `#3224` scan. `declaresOver` is optional and defaults to `[]`, so a missing entry breaks nothing mechanically — it just leaves those call sites permanently un-flagged. A planning card naming only the registry teaches readers to ship half the wiring. Prevention owed by a CONFIRMED finding on PR #1562, against `#3273`.

## Why the two are already coupled in code

`we:scripts/operations/registry.mjs`'s `RESERVED_DECLARATION_KEYS` includes `declaresOver`, and
`we:scripts/check-standards.mjs:2171` consumes `DECLARED_HOMES` to run the `#3224` scan.

**Not every operation belongs in that map, and the card must not imply otherwise.** Counted:
`DECLARED_HOMES` has **4** entries — `verify`, `claim`, `open-pr`, `dispatch-lane` — against **15** declared
operations. That is not 11 missing entries. `we:scripts/operations/declared-homes.mjs`'s own docstring rules
on it:

> *Fewer correct entries beat more guessed ones — an operation missing from this map costs a finding nobody
> gets, while a wrong one costs the gate's credibility.*

So the pair is one step **for an operation that replaces a documented raw call site**, and one file for an
operation that has none. The rule this item encodes is therefore conditional, and a lint that demanded the
second file unconditionally would be pushing exactly the guessed entries that docstring refuses.

## Honest about what this can and cannot check

**No deterministic gate can validate a planning document's completeness**, and this item must not pretend
otherwise. What it can do is narrow: a doc under `we:backlog/` that names `we:scripts/operations/run.mjs` (or
"the registry") **as the shared/lock-point file an operation slice touches** and never names
`we:scripts/operations/declared-homes.mjs` is very likely teaching the half-version. That is a lint with a
real false-positive surface, so it belongs at **warn**, not error, until it has run clean for a while.

The narrower and more valuable half is that the pair should also be checked in code rather than only in prose
— a declared operation whose `declaresOver` is empty while its verb has raw call sites is a stronger, fully
mechanical signal. If that turns out to be cheap, prefer it and downgrade the doc lint to a nicety.

## Done when

1. **Executable** — a backlog doc naming `we:scripts/operations/run.mjs` as the file two slices collide on,
   with no mention of the declared-homes map, produces exactly one warning naming both files. `#3273`'s
   pre-fix text is the fixture.
2. **Executable** — the same doc with the declared-homes map named produces none. `#3273`'s post-fix text is
   that fixture, so the two cases are the same card before and after.
3. **Executable** — a doc mentioning `we:scripts/operations/run.mjs` for an unrelated reason (a path in a
   command line, a call-site count) produces none.
4. **Mutation** — deleting the "and does not name declared-homes" half of the condition reddens case 2.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
