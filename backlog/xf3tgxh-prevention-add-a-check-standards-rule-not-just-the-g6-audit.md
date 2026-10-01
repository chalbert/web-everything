---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4673-model-routing-strategy.md", "we:backlog/xwq6ubw-routing-pilot-stage-0-join-every-model-call-to-its-card-step.md", "we:backlog/xdys17o-routing-pilot-one-capped-hosted-open-weight-trial.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a check:standards rule (not just the G6 audit candidate pool) that fails when a changed backlog car… (from chalbert/web-everything#3229 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4673-model-routing-strategy.md:4` — Add a check:standards rule (not just the G6 audit candidate pool) that fails when a changed backlog card has kind: decision, status: resolved and no codifiedIn.
2. `we:backlog/xwq6ubw-routing-pilot-stage-0-join-every-model-call-to-its-card-step.md:14` — Make the A1 audit hard-fail (or refuse queueing) on an open card whose Done-when still contains the literal 'TODO: a command that fails'.
3. `we:backlog/xdys17o-routing-pilot-one-capped-hosted-open-weight-trial.md:19` — A lint rule in `check:standards` that rejects placeholder text (e.g. "TODO: a command that fails") or known boilerplate hints if left unmodified in new story submissions.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3229@8fc41e30e1645e2e012804afba147899419b6c15

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
