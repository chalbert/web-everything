---
kind: story
size: 3
status: open
blockedBy: ["4465"]
scope: ["we:scripts/conveyor/build-dispatch-hold-router.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Observe a hold-route landing's own terminal outcome instead of a fire-and-forget detached spawn

#4465's routeHeldItems spawns the landing pass (we:scripts/operations/build-dispatch-hold-route-land.mjs) as a detached, fire-and-forget process with no feedback channel back to the build-dispatch daemon's tick — unlike the build dispatch path, which has a run-store + we:scripts/operations/deliver-item-settle.mjs to observe and act on a dispatch's real outcome. A landing that starts but later fails (a bad citation, a verify failure, an open-pr error) is therefore never retried inside its lease's lifetime; the item just rides out the lease TTL and then the hold's own TTL before falling back to ordinary build dispatch. Give hold-route landings the same run-store/settle observability the build path already has, and retry or surface a failed landing promptly instead of waiting out the TTL.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
