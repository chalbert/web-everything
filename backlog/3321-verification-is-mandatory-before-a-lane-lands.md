---
bornAs: xq0034b
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/lane-verify.mjs
  - we:scripts/__tests__/lane-verify.test.mjs
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
  - we:scripts/pr-land.mjs
  - we:skills-src/batch-backlog-items/parallel-execute.workflow.js
tags: []
---

# Verification is mandatory before a lane lands

requireVerified defaults false, so a lane can land without its own suite having run — 18 of 39 confirmed review findings had their input available at COMMIT time, where a suite could have caught them. lane-verify already runs test:unit plus check:standards, sha-keyed, with running-detection for the stall case; this flips the default and handles the break-glass path. Cheapest change in the programme, and it would have caught a red test sitting in the authoring lane.

Do not read this against the parent card's 21 of 39: that is WRITE time — input present the moment the bytes were authored — a different and larger measurement.

## What the flip actually is

`resolveVerifyOptions` in `we:scripts/lib/lane-verify.mjs` resolved `requireVerified` as
`!!flags['require-verified'] || env.WE_REQUIRE_VERIFIED === '1'` — **absent meant "don't bother"**. And
`verifyGateDecision`'s own parameter defaulted `requireVerified = false`, so a caller that simply forgot to pass
the resolved option got the permissive gate. Both now default to required, and there are two documented escapes at
deliberately different strengths:

