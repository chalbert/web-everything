---
type: idea
workItem: epic
status: open
blockedBy: ["1000"]
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, build]
---

# Implement Web Portals — logical-tree polyfill + portal directive

Build the webportals protocol once its shape is ratified (#1000). Surfaced by #993: the spec
(`we:src/_includes/project-webportals.njk`) has zero implementation today.

Anticipated slices (to be carved once #1000 ratifies — sizes/forks may shift with the ruling):

- **Logical-tree polyfill (plugs layer / WE contract surface):** `Node.logicalParent` /
  `logicalInjector` / `logicalAncestors()` / `isLogicalDescendantOf()`, with `getContext()` and the
  injector chain resolving via logical ancestry rather than `parentNode`.
- **Logical event propagation:** `bubblesLogical` on `EventInit`, `Event.logicalPath`,
  `stopLogicalPropagation()` — bubbling through the logical tree (resolution per #1000 Q2).
- **Portal directive (FUI impl):** the `CustomTemplateDirective` that relocates content to a target
  while preserving logical relationships; deferred-target behaviour per #1000 Q4.
- **SSR contract conformance:** server emits portal content at its logical position; client relocates on
  hydration (per the spec §ssr-contract).
- **Conformance demo:** a real-browser demo exercising overlay/modal/tooltip escape with preserved
  context + logical event bubbling.

Blocked on #1000 — the contract shape (writable-vs-method `logicalParent`, shadow-retarget composition,
focus-scope boundary) must settle before impl. Per WE=contracts: protocol → `@webeverything`, polyfill +
directive runtime → FUI (impl/tooling is never a WE standard artifact).

## Ratified contract shape (from #1000, 2026-06-19)

The four open questions are settled (spec edits applied to `we:src/_includes/project-webportals.njk`):

- **`logicalParent`** — a **writable element-reference property** (mirroring `popoverTargetElement`)
  reflecting a declarative `logicalparent="id"` IDREF attribute; the setter validates the graph
  (`HierarchyRequestError` on a cycle), detaches from the prior logical parent, and fires
  `logicalparentchange`. No `setLogicalParent()` method. `logicalAncestors()`/`logicalInjector` stay
  read-only.
- **Logical events** — a **separate** opt-in `composedLogical` flag + `composedLogicalPath()` (never an
  overload of native `composed`); `logicalPath` computed **pre-retarget**; the retarget host at a logical
  hop is the **declaration element** (not the mount/outlet), so `event.target` stays in the listener's
  logical tree.
- **Focus** — **not** a portal concern; compose the [Focus Containment Intent](/intents/focus-containment/)
  (no `focusscope`/`createFocusScope`).
- **Deferred targets** — **deferred-by-default** (attach-or-observe); diagnostic at a **structural**
  trigger (DOMContentLoaded / one `requestAnimationFrame`), **not** a wall-clock timeout; a `required`
  attribute opts into a synchronous throw.

**Impl residual to verify (Fork 4):** confirm the shared root `InjectorRoot` `MutationObserver` is
**document-rooted** — i.e. it sees a target appended to `document.body` by unrelated code. If it is
subtree-scoped, add **one** timer-free root-level fallback observer (never one observer per portal). This
is the only sub-decision left to the build; it does not change the contract.
