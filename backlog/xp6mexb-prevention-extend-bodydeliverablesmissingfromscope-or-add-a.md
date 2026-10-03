---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xwx7fbq-prevention-derive-selfnum-from-the-loaded-item-s-num-backlog.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Extend bodyDeliverablesMissingFromScope (or add a sibling rule) to scan the ## Design section's we: fil… (from chalbert/web-everything#3723 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xwx7fbq-prevention-derive-selfnum-from-the-loaded-item-s-num-backlog.md:23` — Extend `bodyDeliverablesMissingFromScope` (or add a sibling rule) to scan the `## Design` section's `we:` file tokens against `scope:`, so a prepared card cannot name a file outside its scope.
2. `we:backlog/xwx7fbq-prevention-derive-selfnum-from-the-loaded-item-s-num-backlog.md:46` — Add a `check:standards` rule or lint that bans `/^(\d+)-/.exec(` filename parsing in `we:scripts/check-standards.mjs`. This is already listed as a Follow-up, so promote it to a gate or a committed fixture-based test of the loop.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3723@5b4e3f41bce094fc51fa9c66350c5fed409e681c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
