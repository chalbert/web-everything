---
bornAs: xq2yos6
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4801-prevention-add-a-check-standards-rule-or-backlog-health-audi.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a preparation-time requirement that a card introducing a new check:standards rule records the measu… (from chalbert/web-everything#3765 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4801-prevention-add-a-check-standards-rule-or-backlog-health-audi.md:58` — Add a preparation-time requirement that a card introducing a new check:standards rule records the measured violation count on the existing corpus. The card must also state a grandfathering or migration policy. A cheap deterministic gate: the card-lint rule would flag a card that names a new standards rule in Design but has no 'baseline/grandfather' line.
2. `we:backlog/4801-prevention-add-a-check-standards-rule-or-backlog-health-audi.md:57` — Extend the card-lint rule so a backtick command inside an Executable line is rejected if it contains a `we:` or other repo-prefix token.
3. `we:backlog/4801-prevention-add-a-check-standards-rule-or-backlog-health-audi.md` — Add a card-lint rule or review-lens check that every 'never' or 'cannot' guarantee in a Design section is matched by a named test line in the Test plan. For this card, add a no-execution sentinel fixture to the Test plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3765@1b9482a87e27b537a22ebabfeaa8fa1e06726bbd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
