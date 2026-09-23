---
kind: story
size: 3
parent: "xjtmptc"
status: open
blockedBy: ["xlt8y1j"]
scope: ["plateau:wip-relay.js", "plateau:src/wip/wip-agent.ts", "plateau:scripts/wip-publish.ts", "plateau:src/telemetry/telemetry-source.ts", "plateau:src/telemetry/telemetry-source.test.ts", "plateau:src/wip/wip-relay-contract.test.ts", "plateau:docs/telemetry-page.md"]
dateOpened: "2026-09-22"
tags: []
---

# plateau /telemetry live data: a telemetry ask over the /wip relay, the laptop handler, the page source with an offline last copy

Registers a telemetry ask (no arguments) in the relay ASKS table and the laptop agent ask handlers, answered by running the WE telemetry-summary operation with a 60 second cache; adds the page source that asks over the live socket on the deployed site, uses GET /api/telemetry on the dev server, keeps the last copy per device for the stale state, and refreshes on open, on Refresh and every 5 minutes. Ends with a sighted review of the integrated page at 390px and 1100px in both themes, recorded in the design doc review history.

## Done when

1. **Executable** — `npx vitest run plateau:src/telemetry plateau:src/wip/wip-relay-contract.test.ts plateau:src/wip/wip-agent.test.ts` passes, including:
   the relay forwards `ask {what:'telemetry'}` and refuses it with arguments; the agent answers it from the reader and
   serves a second ask within 60 s from cache; the page source falls back to the stored last copy (stale, with its age)
   when the laptop is absent, and survives `localStorage` throwing.
2. On the dev server /telemetry renders the laptop's real `telemetry-summary` output.
3. A sighted review of the integrated page (390px and 1100px, both themes) is recorded under "Review history" in
   plateau:docs/telemetry-page.md, with every must-fix finding fixed.
