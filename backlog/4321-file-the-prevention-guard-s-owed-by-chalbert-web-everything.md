---
bornAs: xcgfm2h
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "d02a3ee035eac8dc9928fc62361511d5c64691e3"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2817's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-extra-seats.mjs:161` — Add deterministic migration tests using pre-split scorecards and the shared reservation ledger, checking that completed Gemini calls retain their budget charge and are not reassigned to Codex through legacy reservations.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2817@5bbb2d122d1b051b4185ec3e70873608b400d945

## Prep (delivery-agent, PREPARE FIRST)

**Premise check** — still owed. `git log origin/main -- we:scripts/operations/review-extra-seats.mjs
we:scripts/operations/__tests__/review-extra-seats.test.mjs` shows only `5bbb2d122` (the PR #2817 change this
item was filed against) since the item's `bornAs`; no later commit added the migration test. The nearest
existing case (`'card xn2wf9t — reviewSeatCapUsage includes outstanding reservations without double-counting
completed calls'`) only exercises `codex`; nothing exercises a non-codex provider (`agy-gemini`) against a
pre-split/untagged reservation. Not already done, not superseded — build.

**Scope check** — confirmed against the current code (`reservationIsFor`, `reservationLedgerFileFor`,
`reserveSeatCalls`, `reviewSeatCapUsage` in `we:scripts/operations/review-extra-seats.mjs`): the isolation this
item guards is already correct in production code (each non-codex provider gets its own ledger *file*, and an
untagged/legacy reservation defaults to `codex` in `reservationIsFor`), so the real touch-set is **test-only**
— a strict subset of the declared `scope:`. No production line needs to change; leaving `scope:` as-is (it
already covers the touched test file plus the file under test).

### Design

Add one deterministic `it(...)` to `we:scripts/operations/__tests__/review-extra-seats.test.mjs`, in the same
`describe` block as the existing `card xn2wf9t` cases, modeling the pre-split→per-provider migration. AS BUILT
(revised from an earlier draft during `/converge` — a per-lens panel caught that the first draft's fixture
didn't match this plan; see *Proof plan*): the shared, pre-split ledger (`codex`'s tagged reservation, one
**untagged/legacy** reservation, and a Gemini-tagged one matching Gemini's own completed call) is fed to
`reviewSeatCapUsage`/`reserveSeatCalls` for **both** `codex` and `agy-gemini` in the SAME call — this is the
actual migration risk (a not-yet-split provider's read path falling back to the one shared ledger file, not
two cleanly separate files), and it is the version proven by mutation to catch a regression; a draft that
gives each provider its own pre-populated ledger object never exercises `reservationIsFor`'s cross-provider
defaulting at all, so it cannot redden if that logic breaks.

### MVP

**Test-only, one new case** (no new helper, no production diff) — the smallest change that makes the
described migration scenario executable and is proven (not just asserted) to go red if the isolation
regresses:
- `records`: one completed `codex` row and one completed `agy-gemini` row, both scored today.
- `ledgers`: ONE shared, pre-split ledger object — `codex`'s own tagged reservation, an **untagged/legacy**
  one (`provider` omitted, predating the per-provider split), and a Gemini-tagged one whose `callId` matches
  Gemini's own completed row (exercises the completed-record/own-reservation dedupe, not just isolation from
  codex) — passed as BOTH `codex`'s and `agy-gemini`'s ledger.
- Assert via `reviewSeatCapUsage(records, now, env, ledgers)` that `usage.codex.usedToday` is 2 (its own
  tagged call + the untagged legacy reservation — nothing lost off codex) and `usage['agy-gemini'].usedToday`
  is 1 (only its own completed row, deduped against its own matching reservation — the shared ledger's
  codex-owned entries never inflate it, i.e. they are not reassigned to Gemini). Assert the same split through
  `reserveSeatCalls({ ..., provider })` for both providers, the admission-time counter, to cover both read
  paths the card names.
- No broader refactor is in scope.

### Test plan

The one new `it(...)` above is the entire test plan — no other file needs a new case; the card's own `Done
when` (below) is the executable proof that it exists and is green.

### Proof plan (live before/after, run by hand during build — not itself part of the diff)

- **Mutation proof (the test is load-bearing, not vacuous):** temporarily changed `reservationIsFor` to
  always return `true`. RED: `usage.codex.usedToday` / `usage['agy-gemini'].usedToday` no longer match the
  asserted split (a codex-owned entry leaked into Gemini's count). Reverted; full
  `we:scripts/operations/__tests__/review-extra-seats.test.mjs` suite green again (60/60). An earlier draft
  (separate per-provider ledger objects, no cross-provider overlap) was tried FIRST and did NOT redden under
  this same mutation — that is why the design above uses one shared ledger fed to both providers.
- **Done-when command proof:** verified the `Done when` command below is genuinely red on `main` (before
  this item's test exists — `grep -q` exits 1, command short-circuits) and green after (`grep` finds it, full
  suite passes, 60/60). A `vitest -t <name>` filter alone does NOT give a red base state on this vitest
  version (a zero-match run exits 0, "skipped") — noted so nobody repeats that mistake in a future card.

### Follow-ups

None. The isolation this item guards was already correct in production code before this item was picked up
(confirmed under *Premise check* / *Scope check*), so no residual work beyond the MVP test surfaced during
build or during the `/converge` panel + red-team passes (five lenses, two rounds; every finding was a
cosmetic carve-out in the card/test text itself, and every one was fixed in this same diff rather than filed
separately).

## Done when

1. **Executable** — `` grep -q "#4321 migration" we:scripts/operations/__tests__/review-extra-seats.test.mjs &&
   node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run
   we:scripts/operations/__tests__/review-extra-seats.test.mjs --passWithNoTests `` (the `we:` prefixes above
   are this repo's scope-citation convention for backlog cards, per the write-time locus-prefix gate — strip
   them to get the literal runnable command). Verified genuinely red-then-green (not just asserted): on the
   base, before this item's test exists, `grep -q` exits 1 and the command short-circuits red (a `vitest -t`
   filter alone does NOT do this — a zero-match run/related pass exits 0, "skipped", on this vitest version,
   which was the wrong first draft here); after, `grep` finds it and the full suite runs green (60/60). The
   test itself asserts a completed Gemini call keeps its own budget charge and the shared pre-split ledger's
   reservations stay attributed to Codex, never reassigned to Gemini.
