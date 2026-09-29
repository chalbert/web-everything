---
bornAs: xw7fsys
kind: story
size: 1
status: open
scope: ["we:scripts/operations/probation-launcher.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# probation-launcher frontmatterBlock: accept CRLF line endings

Advisory follow-up from PR #2867 (WE #4291): we:scripts/operations/probation-launcher.mjs:101 frontmatterBlock regex matches LF only, so a CRLF card fails open. MVP: accept \r?\n. Must: test with a CRLF fixture.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
