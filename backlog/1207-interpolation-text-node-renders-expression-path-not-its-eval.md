---
type: issue
workItem: story
status: active
locus: webeverything
dateOpened: "2026-06-20"
size: 3
tags: [webexpressions, interpolation, text-node, injector, binding, demo]
---

# `{{ }}` interpolation renders the expression's *path* ("name"), not its evaluated value ("World")

## Symptom

On a freshly cold-started dev server (after #1202 fixed config-load), the
`we:demos/text-interpolation-demo.html` plug modules now load (no more 500s) and
`customTextNodes.upgrade()` runs — but every binding renders the **raw expression path**
instead of the looked-up value:

| Source | Renders | Should render |
| --- | --- | --- |
| `{{name}}` | `Hello, name!` | `Hello, World!` |
| `{{user.profile.name}}` | `User: user.profile.name (…)` | `User: Jane Doe (Platform Engineer)` |
| `{{name \| uppercase}}` | `Shouting: name \| uppercase` | `Shouting: WORLD` |

So it's neither static `{{ }}` syntax nor a live value — the delimiters are stripped and
the expression *source* is emitted. This is **separate from #1202** (which was config-load /
cold-start only; this reproduces on a clean fresh server).

## Diagnosis (narrowed, not yet root-caused)

Probed in-browser on the fresh server — every input to evaluation is correct:

- **Parse is correct.** `registry.parse('name').queries` →
  `[{ type: 'context', context: 'state', path: 'name' }]`.
- **The context resolves from an Element.**
  `InjectorRoot.getProviderOf(document.body, 'customContexts:state')` returns the full demo
  state `{ name: 'World', user: {...}, … }`.
- **The parser registry is present** (`customExpressionParsers` provider found; no
  "registry not found" / "failed to parse" warnings fired).

Yet `we:blocks/text-nodes/interpolation/InterpolationTextNode.ts` `#evaluate()` returns the
path string. Leading hypothesis (~70%): `#resolveQueries()` calls
`InjectorRoot.getProviderOf(this, 'customContexts:state')` where **`this` is the Text node**;
if the injector walk doesn't resolve from a Text node (only from Elements), `resolved.contexts`
stays empty and `expression.evaluate(resolved)` falls back to emitting the query path verbatim.
Residual: it could instead be the `evaluate()` fallback itself (returning `path` when a
context key is absent). Confirm by instrumenting `#resolveQueries` (log the resolved value)
and testing `getProviderOf(<a Text node>, 'customContexts:state')` directly — the
"context patch applied to **Node**" boot log suggests Text nodes *should* participate, so the
fallback-path branch is worth checking too.

This likely traces into the `@frontierui/plugs/webexpressions` evaluate path and/or
`@frontierui/plugs/webinjectors` Text-node resolution (FUI-owned impl) — scope the fix at the
WE↔FUI seam accordingly once root-caused.

## Acceptance

- [ ] `we:demos/text-interpolation-demo.html` RESULT boxes show evaluated values
      ("Hello, World!", "Jane Doe", "WORLD", "#6366f1", "Jane Doe") on a fresh server.
- [ ] A unit/integration test asserts a `{{ctx.path}}` text node resolves its value from an
      injector-provided context (covering the Text-node injector-walk path).
