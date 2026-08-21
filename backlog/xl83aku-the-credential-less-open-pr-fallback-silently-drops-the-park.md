---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# The credential-less open-pr fallback silently drops the park label

we:skills-src/pr/SKILL.md sanctions one fallback when a host has no gh credential: submit the operation planned argv through a channel that does. The argv carries --park=review:pending, but a connector create-PR call has no label parameter — so following the instruction exactly still opens the PR UNHELD, and the #2820 merge predicate reads a missing review label as nothing to wait for. Observed 2026-08-21: three PRs opened that way came out labelled checking only. The skill now documents a mandatory second call, but a two-step instruction an agent must remember is the weak form; the operation should own the whole submission so the park label cannot be separated from the open.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
