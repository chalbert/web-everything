---
bornAs: xwdpujf
kind: task
status: open
dateOpened: "2026-08-29"
scope:
  - we:scripts/lib/verify-lane-gate.mjs
tags: []
---

# verify-lane's diff-driven gate ignores a dirty tracked working tree

`resolveDefaultGate` (#3372, `we:scripts/lib/verify-lane-gate.mjs:24`) computes the shrink decision from
`git diff <merge-base> HEAD` only — never the working tree. A lane that commits a shrinkable-only diff, then
makes an additional UNCOMMITTED edit to an unrelated file, gets a `shrink` decision that never touches the
uncommitted edit; if that edit breaks something, `verify-lane` reports GREEN. Previously the bare
`npm run test:unit` always caught this regardless of commit status. Surfaced as a CONFIRMED correctness finding
in the #1678 PR review (empirically reproduced with a staged-but-uncommitted file).

## Done when

1. **Executable** — a test asserting `resolveDefaultGate` refuses to `shrink` (forces `FULL_GATE`) when the
   tracked working tree is dirty (e.g. `git status --porcelain --untracked-files=no` non-empty), mirroring the
   existing fail-safe-on-unresolvable-diff branch.
2. `npm run check:standards` — 0 errors.