| escape | spelling | relaxes |
| --- | --- | --- |
| **opt-out** | `--no-require-verified`, `--require-verified=0\|false\|no\|off`, `WE_REQUIRE_VERIFIED=0\|false\|no\|off` | only the *we never saw a result* cells: absent/stale marker, and `red`. A fresh `running` marker (the #2833 stall) and a `corrupt` marker **still refuse** — those are evidence of a BROKEN verification, not a missing one. |
| **break-glass** | `WE_LAND_UNVERIFIED=1` | every cell, including stall and corrupt. Reported as a separate `breakGlass` field, so it can never be mistaken for the narrow opt-out. |

Only an **explicit** negative opts out. `WE_REQUIRE_VERIFIED=` (empty) stays required: an env var set to empty is
an accident, and a fail-closed gate must not read an accident as consent. When the inputs **conflict**, the
deliberate one wins and it wins toward verifying: an explicit `--require-verified` beats an ambient
`WE_REQUIRE_VERIFIED=0`, and `--require-verified` beats a simultaneous `--no-require-verified`.

## Flipping the default is only half the item — the call sites have to match

**This section corrects the first cut of this card, which scoped the work to the resolver alone.** It said the
change lands "in the single shared resolver both entry points already call", and listed a scope of exactly
`we:scripts/lib/lane-verify.mjs` + its test. **That was wrong, and shipping it that way would have wedged the
drain.** Inverting a default silently re-points every caller that passes nothing, so the callers are part of the
change, not downstream of it.

`we:scripts/lane-drain.mjs`'s `buildPrLandArgs` built a flag-free `pr-land` argv. Under the new default that
resolves to `requireVerified: true`, and the drain lands WE from the **primary checkout** while the lane it lands
is a **separate clone** — so the lane's `.git/.lane-verify` is not merely missing, it is *structurally
unreachable* from the git dir `pr-land` reads. Every queued couple would have failed the gate with `unverified`
and been reopened. The drain therefore passes `--no-require-verified` explicitly: it is the caller the opt-out was
written for, and #1937 already makes the PR's required GitHub check its landing authority.

The general rule this item is the instance of: **a gate's default is a statement about callers that say nothing,
so flipping it is a change to all of them.** An opt-out with zero callers is not an escape hatch, it is a claim.

**And the first correction applied that rule to one caller.** Review round 2 caught the rest:
`we:skills-src/batch-backlog-items/parallel-execute.workflow.js` — live behind `/workflow` — invokes `pr-land`
**four** times with no verify flag (the WE and impl per-lane PR opens, and the two Finalize label-reconcile calls,
the latter from the primary root against a lane ref: the drain's shape exactly). It never runs
`we:scripts/verify-lane.mjs` at all, so no marker exists for any of them and every `/workflow` lane would have
died at PR-open. Worse than the miss: three sentences across this card and the two scripts asserted the sweep was
*complete* while it was not. A retraction that fixes one of the two callers it names is still a false claim.

All four now pass `--no-require-verified`, and the file records why the opt-out rather than a verify step: its
step-4 gate already runs the same suite pair `verify-lane` runs, but the marker is **sha-keyed** while steps 5–7
(resolve commit, manifest, review amend) move HEAD afterwards — recording a marker there needs a verification step
sequenced after the final amend, which is a workflow change this card does not make (see #3212).

**The caller sweep is no longer a hand sweep.** An earlier revision of this section read:

> **The caller sweep is still a hand sweep, and that is the residual risk.** It has now been wrong twice. The
> durable fix is a source-level guard asserting that every repo-committed `we:scripts/pr-land.mjs` invocation
> either carries a verify flag or is preceded by a `verify-lane` run — the same shape as the existing `lane-drain`
> contract guard. Not built here; owed as a follow-up.

**That residual is closed in this card rather than deferred**, because deferring it leaves the item's own failure
mode live: a hand-maintained caller list in a docblock is a claim, and this one was wrong in round 1 (missed the
drain) and again in round 2 (missed the workflow). Filing a follow-up would have shipped a third revision of the
same claim with nothing enforcing it.

The guard is the described one, as a test — `we:scripts/__tests__/lane-verify.test.mjs`, "caller sweep". It reads
the committed source of each emitter, harvests every real `pr-land` command string (a match needs at least one
`--flag`, so a docblock's prose mention is not counted as a call site), and drives each one through
`we:scripts/pr-land.mjs`'s own flag parser, `resolveVerifyOptions` and `verifyGateDecision` against the marker
state that path actually sees. It also pins the drain's array-literal argv, which no command-string scan can see.
A new `pr-land` invocation that says nothing about verification reddens the suite instead of reaching the gate.

## Done when

1. **Executable** —

   ```
   npx vitest run lane-verify -t "#3321" | grep -qE "Tests +[0-9]+ passed"
   ```

   RED on `origin/main` (exit 1), GREEN on this branch (exit 0). Observed:

   | tree | vitest's own summary line | criterion exit |
   | --- | --- | --- |
   | `origin/main` (`5634f078`) | `Tests  32 skipped (32)` | **1** |
   | this branch | `Tests  17 passed \| 32 skipped (49)` | **0** |

   *(Re-measured on every round rather than carried over, because both sides move: `origin/main` advances under a
   live drain, and each round adds cases. Earlier cuts of this table read `14 passed` against `1c293a0f` and
   `16 passed` against `379cf93c`. The RED side is re-run against the tip each time — never assumed from the
   previous reading. The verdict has been identical at all three tips, which is the point: the criterion depends
   on this branch's tests existing, not on which commit main happens to be at.)*

   **THE `grep` IS THE CRITERION, NOT DECORATION.** `npx vitest run lane-verify -t "#3321"` on its own exits
   **0** on `origin/main` — measured, not assumed: a `-t` filter that matches nothing is a selection of zero, and
   vitest treats an empty selection as success. A criterion written without the pipe is green *before* the work.
   `Tests +[0-9]+ passed` asserts that tests actually RAN, which is the property the criterion means to state.

2. **The gate still lets a verified lane through** — a gate that refuses everything is worse than the hole it
   closes, so the same 17 tests pin the PASS direction, not just the refusal: a `green` marker for THIS head is
   `ok`/`verified` with **no options passed at all**, and stays `ok` long past the TTL (sha-identity is the
   freshness test, not the clock). Confirmed at the CLI too: with a real green marker written by
   `we:scripts/verify-lane.mjs` for the lane's exact HEAD, `verify-lane check` with no flags returns
   `ok:true` / `verified`, exit 0.

   *Not claimed: that this item's own PR proves it. The standard invocation runs `pr-land` from the PRIMARY
   checkout, so the finish-guard that admitted the PR was `origin/main`'s pre-flip copy — it read the lane's
   marker and needed no escape, but it is not evidence about the flipped gate. An earlier cut of this line said
   otherwise.*

3. **The CI-gated callers still land** — the half the first cut missed. `buildPrLandArgs`'s real argv, parsed with
   `pr-land`'s own parser and fed through `resolveVerifyOptions` + `verifyGateDecision`, must let an **absent**
   marker through (`ok`/`untracked`) — that is the marker state the drain actually sees. Pinned in
   `we:scripts/__tests__/lane-drain.test.mjs`, together with the same call *without* the flag asserted as
   `unverified`, so the flag is provably load-bearing rather than decorative. The `/workflow` producer's four
   invocations carry the same flag (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js`).
   An earlier revision of this criterion added of those four: *"those are prompt strings, so they are pinned by
   inspection and by the completeness note above, not by a test."* **No longer true, and it was the weak spot** —
   "pinned by inspection" is the same hand-sweep that had already been wrong twice. They are now pinned by the
   caller sweep in `we:scripts/__tests__/lane-verify.test.mjs`, which harvests them from the file's own source and
   runs each through the real resolver and gate; being prompt strings is no obstacle, since the sweep reads the
   source text rather than executing the workflow. The same test asserts the count is **four**, so an invocation
   added or removed without thought reddens too.

4. **The escapes are distinguishable** — under the opt-out, a fresh `running` marker still returns
   `verify-unfinished` and a corrupt marker still returns `verify-corrupt`; only `WE_LAND_UNVERIFIED=1` returns
   `break-glass` for those. Collapsing the two would silently promote the narrow opt-out into the full bypass.

5. **The resolver's stated contract is exhaustively pinned** — all 27 combinations of
   `--require-verified` × `--no-require-verified` × `WE_REQUIRE_VERIFIED` (each of absent / affirmative /
   negative) are asserted against the documented rule, including the negated-negative spellings the comments
   claim resolve toward *required*. Documented-and-untested is how a stated contract becomes an accidental one.
