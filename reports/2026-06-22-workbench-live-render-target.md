# Workbench live-mount render target — prep research (decision #1594)

**Date:** 2026-06-22 · **For:** decision [#1594](../backlog/1594-workbench-live-mount-render-target-into-the-stage-as-subject.md) (blocks #1030, under polyglot-sandbox #912) · **Research topic:** `/research/workbench-live-render-target/`

## The call

When the workbench live-mounts a cross-origin React/Vue wrapper (`?form=react-live`, proven #1501/#1518/#1556), **where does the live render go** — into the **stage** (the slot the native custom element normally renders into, so the existing inspector / event-log / anatomy panels introspect it) or a **separate Polyglot live-preview panel** beside source (with its own introspection wiring)? This dictates where `#1030`'s `mount(el,…)` points.

## What the code actually is (FrontierUI `workbench/`)

Read against the real tree, not the item's stale `:7`/`:633` refs:

- **Stage** = a plain `<div class="wb-stage">` wrapping a container-query sim (`cqWrap`). `renderStage()` does `const next = block.create(); for (trait) applyTrait(next); cqWrap.replaceChildren(next)` — `fui:workbench/mount.ts:186-197`, `fui:workbench/mount.ts:247-262`.
- **Control surface is attribute-driven**: `applyTrait` does `toggleAttribute/setAttribute/removeAttribute` (`fui:workbench/mount.ts:235-244`); design-system presets set `data-intent-*`/`data-trait-*` on the stage (`fui:workbench/mount.ts:314-315`); permalink replays attributes.
- **Panels gate on the block's declaration**: theme `if (block.tokens.length)`, trait/state/transitions `if (block.traits.length)`, event-log `if ((block.events??).length)`, anatomy on `block.anatomy` (`fui:workbench/mount.ts:292`, `fui:workbench/mount.ts:535`, `fui:workbench/mount.ts:693`, `fui:workbench/mount.ts:701`). The introspection *reads* are generic DOM — inspector = `getComputedStyle`+`querySelector` (`fui:workbench/mount.ts:900-939`), event-log = native delegation on the stage (`fui:workbench/mount.ts:683-692`), anatomy liveness = `instance.hasAttribute` (`fui:workbench/mount.ts:711-715`).
- **Export-as-code** (Share panel) reads `instance.localName` + `instance.getAttributeNames()` (`fui:workbench/mount.ts:793-805`).
- **The live wrapper renders the REAL custom element.** `fui:tools/gen-wrapper/genWrapper.mjs` (variants `wrapper`/`live`, `fui:tools/gen-wrapper/genWrapper.mjs:38-40`) "forwards props → attributes/properties and wires events. It does NOT reimplement the custom element" (`fui:tools/gen-wrapper/genWrapper.mjs:18`, `fui:tools/gen-wrapper/genWrapper.mjs:142`); React body is `React.createElement('${tag}', { ref, ...attrProps }, children)` (`fui:tools/gen-wrapper/genWrapper.mjs:154`); Vue binds `'${a.name}': props.${attrFieldName(a)}` (`fui:tools/gen-wrapper/genWrapper.mjs:268`). `mount(el, props) => {update, unmount}` does `createRoot(el).render(<Wrapper>)` (`fui:tools/gen-wrapper/genWrapper.mjs:223-236`) / `createApp(...).mount(el)` (`fui:tools/gen-wrapper/genWrapper.mjs:340-366`) — accepts any `Element`.

## Findings

1. **Prior art is one-sided: a single canonical canvas the panels read is the universal pattern; a second separately-wired introspection pane is the anti-pattern.** Storybook renders every story into one preview iframe and the whole manager reads it; its a11y/interactions/controls addons read the *rendered DOM* "framework-agnostic[ally]… regardless of which framework you use" (axe on rendered DOM; `canvasElement` + Testing-Library queries). Histoire, Ladle (single app, no iframe unless an addon forces isolation), and Bit ("compositions") all do the same. Where a "preview beside source" exists (Storybook Docs `Canvas`, react-styleguidist editable examples) it is the *same render re-presented*, not a second target. Sources in the `/research/` writeup. → Strong precedent for the **stage** (Fork A).

2. **Structured metadata is sourced statically; live behaviour is read from the DOM.** Across Storybook (argTypes vs canvas), styleguidist (propTypes vs example), Bit (API-reference vs composition), the *declaration* layer comes from types/CEM and the *behavioural* layer (a11y, events, computed style) from rendered DOM. WE's workbench already matches this: panels gate on the block's CEM-derived declaration; reads are generic DOM.

3. **The skeptic's refutation rested on a false premise.** A throwaway skeptic (prompted only to refute) returned REFUTED on the grounds that "props ≠ attributes, the custom element isn't there, declaration-gated panels vanish, React synthetic events don't bubble." Tracing `fui:tools/gen-wrapper/genWrapper.mjs` disproves the premise: the `live` wrapper **mounts the real `<auto-complete>`** inside the framework root and forwards attrs+events, so (a) the custom element is present, (b) its native bubbling events (`input`/`change`/`filter`/… all declared bubbling, `fui:workbench/mount.ts:179`) reach the stage → event-log works, (c) the block's CEM declaration exists (same block, different `create()`), so the panels are *not* gated out.

4. **But the skeptic surfaced a real, narrower residual — the subject node is nested, and control is attribute-routed.** Two genuine seams Fork A must close (they are *amendments*, not refutations):
   - **Subject-node resolution.** With `mount(el,…)` doing `createRoot(el)`, the real custom element is a *child* of the stage node, not the node itself. Panels keyed to `instance` (`instance.localName` in export/inspector, `instance.hasAttribute` in anatomy, `applyTrait(instance)`) would target the wrapper root. The live `create()` must expose the inner custom element as the introspection subject (or panels resolve a "subject element" descendant).
   - **Trait/DS control routing.** The wrapper forwards *mount-time props* to the element as attributes; it does not observe the host node's attributes. So `applyTrait` setting attributes on the wrapper root won't reach the element — trait toggles / DS presets must route through `instance.update(props)` (or the live `create()` must re-emit host attributes into the element).
   - **Lifecycle ownership.** `renderStage` calls `cqWrap.replaceChildren(next)` reflexively; over a framework-owned node that orphans the React/Vue root without `unmount()` → leak. The live path must own teardown via the returned `unmount()`.

5. **`exportAsCode` degrades for a framework subject regardless of target.** It emits `instance.localName` markup; for a live render it should emit the wrapper/`?form` source, not the host markup — a known Storybook footgun ("custom `render` ⇒ snippet drifts from DOM unless overridden"). A `#1030` build detail, not a render-target fork.

## Net for the decision

The fork is genuine (one introspection slot — A and B are mutually exclusive there) but **lopsided toward A**: prior art is unanimous on the single-canvas-the-panels-read model, and the verified architecture (real custom element, bubbling events, generic reads, existing declaration) means the stage path reuses event-log + computed-style inspector + anatomy **once the subject node is resolved**. Fork A is *not* "zero new wiring" (the item's original claim is wrong) — it costs the three bounded amendments in finding 4 — but that is materially **less** than Fork B's full second introspection surface, and Fork B has no precedent. Fork B's only unique value (render-beside-source) is *additive*, not an alternative introspection target.

**Recommended default: Fork A (render into the stage), with the finding-4 amendments folded into #1030's scope.** Skeptic verdict: SURVIVES-WITH-AMENDMENT.
