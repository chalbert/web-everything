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
