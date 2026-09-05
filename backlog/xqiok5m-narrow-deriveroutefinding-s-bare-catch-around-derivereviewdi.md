---
kind: task
parent: "3443"
status: open
scope: ["we:scripts/operations/route-pr-outcome-io.mjs", "we:scripts/operations/__tests__/route-pr-outcome.test.mjs"]
dateOpened: "2026-09-05"
tags: []
---

# Narrow deriveRouteFinding's bare catch around deriveReviewDisposition to the unknown-reason-token error only

Carve-out from #3482's `/converge` run (2 independent lenses — correctness and standards-conformance — flagged
the same issue across round 1's panel and its red-team). `we:scripts/operations/route-pr-outcome-io.mjs`'s
`deriveRouteFinding` wraps `deriveReviewDisposition({reasons})` in a bare `catch {}` and maps ANY thrown error to
`refusal: 'unrecognized-reasons'` (action `unrouted`), not just the one error `deriveReviewDisposition` is
actually documented to throw for a genuinely-unrecognized reason token. If that shared function ever throws for
an unrelated cause (a future precondition check, an internal bug), this silently reclassifies it as an ordinary
"nothing to route" refusal instead of surfacing the failure — the exact silent-collapse-between-distinct-causes
the file's own header warns against for the `gh`-call-failure path, just not applied with the same rigor here.
Judged `carve-out` (not `worseThanBase`, since the module is wholly new — main previously had no such operation
at all) rather than a landing blocker, but flagged `preventionCaptured: false`, so it is owed this filing.

## Done when

1. **Executable** — `deriveRouteFinding` catches only the specific error `deriveReviewDisposition` throws for an
   unrecognized reason token (matched by message or a dedicated error type, not a bare `catch {}`), and re-throws
   anything else. A new test in `we:scripts/operations/__tests__/route-pr-outcome.test.mjs` stubs
   `deriveReviewDisposition` to throw an unrelated error (e.g. a `TypeError` unrelated to reason-token parsing)
   and asserts `deriveRouteFinding`/the operation propagates it rather than reporting `refusal:
   'unrecognized-reasons'`.
