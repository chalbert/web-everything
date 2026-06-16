---
type: decision
workItem: story
size: 3
parent: "746"
status: open
relatedProject: webdocs
dateOpened: "2026-06-16"
tags: [webdocs, adapters, polyglot, generation, component-emit]
---

# Decide the forward component-emit substrate + per-framework emitter architecture (polyglot panel)

The polyglot adapter panel (#753) wants to **generate this block across React/Vue/Svelte/Angular/native
WC** and live-test each. #810 verified the prerequisite against the tree: the forward per-framework
**component** emitters that centrepiece needs **do not exist**, and — crucially — **no existing neutral
substrate forward-emits to them.** Before #753 builds, this decides *what* backs forward component emit.

## Verification (#810) — what's actually in the tree

- **#547 generation core is the wrong axis.** [languageBackend.ts](../blocks/renderers/module-service/generation/languageBackend.ts)
  is `(ServePathIR) => GeneratedOrigin` — it emits a **MaaS server origin** (core + HTTP shell) from a
  *serve-path* IR ([servePathIR.ts](../blocks/renderers/module-service/servePathIR.ts), #505). Backends
  are `javascript`/`csharp` ([backends/](../blocks/renderers/module-service/generation/backends/)). This
  is server-side polyglot (#463/#505/#507), **not** UI-component output. #753's "consumes #547" framing
  is mis-grounded — the serve-path IR carries no component tree.
- **`ComponentIR` exists but is ingest-only.** [upgraderEngine.ts:38](../blocks/renderers/upgrader/upgraderEngine.ts#L38)
  defines `ComponentIR`; analyzers normalize React/Lit/Vue **into** it
  ([frameworkAnalyzers.ts](../blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts), #094/#190) — the
  normalization hub, *inbound*. Its only forward emit is `generateComponentSource(ir)`
  ([upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135)), which renders the **WE
  declarative `<component>` form** — one target, not React/Vue/Svelte/Angular source. It was built for a
  deliberately *tractable subset* ("flag, don't fake"), so its fidelity for faithful forward emit to five
  frameworks is unverified.
- **`htmlToJsx` is a pane-level mirror, not a component emitter.** [htmlToJsx.ts](../blocks/renderers/jsx/htmlToJsx.ts)
  (#235) converts an element's HTML tree → JSX source for the Block Explorer's JSX pane (with a `react`
  attribute dialect). It is the closest thing to a forward React emitter, but it emits a *tree*, not a
  runnable component module/scaffold, and covers React/JSX only.

**Net:** native WC ≈ the block itself; React ≈ a partial pane-level mirror; **Vue/Svelte/Angular: nothing.**
And no single substrate spans them. The build is therefore an architecture choice, not a "missing subset."

## The fork — what substrate backs forward component emit?

- **Option A — extend the upgrader `ComponentIR` into a bidirectional hub.** Reuse the existing neutral
  rep; add forward emitters (`ComponentIR → React/Vue/Svelte/Angular/WC source`) beside the inbound
  analyzers. *Pro:* one IR, the normalization-hub story closes the loop (ingest ↔ emit). *Con:* it was
  scoped for lossy ingest of a subset — may not carry enough (styling, events, slots, reactivity) for
  faithful, runnable forward output without enrichment.
- **Option B — HTML/declarative `<component>` form as the source, per-framework adapters off it.**
  Generalize the `htmlToJsx` mirror-dialect approach: HTML is canonical, each framework is an HTML→X
  adapter (extend to Vue SFC / Svelte / Angular templates). *Pro:* aligns with the existing JSX pane and
  the "HTML is canonical" line (#235); WC is free. *Con:* template-only frameworks (Vue/Svelte/Angular)
  carry binding/event idioms a flat HTML tree under-specifies.
- **Option C — a new dedicated forward component IR.** Purpose-built for multi-framework emit, distinct
  from the ingest `ComponentIR`. *Pro:* clean, carries exactly what emit needs. *Con:* a third IR
  alongside `ServePathIR` and `ComponentIR`; most build cost; weakest reuse.

**Bold default: Option B** — leverages the already-shipped HTML↔JSX adapter and the project's
"HTML-is-canonical" stance, gets native WC for free, and keeps the ingest `ComponentIR` doing the one job
it was designed for. A/B/C all need the conformance-badge wiring (#506-style gate per target) regardless.

**Not prepared** — options + grounding are stated, but prior art across the five frameworks isn't
surveyed yet. Run `/prepare 811` to bring it to ready-to-ratify, then `/decision`.

## Downstream

- #753 (the panel) is `blockedBy` this — it can't build "generate across frameworks" until the substrate
  is chosen. The actual emitter build is a separate item filed once this resolves (large; a focused
  session, per #753's own note).
