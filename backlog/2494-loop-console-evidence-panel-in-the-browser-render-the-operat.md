---
bornAs: xomhf8a
kind: story
size: 2
parent: "2489"
status: resolved
dateOpened: "2026-07-14"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability, evidence]
---

# Loop console — evidence panel in the browser (render the operating-evidence view on-demand)

Follow-up to the operating-evidence view (2495, which shipped the pure `summarizeEvidence` reducer + the
`evidence` CLI). Render that same evidence in the drain-daemon console: an ON-DEMAND panel (a button, like the
merge-queue board — it is a heavier full-journal read, not part of the 5s poll) showing the throughput
sparkline over time, the merge / park / fail / noop / idle rates, pass-duration, restarts, and the
human-pull-in count. Needs a new `/__dev-panel/drain-daemon/evidence` bridge endpoint
(`plateau:tools/dev-panel/vite-plugin.ts` → shells `plateau:tools/drain-daemon/cli.mjs` `evidence --json`)
plus the panel + render in `plateau:tools/dev-panel/drain-daemon.html`. Makes the #2456 evidence visible
without the terminal. Impl in plateau-app; WE holds zero impl (this card is the tracker).
