# Backlog split analysis — #1254 (rebuild plateau-app UI on FUI components)

**Date:** 2026-06-20
**Scope:** focused slice of epic [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-inte/) (unsliced epic, just unblocked by the #1253 charter ratification). `/slice 1254`.

## Investigation (the real tree, not the body's framing)

- **plateau-app's FUI consumption today** is SSR/web-docs only: `@frontierui/jsx-runtime/server`, `@frontierui/webdocs-generator`, `@frontierui/webdocs-ui`, plus the **plugs bootstrap** (`plateau:src/main.ts:10` — `import '@frontierui/plugs/bootstrap'`, which "registers router + event attrs" and already upgrades `route:link` behaviors at `plateau:src/main.ts:521`). **No interactive FUI block behaviors are wired** (`registerNavigation`/`registerDroplist`/etc. are never called).
- **FUI ships 43 blocks** (`fui:blocks/*`), consumed as **CustomAttribute behaviors** registered on a `CustomAttributeRegistry` (e.g. `fui:blocks/navigation/registerNavigation.ts:17` defines `nav:list`/`nav:section`/`nav:menubar`). The integration seam = register FUI behaviors on the plugs registry, then author plateau HTML carrying those attrs.
- **All 8 surface files exist** (line counts: intent-configurator 403, technical-configurator 619, component-assembler 161, platform-map 142, control-plane 168, main 544, theme 93, index 318).
- **No FUI DTCG token base exists.** FUI blocks are unstyled/bring-your-own-CSS (per-demo CSS like `fui:demos/loan-origination/app.css`). The epic's "re-express over FUI's token base" premise is a **wrinkle**: there is no shared FUI token base — each consumer themes the behavior-enhanced HTML itself. The theme slice is therefore "author plateau's DTCG theme as the CSS layer for FUI-enhanced markup," not "rebase onto FUI tokens."

### Surface → FUI-block availability map

| Surface | FUI block(s) needed | In FUI today? | Verdict |
| --- | --- | --- | --- |
| Theme layer (`plateau:src/styles/theme.css`) | DTCG token layer for FUI-enhanced HTML | n/a (consumer-themed) | **CAN SLICE** — foundation, no FUI gate |
| Nav / sidebar (`plateau:index.html`, `plateau:src/main.ts:521`) | `navigation` (`nav:list/section/menubar`) | ✓ `fui:blocks/navigation` | **CAN SLICE** — integration-pilot |
| Auth / profile (`plateau:src/main.ts`) | `droplist` / `type-ahead` | ✓ `fui:blocks/droplist`, `fui:blocks/type-ahead` | **CAN SLICE** — after pilot |
| Intent Configurator | form controls, droplist, radio/checkbox, verdict panel | droplist ✓; **radio/checkbox/text-field ✗** | could-not-split — gated on FUI form controls |
| Technical Configurator | form controls, droplist, NL input box | droplist ✓; **text/number input ✗** | could-not-split — gated on FUI form controls |
| Component Assembler | tabs, cards, code viewer | tabs ✓, code-view ✓; **card ✗** | could-not-split — gated on FUI `card` |
| Control Plane dashboard | status badges, tables | data-grid ✓; **badge ✗** | could-not-split — gated on FUI `badge` |
| Platform Map | graph/node viz | **✗** (epic flags "likely a gap") | could-not-split — file FUI graph-viz gap |

## Could split (carve now) — 3 slices

The epic is a **ratchet** ("carve as FUI parts land"). Three slices are agent-ready against proven/existing infra:

| Slice | workItem · size | Files | blockedBy |
| --- | --- | --- | --- |
| **Theme: express the plateau theme as a DTCG token layer** | story · 3 | `plateau:src/styles/theme.css` | — |
| **Nav/sidebar onto FUI `navigation` behaviors (integration-seam pilot)** | story · 3 | `plateau:index.html`, `plateau:src/main.ts:521`; `fui:blocks/navigation/registerNavigation.ts` | — |
| **Auth/profile onto FUI `droplist`/`type-ahead`** | story · 2 | `plateau:src/main.ts`; `fui:blocks/droplist`, `fui:blocks/type-ahead` | nav-pilot |

**DAG:** theme (independent) ‖ nav-pilot (independent) → auth (blockedBy nav-pilot, reuses the proven registration pattern). All three leave a demoable plateau-app at `:4000`. Nav-pilot is the foundational proof that the plugs-registry → FUI-behavior seam works; auth rides it.

## Could not split (gated) — 5 surfaces

Each fails rubric (2)/(4): the agent-ready build can't start because the FUI component doesn't exist. Per [first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood), the residue is a **gap to file**, not a hack — these convert to slices once the FUI build lands (the ratchet).

| Surface | Failed condition | Unblocking action |
| --- | --- | --- |
| Intent Configurator | no FUI form controls (radio/checkbox/text-field) | ship FUI form-control blocks, then slice |
| Technical Configurator | no FUI text/number input | ship FUI input blocks, then slice |
| Component Assembler | no FUI `card` | ship FUI `card` block, then slice |
| Control Plane dashboard | no FUI `badge` | ship FUI `badge` block, then slice |
| Platform Map | no FUI graph/node viz | file FUI graph-viz gap (decision: build vs. accept as standing gap), then slice |

**Recommended follow-up (not part of this slice):** file the FUI-component gaps (form controls, `card`, `badge`, graph-viz) as `locus: frontierui` items so the gated surfaces have real `blockedBy` targets. Deferred to keep this slice focused on what's carvable now.

## Net

Carve **3 slices** under #1254 (theme, nav-pilot, auth); **5 surfaces** stay could-not-split behind their FUI-component gaps. Matches the epic's own ratchet design.
