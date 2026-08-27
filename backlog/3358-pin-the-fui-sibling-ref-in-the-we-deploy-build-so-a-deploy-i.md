---
bornAs: xd6hbxe
kind: decision
status: open
scope: ["we:.github/workflows/deploy.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Pin the FUI sibling ref in the WE deploy build so a deploy is reproducible

The deploy checks out `chalbert/frontierui` with no `ref:`, so it builds against FUI default-branch HEAD. A FUI change can therefore alter what a WE deploy ships with no WE commit, and re-running an old deploy does not reproduce it. Which FUI ref is canonical for a WE deploy — default branch, a released tag, or a WE-pinned sha — has to be settled before anything is wired.

## Why this is typed `decision`, not `story`

Filed first as `kind: story`, which made the readiness loader compute it as `batchable` while the body said it
needed a decision first — the loader sees only tier, size and `blockedBy`, so it over-reported
agent-readiness. The wiring is trivial once the ref is chosen; the whole item is the choice. Typed to match.

## The fork

- **default branch** — status quo, zero work, but keeps the deploy non-reproducible.
- **a released FUI tag** — reproducible and intentional, but needs an FUI release cadence WE can rely on.
- **a WE-pinned sha** — maximally reproducible and WE-controlled, at the cost of a bump step (probably
  automated) whenever WE wants a newer FUI.

Deliberately left out of the #3360 deploy-gate change rather than settled silently there.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
