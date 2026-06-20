---
kind: story
size: 5
parent: "1001"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: plugs/webportals/Node.logical.patch.ts
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — logical-tree polyfill (Node.logicalParent + logical ancestry)

Foundation slice of #1001: implement the logical-tree primitive in the plugs layer (we:plugs/webportals/). A writable element-reference Node.logicalParent reflecting the declarative logicalparent="id" IDREF (mirrors popoverTargetElement), with a setter that validates the graph (HierarchyRequestError on a cycle), detaches from the prior logical parent, and fires logicalparentchange; read-only logicalInjector / logicalAncestors() / isLogicalDescendantOf(); getContext() and the injector chain resolve via logical ancestry rather than parentNode. Mirrors sibling `we:plugs/webinjectors/Node.injectors.patch.ts` / `we:plugs/webcontexts/Node.contexts.patch.ts`. Per #1000 Fork 1.
