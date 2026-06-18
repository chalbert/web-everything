---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-behavioral-conformance-vectors-kit.md
relatedProject: webvalidation
tags: [conformance, conformance-vectors, behavioral-conformance, wpt]
---

# Behavioral conformance vectors + in-browser implementer-validation tool (WE vectors / plateau runner)

How does an implementer prove a component conforms to a WE standard when the contract is build-agnostic — only the rendered component counts, and the static manifest check can't see behavioral/temporal conformance? The model is a conformance **KIT** (declarative JSON vector corpus + schema + dependency-free verifier + binding interface) plus a hosted exerciser as the paid product — the WPT split. **Prepared** off a [prior-art survey](/research/behavioral-conformance-vectors-kit/): the constellation rulings **collapse the two stated forks to two forced invariants** (#817 split · #091 hosted→plateau) **plus one genuine call** — the runnable *reference backend*'s home — default **→ FUI**.

## What a vector looks like (concrete)

A vector is declarative data: a setup, a (possibly *timed*) interaction script, and the **observable** outcome on the final component — in contract vocabulary, read through the platform surface (DOM/ARIA/events), never impl internals. The temporal case is the one that *needs* the controllable clock:

```json
{
  "id": "validator-resolution/versioning/stale-async-dropped",
  "contract": "@webeverything/validator-resolution",
  "steps": [
    { "atMs": 0,  "do": "setInput",   "field": "email", "value": "a@b.com" },
    { "atMs": 0,  "do": "beginAsync", "token": "v1", "settlesInMs": 200, "result": { "state": "invalid", "message": "taken" } },
    { "atMs": 50, "do": "setInput",   "field": "email", "value": "c@d.com" },
    { "atMs": 50, "do": "beginAsync", "token": "v2", "settlesInMs": 80,  "result": { "state": "valid" } }
  ],
  "expect": { "finalState": "valid", "neverObserved": [ { "renderedMessage": "taken" } ], "aria": { "aria-invalid": "false" } },
  "observeVia": ["aria", "renderedMessage", "validity"]
}
```

