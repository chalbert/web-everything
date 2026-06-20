---
kind: story
size: 3
status: resolved
blockedBy: ["1318"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/intents/action.json"
tags: []
---

# Add variant dimension (fill|outline|ghost|link) to Action Intent

## Progress (batch-2026-06-20) — DONE

Added the `variant` dimension to `we:src/_data/intents/action.json` per the #1318 ruling: core set
`fill | outline | ghost | link`, orthogonal to `level`, behavior-free. The open-vocabulary +
most-permissive-default + plain-CSS-attribute semantics are carried in the dimension `description`
(intent dimensions have no structured open/default field — same shape as `we:src/_data/intents/input.json`'s
`variant`): open-numbered axis (authors mint members per the variant contract), absent → conventional
treatment for the `level`, surface `button[variant]` consumed by CSS, no wrapper. JSON valid; gate green.
Follow-ups remain: #1321 (FUI variant-surface packaging), #1323 (sectioning/layout application).

Implement the #1318 ruling: add a `variant` dimension to we:src/_data/intents/action.json with the recommended core set (fill | outline | ghost | link), open vocabulary (authors may extend per the open-numbered-variant contract), orthogonal to `level`, optional with a most-permissive unspecified default (absent → block renders the conventional treatment for the level). Mirrors we:src/_data/intents/input.json variant. Surface is a plain attribute consumed by CSS (no wrapper required).
