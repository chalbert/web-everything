---
kind: story
size: 8
status: resolved
dateOpened: "2026-07-02"
tags: [lane, pr-flow, review, merge-queue, integrator, session-tooling]
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
relatedTo: ["2153", "2138", "2123", "2162", "2170"]
---

# Drain review-escalation rubric + non-blocking watch window: park escalated lanes alive until review accepts

Second layer of the lane review design (session 2026-07-02). The drain (#2162) decides **deterministically** (script-decidable rubric, no judgment in the merge session) whether a ready PR gets a full independent review before merging:

- **Rubric signals**: blast radius (diff touches `scripts/`, `.claude/skills/`, hooks, CI config, statute docs, standards definitions), size/diff-line threshold, **dismissed findings recorded by the lane's pre-PR review (#2170)** — the strongest signal, it targets author anchoring directly — cross-repo impl+WE couple, and a **1-in-N sampling floor** (keeps lane self-review honest; without it "no dismissals" is a gameable exit). Thresholds are tuning knobs: start loose, tighten from data.
- **No escalation → merge immediately** (today's pr-land path), stamp `escalated: no` + the rule outcome.
- **Escalation → watch window, not a block**: the lane **parks alive** (clone + poll loop; the orchestrator wakes it on events) while an independent review session works the PR. Reviewer verdict is a **deterministic PR label** (`review:accepted` / `review:changes`), not comment parsing. `review:changes` → the live author lane fixes hot-context and re-pushes; `review:accepted` → merge and close the lane. This splits the roles cleanly: independent *disposition* (reviewer accepts), hot-context *fixing* (author lane).
- **Timeout with a merge-anyway default**: on window expiry, merge and auto-file the unfinished review as a post-merge follow-up item — the drain never hangs on a stalled/dead reviewer.
- **Couples inherit the strictest member**: if one PR of an impl+WE couple escalates, both wait — impl-first/WE-last order (#2138 Fork 5) cannot tolerate half a couple merging.
- **Bonus**: a parked-but-alive lane rebases its own `lane/*` ref when `main` advances mid-watch, curing the `BEHIND` race pr-land hit live (#2153 PR #10) — the rebase follow-on #2162 already owns.

Likely needs slicing at claim time (rubric scorer · park/watch loop · label convention + reviewer session contract · timeout/auto-file). To settle when specing: window length; whether timeout-merges auto-file the follow-up (default: yes).