v1 settles *after* v2 but is a stale generation → a conforming component must drop it ([validator-resolution/provider.ts:84-88](../../validator-resolution/provider.ts#L84-L88) — `shouldApplyResult` returns `handle.version === current generation`). "Never observed 'taken'" can only be checked by running time, which is why *how it's built* (debounce / `AbortController` / generation token, [validator-resolution/provider.ts:104-126](../../validator-resolution/provider.ts#L104-L126)) is irrelevant: only the observable result is judged.

## The axes (grounded)

The concern decomposes into four orthogonal artifacts, each with a settled home except one. The **vector corpus** generalizes a shape WE *already ships* — [blocks/renderers/module-service/conformance/vectors.ts:17-29](../../blocks/renderers/module-service/conformance/vectors.ts#L17-L29) (`VectorInput` = seed fixture + request) verified against [golden.json](../../blocks/renderers/module-service/conformance/golden.json) via [runner.ts](../../blocks/renderers/module-service/conformance/runner.ts) + [referenceTarget.ts](../../blocks/renderers/module-service/conformance/referenceTarget.ts) + [dotnetTarget.ts](../../blocks/renderers/module-service/conformance/dotnetTarget.ts) (a *polyglot* second target) — #899 extends that *request→golden* corpus to behavioral/temporal vectors with DOM/ARIA observation and a clock. The **assertion-semantics verifier** is a WE conformance gate (the same role as `check.ts`). The **binding interface** + a **clock verb contract** (`now/tick/tickAsync/next/runAll`) are a conformance protocol many implementers run with swappable drivers. The **runnable backends** (mount/dispatch + clock impl) are runtime; the contract types live in [contracts/package.json](../../contracts/package.json) (the #817/#872 type-only plane). The hosted **exerciser** (dashboards, results-over-time) is a served product.

## Recommended path at a glance

| # | Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|---|
| 1 | Reference-backend home — does the **WE project** ship a runnable reference driver (clock + DOM dispatch) as zero-lock-in proof-of-runnability? | **A — Pure-contract: backend lives in FUI** (open/free, floor stays escapable); WE = corpus + schema + verifier + interfaces only | B — WE-repo reference backend (separate, non-`@webeverything` package) as proof, the testharness.js precedent | Med (~70-75%) — divergent: WPT ships its harness with the corpus |

Two **ratify** lines (forced invariants, no judgment) and the support-list are below the divider; the single genuine call is Fork 1.

## Fork 1 — Reference-backend home: pure-contract (FUI) vs a WE-repo reference backend

*Fork-existence:* a genuine either/or — the reference backend is **one artifact** and can have only one home (WE repo vs FUI); both branches are coherent and cannot coexist as "the home of the reference backend." (This is the item's original Fork 2 *narrowed*: #817 already excludes a runtime driver from `@webeverything` itself, so the surviving question is only whether the WE **project/repo** publishes a reference backend *outside* the standard scope.)

The crux: the escapable-floor guardrail demands an implementer can run the vectors with **no hosted dependency** — but that floor can be satisfied either by the implementer's own driver + a FUI-published open reference backend, or by a WE-shipped reference backend. The clock/DOM driver is **runtime** the WE-side verifier does not consume (the verifier consumes a *timestamped observed trace* — time as data), so #817's file-seam test ports it out of `@webeverything`.

- **A — Pure-contract; backend → FUI (recommended).** WE ships only the corpus (JSON) + vector schema + assertion-semantics verifier + the binding/clock **interfaces**. ALL runnable backends (mount/dispatch + Sinon-style/`page.clock`-style clock) are FUI (or the implementer's own). *Merit:* cleanest layer purity (WE = contracts/conformance only, per #817, #855, *impl-is-not-a-standard*); the verifier stays genuinely dependency-free and ships in `@webeverything` like the JSON Schema Test Suite's pure-JSON corpus; one-contract-many-backends portability is preserved (no backend baked in). The floor stays escapable because FUI is open/free (open-core) and the implementer can always bring their own driver.
- **B — WE-repo reference backend (rejected as default).** The WE project *additionally* publishes a runnable reference driver (embedded clock + DOM dispatch) as a **separate, non-`@webeverything`** package, purely as proof-of-runnability. *Merit:* matches the WPT precedent (`testharness.js` ships alongside the corpus) and the JSON Schema Test Suite's Node-binding precedent; gives implementers a copyable, guaranteed-runnable reference and proves the corpus is actually executable. *Why not the default:* it puts runnable runtime in the WE repo, cutting against #855 (the generator/tool → FUI, only the contract crosses the seam) and #817 (runtime → FUI); FUI being open already satisfies the escapable-floor without WE holding impl. **Residual that keeps confidence at ~70-75%:** if FUI's reference backend ever lags the corpus or proves too coupled to FUI's component model to be a *neutral* reference, B becomes attractive — flag for the deciding agent's skeptic pass.

---

## Context

### Forced invariants — ratify, not weigh

These were the item's framing but are **not** genuine forks; each has a broken branch named, so they ratify:

1. **Layer split (per [#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/)'s file-seam test).** WE owns the vector corpus (JSON) + vector schema + the **assertion-semantics** reference verifier (a WE conformance gate, like `check.ts`) + the binding **interface** including the clock **verb contract** (`now/tick/tickAsync/next/runAll`). The binding **implementation** (mount/dispatch/read) and the clock **implementation** (Sinon-style / `page.clock`-style) are runtime → FUI. *Broken branch:* a runtime clock/DOM driver *inside `@webeverything`* — exactly the runtime #817 excluded from WE. The verifier consumes time as **data** (a timestamped trace), never a live clock, so no WE-side gate consumes the clock impl.
2. **The hosted exerciser is a plateau product (per [#091](/backlog/091-web-docs-as-a-service-plateau/)).** A zero-setup, in-browser, dashboards / pass-fail-over-time, results-collecting surface is the wpt.fyi / aria-at-app shape — a served product, plateau's constellation layer (#091's *decompose, no home decision* pattern; #775's free-floor / paid-hosted split). *Broken branch:* FUI hosting a stateful results SaaS — FUI is the impl/devtool layer, not a hosted product layer. This is why the item's original *"Fork 1 — plateau vs FUI"* dissolves: the **hosted dashboard → plateau**; a thin **stateless** local exerciser → FUI devtool (see "Supported by default" below). It is not a single-home either/or — it decomposes.

### Supported by default (not decisions)

Coherent options that coexist — record and move on, don't spend the decider's judgment:

- **A thin stateless local exerciser as a FUI zero-lock-in devtool** — coexists with the plateau hosted product (different purpose: run-now vs results-over-time), not a rival. (If Fork 1 lands on A, this is also where the reference backend lives.)
- **An open report-file schema** as the interchange contract (WPT's `wptreport.json` precedent) — additive; lets any runner feed any dashboard.
- **Priority tiers (MUST/SHOULD/MAY) + an `optional/` tranche** in the corpus (ARIA-AT / JSON Schema Test Suite precedent) — additive corpus structure, not a fork.
- **Multiple driver backends** (jsdom+Sinon for CI speed, Playwright `page.clock` for real-render fidelity) — the binding interface admits both by design; supporting both is the point.

### Per-fork classification (Fork 1)

1. **Layer?** The reference backend is runnable code → impl/runtime (Block-adjacent). The corpus + schema + verifier + interface → conformance Protocol + data. The fork is about an *impl artifact's home*, not a new standard.
2. **Protocol or intent dimension?** The binding interface + clock verb contract = a conformance **protocol** (many implementers, swappable drivers) → WE. Vectors = conformance **data** → WE. The backend = impl, not protocol.
3. **Affects an intent?** No — it's a conformance/tooling concern, not a declarative UX "what".
4. **Fixed mechanic or dimension?** N/A — an ownership/home call.
5. **DI-injectable?** Yes — the clock + binding are **injected into the verifier** (which is *why* the backend swaps: Sinon / `page.clock`). The verifier is pure; the backend is a DI dependency — directly supports default A.
6. **Most-permissive default?** The most-flexible floor: implementer brings their own backend, with an open (FUI) reference backend available. A keeps WE purest while leaving the floor escapable.
7. **Seam between intents?** No.

### Relationships

- [#817](/backlog/817-constellation-placement-of-guard-validity-merge-validator-re/) — established WE keeps the contract, runtime → FUI (drives invariant 1 and narrows the genuine fork).
- [#091](/backlog/091-web-docs-as-a-service-plateau/) — managed offerings decompose across the constellation; served product → plateau (invariant 2).
- [#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/) — only the contract crosses the seam, code never does (supports Fork 1 default A).
- [#314](/backlog/314-flagship-exercise-apps/) — exercise-app conformance loop; a related forcing function, **distinct surface — do not conflate**.
- [#809](/backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f/) — FUI block workbench; **distinct surface — do not conflate** (that is a stateless component-exploration chrome; this is a conformance runner).

### Graduation (after the call)

A ratified ruling yields agent-ready builds via a `blockedBy` chain in composition order — vector schema → corpus (extending the MaaS conformance pattern) → assertion-semantics verifier (WE) → binding interface (WE) → FUI reference backend → plateau hosted exerciser. Spin out a **Technical Configurator** card only if a documented technical setting emerges (e.g. driver-backend selection); none is required by the layer split itself.
