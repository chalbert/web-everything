---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/github-app-auth-env.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/github-app-auth-env.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — When a persisted-file contract changes, grep for every writer/fixture of CACHE_VERSION / the cache path… (from chalbert/web-everything#3213 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/github-app-auth-env.mjs:278` — When a persisted-file contract changes, grep for every writer/fixture of CACHE_VERSION / the cache path. Better: a shared test helper that builds valid cache fixtures so a schema change fails one place.
2. `we:scripts/lib/gh-spend.mjs:470` — Add a test: persisted complete hour plus a raw log truncated by maxBytes mid-hour must keep the persisted row. Prefer the persisted row when skippedBytes > 0 and the hour starts before the first read line.
3. `we:scripts/lib/gh-throttle.mjs:1207` — Add a test that asserts block, headroom and personal-route behaviour across equivalent identities. Also add a lint or review-lens rule: changing the `ghAuthIdentity` output requires listing every keyed consumer.
4. `we:scripts/lib/gh-spend.mjs:465` — Add a deterministic regression test with a complete persisted hour and maxBytes cutting into that hour; require reconciliation to preserve complete evidence or explicitly retain competing partial evidence without substituting it as the complete row.
5. `we:scripts/lib/gh-spend.mjs` — Add a deterministic parameterized report test for absent, null, object, and string rl values, and use the same Array.isArray validation in coverage calculation as in attribution.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3213@f9d9a0635efd4e66501e2165ed227b9b37ff33e4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
