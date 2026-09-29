---
bornAs: xw93qky
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-09-28"
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

1. **Executable** — TODO: a command that fails before this item lands and passes after.
