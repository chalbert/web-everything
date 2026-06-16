---
type: issue
workItem: story
size: 5
parent: "728"
status: open
blockedBy: ["765"]
dateOpened: "2026-06-16"
tags: []
---

# Mode C: FUI embed SDK gains a Shadow-DOM in-document render mode; fuiDemo gains the opt-in

Build the in-document (mode C) render path ratified in #765. The FUI-owned embed SDK gains a Shadow-DOM-encapsulated in-document mount as an additional value of its render-mode axis (alongside #732's A/B1/B2 iframe modes): for the trusted WE↔FUI pair only, a FUI component mounts directly in WE's host DOM behind a shadow root so native top-layer overlays escape with zero coordination. WE's fuiDemo shortcode gains an opt-in to select mode C per demo, iframe staying the default. Runtime SDK only — never the #700 source import (no frontierui alias). Priority is the open knob; gated blockedBy #765.
