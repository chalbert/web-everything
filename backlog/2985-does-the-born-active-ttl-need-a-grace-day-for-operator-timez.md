---
bornAs: x0zc0fn
kind: decision
status: open
dateOpened: "2026-08-08"
tags: []
---

# Does the born-active TTL need a grace day for operator timezone skew

The #670 born-active TTL warns at born+1 in UTC, so an item filed late in a western-timezone evening trips it a day early. Adding grace flips a pinned boundary test and loosens a ratified rule.

## Where this came from

Surfaced as a finding on PR #1018 (the #2747 operator-day date stamping work) and
deliberately left unfixed there, because the only available fix loosens a ratified rule —
that is a ruling, not a patch. Split out so #1018 could land.

## The problem

`we:scripts/lib/workflow-invariants.cjs:66` and `we:scripts/audit-backlog-health.mjs:350`
age a born-active item against a day boundary that #2747 has now moved underneath them.
#2747 put the *stamping* side on the operator's day; the ageing side and the historical
stamps do not all agree yet. The two frames disagree for part of every day: an item
scaffolded at, say, 21:00 local on a UTC-5 machine carries today's operator date but is
already "tomorrow" in UTC, so the TTL reads it as a day older than it is and warns early.
The reverse skew warns a day late. Legacy cards stamped before #2747 are UTC-framed, so
the mixed window persists until they settle.

## Why it is not just a bug fix

The obvious fix is one day of grace in the TTL. But `we:scripts/__tests__/workflow-invariants.test.mjs:68-72`
pins the boundary: born `2026-07-01` with today `2026-07-02` must produce exactly one
warning, and lines 74-77 already encode "the creating day is the grace day". Adding a
second grace day flips a ratified boundary. That is a decision about how strict the
born-active rule is, not a correctness fix.

## Severity

Advisory only. It is a `warnings.push`, no gate goes red. Born-active scaffolds settle
within a day or two by definition, so the mixed-frame window self-closes. A one-day-early
warning on a card nobody is reading costs approximately nothing — "leave it" is a real
option here, not a cop-out.

## Options

- **Grace day.** Age against born + 2 days. Simple; costs one day of laxity on every
  born-active item everywhere, and flips the pinned test.
- **Compare in the operator's day, not UTC.** Strictly more correct — it makes the ageing
  side agree with the stamping side #2747 already moved. Costs a shared operator-day
  helper reachable from the CJS invariants file, which is the same plumbing
  /backlog/2987-burndown-data-reads-utc-while-its-inputs-are-operator-local/ needs.
- **Leave it.** Accept the one-day skew as the price of an advisory-only check.

Recommendation: option 2, folded in with the shared CJS date helper the burndown item also
needs — one piece of plumbing, two fixes, no ratified rule loosened.

## Acceptance

- A ruling recorded with `codifiedIn`, per the decision protocol.
- If the ruling changes the boundary, the pinned test is updated to pin the *new* boundary
  deliberately, with the ruling cited in the test.
