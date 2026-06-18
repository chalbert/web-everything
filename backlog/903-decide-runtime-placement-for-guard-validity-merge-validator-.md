---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-903-guard-validity-validator-runtime-placement-recheck.md
tags: [constellation, plugs, port, frontierui, standard-impl-boundary]
---

# Decide runtime placement for guard / validity-merge / validator-resolution given WE plugs consume the runtime (#817 B1 premise false)

#893 pre-flight (batch-2026-06-17) found #817 B1's *stated premise* false. #817 B1 ruled the runtime half
of `guard/`, `validity-merge/`, `validator-resolution/` ports to FUI, justified by *"these three planes
have no `we:check.ts`-style WE-side gate, so nothing WE-side consumes the runtime."* But WE's own plugs
import the **runtime values** of all three planes. This decision re-checks whether that false premise
overturns the **placement** (keep runtime WE) or only the **execution** (placement stands; the carve must
co-land with the plug port). It is placement-of-shipped-code — no web survey; the grounding is the
per-consumer trace in [the prep report](../reports/2026-06-18-903-guard-validity-validator-runtime-placement-recheck.md)
(linked via `relatedReport`, same category as #730/#817). Blocks #893.

## Prepared — grounding digest

**The premise is true as a fact** (verified 2026-06-18 — class/function/const imports, not `import type`):
- `we:plugs/webguards/index.ts:26-31` → `NativeGuardProvider`/`GuardDecisionError`/`assertGuardDecision`/`ALLOW`
  (`we:guard/provider.ts`) + `CustomGuardRegistry`/`UnknownGuardProviderError` (`we:guard/registry.ts`);
  `we:plugs/webguards/CustomGuardRegistry.ts:16-24` likewise.
- `we:plugs/webvalidation/CustomValidityMergeRegistry.ts:15-19` → `SourceReductionStrategy`/`LastWriteWinsStrategy`/`UnknownStrategyError`;
  `…we:/CustomValidatorResolutionRegistry.ts:17-20` → `VersioningResolution`/`CancellationResolution`/`UnknownResolutionError`;
  `…we:/AsyncValidatorField.ts:23-24` + `we:ValidityMergeField.ts:24` → `AsyncValidationRunner`/`ValiditySourceOrchestrator`;
  `…we:/index.ts:28-57` re-exports the whole runtime vocabulary; `we:plugs/bootstrap.ts:37-38` wires it.

**But every value-consumer is FUI-bound — there is no *staying* WE consumer.** The complete WE-side
value-consumer set is: (1) the `webguards`/`webvalidation` plug impls, (2) `we:plugs/bootstrap.ts` wiring,
(3) the planes' impl-coupled `__tests__`, (4) the demos — which import the **plug**
(`we:demos/validator-resolution-demo.ts:15-20`, `we:validity-merge-demo.ts:14` is `import type`), not the
runtime planes directly. No WE conformance gate or other WE standard artifact consumes the runtime. And
(1)–(4) are all slated to leave WE: plugs are FUI-owned impl (#606) ported by #649(resolved)/#725; #817
already routes impl-coupled `__tests__` to FUI; the plug demos ride with the plug (FUI owns rendered
display, per the docs-rendering boundary).

**The capability-manifest contrast that settles it.** #730 kept `capability-manifest/` whole in WE not
because "some WE file imports it" but because `we:capability-manifest/check.ts:72` — a build-time
**conformance gate** that *defines* conformance and **stays** WE — consumes `assertCapabilityManifest`.
The three planes fail that test on both prongs: a plug is *delivery* (`we:guard/provider.ts:2` self-labels
"the **runtime-impl half**"; `we:guard/registry.ts:7` = "one shared, injectable service every region
delegates to" — an app engine), not conformance definition; **and** the plug is ratified to *leave*
(#649/#725), unlike we:check.ts which stays. So the #730 anchor does not bite here.

## The axis

One axis: **is a WE plug consuming this runtime a *staying* WE-side anchor (keeps it WE, like
capability-manifest's we:check.ts) or a *FUI-bound delivery* consumer (about to leave, so it does not anchor
anything)?** The clean `we:contract.ts | we:provider.ts+we:registry.ts` seam #817 found is unchanged and present in
all three planes (`we:guard/contract.ts:2`, `we:validity-merge/contract.ts:2`, `we:validator-resolution/contract.ts:2`
each self-label "the **pure-contract half**"; `we:guard/provider.ts:2` the "runtime-impl half"). The only
contested question is whether the plug import re-classifies the runtime as WE-anchored. It does not: the
plug is impl that leaves, not a conformance gate that stays. #817 B1's placement therefore stands; only
its premise *wording* was loose (should read "no WE-side artifact **that stays in WE** consumes it").

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 — does the false premise reverse #817 B1's placement? | **A — No. Keep #817 B1: runtime → FUI. The premise wording was loose; every WE-side consumer is the FUI-bound plug, not a staying conformance gate, so nothing *that stays in WE* consumes the runtime.** | B — keep the runtime WE for these three planes as #817 exceptions (reverses #817 B1 on a we:check.ts↔plug mis-analogy) | **~82%** |

**Supported by default (not a fork — no coherent alternative exists):** the runtime carve (#893) must be
**one atomic relocation co-landed with the plug port (#725)** — plugs + `we:provider.ts` + `we:registry.ts` +
impl-coupled `__tests__` (+ plug demos) leave WE together, leaving only `we:contract.ts`. Fold #893 into #725
(or hard co-land) and **drop the backwards `#893-blocks-#725` edge**. There is no staged ordering that
keeps WE→FUI clean (see Fork 2), so this is a forced invariant, not a choice.

## Fork 1 — Does the false premise reverse #817 B1's placement (B/C), or only its premise wording (A)?

**Fork-existence:** B and C are *coherent ideas* but both **break a constellation invariant**, so exactly
one branch (A) is correct. B forces either a #649 reversal (WE permanently ships plug impl) or a runtime
leak into `@webeverything` (a FUI-resident plug importing WE runtime *values* — violates "standard
artifacts only", #239). C is the dual-source-of-truth drift #170/#694/#649 exist to kill. So this is a
real fork with A correct, not a support-both.

- **A — keep #817 B1; runtime → FUI (recommended default).** The premise was *worded* wrong, not
  *concluded* wrong. The #730 test that keeps a runtime in WE is "a WE artifact that **defines
  conformance and stays** consumes it" (`we:capability-manifest/check.ts:72` consuming
  `assertCapabilityManifest`). The three planes have no such gate (no `*/check.ts`, verified); their only
  runtime consumers are the plug impls + wiring + impl-tests + demos, *all* FUI-bound (#606/#649/#725).
  A consumer that **leaves** does not anchor the runtime in WE. So `we:contract.ts` (types) → WE; all of
  `we:provider.ts` + `we:registry.ts` + impl-`__tests__` → FUI, exactly as #817 ruled. *Why it wins:* it is the
  only reading consistent with #730's actual *holding* (define-vs-deliver per symbol; it split `we:service.ts`
  mid-file, sending the running dispatcher to FUI) and with #649 (plugs are impl, port DOWN). It costs only
  a one-line premise correction in #893, not a reversal.

- **B — keep the runtime in WE for these three planes as #817 exceptions (excluded).** The #903-as-filed
  lean (~70%). *Excluded* because it conflates two different consumers: capability-manifest's `we:check.ts`
  is a WE-side **conformance gate** that *stays* and *defines* conformance — the plug is **impl that
  leaves** (#606/#649/#725). Treating a transient FUI-bound impl-consumer as a permanent conformance
  anchor reverses #817 B1 on a mis-read of the #730 test (the same dictum-vs-holding error #817's own
  skeptic pass corrected). And it cannot be executed cleanly: once #725 lands, the FUI-resident plug would
  have to import the WE-resident runtime *values*, forcing `@webeverything` to publish runtime — the exact
  npm-scope-mirrors-layer (#239) violation B was meant to avoid. B is only live if #649 is *also* reversed
  (webguards/webvalidation stay WE by design) — a larger, separate call out of #903's scope.

- **C — byte-replicate the runtime into FUI (#170/#694 interim) so both copies exist (excluded).**
  *Excluded:* dual source of truth for runtime impl — the precise drift #170/#694/#649 were opened to
  eliminate — and there is no FUI `webguards`/`webvalidation` plug yet to hold the copy (verified: no
  `guard`/`valid*` dir in `../frontierui/plugs/`). Interim replication is a migration *bridge* (#694), not
  an end-state placement, so it does not answer the placement question this fork asks.

**Red-team the default (for the deciding agent's skeptic pass).** Attack A by arguing the plug *is* a
legitimate WE consumer right now, so the runtime is WE-consumed today. Rebuttal grounded in the tree: the
test is not "consumed today" but "consumed by an artifact that *stays* and *defines conformance*" — #730
kept capability-manifest WE precisely because we:check.ts (a staying build gate) needs the assert, and #817
sent these planes' runtime to FUI precisely because no such staying gate exists (re-verified: no
`*/check.ts`). The plug is delivery that leaves. If the skeptic instead attacks the *premise* ("then #817
B1's sentence was just wrong") — agreed, and that is exactly fork A: correct the wording, keep the
placement. High-leverage residual to flag: A silently assumes #649/#725 (plugs → FUI) still holds; if the
deciding turn wants to reopen *that*, B becomes live and this fork should be re-run against a reopened #649.

## Fork 2 — N/A (collapsed to "supported by default")

Originally a candidate second fork — "fold #893 into #725" vs "keep #893 separate but sequenced." It is
**not a fork**: no staged ordering keeps WE→FUI imports legal. #893-first (runtime → FUI, plugs still WE)
breaks WE (WE imports FUI). #725-first (plugs → FUI, runtime still WE) forces `@webeverything` to export
runtime values (#239 violation). Only the atomic co-land works, so it is a forced invariant recorded under
"Supported by default" above, not a choice with two legitimate end-states.

## Unblocks

#893 (`blockedBy: 903`). On ruling A: #893 keeps its B1 scope but is re-shaped as a co-landed/folded step
with #725 (atomic relocation), and the backwards `#893-blocks-#725` edge is dropped. #725 then ports the
plugs + the runtime half together in one WE→FUI-clean change, leaving only `we:contract.ts` (+ its
`@webeverything/*` export) in WE.

## Context

### Lineage

Reconsiders #817 B1 *for these three planes* (reversible per ratified-decisions-are-reversible). #817's
own skeptic pass (2026-06-17) already flipped it from a prepared A1 to B1 on the define-vs-deliver holding
of #730; #903 confirms B1's *placement* survives the false-premise finding and localizes the defect to
#893's execution ordering. Grounding rulings — all resolved: **#730** (capability-manifest stays WE via
its we:check.ts consumer; define-vs-deliver per symbol), **#649** (plugs are impl, port DOWN to FUI),
**#606** (plugs = FUI-owned implementation), **#239/#170/#694** (npm-scope-mirrors-layer; `@webeverything`
= standard artifacts only; byte-replication is interim only), **#817 B1** (the ruling under review).
