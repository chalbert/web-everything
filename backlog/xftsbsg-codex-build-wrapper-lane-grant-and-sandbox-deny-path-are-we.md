---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/lib/repo-profile.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Codex build wrapper lane-grant and sandbox deny-path are WE-only, not repo-aware for frontierui/plateau-app mechanical builds

PR we:#2753 graduated the Codex mechanical build path but two of its pieces stay hardcoded to the WE repo, verified via a real dry run against #2720 (plateau-app) and #2385 (frontierui) from the astra trial shortlist (we:#2755): (1) we:scripts/operations/dispatch-lane-io.mjs#laneWorkspacePoolDirs is hardcoded to CONSTELLATION_REPOS.we.dirs, so laneDirFor/dispatchLaneGrant only ever probe .lanes/web-everything|webeverything/lane-<N>. Every constellation repo's pool numbers lanes from 1, so a frontierui/plateau-app dispatch's pre-spawn permission grant resolves to WE's own unrelated same-numbered lane instead of the real one (live-confirmed: lane #1 exists in all three pools at once). (2) we:scripts/operations/codex-delivery-provider.mjs#defaultDeliveryDenyPaths defaults repoRoot to its own module's REPO_ROOT (always the WE checkout, since these scripts live only in we:scripts/operations/), and we:scripts/operations/deliver-item-wrapper.mjs calls it with no override, so a Codex build for a frontierui/plateau-app card denies WE's own primary checkout instead of that repo's real primary checkout (repoProfile(key).checkoutPath) — leaving the sandbox free to read that repo's live primary checkout, which routinely holds another session's in-flight uncommitted work. Fix: derive the target repo key from the dispatch payload's own scope (already available at we:scripts/operations/dispatch-lane-io.mjs's resolveLaneGrant(payload) call site) via we:scripts/lib/repo-profile.mjs's existing scope-prefix resolution, use CONSTELLATION_REPOS[repoKey].dirs for the lane probe/grant, and thread that repo's checkoutPath into defaultDeliveryDenyPaths. Fall back to today's WE-only behavior when scope is empty/unrecognized. Not fixed here: we:scripts/lib/repo-profile.mjs's capabilities.build:'couple' for frontierui/plateau-app is pure descriptive data the mechanical dispatch path never reads or enforces — flagged for whoever reviews this, out of scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
