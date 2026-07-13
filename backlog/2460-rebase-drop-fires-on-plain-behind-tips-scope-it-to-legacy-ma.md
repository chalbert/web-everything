---
bornAs: xk3v7dq
kind: story
size: 3
status: open
dateOpened: "2026-07-12"
tags: []
---

# rebase-drop fires on plain BEHIND tips — scope it to legacy manifest conflicts, stop fabricating commits

The #2198 rebase-drop in we:scripts/merge-ai-prs.mjs rebuilds ANY certified BEHIND/CONFLICTING tip, but its reason to exist — the shared tree-committed we:.lane-manifest.json conflicting every lane — was removed by #2411 (manifest rides the PR body now). Today a plain-BEHIND tip needs no rebuild at all: GitHub's merge-commit strategy lands a BEHIND-but-CLEAN PR directly (proven live: PR #444 landed via `--no-rebase-drop` after ~10 rebuilds had churned it). Each rebuild fabricates a permanent two-parent commit ("drain: rebase … drop transient lane manifest"), resets the tip's checks (the #2391-adjacent livelock), and absorbs main's history into the branch ancestry — PR #444's commit tab showed 37 commits of which ~5 were authored content. Fix shape: (a) fire rebase-drop ONLY when the tip actually carries a tree-committed we:.lane-manifest.json conflict (the legacy pre-#2411 case); a plain BEHIND-but-mergeable tip goes straight to `gh pr merge`; (b) make the fabricated commit's message honest — name the manifest only when one was dropped; (c) never re-rebuild a tip whose prior rebuilt commit still has pending checks. Gate-self surface (edits the lander) — expect the human-clearance park. Interim default until the drain-strategy config item (2461) makes the strategy configurable.
