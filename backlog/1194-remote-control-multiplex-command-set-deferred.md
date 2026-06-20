---
kind: story
status: resolved
size: 3
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/semantics/remote-control-command-set.json
relatedProject: webrealtime
tags: [deck, remote-control, multiplex, webrealtime]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Remote-control / multiplex command set (deferred)

A cross-device **clicker + follow-the-presenter (multiplex)** command set over `transport-negotiation`. Lower priority / deferred (device-specific). Homed in **webrealtime**. *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress

Resolved 2026-06-20. Defined the **new contract** as a semantics term
(we:src/_data/semantics/remote-control-command-set.json) — the convention for the #1173-carved deck
contracts (sibling of `slide-addressing`):

- **Clicker channel:** `next` / `previous` / `goto(address)` / `blank`+`resume` / `start`+`end`.
- **Multiplex follow-the-presenter:** one presenter device drives the slide-addressing position, N
  followers mirror it live (presence over the same channel; instant-jump restore, no transition storm).
- **Transport-agnostic:** rides the Transport Negotiation protocol's CustomTransportProvider channel
  (BroadcastChannel / WebSocket / WebRTC), defining no wire of its own; composes slide-addressing +
  the Advanceable-Sequence intent.
- Distinguished from #1184 (same-device cross-window presenter sync) — this is **cross-device**.

Deferred / lower priority (device-specific) — the contract vocabulary is fixed now so the deferred build
has a stable target; the runtime transport impl is FUI/plateau (webrealtime is the contract home, #817).
No A/B fork — the command vocabulary is spec authoring, and "deferred" is prioritization, not a design
fork. Gate green.
