---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4378-plateau-credential-inventory-and-rotation-tracker.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a check:standards or prepare-stamp gate: any card stamped with preparedAgainstSha must contain a ##… (from chalbert/web-everything#3261 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4378-plateau-credential-inventory-and-rotation-tracker.md:135` — Add a check:standards or prepare-stamp gate: any card stamped with preparedAgainstSha must contain a `## Done when` heading with at least one numbered clause. A cheaper first step is to have the probation launcher fail fast when the section is missing.
2. `we:backlog/4378-plateau-credential-inventory-and-rotation-tracker.md:53` — Cite symbols (`ghDue` in we:health-watch.mjs) rather than line numbers, or have prep-staleness check file:line citations against preparedAgainstSha.
3. `we:backlog/4378-plateau-credential-inventory-and-rotation-tracker.md:126` — Add a rule to the health-smell and collector test conventions that every free-text field emitted from external API data passes a shared sanitize-and-truncate helper. A unit test should assert that control characters are stripped.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3261@266ed3c23aa679d9811897a534eef420866b50bb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
