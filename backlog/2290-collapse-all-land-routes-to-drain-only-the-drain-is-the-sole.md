---
kind: story
size: 8
parent: "2289"
status: open
dateOpened: "2026-07-05"
tags: []
---

# Collapse all land routes to drain-only: the drain is the sole writer to main

Make the drain the ONLY path that runs gh pr merge. /pr (pr-land self-land) and /merge (the merge-ai-prs sweep) stop merging directly and instead enqueue the couple and trigger a drain pass; /finish hands its recovered lane to the queue too. Add a shared gate that denies gh pr merge from any path but the drain, plus one documented admin break-glass for emergency unbreak-main (logged, off the normal path). Make the drain cheaply triggerable for a single couple so /pr still feels instant. This is the prerequisite for JIT numbering: a single serialized writer is the only place that can safely assign the NNN. Context: today four-plus routes each call gh pr merge, which is why the self-heal is leaky.

> **Coordination constraint (2026-07-05, per concurrent drain session).** This item heavily edits `we:scripts/merge-ai-prs.mjs` / `we:scripts/lane-drain.mjs` / `we:scripts/pr-land.mjs`, which are **hot** right now — recent lands #154 (review gate + drain auto-review), #156 (all-repos drain default), #149 (park-state) all touched `we:scripts/merge-ai-prs.mjs`, and #151/#146 are open PRs on it. **Any edit to `we:scripts/merge-ai-prs.mjs` or `we:scripts/review-escalation.mjs` is classified `review:human` (gate-self)** — a human must `--add-label review:accepted` before the drain lands it. Whoever implements #2290 must rebase onto latest main and expect conflicts on that file.
