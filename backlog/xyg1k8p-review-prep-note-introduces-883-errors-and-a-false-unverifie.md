---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# review-prep note introduces #883 errors and a false unverified-prerequisite flag

The note we:scripts/operations/review-prep.mjs appends is not routed through the lint the CLI write path enforces, so it injects bare code-path refs into the card it just reviewed — 11 of 12 cards on one lane, 8 of 12 on another, on 2026-08-21. A card clean before review is dirty after it, so a caller validating only beforehand ships broken cards. Separately its own risk-strategy wording verify by mutation or reversion BEFORE building trips the check:standards unverified prerequisite marker and makes the reviewed item read as non-batchable; that false positive is live on main today in we:backlog/1637-review-hardcoded-color-lint-scope-alignment-a11y-contrast.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
