---
kind: task
parent: "4075"
status: active
scaffoldedBy: "opus-soak-harness"
dateScaffolded: "2026-09-25"
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/SKILL.md"]
dateOpened: "2026-09-25"
tags: []
---

# Rule: every daemon bug fix adds its real-world case to the daemon soak harness

Seven live daemon breaks on 2026-09-25 were all green in unit tests. Make it a standing rule, written into the fix-agent brief (we:skills-src/conveyor/fix-agent-brief.md) and the daemon docs (we:skills-src/conveyor/SKILL.md), that every daemon bug fix must add its real-world case as a scenario to the daemon soak harness (we:scripts/conveyor/soak/).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
