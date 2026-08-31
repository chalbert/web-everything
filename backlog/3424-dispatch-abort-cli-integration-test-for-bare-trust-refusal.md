---
bornAs: xfv12l6
kind: task
status: open
dateOpened: "2026-08-31"
costTokens: "in:120 cw:125418 cr:6440826 out:20722"
costUsd: 4.99
costSessions: 1
tags: []
---

# dispatch-abort: CLI-integration test for bare --trust refusal

`we:scripts/operations/dispatch-abort.mjs`'s `requireTrustDir` guard (refuses a bare `--trust` with no value
rather than silently trusting the CWD) is unit-tested only as an isolated pure function — nothing exercises the
`IS_CLI` block that actually wires it into the `--trust` flag path. A refactor that drops or bypasses the
`requireTrustDir(trustDir)` call at the CLI call site would silently reintroduce the exact bug PR #1737 was
escalated to fix, with the full suite staying green. Carved out of PR #1737's review (`review:accepted` with
this coverage gap noted, not blocking) rather than fixed in-PR.

## Done when

1. **Executable** — `node we:scripts/operations/dispatch-abort.mjs --trust` (no value), run as a real child
   process (mirroring `we:scripts/operations/__tests__/wake-cli.test.mjs`'s subprocess pattern), asserts a
   non-zero exit and the `--trust needs a directory` refusal message. The test fails today (no such test
   exists) and passes once added.
