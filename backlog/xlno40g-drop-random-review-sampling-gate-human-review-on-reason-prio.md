---
kind: story
size: 3
parent: "2606"
status: open
scope: ["we:scripts/pr-land.mjs", "we:scripts/lib/"]
dateOpened: "2026-07-23"
tags: []
---

# Drop random review-sampling; gate human review on reason + prior AI convergence

`we:scripts/pr-land.mjs`'s random ~1-in-10 `review:pending` sampling parks clean, CI-green PRs with no reason and (for scope PRs) no prior AI review — it parked #690, #694, #695 this session with zero value (operator: random sampling has no value).

Change: a PR reaches a human ONLY for a real reason — blast-radius, statute, or an AI-review finding the agent could not self-resolve — and in every such case an AI-reviewer convergence pass has already run. Drop the random sampler entirely; gate human review on reason plus prior AI convergence.

NOTE: this edits the #2307 producer rubric (the blast-radius / gate-self area) — it is rubric-touching, so building it will legitimately escalate `review:human` when it lands.
