# #817 — Constellation placement of `guard/` + `validity-merge/` + `validator-resolution/` (prep artifact)

**Date:** 2026-06-16 · **Decision:** [#817](../backlog/817-constellation-placement-of-guard-validity-merge-validator-re.md) · **Blocks:** #725 (FUI port of `webguards`/`webvalidation`) · **Sibling prep:** [#730](2026-06-16-730-capability-manifest-validation-generation-placement.md) · **Parent:** #170

This is a **placement-of-shipped-code** decision: all three subsystems already exist in `webeverything/`;
the call is which constellation layer (`@webeverything` standard vs `@frontierui` impl) owns each before
#725 copies the plug. No greenfield design → **no web/prior-art survey** (per *backlog-workflow.md → a
decision that only ratifies shipped code skips the web survey but still needs the concrete-refs check*).
The grounding is the real import closure classified against #730's already-ratified axis: **code that
*defines* a contract → WE; code that *implements/generates against* it → FUI** — read against #463
(neutral-contract SoT → WE, generation adapters → FUI), #649 (plugs are impl, port DOWN), #266/#212/#214
(these planes are dependency-free contract models), and native-first (the shipped default *is* the standard).

## The finding that reshapes the fork

The item was authored with a **B1-split** default ("provider/registry → WE; concrete strategy/runtime impl
→ FUI"), reasoning by analogy to #730's *validation-generation* split. **The per-plane verification below
flips that.** #730 split `validation-generation` only because it carried a genuinely separable impl half —
the per-language `adapters/{zod,pydantic,jsonSchema,nativeHtml}` emitters (510 LOC) that *generate against*
the contract. It ruled `capability-manifest` **A1 (whole → WE)** precisely *because* it is "structured
exactly like the `validity-merge` (#212) / `validator-resolution` (#214) planes" and warned that splitting
its lone runtime file off "would **fork the #266 plane and break the validity-merge / validator-resolution
precedent**" ([#730 report §`capability-manifest`](2026-06-16-730-capability-manifest-validation-generation-placement.md)).

So #730 already treats the three planes #817 covers as the **A1 archetype** — capability-manifest was held
whole→WE *by analogy to them*. Reading them as B1-split inverts the precedent they anchor. And the file-level
evidence confirms it: **none of the three contains a `validation-generation`-style separable emitter.** What
the B1 default wanted to port to FUI ("concrete strategy/runtime impl") is, on inspection, two things that
the #730 precedent keeps in WE:

1. **The native-first default strategies** (`NativeGuardProvider`, `SourceReductionStrategy` /
   `LastWriteWinsStrategy`, `VersioningResolution` / `CancellationResolution`) — interwoven with the contract
   types *inside* `we:provider.ts`. By native-first these defaults *are* the standard's behaviour; splitting them
   to FUI forks `we:provider.ts` mid-file, the same cost #730 declined for `we:cel.ts` ("splitting a 241-line file
   mid-function costs more than it buys").
2. **The reference runtimes** (`ValiditySourceOrchestrator`, `AsyncValidationRunner`) — dependency-free
   mechanism (auto-stamp generation tokens, drive an async check, enforce the surface guard); **no fs / net /
   transport / host**. These are the structural twins of capability-manifest's `we:guard.ts` (dev warner) /
   `we:check.ts` (build gate) — reference tooling #730 kept in WE as "part of the spec, not the plug runtime."

The thing that *implements against* the contract and ports to FUI is the **plug** (`plugs/webguards`,
`plugs/webvalidation`) — the `CustomRegistry`-extending runtime DI wiring — which is exactly what #725 already
ports. The standalone plane models stay WE.

## Per-plane classification (the per-fork pass, applied)

**Q1 (which layer?)** is decisive and uniform across all three. The standing separate+decouple bias does
**not** bite (burden-of-proof-on-combining doesn't apply to planes that were never two things): each is one
cohesive spec plane, like capability-manifest.

### `guard/` (#288/#289 guard-protocol provider+predicate seam) — imported by `we:plugs/webguards/index.ts:23-31`

| file | LOC | role | layer |
|---|---|---|---|
| `we:provider.ts` | 121 | `GuardRegion`/`GuardEvent`/`GuardDecision` surface + `assertGuardDecision` trust-boundary guard + `NativeGuardProvider` (permissive native default) | **WE** |
| `we:registry.ts` | 96 | `CustomGuardRegistry` swap point + `evaluateRegion` (validates the crossing answer) | **WE** |
| `we:accessControl.ts` | 132 | #178 access-control member intent — restates the ratified design (types + pure `resolveDenyOutcome`/`evaluateAccess`), built *on* the seam, not a new contract | **WE** |
| `we:index.ts` | 20 | default wiring barrel (`createDefaultRegistry`) | **WE** |

No separable emitter. The only "impl" is the permissive `NativeGuardProvider` (native default). **Whole → WE (A1).**

### `validity-merge/` (#212 strategy plane) — imported by `we:plugs/webvalidation/index.ts` (`:17,:18,:19,:24,:25,:52,:57`)

| file | LOC | role | layer |
|---|---|---|---|
| `we:provider.ts` | 206 | `MergedValidity` surface contract (#004 OP-1) + `assertMergedValidity` guard + `SourceReductionStrategy` (native default) + `LastWriteWinsStrategy` | **WE** |
| `we:registry.ts` | 120 | `CustomValidityMergeRegistry` swap + `ValiditySourceOrchestrator` (auto-stamp reference runtime, dependency-free) | **WE** |
| `we:index.ts` | 24 | default wiring (`createDefaultRegistry` / `createDefaultOrchestrator`) | **WE** |

Both shipped strategies are native-first defaults, not third-party emitters. **Whole → WE (A1).**

### `validator-resolution/` (#214 async-resolution plane) — imported by `we:plugs/webvalidation/index.ts` (`:19,:20,:23,:24,:34,:40`)

| file | LOC | role | layer |
|---|---|---|---|
| `we:provider.ts` | 161 | `ResolvedSource` cross-plane contract + `assertResolvedSource` guard + `VersioningResolution` (native default) + `CancellationResolution` | **WE** |
| `we:registry.ts` | 136 | `CustomValidatorResolutionRegistry` swap + `AsyncValidationRunner` (reference runtime; no host/transport) | **WE** |
| `we:index.ts` | 24 | default wiring (`createDefaultRegistry` / `createDefaultRunner`) | **WE** |

Same shape. **Whole → WE (A1).**

## Net placement

- **→ WE (standard):** all of `guard/` (4 files), all of `validity-merge/` (3 files), all of
  `validator-resolution/` (3 files). Each gains **one new `@webeverything/*` export** — a
  capability-manifest-style **single `.` barrel** (`"." : "we:./index.ts"`), *not* validation-generation's
  curated-subpath list, because nothing is excluded. The barrel-vs-subpath export shape is the clean A1-vs-B1
  tell (cf. `we:capability-manifest/package.json` `"."` barrel vs `we:validation-generation/package.json` excluding
  `crossField`/`adapters`/handler).
- **→ FUI (ports with the plug):** **nothing from these three.** Only the plugs (`plugs/webguards`,
  `plugs/webvalidation`) port — already #725's job — importing the three WE-resident contracts.
- **Future:** if a plane later grows a concrete *third-party* emitter (a non-default merge strategy shipped as
  a library, a server-consulting guard provider), *that emitter* ports to FUI then, a small #725-style
  follow-up. None exists now.

## Export-surface delta (the #814-style follow-up once ruled)

Three new `we:package.json` + `exports` maps, mirroring #814, each a single `.` barrel:
`@webeverything/guard` → `we:guard/index.ts`, `@webeverything/validity-merge` → `we:validity-merge/index.ts`,
`@webeverything/validator-resolution` → `we:validator-resolution/index.ts`. Then #725 resumes, importing the
contracts and copying none of the three.

## Confidence

- **High** — interface + registry + assert-guard of each plane → WE (textbook neutral-contract SoT; the bulk).
- **Med-high** — the *whole* plane stays WE (A1), i.e. native-default strategies + reference runtime ride with
  the contract rather than cleaving to FUI (B1). The residual: a decider weighting *impl-is-not-a-standard*
  could carve the native-default strategy classes to FUI as "impls that satisfy the standard." That is the
  red-team to answer at ratify — rebutted here by (a) the #730 capability-manifest precedent these planes
  anchor, (b) native-first (the shipped default *is* the standard), and (c) the mid-file fork cost #730 itself
  declined for `we:cel.ts`.
