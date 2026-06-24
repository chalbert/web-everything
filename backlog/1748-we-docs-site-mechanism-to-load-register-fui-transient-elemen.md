---
kind: decision
status: open
dateOpened: "2026-06-24"
relatedProject: webcomponents
tags: [docs, fui-embed, transient-element, badge, filter-chip, cross-origin]
---

# WE docs site mechanism to load + register FUI transient elements (badge/filter-chip) — bundle vs cross-origin, production-viable

#1598 (migrate the ~25 WE-docs badge/filter-chip surfaces to FUI `<we-badge>`/`<we-filter-chip>` via the #1621 transient-CE model) cannot proceed: the WE docs site (Eleventy, `we:src/_layouts/base.njk`) has **no mechanism to load + register FUI transient elements**, and there is no precedent for one. Verified: `we:src/_layouts/base.njk` loads only local `we:src/assets/js/*.js` (staleness-detector, copy-code, mode-selector, …) — no `@frontierui` import, no `registerBadge`/`registerFilterChip`, no cross-origin FUI bundle, no `customElements.define` for a `we-*` element anywhere in the docs runtime. So an emitted `<we-badge>` would never **upgrade** (it would render as an unstyled unknown element), defeating the migration.

#1621 ratified the *model* (transient CE — registered once + emitted server-side + upgraded in place, not per-instance mode-C); it did **not** stand up the loader the "registered once" clause requires on the WE docs site. That loader is the missing prerequisite, and it carries a real production-viability fork.

## What you decide

How does the **published** WE docs site load + register the FUI `badge` / `filter-chip` runtime so its emitted transient elements upgrade?

- **(a) Bundle the FUI components into the WE docs assets** — a build step pulls `@frontierui/blocks/{badge,filter-chip}` (registration helpers) into a `we:src/assets/js/` bundle the docs load + register once. Production-viable (no second origin at runtime). Cost: a WE→FUI build dependency in the docs pipeline (the docs would import FUI, a new constellation edge to vet against the #700/#872 boundary — is a *docs devtool* importing FUI's published component package allowed?).
- **(b) Cross-origin import from a served FUI origin (#1499)** — the docs `import()` the registration module from a FUI origin. Clean in dev (the #1499 pattern), but the **published** docs have no FUI dev server — needs a real served FUI component origin (a CDN/published `@frontierui` ESM), which is its own infra.
- **(c) Defer the migration; keep the WE-docs badges as the inline-`<span>` macros** — accept that WE docs render their own badges (not FUI dogfood) until a published `@frontierui` component package exists (rides the #872/#907 contracts-publish endstate, generalized to components). The dogfood thesis is proven on plateau-app (the #1254 Control Plane), not necessarily on the WE docs.

## Recommended lean (not ratified)

(c) or (a). The first-party-dogfood thesis (#first-party-dogfood) is about **product** surfaces; the WE *docs* are a different surface, and forcing a WE→FUI build/runtime edge just to style backlog pills is a heavy coupling for low value — (c) defers cleanly until a published component package makes (a) a pinned dependency rather than a cross-repo build hack. Confidence low — this is a real constellation-boundary call.

## Lineage

Surfaced during batch-2026-06-23-1725-1665 working #1598 (un-blocked by #1669 we-tag + #1603 FUI filter-chip, but those shipped the *components*, not the docs *loader*). #1598 is re-pointed `blockedBy` this. Grounds: #1621 (the transient-CE model, `we:docs/agent/platform-decisions.md#we-fui-embed-boundary`), the verified-absent loader in `we:src/_layouts/base.njk`, #1499 (cross-origin import), #872/#907 (the published-package endstate).
