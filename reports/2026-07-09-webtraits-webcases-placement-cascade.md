# webtraits / webcases placement cascade — three surfaces tested against the zero-impl line

**Date:** 2026-07-09 · **Prep session:** `/prepare all` (Cluster 1, #1294 relocation epic) · grounds decisions
**#2298**, **#2299**, **#2300**.

## The question

Three pieces of WE-resident logic each look like *definition* under a purity reading but each **produces or
judges a runtime artifact**, so each may actually sit on the implementation (→Frontier UI) or product
(→Plateau) side of the constellation line. The three are children of the #1294 "relocate WE-resident
logic / reference runtimes" epic:

1. **#2298 `we:webtraits/surfaceIntentResolver.ts`** — maps a `surface` profile (texture/interaction/elevation/
   variant) to CSS. `resolveSurface()` returns structured declarations *with concrete native-default values*;
   `surfaceCss()` wraps them into a selector-scoped ruleset string. #1911 ruled the whole module WE-resident
   as "pure resolver = definition."
2. **#2299 `we:webcases/driftCheck.ts`** — `detectDrift()` computes a mock-vs-real pass/fail verdict. #334 ruled
   webcases the WE verification home; #1566 later ruled "the verifier of an implementation's runtime output →
   out of WE" but never amended #334.
