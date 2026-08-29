---
kind: task
status: open
dateOpened: "2026-08-29"
scope:
  - we:scripts/lib/verify-lane-gate.mjs
tags: []
---

# verify-lane's shellQuote has no adversarial test for its shell-injection escaping

`shellQuote()` (#3372, `we:scripts/lib/verify-lane-gate.mjs:22`) escapes diff-derived file paths before they are
spliced into a command string later run via a real shell (`execSync(GATE, {stdio:'inherit'})`). The escaping is
claimed correct in a doc comment but defended by zero tests: mutating it to the naive unescaped form still
passes all 8 existing tests in `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`. A future "simplification" of
`shellQuote` could silently reintroduce local command injection with CI staying green. Surfaced as a CONFIRMED
security finding in the #1678 PR review (mutation-tested and confirmed exploitable against a real `/bin/sh`
when unescaped).

## Done when

1. **Executable** — a test that feeds `resolveDefaultGate` a changed-file path containing a single quote and
   shell metacharacters, and asserts the resulting `command`, when actually executed through `/bin/sh`, does not
   run the embedded payload — a deterministic gate on the security property itself, not just on command shape.
2. `npm run check:standards` — 0 errors.
