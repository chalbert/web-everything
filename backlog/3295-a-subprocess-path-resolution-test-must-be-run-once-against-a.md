---
bornAs: xvzxw4u
kind: task
status: open
dateOpened: "2026-08-25"
tags: []
---

# A subprocess PATH-resolution test must be run once against a PATH stripped of ambient dev tools

A test that shells out to resolve a binary passes or fails by what the DEVELOPER'S box has installed, and CI
has almost none of it. On PR #1561 a guard in `we:scripts/operations/__tests__/helpers/fake-claude.mjs` ran
`command -v claude`, which exits non-zero when nothing is found — so it threw `Command failed` instead of its
own message: green on a laptop with the CLI, red on CI. The rule: run such a test once under a `PATH` built
from the toolchain MINUS the ambient tool. Wanted as a standing check — two review rounds missed it by
reading.

## Done when

1. **Executable** — a check that reddens on a test which resolves a binary via a subprocess and has never been
   exercised against a stripped `PATH`, and passes once it has. Provisional shape: extend
   `we:scripts/check-standards.mjs` to flag a `__tests__` file that spawns `command -v` / `which` / `type`
   without a sibling case asserting the not-found arm, on the evidence that the not-found arm is the one that
   diverges between laptop and CI. Verify by pointing it at
   `we:scripts/operations/__tests__/helpers/fake-claude.mjs` at commit `6e8fb3df` (must flag) and at `dad2fe4d`
   (must not) — the commit that wrapped the resolution in a `try` and normalised not-found to `''`.

**A correction to the fixture.** This item first named commit `95572d0c` as the "must flag" side. That is the
pre-rebase sha the round-3 review ran on; it is not reachable from `lane/test-harness-fake-claude` and a fresh
clone cannot resolve it, so the fixture as written was not reproducible. `6e8fb3df` is the rebased commit whose
`we:scripts/operations/__tests__/helpers/fake-claude.mjs` blob hashes identically to `95572d0c`'s (checked with
`git show … | shasum` on both).

Owed as prevention by the round-3 correctness review of #1561. The same round's other, structural half is
filed alongside this one as "A PR body's gate line must be the CI result, not a local run".
