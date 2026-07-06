---
kind: story
size: 3
parent: "2241"
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-05"
dateResolved: "2026-07-05"
tags: []
---

# Rebase-drop a remote-repo conflicting PR — provision sibling clones for the central --all-repos drain

Follow-up to #2257. The central --all-repos lander (we:scripts/merge-ai-prs.mjs) rebase-drops a CONFLICTING/BEHIND lane tip only for the LOCAL clone's repo — the merge-tree/commit-tree/push plumbing needs a working clone of the PR's repo. A remote-repo PR (frontierui/plateau-app) that is CONFLICTING/BEHIND is currently left for its author (observed: frontierui #10/#11). Provision sibling clones (../frontierui, ../plateau-app) in the drain-clone setup and route rebase-drop through the matching clone per candidate's repo, so the one drain can rebuild non-local lane tips too. Blocked-by nothing (the lander exists); gated in practice by those repos' CI (#2242/#2243) since a rebuilt tip must re-run their test check.
