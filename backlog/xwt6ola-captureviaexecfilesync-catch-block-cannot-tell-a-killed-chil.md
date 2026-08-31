---
kind: story
size: 2
status: open
dateOpened: "2026-08-31"
tags: []
---

# captureViaExecFileSync catch-block cannot tell a killed child from a genuine non-zero exit

we:scripts/__tests__/citation-gate-dedup.test.mjs and we:scripts/__tests__/stdout-flush.test.mjs both use a captureViaExecFileSync pattern that, on execFileSync throwing, reads e.stdout and treats it as complete output. Under real full-suite contention this intermittently fails with SyntaxError: Unexpected end of JSON input -- twice in a row under load, never in isolation. Ruled out: pure CPU oversubscription alone and maxBuffer (256MB vs a 1.35MB payload). Likely mechanism: a kill signal under real contention truncates e.stdout mid-write, indistinguishable in the catch block from a genuine complete non-zero exit. Fix: check e.signal and/or validate JSON completeness before trusting it.

## Done when

1. **Executable** — a unit test that simulates a child process KILLED mid-write (e.g. spawn a script that
   writes partial JSON then receives SIGTERM, or a stub that throws an error with `signal` set and a
   truncated `stdout`) and asserts the fixed capture helper does NOT silently parse the partial payload as
   complete — it must surface this as a distinguishable failure (thrown error, or a sentinel return), not a
   `SyntaxError` from `JSON.parse` bubbling up as if it were a normal assertion failure.
2. **Executable** — the existing `we:scripts/__tests__/citation-gate-dedup.test.mjs` and
   `we:scripts/__tests__/stdout-flush.test.mjs` suites still pass unchanged on a genuine (non-killed)
   non-zero exit — the fix must not regress the case the current `catch` block correctly handles today.
