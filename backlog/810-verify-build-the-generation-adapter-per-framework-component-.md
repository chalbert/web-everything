---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: "backlog/811-decide-the-forward-component-emit-substrate-per-framework-em.md — verify complete; forward-emit substrate fork filed as #811, #753 re-pointed"
tags: [adapters, polyglot, generation, emitters, conformance, webdocs]
---

# Verify/build the generation-adapter per-framework component emitters (React/Vue/Svelte/Angular/WC) the polyglot panel needs

The polyglot adapter panel (#753) generates a block across frameworks and live-tests each in a sandbox. That centrepiece needs **runnable per-framework component emitters** (React/Vue/Svelte/Angular/native WC) on top of the resolved IR→emit core (#547) — but #547/#506 deliver the deterministic IR + conformance suite, not necessarily executable per-target output. Verify whether those emitters exist; if not, build the missing subset so #753's sandbox has real output to run and badge. Surfaced 2026-06-16: #753 pre-flighted batchable (`blockedBy: 547` satisfied) but its real prerequisite was unconfirmed, so #753 now `blockedBy` this. Verify-then-build; size pending the verify.

## Verification verdict (2026-06-16) — emitters absent, build is decision-gated

Verified against the tree: the forward per-framework **component** emitters #753 needs **do not exist**,
and no existing neutral substrate forward-emits to them.

- **#547's core is the wrong axis** — [languageBackend.ts](../blocks/renderers/module-service/generation/languageBackend.ts)
  is `(ServePathIR) => GeneratedOrigin`: it emits a **MaaS server origin** (core + HTTP shell) from a
  serve-path IR, `javascript`/`csharp` backends. Server-side polyglot (#463/#505/#507), not UI components.
- **`ComponentIR` is ingest-only** — [upgraderEngine.ts:38](../blocks/renderers/upgrader/upgraderEngine.ts#L38)
  + [frameworkAnalyzers.ts](../blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts) normalize
  frameworks *into* it; the only forward emit ([upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135))
  renders the WE declarative form, not React/Vue/Svelte/Angular source.
- **`htmlToJsx`** ([htmlToJsx.ts](../blocks/renderers/jsx/htmlToJsx.ts), #235) is a tree-level JSX-*pane*
  mirror (React/JSX only), not a runnable component emitter.

The "build the missing subset" framing is falsified: it's a new forward-emit architecture gated on a
substrate **design decision**, not a mechanical fill. Filed that fork as **#811**; #753 re-pointed to it.
The eventual emitter build is a separate item filed once #811 resolves. Verify deliverable complete.
