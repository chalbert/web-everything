---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add an explicit test-plan bullet, plus a conformance vector in the WE contract, that fixture log lines… (from chalbert/web-everything#3314 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md:62` — Add an explicit test-plan bullet, plus a conformance vector in the WE contract, that fixture log lines containing absolute paths, home directories and transcript snippets are redacted or rejected before publish. Better still, a check:standards rule that every 'never X' sentence in a prepared card has a matching test-plan line.
2. `we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md:8` — A strict backlog validation rule that cross-references inline mentions of predecessor cards against the frontmatter `blockedBy` array.
3. `we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md` — A review standard requiring every 'never' or exclusion constraint in the design section to have a matching explicit negative assertion in the test plan.
4. `we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md` — A validation step that ensures all explicitly excluded data sources in the design have corresponding negative tests.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3314@f5f54014c36f71d4d0afe5d1f7b08a3ff1f440fb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
