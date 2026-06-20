---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
relatedProject: webvalidation
tags: [constellation-placement, conformance, reference-runtime, webpolicy, frontierui]
---

# WE holds zero implementation — withdraw the reference-implementation tier (the WE project is contract / protocol / interface only)

**Ratified 2026-06-20.** The rule lives in the decision doc —
`we:docs/agent/platform-decisions.md#constellation-placement`: *"WE holds zero implementation —
contract / protocol / interface only."* This item is the deliberation + lineage; the **doc is the
source of truth** for the rule.

## Ruling

The WE **project** holds **contract + protocol + interface + conformance vectors (data)** — and the one
runtime-ish exception of conformance *tooling* a WE-side `we:check.ts` gate consumes (it *checks*, it does
not *deliver*). **No delivery runtime, not even as a "reference implementation."** The
reference-implementation tier (#1078) is **withdrawn**: it conflated the WE *website* with the WE
*project*. A conformance demo is a **website** artifact — the WE-docs site is a downstream consumer that
*surfaces FUI* (mode-C runtime bundle / `fuiDemo` iframe), so it exercises FUI's runtime, never a
WE-project copy.

**Supersedes the #1078 ruling because** #1078 kept delivery runtime in WE on a *website* concern
("the conformance demo needs something real to run"); that concern is met by the website surfacing FUI,
so the WE-project copy was never warranted. This restores the long-standing rule (WE = contract /
protocol / interface) that #817 already stated ("no implementation stays in WE") and that #1078 had
punched a hole in. Generalises #1246 (which applied it to rendered-UI blocks) to all delivery runtime.

## Scope split — the rule vs the relocation (this is what makes it ratifiable today)

- **The rule is ratified now** (above): WE = zero implementation; **no _new_ WE-resident delivery
  runtime may be added** under any justification.
- **The physical relocation of what already violates it is gated downstream work, not done today.** A
  skeptic pass (2026-06-20) confirmed: FUI has **no** webpolicy home yet, the #899 vector-runner is
  **designed but not built**, and the webpolicy demo runs WE runtime via a build-time local import — so
  the ~10 pre-existing logic runtimes **cannot move today without stranding conformance proof**. They
  therefore stay put **as tracked debt under the rule**, *not* as a sanctioned tier — relocation epic
  **#1294**, parked on (a) a FUI home and (b) a working headless-logic surface-FUI path / the #899
  runner. The honest interim is recorded in the doc's rule-1 *Interim state* clause.

> Red-team (skeptic sub-agent, 2026-06-20): the *wholesale physical withdrawal today* does NOT survive
> (no FUI landing zone, #899 unbuilt, live local import, DoD needs a runnable proof). The ruling above
> answers it by **separating the rule from the relocation** — ratify the rule, gate the move — rather
> than pretending the move can happen now.
