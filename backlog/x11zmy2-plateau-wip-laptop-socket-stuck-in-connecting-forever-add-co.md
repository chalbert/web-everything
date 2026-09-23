---
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# plateau: /wip laptop socket stuck in CONNECTING forever — add connect timeout + /decide stalled state

2026-09-22/23 postmortem: plateau:scripts/wip-publish.ts -> plateau:src/wip/wip-agent.ts (the laptop WebSocket to the relay) restarted at 18:38:43 and its live channel never opened -- no open/closed/could-not-open/reconnecting log for ~12.5h in ~/Library/Logs/plateau-wip-publisher.log, only the 20s HTTP-fallback line, because plateau:src/wip/wip-agent.ts reconnect loop only runs from onclose and a socket stuck in CONNECTING never fires it. A direct handshake probe to wss://plateau-app.nicgilbert.workers.dev/__wip/live opened in 107ms at the same time; launchctl kickstart -k fixed it instantly. Impact: plateau:src/wip/wip-decide.ts (the decision-forks ask, no HTTP fallback) showed EMPTY with no explanation. Fix landed: a CONNECT_TIMEOUT_MS in plateau:src/wip/wip-agent.ts that force-closes and reconnects through the normal backoff path if the socket has not opened in time (post-open silence already covered by the relays LAPTOP_SILENT_MS sweep in plateau:wip-relay.js -- verified, not duplicated); a new stalled phase in plateau:src/wip/wip-decide.ts with ASK_TIMEOUT_MS that shows a distinct message and keeps retrying instead of hanging on Loading forever; plateau:docs/wip-page.md state table updated (state 14).

## Done when

1. **Executable** — `npx vitest run plateau:src/wip/wip-agent.test.ts plateau:src/wip/wip-decide.test.ts` passes, including:
   - a fake WebSocket that never opens and never closes: after `CONNECT_TIMEOUT_MS`, the agent logs "did not open" and reconnects through the normal backoff path (`plateau:src/wip/wip-agent.test.ts`).
   - a fake WebSocket that opens just under the timeout is never treated as stuck (`plateau:src/wip/wip-agent.test.ts`).
   - `/decide` with presence reporting the laptop online but the `decision-forks` ask never answering: after `ASK_TIMEOUT_MS` it renders the distinct "Laptop connected but the live channel is down" message (not the generic offline/error text) and keeps re-asking (`plateau:src/wip/wip-decide.test.ts`).
   - an answer that beats the timeout renders normally and never shows the stalled message (`plateau:src/wip/wip-decide.test.ts`).
2. **No regression** — `node plateau:scripts/check-render-conformance.mjs --json` reports no entry for `plateau:src/wip/wip-decide.ts` in `regressions`.
3. **Docs** — `plateau:docs/wip-page.md`'s state table includes the new `/decide` stalled state (state 14).
