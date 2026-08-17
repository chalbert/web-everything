---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# plateau-app and frontierui also need bgIsolation:none, hit the same EnterWorktree stall

we:.claude/settings.json's bgIsolation:none fix (#1448) only covers this repo. The independent reviewer of #1448 found live EnterWorktree tool_use_error hits against a plateau-app lane clone's build-config target in the same session's job transcripts tonight -- meaning plateau-app's own background-dispatched sessions hit the identical stall. Neither the plateau-app primary checkout nor its lane clones currently have a settings file for Claude at all (only a lane-ports record and a skills directory exist under its dotfile config path), so there is no existing repo-level settings to extend -- one would need to be created there, scoped narrowly to just the worktree opt-out (mirroring this repo's addition) unless plateau-app's own isolation/lane-clone conventions differ enough that a blanket opt-out isn't the right call for that repo. frontierui was not confirmed hit live but should be checked for the same gap given the same Repo Constellation (WE -> Frontier UI -> plateau-app) likely shares the lane-clone convention. Deliberately not fixed directly in this filing -- editing a sibling repo's settings needs that repo's own context/conventions confirmed first, not assumed from web-everything's.

## Done when

1. **Executable** — a settings file for Claude exists at the plateau-app repo root (and/or frontierui, once its own convention is confirmed) carrying the same worktree opt-out this repo's we:.claude/settings.json now has; a lane clone of that repo can complete an Edit/Write on its first background-session action without the EnterWorktree tool_use_error, where today it fails.
2. Confirmed (not assumed) whether plateau-app and frontierui use the same exclusive lane-clone leasing convention this repo does before applying a blanket opt-out — if either repo's isolation model differs, the fix is scoped to match that repo's actual guarantees, not copy-pasted from we:.claude/settings.json.
3. frontierui checked directly (this filing only confirmed plateau-app hit the stall live; frontierui's dotfile config path is empty, so it has no settings file blocking anything today, but also none preventing the same failure once it dispatches background work).
