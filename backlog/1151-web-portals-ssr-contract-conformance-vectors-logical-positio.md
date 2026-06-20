---
kind: story
size: 3
parent: "1001"
status: resolved
blockedBy: ["1150"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webportals/conformance/ssrVectors.ts"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — SSR contract conformance vectors (logical-position emit + hydration relocate)

Slice of #1001 (after the directive #1150): conformance for the SSR contract (spec §ssr-contract). Web Portals ships NO SSR runtime — it ships the spec — so this slice is WE-owned conformance VECTORS, not a server impl. The contract: server emits portal content at its LOGICAL position wrapped in `<!-- portal:ID -->` markers with `data-portal=ID`; emits the empty `data-portal-target` container; resolves injector context from logical (not target) ancestors; multiple portals to one target order by logical source order; client finds the markers on hydration and relocates into the target. Progressive baseline: zero-JS shows content inline at its logical position.

## Resolved (batch-2026-06-19) — WE-owned SSR-contract conformance kit + reference oracle

Built the neutral conformance kit at **`we:plugs/webportals/conformance/ssrVectors.ts`** — the portals sibling of `we:blocks/renderers/module-service/conformance/surfaceVectors.ts` (vectors live in WE; an external runner consumes them via the #700/#239 contract seam; no WE→impl runtime import). No SSR server was written — only the spec's vectors + a pure oracle.

- **Marker grammar frozen** — paired `<!--portal:TARGET-->` … `<!--/portal:TARGET-->` markers at the logical position, content roots carrying `data-portal="TARGET"`, an empty `data-portal-target="TARGET"` container at the target site.
- **Reference oracle** (pure, deterministic per #463, browser-safe): `relocatePortals(emit)` models the client hydration relocate (move blocks into the matching target, logical source order, idempotent); `validateEmit` checks the structural invariants (clauses 1+2); `checkVector` grades a vector across all clauses and returns an `ssr-contract`-labelled verdict (the honesty label, never bare `conformance`).
- **Vectors** (`SSR_PORTAL_VECTORS`, 4) cover every clause: single portal marker-emit+relocate, logical-context preservation (clause 3), multiple-portals-to-one-target source ordering (clause 4), a portal escaping a transformed stacking context, and the zero-JS progressive baseline (clause 6 — content present inline before relocate).
- Tests: `we:plugs/webportals/__tests__/unit/webportals.ssr.test.ts` (11 — every vector conforms, relocate moves/orders/idempotent/deterministic, validateEmit rejects missing-target + missing-`data-portal`). Full webportals suite green (47); `tsc --noEmit` clean; `check:standards` green.
