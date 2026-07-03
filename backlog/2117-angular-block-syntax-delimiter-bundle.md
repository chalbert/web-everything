---
kind: story
size: 3
parent: "2094"
status: resolved
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [custom-nodes, delimiter-grammar, bundle, angular]
---

# Angular block-syntax delimiter bundle

Ship the Angular bundle: {{ }} interpolation + the v17+ block grammar @if (…) { … } @else { … }, @for/@empty, @switch — bare-brace close, a third declared-close shape. Attribute-keyed constructs (*ngIf, [prop], (event)) documented as out-of-scope scorecard rows (→ the #1986 attribute registry), per #2074's scope enumeration. Scored via #2113; gap list published as a we:reports/ topic.
