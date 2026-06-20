---
kind: story
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

## Root cause — PROVEN (a #449 duplicate-module `instanceof` split)

My first hypothesis (Text-node injector resolution) was **disproved** — every primitive works:
parse → `{context:state, path:name}` ✓; context resolves ✓; `expression.evaluate(...)` → `"World"` ✓;
a hand-built `InterpolationTextNode`, inserted + `connectedCallback()` → `"World"` ✓ (all verified
in a real browser via Playwright on the running server).

The break is in the **upgrade wiring**. `we:plugs/bootstrap.ts` (which the demo imports by relative path) wires the **WE-local** `CustomTextNodeRegistry`
(`we:plugs/webexpressions/CustomTextNodeRegistry.ts`, which imports `CustomTextNode` from the
WE-local `./CustomTextNode`). But the block layer — `we:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts`
and `we:blocks/text-nodes/interpolation/InterpolationTextNode.ts` — imports the plug layer via
`@frontierui/plugs/webexpressions/*` (the **FUI sibling** copy, per #449). So two different
`CustomTextNode` classes coexist in one runtime. Proven in-browser:

```
weClass_eq_fuiClass : false      // WE-local CustomTextNode !== FUI CustomTextNode
node_instanceof_WE  : false      // parser-produced node is NOT the registry's class…
node_instanceof_FUI : true       // …it's FUI's
node_determined     : false, parserName: 'mustache'   // otherwise perfectly upgradeable
```

`CustomTextNodeRegistry.#upgradeTextNode` (registry line ~105) guards with
`textNode instanceof CustomTextNode` (the **WE-local** class). The FUI-produced node fails that
guard → the node is returned un-upgraded → the raw expression text (`"name"`) renders. Confirmed the
fix: pointing the registry at the **FUI** copy upgrades `Hello, {{name}}!` → `"Hello, World!"`.

## Fix direction (proven, but a #449-completion call)

Align the demo's plug bootstrap onto the **same** plug copy the blocks use — import the
webexpressions registries in `we:plugs/bootstrap.ts` from `@frontierui/plugs/webexpressions`
instead of WE-local `./webexpressions`. This completes #449 (block runtime consumes `@frontierui/plugs`)
for the bootstrap, which it half-missed. (Injector/context resolution is **not** class-identity
sensitive — those resolved fine across the split — so only the text-node registry's `instanceof`
guard is affected.) Scope check before landing: confirm no other demo relies on WE-local-class
custom text nodes, and decide whether WE-local `plugs/webexpressions` runtime should remain at all.

## Testing gap this exposed (the "improve testing" ask)

The existing tests are **green yet missed this**: `we:blocks/__tests__/integration/text-node-pipeline.test.ts`
is mislabeled "integration" — it runs a **hand-rolled `runPipeline`** (parse + evaluate by hand,
lines ~58–81), NOT the real `CustomTextNodeRegistry.upgrade()` DOM path the demo uses. And the unit
tests run under happy-dom, which doesn't model real-browser custom-`Text`-subclass insertion. So the
actual upgrade→DOM→evaluate path was untested. Add a **real-browser (Playwright) regression test** that
calls `customTextNodes.upgrade()` on a connected node and asserts the rendered value.

## Acceptance

- [ ] `we:demos/text-interpolation-demo.html` RESULT boxes show evaluated values
      ("Hello, World!", "Jane Doe", "WORLD", "#6366f1") on a fresh server — verified in a real browser.
- [ ] A **real-browser** test drives `customTextNodes.upgrade()` end-to-end and asserts the rendered
      value (not a hand-rolled pipeline, not happy-dom-only).
- [ ] No second duplicate-`CustomTextNode` split remains (one plug copy at runtime).
