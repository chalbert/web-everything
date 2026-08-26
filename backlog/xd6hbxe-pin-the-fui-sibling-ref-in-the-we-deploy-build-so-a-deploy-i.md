---
kind: story
size: 3
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Pin the FUI sibling ref in the WE deploy build so a deploy is reproducible

The deploy checks out `chalbert/frontierui` with no `ref:`, so it builds against FUI default-branch HEAD. A FUI change can therefore alter what a WE deploy ships with no WE commit, and re-running an old deploy does not reproduce it. Needs a decision on WHICH FUI ref is canonical for a WE deploy (default branch, a released tag, or a WE-pinned sha) before wiring — deliberately left out of the deploy-gate change rather than settled silently.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
