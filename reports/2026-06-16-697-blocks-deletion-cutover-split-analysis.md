# #697 split analysis — delete WE's 9 block-impl families + migrate their demos to FUI iframe embeds

**Date:** 2026-06-16 · **Item:** [#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to/) (S3 of epic [#658](/backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-fam/)) · **Skill:** split-backlog-item

## Outcome: cannot split into agent-ready slices yet

Applying the ratified [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/)
reference-vs-impl partition rule to the real tree finalizes the keep-list cleanly — but it also shows
that **every executable cutover slice is blocked** on cross-repo prerequisites that do not exist today.
There is **zero agent-ready WE-side work** in #697 right now. Two blockers (B1, B3 below), each filed as
its own backlog item. The deliverable of this turn is this report + those items + the #697 re-scope; no
on-disk demo cutover is possible.

## The finalized partition (output of applying the #791 rule)

The #791 rule: *a block stays in WE iff its demo exists to exercise a WE **standard** (the block is that
standard's reference runtime); a **block-impl** demo — subject is the block itself — moves to FUI.*

### MOVE — the 9 block-impl families (already migrated UP, byte-identical, by #694/#695/#696/#704)

`audit`, `background-task-surface`, `data-grid` (+ `renderers/data-grid`), `lifecycle`, `master-detail`,
`selection`, `stepper`, `tree-select`, `type-ahead`. WE's copies are content-equal upstream in
`@frontierui/blocks` → the #170 delete guard is *satisfied* for the impl files.

### STAY — reference-runtime subset (retain in WE, unchanged)

Resolving the rule against every `/demos/*` import shows the keep-set is **much larger than the 4 named
keepers** — almost all `renderers/*` subfamilies are reference runtimes for a WE standard:

| Family (WE-only, **not** in `@frontierui/blocks`) | Standard its demo exercises |
|---|---|
| `stores/simple` | declarative-spa |
| `renderers/jsx` | jsx-adapter, jsx-directive-sugar, maas-consumer |
| `view` + `tabs` | custom-events (view-tabs) |
| `renderers/component` | component-converter (#038/#076), module-as-a-service, code-upgrader |
| `renderers/data-table` | data-table |
| `renderers/pagination` | pagination |
| `renderers/reorderable-list` | reorderable-list |
| `renderers/module-service`, `renderers/upgrader` | MaaS, code-upgrader |
| `renderers/{audit-timeline,decision-trace,status-indicator}` | exercise-app decision UIs |
| `wizard`, `workflow-engine`, `resource-loader` | wizard-flow, loader-handoff |

These are **not** blocked-on-migration — the rule keeps them in WE. (FUI's `renderers/` has only
`data-grid`; that asymmetry is correct, not a gap.)

## Why no slice is agent-ready — the demo straddle

The 41 `/demos/*` that import `/blocks/…` split into three buckets. Only demos touching a **MOVE** family
are in #697's scope; of those, none can be cut over now:

| Demo(s) | MOVE families used | Also uses (STAY) | Disposition | Blocked by |
|---|---|---|---|---|
| `background-task-surface-demo` (×2), `durable-tier-verification` | background-task-surface | — | pure block-impl → iframe FUI demo | **B1** (FUI hosts no such demo) |
| `data-grid-demo` (×2) | data-grid, renderers/data-grid | renderers/data-table | block-impl → iframe FUI demo | **B1** |
| `loader-background-handoff-demo` (×2) | background-task-surface | resource-loader | composes a moved impl + a stayed family | **B3** (straddle — can't import `@frontierui/blocks`) |
| `loan-origination/`, `auto-insurance/` (exercise apps) | audit, lifecycle, master-detail, stepper, tree-select | renderers/*, wizard | full app composing moved impls directly | **B3** (can't iframe a whole app) |

`selection` and `type-ahead` (2 of the 9) have **no** demo consumer at all — but they can't be deleted in
isolation either: intra-`blocks/` deps (`master-detail → selection`, `audit → lifecycle`) couple them to
the still-undeletable families. The 9 must come out **together**, and the long pole is the exercise apps.

## The two blockers

### B1 — FUI hosts no demos for the migrated block-impl families *(prerequisite)*

The `fuiDemo` shortcode ([.eleventy.js:38](../.eleventy.js#L38)) iframes
`${FUI_DEMO_BASE}/demos/<file>`. FUI's `demos/` hosts component-converter, declarative-spa, view-tabs,
for-each, navigation, lazy-traits, … but **nothing** for background-task-surface, data-grid, type-ahead,
audit, lifecycle, master-detail, selection, stepper, tree-select. So every iframe cutover points at a
404 today. **Unblock:** FUI authors + hosts a demo per block-impl family (`locus: frontierui`, under
#658); *then* WE swaps `block.fuiDemo` and deletes the local demo. Filed as a `story`.

### B3 — how WE apps/demos that *compose* a moved impl consume it post-deletion *(unresolved fork)*

#791 ruled on *block-impl demos* (subject = the block → iframe). It did **not** settle WE artifacts that
import a moved family as a **building block**: the two exercise apps (`loan-origination`,
`auto-insurance`) and the straddle demos (`loader-background-handoff`, `durable-tier-verification`). These
can't iframe (a full app isn't a single embeddable demo) and can't `import '@frontierui/blocks'` (the
#707 boundary; no `frontierui` vite alias by design). #765's in-document mount is "runtime SDK only —
mount a rendered FUI thing," which does not give an app the block *classes* to compose with. So there is
no sanctioned path today. **Coherent options** (for the decision card):

- **(a)** Move the exercise apps to FUI too — *rejected-leaning*: apps are WE's conformance forcing
  function (the deliverable that proves the standard); moving them dissolves that role.
- **(b)** Re-classify the families the apps consume as reference-runtime that **stays** in WE —
  contradicts #791's "9 move" ruling and re-opens #641.
- **(c)** Re-express the apps to compose FUI blocks via a **runtime federation / in-document SDK**
  (extends #765 from mount-a-demo to compose-blocks) — principled but unproven for app-level composition.
- **(d)** Decouple the apps from the moved impls — rebuild them on WE's retained reference-runtime
  families only, so they never import a moved family.

This is the load-bearing fork; it gates the cutover. Filed as a `type: decision` card.

## Backlog actions (gated on approval)

1. **New `type: decision` card (B3)** — *How WE's exercise apps + straddle demos consume the 9 moved
   block-impl families post-deletion (options a–d above)*, `blockedBy` none, blocks #697.
2. **New `story`, `locus: frontierui` (B1)** — *Author + host FUI demos for the migrated block-impl
   families as `fuiDemo` iframe targets*, `parent: 658`.
3. **Re-scope [#697] in place** — keep it a `story` under #658 (it already has `parent: 658` → don't nest
   per the split rule), narrow its body to the **WE-side cutover** (delete the 9 impl families + swap
   their demos to `fuiDemo` iframes; retain the reference-runtime subset), and set
   `blockedBy: [<B3-decision>, <B1-fui-hosting>]`. Re-size against the unblocked surface.

No split executes — #697's scope is one coherent cutover that only becomes agent-ready once B1 and B3
land. This matches the conservative split instinct: a forced carve here would fragment one deliverable
into pieces that can't be delivered independently.
