---
kind: decision
status: open
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-27-ssr-data-table-build-harness-boundary.md
tags: [data-table, ingestion, statute-reconciliation, block-kernel, dogfooding]
---

# we-data-table migration: in-place wrap vs render-from-data binding — is the wrap statute-conformant?

## Digest

The #1600 family migrates doc tables by **wrapping** them — `<we-data-table><table>…</table></we-data-table>`
(hand-authored markup, no `rows="[[ ref ]]"` binding); 5 landed this session (#1610–1613) and render clean
(Playwright, 0 errors). #1818 (`#block-data-ingestion`) declares `we-data-table` **render-from-data**:
*"raw author markup is never a data source … the two kernel shapes never mix in one element."* The grounding
this prep did shows the contradiction is **real, not apparent** — and survives only by a guard accident:
`we:src/_layouts/base.njk:493` registers `we-data-table` on **every** docs page with the **replaceChildren
behavior kernel** (`fui:embed/data-table-in-document.ts:45` → `registerDataTable` → `DataTableModule`), and
the wraps escape being emptied **only** because `DataTableModule.sync()` no-ops when no `.config` is set
(`fui:blocks/renderers/data-table/DataTableBehavior.ts:96`). Set `.config` (or change the guard) and every
wrapped table `replaceChildren`s to empty. **But** #1867 (`#ssr-data-table-build-harness`) already built the
*legitimate* in-place kernel — `fui:blocks/renderers/data-table/DataTableEnhancer.ts` reorders the **existing**
SSR rows by reading `data-*` keys, **never `replaceChildren`** — and ratified it as *refining* #1818's island
sketch. So the reconciliation is: bless the wrap **on the enhancer kernel**, not the behavior kernel. Gates
#1609 and whether the 5 landed migrations stand.

## Grounding — the two kernels, and which one the wrap actually rides

- **#1818 names two kernels and forbids mixing them.** `we:docs/agent/platform-decisions.md#block-data-ingestion`
  (`:1016-1018`): a **render-from-data** kernel *"attaches a freshly-built tree via `replaceChildren`,
  discarding any parsed markup"* — raw markup never a source; a **light-DOM-scan** kernel whose contract **is**
  markup-as-source; *"the two kernel shapes never mix in one element."* The wrap is a light-DOM-scan usage.
- **#1867 built + ratified the in-place kernel** (`we:docs/agent/platform-decisions.md#ssr-data-table-build-harness:1259-1272`):
  the deterministic+interactive cell carries its raw sort key as a `data-*` attribute on the SSR cell; *"a
  small in-place DOM enhancer … reorders/hides the **existing** rows. There is **no JSON island and no client
  re-render**"* — this **refines** #1818's anticipated "serialized resolved context / JSON island" sketch.
  Impl: `fui:blocks/renderers/data-table/DataTableEnhancer.ts:4-14` — *"reorders/hides the EXISTING SSR `<tr>`
  nodes … `appendChild` re-parents, never clones … idempotent."* Critically, its element
  `connectedCallback` **early-returns unless it finds a `table.data-table` child**
  (`fui:blocks/renderers/data-table/DataTableEnhancer.ts:276-280`) — so on a **plain hand-authored `<table>`
  (no `.data-table` class, no `data-*` keys) the enhancer never even constructs: it is pure *passthrough*,
  structurally incapable of `replaceChildren`. On a build-stamped interactive `.data-table` it engages and
  reorders. So the enhancer registrar is a **non-destructive kernel** — passthrough on static doc-table
  wraps, active only on keyed interactive surfaces — the opposite of the behavior kernel, whose
  `replaceChildren` fires the instant `.config` is set. *(0 docs surfaces carry `data-sortable`/`.data-table`
  today, so every migrated wrap is the passthrough case.)*
- **What the docs actually register is the OTHER kernel.** `we:src/_layouts/base.njk:493-494` does a cross-origin
  `import(...)` of `fui:embed/data-table-in-document.ts` then `registerDataTableInDocument()` on
  every page; that entry (`fui:embed/data-table-in-document.ts:29-45`) calls **`registerDataTable`**, defining
  `we-data-table` as **`DataTableModule`** — the `.rows`/`.config`-driven kernel that renders via
  `host.replaceChildren(renderDataTable(...))` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:63`).
  Its own header (`:15-23`) restates #1818: *"raw author markup is NEVER read as a data source for this kernel
  shape."* So the docs ship the **render-from-data** kernel, not the enhancer.
- **Why the 5 wraps don't empty — a guard, not a contract.** `DataTableModule.sync()` is
  `if (!this.isConnected || !this._config) return;` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:96`):
  a markup-only wrap sets neither `.rows` nor `.config`, so `sync()` returns early, the behavior is never
  constructed, and `replaceChildren` is never called — the inner `<table>` is left intact. That is **load-bearing
  and undocumented**: the wrap is *tolerated by an early-return*, not *blessed as a mode*. (The one **empty**
  `we-data-table` at `/blocks/data-table/` is the block's own `.rows`-bound demo — the behavior kernel doing
  exactly what it should.)
