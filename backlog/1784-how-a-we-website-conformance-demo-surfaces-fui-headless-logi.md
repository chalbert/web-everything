---
kind: decision
status: resolved
relatedProject: webvalidation
blocks: ["1783"]
relatedReport: reports/2026-06-26-conformance-surface-headless-logic.md
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-26"
tags: [conformance, constellation-placement, mode-c, conformance-vectors, headless-logic, webpolicy]
---

# Conformance model for the relocated headless-logic runtimes — bespoke self-checking FUI bundle vs the #899 declarative-vector KIT

The #1294 relocation un-park gate (b) needs the WE docs site to exercise FUI headless logic (webpolicy is a DMN engine — facts→decision, no DOM) with no build-time `@frontierui` import, while keeping an executable conformance proof. Investigation dissolved the original "mode-C **or** #899-runner" framing: those are **orthogonal layers** (mode-C = transport, #899 = harness format) that compose — you mode-C-load a runner. The genuine fork sits underneath: the **conformance model** for the relocated logic runtimes — keep a bespoke self-checking FUI bundle, or adopt the #899 declarative-vector KIT (which needs its binding generalized from DOM/component to headless logic).

## Amended by #1788 (2026-06-26)

The **surface mechanism** below is superseded. This card's prep assumed the runner would be FUI-homed and so required a *FUI-origin* mode-C bundle (declining to widen #765). #1788 ratified that the generic runner is a **multi-surface plateau tool** that stays in plateau, so the docs surface is **plateau-origin** (widen mode-C's #765 trust to plateau, or a plateau-hosted iframe). The **conformance model** ruled here — the #899 declarative-vector KIT for facts→verdict runtimes — **stands unchanged**; only "FUI-origin bundle / don't-widen-#765" is replaced.

## Decision (ratified 2026-06-26)

**(b) — the #899 declarative-vector KIT**, scoped to the **facts→verdict** runtimes (webpolicy first). A relocated logic runtime proves conformance as a declarative vector suite (facts→golden verdict): WE owns the vector corpus + a **clock-optional synchronous** `ConformanceBinding` variant; FUI ships the per-subsystem binding impl (a ~one-screen adapter — `dispatch(setFacts)` / `observe('verdict')`); plateau's runner logic (#1597) executes, re-exported as a **FUI-origin** bundle the docs site mode-C-loads. The two skeptic corrections stand: the loaded bundle is FUI-origin (a plateau bundle fails mode-C's #765 gate), and (a) carries no #1467 demerit (its real flaw is format proliferation). The conformance model for the non-engine #1078 runtimes (`intl`/`webtheme`/`webexpressions`) is a separate later call. Build delegated to #1783 (now unblocked).

## Settled before the fork (not decisions — grounding)

