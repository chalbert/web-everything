---
type: issue
workItem: story
size: 5
parent: "728"
status: open
blockedBy: ["765", "807"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
tags: []
---

# Mode C: FUI embed SDK gains a Shadow-DOM in-document render mode; fuiDemo gains the opt-in

Build the in-document (mode C) render path ratified in #765. The FUI-owned embed SDK gains a Shadow-DOM-encapsulated in-document mount as an additional value of its render-mode axis (alongside #732's A/B1/B2 iframe modes): for the trusted WE↔FUI pair only, a FUI component mounts directly in WE's host DOM behind a shadow root so native top-layer overlays escape with zero coordination. WE's fuiDemo shortcode gains an opt-in to select mode C per demo, iframe staying the default. Runtime SDK only — never the #700 source import (no frontierui alias). Priority is the open knob; gated blockedBy #765.

## Blocked-in-fact — re-pointed 2026-06-16 (batch-2026-06-16, claimed then released)
Picked this up to build and found the substrate it extends **does not exist**. Mode C is "an additional value of the render-mode axis (alongside #732's A/B1/B2 iframe modes)" — but that embed SDK and its render-mode axis were **never built**: #732 is a resolved *decision* (`graduatedTo: none`) that ruled "B1 builds first (carved under #728)", yet no B1 build was ever filed, and `frontierui` contains **zero** embed/render-mode code (verified by search). #765 (the boundary-relax decision) being resolved is necessary but not sufficient — there is no axis to add mode C to.

Filed the missing foundational build as **#807** (the FUI embed-SDK skeleton + render-mode axis, B1 first) and added it to this item's `blockedBy`. Released back to `open`; this unblocks once #807 ships the SDK + axis. (#764 / B2 is in the same position.)
