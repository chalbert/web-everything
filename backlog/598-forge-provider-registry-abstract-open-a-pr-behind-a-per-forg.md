---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["575"]
dateOpened: "2026-06-14"
tags: []
---

# Forge provider registry — abstract "open a PR" behind a per-forge provider (GitHub first)

Build the forge provider registry ruled by #578: "open a PR" abstracted behind a per-forge provider (GitHub/GitLab/Gitea/Forgejo/Bitbucket), every present provider used, precedence + degradation the only rules — the twin of #576's IDE-bridge registry. Prior art: Renovate Platform, Woodpecker forge.Forge, go-git-providers. v1 ships the GitHub provider first (prioritization, not a fork). Layer: Plateau (the dev-browser acts on the repo). Gated on the resolver (#575) that tells the loop which repo/file:line a fix targets.
