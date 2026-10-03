---
bornAs: xbkyj9x
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/helpers/secret-absence.mjs", "we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "f3806c8b7b6562ec202dbf4ef42c343bb73f6d07"
tags: []
---

# Prevention — Add a runGhCliPassthrough case for a personal-route rate-limit 403 that asserts no fallback and the rat… (from chalbert/web-everything#3341 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:1753` — Add a runGhCliPassthrough case for a personal-route rate-limit 403 that asserts no fallback and the rate-limit retry/backoff path. A lens that asks for each exclusion in a predicate to have one wired-through test would catch this class.
2. `we:scripts/lib/__tests__/helpers/secret-absence.mjs:19` — A linter rule banning `.toContain()` on arrays of strings when checking for secrets, or requiring environment variables to be serialized to a string (e.g., `JSON.stringify`) before substring assertions.
3. `we:scripts/lib/gh-throttle.mjs:1307` — A strict coverage gate enforcing that all documented guarantees in docstrings map to an explicit, named integration test that exercises the runtime behavior.
4. `we:scripts/lib/gh-throttle.mjs:463` — A review standard or coverage tool that demands explicit test cases for edge-case behaviors highlighted in code comments (such as relying on empty array boolean resolution).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3341@88de395bbed34e2e273ba9ce0c35230bb5a9c14d

## Premise check (2026-10-02, vs `main` f3806c8b7)

The goal is NOT delivered: `git log --grep=4777` shows only the card-filing commit. `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs` pins the *predicate* (`looksLikePersonalAccessDenial`, line 361: rate-limit 403 → `false`) and a *non-rate-limit* 403 fallback (line 335), but no test drives a personal-route rate-limit 403 *through* `runGhCliPassthrough`. The primary-exhaustion path (line 279) uses `GraphQL: API rate limit exceeded`, not a 403 secondary limit.

Citation drift (corrected, goal unchanged): item 1's `we:scripts/lib/gh-throttle.mjs:1753` is now the fallback condition at `we:scripts/lib/gh-throttle.mjs:1773` (`looksLikePersonalAccessDenial` use inside `runGhCliPassthrough`; def. `we:scripts/lib/gh-throttle.mjs:1310`); item 3's `:1307` is that same predicate's doc, now at 1310; item 4's `:463` is the empty-array `methods.every(...)` in `classifyGhRead`, now `we:scripts/lib/gh-throttle.mjs:465`. `scope:` is corrected to the two files the build actually edits (the secret-absence helper and the personal-route test); `we:scripts/lib/gh-throttle.mjs` is only mutated temporarily for the RED proof, never committed, and the base gh-throttle test file is not touched.

## Design

`runGhCliPassthrough` (`we:scripts/lib/gh-throttle.mjs:1644`) routes an eligible read onto the personal token. When the child fails, the once-only App fallback fires only if `looksLikeGhAuthFailure(stderr) || looksLikePersonalAccessDenial(stderr)`. `looksLikePersonalAccessDenial` (~1307) returns `false` when `isRateLimitShaped(stderr)`, so a personal-route 403 such as `HTTP 403: You have exceeded a secondary rate limit` skips the fallback, is not a *primary* exhaustion (`primaryExhaustedResource` returns `null` for "secondary rate limit"), and so reaches the generic retry loop: `calibratedBackoffMs` + `sleep`, re-spawning with the **personal** env each attempt, until `maxAttempts` → `retry_exhausted`.

Add one wired-through test in `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs`, next to the existing 403 `it.each` (~line 331): spawn mock always returns that 403 on the personal-token call (`opts.env.GH_TOKEN === PERSONAL_TOKEN`), `maxAttempts: 3`, `retryBaseMs: 1`, injected `sleep` spy, a FRESH uncontended temp `lockRoot` (so the acquire helpers never call `sleep`), `WE_GH_THROTTLE_COST_HEADERS: '0'` and no `GH_DEBUG` (no headers, so the backoff source is `guessed-backoff` and `sleep` receives the `retryBaseMs`-derived value). The mock returns the 403 on the personal-token call and success on an env-less call, so the mutation run fails cleanly on (a)/(b). Assert: (a) every spawn call carries the personal token (no App fallback — never an `env`-less call); (b) `spawn` called exactly `maxAttempts` times; (c) `sleep` called `maxAttempts - 1` times; (d) final `status` is the failing status and stderr relayed; (e) the sidecar log has `retry_exhausted` and no `personal_token_rejected`; (f) no personal budget block written (secondary, not primary).

