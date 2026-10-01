---
bornAs: xw93qky
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/helpers/secret-absence.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2885's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:1512` — Add a failure-mode-matrix test row for a routed read that returns 403/404, and decide explicitly whether it falls back or is documented as out of scope. Filing that as a follow-up card is the cheapest guard.
2. `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs:1` — A test-hygiene rule for any module that handles a credential: assert that the credential string is absent from every log/stdout/stderr sink and from process.env after the call. This would be a shared helper in the throttle test suite.
3. `we:scripts/lib/gh-throttle.mjs:1419` — Add a follow-up that limits routing to calls whose target is pinned via -R/--repo, or an api path under an allowlist of the App's installation repos. Document the scope-widening in the card's opt-in text. Ideally lint that any new token-swap path names its scope boundary.
4. `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs:118` — Seed process.env.GH_TOKEN and process.env.GITHUB_TOKEN with sentinels via vi.stubEnv in a beforeEach, then assert they are absent from the exec env. More generally, a review lens or lint for 'not.toBeUndefined/toBeUndefined assertion on a key the test never sets'.
5. `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs:254` — Add a repo check or review lens that maps each 'never X' or 'cannot Y' claim in a diff's comments to a named test. For token handling specifically, add a shared test helper that asserts a sentinel token is absent from all log output and process.env.
6. `we:scripts/lib/gh-throttle.mjs:327` — A test coverage gate (like branch coverage) or a semantic review rule that maps every described behavior to a test.
7. `we:scripts/lib/gh-throttle.mjs:347` — Line-level mutation testing or enforcing 100% branch coverage on classifier logic.
8. `we:scripts/lib/gh-throttle.mjs:428` — Semantic review gate that ensures every specific claim in a docblock has a corresponding test.
9. `we:scripts/lib/gh-throttle.mjs:429` — Require explicit `--method GET` or `HEAD` for all `gh api` calls in the read classifier, rather than defaulting empty methods to true.
10. `we:scripts/lib/gh-throttle.mjs:372` — Add exhaustive internal unit tests for `scanGhApiFlags` that assert the exact parsed `methods` and `payload` state rather than just testing the final boolean `classifyGhRead` result.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2885@1a936fa976e4a8ae9ab01abc12bad8ad91da2f8e

## Done when

1. **Executable** — `npx vitest run gh-throttle` is GREEN on current code for the pin rows but the 404/403 fallback row, and the hardened `personalGhToken` env-seeding test, FAIL on current code (fallback absent / mutant-able); the mutant run in the Proof plan is the RED gate for the rest. Passes after the item lands.

## Progress

