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

## Done when

1. **Executable** —

   ```
   npx vitest run lane-verify -t "#3321" | grep -qE "Tests +[0-9]+ passed"
   ```

   RED on `origin/main` (exit 1), GREEN on this branch (exit 0). Observed:

   | tree | vitest's own summary line | criterion exit |
   | --- | --- | --- |
   | `origin/main` (`379cf93c`) | `Tests  32 skipped (32)` | **1** |
   | this branch | `Tests  16 passed \| 32 skipped (48)` | **0** |

   *(Re-measured after the review round. The first cut of this table read `14 passed \| 32 skipped (46)` against
   `origin/main` at `1c293a0f`; both numbers are now stale — the review's fixes added two resolver-precedence
   cases, and `origin/main` has advanced. The RED side was re-run against the current tip, not carried over.)*

   **THE `grep` IS THE CRITERION, NOT DECORATION.** `npx vitest run lane-verify -t "#3321"` on its own exits
   **0** on `origin/main` — measured, not assumed: a `-t` filter that matches nothing is a selection of zero, and
   vitest treats an empty selection as success. A criterion written without the pipe is green *before* the work.
   `Tests +[0-9]+ passed` asserts that tests actually RAN, which is the property the criterion means to state.

2. **The gate still lets a verified lane through** — a gate that refuses everything is worse than the hole it
   closes, so the same 16 tests pin the PASS direction, not just the refusal: a `green` marker for THIS head is
   `ok`/`verified` with **no options passed at all**, and stays `ok` long past the TTL (sha-identity is the
   freshness test, not the clock). Proven end to end by this item's own PR, which was opened by a `pr-land` run
   whose finish-guard read a real `.git/.lane-verify` green marker written by `we:scripts/verify-lane.mjs`.

4. **The CI-gated caller still lands** — the half the first cut missed. `buildPrLandArgs`'s real argv, parsed with
   `pr-land`'s own parser and fed through `resolveVerifyOptions` + `verifyGateDecision`, must let an **absent**
   marker through (`ok`/`untracked`) — that is the marker state the drain actually sees. Pinned in
   `we:scripts/__tests__/lane-drain.test.mjs`, together with the same call *without* the flag asserted as
   `unverified`, so the flag is provably load-bearing rather than decorative.

3. **The escapes are distinguishable** — under the opt-out, a fresh `running` marker still returns
   `verify-unfinished` and a corrupt marker still returns `verify-corrupt`; only `WE_LAND_UNVERIFIED=1` returns
   `break-glass` for those. Collapsing the two would silently promote the narrow opt-out into the full bypass.
