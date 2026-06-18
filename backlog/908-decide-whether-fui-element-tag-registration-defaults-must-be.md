---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# Decide whether FUI element-tag registration DEFAULTS must be the we- spec tagName (pretty names → overrides) — the #844 gate premise vs #843 overrides ruling

#844 (FUI conformance gate) asserts 'every FUI define()/register default == the tagName its WE spec declares (we-<id>, per #843)', flagging hard-coded literals + non-we defaults as drift. But #843 ratified that 'pretty legacy names (page-nav, auto-heading, auto-complete, route-view) are consumer OVERRIDES, not WE-contract values' — and FUI currently registers exactly those pretty names as its DEFAULTS (verified: fui:blocks/droplist/AutoComplete.ts:444 define('auto-complete'); registerRouter route-view/route-outlet; registerTransient auto-heading; etc.). So the gate's 'default==we-spec' premise conflicts with FUI's status quo: either (A) FUI flips ALL element-tag defaults to we- names (we-autocomplete, we-route-view…) and the pretty names become opt-in consumer overrides — a FUI-wide registration rename + demo/test updates, then the #844 gate enforces it; or (B) FUI keeps pretty names as the canonical impl defaults (they ARE the #843 'consumer overrides' incarnate) and the #844 gate is re-scoped to only assert the we- contract tag is registered as an ALIAS alongside, not as the sole default; or (C) drop the default==spec check entirely, gate only that no element is unregistered. Building #844 as written (A) presumes a costly FUI rename not explicitly ratified. Lean A (~60%, the #822/#841/#843 line wants the we- value to be the contract default and pretty names genuinely opt-in) but low confidence — the #843 'overrides' wording reads toward B. Blocks #844.
