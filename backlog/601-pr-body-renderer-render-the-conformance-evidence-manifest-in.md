---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["599", "598"]
dateOpened: "2026-06-14"
tags: []
---

# PR-body renderer — render the conformance-evidence manifest into the bot-PR (thin markdown first)

Build the Plateau dev-browser renderer ruled by #578 (Fork 2): turn the standard-owned conformance-evidence manifest (#599) into the bot-PR body and attach it via the forge provider (#598). Per the ruling, ship B's freeform markdown rendering FIRST, backed by the manifest contract — letting the renderer's real needs drive the contract's fields rather than over-building the manifest before a real fix-loop PR exists. Layer: Plateau (rendering + attach-to-PR), per the #475/#091 constellation split (contract → WE, rendering → Plateau). Gated on the manifest contract (#599) and the forge provider (#598).
