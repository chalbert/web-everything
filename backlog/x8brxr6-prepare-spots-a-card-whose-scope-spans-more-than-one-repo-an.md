---
kind: story
size: 3
status: open
scope: ["we:scripts/backlog/scaffold.mjs", "we:scripts/readiness/", "we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prepare spots a card whose scope spans more than one repo and proposes the split

Ruling on #4289 (2026-09-30): an unsupported mixed-repo scope must be caught at prepare/scaffold time, not by the build wrapper after launch (#4620 was refused by we:scripts/operations/deliver-item-wrapper.mjs after dispatch). Count normalized repo identities with the same resolver the wrapper uses, show the offending scope entries, and propose a predecessor/successor split with the dependency edge, applying the split-safety test (we:docs/agent/backlog-workflow.md, split-safety rubric): independently valuable pieces, no cycles, valid intermediate state. If the split test fails, keep the card whole with a named coupled-delivery next action. Never manufacture empty stories.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
