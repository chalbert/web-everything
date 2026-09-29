---
kind: story
size: 1
status: open
scope: ["we:scripts/backlog.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# prepare-stamp works on an actively claimed card without resetting it to open

Live 2026-09-29: workers preparing a card before building it (operator rule: prepare first) found that we:scripts/backlog.mjs prepare-stamp forces status: open, which undoes the active claim on a card mid-build; two workers had to set preparedDate/preparedAgainstSha by hand instead. MVP: prepare-stamp keeps an active status (only stamps preparedDate + preparedAgainstSha) when the card is claimed. Must: test for an active card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
