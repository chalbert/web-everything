---
type: idea
workItem: story
size: 8
status: open
dateOpened: "2026-06-15"
tags: []
---

# Generate FUI's block catalog from a derived manifest and render its local /blocks/ from it

Replace the hand-curated 7-entry frontierui/src/_data/blocks.json (which surfaces only ~30% of the 23 implemented block families and silently drifts) with a single manifest auto-derived from the FUI implementation (CEM / generated), and render FUI's own /blocks/ catalog (frontierui/src/blocks.njk) from it — dogfooding #425's self-hosted Web Docs primitives on real data. Per the #705 ruling: FUI owns impl AND its rendered display; WE never renders these blocks (it embeds FUI-hosted demos via the #701 fuiDemo iframe). Coordinate the derivation mechanism with the WE web-docs pipeline (#623/#627) rather than forking a parallel one.
