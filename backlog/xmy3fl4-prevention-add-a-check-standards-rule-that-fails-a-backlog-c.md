---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xan09na-keep-the-review-across-a-ci-heal-that-leaves-the-pr-own-chan.md", "we:backlog/x6n7c2p-review-a-pr-only-once-its-required-checks-are-green-fix-the.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a check:standards rule that fails a backlog card whose 'Done when' still contains the 'TODO: a comm… (from chalbert/web-everything#3443 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xan09na-keep-the-review-across-a-ci-heal-that-leaves-the-pr-own-chan.md:14` — Add a check:standards rule that fails a backlog card whose 'Done when' still contains the 'TODO: a command that fails' placeholder at status open→in-progress. Also require a fail-closed line on cards that loosen a refusal.
2. `we:backlog/x6n7c2p-review-a-pr-only-once-its-required-checks-are-green-fix-the.md:14` — Standards check on gate-type cards: require an explicit 'on error/unknown, refuse' Must line. Same gate as above.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3443@13db05aa1cbb73df10aa09641b2c30952b064cbc

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
