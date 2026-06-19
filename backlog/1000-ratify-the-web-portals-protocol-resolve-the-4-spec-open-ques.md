---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, design]
---

# Ratify the Web Portals protocol — resolve the 4 spec open questions

Surfaced by #993 (webportals had a 1322-line spec but no owning design item). The spec
(`we:src/_includes/project-webportals.njk`, `status:concept`) is mature and still the intended
direction — it integrates cleanly with the constellation (Web Injectors as the logical-tree backbone,
Web Contexts for resolution, Web Directives for the portal directive) and is **not** superseded by the
WICG Portals proposal (a different concept, per the spec's own §wicg-portals-note). It proposes a
polyfillable protocol: `Node.logicalParent`/`logicalInjector`/`logicalAncestors()`, logical event
propagation (`bubblesLogical`/`logicalPath`/`stopLogicalPropagation()`), a portal directive, and an SSR
contract.

What's missing is **ratification of the protocol shape** — the spec carries four genuine open questions
that gate any implementation (#1001). This decision resolves them.

## Open questions to resolve (from the spec §status → Open Questions)

1. **`logicalParent` — writable property vs set-via-method?** A plain writable DOM property is the most
   ergonomic/declarative surface but is harder to validate (cycle detection, invalidation on reparent);
   a method (`setLogicalParent(node)`) gives a hook for those checks. (default lean: **writable property**
   with an internal cycle guard, mirroring `parentNode`'s model.)
2. **`bubblesLogical` × Shadow DOM event retargeting** — how does logical bubbling compose with the
   existing shadow-boundary retargeting? Define whether `logicalPath` is computed pre- or post-retarget,
   and what `composed` means across a logical hop.
3. **Focus scopes — fold into the portal directive, or keep separate?** Overlays/modals need focus
   containment; decide whether that's a portal-directive responsibility or a sibling concern (likely a
   separate `inert`-based concern the directive composes with).
4. **Deferred target resolution** — behaviour when the portal target doesn't exist yet (Vue 3.5's
   `defer`): error, queue-until-present, or no-op-until-present?

## Boundary note (placement)

Per the WE=contracts rule (a framework-specific runtime/impl is never a `@webeverything` artifact): the **protocol** (the
`logicalParent` property contract, the logical-propagation event contract, the directive contract) is
the `@webeverything` artifact; the **polyfill/runtime impl** is FUI (#1001). This decision settles only
the contract shape.

> **Status: open, un-prepared.** Surfaced, not researched. Run `/prepare` to bring the four forks to DoR
> (prior-art survey of React `createPortal` / Vue `<Teleport>` / Angular CDK Portal lifecycle semantics,
> a bold default per fork) before the ratification turn.
