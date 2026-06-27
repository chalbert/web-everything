---
kind: story
size: 5
status: open
blockedBy: ["1832"]
dateOpened: "2026-06-27"
tags: []
---

# Review current block interfaces for compliance with the a11y-contract composition rule

Audit every existing block interface in we:blocks/ against the #1795 ruling (we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract): does each expose variation as ADD-ONLY composition (slots/decoration/scoped-replace) rather than contract-changing config attributes? Flag any block whose attribute surface lets a consumer change roles/focus/keyboard (the as=menubar smell) instead of forcing a distinct block, and any all-visual prop matrix that should be theme tokens/CSS. Output: a compliance report + a remediation card per offending block. Blocked on the non-destructiveness contract statement (#1832) it checks against.
