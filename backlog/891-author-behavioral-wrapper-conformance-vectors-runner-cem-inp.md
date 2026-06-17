---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["855"]
dateOpened: "2026-06-17"
tags: []
---

# Author behavioral wrapper conformance vectors + runner (CEM-input → runtime-behavior assertions) — WE-owned

Ratified by #855 (B2): WE owns the wrapper conformance contract, not the codegen. Author a small corpus of behavioral vectors — each a hand-written CEM custom-element fixture (tagName + attributes + properties + events + slots) paired with runtime assertions a conformant React/Vue wrapper must satisfy: renders the tag, forwards attributes, assigns properties (not serialized), bridges events to handler props, projects slots. Ship a headless-DOM runner that mounts a wrapper, drives props/events, checks the assertions — generator-agnostic, so FUI's generator stays swappable. Mirrors the #506 golden-vectors+runner model. Synthetic fixtures, so no #822 dependency.
