---
bornAs: xkm60e4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/__tests__/conveyor-state.test.mjs", "we:scripts/__tests__/lane-pool-status-leased-only.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "72506866653daaddf9a5302e80945025d1725e9e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2853's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/conveyor-state.mjs:331` — When a producer omits fields for a reader, add a contract test that lists each consumer's read fields against the omitted set. A cheap dirty-lane signal, such as the free-lane list from #4122, could replace the git probe for `freeSlots`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2853@b854f1dbc204ad45935d80aa3a55a075c0d29697

## Premise check (against `main` @ 72506866)

Still owed. The finding's line 331 now lands in `computeFreeSlots` (`we:scripts/readiness/conveyor-state.mjs:339`). The producer that omits fields is `we:scripts/lane-pool.mjs` `status --leased-only` (#4345, `we:scripts/lane-pool.mjs:1157-1167`): an unleased row keeps `lane/path/exists/deps/lease/leased` and drops `head`/`branch`/`clean`/`behind`. Today's guards are fixture-output equality checks (the `computeFreeSlots`/`shapeLanes` cases in `we:scripts/__tests__/lane-pool-status-leased-only.test.mjs`, the 4th and 5th `it`). They compare outputs on one fixture, so a consumer that starts reading `behind` or `head` passes unless the fixture happens to expose it. No field-level contract exists (`we:scripts/readiness/__tests__/conveyor-state.test.mjs` has none). The new value is exactly that automatic field-level check; the existing tests stay. The second half of the finding (replace the git probe with #4122's free-lane list) is an optimisation, not a guard, so it goes to Follow-ups.

## Design

Make each consumer's read set explicit and testable, instead of implicit in a code comment. The consumer owns the contract; the producer's real output is checked against it.

- `we:scripts/readiness/conveyor-state.mjs`: export `POOL_STATUS_READS`, a frozen map `{ shapeLanes: [...], computeFreeSlots: [...] }` of the top-level `poolStatus.lanes[]` row fields each function reads. Declared from the current code: `shapeLanes` reads `leased`, `lane`, `lease`; `computeFreeSlots` reads `exists`, `leased`, `clean`. Also export `LEASED_ONLY_OMITTED_FIELDS = ['head','branch','clean','behind']`. `we:scripts/lane-pool.mjs` is a CLI entry point with a non-exported `laneStatus`, so it cannot be imported; the constant lives with the consumer and case 3 pins it to the producer's real output.
- `describe('pool status read contract', ...)` in `we:scripts/readiness/__tests__/conveyor-state.test.mjs` (this exact name is what the Done-when `-t` selects):
  1. Instrumented read: call each real consumer on rows wrapped in a shallow `Proxy` that records top-level property gets. The fixture must reach every branch: a leased row with no scope picture, an unleased existing row, and an `exists:false` row (otherwise the `&&` short-circuits hide reads). Assert the recorded set is a subset of the declared `POOL_STATUS_READS` entry, so an undeclared new read fails. Nested reads (`lease.session`, `lease.predictedScope`) are not recorded; the test says so.
  2. Omitted-set intersection: for every consumer, `reads ∩ LEASED_ONLY_OMITTED_FIELDS` must be empty, except `computeFreeSlots`/`clean`, named in an explicit allow-list with a reason (a missing `clean` reads as clean, the documented #4345 leniency).
- Drift guard (case 3) goes in `we:scripts/__tests__/lane-pool-status-leased-only.test.mjs`, which already spawns both `status` modes against a real throwaway pool: assert the key set removed from an unleased row between the full and `--leased-only` payloads equals `LEASED_ONLY_OMITTED_FIELDS`. A producer change that drops another field then fails here.

## MVP

Musts only:
- The two exports in `we:scripts/readiness/conveyor-state.mjs`.
- The `pool status read contract` describe (cases 1 and 2) and the drift case 3.
- The `Done when` command below.

Deliberately OUT: swapping the `freeSlots` git probe for the #4122 free-lane list; covering `we:scripts/readiness/scope-lease-collect.mjs`'s own reads (a second consumer of the same omitted rows, it has its own header contract; MVP covers the two `we:scripts/readiness/conveyor-state.mjs` consumers only); changing `computeFreeSlots` behaviour; deep (nested-field) read tracking.

## Test plan

Each case fails RED when run against the UNMODIFIED `we:scripts/readiness/conveyor-state.mjs`, because `POOL_STATUS_READS` / `LEASED_ONLY_OMITTED_FIELDS` do not exist (import yields `undefined`, so the assertions throw):
- `consumers only read declared fields`: proxy-recorded reads of the real `shapeLanes` and `computeFreeSlots` over the branch-covering fixture are within `POOL_STATUS_READS`.
- `no consumer reads an omitted field unallowed`: `reads ∩ LEASED_ONLY_OMITTED_FIELDS` is `{}` for `shapeLanes` and `{clean}` for `computeFreeSlots`, with the allow-list asserted exactly (adding another tolerated field must be a conscious edit).
- `omitted set matches the producer` (in the lane-pool test file): the real leased-only vs full key difference equals `LEASED_ONLY_OMITTED_FIELDS`.

## Proof plan

1. RED: add the new tests with the source untouched and run `npx vitest run conveyor-state.test lane-pool-status-leased-only -t "read contract|omitted set"`; record the failures. GREEN: add the exports and re-run; record the pass. Both outputs go on this card.
2. Mutation proof on the live code: temporarily make `shapeLanes` read `l.behind`, show the contract test fails naming the field, then revert. Repeat by dropping `head` from the producer's unleased row and showing the drift case fails.

## Follow-ups

- Replace `computeFreeSlots`'s git-derived `clean` test with the #4122 free-lane list as a cheap dirty-lane signal (the finding's second half; changes behaviour, needs its own proof).
- Extend the same read-set contract to `we:scripts/readiness/scope-lease-collect.mjs`'s `collectSnapshot` reads.
- Move `LEASED_ONLY_OMITTED_FIELDS` to a producer-owned module if `we:scripts/lane-pool.mjs` ever becomes importable without running its CLI.

## Done when

1. **Executable** — `npx vitest run conveyor-state.test lane-pool-status-leased-only -t "read contract|omitted set"` fails when run against the unmodified `we:scripts/readiness/conveyor-state.mjs` (new tests only) and passes once the exports land.
