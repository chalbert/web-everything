---
kind: decision
size: 3
parent: "940"
status: resolved
locus: frontierui
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-slate-engine-react-coupling.md
crossRef: { url: /backlog/955-decide-the-polyglot-live-test-sandbox-strategy-framework-run/, label: "#955 polyglot sandbox — framework-runtime Fork B" }
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#framework-free-core-vendor-segregation"
tags: [webediting, rich-text-editor, editor-engine, slate, decision]
---

# Slate editor engine: React-optional-dep fork

Of #940's four library engines, three (Quill/Lexical/ProseMirror) are clean vanilla slices; **Slate is the
only one whose editing surface mandates a framework** — `slate-react` is its sole mature view, so a Slate
`CustomEditorEngine` pulls React into FUI even as an optional dep (the #955 Fork B concern). The survey
([report](../reports/2026-06-18-slate-engine-react-coupling.md) · [/research/](/research/#slate-engine-react-coupling))
dissolved the item's option **A** (headless core + non-React render) as the *flawed* branch and collapsed
the call to **one axis**: does FUI's framework-free principle forbid React in an opt-in, tree-shakeable
engine adapter, or only in the default/floor bundle?

## Ruling — ratified 2026-06-18 (B, refined to package-split)

**B ratified, ~88%** — but in a stronger form than "React optional peerDep on the rich-text-editor
package." The ratified shape:

- **Each framework-coupled vendor integration is its own published package** — `@frontierui/rich-text-editor-slate`
  — with React (+ `slate`/`slate-react`) as a *normal* dependency of **that package only**. The core
  (`@frontierui/blocks`) declares **no React at all**, so its dependency tree is *provably, auditably*
  framework-free — not "framework-free unless you read `peerDependenciesMeta`." This neutralizes C's single
  strongest argument (the identity-wide audit), which is why confidence rose from the prepared ~70% to ~88%.
- **Loaded via a plain dynamic `import()`**, which code-splits the engine (and React) out of the default
  bundle in any modern bundler. Registration stays trivial:
  ```ts
  import { customEditorEngine } from '@frontierui/blocks/rich-text-editor';
  const { SlateEngine } = await import('@frontierui/rich-text-editor-slate');
  customEditorEngine.register(new SlateEngine());
  ```
- **No module-federation protocol.** Module Federation / Native Federation / SystemJS all solve the *harder*
  problem — independently-built-and-deployed bundles sharing one runtime instance of a dep (the micro-frontend
  topology). The engine-registry case needs no cross-build sharing or coordination, so a published package +
  dynamic import is the whole mechanism. Adding a federation container would also impose a bundler-runtime
  contract that fights FUI's bundler-agnostic neutrality (#716). Considered and excluded as unneeded.
- **Reusable recipe (generalizes beyond Slate):** any framework-coupled vendor adapter lives in a segregated
  `@frontierui/<block>-<vendor>` package; the vendor's framework is contained at the package boundary; the
  core/floor stays framework-free; opt-in via dynamic import. The framework-free principle scopes to the
  **core/floor packages**, not identity-wide across every `@frontierui` artifact.

**Deferred follow-up (not part of this ruling):** *if* a future FUI vendor adapter ever genuinely needs
cross-deploy runtime sharing (one shared dep instance across separately-deployed bundles), the neutral choice
is an **import-maps / Native-Federation** approach (the web-standard substrate), **never** webpack-origin
Module Federation — and that is its own decision at that time, on the bundler-agnostic axis.

### Original recommendation at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 — scope of the framework-free principle | **B · permit the opt-in React engine (floor-only reading): ship Slate via `slate-react`, React optional peerDep** | C · no-React-anywhere reading → drop Slate from the engine set | Med-high (~70%) |

## Fork 1 — what does "FUI is framework-free" scope to?

**Why it's a fork (real either/or):** the two readings of the principle are both coherent but cannot
coexist — React either *may* or *may not* live in a published `@frontierui` artifact, and that single answer
*determines* whether B is allowed or C is forced. (Option A is excluded below, not a third branch; and "drop
Slate because Lexical overlaps / it's effort" is prioritization, not a fork branch — so the only principled
reason to drop Slate is the no-React-anywhere reading, which is exactly this axis.)

Grounding — the seam and the precedents:
- The seam is imperative and HTML-pivoted: `CustomEditorEngine.attach(ctx) → handle`
  (`fui:blocks/rich-text-editor/editorEngine.ts:34`, `getValue/setValue/format/destroy`,
  `fui:blocks/rich-text-editor/editorEngine.ts:22-31`). The default `NativeContentEditableEngine`
  (`fui:blocks/rich-text-editor/editorEngine.ts:46-100`) is the React-free floor; engines are resolved by
  the `engine` attribute via `CustomEditorEngineRegistry`
  (`fui:blocks/rich-text-editor/editorEngine.ts:103-124`).
- #940's own framing: "libraries stay peer/optional deps so the **native floor** is dependency-free."
- #955's ruling protects FUI's *shipped/default* bundle — "React/Vue load only inside the dev-tool sandbox,
  never in FUI's shipped bundle"; its excluded branch **B2** was *bundling React into FUI's core for every
  consumer*, materially different from an engine that tree-shakes away unless `engine="slate"` is imported.

- **B — permit the opt-in React engine (floor-only reading). [bold default]** Ship the Slate engine via
  `slate-react`, with `slate` + `slate-react` + React 19 declared as **optional peerDeps**; the engine mounts
  a React root *inside* its `host` element (an internal impl detail, contained — not API surface) and
  serializes to/from the HTML pivot. The native default stays React-free; React loads only when a consumer
  explicitly selects `engine="slate"`. Aligns with native-first ("libraries are opt-in enhancements"), the
  most-permissive default, and minimize-lock-in (support all coherent engines). *Residual / red-team brief:*
  the stricter reading below — a decider who owns the framework-free identity may hold that *any* React in a
  published `@frontierui` artifact is the excluded branch, regardless of opt-in. Ground the ratify against
  that attack.
- **C — no-React-anywhere reading → drop Slate.** Treat any React in a published `@frontierui` artifact as
  the excluded branch: don't build a Slate engine; record Slate as a deliberate non-member with the principle
  cite. Coherent if the framework-free rule is read as identity-wide, not floor-only — but it narrows coverage
  by dropping a leading library when the floor it protects is untouched by an opt-in engine.

---

## Supported by default (not decisions)

- **Option A (headless `slate` core + a custom non-React render) is the *flawed* branch — dissolved, not a
  fork.** The seam already ships a hand-written contenteditable view (`NativeContentEditableEngine`). "Slate
  core + a custom FUI view" means re-writing `slate-react`'s view layer (selection sync, IME, decorations) —
  the hardest part of Slate and exactly what makes Slate *Slate*. The result is "the native engine, but
  storing state in Slate's JSON model": it discards the reason anyone picks Slate, so it **fails the goal**
  (register the real library), not merely costs more. The community non-React views (`svelte-slate`,
  `slate-vue`) are the only alternative to writing it yourself, and they pull a *different*, less-maintained
  framework — strictly worse than React on every axis. A is excluded under either Fork-1 outcome.

## Context

- **If B ratifies:** lift the could-not-split hold and file the Slate engine **build** as a normal #940 child
  (sized like its siblings), prioritized separately — *whether to build it now* given Lexical's overlap is a
  prioritization call made at scheduling time, not part of this ruling.
- **If C ratifies:** close #963 with Slate recorded as a deliberate non-member; #940's engine set is the
  native floor + Quill + Lexical + ProseMirror.
- **Classification (per-fork pass):** engine adapters are FUI impl (`locus: frontierui`) behind the WE
  `editor-engine` protocol (#629) — no WE standard artifact changes (the seam exists). The engine set is a
  swappable **dimension** (`engineIsSwappable`, #629), not a fixed mechanic; supporting Slate as an opt-in is
  the most-permissive default; React stays fully decoupled from the floor and the other three engines.
- **Relation to #955:** same framework-runtime concern, *different context* — #955 is a devtool *sandbox*
  (React clearly fine there); #963 is a consumer-facing *shipped adapter* (higher bar), so #955's B-default
  doesn't transfer automatically. Cross-ref retained.
- **The Slate build slice under #940 is could-not-split pending this** — scaffold (B) or drop (C) it once
  #963 resolves.
