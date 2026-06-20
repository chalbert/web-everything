---
type: idea
workItem: story
status: open
size: 5
dateOpened: "2026-06-20"
relatedProject: webrealtime
tags: [deck, presenter, sync, broadcastchannel, webrealtime]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Presenter-mode + cross-window sync (current/next/notes/timer)

A second-window **presenter view** (current + next + notes + timer) synced via **BroadcastChannel** (with a window.open postMessage handshake for late-joiner catch-up + heartbeat/reconnect); the presenter window must *not* render audience transitions. Homed in **webrealtime** (extends `transport-negotiation`) + webportals; the current/next/notes/timer terms are a semantics term, not a new project. *New contract — one of the hard ones.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
