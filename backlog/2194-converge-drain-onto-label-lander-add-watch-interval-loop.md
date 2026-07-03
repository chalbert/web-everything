---
kind: story
size: 3
parent: "2193"
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# Converge /drain onto the label lander + add --watch/--interval (drain core)

Retire the `we:queued.json` poll from the `/drain` trigger and route `/drain` to the ONE label lander
`we:scripts/merge-ai-prs.mjs --label=ready-to-merge` (the #2188 substrate). That lander is **one-shot** today —
add the missing long-lived monitor: `--watch` with `--interval=N` (default 30s) and `--max-idle=N`, re-sweeping
`ready-to-merge` PRs and landing each as it becomes eligible (green + mergeable), in cross-item `blockedBy`
order (each PR's `we:.lane-manifest.json` off its head ref supplies the edges — the existing convergence).

`/drain` (bare) = one cascade pass; `/drain watch` = the poll loop. Update `we:.claude/skills/drain/SKILL.md`
so the ceremony (dry-run first, exit codes) targets the label lander, not `we:scripts/lane-drain.mjs`. The
legacy `we:queued.json` / `we:scripts/lane-drain.mjs` path stays as a no-op fallback for legacy couples but is
no longer the primary mechanism. *Ready now — core of #2193.*
