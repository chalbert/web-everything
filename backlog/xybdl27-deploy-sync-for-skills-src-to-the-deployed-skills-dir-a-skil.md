---
kind: task
status: open
dateOpened: "2026-07-20"
tags: []
---

# Deploy sync for skills-src to the deployed skills dir (a skill fix isn't live until the copy syncs)

An edit to any skill under we:skills-src/ (e.g. this session's we:skills-src/closing-session/session-cost.mjs rate fix) lands in the repo and on main but does NOT take effect until the deployed copy under the user's ~/.claude/skills/ tree is synced — the two are plain copies, not symlinks, and no scripted sync exists. This caused the fixed cost estimator to keep reporting the old 3x-inflated numbers after the PR merged (caught and hand-synced at close). Add a deterministic we:skills-src/ to ~/.claude/skills deploy (an npm script or hook), or at minimum a drift check that warns when a deployed skill differs from its we:skills-src/ source, so a merged skill fix is actually live.
