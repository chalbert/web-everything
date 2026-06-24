---
kind: decision
status: open
blockedBy: ["1294", "1245", "1730", "1577", "1768", "872"]
relatedProject: webcomponents
dateOpened: "2026-06-24"
tags: [placement, constellation, zero-implementation, devtools-placement, review-gate]
---

# Audit the end-state constellation placement once all relocations land — confirm the zero-impl / standard·impl·product line is tight

A holding review-gate: once every in-flight relocation has moved its impl/runtime to its correct constellation home, audit the resulting end-state placement as a whole and confirm the zero-implementation line actually holds — rather than trusting that the sum of the individual moves landed tight.

## Why this exists

The placement rules are ratified and individually sound — `we:docs/agent/platform-decisions.md` (#1246/#1282: WE = contract/protocol/interface only, *never* hosts delivery runtime "not even as a reference implementation"; #1565 devtools-placement; #1747 explorer→Plateau). What is **not** yet verified is the **aggregate end-state**: that after every in-flight move lands, every tool/runtime actually sits on the correct side of the standard·impl·product line, with no orphaned copy, no drifted vendored fixture, and no residual runtime left in WE that each individual story scoped past.

This card is the deliberate "step back and look at the whole board once the pieces stop moving" gate. It is **not** a new placement decision and must not re-litigate the settled ones — it is the confirm-or-find-residuals pass.

## What you decide (when un-parked)

After all `blockedBy` resolve, do a fresh constellation-wide tool/runtime inventory (the WE-vs-FUI-vs-Plateau table that surfaced this card) and rule **one** of:

- **A — Tight (go):** the placement holds end-to-end; codify the final placement map into `we:docs/agent/platform-decisions.md` as the standing reference and resolve.
- **B — Residuals found:** file the specific mis-homed / orphaned / drifted items as cleanup stories (each with its correct target home), resolve this as graduated-to-those.

Concrete things to re-check at that point (today's known soft spots, not assertions of error):
- **Vendored byte-identical copies** stay in sync — `fui:tools/ingest-adapter/ingestComponent.mjs` vs `we:scripts/ingest-adapter/ingestComponent.mjs` (#915/#855/#892 sanctioned the copy; confirm it didn't drift), and the gen-wrapper reference fixture `we:scripts/gen-wrapper/cli.mjs` vs canonical `fui:tools/gen-wrapper/` (#855 B2).
- **No delivery runtime left in WE** — `we:tools/maas/vite-plugin.ts` (the #461 reference origin) is an unlisted instance of the #1730 audit; confirm it relocated with the rest of the MaaS serve core, not just `we:blocks/renderers/module-service/`.
- **Reference-fixture vs shipped-standard** boundary held for every build-time codegen that WE keeps to feed a conformance gate (the #506 / `check:standards` fixtures).

## Blocked by (the relocations whose end-state this audits)

- **#1294** (epic) — relocate WE-resident logic reference runtimes (webpolicy + the ~10 #1078 subsystems) → FUI
- **#1245** (epic) — reference-runtime blocks (router, navigation) duplicated/drifting WE↔FUI → de-dup
- **#1730** (story) — relocate the MaaS serving runtime out of WE per #1282
- **#1577** (story) — relocate the whole explorer (engine + CLI + oracles) FUI → Plateau (#1747)
- **#1768** (story) — delete the graduated WE bootstrap-runtime block families + repoint demos
- **#872** (epic) — constellation contract distribution via WE-published type-only contract packages (the end-state distribution mechanism)

Deliberately **excluded**:
- The WE-docs dogfooding migrations (#777, #866, #1599–#1613, #1208) — these move the docs *site* onto FUI components, a different axis (consumer dogfooding), not where a tool/runtime is homed. Fold them in only if the audit should also cover docs-surface consumption.
- **#1743** (re-home the geometry core into a shared region-select module) — initially listed here, then removed 2026-06-24: it is a FUI-internal marquee-select refactor (parent #1734), not a cross-constellation tool/runtime relocation. It does not bear on the zero-impl / standard·impl·product line this gate audits.

## Un-park trigger

All `blockedBy` resolved → readiness surfaces this for the audit pass. (No human action until then; this is intentionally inert while the relocations are in flight.)

## Lineage

Surfaced 2026-06-24 during a constellation-wide WE-vs-FUI tool-placement review (the inventory that confirmed gen-wrapper #855 B2, ingest-adapter #1565/#915, and MaaS #1730 already sit on the right side of the line). Grounds: `we:docs/agent/platform-decisions.md` (#1246/#1282 zero-impl; #1565 devtools-placement), #1747 (explorer→Plateau). This is the aggregate end-state check those individual rulings don't themselves provide.
