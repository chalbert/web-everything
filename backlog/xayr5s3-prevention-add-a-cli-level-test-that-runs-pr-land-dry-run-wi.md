---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/pr-land.mjs", "we:scripts/__tests__/pr-land.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a CLI-level test that runs pr-land --dry-run with a WE #N: title and checks that it exits cleanly w… (from chalbert/web-everything#3228 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/pr-land.mjs:770` — Add a CLI-level test that runs `pr-land --dry-run` with a `WE #N:` title and checks that it exits cleanly with a resolved title. An ESLint `no-undef` check over `scripts/*.mjs` would also catch undefined identifiers deterministically.
2. `we:scripts/pr-land.mjs:770` — Add a deterministic CLI regression test using a matching WE #N: title and a stubbed PR creation command, asserting successful creation and the expected title; verify that restoring git makes it fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3228@e1b0c3d66584c82afa0d00960c61618305dfcc82

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
