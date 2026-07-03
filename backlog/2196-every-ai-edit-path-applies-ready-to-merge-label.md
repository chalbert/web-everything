---
kind: story
size: 3
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# Every AI-edit path applies the ready-to-merge label — not just /workflow

Make the `ready-to-merge` label the universal "a producer certified this couple" signal by having **every**
AI-edit path that opens a PR apply it — not only the parallel `/workflow` producer:

- `we:.claude/skills/pr/SKILL.md` (`/pr`, incl. orphan PRs opened directly),
- solo `#2123` lane sessions at lane-push / closeout,
- `we:.claude/skills/batch-backlog-items` closeout when it opens PRs,
- the parallel `/workflow` producer (already does — keep).

Wire it through the shared transport (`we:scripts/pr-land.mjs` / the PR-create call-site) so the label is a
single deliberate step, never applied by hand casually. This is the contract #2195's relaxed gate depends on:
`ready-to-merge` present ⟺ a producer step certified the couple. Once this holds, the label lander (`/drain`)
is the single collection point for ALL AI-generated work, whatever session shape produced it. *Ready now.*
