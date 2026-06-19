# How the FUI polyglot panel consumes WE-side artifacts — source forms + conformance verdicts

**Date:** 2026-06-18 · **Item:** [#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/) ·
**Blocks:** [#818](/backlog/818-author-mode-emit-foundation-wire-an-output-tabs-author-mode-o/) · [#913](/backlog/913-polyglot-panel-per-target-conformance-badges-from-the-determi/) ·
**Precondition (resolved):** [#956](/backlog/956-decide-module-service-serve-form-generation-placement-we-ref/) = A ·
**Class:** ratify-existing-internal-ground (no new `/research/` topic — see *Why no research topic*).

## Why no research topic

This is a *constellation-boundary* decision, the same posture as [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/),
[#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/) and the just-resolved
[#956](/backlog/956-decide-module-service-serve-form-generation-placement-we-ref/): the prior art is *prior
rulings*, not the external ecosystem. The external survey the polyglot-handoff question needs was already
run for #855 — its [report](2026-06-17-we-fui-wrapper-handoff.md) / [research topic](/research/we-fui-wrapper-handoff/)
found framework codegen is a **build-time artifact of the source library, published for the consumer to
read** — *no shipping tool generates in the consumer*. The boundary rules are equally settled: #700
(unidirectional WE→FUI; only data crosses, never impl), #707 (FUI may not import WE impl), #872 (the
type-only published-package end-state), #891 (the generator-agnostic conformance runner). #954 only
*applies* those ratified rules to the panel's two consume seams, so it skips the web survey and does the
concrete-refs check instead.

## What #956 settled (the precondition)

#954's source-form half was conditional on #956. #956 resolved **A**: `serve()` and its form-generators
**stay WE reference-runtime** (the #791 `renderers/jsx` keeper), and `@webeverything` publishes **neither**
them nor the rendered output — they are repo-internal reference runtime. Consequence for #954: the FUI
workbench **cannot** import `serve()` (it is WE-internal, unpublished, and #707 forbids the cross-repo impl
import). The source-form half does **not** dissolve — the boundary is real — so the panel must consume
`serve()`'s *output*, not its code.

## Grounding (traced to the tree)

- **`serve()` returns pure data.** `serve(definition, {form})`
  ([`we:moduleService.ts:142`](../blocks/renderers/module-service/moduleService.ts#L142)) returns a
  `ServeResult { form, code, language, lossy, diagnostics }`
  ([`we:moduleService.ts:67`](../blocks/renderers/module-service/moduleService.ts#L67)) over the `FORMS`
  catalog ([`we:moduleService.ts:51`](../blocks/renderers/module-service/moduleService.ts#L51)) that
  already drives the demo's form toggle. The output is serializable text + diagnostics — a committable
  artifact.
- **The #506 cross-language gate already commits verdict data.** The dir
  `we:blocks/renderers/module-service/conformance/` holds the committed
  `we:blocks/renderers/module-service/conformance/golden.json` plus its generator/runner/vector siblings —
  a WE-computable, already-committed verdict surface.
- **But #891's behavioral runner needs a live subject WE never sees.** `runVectors(subject, vectors)`
  ([`we:wrapper-conformance/runner.ts:163`](../wrapper-conformance/runner.ts#L163)) requires a
  `WrapperSubject` ([`:37`](../wrapper-conformance/runner.ts#L37)) — a *mounted* wrapper instance. The
  runner's own header is explicit: "FUI owns the generator and implements one subject per framework." The
  behavioral verdict is a function of **FUI's own `genWrapper` output** (`fui:tools/gen-wrapper/genWrapper.ts`),
  which WE never observes. There is **no WE-side verdict to emit** for this one.

## The finding that reshapes the fork — two natures, not one mechanism

The item framed *one* fork ("one mechanism for both artifact types"). Tracing the two artifacts shows they
have **different natures**, so the "one channel for both" framing is the thing to reject:

1. **Deterministic WE outputs** — `serve()` source forms (#818) and the #506 cross-language verdict (#913
   part 1). WE can compute these from a `<component>` definition alone, with no FUI input. → emit as
   **committed data** the panel reads. The alternative (FUI ports `serve()` like it ported `genWrapper`)
   is **broken**: it reverses #956's just-ratified keeper, duplicates the WE transform/`FORMS` set with
   divergence risk, and #707 forbids re-importing the relocated copy. Publishing a consumable (option C) is
   heavier than "rides what already ships" for output that is cheap to emit and gated on the #872 pipeline.

2. **FUI-dependent verdict** — the #891 behavioral wrapper-conformance badge (#913 part 2). Pure data-emit
   is **impossible**: WE cannot emit a verdict for a wrapper instance it never sees. The runner is a
   WE-owned **standard artifact** (#855 B2 — ~165 lines of pure DOM logic importing no FUI), but it must
   **execute FUI-side** against FUI's live subject. The standard `vectors` cross as data; the runner's
   packaging *rides #872* (published `@webeverything`-scoped consumable end-state, byte-replication the
   #694/#170 interim) — #954 only fixes *that the runner runs FUI-side*, not how it is packaged. This badge
   needs a **mounted** subject → it is downstream of #912 (the live-test sandbox), not just #753.

## Demand-gate (#818) still stands

#818's bold demand-gate — *build the idiomatic-source author mode only after appetite is shown* — is
independent of placement and survives. #753 shipped consume-mode source tabs; whether *idiomatic-source*
appetite is now demonstrated is a decision-time user call. The data-emit foundation is cheap enough to ride
the existing emit channel **when** appetite shows; do not build ahead of it.

## Recommended path (for the decision turn)

| Seam | Recommended | Excluded branch |
| --- | --- | --- |
| `serve()` source forms (#818) + #506 verdict (#913a) | **Data-emit** — WE commits `{code,language,lossy,diagnostics}` + verdict JSON; panel reads | FUI ports `serve()` (reverses #956, #707-blocked); publish package (over-engineered, #872-gated) |
| #891 behavioral badge (#913b) | **Vectors cross as data; runner runs FUI-side** against FUI's live subject; packaging rides #872; gate on #912 | Pure data-emit (impossible — no WE-side verdict); full FUI fork-and-diverge (breaks standard-artifact ownership) |

Both forks are **forced invariants** (one branch is broken/impossible), not open A/Bs — the decision turn's
skeptic pass should attack (a) whether a committed-artifact build-step is really lighter than the #872
publish it would otherwise wait on, and (b) whether #913 should split the cheap #506-verdict badge from the
#912-gated behavioral badge (bias-toward-separation says yes; it is a slice call, not part of this ruling).
