---
kind: epic
status: open
dateOpened: "2026-09-30"
tags: []
---

# Future feature: the builder delivers one card across two repos (coupled delivery)

Operator ruling on #4289 (2026-09-30): kept as a future builder feature, not banned. For changes that genuinely cannot be split by repo, the builder acquires and owns one lane per edited repo, gives the worker bounded write access to both, opens one PR per repo linked by the existing manifest, runs each repo verification and CI, merges in dependency order through the existing drain ordering, and handles partial landing with explicit resume or a compensating revert (no false atomicity). Graduate through a real two-repo exercise (paired landing, lane exhaustion, red CI on one side, crash and resume, second-merge failure). Full acceptance envelope: the "What coupled delivery (b) would require" section of we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
