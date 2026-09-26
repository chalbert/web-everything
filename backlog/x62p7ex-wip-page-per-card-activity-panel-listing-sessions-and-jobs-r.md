---
kind: story
size: 3
parent: "3931"
status: open
blockedBy: ["x0uad06"]
scope: ["plateau:src/wip/wip-view.ts", "plateau:src/wip/wip-view.css", "plateau:src/wip/wip-read.ts", "plateau:src/wip/types.ts", "plateau:src/wip/wip-view.test.ts", "plateau:src/wip/wip-read.test.ts"]
dateOpened: "2026-09-25"
tags: []
---

# /wip page: per-card activity panel listing sessions and jobs (review/fix/ci-heal/build) with transcript links

Today a Doing/Needs-you row on plateau:src/wip/wip-view.ts (fed by plateau:src/wip/wip-read.ts, shape plateau:src/wip/types.ts's `WipItem`) shows only that a card is claimed or carries a PR — nothing about which sessions or jobs are actually working it, and since #2674 (merged today) review runs as a detached node job with no `claude agents` row at all, so it is invisible even to a human checking by hand. Add a per-card activity panel: every session/job on that card's PR or card id — review, fix, ci-heal, build — each showing role, state, started/last-event time, outcome, and a transcript link (or the path to copy, if not directly openable from the phone). Data: shell the WE `item-activity` operation (#x0uad06, we:scripts/operations/item-activity.mjs) queried by the card's PR number or card id, the same way plateau:src/wip/wip-read.ts already shells `runner-activity` (mirrored in plateau:src/telemetry/telemetry-read.ts). Polled on the existing snapshot cadence — no relay watch/interest, no live L2/L3 timeline (that fuller build is #3931's own #3933/#3937/#3938/#3939, still designed at plateau:docs/wip-live-agent.md and not duplicated here). Blocked by #x0uad06 (the join + transcript-pointer data this panel renders does not exist yet). Filed under #3931 for the same reason #x0uad06 is: this is the narrower, review-job-aware, non-live slice the operator asked for now, alongside — not instead of — #3931's fuller progressive-disclosure build.

## Done when

1. **Executable** — `npx vitest run src/wip` in plateau-app passes with new cases: a Doing/Needs-you card whose
   PR has a review job and a fixer session both render as separate activity rows (role, state, time, outcome,
   transcript link); a card with no matching activity renders "No agent found" rather than an empty panel; a
   stale/degraded `item-activity` source renders `?`, never asserting nothing is running; a transcript link for
   a path outside the readable roots renders as copyable text, not a dead link.
2. **Live** — open the deployed /wip page (or the dev route) with a real in-flight PR and see, on that PR's
   card, both its review job (`role: review`, from #x0uad06's `item-activity`) and its fixer session (`role:
   fix`), each with state, times, outcome, and a transcript link that opens to a real, non-empty transcript or
   log file — the exact case #x0uad06's own live check proves, now visible on the page instead of only on the
   command line.
