---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1887"]
dateOpened: "2026-06-27"
tags: []
---

# Drift gate: the plug parity manifest must track the FUI runtime (FUI)

FUI. A drift gate ensuring the parity manifest (S5a/#1887) tracks the runtime, mirroring the #1309 plugs drift gate. Must target the FUI tree / the manifest, NOT a WE plugs dir — Gap A: WE has no plugs/ tree, so the dual-mode walk in we:scripts/check-standards.mjs:977-979 (existsSync(join(ROOT,'plugs'))) is a silent no-op in WE. Blocked by #1887 (gate needs a manifest to check).
