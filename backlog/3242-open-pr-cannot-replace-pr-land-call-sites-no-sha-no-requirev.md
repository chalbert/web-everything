---
bornAs: xz7ofjw
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateStarted: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# open-pr cannot replace pr-land call sites: no sha, no requireVerified, no dryRun

`open-pr` declares over `we:scripts/pr-land.mjs` (its own header says so), but its input schema is `ref/base/title/bodyFile/mode/parkLabel` — while all six skill instructions of the home pass at least one of `--sha=HEAD` (pin the exact commit), `--require-verified` (#2833 finish-guard) or `--dry-run` (rehearsal). Naming the operation at those sites would silently drop the flag, which is the PR #1508 regression shape and the same gap `#3240` closed for `verify --gate`. Until the three inputs exist the #3224 scan cannot carry an `open-pr` entry without emitting six findings nobody can act on, so the home stays undeclared-over and the miswiring stays invisible.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/open-pr.test.mjs` passes, covering the
   pass-through at BOTH layers because each can drop a value independently: `planOpen` emits `--sha`,
   `--require-verified` and `--dry-run` when asked, and the `plan` step both declares the three reads and
   threads them into `planOpen`.
2. **Executable** — the same suite pins that an unset `sha` OMITS the flag (the home's `HEAD` default is not
   restated here) and that a false boolean omits its flag rather than passing `--dry-run=false`, which the
   home reads as `!!'false'` — true — and would silently turn a real land into a rehearsal.
3. **Observable** — the operation still cannot WAIVE the gate: no value of any input emits `--break-glass` or
   `--no-verify`, and the load-bearing negative test says so.

**Not done here, deliberately:** the `#3224` map still carries no `open-pr` entry, because `title` remains
required where the home makes it optional — see `#3245`. Three of four gaps closed, and the fourth is
named rather than papered over.
