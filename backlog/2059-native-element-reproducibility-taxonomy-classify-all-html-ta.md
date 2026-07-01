---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
codifiedIn: "docs/agent/block-standard.md#reproducibility-taxonomy"
tags: [block-standard, packaging, reproducibility, host-is-the-node, transient-element]
---

# Native-element reproducibility taxonomy: classify all HTML tags for block packaging

Classify every native HTML tag into the three block-packaging buckets ratified by #2028: (1) host-reproducible (role+ARIA only) -> host-is-node via ElementInternals; (2) irreplaceable-native (unique rendering/interaction) -> wrap a real child (#1962 (B)); (3) content-model-constrained (parent accepts only the real tag) -> reserved transient (#1962 (A)). Becomes the reference block-packaging decision rule so the catalog inherits one lookup instead of per-block judgment. Lives in block-standard §7 / #1962 lineage.

## Delivered (2026-07-01)

Authored the exhaustive tag-by-tag classification as an anchored reference section in the packaging-governance
home: **`we:docs/agent/block-standard.md#reproducibility-taxonomy`** ("Native-element reproducibility taxonomy
(#2059)"), placed in the #2028/#1962 §7 lineage directly after the transient exposed-API contract. It classifies the
full rendered HTML element set into #2028's three buckets:

- **Host-reproducible (HR)** → host-is-the-node via `ElementInternals` (zero sub-element): flow/phrasing containers &
  text, `h1`–`h6`, grouping & lists, inline-semantics tags, and the badge/tag/card/section-card leaves.
- **Irreplaceable-native (IN)** → wrap a real native child (#1962 (B)): form controls & submission, `progress`/`meter`,
  disclosure/`dialog`, media & replaced/embedded elements, `<a href>`, and the UA-drawn `<table>` box.
- **Content-model-constrained (CMC)** → reserved transient (#1962 (A)): the parent→child pairs (`option`/`select`,
  table children, `li`/list, `summary`/`details`, etc.) — a *modifier* on HR/IN by parent context; **no current block
  qualifies**, matching §7:288.

Non-rendered metadata tags (`html`, `head`, `meta`, `template`, `slot`, …) are marked out of scope (not
block-packaging candidates). A block now inherits its packaging shape by table lookup — `childTag()` returns `null`
for HR, the wrapped tag for IN — instead of re-deriving the reproducibility judgment per block.
