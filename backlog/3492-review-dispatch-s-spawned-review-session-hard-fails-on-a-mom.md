---
bornAs: x3jmao3
kind: task
parent: "3383"
status: active
dateOpened: "2026-09-04"
dateStarted: "2026-09-04"
relatedTo: ["3235", "2659", "2660"]
tags: [lane-pool, review-dispatch, retry-backoff, live-caught]
---

# review-dispatch's spawned review session hard-fails on a momentarily-full lane pool

`we:scripts/lane-pool.mjs`'s `acquire` auto-pick hard-fails the instant `chooseFreeLane` returns null — no
retry, no backoff, no bounded wait — so a background review session dispatched by `we:scripts/operations/review-dispatch.mjs`
gives up on `blocked-on-infra` at the FIRST full-pool reading, even though the pool was proven to free up
again within minutes. Give `we:scripts/lane-pool.mjs` `acquire` a bounded, opt-in retry/backoff and have the
review brief's own lane step use it, so a momentary capacity flicker self-heals instead of stranding the
review with no automatic recovery.

## What actually happened, live-caught tonight (2026-09-04) — reconstructed from real transcripts, not secondhand

A subagent (in this same session) built and landed a fix as **PR #1908** (chalbert/web-everything,
`Pin passive-wait rule in we:CLAUDE.md`) from lane-35, acquired `19:18:05Z`. After opening the PR
(`19:33:56Z`), it tried `node we:scripts/operations/review-dispatch.mjs --pr=1908 --repo=chalbert/web-everything`
from INSIDE lane-35 at `19:40:20Z` — refused immediately by `assertNotALaneCheckout` (a correctly-working,
unrelated guard: "refusing to start a delivery agent from the lane checkout ... Run this from the primary
checkout"). It retried from the primary checkout one second later (`19:40:22Z`, **still holding lane-35** —
not yet released) and this DID succeed in spawning a fresh background review session
(`we:scripts/operations/review-dispatch.mjs` itself never acquires a lane — confirmed by reading the file;
only the SPAWNED session does, per `we:skills-src/review/review-agent-brief.md` step 1).

That spawned session (`review-1908`, harness session id `f28f3c4f-…`) reported `started` at `19:40:30Z`,
then at `19:40:35Z` ran exactly what the brief prescribes:

```
node scripts/lane-pool.mjs acquire --purpose=review-loop --session=review-1908 --adopt
```

and got, verbatim, `we:scripts/lane-pool.mjs`'s hard failure (line 1086):

```
Exit code 1
✗ no free lane in pool "web-everything" (42 all held/dirty) — release one or `provision` more
```

