---
type: issue
workItem: story
size: 3
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/scripts/check-standards.mjs
tags: [frontierui, cem, conformance, tagname]
---

# Migrate FUI element-tag registration defaults to we-* spec tags (#908-A); flip the #844 gate to enforce

The #908-A downstream build the #844 gate's warns guide. Flip FUI's element-tag registration defaults to the we-* spec tagNames (we:custom-elements.json): the 5 hard-coded customElements.define literals (auto-complete→we-autocomplete, auto-heading→we-transient-component, background-tasks→we-background-task-surface, route-view→we-route-view, route-outlet→we-route-outlet) become register*(tag = 'we-…'), and the 2 already-parameterized defaults flip (page-nav→we-pagination, data-table→we-data-table). Pretty names live on as documented consumer overrides (#843). Then flip TAGNAME_GATE_ENFORCED=true in fui:scripts/check-standards.mjs so the #844 Check-2b gate promotes warn→error. locus frontierui. Ready: #844 gate + #908 ruling both landed.

## Built (batch-2026-06-18)

Executed the #908-A migration in **frontierui** and flipped the #844 Check-2b gate to enforce.

**Registration defaults flipped to we-* (all consumer-overridable, #843):**
- `registerAutoComplete(tag='we-autocomplete')` — AutoComplete no longer self-registers on import.
- `registerTransient(tag='we-transient-component')`, `registerBackgroundTasks(tag='we-background-task-surface')`.
- `registerRouter` split into `registerRouteView(tag='we-route-view')` + `registerRouteOutlet(tag='we-route-outlet')` (the per-element `register*(tag=…)` shape the gate recognizes); `registerRouter` delegates, keeps overridable params.
- `registerPagination` → `we-pagination`, `registerDataTable` → `we-data-table`.

**Tag-preserving consumer updates (identical registered tags — zero runtime change):** `plugs/bootstrap.ts` (route-view/route-outlet/auto-heading overrides), the bg-task demos, loan-origination + auto-insurance (`data-table`/`page-nav`), `autocomplete-unplugged`, `workbench/registry.ts`, and the AutoComplete unit test now register the pretty tag explicitly.

**Catalog:** removed the now-phantom literal names (`route-view`/`route-outlet`/`app-tasks`/`background-tasks`/`auto-complete`) from `src/_data/blocks.json` `registeredNames` (they're param-defaults now, not literal defines).

**Gate:** `TAGNAME_GATE_ENFORCED=true` in `scripts/check-standards.mjs`. `check:standards` green (0 errors; 18→6 warnings — the 12 tag-drift/hard-code warnings cleared; remaining 6 are #840 CEM member-surface drift, separate). Full vitest 1855 pass, `tsc` clean.

**Size note:** landed as effectively ~5–6 (16 files: 6 registrars + gate + blocks.json + 8 consumers/test), larger than the size·3 estimate — a tag-preserving sweep, all mechanical, no fork.