- **The cited #1606 `<we-code-view>` wrap precedent is a *different* mechanism.** Code-view (#1785) is
  **shadow-rooted** (`fui:blocks/renderers/data-table/DataTableBehavior.ts:110` "Unlike the shadow-rooted
  `<we-code-view>`"): it preserves author markup by **slot projection**, which structurally can't destroy it.
  data-table renders into **light DOM** (no shadow root, so its CSS must live in the host document) — so it
  has no slot to hide behind; markup-preservation must come from the *kernel choice*, which is exactly the
  fork.

## The axis

One axis: **does `we-data-table` get an explicit, ratified light-DOM-scan / in-place mode for hand-authored
doc tables, or must every table surface go through the render-from-data binding?** The materials to make the
wrap conformant already exist (#1818 names the light-DOM-scan kernel; #1867 built the in-place enhancer) — so
(a) is a *reconciliation*, not a contradiction-by-fiat. What (a) must add is **pinning**: route doc-table
wraps to the enhancer (or ratify the config-less passthrough), so conformance stops depending on the
`_config` early-return.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — does the wrap conform?** | **(a)** Bless the wrap as the doc-table pattern — amend #1818 to a ratified **dual kernel**, route doc tables to the #1867 **enhancer** (never the replaceChildren behavior) | (b) #1818 governs strictly — render-from-data only; rework the 5 migrations to `rows="[[ ref ]]"` | Med-high |

## Fork 1 — does the wrap conform, or must table surfaces use the render-from-data binding?

*Why it's a fork (case b — a real either/or):* the two branches are coherent and **mutually exclusive** for a
given surface — a table is *either* an enhanced hand-authored `<table>` (markup is the source) *or* a
`replaceChildren`-rebuilt tree from a `rows` binding (markup is never the source); #1818 itself forbids both
**in one element** (`:1018`). So "do doc tables use kernel A or kernel B" is a genuine ratifiable choice, not
a support-both — the standing test passes.

- **(a) Bless the wrap as the doc-table migration pattern — ratified dual kernel, doc tables ride the #1867
  enhancer.** *(recommended — it's what shipped, the legitimate in-place kernel already exists (#1867), and
  #1818 already admits a light-DOM-scan kernel.)* Amend `#block-data-ingestion` to record the **two kernels
  explicitly**: light-DOM-scan / **in-place enhancer** (`DataTableEnhancer`) for *static, hand-authored* doc
  tables (markup-as-source, never `replaceChildren`), and render-from-data (`DataTableModule`,
  `rows="[[ ref ]]"` → `replaceChildren`) for *deterministic-interactive island* and *non-deterministic app*
  (#1827) surfaces. **The pinning amendment (the load-bearing part):** the docs surface must register the
  **enhancer registrar** (`registerDataTableEnhancer`), not the behavior kernel — swap
  `fui:embed/data-table-in-document.ts` from `registerDataTable` to `registerDataTableEnhancer`. The value is
  *not* that the enhancer reorders these tables (on a keyless static wrap it never engages — passthrough); it
  is that the enhancer is **structurally non-destructive** — its only DOM-mutating path is gated behind a
  `table.data-table` child the wraps don't carry, so it **cannot** `replaceChildren`, whereas the behavior
  kernel empties the wrap the instant `.config` is set. The ratified invariant is therefore *"a config-less
  `we-data-table` wrapping a `<table>` is light-DOM passthrough that never `replaceChildren`s."* #1609 + the 5
  landed migrations stand. **Cost:**
  one embed-entry swap + a #1818 carve-out paragraph; reconciles "kernels never mix" with shipped reality by
  assigning *one kernel per surface kind*, which is precisely what #1818 asks.
- **(b) #1818 governs strictly — render-from-data only.** The wrap is non-conformant; rework #1610–1613 to
  `rows="[[ ref ]]"` bindings + a build-resolved `<table>`. Rich-HTML / `colspan` doc tables that can't be
  expressed as scalar `rows` either stay plain `<table>` (out of `we-data-table` scope) or wait on a rich-cell
  escape (new capability). **Cost:** undo+redo shipped work; some doc tables can't migrate at all — yet the
  in-place enhancer #1867 *already built* exists precisely to avoid forcing scalar `rows` on every surface, so
  (b) discards a ratified mechanism.
- **(c) Split by table kind.** Genuinely-tabular data → render-from-data; rich static documentation tables →
  stay plain `<table>` (never `we-data-table`). **Cost:** re-triages each surface, partially un-migrates, and
  still leaves the "what about a static table that *wants* in-place sort" case to (a)'s enhancer anyway — so
  (c) is (a) minus the enhancer, strictly less capable.

**Code shape (default = (a)).** The wrap markup is unchanged; the fix is *which kernel the docs register*:

```html
<!-- we:src/*.njk — the #1600 wrap, unchanged. No rows/config binding: markup IS the source. -->
<we-data-table><table>
  <thead><tr><th>Feature</th><th>Baseline</th></tr></thead>
  <tbody><tr><td>Container queries</td><td>Baseline 2026</td></tr></tbody>
</table></we-data-table>
```

```diff
// fui:embed/data-table-in-document.ts — register the IN-PLACE enhancer, not the replaceChildren kernel.
-import { registerDataTable, dataTableHostCss } from '../blocks/renderers/data-table/DataTableBehavior';
+import { registerDataTableEnhancer } from '../blocks/renderers/data-table/DataTableEnhancer';
+import { dataTableHostCss } from '../blocks/renderers/data-table/DataTableBehavior';
 export function registerDataTableInDocument(doc: Document = document): void {
-  registerDataTable(DATA_TABLE_TAG);            // DataTableModule → host.replaceChildren (empties a markup-only wrap if .config is ever set)
+  registerDataTableEnhancer(DATA_TABLE_TAG);    // DataTableEnhancer → reorders EXISTING rows; no-op without data-* keys; never replaceChildren
   /* …inject dataTableHostCss once (unchanged)… */
 }
```

Under (b) the wrap markup above is deleted and re-authored as `<we-data-table rows="[[ tableData ]]">` with a
build-resolved context — and any `colspan`/rich-cell doc table that can't be scalar `rows` is reverted to a
plain `<table>`.

**Skeptic:** SURVIVES-WITH-AMENDMENT (a throwaway refute-only sub-agent run this prep; the outcome holds, two
rationale corrections folded in). **(0) Classification** — SURVIVES: a real fork (one kernel per surface,
mutually exclusive per #1818 `:1018`), not a config dimension (there is a *wrong* kernel that empties the
table, so it is not "two legitimate end-states of one knob"), not support-both, and **not** a #1867 no-op
(#1867 scopes its enhancer to *deterministic+interactive* keyed surfaces — it never ruled on a static
hand-authored `<table>`). **(1) Merit** — SURVIVES, but the skeptic **broke the prep's stated mechanism and
it is now corrected:** the enhancer does **not** "reorder" these wraps — its element `connectedCallback`
early-returns without a `table.data-table` child (`fui:blocks/renderers/data-table/DataTableEnhancer.ts:276-280`),
and 0 docs surfaces carry that class or `data-*` keys, so on every migrated wrap the enhancer **never engages
(passthrough)**. The real value of (a) is that the enhancer registrar is a *structurally non-destructive*
kernel (cannot `replaceChildren`), not that it enhances — reworded in the Grounding + Fork-(a) + codification
text. No interactive surface breaks: the only live `replaceChildren`-island consumers
(`fui:demos/loan-origination/app.ts`, `fui:demos/auto-insurance/app.ts`) register their own `data-table` tag
and don't import the embed. **(2) Statute-overlap** — SURVIVES: (a) *amends* `#block-data-ingestion` and
*composes with* `#ssr-data-table-build-harness` (a carve-out within #1818 cross-linking #1867), no colliding
rule. **(3) Citation-scope** — SURVIVES-WITH-AMENDMENT: #1867's enhancer was over-cited as the kernel doc
tables "ride"; **corrected** — #1867 is now cited only for the *non-destructive in-place kernel*, not as
authority that its enhancement path covers keyless static tables (which it provably doesn't). #1818's
light-DOM-scan clause (`:1017`) is cited for the *existence* of a markup-as-source kernel — its literal text,
in-scope.

## Supported by default (not decisions)

- **The non-deterministic *app* case stays render-from-data** (`rows="[[ ref ]]"` → `replaceChildren`), with
  runtime context hydration #1827 — out of scope; this decision is about *doc-table* surfaces only.
- **Harness + compute placement = FUI** (#1867: the build-CLI subprocess, the enhancer, `renderDataTable`) —
  ratified, not reopened. This item decides only *which kernel the docs register*, not where it lives.
- **The `data-*`-on-cell interactive format** (#1867 Fork-2c) is the ratified sort-key transport — (a)'s
  enhancer is its client half; no new format is minted here.

## Statute composition (codifiedIn draft)

On ratification (option (a)), codify as a **carve-out within `#block-data-ingestion`** cross-linking
`#ssr-data-table-build-harness`: *`we-data-table` is served by a **non-destructive enhancer kernel**
(`DataTableEnhancer`) on static hand-authored doc-table surfaces — markup-as-source; on a keyless wrap it is
**passthrough** (its mutating path is gated behind a `table.data-table` child, so it can **never
`replaceChildren`**), and on a build-stamped `.data-table` it enhances in place per #1867 — and by the
**render-from-data** kernel (`DataTableModule`, `rows="[[ ref ]]"` → `replaceChildren`) on interactive-island
and non-deterministic app surfaces; the two never co-inhabit one element. The docs surface registers the
enhancer registrar; conformance is the invariant **"a config-less wrap never `replaceChildren`s,"** no longer
the `_config` early-return.* This **refines** #1818 (which already names the light-DOM-scan kernel, `:1017`)
and uses #1867's `DataTableEnhancer` (`:1259`) as the *non-destructive kernel* — **not** a claim that #1867's
enhancement path covers static keyless tables (it doesn't; there it is passthrough). Composition, not
collision: it resolves the single question both anchors left implicit (which kernel a hand-authored wrap
rides).

## Evidence / context

- Item bodies that assume the wrap: #1609 / #1610 / #1611 / #1612 / #1613 (all cite the #1621 rule-7
  transient-CE mount, "badge dogfood counterpart").
- Runtime proof the wrap renders: this session's Playwright run (4 pages, 0 errors). **Caveat the prep
  surfaced:** "0 errors" proves *no JS threw*, not *no table emptied* — the wraps render because the behavior
  kernel no-ops without `.config`, so a future `.config` set or a guard change is an undetected regression
  until (a)'s enhancer-routing pins it. A regression test asserting a config-less wrap keeps its rows is a
  follow-on for the build slice.
- Resolving this unblocks #1609 and closes the #1600 epic. **Separate** open item: `standard-section` /
  `standard-card` (#1954–1959) render but don't upgrade (a bug to investigate, not part of this decision).
