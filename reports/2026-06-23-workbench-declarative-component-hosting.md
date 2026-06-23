# Workbench hosting of a declarative-component author-source case

**Point:** The FUI author-mode panel consumes only pre-emitted SOURCE (name + definition + per-form code/diagnostics), never a live block instance — so a declarative case can carry `authorSource` via a source-only `WorkbenchBlock` shape, and wiring the declarative-component runtime into the workbench registry to make it `create()`-able is scope the author-source path does not consume.

---

## Why this prep ran

#1618 (the author-mode-source wiring story) has two residuals: **Transport** (flat — sync the WE-committed artifact into the live registry) and **Attachment** (open). Attachment surfaced a buried design call in the batch-2026-06-22-1615-1208 pre-flight: `we:src/_data/authorModeSource.json` carries 9 declarative `<component>` cases (`user-card`, `x-callout`, …), but the workbench registers only the imperative `auto-complete` block. To make a declarative case carry `authorSource` *live* in the workbench, the workbench must host it somehow — and the current `WorkbenchBlock` contract requires `load`/`create`, neither of which a source-only declarative case has. #1701 is that decision; this report is its prep grounding.

## The two coherent approaches (the fork)

- **(a) Source-only `WorkbenchBlock`** — relax the registry so a block can declare `authorSource` (and `cem`) without a runnable `load`/`create`; the panel renders the author-source tabs without instantiating a live element.
- **(b) Wire the declarative-component runtime** — pull a `<component>`→live-element lowering into `fui:workbench/registry.ts` so a declarative case becomes a real `create()`-able block (live render + the full theme/trait/inspect chrome), of which `authorSource` is one more panel.

## Concrete-refs check (real FUI tree)

- **`WorkbenchBlock` requires `create()`.** fui:workbench/registry.ts:91-141 — `load: () => Promise<void>` (:97) and `create: () => HTMLElement` (:104) are **mandatory** (no `?`). `authorSource?` (:140) and `cem?` (:130) are already optional. So today a block cannot exist without a runnable element.
- **The shell calls both unconditionally.** fui:workbench/mount.ts:172 does `await block.load()`; `renderStage()` (:248-263) calls `block.create()` on first mount and every trait change. A source-only block would null-route every live panel (theme/trait/inspect/event/anatomy) — those read `instance`.
- **The author-mode panel needs ONLY source data — no instance.** fui:workbench/authorMode.ts:57-112 (`renderAuthorModePanel`) takes an `AuthorModeSource` (`{ name, definition, forms[] }`, :37-44) and builds tabs purely from pre-emitted strings; its docblock states it is "Pure of any live block state." fui:workbench/mount.ts:675-677 gates it on `if (block.authorSource)` and passes only the data. **This is the decisive ref: the consumer of the decision touches no `instance`.**
- **The artifact shape matches.** we:src/_data/authorModeSource.json — `cases[]` each have `{ id, name, title, definition, forms[] }`, `forms[]` = `{ form, label, language, code, lossy, diagnostics }`, the exact shape `AuthorModeSource`/`AuthorModeForm` declare. A source-only block carries one case's slice directly, the way `auto-complete` carries its `cem` literal.
- **fui:plugs/webregistries/declarativeRegistry.ts is NOT the lowering the item assumes.** That module implements `<script type="registry">` **scoped registration** (#854/#901) — it binds a `registry="id"` attribute to a scoped `CustomElementRegistry`; it does **not** turn a `<component>` definition into an instantiable element. The actual `<component>`→element path is the build-time transform fui:compiler/src/component-transform/declarative.ts (`parseDeclarative` → `ComponentIR`). So (b) is "pull a build/runtime lowering + define the element + give it a `create()`," materially heavier than "wire one registry helper," and the item's framing of (b) overstates how ready that wiring is.

## Roadmap check — does any consumer need a live declarative-component instance in the workbench?

The 746 epic's live-render slices — #912 (polyglot live-test sandbox) and #967 (behavioral wrapper-conformance badge) — mount the **generated React/Vue wrapper** live (the consume-mode path: the wrapper USES a tag). None of them mount the **author-source declarative `<component>`** as a live block. The author-source surface across the whole roadmap is source-tabs-only. So "a `create()`-able declarative block in the workbench" has **no consumer in the ratified roadmap** beyond rendering source — the positive-disproof the fork-existence test demands for excluding (b).

## Recommendation (prep default — not a ruling)

**(a) source-only `WorkbenchBlock`.** What the author-source panel actually requires is rendered text + diagnostics (the same #700-seam minimum #818/#954 already established); a live instance is unused by it and unrequested by any roadmap slice. (a) is also the decoupled branch (bias-toward-separation): the panel only needs SOURCE, so don't pull a `<component>`-lowering runtime into the workbench registry to serve a source-only surface. (b) stays available as a *separate* future capability if a live-declarative-render slice is ever filed — it is excluded here as the hosting mechanism for a source-carrying case, not forbidden as a feature.

## Skeptic

Attacked (a) — strongest case for (b): "the workbench's whole value is the live chrome; a source-only tab with no rendered element is a degenerate workbench entry, and the declarative cases deserve the same theme/trait/inspect treatment `auto-complete` gets, which only (b) delivers." **Refuted on merit, not effort:** the live chrome is real value, but it is a value for a *live-render* slice — and that slice does not exist for declarative author-source cases, while it DOES exist (#912/#967) for the consume-mode wrapper path. (a) does not foreclose (b): the moment a live-declarative-render slice is filed, (b) is built then, for *that* consumer. Hosting a source-only case as source-only is exactly faithful to what it is; padding it with an unused live instance is scope no consumer reads. SURVIVES — beat the "degenerate entry" attack: source-only is the honest shape for a source-only surface, and the live-render capability rides its own future consumer.
