---
kind: story
size: 5
status: resolved
blockedBy: []
relatedReport: reports/2026-06-27-block-a11y-composition-compliance-audit.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# Review current block interfaces for compliance with the a11y-contract composition rule

Audit every existing block interface in we:blocks/ against the #1795 ruling (we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract): does each expose variation as ADD-ONLY composition (slots/decoration/scoped-replace) rather than contract-changing config attributes? Flag any block whose attribute surface lets a consumer change roles/focus/keyboard (the as=menubar smell) instead of forcing a distinct block, and any all-visual prop matrix that should be theme tokens/CSS. Output: a compliance report + a remediation card per offending block. Blocked on the non-destructiveness contract statement (#1832) it checks against.

## Shipped (batch-2026-06-27-1842-1720)

Report: **`we:reports/2026-06-27-block-a11y-composition-compliance-audit.md`** (81 block interfaces scanned).
**Verdict: the WE block interfaces pass #1795 at the interface level — no remediation card against any block
interface.** Method: a Sonnet sub-agent proposed flags, each then adversarially verified on the main loop
against the file *and the prior-decision record*.

- The one role-changing trait — `data-grid` `withHierarchyProjection` (`role=grid`→`treegrid` + Right/Left
  rebind) — is **NOT a violation**: it is the **ratified #1411 treegrid-projection exception** (treegrid is a
  hierarchy projection on data-grid, *not* a new block; rationale recorded in the block JSON
  `treegridIsAProjectionNotABlock`). The audit's flag here was a false positive (mechanical rule-match that
  re-opened a settled ruling) — refuted, no card.
- Three traits are **impl-dependent** (compliance turns on the FUI impl: DOM-reorder vs CSS `order`; whether
  base `aria-disabled`/focus is retained), which #1795 itself assigns to FUI/Plateau conformance, not the WE
  interface: `action-button`/`withPlatformOrdering`, `tabs`/`withReorderableTabs`, `workflow`/`withNonLinearProgression`.
  Carved to **#1875** (FUI conformance).
- No `visual-prop-matrix` offenders — cosmetic variation is already add-only traits or theme tokens.

`blockedBy` cleared (#1832 resolved, the rule it checks against). Graduated to the report + #1875; no entity.
