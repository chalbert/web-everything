---
kind: decision
parent: "1294"
status: open
priority: low
dateOpened: "2026-07-06"
tags: [constellation-placement, relocation, webcases, conformance]
---

# webcases driftCheck placement — WE (#334) vs Plateau verifier (#1566)

we:webcases/driftCheck.ts computes a mock-vs-real pass/fail verdict — the shape #1566 relocated to Plateau — yet its header cites the older #334 ruling that webcases is the verification home; #1566 never amended #334. Its output is a bespoke DriftReport, not a #899 vector, so #1816 does not apply. Decide whether #1566's verifier→Plateau principle overrides #334, and the home (FUI co-located with fui:tools/mock-server record transport, or Plateau). Parked; blocks nothing live.