3. **#2300 `we:webcases/generateCase.ts`** — drives an AI propose→verify→compile loop over an *injected*
   `RequirementProposer` (a Plateau-served provider, #475).

The unifying axis: **purity is not the WE/FUI test.** The codified test (`{#constellation-placement}`,
`we:docs/agent/platform-decisions.md:84-89`) routes "delivers a capability at runtime (artifact-producing,
running handler, **native-default strategies**) → Frontier UI" and holds **WE zero-implementation,
contract/protocol/interface only, not even a reference implementation.** `resolveTokens` and `compileToCss`
are *both* pure and *both* relocated to FUI — purity did not save them (`fui:webtheme/tokens.ts`,
`fui:webtheme/compile.ts`; WE's `we:webtheme/contract.ts` is types-only). So each of the three must be tested
against *what it delivers*, not whether it is pure.

## Prior-art / statute survey (the governing rulings, verified)

- **`{#constellation-placement}`** (`we:docs/agent/platform-decisions.md:84-89`): contract/vectors → WE;
  runtime-delivery — *"registry-dispatching, artifact-producing, a running handler — incl. `assert*`,
  constants, engines, **native-default strategies**"* → FUI; served product → Plateau. **"WE holds zero
  implementation … not even as a 'reference implementation.'"**
- **The webtheme precedent (#1294 T2/T5 · #1907/#1910).** The *whole* token runtime relocated to FUI —
  **both** the value-map producer `resolveTokens` **and** the string emitter `compileToCss`
  (`fui:webtheme/tokens.ts`, `fui:webtheme/compile.ts`). WE's `we:webtheme/contract.ts` carries **types only**
  (verified: no exported functions). So the precedent is *not* "a string-emitter relocates" — it is "the whole
  mapping runtime relocates; the contract types stay."
- **#1816** (`{#non-verdict-conformance-matcher}`, `we:docs/agent/platform-decisions.md:421`): pins the
  webtheme *conformance subject* to the `resolveTokens` **map, not the `compileToCss` string.** Scope = *what a
  conformance binding observes*; it does **not** reach a placement question (a scope trap #2298 must not lean
  on — in webtheme *both* map- and string-producer live in FUI, so #1816 cannot authorize "map-producer stays
  WE").
- **#1911** (resolved): built `we:webtraits/surfaceIntentResolver.ts` in WE, justified as "pure resolver =
  definition, same shape as `intentProfileResolver` / `requirementValidator`." **This parity is false**
  (verified): `we:webtraits/intentProfileResolver.ts` returns trait-bundle *metadata / plans* and emits **no
  CSS** (`ResolvedTrait[]` / `BundlePlan`, no `background`/`box-shadow`); `resolveSurface` emits concrete CSS
  declarations. Its true twin is webtheme (FUI). #1911 over-held on the withdrawn purity test.
- **#334** (resolved): "one contract, two uses" (#107 Fork 3) — webcases is the verification home because
  schema-validation ≠ contract-verification; locus = WE (the `mock-contract` protocol #331 is a WE webcases
  project), transport (#332 record mode) is FUI and *injected, never imported*.
- **#1566** (`{#devtools-placement}`, `we:docs/agent/platform-decisions.md:326-342`): **overturns** the earlier
  *"reads output as DATA → stays WE (a verifier implements no standard)"* reading — *"judging is executable,
  and WE holds **zero executable**."* Three-way split: verifier **interface + corpus + schema** → WE; the
  verifier **implementation (the code that judges a running implementation's output) + the run** → **Plateau**
  (neutrality — not FUI the contestant); per-target **binding** → implementer. **Carve-out:** conformance
  tooling a WE `we:check.ts` gate consumes to check **WE's own declarative artifacts, needing no external
  implementation** stays WE — *"#1566 moves only the verifier of an implementation's runtime output, which WE
  cannot run once the impl is deleted."* #1566 never named or amended #334.
- **#475** (`{#no-leakage-client}`, `we:docs/agent/platform-decisions.md:701-706`): any implementation
  capability (vision, **AI inference**) is *never a WE standard*; it is a Plateau service the WE project
  consumes as a **no-leakage client** — only outputs reach the standard, never the capability. The WE corpus
  pipeline (#475+#396) is explicitly a *client that stays WE*.

## Findings, per decision (post-skeptic, post-screen)

### #2298 — relocate the whole surface mapping runtime to FUI (corrects #1911's over-hold)

`resolveSurface()` bakes in **native-default strategies** — the elevation→box-shadow ramp
(`we:webtraits/surfaceIntentResolver.ts:71`), the `blur(12px)` glass fallback, the `translateY(-2px)` lift ramp
— which `{#constellation-placement}:86` routes to FUI **explicitly**. The webtheme precedent moved the
*whole* mapping runtime (map-producer included), not just the string emitter. So the correct cut is **not** the
brace-wrapping seam (surfaceCss-only) but the definition/delivery seam: `SurfaceProfile` / `ResolvedSurface` /
`CssDeclaration` **types** + the `surface` intent + a (to-author) surface conformance-vector corpus stay WE;
`resolveSurface` + `elevationShadow` + `declarationsToCss` + `surfaceCss` relocate to FUI beside webtheme.
FUI imports the WE types; nothing in WE imports back (no WE→FUI edge). **This corrects #1911's over-hold** —
reconciliation, not collision: #1911's ruling stands for *the presentation intent being WE-owned*; the
*executable value→CSS map* was mis-kept on a purity test #1282 withdrew.

- Skeptic verdict: **the naive "surfaceCss-only split" was REFUTED** — cutting only the string wrapper leaves
  the native-default strategies (the real delivery decisions) in WE.
- Screen verdict: **CLEAR** — contract-visible (WE's export surface changes) and merit-bearing (zero-impl
  boundary over concrete CSS values).

### #2299 — relocate the executable verifier out of WE; WE keeps the drift contract

`detectDrift(expected, actual)` (`we:webcases/driftCheck.ts:97`) judges a **recorded real-service response** —
*an implementation's runtime output by construction* (`we:webcases/driftCheck.ts:22`). #1566 **overturned
exactly this pattern** ("reads output as data → stays WE") and the WE carve-out is narrow — *WE's own
artifacts, no external implementation*; driftCheck's whole purpose is catching drift against **current external
reality**, so it fails the carve-out. #334 is the pre-#1566 ruling and was never reconciled. **Reconciliation:**
#334's residual — the `DriftFinding` taxonomy + `ContractResponse`/`RecordedResponse`/`DriftReport` types + the
*structural-not-value* drift rule (`we:webcases/driftCheck.ts:16-19`) + the #331 mock corpus — stays WE as the
conformance *contract*; the executable `detectDrift`/`diffShape` verifier relocates. **Live counter (keeps (a)
on the table):** the drift genre is *mock-vs-its-own-backend realism*, not WE-standard conformance — the
recorded response is the app's backend, not a WE-standard implementer — so a decider could judge #1566's scope
doesn't reach it and #334 stands. That genre call is the crux.

- Skeptic verdict: **stays-WE default REFUTED** (on #1566's overturned-pattern + failed carve-out).
- Screen verdict: **CLEAR** — contract-visible and a live layer-ownership merit (#334 vs #1566).

### #2300 — stays WE (contract-derived, not a genuine fork); one build residue

`generateCase()` is a **no-leakage #475 client**: the AI proposer is injected (`we:webcases/generateCase.ts:37`),
imports no SDK; the artifact-producer is the *deterministic* WE-owned `validateRequirement` (#100) +
`compileRequirement` (#797) (`we:webcases/generateCase.ts:81-87`) — only the proposer's *output* reaches the
standard. #475 keeps the *capability* out (honored by the seam) and explicitly keeps the output-consuming
pipeline in WE. The two-confusion screen found the injected seam **erases every merit axis** between "loop stays
WE" and "loop → Plateau" (correctness identical, dependency-direction clean both ways, zero lock-in) — so this
is **not a genuine fork**; it is **contract-derived: stays WE.** The one real residue is a build task, not a
fork.

- Skeptic verdict: **SURVIVES-WITH-AMENDMENT** — `heuristicProposer` (`we:webcases/generateCase.ts:103`) is a
  concrete `RequirementProposer` implementation shipped/exported from the WE production module, consumed only by
  tests. It is a #1282 zero-impl nick and blurs the injected-only seam. **Amendment / carved build residue:**
  relocate `heuristicProposer` to the test fixture (its only consumer) or a FUI offline-demo module.
- Screen verdict: **FLAGGED(prio) → dissolved** to a contract-derived ruling (stays WE) + the separately-
  prioritized build residue above.

## Net

Only **#2298 relocates** (the whole surface mapping runtime → FUI) — the item that "unblocks the mechanical
5-slice cascade." **#2299** recommends relocating the executable verifier (FUI co-located, or Plateau by strict
#1566) while WE keeps the drift contract, but leaves the genre-exemption as the decider's crux. **#2300** is a
near-instant ratify (stays WE) plus a small `heuristicProposer`-relocation build task. All three reconcile a
prior ruling (#1911, #334, #475 respectively) rather than colliding with it.
