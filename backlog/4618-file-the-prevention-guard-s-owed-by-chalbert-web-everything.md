---
bornAs: xau545d
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3122's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/lease-reaper.mjs:520` — Add one real-git fixture where main advances by an unrelated commit after the lane forks, then the squash lands on the advanced tip, expecting `true`. As a general guard, review lens: for any code choosing between two 'equivalent' revisions, require a fixture where they differ.
2. `we:scripts/conveyor/lease-reaper.mjs:525` — Add a deterministic regression test requiring rejection of a multi-commit squash with different Python indentation, and require whitespace-sensitive verification before the aggregate tier returns true.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3122@0d90cc32198e66236ca1d4235754ba45497d7c63

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
