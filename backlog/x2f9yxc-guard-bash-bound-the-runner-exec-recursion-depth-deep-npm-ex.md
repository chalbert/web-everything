---
kind: task
status: open
dateOpened: "2026-08-08"
tags: [gate, footgun]
---

# guard-bash: bound the runner-exec recursion depth — deep `npm exec` nesting throws and fails the hook OPEN

`we:scripts/guard-bash.mjs#isTreeWritingBuildRun` recurses once per `exec`/`dlx` layer with no depth
cap, and `decide()` is called from the CLI *outside* the try/catch. A deeply nested command therefore
blows the JS stack, the hook exits 1 with no deny on stdout, and the command is allowed — where main
denies it.

## The bug

Two independent halves, both in `we:scripts/guard-bash.mjs`:

1. **Unbounded recursion.** Each `npm exec …` layer re-enters `isTreeWritingBuildRun` on the
   remainder. Nothing caps the depth, and each layer re-scans the whole remaining string, so the
   work is quadratic in the nesting depth. At depth ≈5000 (`npm exec ` repeated — about a 45 KB
   command line) `decide()` throws `RangeError: Maximum call stack size exceeded`.
2. **The throw is not contained.** The CLI's `try { … } catch { process.exit(0); }` wraps only the
   payload parse and cwd/lease resolution. `decide()` runs after it, so an exception there is an
   unhandled rejection: exit code 1, empty stdout, no `permissionDecision` — i.e. fail-OPEN.

## Why it is filed separately, not folded into PR #1092

Found during the #2986/#2994 review-r2 fix (PR #1092, `lane/guard-false-denies`). The trigger is a
~45 KB pathological string no honest agent produces, and the recursion rewrite that PR needed for
BLOCKER 2 does not create the problem — it inherits it from the first `RUNNER_EXEC` cut. Growing that
PR for a synthetic input was the worse trade.

## Done when

- The `exec`/`dlx` recursion carries a small depth budget (single digits covers every real command);
  past it the guard makes a decision rather than recursing.
- `decide()` runs inside a try/catch in the CLI, so any future guard fault degrades to the documented
  fail-open ALLOW with an explicit stderr note, never an unhandled exit-1.
- A unit test feeds a deep nesting and asserts the hook still exits 0 with a well-formed decision.
