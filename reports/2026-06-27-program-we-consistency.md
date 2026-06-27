# WE consistency watch — living report

Living report for the WE consistency watch (#1852). One section per run, appended in date order. The
program audits the live tree against the standing rules in `we:docs/agent/platform-decisions.md`;
front A is the continuous `we:scripts/check-standards.mjs` gate, front B is the recurring semantic
read (rotating slices of the statute).

---

## Run 1 — 2026-06-27 — first front-B pass (placement/boundary slice)

**Slice audited:** [#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement),
[#we-fui-embed-boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary),
[#devtools-placement](../docs/agent/platform-decisions.md#devtools-placement),
[#reusable-home](../docs/agent/platform-decisions.md) — the slice the creation run queued.

**Delta: 0 new cards.** The placement/boundary front is already saturated by existing tracking, and
an orphan scan found no uncarded residual.

**What the audit found:**

- **#1770 already owns this front.** "Audit the end-state constellation placement once all
  relocations land" is a holding review-gate that performs exactly a constellation-wide end-state
  placement audit — `blockedBy` the full in-flight relocation set (#1294 WE-resident logic runtimes,
  #1245 reference-runtime blocks, #1730 MaaS serve runtime, #1577 explorer→Plateau, #1768
  bootstrap-runtime blocks, #872 contract distribution) and already enumerating today's known soft
  spots (`we:tools/maas/vite-plugin.ts`, the vendored `we:scripts/ingest-adapter/ingestComponent.mjs`
  / `we:scripts/gen-wrapper/cli.mjs` copies). Filing placement-drift cards from this watch would
  duplicate #1770.
- **Orphan scan clean.** Greps for delivery-runtime signals (`customElements.define`, server/route
  handlers, document-rendering) under `we:src/`, `we:tools/`, `we:scripts/` *outside* the
  already-carded dirs returned only `.njk` doc-description templates — example code in documentation,
  not WE-resident runtime. No uncarded residual.

**Steering correction (applied this run):** while #1770 is the live instrument for the placement
front, #1852 **defers placement to #1770** rather than running a parallel audit of the same surface
(fold into the existing watch, don't run a parallel program). The rotation re-points to the slices
the backlog does **not** already cover — a coverage check found **0** dedicated audit cards for the
authoring/derivation rules, the taxonomy-bar rules, and the anti-uniform naming rules. That white
space is where this watch adds value the existing tracking does not.

**Next run:** front-B pass over the **authoring/derivation slice** —
[#single-authoring-sot-derived-projection](../docs/agent/platform-decisions.md#single-authoring-sot-derived-projection),
[#faithful-derivation-exclude-not-fabricate](../docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate),
[#compose-dont-handroll](../docs/agent/platform-decisions.md#compose-dont-handroll) — auditing real
authoring entities (blocks/adapters that emit a serializable projection) for a second authoring home
or a hand-rolled pattern a trait already covers. Re-confirm #1770 still open before re-deferring
placement (idempotent).
