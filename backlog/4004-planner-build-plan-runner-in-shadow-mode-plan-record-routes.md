---
bornAs: xacbhmg
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3996", "4003"]
dateOpened: "2026-09-23"
tags: []
---

# Planner build: plan runner in shadow mode (plan, record routes, then the single worker)

Child 3 of #3922. The plan runner wired into deliverItem behind planBuild (off, shadow, on; default shadow). In shadow the planner writes a plan and each step route is recorded, then the single worker builds as today. Single-file cards get a code-built one-step plan with no model call. deliveryAgent marker skips planning. Settings live in we:scripts/lib/plan-policy.json.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
