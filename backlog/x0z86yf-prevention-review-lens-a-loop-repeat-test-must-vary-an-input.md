---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/daemon-self-sync.test.mjs", "we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Review lens: a loop-repeat test must vary an input per iteration, or it should be a single test. A lint… (from chalbert/web-everything#3254 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/daemon-self-sync.test.mjs:441` — Review lens: a loop-repeat test must vary an input per iteration, or it should be a single test. A lint gate is hard to write for this.
2. `we:scripts/lib/daemon-self-sync.mjs:590` — Review lens: flag parameters passed at a call site where the outcome is provably fixed. There is no cheap deterministic gate for this.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3254@b3da4f6c5d909cb537de256893ae6494cdf877b7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
