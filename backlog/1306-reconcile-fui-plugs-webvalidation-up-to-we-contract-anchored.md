---
kind: story
size: 5
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
---

# Reconcile fui:plugs/webvalidation UP to WE (contract-anchored) + consume published @webeverything/* contracts

Audit fui:plugs/webvalidation vs contract+vectors, then port 2 WE-only files + reconcile 3 diffs (AsyncValidatorField, ValidityMergeField, index), and align FUI to consume the published @webeverything/* contracts (#700/#872).

## Investigation 2026-06-20 (batch-2026-06-20) — NOT a clean reconcile; carried forward (#1304 class)

Audited `fui:plugs/webvalidation` vs WE. This is genuinely larger/forkier than "port 2 + reconcile 3"
and a byte-copy from WE would REGRESS FUI (nothing modified — diffed only):

1. **`index.ts` FUI-only lines are CORRECT, not drift.** FUI already consumes the published contracts —
   it imports from `@webeverything/capability-manifest` + `@webeverything/validation-generation/{provider,
   cel,registry,fieldError,service}` (the #700/#872 contract-distribution arrow). WE's index uses relative
   `../../…` paths because WE is the source. Copying WE's index "up" would undo FUI's published-contract
   consumption — the opposite of the card's own "align FUI to consume @webeverything/*" goal.
2. **`ValidityMergeField.ts` is a 109-line WE addition over a divergent FUI base** (FUI has its own
   `static observedAttributes = ['strategy']` + `#onControlEvent` handler). A careful merge, not a copy.
3. **`AsyncValidatorField.ts`** diverges (FUI's `#ensureRunner().validate(...)` vs WE's +18 lines).
4. **The 2 WE-only files** (`CustomCommitmentPolicyRegistry.ts`, `ValidationErrorSummary.ts`) import WE
   root modules `we:commitment-policy/registry.ts` and `we:error-summary/index.ts` — FUI has no local copy,
   so the port needs new `@webeverything/commitment-policy` / `@webeverything/error-summary` aliases (or
   FUI-local copies) wired first.

Proper reconcile = a focused merge that (a) PRESERVES FUI's `@webeverything/*` index imports, (b) hand-merges
ValidityMergeField/AsyncValidatorField keeping FUI's observed-attributes/runner bits, (c) adds the
commitment-policy + error-summary contract aliases before porting the 2 files. Carried forward from
batch-2026-06-20 — outgrew the "port 2 + reconcile 3" framing and intersects the #700/#872 contract-distribution model.
