---
kind: decision
status: open
blockedBy: ["1321"]
dateOpened: "2026-06-21"
tags: []
---

# Button packaging: pick runtime-shape mechanism (transient vs persistent light-DOM vs shadow), we-button default tag, block-model conversion

Carved from #1321 (ratified the general block-packaging ruling). Picks the BUTTON's concrete runtime-shape mechanism among the three #1321 families — (A) `TransientElement` self-replace → native `<button>` (wrapper-less; leads, but weigh post-render reactivity / DOM-inspection limits), (B) persistent light-DOM custom element owning a real `<button>`, (C) shadow. Confirms `we-button` as the action control's WE-default customizable tag (#841 bare-kebab/`we-*` context, #1120 hyphen rule). Scopes the block-model conversion program (only 5/75 blocks register as elements today, #841). Encapsulation rides #1349 `webisolation` (light-DOM families) — no `ElementInternals` needed; `ElementInternals` is a shadow-only cost.
