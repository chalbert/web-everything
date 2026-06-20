---
kind: story
status: resolved
size: 5
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/semantics/presenter-mode-sync.json
relatedProject: webrealtime
tags: [deck, presenter, sync, broadcastchannel, webrealtime]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Presenter-mode + cross-window sync (current/next/notes/timer)

A second-window **presenter view** (current + next + notes + timer) synced via **BroadcastChannel** (with a window.open postMessage handshake for late-joiner catch-up + heartbeat/reconnect); the presenter window must *not* render audience transitions. Homed in **webrealtime** (extends `transport-negotiation`) + webportals; the current/next/notes/timer terms are a semantics term, not a new project. *New contract — one of the hard ones.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress

Resolved 2026-06-20. Defined the **new contract** as a semantics term
(we:src/_data/semantics/presenter-mode-sync.json), the convention the body itself called for
("the current/next/notes/timer terms are a semantics term, not a new project"):

- **Surface:** second-window presenter view = current slide + next + speaker-notes + timer.
- **Sync:** state (slide-address / next / notes ref / timer start) published over BroadcastChannel; a
  `window.open` + `postMessage` handshake gives a late-joining/reopened window a full-state **snapshot**
  (catch-up); heartbeat + reconnect keep the two windows live.
- **Defining invariant:** the presenter window MUST NOT render the audience's View Transitions — it shows
  the resolved current+next directly, never the in-between motion.
- **Conformance footgun baked:** late-joiner/reconnect reaches state via the snapshot handshake, not by
  replaying commands (no transition storm; instant-jump restore).
- Composes slide-addressing + speaker-notes + Advanceable-Sequence; homed webrealtime (channel/handshake)
  + webportals (the window surface). Same-**device** cross-window — distinct from the cross-**device**
  remote-control command set (#1194).

Not a fork after all (flagged "one of the hard ones" at pre-flight): the sync vocabulary + invariants are
spec authoring, no A/B design choice — so it lowered to a contract term like its kin. The runtime channel
impl is FUI/plateau (webrealtime is the contract home, #817). Gate green (we:AGENTS.md regenerated).
