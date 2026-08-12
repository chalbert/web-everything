---
bornAs: xldh6v3
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-12"
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [plateau-loop, operations, engine, dispatch, follow-up]
scope:
  - we:scripts/operations/cli-adapter.mjs
  - we:scripts/operations/run-record.mjs
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/__tests__/effect-executor.test.mjs
  - we:scripts/operations/__tests__/http-adapter.test.mjs
  - we:scripts/operations/__tests__/run-store.test.mjs
---

# A parked run reports a drive-local number as a property of the record

Six findings from #1180's round-2 review. Two are the same mistake in two places, and both surface on the
RE-DRIVE — which is the path the park message itself steers the operator onto, so the wrong answer is the one
they actually see.

## The two that matter

**`outcomePayload.inFlight` took its value from the caller.** `GET …/runs/<id>` builds the payload with no
drive behind it, so it reported `[]` for a parked run. On that route `[]` stopped meaning "nothing is in
flight", and the payload carries no `effects` either — so there was no way to recover a parked run's handle
over HTTP at all. "The work outlives this process" is the case the status exists for; a read route that cannot
report it is the one that matters most. `#3070` is the first consumer and it is next.

**The park message counted what THIS drive applied.** On a run whose ordinal 0 lands and whose ordinal 1
parks, the first drive says "1 effect(s) landed" and the re-drive says "0" about a record that holds one.

## The rest

- `validateRunRecord` refused an EMPTY handle and accepted a BLANK one. Whitespace is truthy, so it passed,
  was bucketed `running`, and the driver parked forever telling the operator to poll a blank handle.
  `inFlight()` trims, so the validator was looser than the constructor it backstops.
- Two overclaims to trim rather than fix: the local `Symbol` brand can still be lifted off a real marker with
  `Object.getOwnPropertySymbols`, and `resolveInFlight` has no CLI or HTTP surface, so "nothing has to
  hand-edit a run record" is not yet true.
- The pre-sink ordering pays off for a PROCESS DEATH only. A sink that THROWS gets `in-flight` from the catch
  branch on its own, so three places saying "a crash between starting the work and hearing back" were vaguer
  than the code.
- Two stated numbers were wrong: "nine mutations" against an eleven-row table, and 323 files against 322.

## Done when

- [x] A parked run reports the same in-flight keys on a read as on the drive that parked it.
- [x] The landed count is true on every drive, not only the first.
- [x] A blank handle is refused.
- [x] The two overclaims say what the code delivers.

## How it resolved

Both counts now read the run record instead of the drive, which is the same one-line shape in both places.
The read route needed no change once `outcomePayload` stopped taking the value as a parameter.

Three mutations reddened named tests: taking `inFlight` as a parameter again (4 red, including the HTTP read),
counting the drive again, and dropping the trim.
