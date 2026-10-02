---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/3810-protect-deploy-secrets-with-a-github-environment-and-sha-pin.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a proof-plan step that records the main branch ruleset or protection via gh api repos/repo/rulesets… (from chalbert/web-everything#3525 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3810-protect-deploy-secrets-with-a-github-environment-and-sha-pin.md:38` — Add a proof-plan step that records the `main` branch ruleset or protection via `gh api repos/<repo>/rulesets` and `branches/main/protection` for both repos. Also record the environment's admin-bypass and required-reviewer settings. Longer term, add a card-template checklist item, 'who can reach the trusted ref?', for any card that gates secrets on a ref.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3525@db22c9d7f5103910f660fdb53230af7c62447d42

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
