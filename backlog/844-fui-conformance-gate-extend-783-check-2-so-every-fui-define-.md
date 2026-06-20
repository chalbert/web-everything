---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-17"
blockedBy: ["908"]
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards.mjs
locus: frontierui
crossRef: { url: /backlog/783-decide-the-fui-catalog-block-family-denominator-dir-we-spec-/, label: "Check-2 home (#783)" }
tags: [frontierui, cem, conformance, drift-gate]
---

# FUI conformance gate: extend #783 Check-2 so every FUI define() name equals the tagName its WE spec declares

The drift backstop from the #822 ruling, in its correct home (FUI-side, the #783 Check-2 direction: impl conforms to the WE standard — not WE reaching into FUI). Once WE fui:blocks.json carries the contract tagName per block, extend FUI's registered-name->spec gate (the #783 Check-2 build over frontierui/blocks) so every customElements.define / attributes.define name must equal the tagName its WE spec entry declares. Catches WE<->FUI tag drift from FUI's side. Blocked on the WE tagName values existing first.

## Per #841 ratification (2026-06-17)

#841 added a **parameterized-registration invariant** that sharpens what this gate checks:

- **Validate the register function's DEFAULT argument, not just the bare `define()` literal.** FUI registers
  elements as `registerX(tag = <default>)` (the shape `fui:blocks/renderers/pagination/PaginationBehavior.ts`
  / `fui:blocks/renderers/data-table/DataTableBehavior.ts` already use). The gate asserts that **default arg
  == the WE-spec tagName**.
- **Flag hard-coded literals — registration must be parameterized.** Today 5 elements hard-code the tag in
  `customElements.define('auto-complete', …)` (`fui:blocks/droplist/AutoComplete.ts:444`,
  `fui:blocks/router/registerRouter.ts:33-36`, `fui:blocks/transient/registerTransient.ts:23`,
  `fui:blocks/background-task-surface/registerBackgroundTasks.ts:23`). The gate flags a hard-coded element tag
  as non-conforming; FUI migrates them to the `register*(tag = …)` shape (the doc-comments at
  `we:registerRouter.ts:27`/`fui:registerBackgroundTasks.ts:18` already show the intended customizability).
- **A consumer-supplied override is allowed and is NOT a failure.** The invariant is "default == spec + the
  tag is overridable," not "the tag is frozen." JSX/scoped-registry, MaaS per-tenant, and project config may
  pass a different tag at the use-site.
- **Scope:** custom *attributes* (`attributes.define` — `nav:list`, `grid:*`) are **out** (no tagName; they
  stay plain `class` declarations per #822). This gate covers `customElements.define` element tags only.

## Progress — built (2026-06-18)

#908 ratified A (build as written: default arg == spec, flag literals; the FUI migration is downstream).
Built **Check 2b** in `fui:frontierui/scripts/check-standards.mjs` (extends #783 Check 2, the WE→impl
direction): for every WE-spec `tagName` (read from `we:custom-elements.json`, the #838/#839 authored CEM —
7 `we-*` tags), assert a FUI element registers it as its **default**, and flag any hard-coded
`customElements.define('literal')` for a catalog element as non-parameterized (must be `register*(tag = …)`
per #841 so the tag is a consumer-overridable default; JSDoc example lines excluded; custom *attributes*
out per #822).

**Staged warn-first** (`TAGNAME_GATE_ENFORCED = false`, mirroring #659's drift gate): FUI still registers the
pretty defaults (`page-nav`, `auto-heading`) that #843 ruled are overrides, so the binding is unmet by design
until the downstream migration — the gate WARNs now (verified: **0 errors**, 5 parameterization warns for the
hard-coded literals + 7 cross-binding warns for the unmatched `we-*` tags). Flip the flag to ERROR once the
migration lands. Scaffolded that follow-on as **#929** (flip FUI defaults to `we-*` + flip the enforce flag,
`locus: frontierui`). FUI `check:standards` green.

## Blocked — gate premise conflicts with #843 (batch-2026-06-17 pre-flight)

The gate asserts FUI register **defaults** equal the `we-` spec tagName. But FUI currently registers the
**pretty** names (`auto-complete`, `route-view`, `auto-heading`…) as its defaults — which #843 ratified are
**consumer overrides, not WE-contract values**. So "default == we-spec" presumes FUI flips every element-tag
default to a `we-` name (a FUI-wide rename + demo/test churn) — not explicitly ratified, and the #843
"overrides" wording reads the other way. Filed as decision
[#908](/backlog/908-decide-whether-fui-element-tag-registration-defaults-must-be/): (A) FUI flips defaults to
`we-`, pretty → overrides; (B) pretty stays canonical, gate only checks the `we-` tag is a registered alias;
(C) gate only that no element is unregistered. #843 satisfied the old `blockedBy:[843]` edge; the real blocker
is #908. Re-blocked rather than improvising the FUI rename the gate-as-written presumes.
