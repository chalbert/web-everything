---
kind: story
size: 5
parent: "3099"
status: open
dateOpened: "2026-08-25"
tags: []
---

# A preparation's review must be machine-readable state, not prose in the body

Preparation is reviewed today by appending a section to the card. Nothing records that fact in frontmatter, so no gate can read it: an audit of 433 stamped cards could only fuzzy-match prose and found 18. preparedDate exists and has no reviewed counterpart. Until a preparation carries a reviewed marker and a confidence level as frontmatter, claim cannot refuse an unreviewed card and build-ready cannot be distinguished from prepared.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
