---
kind: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Reconcile partial-impl standards' status (weblifecycle / webaudit / webdecisions)

weblifecycle (we:blocks/lifecycle/contract.ts), webaudit (we:blocks/audit/contract.ts), and webdecisions (we:blocks/renderers/decision-trace) each have a contract/render stub but no full runtime/provider, yet are still tagged status:concept. Decide per standard: complete the implementation, or correctly relabel as contract-only. Update we:src/_data/projects.json status accordingly.

## Outcome (batch-2026-06-18)

The task premise ("contract/render stub but no full runtime/provider") is **stale** — each already has a
working impl with passing unit tests in FUI. Verified actual state:

- **weblifecycle** — WE `we:blocks/lifecycle/contract.ts` + FUI `fui:blocks/lifecycle/LifecycleProvider.ts`
  + `fui:blocks/lifecycle/AttributeLifecycle.ts` + 2 unit tests (lifecycle-provider, attribute-lifecycle).
- **webaudit** — WE `we:blocks/audit/contract.ts` + FUI `fui:blocks/audit/AuditProvider.ts` + 1 unit test.
- **webdecisions** — schema-only contract *by design* (the `DecisionRecord` shape is the lock, no provider
  intended); its renderer `we:blocks/renderers/decision-trace/renderDecisionTrace.ts` + a unit test exist.

So the right call per standard is **relabel, not "complete impl"** — each has working code beyond a stub.
Relabeled all three `concept → poc` in `we:src/_data/projects.json` (poc is the project-status ceiling and
the tier the core standards like Injectors/Components sit at; these have providers/renderer + tests, so
`concept` understated them). No build item surfaced — the impl that justifies `poc` already exists; deeper
conformance/productization is the general concept-to-built gap tracked by #991/#998, not a per-standard
slice here.
