---
kind: decision
size: 3
parent: "746"
status: resolved
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#we-fui-embed-boundary"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-forward-component-emit-substrate.md
tags: [webdocs, adapters, polyglot, generation, component-emit]
---

# Decide the forward component-emit substrate + per-framework emitter architecture (polyglot panel)

The polyglot adapter panel (#753) wants to **generate this block across React/Vue/Svelte/Angular/native
WC** and live-test each. #810 verified the prerequisite against the tree: the forward per-framework
**component** emitters that centrepiece needs **do not exist**, and **no existing neutral substrate
forward-emits to them.** This decides *what* backs forward component emit before #753 builds.

## Grounding digest

**Tree (verified by #810):**
- **#547 generation core is the wrong axis.** [we:languageBackend.ts](../blocks/renderers/module-service/generation/languageBackend.ts)
  is `(ServePathIR) => GeneratedOrigin` — a **MaaS server origin** (core + HTTP shell) from a *serve-path*
  IR ([we:servePathIR.ts](../blocks/renderers/module-service/servePathIR.ts), #505), backends
  `javascript`/`csharp`. Server-side polyglot (#463/#505/#507), **not** UI-component output — the
  serve-path IR carries no component tree, so #753's "consumes #547" framing is mis-grounded.
- **`ComponentIR` is ingest-only.** [we:upgraderEngine.ts:38](../blocks/renderers/upgrader/upgraderEngine.ts#L38)
  defines it; analyzers normalize React/Lit/Vue **into** it
  ([we:frameworkAnalyzers.ts](../blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts), #094/#190) — the
  inbound normalization hub, scoped for a deliberately *tractable subset* ("flag, don't fake"). Its only
  forward emit, `generateComponentSource(ir)` ([we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135)),
  renders the **WE declarative `<component>` form** — one target, not five frameworks.
- **`htmlToJsx` is a pane-level mirror, not a component emitter.** [we:htmlToJsx.ts](../blocks/renderers/jsx/htmlToJsx.ts)
  (#235) converts an element's HTML tree → JSX source for the Block Explorer's JSX pane (a `react`
  dialect). Closest thing to a forward React emitter, but it emits a *tree*, not a runnable component
  module, and covers React/JSX only.
- **`custom-elements-manifest` is already a ratified WE protocol** ([we:protocols.json:251](../src/_data/protocols.json#L251),
  ratified #626 Fork 1) — *derived* from `fui:blocks.json` via [we:gen-cem.mjs](../scripts/gen-cem.mjs),
  describing a block's tag/attributes/properties/events/slots/CSS-parts. This is exactly the input the
  wrapper generators below consume.

**Prior art (this prep — full survey in the related report).** Multi-framework component tooling splits
into two families, and the item's original A/B/C lived in only one:
- **Transpile to native source** — **Mitosis** (Builder.io): a static JSX subset → a JSON IR
  *purpose-built for emit* → per-framework serializers (React/Vue/Svelte/Angular/Solid/Qwik + WC/Lit).
  The lone shipping proof neutral-IR→N-frameworks is real. Its IR is **emit-shaped, not a reused lossy
  ingest rep** — direct evidence for a dedicated forward IR over overloading `ComponentIR`.
- **WC-core + generated wrappers** — **Stencil output targets** (`@stencil/react|vue|angular-output-target`)
  and **Lit Labs** `gen-wrapper-react|vue|angular` (driven by `gen-manifest`/CEM): author once as a web
  component, **auto-generate thin per-framework wrappers keyed off the CEM**. The leaders converged here.
- **Platform shift** — **React 19 = 100% on Custom Elements Everywhere** (Vue/Svelte/Angular long ~100%):
  a native WC drops cleanly into all five frameworks with no per-framework artifact for common usage. The
  block already **is** a WC (#810), so the conformance claim the panel wants is already true for plain WC
  consumption.

## Axis-framing

The original framing assumed forward emit *means* transpiling to native per-framework source, and asked
only which neutral substrate carries it (A/B/C). The survey surfaces a **prior axis** the item missed: the
emit *model* itself — ship one WC + generated wrappers (Stencil/Lit-Labs) vs transpile to native source
(Mitosis). These are coherent, mutually-exclusive end-states with different build costs and different
conformance claims, so it is a real fork (Fork 1). It is also the *governing* one: if the answer is
wrappers, the entire neutral-component-IR question (A/B/C) **dissolves** — you need only the block's CEM
([we:gen-cem.mjs](../scripts/gen-cem.mjs)) + a wrapper generator + a FUI-hosted live render, no component IR
at all. The original A/B/C therefore survive only *inside* the transpile branch (Fork 2, contingent), and
the survey flips their default from B to C: Mitosis built an emit-purpose IR rather than reuse a lossy
ingest rep, [`htmlToJsx`](../blocks/renderers/jsx/htmlToJsx.ts) is React/JSX-only and tree-level, and the
upgrader [`ComponentIR`](../blocks/renderers/upgrader/upgraderEngine.ts#L38) is ingest-subset-scoped.

**Classification (per-fork pass).** Substrate/generation = a **WE forward-adapter artifact** (the
#463/#505/#507 polyglot family — WE owns the neutral contract + generation adapters + the deterministic
conformance gate). The **live render is FUI's**, not WE's: per the docs-rendering boundary WE never
renders FUI block code — the panel's "live-test each framework" is a **FUI-hosted `fuiDemo` iframe** (#701)
with WE producing only the code artifact. The conformance badge is the **#506** deterministic gate. The
per-framework emitters/wrapper-generators are **author-time devtools providers** behind an explicit-input
seam (the [`CustomAnalyzerRegistry`](../blocks/renderers/upgrader/upgraderEngine.ts#L97) shape, caller-owned,
no global singleton), not a runtime DI registry. **Option W mints no new protocol** — it reuses
`custom-elements-manifest`; Option T would own a forward emit-purpose IR contract (the #463 SoT pattern).

## Recommended path at a glance

| Fork | Question | Options | Ruling |
|------|----------|---------|---------|
| 1 | Emit **model** | W WC-core + CEM-driven wrappers · T full native-source transpilation | **DISSOLVED — not a genuine fork; support both as panel output modes** |
| 2 | Author-mode **substrate** | A overload ingest `ComponentIR` · B HTML-canonical adapters · C dedicated forward IR | **DEFERRED — start declarative-`<component>` subset-first (existing bidir path); C expected later, designed from accumulated cases** |

> **The prep framed Fork 1 as W-vs-T with a bold default of W. The decision turn dissolved it:** W and T
> both pass the fork-existence test (neither branch is flawed), so per *support-all-coherent* WE supports
> both as distinct panel output modes. The W/T prose below is retained as the description of the two modes,
> not as rejected branches. See *Ruling* below.

*Supported by default (not forks):* every branch needs the **#506-style conformance badge** per target;
the **live render is a FUI-hosted demo** regardless (docs-rendering boundary); **native WC** is the block
itself in all branches.

## Fork 1 — emit model: WC-core + generated wrappers, or full native-source transpilation?

- **Option W — emit the block as a WC (it already is one) + generate thin per-framework wrappers from its
  CEM.** Stencil/Lit-Labs precedent; the panel renders the WC + its wrapper per framework in a FUI demo.
  *Pro:* reuses the **already-ratified `custom-elements-manifest` protocol** WE derives via
  [we:gen-cem.mjs](../scripts/gen-cem.mjs); all five frameworks consume WCs cleanly (React 19 = 100% CEE), so
  wrappers are thin-to-unnecessary; **far the smallest build**; no neutral component IR to design. *Con:*
  the per-framework artifact is a wrapper + usage snippet, not a from-scratch idiomatic reimplementation —
  less "here's the native React version," more "here's how it drops into React."
- **Option T — emit full idiomatic native React/Vue/Svelte/Angular component *source* from a neutral IR.**
  Mitosis precedent. *Pro:* the most faithful "idiomatic source per framework" pedagogy. *Con:* the
  largest build (a full emit IR + N serializers); duplicates what React-19-era WC interop already gives
  for free; owns a new contract.

**Bold default: Option W (WC-core + CEM-driven wrappers).** The block is already a WC, the five frameworks
consume WCs cleanly (React 19 = 100% CEE), the wrapper generators are shipping prior art keyed off the CEM
WE *already ratified and derives*, and it sidesteps the entire neutral-component-IR question — the smallest
build that satisfies #753's "generate + live-test each." Transpile-to-source (T) is the maximalist option;
file it as a **later enhancement** if the panel's pedagogy demands idiomatic source rather than
proof-of-consumption. *(Red-team note for the decision turn: the attack on W is "wrappers aren't 'generating
the component', they're just consuming it" — weigh whether #753's value is proving fidelity-of-consumption
(W suffices, and is the honest post-React-19 claim) or teaching idiomatic per-framework authoring (only T
delivers). The survey's read is the former.)*

## Fork 2 *(contingent — only bites if Fork 1 = T)* — which transpile substrate?

- **Option A — extend the ingest `ComponentIR` into a bidirectional hub.** *Pro:* one IR, closes the
  ingest↔emit loop. *Con:* it was scoped for *lossy* ingest of a subset; may not carry styling/events/
  slots/reactivity for faithful forward output without enrichment.
- **Option B — HTML/declarative `<component>` canonical, per-framework HTML→X adapters** (generalize
  `htmlToJsx`). *Pro:* aligns with the "HTML-is-canonical" line (#235); WC free. *Con:* Vue/Svelte/Angular
  binding/event idioms a flat HTML tree under-specifies — re-grows the dialect knowledge an IR encodes.
- **Option C — a new dedicated forward/emit-purpose IR**, distinct from the ingest `ComponentIR`. *Pro:*
  carries exactly what emit needs; matches what Mitosis actually built. *Con:* a third IR alongside
  `ServePathIR` and `ComponentIR`; most build cost.

**Bold default: Option C** — Mitosis's evidence is that a forward transpiler wants an *emit-shaped* IR,
not a reused lossy ingest rep; A overloads the ingest `ComponentIR` (the item itself flags its
subset-scope), and B must re-grow per-framework binding dialects. If Fork 1 resolves to W, this fork does
not bite.

## Downstream

- #753 (the panel) is `blockedBy` this — it can't build "generate across frameworks" until the substrate
  is chosen. The actual emitter build is a separate item filed once this resolves (large; a focused
  session, per #753's own note).

## Ruling — Fork 1 dissolved (support both modes); Fork 2 = C; build order is prioritization

**Fork 1 is not a genuine fork.** Applying the fork-existence test (*support-all-coherent*: a fork is real
only if one branch is flawed/won't-work), neither W nor T is flawed — they are two coherent offerings with
different intents on independent substrates:

- **Consume mode (was "W")** — emit the block as the WC it already is + a thin CEM-driven per-framework
  wrapper. Intent: *"drops into your React/Vue/… app."* Rides the **already-ratified `custom-elements-manifest`**
  protocol ([we:gen-cem.mjs](../scripts/gen-cem.mjs)); needs **no component IR**.
- **Author mode (was "T")** — emit full idiomatic native React/Vue/Svelte/Angular *source* from an
  emit-purpose IR (Mitosis precedent). Intent: *"here's the idiomatic native source — own it / learn it."*
  This is the browser member of the ratified **#463 forward-generation family** (neutral-contract SoT +
  deterministic generation adapters, perfect-idiomatic per target, #506-gated).

A tabbed panel offering both side-by-side is coherent (Stencil ships wrappers *and* lets you eject), so WE
**supports both**; the panel exposes consume-mode and author-mode tabs per target. **Confidence ~85%.**

**This resolves, rather than contradicts, the earlier parity critique.** The points that looked like
"W is wrong" were against *W as the sole answer* — under coexistence they simply assign ownership of the
conformance signal: the **per-framework #506 badge attaches to author-mode's generated source**; consume
mode shows the single badge on the conformant WC it wraps (labeled as consumption, not per-framework
generation). No collapsed targets, no empty badge.

**Fork 2 is DEFERRED — not a near-term critical decision.** Author mode is itself demand-gated behind the
consume-mode probe, so committing to a brand-new emit-purpose IR (C) *now* is speculative design. The call:
**start with the declarative `<component>` subset that already round-trips, and let C crystallize later from
accumulated real cases.** Concretely:

- **Start subset-first (an A/B blend over the *existing* substrate, no new IR).** The upgrader already
  ingests React/Lit/Vue *into* the WE declarative `<component>` form via `ComponentIR` →
  [`generateComponentSource(ir)`](../blocks/renderers/upgrader/upgraderEngine.ts#L135) — a **bidirectional
  transform that already exists for a tractable subset**. Author mode begins by constraining to the subset
  that round-trips cleanly through that declarative pivot and emitting per-framework from it ("flag, don't
  fake" on what falls outside).
- **Expect C, but delay it as long as possible.** The known wall — a flat declarative form under-specifies
  Vue/Svelte/Angular binding/event idioms (B's con) — is the *signal*, not a reason to pre-build: when the
  subset stops stretching, the accumulated real cases are exactly what's needed to design the dedicated
  emit-purpose IR (C) *right* rather than guessing its shape today. C remains the likely end-state (Mitosis
  is the precedent that a forward transpiler wants an emit-shaped IR), and when built it is a neutral
  `@webeverything` contract (the #463 SoT pattern), serializers as forward-adapter artifacts, live render
  FUI's. Consume mode needs no IR (CEM only) regardless.

So no substrate is locked now: author mode (when demand-gated #818 fires) starts on the declarative subset,
and the C-vs-stay-on-subset call is made later with evidence. *(Supersedes this turn's earlier "Fork 2 = C
now" stance — premature for a deferred, demand-gated build.)*

**Build order is prioritization, not a fork** (*fork-is-not-a-prioritization-tool*): ship **consume mode
first** — cheap, rides the ratified CEM, immediately satisfies #753's "generate + live-test ≥2 targets" —
as the **appetite probe**. Build **author mode** (the emit-purpose IR + per-framework serializers, large)
**gated on demonstrated appetite**, filed as [#818](/backlog/818-author-mode-emit-substrate-dedicated-forward-emit-purpose-ir/),
`blockedBy: #753` (kept off the ready pool until the probe ships and demand is shown).

**Unblocks:** #753 (the panel) — its consume-mode build is now agent-ready.
