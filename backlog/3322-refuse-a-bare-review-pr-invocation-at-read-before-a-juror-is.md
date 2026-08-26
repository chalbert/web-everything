---
bornAs: xwk0tzu
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/operations/review-pr-io.mjs
tags: []
---

# Refuse a bare review-pr invocation at read, before a juror is paid

review-pr refuses a self-clear at record — after the juror has run and been billed. The independence of the clearing actor is knowable at read, from the PR author stamp and the current session id, so the refusal can come first. Same shape as #3228, which moved the inert-PR refusal to read for the same reason. Two rounds on PR 1569 cost roughly two dollars before the terminal refusal was reachable.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
