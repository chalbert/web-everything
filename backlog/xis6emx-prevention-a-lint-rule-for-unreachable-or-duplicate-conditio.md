---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/wip/wip-view.ts", "we:src/wip/__tests__/wip-view.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — A lint rule for unreachable or duplicate conditions (e.g. no-dupe-else-if or no-constant-condition with typ… (from chalbert/plateau-app#194 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/wip/wip-view.ts:672` — A lint rule for unreachable or duplicate conditions (e.g. `no-dupe-else-if` or `no-constant-condition` with type narrowing), or a formatter check that fails on mis-indented blocks.
2. `we:src/wip/wip-view.ts:671` — Add a deterministic type-aware lint gate rejecting impossible comparisons against narrowed literal unions.
3. `we:src/wip/wip-view.ts:674` — Require a TypeScript no-emit check covering we:src/wip/wip-view.ts before accepting changes; the supplied diff does not establish whether this gate exists.
4. `we:src/wip/wip-view.ts:669` — A linter rule (e.g. ESLint's no-dupe-else-if or a dead-code detector) checking for unreachable conditional branches.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#194@3127e1d6aa016cb33dbdae864118ea48af08489c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
