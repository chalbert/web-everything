---
kind: story
size: 2
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Audit WE runtime for hand-rolled equivalents of newly-shipped ES built-ins

TC39/JS lens: several built-ins reached Stage 4 in 2025-2026 (Iterator helpers, Set methods, using / explicit resource management, Error.isError, Array.fromAsync, RegExp.escape). Audit the WE runtime — notably the webexpressions interpreter — for hand-rolled equivalents and defer to the native built-ins per native-first (#031). Low-priority cleanup. Surfaced by the 2026-06-20 platform-standards watch (#1257), TC39 lens.
