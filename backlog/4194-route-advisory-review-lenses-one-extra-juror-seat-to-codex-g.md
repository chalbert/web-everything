---
bornAs: xmk6p7w
kind: story
size: 3
parent: "4075"
status: active
blockedBy: ["3949"]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/review-job.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
tags: []
---

# Route ADVISORY review lenses + one extra juror seat to Codex/Gemini, beside Claude's mandatory seats

Route the ADVISORY review lenses plus one extra juror seat to Codex/Gemini via the existing we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs, ADDED BESIDE Claude's mandatory jury seats (never replacing them), using we:scripts/lib/provider-routing.mjs#selectProvider (already on main). Every finding a routed seat surfaces writes an evidence row (depends on #3949, which fixes evidence logging). Safe because these seats only find problems; a miss is still covered by Claude's mandatory seats. Overlaps we:scripts/operations/review-dispatch.mjs#reviewSeatRoutes as ported by #3908 (a much larger, separately-blocked faithful-port slice, blockedBy 3903/3904/3905/3906/3907/3915/4178/4180) — this card is the narrower, independently-landable slice: route the ADVISORY lenses + extra juror seat now, ahead of #3908's port finishing.

## Done when

1. **Executable** — a test over `we:scripts/operations/review-dispatch.mjs#reviewSeatRoutes` (or its call site) shows an ADVISORY lens and the extra juror seat routed to `we:scripts/codex-direct-task.mjs` / `we:scripts/gemini-direct-task.mjs` while every MANDATORY lens still runs on Claude — fails before this lands (no such routing exists today outside the blocked #3908 port) and passes after.
2. **Live proof** — dispatch one real review through the new routing on a real PR; before/after: the PR's evidence record (`we:scripts/conveyor/run-scorecards.json` or its successor) shows a new row for the routed seat's finding (or clean pass), attributed to `codex`/`gemini`, alongside Claude's own mandatory-seat row for the same PR.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
