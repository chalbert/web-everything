---
kind: task
status: open
dateOpened: "2026-07-02"
tags: []
---

# Claims-truth audit: every externally visible claim true of the deployed artifact (site + adopter deck)

Pre-deploy gate node from ratified #2089 Fork 1(b): sweep every externally visible dogfood/maturity claim — the docs site's published claims AND the enterprise-adopter deck (#1214/#1360, which carries the 'we eat our own cooking' claim the 2026-07-01 external review flagged as aspirational) — and for each, scope the claim or ship the surface. The gated deploy (#1137) is blockedBy this node: the ladder's bar is claim-indexed, not inventory-indexed, so the deploy goes live at the earliest truthful moment. Re-run required before the ungated-public stage.
