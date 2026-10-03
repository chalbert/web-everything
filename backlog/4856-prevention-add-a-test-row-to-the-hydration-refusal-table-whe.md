---
bornAs: xmu3m23
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a test row to the hydration refusal table where the original rollup holds a failing required check… (from chalbert/web-everything#3432 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-pass.mjs:1017` — Add a test row to the hydration refusal table where the original rollup holds a failing required check and the read throws. Then either keep the original rollup on a read error or assert `unchecked` explicitly.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3432@62f132b42c56d00231f38a71b8376b670f73417a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
