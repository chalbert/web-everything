---
kind: story
size: 5
parent: "x6yoscx"
status: open
blockedBy: ["xeqqi9q", "xpop00d", "x7e4l9g"]
dateOpened: "2026-07-10"
tags: []
---

# Proof-of-land gate: land a stacked couple only when its stackParents are proven landed

Teach the drain sweep in we:scripts/merge-ai-prs.mjs to build the impl-PR-to-WE-manifest laneRef join (map each lane ref to its WE manifest from repos[], so impl/orphan PRs inherit item + stackParents + blockedBy from their couple, closing the impl-orphan-always-ready hole). Gate a couple READY only if every stackParent is landed this pass (in-memory set) OR bornAs-proven on main, else DEFER — evaluated at item/couple granularity, preserving impl-first/WE-last. Happy-path rebuild reuses the existing we:scripts/lib/rebase-drop-manifest.mjs step unchanged. Also commit the durable capability marker (gateVersion) to origin/main. Kept atomic (irreducible safety unit — any partial ship is an unsafe intermediate drain state). Tests: a chain lands in order; a red/absent parent defers its descendants including their impl PRs (no stowaway at either level); a disjoint sibling is unaffected; a manifest-less impl PR is held with its couple.
