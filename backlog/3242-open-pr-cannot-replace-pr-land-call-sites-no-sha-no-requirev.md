---
bornAs: xz7ofjw
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# open-pr cannot replace pr-land call sites: no sha, no requireVerified, no dryRun

`open-pr` declares over `we:scripts/pr-land.mjs` (its own header says so), but its input schema is `ref/base/title/bodyFile/mode/parkLabel` — while all six skill instructions of the home pass at least one of `--sha=HEAD` (pin the exact commit), `--require-verified` (#2833 finish-guard) or `--dry-run` (rehearsal). Naming the operation at those sites would silently drop the flag, which is the PR #1508 regression shape and the same gap `#3240` closed for `verify --gate`. Until the three inputs exist the #3224 scan cannot carry an `open-pr` entry without emitting six findings nobody can act on, so the home stays undeclared-over and the miswiring stays invisible.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
