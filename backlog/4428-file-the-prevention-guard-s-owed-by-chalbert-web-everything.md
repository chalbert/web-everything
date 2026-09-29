---
bornAs: xkq7e0a
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2851's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:560` — On an unclosed block, drop everything from `* Request at` up to the first line that is not part of the trace. Alternatively, strip nothing and fail closed by suppressing stderr except lines gh itself printed. Add a fidelity test that puts a sentinel string in the request body of a cut trace and asserts it is absent from relayed stderr.
2. `we:scripts/lib/gh-throttle.mjs:575` — Only accept `< ` header lines between `< HTTP/…` and the first blank line. Once the header section ends, treat everything as body until a `* Request took` that follows a blank line, and ignore all other markers. Add a fixture with a non-JSON body containing marker-shaped lines.
3. `we:scripts/lib/gh-spend.mjs` — Extend the mixed-resource unit test to assert per-bucket response counts, including a resource with only a baseline observation, and gate changes on that test.
4. `we:scripts/lib/gh-spend.mjs` — Add a deterministic two-tick persistence test with a shared invocation ID across the hour boundary, asserting one total invocation and preservation of all responses and points.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2851@d0d4fc364740e098692f211a4f8befd83af767ff

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
