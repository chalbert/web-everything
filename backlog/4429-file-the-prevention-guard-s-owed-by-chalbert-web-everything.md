---
bornAs: xl69x5t
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-rest-read.mjs", "we:scripts/lane-whois.mjs", "we:scripts/lib/__tests__/gh-rest-read.test.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2896's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-rest-read.mjs:128` — Create the cache dir with mode 0o700 and write files with 0o600, then add a test that asserts the modes. Longer term, add a lint rule that flags `mkdirSync` / `writeJsonAtomic` calls under ~/.claude that carry no explicit mode.
2. `we:scripts/lane-whois.mjs:330` — Validate `ghRepo` against /^[\w.-]+\/[\w.-]+$/ before building the path. Put this validation inside `ghRestGetJson` for `repos/` paths so every converted caller inherits it.
3. `we:scripts/lib/gh-rest-read.mjs:125` — A lint rule enforcing that any `JSON.parse` of HTTP bodies or cached equivalents must fall back to a safe default if the string is empty, or a unit test that explicitly asserts the 304 path handles the exact same empty-body boundary cases as the 200 path.
4. `we:scripts/lane-whois.mjs:355` — TypeScript strict null checks or a structural linter that flags inconsistent null-guards on the same object within a single function.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2896@fed7b23ffd24f01c243d72e8c11a0c7b76ac6dc8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
