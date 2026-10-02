---
bornAs: xb2o3x0
kind: story
size: 5
parent: "3931"
status: resolved
blockedBy: ["4244"]
scope: ["plateau:src/wip/wip-view.ts", "plateau:src/wip/wip-view.css", "plateau:src/wip/wip-read.ts", "plateau:src/wip/types.ts", "plateau:src/wip/wip-model.ts", "plateau:src/wip/wip-view.test.ts", "plateau:src/wip/wip-read.test.ts", "plateau:src/wip/wip-model.test.ts", "plateau:wip-relay.js", "plateau:scripts/wip-relay.test.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-10-01"
graduatedTo: "https://github.com/chalbert/plateau-app/pull/186"
tags: []
---

# /wip: Running now panel under the machine-health strip — one row per session/job, stuck+dead in red at top

A Running now panel on /wip, below the machine-health strip (card 4214/#4214, PR #184), one row per session or job with: work item, kind, start+runtime, last activity, derived state, transcript path or link. Stuck and dead rows render in red at the top. Fed through the existing /wip pipeline exactly as #4214 did (plateau:src/wip/wip-read.ts -> plateau:src/wip/wip-model.ts passthrough -> plateau:src/wip/wip-view.ts render -> plateau:wip-relay.js publish validation). Data source: WE card 4244's live-state/live-work RUNNING section, read the same way plateau:src/wip/wip-read.ts already shells runner-activity.

## Done when

1. **Executable** — `npx vitest run plateau:src/wip/wip-view.test.ts plateau:src/wip/wip-read.test.ts` passes
   with new cases: a Running-now snapshot with a working row, an idle>10min row, and a dead row renders stuck
   and dead rows first and in a distinct (red) style; a missing/degraded RUNNING source renders "No agent
   found" rather than an empty panel; a transcript path outside the readable roots renders as copyable text,
   not a dead link.
2. **Live** — the rendered page (component test DOM dump, or the operator's dev server on port 4000 if
   already running) shows the panel populated from a real live-work snapshot taken on this machine, with at
   least one real row (a review job, a fixer, or the operator's own interactive chat).

## Operator ruling (2026-10-01)

Delivered by plateau-app PR #186 (5933cef). A later review commit (e35d6e1) shows "Couldn’t read what’s running" when the source cannot be read, instead of the card’s "No agent found". Operator, via claude-code-chat: "Sure keep it" — the shipped wording stands, so a failed read never looks like an empty fleet.
