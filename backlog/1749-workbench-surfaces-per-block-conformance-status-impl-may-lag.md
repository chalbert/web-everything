---
kind: story
size: 5
parent: "746"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 746
tags: []
---

# Workbench surfaces per-block conformance status (impl may lag newest standards)

The block workbench/explorer must EXPOSE each block's conformance status against its standard, not only render it — because FUI is an impl that will lag the very newest standards, so a shown block may be partially- or non-conformant. Surface the webcompliance verdict (pass/partial/fail + which vectors/clauses fail) alongside the live stage and author-mode source, so a viewer sees not just what a block looks like but how compliant the current impl is against the standard it claims. Distinct from #1731 (block-shape resolution): this is a conformance-visibility surface on the workbench. Parent #746.

## Progress (batch-2026-06-26-1745-1775)

Built the workbench conformance-visibility surface (the #746 *expose-it* slice; distinct from #1731
block-shape and from the #899 runner that PRODUCES the verdict):
- `fui:workbench/conformanceStatus.ts` — `ConformanceClaim` (per-vector pass/fail + failing clause),
  `buildConformanceStatus` (aggregate verdict pass/partial/fail/**unknown**), `renderConformanceStatus`
  (a standard-named badge + the failing-vectors/clauses list). Mirrors the `surfaceContractBadge` shape;
  honest per #913 — names the standard, never a bare "conformance ✓".
- `fui:workbench/registry.ts` — `conformance?: ConformanceClaim` on the `WorkbenchBlock` descriptor (a block
  carries its result the way it carries `cem`/`authorSource`; the runner #899/#1597 produces it).
- `fui:workbench/mount.ts` — the Conformance panel mounts alongside the live stage + author-mode source. A
  block with no declared result still shows the panel in an honest **"not yet measured"** state — itself the
  #1749 signal that THIS impl's conformance is unverified (FUI may lag the standard), never a silent pass.
  +verdict-colour CSS.
- `fui:workbench/__tests__/conformanceStatus.test.ts` — 7 tests (verdict aggregation, failing-list, unknown).

Scope held: this surface OWNS the view-model + render; running vectors to produce the verdict stays with the
conformance runner (#899/#1597). FUI `check:standards` baseline-steady (34); 7 tests green; tsc clean.
