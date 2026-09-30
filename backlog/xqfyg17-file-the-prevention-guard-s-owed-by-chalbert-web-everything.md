---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xp1wbuo-automatically-postmortem-every-builder-outcome-using-the-can.md", "we:reports/data/2026-09-30-builder-postmortem.json"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3089's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xp1wbuo-automatically-postmortem-every-builder-outcome-using-the-can.md:8` — Add a check:standards rule that any `open` story card has a `# title` and either a Done-when section or a `relatedReport` that the prepare readiness check verifiably resolves. Alternatively give the card a short body with a title and Done-when pointing to the report's proof plan.
2. `we:reports/data/2026-09-30-builder-postmortem.json:1` — Add a check:standards rule, or a pre-commit secret and absolute-home-path scan, over `reports/data/*.json`. Generate these snapshots through the same scrub function the scorecard store uses.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3089@d703d5fd68f99f5fdb23eb7ea61b3e8e4e9dfad3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