- 2026-09-30 prepare pass. **Premise check:** `git log` for `4450`/`xw93qky` on `main` shows only the JIT-number rename commit — nothing delivers the guards; `scanGhApiFlags` has no direct unit test (grep over `scripts/lib/__tests__/` finds it only via `classifyGhRead`), `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs` has no 403/404 row and no secret-absence assertion. Premise holds, not already-done.
- **Citation drift corrected** (code moved since #2885): the card's `we:scripts/lib/gh-throttle.mjs:327/347/372/419/428/429/1419/1512` now live at `scanGhApiFlags` (~378), `classifyGhRead` (~452, `methods.every` at ~465), `hasGhApiPayloadFlag` (~430), `personalGhToken` (~1257), the routing block in `runGhCliPassthrough` (~1648-1662) and the rejected-token fallback (~1737-1790). Scope list unchanged (still the three files above) — verified correct.

## Design

All ten items target the personal-identity read routing added by xhcgdce / PR #2885. Only 1–5, 9, 10 are code/test guards in the three scoped files; 6–8 are repo-wide process gates and are Follow-ups.

- **#1 — routed read returns 403/404.** `runGhCliPassthrough` falls back to the App only on `looksLikeGhAuthFailure` (HTTP 401 / "Bad credentials") and on a personal-bucket block. **Decision, derived from the module's existing principle (not a new policy): the personal identity is only ever a BONUS bucket (we:scripts/lib/gh-throttle.mjs routing-block comment, "never fails fast while the App may still have budget").** A 404, or a 403 that is not a rate-limit (e.g. SSO/SAML, repo invisible to the personal login), under the personal token means the personal identity cannot serve the read — exactly what the App path did before routing was enabled. So it takes the SAME once-only App fallback as the 401 path (`appFallbackTried`, after the App-block check); no-fallback would make opting in hard-fail reads of any repo the personal login cannot see. Implement by extending the rejected-token branch (we:scripts/lib/gh-throttle.mjs ~1737) with a `looksLikePersonalAccessDenial` predicate (HTTP 403 without a rate-limit signal, or HTTP 404); a rate-limit 403 keeps its existing budget path. Writes are never routed, so no mutation can be retried on a wrong identity.
- **#2/#5/#4 — credential hygiene.** Add a shared helper module `we:scripts/lib/__tests__/helpers/secret-absence.mjs` (`expectSecretAbsent(sentinel, { logPath, sinks, env })`) so it is genuinely shared across the throttle suites (item #5 asks for a shared helper). Make it non-vacuous: the `spawn` mock in the new routed-read test ECHOES the sentinel on stdout/stderr of the child's visible env path only where the module relays it (the module must not log it), and the helper asserts the sentinel is absent from the `calls.jsonl` sidecar (`ghThrottleLogPath`) and from `process.env` (snapshot before/after — guards a future `process.env.GH_TOKEN = …` regression). Only the checks with teeth are claimed: sidecar log and process.env. In we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs, `vi.stubEnv('GH_TOKEN', …)`/`GITHUB_TOKEN` are scoped to the `personalGhToken` describe with `vi.unstubAllEnvs()` in `afterEach`, so the existing `toBeUndefined` assertions (lines ~110-111) are real and nothing leaks into later tests. Map the "token is never logged" comment (we:scripts/lib/gh-throttle.mjs ~1647) to the named test.
- **#3 — scope boundary.** The routing block (we:scripts/lib/gh-throttle.mjs ~1651) swaps the token for any classified read regardless of target repo. MVP is *document and pin, not endorse*: the opt-in doc comment on `resolvePersonalRouteEnabled` states that the operator opts in to reads of ANY repo/search their personal login can reach, as a TOLERATED consequence of the off-by-default opt-in (the opt-in text is the only guard); a test named "personal route is unrestricted by target repo today (tolerated, see follow-up)" pins it so tightening is a visible diff. Enforcement is a Follow-up.
- **#9 — empty method defaults to read.** `classifyGhRead` returns `methods.every(GET|HEAD)`, true for an empty list. **Dismissed as a code change:** `gh api` with no payload and no method *is* a GET, payload/unknown flags are already rejected before `every`, and requiring an explicit method would push every plain `gh api repos/o/n` read to the App. Pin by a one-line comment at the `every` call stating why; existing rows (line ~42 plain read, the `-f key=v` row) already test it, so no new row is added.
- **#10 — `scanGhApiFlags` internals.** Add a table-driven unit test in `we:scripts/lib/__tests__/gh-throttle.test.mjs` asserting the exact `{ methods, payload, unknown }` object for each spelling (`--method=post`, `-XPOST`, `-iXPOST`, repeated `--method`, `-fk=v`, `--input=f`, `--`, unknown short letter `-z`, a value flag swallowing the next arg), not just the boolean `classifyGhRead` result.

## MVP

Musts only: #1 (small behavior change: once-only App fallback on a personal 404/non-rate-limit 403, + tests), #2/#4/#5 (shared secret-absence helper, scoped stubbed-env test, comment-to-test mapping), #3 (document as TOLERATED + pin, no enforcement), #10 (exact-state table test). #9 is dismissed with a comment only. Touches the three scoped files plus the new shared helper; the only runtime change is the #1 fallback.

Explicitly OUT: see Follow-ups.

## Test plan

- `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs` / "personal 404 and non-rate-limit 403 fall back once to the App": spawn returns 404 (then 403 w/o rate-limit headers) under the personal token, then 0 on the App env; asserts 2 calls, second with the App env, result 0. **RED on current code** (no fallback → status 1, 1 call). Twin: a rate-limit 403 keeps the budget path (no extra generic fallback); an App-also-blocked case fails fast with no call.
- Same file / "secret sentinel absent from sidecar log and process.env after a routed read" via the shared helper. RED only under mutant M1 (below).
- we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs `personalGhToken` describe with scoped `vi.stubEnv` + `vi.unstubAllEnvs()` in `afterEach`. RED under mutant M2.
- we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs / "personal route is unrestricted by target repo today (tolerated)" — a routed `-R other/repo` read still swaps the token. A pin: green now, RED under mutant M3 (add a repo allowlist), flipping deliberately when the follow-up lands.
- `we:scripts/lib/__tests__/gh-throttle.test.mjs` / `scanGhApiFlags` exact `{methods,payload,unknown}` table over the spellings in Design #10 (pin: green now; RED under M4).

## Proof plan

Run from the lane: `npx vitest run gh-throttle` (name filter; the `we:` prefix is a card convention, not a path). Show before/after counts in the PR body:
1. Before the #1 change: the new fallback row FAILS on current code (RED), then passes after.
2. Mutants applied to we:scripts/lib/gh-throttle.mjs one at a time, each must turn its named test RED, then revert and show green:
   - **M1** add `token: personal` to the routed-call `recordGhCallLogEntry` payload → secret-absence test RED.
   - **M2** drop `for (const k of GH_TOKEN_ENV_KEYS) delete cleanEnv[k]` in `personalGhToken` (~1262) → hardened env test RED.
   - **M3** gate the personal swap on `argv.includes('-R')` → unrestricted-target pin RED.
   - **M4** in `scanGhApiFlags`, `break` after the first `--method` → exact-state table RED.
   - **M5** widen `looksLikePersonalAccessDenial` to all 4xx → rate-limit-403 twin RED.
`npm run check:standards` must be green.

## Follow-ups

Not Musts; each a future backlog item (builder files them):
- **#3 enforcement** — restrict personal-token routing to calls pinned by `-R/--repo` or an `api` path under the App's installation repos, plus a lint that any new token-swap path names its scope boundary (behavior change, needs a product call on fallback semantics).
- **#6** — coverage/semantic gate mapping each described behavior to a test.
- **#7** — line-level mutation testing or 100% branch coverage on classifier logic (`classifyGhRead`, `scanGhApiFlags`).
- **#8** — review gate mapping each docblock claim ("never X") to a named test (generalizes #5).
- **#9 alternative** — if the operator later wants the stricter explicit-GET rule, file it as a deliberate narrowing with its budget cost measured.
