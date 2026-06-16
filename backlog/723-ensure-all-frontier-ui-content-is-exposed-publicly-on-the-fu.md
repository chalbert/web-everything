---
type: issue
workItem: epic
status: resolved
locus: frontierui
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [frontierui, webdocs, public-surface, audit]
---

# Ensure ALL Frontier UI content is exposed publicly on the FUI website

Audit Frontier UI's public website against everything FUI actually contains — blocks, demos, traits, plugs, adapters, the trait tree-shaking capability, every implemented standard — and close the gaps so nothing built is invisible to the public. FUI owns the rendered display of its own content (the docs-rendering boundary: WE iframes FUI demos, FUI hosts them), so completeness of FUI's public surface is FUI's responsibility. Deliver an inventory-vs-published diff and the pages/nav to expose anything missing. General hygiene card surfaced during #713 (trait docs must be public) but applies to the whole FUI surface, not just traits.

## Audit delivered + reclassified to epic (2026-06-15, batch-2026-06-15)

Claimed in a batch; ran the inventory-vs-published audit (the first half of the deliverable). It found
**five distinct exposure surfaces**, not one story — so the build half is sliced into children below, with
this audit as their shared input. Reclassified `story·5 → epic` (it conflated five deliverables) and
`locus: frontierui` set.

**FUI public site:** a hand-curated **Eleventy** site (`frontierui/.eleventy.js`, source `frontierui/src/`)
driven by one hand-authored registry, `frontierui/src/_data/blocks.json`. Pages: `/`, `/blocks/` (catalog,
iterates `blocks.json`), `/blocks/{id}/` (paginated detail), `/about/`. Nav (`src/_layouts/base.njk`):
Blocks · About · Web Everything (external). **Mechanism:** add an entry to a `_data/*.json` → a `.njk`
template auto-renders it; there is **no filesystem auto-discovery**, so anything not in a registry is invisible.

**Inventory-vs-published diff:**

| Surface | In repo | Published | Status | Gap |
|---|---|---|---|---|
| Blocks | 19 impl dirs | 7 in `blocks.json` | **PARTIAL** | 12 blocks unregistered (data-grid, droplist, type-ahead, tree-select, stepper, navigation, master-detail, selection, for-each, lifecycle, audit, attributes, background-task-surface, resource-loader, transient). Note: `blocks.json` ids are **curated, not dir-names** (`simple-store`→`stores/`, `handler-expression-parser`→`parsers/`), so each needs an authored `{id,name,type,summary,protocol,weSpecPath}` + a `/blocks/{id}/` page. |
| Demos | 24 `demos/*.html` | 0 | **GAP** | No `/demos/` catalog/gallery, no nav. Most mechanical to expose (scan `demos/*.html` → `demos.json` → catalog page; titles from H1/filename). |
| Traits | 13+ (`blocks/**/traits/`) | 0 | **GAP** | No public trait catalog (the #713 trigger). Needs a registry + page; some are internal infra — curate. |
| Plugs | 9 `web*` domains | 0 | **GAP** | No plugs index describing each domain. |
| Adapters | 2 (`webdocs/adapters/`: storybook, mintlify) | 0 | **GAP** | No extensibility/adapters reference. |

**Latent curation question for the children:** the current site publishes only the 7 "core protocol"
blocks — i.e. the gap is partly *intentional curation*, not just an oversight. The #713 principle ("nothing
built is invisible to the public") argues for full exposure, but each surface child should confirm
publish-all vs curate-core per artifact (some demos are dev tooling, e.g. `dev-panel`; some traits are
internal infra) rather than blindly surfacing everything. Not a blocking fork for the epic — flagged so a
child doesn't publish internal-only artifacts by reflex.

## Child slices (the build half — each batchable in frontierui locus)

See the scaffolded children: complete the blocks registry, a demos catalog, a traits catalog, a plugs
index, and an adapters/extensibility reference. The epic resolves when its children land.
