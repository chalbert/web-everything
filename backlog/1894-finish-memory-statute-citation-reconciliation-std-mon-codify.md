---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: docs/agent/platform-decisions.md
tags: []
---

# Finish memory statute-citation reconciliation (STD/MON + codify NONE + collapse)

Finish the agent-memory statute-citation reconciliation started in #1893 — optional polish on the now-lazy memory tier. Three deferred sub-tasks: (1) run the additive anchor-citation pass over the STD and MON statute clusters the way the ARCH cluster was done; (2) codify the three rules that had no covering statute anchor (cross-origin dev-server hygiene, reusable-to-neutral-home, bias-toward-separation) into we:docs/agent/platform-decisions.md, and fix the bias-toward-separation placeholder link which is referenced about six times but has no anchor heading; (3) collapse memory bodies that merely restate the statute into thin pointers, one file at a time (bulk is unsafe — verification already caught one over-classification). Lineage: #1893, #1868, #1855.

## Progress (batch-2026-06-27)

**Sub-task 2 (codify NONE + fix link) — done.** Added three anchored statute sections to
`we:docs/agent/platform-decisions.md`: `#bias-toward-separation` (combine-vs-split default, #064),
`#reusable-neutral-home` (reusable→plateau, fix-surface-not-home, #1788), and
`#cross-origin-dev-server-hygiene` (serve heavy/vendor deps from a 2nd origin, #1499) — each faithfully
lowered from its memory leaf (87/97/29) with a Lineage line. Fixed the two broken `[bias-toward-separation]`
links (one had no target, one an empty `(#)`) to point at the new anchor.

**Sub-task 1 (additive citation pass over STD + MON) — done.** Appended a `**Codified:**` body footer (the
ARCH-cluster pattern) citing the covering statute anchor to **14 leaves**, high-confidence mappings only (a
wrong citation is worse than none): MON `#1`/`#2`/`#4`/`#5` → `#monetization`; STD `#75`/`#86` →
`#native-first-baseline`, `#78` → `#config-extends-platform-default`, `#83` → `#forward-generation-adapters`,
`#89` → `#intents-ux-only`, `#93` → `#protocol-host-project`, `#123` → `#compliance-validation-home`; plus
the three newly-codified leaves `#29`/`#87`/`#97`. Low-confidence STD leaves (e.g. 73/76/79/85/91/99 — no
clean 1:1 anchor) were **left untouched** by design. `check:memory` green (index 3.2 KB); `check:standards`
0 errors.

**Sub-task 3 (collapse bodies) — carved to #1896** (`blockedBy: [1894]`). It is the explicitly incremental,
per-file-judgment pass the card isolated ("one at a time, bulk unsafe"); #1881 found *most* bodies carry
nuance beyond the canon, so few qualify and rushing collapses inside a batch is the wrong risk. #1896 carries
the screening method + the 14-leaf candidate list.
