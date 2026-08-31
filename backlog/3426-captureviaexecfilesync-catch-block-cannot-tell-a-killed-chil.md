---
bornAs: xwt6ola
kind: story
size: 2
status: resolved
dateOpened: "2026-08-31"
dateStarted: "2026-08-31"
dateResolved: "2026-08-31"
graduatedTo: none
tags: []
---

# captureViaExecFileSync catch-block cannot tell a killed child from a genuine non-zero exit

we:scripts/__tests__/citation-gate-dedup.test.mjs and we:scripts/__tests__/stdout-flush.test.mjs both used a captureViaExecFileSync pattern that, on execFileSync throwing, read e.stdout and treated it as complete output. Under real full-suite contention this intermittently failed with SyntaxError: Unexpected end of JSON input -- reproduced 3x under load, never in isolation, never under up to 32-way concurrent synthetic subprocess load either.

RESOLUTION -- the filed "kill signal" hypothesis was DISPROVEN, not confirmed. A signal-based retry fix was built and measured against a real reproduction: the failure recurred with the SAME plain SyntaxError, not the signal-retry path's new explicit error -- e.signal was null on the failing run. The actual fix (we:scripts/lib/capture-via-exec-file-sync.mjs) is mechanism-agnostic: validate the shape of every attempt's output (success or caught non-zero exit alike) via an optional `validate` option, retry once on an invalid one, throw explicitly if both attempts fail. This catches truncation from ANY cause, not just a kill signal. The exact trigger under real contention stayed elusive despite real effort; the fix does not depend on pinning it down.

## Done when

1. **Executable** — a unit test that simulates a child process KILLED mid-write (e.g. spawn a script that
   writes partial JSON then receives SIGTERM, or a stub that throws an error with `signal` set and a
   truncated `stdout`) and asserts the fixed capture helper does NOT silently parse the partial payload as
   complete — it must surface this as a distinguishable failure (thrown error, or a sentinel return), not a
   `SyntaxError` from `JSON.parse` bubbling up as if it were a normal assertion failure.
2. **Executable** — the existing `we:scripts/__tests__/citation-gate-dedup.test.mjs` and
   `we:scripts/__tests__/stdout-flush.test.mjs` suites still pass unchanged on a genuine (non-killed)
   non-zero exit — the fix must not regress the case the current `catch` block correctly handles today.
