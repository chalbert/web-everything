---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: '2026-06-08'
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
graduatedTo: "plug:customvaliditymergeregistry"
tags:
  - validation
  - registry
  - validity-model
  - native-first
  - interop
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "004"
---

# Validity-merge as a swappable strategy plane (ValidityMergeRegistry)

Falls out of #004's OP-1 ruling: the standard mandates the **surface protocol**
(the `MergedValidity` hand-off shape + the four observable interaction regions +
stable-id events), **not** the merge math. How a control computes its
`MergedValidity` is a swappable concern — a `ValidityMergeRegistry` provider
(sibling to the existing `CustomValidatorResolutionRegistry` for async).

**Build:**
- Define the `ValidityMergeRegistry` plug + provider interface (input: named
  `SourceResult`s `idle|valid|invalid|pending{version}`; output: `MergedValidity`).
- Native-first default strategy: **source-reduction** — named sources
  (`native`/`schema`/`async`/`manual`), declared precedence, `pending{version}`
  token. The orchestration layer **auto-stamps** the generation token so a dev
  setting a server error (`setSourceResult('server', result)`) never hand-authors
  ids; manual ids only for explicit stale-control.
- Codify a second strategy in Frontier UI: **simple / last-write-wins** — the
  degenerate single-source reduction (the old "flat flag"); still emits a valid
  `MergedValidity`, so it conforms and stays swappable.
- Custom strategies are first-class via registration; the **only** constraint is
  they must emit the surface contract (vary computation, never the surface — else
  L1 swappability breaks). This is enforced by the #004 OP-11 conformance tiers.

Slots into the capability-provider-resolution work (#203–#207). See #004 for the
ruling and rationale.

## Progress

- **Status:** resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Done:** Shipped the `CustomValidityMergeRegistry` + `CustomValidityMergeStrategy`
  plug pair (`src/_data/plugs.json` + two plug-descriptions) and the standalone TS
  strategy plane in `validity-merge/` (mirroring `capabilities/`): surface types
  (`SourceResult`/`MergedValidity`) with `isMergedValidity`/`assertMergedValidity`
  guards enforcing the #004 OP-1 surface contract; `SourceReductionStrategy`
  (native-first default, strictest-wins + declared precedence); `LastWriteWinsStrategy`
  (degenerate single-source reduction); the registry + auto-stamping
  `ValiditySourceOrchestrator`; default wiring in `index.ts`. 22 vitest specs (wired
  `validity-merge/**` into vitest include). `check:standards` 0 errors; both plug
  pages render 200.
- **Next:** runtime plug + ElementInternals integration → #215; async resolution
  sibling plane → #214.
- **Notes:** charter's `ValidityMergeRegistry` maps to conforming names
  `CustomValidityMergeRegistry` (registry) + `CustomValidityMergeStrategy` (base
  contract) — the `custompositioningregistry`+`custompositioner` pair pattern; the
  `Custom*Registry` form is what the check:standards linter expects. Resolves the
  webvalidation `merge-strategy` open question (strictest-wins vs last-writer-wins)
  by reframing both as swappable strategies per #004 OP-1.

**Graduated to** `plug:customvaliditymergeregistry` — CustomValidityMergeRegistry + CustomValidityMergeStrategy plug pair (standalone TS model in validity-merge/).
