# Slate editor engine — the React-coupling fork (#963 prep)

**Date:** 2026-06-18 · **For:** decision [#963](/backlog/963-slate-editor-engine-react-optional-dep-fork/)
(parent epic [#940](/backlog/940-rich-text-editor-library-engine-adapters/), slice of the
`CustomEditorEngine` seam [#923] shipped). Cross-ref
[#955](/backlog/955-decide-the-polyglot-live-test-sandbox-strategy-framework-run/) (polyglot sandbox,
framework-runtime Fork B).

## The question

#940 registers four real library engines behind the swappable `CustomEditorEngine` seam #923 shipped
(`fui:blocks/rich-text-editor/editorEngine.ts:34` — `attach(ctx) → handle`, HTML pivot). Three of the four
(Quill / Lexical / ProseMirror) are clean parallel slices. **Slate is held out** because its editing
surface (`slate-react`) is React-based, so a Slate `CustomEditorEngine` would pull React into FUI even as
an optional dep — the same framework-runtime concern #955 Fork B raised for the live-test sandbox. The
item entered prep with three options (A headless core + non-React render · B accept React optional peerDep
· C drop Slate). This survey grounds the call against the four libraries' real architectures and the
constellation's framework-free rulings.

## What the survey found

### 1 · Slate is the *only* one of the four whose view layer mandates a framework

| Library | Core | Official view layer | Framework-free engine adapter possible? |
|---|---|---|---|
| **Quill** | Parchment doc model (Delta) | vanilla — drives a DOM element directly | **Yes** — vanilla |
| **ProseMirror** | schema/state core | `prosemirror-view` (vanilla `EditorView`) | **Yes** — vanilla; powers Tiptap/Remirror/BlockNote |
| **Lexical** | framework-agnostic core; `@lexical/headless` runs DOM-less | `@lexical/react` is *one optional binding* | **Yes** — core + own DOM listeners; React optional |
| **Slate** | `slate` core is framework-agnostic (data model + Transforms) | **`slate-react` — the only mature view** | **No** — the editing surface *is* React |

Sources confirm Slate's core was deliberately separated so "other view layers like React Native or Vue.js"
become *possible in the future* — i.e. not shipped today. Slate's docs state plainly that `slate-react`
"contains the React-specific logic… React components for rendering Slate editors." There is **no official
non-React view layer.** ([Slate docs — Rendering](https://docs.slatejs.org/concepts/09-rendering),
[slate-react](https://docs.slatejs.org/libraries/slate-react),
[Liveblocks 2025 RTE comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025))

### 2 · The non-React Slate views that exist are community, framework-coupled, and lagging

`svelte-slate` (nathanfaucett) and `slate-vue` are community projects. They (a) pull a *different* framework
(Svelte/Vue), and (b) lag the core version. So "non-React render" never means *no framework* — it means
*a different, less-maintained framework*. ([svelte-slate](https://github.com/nathanfaucett/svelte-slate))

### 3 · Consequence for Fork A (headless core + custom non-React render)

The seam (`fui:blocks/rich-text-editor/editorEngine.ts:46-100`) already ships a `NativeContentEditableEngine` — a hand-written
contenteditable view (beforeinput/input, Range-based paste, execCommand). "Slate core + a custom FUI view"
means **re-writing slate-react's view layer** (selection sync, IME, decorations) — the hardest part of
Slate and exactly what makes Slate *Slate*. The product would be "the native engine, but storing state in
Slate's JSON model" — it throws away the reason anyone picks Slate. So A doesn't *deliver a Slate engine*;
it's not merely costlier, it **fails the goal** (register the real library). The Svelte/Vue community-view
variant of A is strictly worse than B on every axis (different framework, less maintained). **A is the
flawed branch** — dissolve it.

### 4 · The decision reduces to one axis: what does "FUI is framework-free" *scope* to?

With A gone, the choice is **B (ship the Slate engine via slate-react, React as optional peerDep)** vs
**C (drop Slate from the engine set)**. And C is principled only if FUI's framework-free rule forbids React
in *any* `@frontierui` artifact. Otherwise "drop Slate" reduces to a prioritization call (defer the build),
which is not a fork branch (the *not-a-prioritization* rule). So the genuine question is the **scope of the
framework-free principle**:

- **Floor-only reading** (recommended): the #940 epic's own words — "libraries stay peer/optional deps so
  the **native floor** is dependency-free." #955's ruling protects FUI's *default/shipped* bundle ("React/Vue
  load only inside the dev-tool sandbox, never in FUI's shipped bundle"). Under this reading the native
  engine (the default) stays React-free, and an *opt-in, tree-shakeable* `engine="slate"` adapter that
  brings its own React peerDep is fine — it's exactly "libraries are opt-in enhancements"
  (native-first-default memory) and the most-permissive default. #955's broken branch **B2** was *bundling
  React into FUI's core for every consumer* — materially different from an engine that tree-shakes away
  unless explicitly imported.
- **No-React-anywhere reading**: any React in a published `@frontierui` artifact dilutes the "framework-free
  web-components library" identity and adds a real peer-dep matrix (React 18/19 · ReactDOM · slate-react
  version coupling). Under this reading B is the excluded branch and C is forced.

### 5 · Lexical already covers Slate's design niche — but that's prioritization, not exclusion

Lexical (modern nested-JSON model, React-ecosystem origin, *genuinely headless core*) occupies nearly the
same niche Slate does, **without** the React mandate. That makes Slate's *marginal coverage* small — a real
input to *whether to build the Slate slice now*, but a **prioritization** input, not a reason the end-state
should *exclude* Slate. Recorded as context, not a fork branch.

## Classification (per-fork pass)

- **Which layer?** Engine adapters are FUI impl (`locus: frontierui`), behind the WE `editor-engine`
  protocol (#629). No WE standard artifact changes — the seam already exists. The `engine` attribute is the
  consumer's opt-in selector.
- **Fixed mechanic or dimension?** The engine set is a **dimension** (swappable registry, `engineIsSwappable`
  #629) — adding/withholding one member doesn't change the seam. The native floor is the fixed default.
- **Most-permissive default?** Supporting Slate as an opt-in is the permissive end-state; dropping it is the
  restriction → bias toward B.
- **Standing bias (separate/decouple):** B keeps React fully decoupled from FUI's floor and from the other
  three engines (it loads only when `engine="slate"` is selected) — honoured.

## Synthesis handed to #963

**One genuine fork: the scope of the framework-free principle**, with outcomes B (permit the opt-in React
engine) vs C (forbid → drop Slate). **Recommended default: B / floor-only**, ~70% (med-high). Residual =
the stricter no-React-in-`@frontierui` identity reading, which the decider (likely the user, who owns the
framework-free stance) may pull at ratify — that is the red-team attack to brief. Fork A dissolved as the
flawed branch. If B: file the Slate engine build as a normal #940 child (blockedBy lifted), prioritized like
the siblings, React 19 + `slate` + `slate-react` as optional peerDeps, the React root contained inside the
engine's `host`. If C: don't file it; record Slate as a deliberate non-member with the principle cite.
