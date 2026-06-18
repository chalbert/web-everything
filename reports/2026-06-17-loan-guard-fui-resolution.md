# Resolving loan-origination's guard dependency when the app moves to FUI (#834)

> Decision-prep report for backlog **#834** (child of the #823 exercise-app move, itself #812 Fork-1(a)).
> This is a **placement/layering call over shipped code**, not greenfield design — so the grounding is
> WE's own ratified precedents (the repo constellation, #694, #700, *impl-is-not-a-standard*,
> *exercise-app-conformance-loop*), checked against the real tree, not an external prior-art survey.

## The concrete situation

The loan-origination exercise app (#317, `demos/loan-origination/`) composes the WE **Guard protocol**
(#288/#289) at two points:

- `we:demos/loan-origination/app.ts:29` — `import { CustomGuardRegistry } from '../../guard/registry'`
- `we:demos/loan-origination/app.ts:99-102` —
  ```ts
  const loanPermissions = new CustomGuardRegistry();
  loanPermissions.define(createLoanGuardProvider(), true);
  (globalThis as …).__loanPermissions = loanPermissions; // exposed for the S10 UI + dev inspection
  ```
- `we:demos/loan-origination/domain/permissions.ts:30-31` — imports the **contract** (`CustomGuardProvider`,
  `GuardContext`, `ALLOW`) from `../../../guard/provider`.

So the app's guard footprint is exactly two modules: **`we:guard/registry.ts`** (the dispatching table) and
**`we:guard/provider.ts`** (the contract types + `ALLOW` + `assertGuardDecision`). It does **not** reference
`we:guard/accessControl.ts` or `we:guard/index.ts`. The registry is *composed and exposed but not yet applied* —
the comment at we:app.ts:101 says the consuming UI (gate a field / flip edit↔read-only) is the future S10
slice; today the registry just proves the seam composes and is there for inspection.

### What the guard model is

- `guard/` is a **closed set with internal deps only** (`we:provider.ts` is a leaf; `we:registry.ts`,
  `we:accessControl.ts`, `we:index.ts` import *only* `we:./provider.js`). No external block/plug imports. This is
  the **same shape that made #694 mechanical** ("the 6 form a closed set — internal deps only … so the
  copies resolve in FUI with no edits").
- It is described in its own header as "a standalone, **dependency-free model of the contract**" — the
  sibling of `CustomValidatorResolution` / `CustomValidityMerge`. The **runtime** form is a separate plug
  at `plugs/webguards/` (extends core `CustomRegistry`, injector-chain). The loan app uses the **standalone
  model**, not the plug.

### Why this breaks on the move

#812 Fork-1(a) → #823 moves loan-origination to FUI, where it composes block-impl families that live only
in `@frontierui/blocks` post-#697. FUI has **no `guard/` dir and no `webguards` plug**, and the
relative import `../../guard/registry` won't resolve there. #823's slice analysis flagged this as the one
WE-only *standard-model* dependency with no FUI home — carved out as this decision.

## Grounding against the ratified architecture

- **Repo constellation** ([[reference_repo_constellation]]): WE (standard) → Frontier UI (impl) →
  plateau-app (product). **There is no cross-repo npm import path, either direction** — #700 (DC-7)
  explicitly ruled *against* building a WE↔FUI import mechanism ("WE has **no** import path to frontierui
  today … net-new infra, a standing drift surface"), choosing FUI-native hosting + iframe embed instead.
  FUI consumes WE-resident impl by **byte-identical copy** (#694), gated content-equal-upstream-first
  (#170).
- **#694 precedent**: migrated 6 single-file WE-only block families (audit/lifecycle/master-detail/
  selection/stepper/tree-select — provider & behavior **classes**, i.e. runnable impl) UP to
  `@frontierui/blocks`, **byte-identical**, WE copies kept. Loan already composes four of these
  (audit, lifecycle, master-detail). The guard registry is one more piece of composed infra alongside them.
- **`impl-is-not-a-standard`** ([[feedback_impl_is_not_a_standard]]): *code that defines a contract /
  conformance → WE; code that delivers a capability (a **registry-dispatching** handler) → FUI.* The
  `CustomGuardRegistry` is a dispatching table (`evaluateRegion` resolves a provider and runs it) — the
  **delivery** side. The genuine standard artifact is the **`protocol:guard` spec** (#288, the
  `/protocols/` discovery page), which stays WE-only regardless of where the runtime module sits.
- **`exercise-app-conformance-loop`** ([[project_exercise_app_conformance_loop]]): the apps exist to
  **dogfood WE standards**; *active-bypass = FAIL*. Loan composing the guard standard is the conformance
  point, not incidental.
- **`npm-scope-mirrors-layer`** ([[project_npm_scope_mirrors_layer]]): `@frontierui` never holds WE
  *standard* artifacts. This is the one principle that pulls against a whole-set copy — see the residual.

## Option analysis

**A — copy the guard closed-set up to `@frontierui/blocks` byte-identical (the #694 + #170 pattern); WE
keeps its canonical copy; the `protocol:guard` spec stays WE-only.** The loan app's import resolves in FUI
unchanged (`../../guard/registry` → the FUI copy). Mechanically identical to #694 (closed set, no external
deps, byte-verified, content-equal-upstream-first). Drift is gated by the same byte-equality check #694
relies on. Merit cost: it places a *contract module* (`we:provider.ts`) in FUI, which brushes against
*npm-scope-mirrors-layer* — see residual.

**B — decouple: inline a minimal registry in loan's domain code.** The app stops importing the WE guard
standard and hand-rolls a tiny table. **Rejected — conformance bypass.** The exercise app's whole purpose
is to dogfood WE standards (*exercise-app-conformance-loop*); replacing a composed WE standard with a
hand-rolled copy is an *active-bypass = FAIL*. It also throws away the S1b work (#687) that wired the real
access-control provider through the standard. This is the broken branch, not a coherent alternative.

**C — FUI imports the WE guard standard cross-repo (npm dep / alias).** Proper layering in the abstract
(standard stays WE, FUI consumes it). **Rejected — excluded by #700.** The constellation has *no*
cross-repo import path and #700 ruled against building one (drift surface, net-new infra); FUI consumes
WE-resident code by copy, not import. Reaching for C here would re-litigate #700.

### The residual — whole-set copy (A) vs contract-split (A′)

The one real tension inside A: `we:provider.ts` carries the **contract** (`CustomGuardProvider`,
`GuardDecision`, `assertGuardDecision`) that *protocol:guard* publishes. *npm-scope-mirrors-layer* says
FUI shouldn't hold WE *standard* artifacts, which argues for **A′**: copy only the dispatch/member impl
(`we:registry.ts`, `we:accessControl.ts`) and keep `we:provider.ts` WE-canonical. But A′ needs the FUI registry copy
to reach the WE contract — i.e. a cross-repo import, which #700 excludes. So A′ collapses back into either C
(excluded) or "copy the contract too" (= A). Given #694 already copies provider/behavior classes (which
embed their type contracts) whole and byte-verifies them, **A is the consistent, drift-gated path**; the
contract's *canonical* home stays WE (the `/protocols/guard/` spec + WE's `guard/` copy), and FUI's copy is
a verified replica exactly like every #694 family. Confidence on A over A′: **med-high (~80%)** — the
residual is that a decider who classifies `we:provider.ts` as a pure standard (not impl) could insist on A′
and accept re-opening the cross-repo question; everything else points to A.

## Recommendation

Ratify **A**. One genuine fork (the registry's FUI resolution), with B and C as named-rejected branches and
A vs A′ as the residual shape question. Mechanically this is a near-clone of #694: extend
`fui:blocks/package.json`'s exports with a `./guard` (or fold under an existing) entry, copy `guard/{provider,
registry,accessControl,index}.ts` + their `__tests__` byte-identical into the FUI tree, verify
`diff -q` clean, WE copies untouched. The build it yields stays `blockedBy` this decision (#836 hosts loan,
already `blockedBy #834`).
