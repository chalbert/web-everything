---
kind: decision
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-cases-to-test-bridge.md
relatedProject: webcases
tags: [conformance, cases-to-test-bridge, webcases]
---

# Decide: cases-to-test bridge reuses the #899/#1176 conformance-vector driver, or a separate WE-side mechanism

The webcases compiler emits a `<!-- assert: protocol/observe/tier/kind -->` directive in every compiled
webcase ([we:webcases/compileRequirement.ts:72-82](../webcases/compileRequirement.ts#L72-L82)), but
**nothing consumes it**. The "case-to-test bridge" that turns it into a pass/fail — parse the directive +
the `WEB CASE` Given/When/Then, drive the component, read the named observable at its `tier`
(read-a-state when `kind="state"` / await-an-event when `kind="event"`, the #1201 token), judge — is
**exactly** what the #899/#1176 conformance-vector driver already does
([fui:tools/explorer/oracles/conformanceVectors.ts](../../frontierui/tools/explorer/oracles/conformanceVectors.ts):
`runConformanceVector` + `judgeConformanceTrace` + `ConformanceBinding` + `VirtualClock`). **Prepared** off
an [executable-spec-glue prior-art survey](/research/cases-to-test-bridge/) (Cucumber step-definitions,
Concordion instrumented-HTML fixtures): running the constellation rulings over the stated "reuse vs
separate" call **collapses it to two forced invariants + one genuine fork** — the bridge's *checking
semantics*, default **→ A (reachability lowering)**.

## Recommended path at a glance

| # | Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|---|
| 1 | Bridge **checking semantics** — what does an assert-directive *mean* when it carries no expected value? | **A — Reachability lowering**: lower to a minimal `ConformanceVector` asserting the observable was *reached*/*fired* at its tier (derived from `kind`); no registry change, #1162 builds standalone | B — Value-equality lowering: extend the observable registry with an expected value so the directive lowers to a full value-equality vector (blocks #1162) | Med-high (~80%) |

Two **ratify** lines (forced invariants) and the support-list are below the divider; the single genuine
call is Fork 1.

## Ruling — ratified 2026-06-20 (A, ~90%)

**Fork 1 → A (reachability lowering).** The assert-directive lowers to a minimal `ConformanceVector`
whose required `expect` is derived from `kind`: a `state` observable asserts its surface is *reached*
(present/non-empty) at its tier; an `event` observable asserts it *fired* (appears in the run trace).
No registry or authoring-surface change — so the #1162 build ships standalone. The two forced
invariants ratify as written: runtime drive stays FUI (#817/#899 + WE↛FUI); the bridge is a second
declarative front-end onto the **one** `ConformanceVector` contract (#855), the schema gaining only an
optional `tier` field.

**Why A is the floor, not a placeholder (the red-team).** B's residual was "the first webcases assert
exact values." It does not land: neither the directive, nor `ProtocolObservable`
(`{id, kind, platform?}`), nor the authored requirement `then` (`{protocol, observe, tier}`,
[we:webcases/requirementValidator.ts:57-58](../webcases/requirementValidator.ts#L57-L58)) carries a
value *anywhere*. B is therefore a **three-layer** change (authoring `then` grows a value slot →
observable registry grows a literal → lowering reads it), not a registry tweak — the directive can't
even *express* what B would check. A is the only semantics the current contract can mean (the directive
names *what* to observe and *where*, never *what value*), and *most-flexible-default* points at it (the
permissive floor; the value literal is the author's opt-in). The "#1162 builds standalone" merit is a
prioritization bonus, not the deciding reason — A wins on correctness.

**B is a sanctioned future layer, scoped by the registry.** The observable registry already encodes
values into observable *identity* (`invalid-state-announced` vs `valid-state-announced` are distinct
ids) and models firings as events — for those, reaching the named observable **is** the value check, so
A is permanently complete. B's genuine targets are the minority of value-bearing **state** observables
(`current-value`, `validity-state`, `entity-timeline`) where reaching ≠ right value. B layers on
per-observable, opt-in; ratifying A does not preclude it. Filed as the tracked follow-up
[#1235](/backlog/1235-value-equality-lowering-for-value-bearing-state-observables-/)
(`blockedBy: #1162`) so the option is prioritisable, not buried in this resolved doc.

## Fork 1 — Bridge checking semantics: coarse reachability vs full value-equality

*Fork-existence:* a genuine either/or — the assert-directive carries `protocol/observe/tier/kind` but
**no concrete expected value**, and the observable registry carries none either
(`ProtocolObservable = { id, kind, platform? }`,
[we:webcases/requirementValidator.ts:36-40](../webcases/requirementValidator.ts#L36-L40)), while a
`ConformanceVector` *requires* a concrete `expect`
([we:conformance-vectors/schema.ts:38-47](../conformance-vectors/schema.ts#L38-L47)). The bridge must
define what an assert-directive *means*, and the two semantics genuinely cannot both be it: value-equality
forces a registry/schema extension the reachability reading avoids. (This is not prioritization — it sets
the **contract** the bridge checks against, and gates whether #1162 builds standalone or carries a
registry-extension prereq.)

The crux: the compiled webcase names *what to observe* (the protocol's observable, at a tier, state-vs-
event) but never *what value it should hold* — there is nowhere in the directive or the registry for an
expected literal. So either the bridge checks the weaker, fully-expressible thing (was the named outcome
reached?), or the registry grows a place for the literal.

- **A — Reachability lowering (recommended).** The directive lowers to a minimal `ConformanceVector` whose
  `expect` asserts the named observable was *reached* (`kind="state"` → its surface becomes present /
  non-empty) / *fired* (`kind="event"` → it appears in the run's trace) at its `tier`, deriving everything
  from `kind`. *Merit:* no registry change, so **#1162 builds standalone**; it's the most-permissive
  default (no author burden, works for every directive today, per *most-flexible-default*). Precedent:
  Concordion's `execute`/`set` (run + observe an outcome surface) and Cucumber steps assert reachability of
  an outcome, not a literal. It is the **breadth** layer — every compiled requirement gets a cheap
  executable check — while the hand-authored vector corpus (#899/#1176) stays the **depth** layer
  (exact-value + temporal conformance). The bridge does **not** replace vectors; it complements them.
- **B — Value-equality lowering (rejected as default).** Extend `ProtocolObservable` / the requirement
  `then` with an expected observable value, so the directive lowers to a full value-equality
  `ConformanceVector`. *Merit:* a stronger check (catches "reached the right state *name* with the wrong
  *value*"); Concordion `assertEquals` precedent. *Why not the default:* the directive cannot *express* an
  expected value today, so B's check only becomes meaningful once the registry carries the literal — and
  the named-outcome-reached check (A) is the correct semantics for a directive that names *what* to observe
  but not *what value*; A is the floor, B a per-observable refinement layered on top of it (a ratified A
  does not preclude growing into B). **Residual that keeps confidence at ~80%:** if the very first webcases
  genuinely assert exact values (not just "reached"), B is the right contract from the start — flag for the
  deciding agent's skeptic pass.

---

## Context

### Forced invariants — ratify, not weigh

The item's "reuse the driver vs separate WE-side mechanism" framing is **not** two genuine forks; each
half has a broken branch named, so they ratify:

1. **Runtime drive → FUI; WE owns only the lowering.** The bridge's runtime half (mount + dispatch action
   verbs + advance a clock + read an observable surface) *is* the #899 driver, and
   [#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)/[#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)
   already put runtime → FUI (and #239 forbids WE importing FUI). WE owns the deterministic *lowering* —
   the next compile stage after `we:webcases/compileRequirement.ts` (directive → declarative check), dependency-free,
   no clock, no DOM. *Broken branch:* a WE-side runtime driver — re-litigates #817/#899 and breaks the
   WE↛FUI direction. The executable-spec prior art agrees: Cucumber's step-definitions and Concordion's
   fixtures (the verb-dispatching glue that drives the system) are impl-side, separate from the declarative
   spec.
2. **Reuse the existing `ConformanceVector` contract; don't mint a parallel one.** The assert-directive is
   a **second declarative front-end** that lowers to `@webeverything/conformance-vectors/schema` (already a
   type-only seam, already path-mapped into FUI — [fui:tsconfig.json:68](../../frontierui/tsconfig.json#L68)),
   run by the existing `runConformanceVector`/`judgeConformanceTrace`. The schema gains an **optional
   `tier` field** (the one element the directive carries that the vector lacks) — additive. *Broken
   branch:* minting a second declarative "case-check" contract + a second FUI runner for a check the vector
   contract already expresses — cuts [#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/)
   (only the contract crosses the seam, and there should be **one**) and DRY. Cucumber precedent: many
   `.feature` dialects, one step-runner.

### Supported by default (not decisions)

- **The `ConformanceBinding` stays FUI** — it's runtime-adapter shape (dispatch a verb / observe a surface
  against a *live* component), declared inside the FUI driver
  ([fui:tools/explorer/oracles/conformanceVectors.ts](../../frontierui/tools/explorer/oracles/conformanceVectors.ts)),
  consumed only by the runner, never by a WE-side gate — #817's file-seam test keeps it FUI. The webcases
  front-end shares the *same* binding the vector-suite front-end uses.
- **One runtime, two front-ends** — the vector-suite front-end and the assert-directive front-end both
  lower to `ConformanceVector` and run on the one FUI driver; they coexist, not rivals.

### Per-fork classification (Fork 1)

1. **Layer?** The lowering (directive → vector) is deterministic WE compiler code (the `compileRequirement`
   pattern → WE); the drive/judge is runtime (→ FUI). The fork is about the *checking contract*, not a new
   standard.
2. **Protocol or intent dimension?** Conformance **data/contract** (what an assert-directive asserts) →
   WE. Not an intent.
3. **Affects an intent?** No — a conformance/tooling concern.
4. **Fixed mechanic or dimension?** A is the fixed floor; B is an additive per-observable upgrade — so the
   axis stays open (reachability default, value-equality opt-in once a literal exists), not a one-shot
   either/or baked forever.
5. **DI-injectable?** The binding is injected into the runner (already true, #1176); unaffected by Fork 1.
6. **Most-permissive default?** A — works for every directive with no author burden or registry change; the
   stricter value check is the author's opt-in (B), per *most-flexible-default*.
7. **Seam between intents?** No.

### Relationships

- [#1162](/backlog/1162-cases-spec-completion-case-to-test-bridge-conformance-valida/) — **blocked on this**;
  builds the bridge once the call is made. Default A lets it build standalone; B adds a registry-extension
  prereq.
- [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/) — established the
  WE corpus/schema ⊥ FUI driver split (drives invariant 1) and the reference-driver-home call.
- [#1176](/backlog/1176-layer-2-conformance-vector-oracle-layer-3-advisory-llm-judge/) — built the FUI driver
  (`runConformanceVector`/`judgeConformanceTrace`/`ConformanceBinding`/`VirtualClock`) the bridge reuses.
- [#1201](/backlog/1201-/) — added the directive's `kind="state|event"` token the reachability lowering reads.
- [#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/) — only the contract
  crosses the seam (supports invariant 2).

### Graduation (after the call)

A ratified A yields agent-ready builds via a `blockedBy` chain in composition order: optional `tier` field
on the WE vector schema → a WE-resident `compileDirective` lowering (directive → reachability
`ConformanceVector`, the next stage in `we:webcases/`) → a FUI binding the webcases front-end shares with
the vector-suite front-end → #1162 wires the webcases conformance suite green. No Technical Configurator
card is forced by the split itself.
