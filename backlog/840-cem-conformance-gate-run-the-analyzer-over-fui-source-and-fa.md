---
kind: story
size: 8
status: resolved
blockedBy: ["838", "839", "910"]
locus: frontierui
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards.mjs
tags: []
---

# CEM conformance gate: run the analyzer over FUI source and fail on drift against WE's declared CEM

The home for the #801-rejected analyzer-as-source engine, recast as verifier (the #463 deterministic-conformance posture): FUI runs @custom-elements-manifest/analyzer over block source and the derived CEM is compared to WE's authored/declared CEM, failing the gate on drift. Also where the deferred programmatic/private JS surface (excluded from WE's authored contract per Fork-1=B) can be impl-scanned if a programmatic-API table is ever wanted. Separately-prioritized; blocked by #838 (needs the authored CEM to compare against).

**Also blockedBy #839 + locus retag (added 2026-06-17, batch pre-flight).** Verified: WE's emitted `we:custom-elements.json` currently has **0 custom-element declarations** (75 plain `class` declarations) because no `fui:blocks.json` entry carries a `tagName` — gen-cem only emits a `customElement` when a tag is present. A conformance gate that drift-checks FUI's analyzer-derived custom-elements against "WE's declared CEM" therefore has **nothing to compare against**, and the element-alignment key (tagName) doesn't exist until [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention/) ratifies and the surface is authored ([#839](/backlog/839-backfill-authored-public-api-member-fields-attributes-proper/), itself blockedBy #841). So this waits on #839. Also retagged `locus: frontierui` — the gate runs `@custom-elements-manifest/analyzer` (not installed in FUI yet) over **FUI block source** and lives alongside #783's Check 2 in `fui:frontierui/scripts/check-standards.mjs` (the WE→impl conformance direction #822 ruled).

## Claimed batch-2026-06-18 — two walls surfaced; released, blocked on new decision #910

Claimed once #838/#839/#841/#843 resolved (WE's CEM now has **7** `customElement` declarations with
`we:custom-elements.json` tagNames: `we-autocomplete`, `we-background-task-surface`, `we-data-table`,
`we-pagination`, `we-route-view`, `we-route-outlet`, `we-transient-component`). The pre-build probe found
this is **not** a clean mechanical story·8 — two genuine seams, neither improvisable mid-batch:

1. **The stock analyzer detects ZERO of FUI's elements (verified).** FUI registers via **split** and
   **parameterized** registration — `customElements.define('route-view', RouteViewElement)` lives in
   `fui:blocks/router/registerRouter.ts`, separate from the class in
   `fui:blocks/router/elements/RouteViewElement.ts`; `page-nav`/`data-table` register via
   `register*(tag = 'default')` functions (#841 §Axis-framing). Running
   `@custom-elements-manifest/analyzer` over the element-class globs produced an **empty manifest** (0
   customElements). Deriving FUI's CEM at all needs a **custom analyzer plugin** that understands FUI's
   `register*.ts` + parameterized-define pattern — a non-trivial sub-build with its own unknowns (a
   parameterized default tag isn't statically a concrete tag).
2. **No defined alignment between WE's declared tags and FUI's actual tags.** #841 set the WE contract tag
   to `we-<id>`, but FUI's 7 real tags are **legacy bare kebab** that differ — sometimes in the *stem*:
   `we-autocomplete`↔`auto-complete`, **`we-transient-component`↔`auto-heading`**, `we-pagination`↔`page-nav`,
   `we-route-view`↔`route-view`. So a tagName-equality drift check would **red-fail all 7** unless FUI first
   migrates to the #841-ruled tags, OR the gate compares **member-surface only** (attributes/properties/slots)
   and treats tag as non-comparable. That is a real design choice (with a FUI-tag-migration prerequisite on
   one branch), not a mechanical detail.

Filed both as decision **#910** (CEM-conformance derivation + alignment strategy) and added it as a
`blockedBy` edge; released to `open`. The analyzer is still not installed in FUI (deferred until #910
picks the derivation approach). Once #910 rules, this becomes the buildable gate (likely warn-first, per
the #636/#726 staging).

## Progress — built (2026-06-18)

#910 ratified (provisional): (a) align WE element → FUI source by the CEM declaration's module path;
(b) compare **member-surface only**, deferring tag-equality. Built the **CEM member-surface drift gate** in
`fui:frontierui/scripts/check-standards.mjs`:

- **Alignment key** — each `we:custom-elements.json` custom-element declaration carries a
  `@frontierui/blocks/<dir>/` module `path`; that path (not the tag or class name, which both differ across
  the WE↔FUI seam) maps the WE element to its FUI source dir. The earlier "no alignment key" wall is solved
  by this existing path.
- **Member-surface derivation** — for each WE element, scan the FUI source under its module path for the
  declared attribute surface (`static observedAttributes` arrays + any `attributes.define` names) and compare
  against the WE-authored `attributes` (excluding `aria-*`/`data-*` pass-throughs, which aren't component
  members). Drift = a WE-declared component attribute the FUI impl doesn't expose, or a path with no element
  surface to verify. Tags are **not** compared (deferred to #844/#908 per #910-b).
- **Lighter than #910-a's full plugin, by design.** #910-b defers tag-derivation — exactly the hard part the
  `@custom-elements-manifest/analyzer` custom plugin existed for ("a parameterized default tag isn't
  statically a concrete tag") — so the member-surface first cut reads `observedAttributes`/`attributes.define`
  directly instead of installing + configuring the analyzer. #910 is provisional and invites revisiting (a)
  toward the full analyzer if richer member comparison (properties/slots/methods) is later wanted.
- **Staged warn-first** (`CEM_DRIFT_ENFORCED = false`, like the #844 gate): verified **0 errors**, 5 CEM-drift
  warns surfaced (real drift — e.g. `route:guard`/`route:loader`… not in `RouteViewElement`'s
  `observedAttributes`; the `we-autocomplete` CEM path `blocks/autocomplete/` resolves to no element surface
  since the impl lives in `blocks/droplist/`). Flip the flag to ERROR once the WE↔FUI member surfaces are
  reconciled (the warns are the worklist). FUI `check:standards` green.