- **mode-C is the transport, and it composes with anything.** `fui:embed/in-document.ts:84` runtime-`import(url)`s a published FUI bundle that self-mounts via the `mountInDocument` contract (`fui:embed/contract.ts:66-82`); `we:.eleventy.js:112-121` emits `data-embed-src=<FUI bundle URL>` so the **eleventy build never `import`s FUI** (the #700 source-direction rule). It runs **arbitrary** FUI logic, not just rendered components — so it is the transport for *either* fork branch, not an alternative to them. → **Supported by default** (see list below).
- **The `fuiDemo` iframe (#701) is out** for headless logic — `we:docs/agent/demo-workflow.md:32` serves *rendered* FUI components with chrome; there is no DOM to embed for a DMN engine.
- **#899 (resolved) already split the harness** (`we:conformance-vectors/binding.ts:40-64`): WE owns the `ConformanceBinding`/`ConformanceClock` **interfaces** + vector schema; FUI ships a binding **impl** per standard (`fui:blocks/deck/deckConformance.ts`); the **runner** is plateau-app's (`plateau:src/conformance-engine/conformanceVectors.ts`, #1597). This decomposition is **not** re-litigated here.

## Fork 1 — the conformance model for the relocated **facts→verdict** runtimes (webpolicy first)

*Fork-existence:* a genuine either/or for a decision-output-shaped runtime — both branches are coherent and cannot both be its standing conformance model. (a) keeps the hand-written executable proof, re-homed into a self-checking FUI bundle; (b) replaces it with a declarative #899 vector suite + a synchronous binding. A subsystem's conformance is *either* a bespoke self-check *or* a vector suite, not both.

**Scope (skeptic-corrected):** this fork is ratified only for the **facts→verdict** subset of the #1078 runtimes (webpolicy, and webcompliance-shaped peers). The #1078 list is heterogeneous — `intl` (locale formatting), `webtheme` (token projection), `webexpressions` (expression interpreter) are **not** decision engines and a "observe the decision output" vector does not fit them; their conformance model is a **separate later call**, not assumed here.

| Option | Conformance model | Main tradeoff |
|---|---|---|
| **(a)** Bespoke self-checking FUI bundle | FUI publishes a `mountInDocument` bundle that runs the engine **and** its own proof (the `we:demos/webpolicy-conformance-demo.ts:34` `assert(...)` checks travel into FUI); WE mode-C-loads it and displays pass/fail | Minimal — un-parks #1294 today with a FUI-origin bundle that already passes the mode-C trust gate. But **no shared conformance format**: ~N hand-rolled proofs, each its own assert dialect (today's demo is exactly that, `we:demos/webpolicy-conformance-demo.ts:34,106`) |
| **(b)** #899 declarative-vector KIT *(default)* | The runtime's conformance is a declarative vector suite (facts→golden verdict); WE owns the corpus + a **synchronous** binding interface; FUI ships the binding impl; the plateau runner logic (#1597) is re-exported as a **FUI-origin** bundle the docs site mode-C-loads | Data-not-code, build-independent, reusable by FUI's own vitest, and one format across the facts→verdict subset. Cost: a **new clock-optional synchronous binding variant** (the DOM/temporal `ConformanceBinding` does not extend for free) + the FUI-origin runner bundle (none exists yet) |

**Default: (b) — the #899 declarative-vector KIT, scoped to facts→verdict runtimes.** For an engine whose conformance *is* "given facts, expect this verdict," declarative vectors are strictly better than hand-rolled asserts: checkable as data, independent of the build, and reusable by FUI's own tests — and #899 already ratified this model + split its homes (contract→WE, binding→FUI, runner→plateau). (a) un-parks faster but locks in per-subsystem proof proliferation.

Two skeptic-forced corrections are baked into (b) above and must hold:
- **The mode-C artifact is a FUI-origin bundle, never a plateau one.** Mode-C's #765 trust gate defaults to the page + demo-host origin (`fui:embed/in-document.ts:44-45` — `trustedOrigins ?? [location.origin]`); a plateau-origin bundle is **refused**. So the plateau-authored runner (#1597) is re-exported as a **FUI**-published bundle for the docs site to load — the runner *logic* stays plateau's, the loaded *artifact* is FUI's. (Widening the allowlist to plateau would reopen #765 — explicitly **not** done here.)
- **(a) is not penalized on #1467.** A self-checking bundle that proves *one specific FUI engine* against its own asserts is a reference-impl-proving-itself (the wpt/test262 pattern), **not** a neutral third-party verifier — and plateau is not in the docs-site render path at all (`we:.eleventy.js:112-121` emits a FUI bundle URL, never plateau). (a)'s real and sufficient demerit is **format proliferation**, not a verifier-placement violation.

The residual build (b) implies — a **clock-optional synchronous** `ConformanceBinding` sibling (no DOM, observe the verdict; the temporal `neverObserved`/clock machinery is unused for synchronous logic), the FUI webpolicy binding, and the FUI-origin runner bundle — is **delegated to #1783**.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Three corrections folded in: (1) the loaded bundle must be **FUI-origin** — a plateau bundle fails mode-C's #765 gate (was a false claim in the draft); (2) dropped the rhetorical "#1467 verifier→plateau" demerit on (a) — plateau isn't in the docs loop, so (a)'s real flaw is proliferation; (3) scoped (b) to the **facts→verdict** subset, not all ~10 heterogeneous #1078 runtimes, and named the binding work honestly as a synchronous *sibling* interface, not a free extension. Direction (b) for engine-shaped runtimes held.

## Supported by default

- **mode-C in-document bundle** as the transport for surfacing any FUI bundle (engine or runner) on the eleventy docs site — already built (`fui:embed/in-document.ts`), composes with either fork branch.

## Lineage

Surfaced preparing #1783 (the #899/#1294 foundation). Grounds: #1294 (un-park gate b), #1282 (zero-impl), #1467 (verifier→plateau / contract→WE), #899 (conformance KIT — already split), #1597 (runner→plateau), #932/#700 (mode-C source-direction rule). Investigation report: `we:reports/2026-06-26-conformance-surface-headless-logic.md`.