Also fix the weak assertion in `we:scripts/lib/__tests__/helpers/secret-absence.mjs:19`: `expect(Object.values(process.env)).not.toContain(sentinel)` is an exact array-element match, so a secret embedded in a longer value (`Bearer gho_…`) passes. Replace with `Object.values(process.env).join('\n')` and `.toContain(sentinel)` on that string (a substring check; not `JSON.stringify`, which escapes quotes/backslashes/non-ASCII and could miss a sentinel containing them). The self-test uses `expect(() => expectSecretAbsent(...)).toThrow()` and restores `process.env.__TEST_X` in `finally`. Keep the helper's own doc comment honest ("only checks with teeth").

## MVP

Musts only:
1. The personal-route rate-limit-403 wired-through test above (item 1).
2. The `we:scripts/lib/__tests__/helpers/secret-absence.mjs` substring fix, plus a tiny self-test in `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs` or a helper test proving it fails on `process.env.X = 'Bearer ' + sentinel` (item 2's *instance*).
3. One wired-through pin for the empty-method-list `gh api` GET read in `classifyGhRead` routed via `runGhCliPassthrough` (item 4's instance): `['api','repos/o/n']` is routed to the personal token. (Cheap, same file; if `classifyGhRead` unit coverage at line 36 is judged sufficient by the builder, record that in Progress and skip.)

OUT of scope (Follow-ups): lint rule / coverage gate / review standard (items 2–4 general guards).

## Test plan

- Preservation case (GREEN today, passes on base and after; mutation proof named): `personal rate-limit 403 → no App fallback, backs off on the personal token`. Mutation proof: delete the `if (isRateLimitShaped(s)) return false;` line in `looksLikePersonalAccessDenial`; the call then falls back to the App (second spawn has `env` undefined) and assertion (a) fails. Restore it.
- Capability case (RED today): `expectSecretAbsent catches a secret embedded in a longer env value` — sets `process.env.__TEST_X = 'Bearer ' + sentinel` (restored in `finally`) and expects the helper to throw. RED on base because the exact-match `.toContain` on the array passes, so no throw happens.
- Preservation case (GREEN today; mutation proof named): `plain gh api GET (no method flag) routes to the personal token` — asserts the spawn env token. Mutation proof: change `methods.every(...)` to require a non-empty method list; the case then fails.

## Proof plan

Run `npx vitest run gh-throttle.personal-route` and show (1) the mutation run (exclusion line removed → new test red, secret self-test red on old helper), (2) the restored run green with the new tests listed by name, and (3) `npm run check:standards` green. No live GitHub call is needed; the surface is a pure-unit seam with an injected `spawn`.

## Follow-ups

Each a future backlog item (builder files them):
- Lint rule banning `.toContain()` on arrays of strings for secret checks (or requiring serialization first) — item 2's general guard.
- Review lens / coverage gate: every exclusion in a predicate has one wired-through test (item 1's class).
- Coverage gate mapping documented docstring guarantees to a named integration test (item 3, `:1307`).
- Review standard demanding explicit tests for edge behaviors called out in code comments, e.g. empty-array `every` (item 4's class).

## Done when

1. **Executable** — `npx vitest run gh-throttle.personal-route` passes including the new personal-route rate-limit-403 case, and fails on that case when the `isRateLimitShaped` exclusion in `looksLikePersonalAccessDenial` is removed.
2. **Executable** — `expectSecretAbsent` throws when the sentinel is embedded inside a longer `process.env` value (covered by a named test).
