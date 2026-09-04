---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lib/stdout-flush-scan.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# stdout-flush-scan's WINDOW=10 lookahead misses a real write-then-exit truncation more than 10 lines apart

Live incident: we:scripts/readiness/dispatch-plan.mjs had a real process.stdout.write(...) at line 508 followed by process.exit(0) at line 527 (19 lines apart, same function, same if/else statement) that truncated its --json output at exactly 8192 bytes when read via execFileSync (we:scripts/conveyor/tick-core.mjs's runJson) -- the exact #3061 footgun the check:standards stdout-flush gate exists to catch at baseline zero. Confirmed live: scanStdoutFlush(repoRoot) returns zero hits for this file even after the bug was reproduced and fixed. Root cause read directly in we:scripts/lib/stdout-flush-scan.mjs: findStdoutFlushViolations bounds its exit-lookahead to last = Math.min(fn ? fn.end : lines.length - 1, i + WINDOW) with WINDOW=10 (line 79) -- a write and a same-function exit more than 10 source lines apart is silently not scanned, even though the function-extent bound (fn.end, already computed and correct) would have found it with no risk of cross-function contamination (that risk is what enclosing()/exitFns already guard against independently). This is a real, reproducible false-negative in a gate whose whole stated purpose is baseline-zero coverage of this exact bug shape, not a hypothetical. Fixed instance: we:scripts/readiness/dispatch-plan.mjs itself was fixed separately (writeLineSync from we:scripts/lib/write-all-sync.mjs) in the same session this was found.

## Done when

1. **Executable** — a regression fixture (a `.mjs` fixture file with a `process.stdout.write(...)` on a
   dynamic argument followed by `process.exit(0)` more than 10 lines later, inside the same function, no
   intervening exit) added under `we:scripts/lib/__tests__/stdout-flush.test.mjs`'s existing fixture corpus
   fails against today's `we:scripts/lib/stdout-flush-scan.mjs` (zero hits) and passes once the lookahead is
   widened to the function's own extent (`fn.end`) rather than capped at `i + WINDOW`.
2. Re-run `scanStdoutFlush(repoRoot)` against the live tree after the fix — no new violations surface (the
   widened window must not start flagging unrelated same-function exits that are genuinely on a different
   logical branch; if it does, the fix needs a narrower reachability check, not a reverted window).