Per the brief's own step 1 ("If this fails … report the completion record and exit; do not retry in a
loop"), the review session immediately reported `outcome=blocked-on-infra` (`19:40:48Z`) and exited — a
sanctioned, deliberate no-self-retry design (see *Root cause*, below, for why the retry belongs elsewhere).
Nothing in this repo's conveyor currently watches a `kind=review` `blocked-on-infra` completion record to
auto-redispatch (`we:scripts/operations/review-dispatch.mjs`'s own header confirms wiring it to
`we:scripts/conveyor/reconcile-core.mjs`'s "review owed" decision is separate, later work) — so the review
of PR #1908 simply stalled, invisible, until the build agent noticed via `inspect-agent-health` at
`19:51:00Z` that the "done" session had posted no verdict and no label change. It then released its OWN
still-held lane-35 (`19:51:11Z` — `node we:scripts/lane-pool.mjs release --lane=35 --session=structural-passive-wait-fix-lane-35-28a22738`),
confirmed exactly one lane became acquirable (`19:51:19Z`), and re-ran
`node we:scripts/operations/review-dispatch.mjs` — which this time spawned a review session that succeeded
cleanly end to end, landing `review:accepted` and letting the drain merge PR #1908.

## Root cause, confirmed against the real code and the real timestamps (both candidates, precisely apportioned)

1. **Genuine capacity squeeze, not purely self-inflicted.** At `19:40:35Z` the pool read "42 all
   held/dirty" — the WHOLE pool, not a near-miss — while `claude agents --json` at the same window showed
   many concurrently-active sessions (`conveyor-3412`, `prepare-3438`, `prepare-3441`, `conveyor-3442`,
   `prepare-3436`, and others). The caller's own unreleased build lane-35 was one contributing unit of that
   pressure, not the sole cause: releasing it 11 minutes later freed exactly one lane ("acquirable count:
   1"), which is suggestive but not dispositive proof that lane-35 alone was the blocker at `19:40:35Z` —
   other lanes plausibly freed up independently in that same 11-minute window as concurrent work finished.
   **Lane-pool status carries no history, so the exact pool composition at `19:40:35Z` cannot be
   reconstructed further than the "42 all held/dirty" figure the acquire call itself recorded** — this is
   the real, logged number, not an estimate.
2. **Zero retry/backoff anywhere in the path — the more durable root cause.** `we:scripts/lane-pool.mjs`'s
   `cmdAcquire` auto-pick loop (lines 1081-1090) retries ONLY when it loses an atomic-claim race against a
   concurrent acquirer (`tryClaimLane` returns falsy on the SAME candidate); when `chooseFreeLane` itself
   returns `null` (no acquirable lane at all), it calls `fail()` immediately, on the very first read, with
   no wait of any length. A pool at real concurrent load fluctuates by the second (as #1 above shows
   happened here); a zero-retry acquire is structurally fragile against exactly that kind of fluctuation,
   independent of whether any one caller sequences its own release perfectly. This is also not a one-off:
   `we:backlog/3235-the-juror-lane-guard-has-no-sanctioned-path-when-the-pool-is.md` ("the juror lane guard
   has no sanctioned path when the pool is full") documents FOUR agents independently inventing ad hoc
   workarounds for the same "pool reads full, `acquire` gives up instantly" shape at a different call site
   (`assertLaneCwd`) on 2026-08-21 — the same underlying gap recurring wherever something calls
   `we:scripts/lane-pool.mjs` `acquire` under load.
3. **Missing sequencing doctrine — a secondary, softer gap.** No doc anywhere tells a caller to release its
   own build lane before dispatching an independent review for the same PR. Checked every plausible home:
   `we:skills-src/pr/SKILL.md` never mentions `we:scripts/operations/review-dispatch.mjs` at all (confirmed —
   zero hits for "dispatch" in that file); `we:skills-src/mechanical-delivery-doctrine/SKILL.md` and
   `we:skills-src/conveyor/delivery-agent-brief.md` don't say it either, and the standard
   mechanically-dispatched `we:skills-src/conveyor/delivery-agent-brief.md` arc doesn't even call
   `we:scripts/operations/review-dispatch.mjs` itself (step 10: "do NOT release the lane" — review-dispatch is
   left to a not-yet-wired later reconciler). Tonight's session was an ad hoc, non-conveyor workflow that
   improvised the build-then-review sequence by hand, told to do so by its own dispatching prompt, not by any
   written repo convention — so the ONLY place a caller would actually encounter guidance before invoking
   `we:scripts/operations/review-dispatch.mjs` is that file's own header. Worth a one-line doctrine note
   there, but NOT the primary fix — see below for why.

**Why the primary fix belongs in `acquire`, not in caller-side sequencing discipline:** relying on every
caller to release its own lane at exactly the right moment is fragile by construction, and this epic
(`#3383`) is explicitly headed toward genuinely-parallel dispatch (multiple builds/reviews at once) where
"perfectly sequence your own release" stops being a reasonable ask of every caller. A bounded, short,
OPT-IN wait inside `acquire` itself benefits every caller (the review session,
`we:backlog/3235-the-juror-lane-guard-has-no-sanctioned-path-when-the-pool-is.md`'s juror guard, any future
dispatcher) with one change, and costs nothing when the pool genuinely has no capacity — it still fails,
just a few seconds later, with the identical message and completion record.

## Not a duplicate of the existing infra-blocked/retry items

- `we:backlog/2659-conveyor-first-class-infra-blocked-state-auto-retry-resume-f.md` /
  `we:backlog/2660-conveyor-ui-surface-infra-blocked-lanes-distinctly-outage-ba.md` (both **resolved**)
  built first-class `infra-blocked` state + auto-retry/resume specifically for `we:scripts/pr-land.mjs`'s
  PRE-PR failure (PR-open failing on a GitHub outage *after* a lane ref has already been pushed, with a
  resumable ref to retry from). That machinery has nothing to resume from here:
  `we:scripts/operations/review-dispatch.mjs`'s own acquire failure happens BEFORE any work exists — there
  is no ref, and the `kind=review` completion record `blocked-on-infra` these items file is never read by
  that `we:scripts/pr-land.mjs`-scoped retry loop.
- `we:backlog/3235-the-juror-lane-guard-has-no-sanctioned-path-when-the-pool-is.md` (open) is the closest
  sibling — the SAME symptom (`acquire` giving up the instant the pool reads full) at a DIFFERENT call site
  (`assertLaneCwd`, the juror lane guard). Filed as `relatedTo`, not a duplicate: that item is about giving
  jurors a sanctioned full-pool path (which may itself want the same `acquire` retry/backoff primitive this
  item adds — worth revisiting once this lands).

## Done when

1. **Executable** — a test that reproduces today's gap: with every lane in a pool held/dirty, `node
   we:scripts/lane-pool.mjs acquire --wait-ms=<bounded-total>` polls (does not fail on the first read) and
   succeeds once a lane is released mid-wait, while a bare `acquire` (no `--wait-ms`) keeps failing
   instantly exactly as today (back-compat: the flag is opt-in, default behavior unchanged). A pool that
   never frees up within the bound still fails with the same `no free lane in pool "<name>" (<n> all
   held/dirty)` message and exit code 1, just after the bound elapses instead of immediately. **DONE** —
   `we:scripts/lane-pool.mjs`'s `cmdAcquire` auto-pick branch now spin-polls (via `sleepSyncMs`, reused from
   `we:scripts/readiness/drain-lock.mjs`, no busy-wait) up to `--wait-ms`, defaulting to 0 (unset ⇒ today's
   instant-fail, byte-identical); proven by
   `we:scripts/__tests__/lane-pool-acquire-wait-ms.test.mjs` (self-heal within the bound, exhausted-pool
   still fails after it, and the flag-omitted case still fails immediately).
2. `we:skills-src/review/review-agent-brief.md` step 1 passes a short, bounded wait (not open-ended — a
   review session's own "one dispatch, one round" discipline must not turn into an indefinite spin) so a
   momentary full-pool reading like tonight's self-heals without a human/agent having to notice via
   out-of-band inspection and manually retry. **DONE** — step 1 now passes `--wait-ms=30000`.
3. A one-line doctrine note states: release your own build lane before dispatching an independent review
   for the same PR — the reviewer needs its own separate lane, and an unreleased build lane needlessly adds
   to pool pressure at exactly the moment a fresh lane is needed. **DONE, and CORRECTED from this item's own
   first draft** — `we:skills-src/pr/SKILL.md` turned out NOT to document the
   `we:scripts/operations/review-dispatch.mjs` call at all (verified: zero mentions of "dispatch" in that
   file), so the note lives in `we:scripts/operations/review-dispatch.mjs`'s own file header instead — the
   one place a caller actually encounters before invoking it.
