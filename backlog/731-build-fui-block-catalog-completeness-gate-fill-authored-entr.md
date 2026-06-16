---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["706"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
tags: []
---

# Build FUI block-catalog: completeness gate + fill authored entries + render /blocks/ from manifest

Execute the #706 ruling for FUI. Add a check-standards completeness invariant that FAILS if any implemented blocks/ family (24 dirs) has zero entries in src/_data/blocks.json — mirroring check-demos' every-folder-registered rule. Fill the ~17 missing authored entries (curated summary/type/protocol/weSpecPath) so 7/24 coverage becomes complete-by-gate. Render FUI's own /blocks/ catalog (frontierui/src/blocks.njk) from the manifest via WE's authored->CEM path (#626), no parallel analyzer. Document derivation-source as a supported dimension in the Web Docs standard (authored=default/reference; impl-scan=opt-in). WE never renders these blocks; #701 fuiDemo iframe owns demo embedding.

## Status: outgrew size·5 + surfaced a definitional fork (released from batch-2026-06-15, unstarted)

Pre-flight read CLEAR, but starting it surfaced that the "24 dirs → one entry each" premise is too naive and the work is really 4 deliverables across 2 repos. The blocker is **frontierui's existing cross-repo invariant** (`scripts/check-standards.mjs` §51–61): every `blocks.json` entry's `weSpecPath` must resolve to an existing WE block id. So filling entries is not free authoring — each frontierui family must map to a real WE spec. Auditing the 23 non-`__tests__` dirs against WE's `blocks.json`:

- **Dir name ≠ block id** (needs a mapping, not a 1:1 rule): `navigation` → WE `nav-list`/`nav-section`; `stores` → `simple-store`; `transient` → `transient-component`; `parsers`/`attributes` hold **several** blocks each (e.g. parsers → handler-/double-curly-/double-square-bracket-parser).
- **Infra, not catalog blocks** (no WE spec, shouldn't be gated as families): `renderers`, `text-nodes`, `traits`, `audit`(?), `attributes`(?).
- **Clean 1:1 with a WE spec:** background-task-surface, data-grid, droplist, for-each, lifecycle, master-detail, resource-loader, router, selection, stepper, tabs, tree-select, type-ahead, view.

**The fork to resolve before building:** (1) what counts as a *catalog block family* vs infra (the gate's denominator); (2) how a family dir maps to one-or-many WE specs (the multi-block dirs); (3) families with no WE spec (`audit`, dir-`navigation`) — exclude from the gate, or create the WE spec first. This is a design call, not mechanical curation — needs a ratify/slice turn. The render-from-manifest piece is largely already true (frontierui/src/blocks.njk renders from blocks.json), and the WE Web-Docs derivation-source doc is a separable smaller slice. Recommend **/slice** into: (a) decide the family/mapping rule [decision], (b) the gate + filled entries [story, gated on (a)], (c) the WE derivation-source doc [story, independent].
