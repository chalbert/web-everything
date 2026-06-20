# Cases-to-test bridge: reuse the #899/#1176 conformance-vector driver, or a separate WE-side mechanism

> Prep research for decision [#1233](/backlog/1233-decide-cases-to-test-bridge-reuses-the-899-1176-conformance-/).
> Surveyed the executable-specification "glue/fixture" prior art (Cucumber, Concordion) plus the
> already-built in-repo machinery (#899 vector schema, #1176 FUI driver, the webcases compiler), then ran
> the constellation rulings over the stated fork. Outcome: the stated "reuse vs separate" call collapses to
> **two forced invariants + one genuine residual fork** (the bridge's *checking semantics*).

## The question

`we:webcases/compileRequirement.ts` already *produces* a directive — embedded in a compiled webcase's
HTML — naming what to check:

```
<!-- assert: protocol="validator-resolution" observe="async-result" tier="L2" kind="event" -->
```

…but **nothing consumes it** ([we:webcases/compileRequirement.ts:72-82](../webcases/compileRequirement.ts#L72-L82)).
The "case-to-test bridge" is whatever turns that directive into a pass/fail against a live component: parse
the directive + the `WEB CASE` Given/When/Then, drive the component, read the named observable at its tier
(read-a-state when `kind="state"`, await-an-event when `kind="event"` — the `kind` token added by #1201),
and judge.

That runtime job — mount + dispatch action verbs + advance a clock + read an observable surface — is
**exactly** what the #899/#1176 conformance-vector driver already does
([fui:tools/explorer/oracles/conformanceVectors.ts](../../frontierui/tools/explorer/oracles/conformanceVectors.ts):
`runConformanceVector` + `judgeConformanceTrace` + `ConformanceBinding` + `VirtualClock`). So #1162 (which
is blocked on this) needs the call: **reuse** that driver, or build a **separate WE-side mechanism**?

## What already exists (not greenfield)

| Artifact | Home | What it is |
|---|---|---|
| `<!-- assert: protocol/observe/tier/kind -->` directive | WE (`we:webcases/compileRequirement.ts`) | Produced by the requirement→webcase compiler; **no consumer yet** |
| `ConformanceVector` / `ConformanceStep` / `ConformanceExpectation` / `ConformanceVectorSuite` + `assertConformanceSuite` | WE (`we:conformance-vectors/schema.ts`) | Build-agnostic declarative vector **shape** + structural validator (#1016) |
| `runConformanceVector`, `judgeConformanceTrace`, `ConformanceBinding`, `ConformanceVectorOracle` | FUI (`fui:tools/explorer/oracles/conformanceVectors.ts`) | The runtime **driver**: sequences (timed) steps on a binding, records a trace, judges it (#1176, #899 Fork-1 default A) |
| `VirtualClock` (`now/setTimeout/tickAsync/runAll`) | FUI (`fui:tools/explorer/oracles/virtualClock.ts`) | The #899 clock-verb-contract impl |
| `@webeverything/conformance-vectors/schema` path-map | FUI `fui:tsconfig.json:68` | The **type-only seam** — WE vector types already cross to FUI; no runtime value crosses |

Key structural facts pinned to the tree:

- The **runtime driver is FUI-owned** and the contract that crosses the seam is WE-owned vector **data**
  ([fui:.../conformanceVectors.ts:23-26](../../frontierui/tools/explorer/oracles/conformanceVectors.ts#L23-L26)
  imports `ConformanceVector` *type-only* from `@webeverything/conformance-vectors/schema`). This is the
  #899 split already in code — and #239/the constellation forbid WE importing FUI, so a "reuse" path is a
  **contract seam, never a direct import**.
- The `ConformanceBinding` interface (dispatch a verb / observe a surface against a live component) is
  declared **inside the FUI file**, not in the WE schema
  ([fui:.../conformanceVectors.ts:39-52](../../frontierui/tools/explorer/oracles/conformanceVectors.ts#L39-L52))
  — it's runtime-adapter shape, consumed only by the runner, so it correctly stays FUI.
- The directive **under-specifies a vector**: it names `protocol/observe/tier/kind` but carries **no
  concrete expected value**, and the observable registry carries none either —
  `ProtocolObservable = { id, kind, platform? }`
  ([we:webcases/requirementValidator.ts:36-40](../webcases/requirementValidator.ts#L36-L40)). A
  `ConformanceVector` *requires* a concrete `expect`
  ([we:conformance-vectors/schema.ts:38-47](../conformance-vectors/schema.ts#L38-L47)). So a directive
  cannot lower to a *value-equality* vector without extending a registry — this is the real residual fork.
- The directive carries `tier` (`L1/L2/L3`); the vector schema has **no tier field**. Lowering needs the
  schema to gain an optional `tier` (an additive extension, not a new contract).

## Prior art — executable-specification bridges

The "directive → runtime driver" pattern is the **executable-specification glue/fixture** seam, decades of
prior art (distinct from #899's *conformance-corpus* survey of WPT / ARIA-AT / JSON Schema Test Suite):

- **Cucumber / Gherkin.** A declarative `.feature` corpus (Given/When/Then) is **separate** from *step
  definitions* — the "glue" that pattern-matches each step to a verb-dispatching function. The runner
  sequences steps; the glue is the impl-specific adapter. One corpus, many runners; the glue is exactly a
  `ConformanceBinding`. ([cucumber.io/docs/cucumber/step-definitions](https://cucumber.io/docs/cucumber/step-definitions/))
- **Concordion.** The *instrumented-HTML* style — the spec is HTML with embedded `concordion:` namespace
  commands, **invisible to the browser, processed by fixture code** that finds the commands and verifies
  the system under test. This is the webcases `<!-- assert: … -->` directive pattern **exactly**: a
  declarative artifact carrying inline check-commands + a separate impl-side fixture that drives them.
  Concordion's stated goal is to **decouple the spec from the system** — corpus ⊥ fixture.
  ([concordion.org/instrumenting/java/html](https://concordion.org/instrumenting/java/html/))
- **Concordion command vocabulary** distinguishes `execute`/`set` (run + observe an outcome surface) from
  `assertEquals` (compare to a literal value). The webcases directive as it stands (`protocol/observe/tier`
  + presence-of-outcome) is the *former* style; a literal-value check is the *latter* and needs the literal
  to live somewhere — grounding the reachability-vs-value-equality fork below.

**The lesson, unanimous across the prior art:** the declarative spec/corpus is one thing; the
verb-dispatching glue/fixture that drives the SUT is a separate, impl-side thing. That is the #899 split
(WE corpus/schema ⊥ FUI driver), and the webcases directive is simply a **second declarative front-end**
that lowers to the same driver — Cucumber's "many feature dialects, one step-runner" shape.

## Synthesis handed to #1233

Run the constellation rulings over the stated "reuse vs separate" call and it collapses:

**Forced invariant 1 (ratify) — the runtime half is FUI; WE owns only the lowering.** Mount + dispatch +
clock + read-observable IS the #899 driver, and #817/#899 already put runtime → FUI (and #239 forbids WE
importing FUI). The WE side is the deterministic *lowering* — the next compile stage after
`we:webcases/compileRequirement.ts` (directive → declarative check), dependency-free, no clock, no DOM. *Broken
branch:* a WE-side runtime driver — re-litigates #817/#899 and breaks #239. Concordion/Cucumber agree: the
fixture/glue is impl-side.

**Forced invariant 2 (ratify) — the lowering target is the existing WE `ConformanceVector` contract,
reused; not a new parallel "case-check" contract.** The directive is a second front-end that lowers to
`@webeverything/conformance-vectors/schema` (already a type-only seam, already path-mapped into FUI), run
by the existing `runConformanceVector`/`judgeConformanceTrace`. *Broken branch:* minting a second
declarative contract + a second FUI runner for a check the vector contract already expresses — cuts #855
(only the contract crosses the seam, and there should be **one**) and DRY. The schema gains an **optional
`tier` field** (the one element the directive carries that the vector lacks) — additive, not a rival
contract.

**Fork 1 (the one genuine call) — the bridge's checking semantics: coarse *reachability* vs full
*value-equality*.** The directive carries no expected value and the observable registry carries none, so
the bridge must define what an assert-directive *means*:

- **A — Reachability lowering (recommended, ~80%).** Lower to a minimal `ConformanceVector` whose `expect`
  asserts the named observable was *reached* (`kind="state"` → its surface becomes present/non-empty) /
  *fired* (`kind="event"` → it appears in the trace) at its tier — everything derived from `kind`. No
  registry change; **#1162 builds standalone**. Concordion `execute`/`set` precedent; most-permissive
  default. It's the **breadth** layer (every compiled requirement gets a cheap executable check); the
  hand-authored vector corpus stays the **depth** layer (exact-value + temporal conformance). The bridge
  does not replace vectors.
- **B — Value-equality lowering (rejected as default).** Extend `ProtocolObservable` / the requirement
  `then` with an expected observable value, so the directive lowers to a full value-equality vector.
  Stronger, but forces a registry+schema extension + author burden and **blocks #1162** on it — for a
  check reachability already delivers. Concordion `assertEquals` precedent. Defer until reachability proves
  too weak. *Residual:* if the first webcases need exact-value assertions, B's extension lands sooner —
  flag for the skeptic pass.

## Graduation (after the call)

A ratified A yields agent-ready builds via a `blockedBy` chain: optional `tier` field on the WE vector
schema → a WE-resident `compileDirective` lowering (directive → reachability `ConformanceVector`, the next
stage in `we:webcases/`) → a FUI binding that the webcases front-end shares with the vector-suite front-end
→ #1162 wires the webcases conformance suite green. No Technical Configurator card is forced.
