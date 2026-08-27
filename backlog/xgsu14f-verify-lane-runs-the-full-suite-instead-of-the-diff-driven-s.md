---
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-27"
scope:
  - we:scripts/verify-lane.mjs
tags: []
---

# verify-lane runs the full suite, unaware the diff-driven selection it needs already shipped

`we:scripts/verify-lane.mjs`'s default gate is `npm run test:unit && npm run check:standards` — a bare, unscoped `vitest run` on every pre-land check. Under concurrent lanes this is the active bottleneck: six agents verifying at once means six full-suite runs competing for one machine tonight, and it killed at least one run outright.

## What already exists — verify this before building anything

**The shrink and its recovery path are both already built.** `we:scripts/readiness/test-selection.mjs`
(#2681, under #2612) is diff-driven test selection with a deny-by-default allow-list, selecting off the real
`git diff` via vitest's own module graph, pinned to the merge-base. `we:scripts/readiness/red-main-remediation.mjs`
is the dispatch-freeze + revert-authority recovery path the shrink's own DoD required before it could default on.
Its header states the DoD is satisfied: *"it may safely exist (and be consulted) before the shrink is ever
defaulted."*

**The flag is on in CI, off everywhere else.** `WE_DIFF_TEST_SELECTION` is set to `"1"` in
`we:.github/workflows/ci.yml`. `we:scripts/verify-lane.mjs`'s default `GATE` never sets it and has no awareness
the env var exists — it runs `npm run test:unit`, not the selection module directly. So the shrink exists and is
proven safe by its own remediation, and the one caller that would benefit most under tonight's load simply never
asked for it.

## Why this is small, not a redesign

Nothing here proposes new test-selection logic. The question is narrower: **should `verify-lane`'s default gate
set the selection flag (or shell the selection module directly) instead of the bare command?**

One thing to check before assuming yes: the selection module's own limits are stated in its header —
directory-based test discovery is invisible to a diff-based selector, and a diff falling under a sensitive
surface with no matching allow-list entry is **not shrinkable** by design (fails safe, not silently). Confirm
`verify-lane`'s own gate is itself shrinkable before wiring it in, or the change does nothing.

## Why now, not just tidiness

Tonight's contention is the forcing case, but the shape recurs: `verify-lane` is the **mandatory** pre-land gate
(#3321) that every lane runs before every PR can open. Its cost scales with concurrent lanes regardless of how
small any one PR's diff is. Six agents running the full suite simultaneously is not a corner case — it is what
this program does every time it dispatches in parallel, which today's session did repeatedly.

## Done when

1. **Executable** — a test asserting `verify-lane`'s default gate invokes the diff-driven selection (or sets
   the selection flag) rather than a bare `npm run test:unit`, and that on a diff falling under a sensitive
   surface with no allow-list entry it still runs the full suite — the fail-safe direction must not regress.
2. `npm run check:standards` — 0 errors.
