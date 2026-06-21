---
kind: story
size: 3
parent: "1250"
status: open
blockedBy: ["1297", "1298", "1299", "1300", "1301", "1302", "1303", "1304", "1305", "1306", "1307", "1308", "1350", "1354"]
dateOpened: "2026-06-20"
tags: []
---

# Add a real plugs WE↔FUI drift gate to check:standards (mirror the blocks-side §8c/#659)

New we:scripts/check-standards.mjs section mirroring §8c/#659 (blocks contract↔impl drift): fail when we:plugs/<domain> diverges from fui:plugs/<domain>; detect-or-skip when ../frontierui absent. Lands after all per-domain reconciliation/port slices so it goes green, not red.
