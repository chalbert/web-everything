---
type: issue
workItem: story
size: 5
parent: "658"
status: resolved
blockedBy: []
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
tags: []
---

# Delete WE's app-coupled block-impl families (audit/lifecycle/master-detail/selection/tree-select) after the exercise apps move to FUI

The app-coupled half of #697's blocks deletion (split out 2026-06-17). The two exercise apps composed these
families as CLASSES (`we:loan-origination/app.ts`, `we:auto-insurance/app.ts`), so they couldn't be deleted until
those apps moved to FUI (**#823**, resolved 2026-06-17 — unblocked). When unblocked: delete the vendored
runtime impls (upstream in `@frontierui/blocks`); their `fui:blocks.json` contracts already point to FUI (#657)
so leave them, and the generated `we:custom-elements.json` follows. #697 took the 3 genuinely-free families
(`type-ahead`, `background-task-surface`, `data-grid`).

## Grounding corrections (2026-06-17, at claim — verified against both trees)

The original body said "**6 families**, delete byte-identical, leave only `fui:blocks.json`." Two corrections:

1. **`stepper` STAYS — it is NOT deletable (6 → 5 families).** `we:blocks/wizard/WizardElement.ts:132` does
   `new StepperBehavior(this, {…})` at runtime. `wizard` is a *kept* reference-runtime family (its own
   `wizard-flow-demo` exercises Web Workflows / Flow-Progress, #651/#691; FUI has no `wizard`), and there is
   no cross-repo import path to FUI's stepper (#707 boundary). So stepper is required by a STAY family and
   must remain in WE as reference-runtime. #697's grounding mis-classified it by checking only the *app*
   consumer (auto-insurance), missing the *wizard* (stay-family) consumer — wizard isn't one of the "9", so
   the wizard→stepper edge fell outside that scope. **Deletable set: `audit`, `lifecycle`, `master-detail`,
   `selection`, `tree-select`.**

2. **Delete the runtime impl ONLY; KEEP each `blocks/<f>we:/contract.ts`.** Post-#875/#878/#879 (all resolved
   2026-06-17), FUI deleted its own `we:contract.ts` copies and imports `@webeverything/contracts/<f>` — so
   **WE's `blocks/<f>we:/contract.ts` are now the canonical single source FUI depends on** (the FUI→WE arrow).
   Deleting them would break FUI's build and the `@webeverything/contracts` package (`contracts/<f>.ts`
   re-exports `../blocks/<f>/contract`). The WE impl files now differ from FUI's by exactly one import line
   (`./contract` → `@webeverything/contracts/<f>`); the runtime logic is byte-identical upstream, so the
   impl files are safe to delete. (`we:custom-elements.json` is a pure projection of `fui:blocks.json` via
   `gen:cem`, which is unchanged → CEM is unaffected, no regen needed.)

**Scope (per #837):** also delete the **WE-local exercise app copies** `demos/loan-origination/` +
`demos/auto-insurance/` (hosted in FUI by #835/#836; their `we:demos.json` entries already became `fuiDemoFile`
iframe embeds in #837, which stay). One STAY→delete edge to repoint first:
`we:blocks/renderers/audit-timeline/renderAuditTimeline.ts` type-imports `AuditEvent` from `audit/AuditProvider`
→ repoint to `audit/contract` (+ its unit test). No `we:plugs/bootstrap.ts` registrations exist for these
families (the apps registered them directly).

## Progress

**Status: DONE 2026-06-17.** All gates green: **vitest 3065 pass / 9 skip, check:standards 0 errors,
check:demos 0 errors, 11ty --dryrun clean.**

Done:
- **Deleted 5 runtime impl files** (kept each `blocks/<f>we:/contract.ts` — the canonical `@webeverything/contracts/<f>`
  surface FUI imports post-#875): `fui:audit/AuditProvider.ts`, `fui:lifecycle/LifecycleProvider.ts`,
  `fui:master-detail/MasterDetailBehavior.ts`, `fui:selection/SelectionBehavior.ts`, `fui:tree-select/TreeSelectBehavior.ts`.
  Each `blocks/<f>/` dir now holds only `we:contract.ts`.
- **`stepper` retained** (grounding correction §1) — `we:wizard/WizardElement.ts` composes `StepperBehavior`
  at runtime and is a kept reference-runtime family (#651/#691); stepper stays as reference-runtime.
- **Deleted 5 family-impl unit tests** (kept `stepper-behavior`, `renderers/audit-timeline`, `wizard`).
- **Repointed** `we:renderers/audit-timeline/renderAuditTimeline.ts` + its test: `AuditEvent` type import
  `audit/AuditProvider` → `audit/contract` (the kept type-half).
- **Deleted the 2 WE-local exercise app dirs** `demos/loan-origination/` + `demos/auto-insurance/` (FUI-hosted
  by #835/#836; their `we:demos.json` entries are `fuiDemoFile` iframe embeds from #837 — left intact).
- **Removed** the two stale `routerDemoFallback` base-path rewrites from `vite.config.mts`.
- **Left untouched** (correct): `fui:blocks.json` family contracts (point to FUI, #657), `we:custom-elements.json`
  (pure projection of `fui:blocks.json` via `gen:cem` — unaffected), `contracts/*.ts`, `we:demos.json` embeds.
- **Doc-rot fix:** `we:docs/agent/demo-workflow.md` note that the two apps moved to FUI.

Leftover noted (not from this work, pre-existing standing warning): #317/#318 epics have all children
resolved and need lifecycle reconciliation now that their apps are fully FUI-hosted — a separate judgment
call (resolve the epics vs slice more), already surfaced by `check:standards`. Not scaffolded here.
