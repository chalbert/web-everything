---
kind: story
size: 5
status: open
blockedBy: ["1322"]
dateOpened: "2026-06-20"
tags: []
---

# Apply open-numbered-variant pattern to sectioning and layout

#1318 established that presentational variants are an open-numbered axis off one semantic contract, and noted it generalizes beyond Action. Apply it to sectioning and layout: define each semantic contract once, then expose presentational variants as an open-numbered axis (recommended core set + author extension) rather than a closed enum. Seed from the variant-vs-block-polymorphism ceiling — structural differences are block polymorphism, presentational ones are variants. Blocked on the statute promotion (#1322) so it cites the codified rule.
