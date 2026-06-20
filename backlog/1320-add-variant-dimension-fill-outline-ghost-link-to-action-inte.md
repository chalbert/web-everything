---
kind: story
size: 3
status: open
blockedBy: ["1318"]
dateOpened: "2026-06-20"
tags: []
---

# Add variant dimension (fill|outline|ghost|link) to Action Intent

Implement the #1318 ruling: add a `variant` dimension to we:src/_data/intents/action.json with the recommended core set (fill | outline | ghost | link), open vocabulary (authors may extend per the open-numbered-variant contract), orthogonal to `level`, optional with a most-permissive unspecified default (absent → block renders the conventional treatment for the level). Mirrors we:src/_data/intents/input.json variant. Surface is a plain attribute consumed by CSS (no wrapper required).
