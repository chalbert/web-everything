---
kind: decision
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#ssr-data-table-build-harness"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-27-ssr-data-table-build-harness-boundary.md
tags: [data-table, ingestion, statute-reconciliation, block-kernel, dogfooding]
---

# we-data-table migration: in-place wrap vs render-from-data binding — is the wrap statute-conformant?

> **RATIFIED 2026-07-01 — reconciled to the #2007 restructure-vs-enhance discriminator.**
> The rule is **not** "never wrap a `<table>`." It is: a block that **re-renders/restructures** its output
> (sort-by-rebuild, mobile-card view, re-layout) is fed **data** (`rows`/`config`) or an inert `<template>` —
> never live author markup as its source of truth. A **structure-preserving in-place enhancer** (#1867)
> **legitimately reads a live SSR `<table>`**, provided it consumes `data-*` typed keys off the cells and only
> reorders/hides — **that is the ratified-compliant default** (#1867 + the #1570 live-DOM-scan lane), not a
> violation. The #1600 wraps are defective **not** because they wrap a table, but because they **lack the #1867
> `data-*`/`.data-table` contract** (an inert `<we-data-table>` around a plain `<table>`) — decidable by #1867
> **today**, no new statute. **Fix:** complete the contract on genuinely-sortable surfaces, or revert the wrap on
> presentational ones. Operative authority **#1818 + #1570 + #1867**; the authoring-facing consolidation is
> carried by **#2007**. Migration tracked by **#2027**.

## Digest

The #1600 family migrates doc tables by **wrapping** them — `<we-data-table><table>…</table></we-data-table>`
(hand-authored markup, no `rows` binding, no `data-*` keys); 5 landed this session (#1610–1613) and render clean
(Playwright, 0 errors). The prep asked whether the wrap is statute-conformant. **Ratified answer:** the wrap is a
legitimate shape **iff** it carries the #1867 in-place-enhancer contract (`<th data-sortable>`, `<td
data-sort-value>` — the enhancer reorders existing rows reading those typed keys, never reparses text, never
`replaceChildren`s). The #1600 wraps carry **none** of it, so they are **inert wrappers around plain tables** — a
missing-contract defect, decidable by #1867 as it already stands. The restructuring lane (mobile-card view, sort by
rebuild) is the one that must be fed data — but no #1600 table does that. So the fix is per-surface: **complete the
#1867 contract** where a doc table should be sortable, or **revert to a plain `<table class="data-table">`** where it
is presentational. Gates #1609; re-scopes #1610–1613 (from "wrap" to "contract-or-revert").

## Grounding — the two kernels, and why the wrap rides neither *as authored*

- **#1818 forbids markup-as-source for the *render-from-data* kernel.**
  `we:docs/agent/platform-decisions.md#block-data-ingestion` (`:1016-1018`): the render-from-data kernel *"attaches
  a freshly-built tree via `replaceChildren`, discarding any parsed markup"* — raw markup is never its source. That
  is the *restructuring* lane.
- **#1570 blesses the *enhance-in-place* live-DOM lane.**
  `we:docs/agent/platform-decisions.md#persistent-b-data-source` (`:979-981`): the light-DOM-scan enhance-in-place
  kernel *"has no data-source fork"* — it is the ratified lane where a block **does** read live DOM. This is the
  statute my earlier strict rewrite missed; it is why "never live DOM" was too broad.
- **#1867 built the in-place enhancer over `data-*` typed keys**
  (`we:docs/agent/platform-decisions.md#ssr-data-table-build-harness:1259-1272`): each interactive cell carries its
  raw sort key as a `data-*` attribute; *"a small in-place DOM enhancer … reorders/hides the **existing** rows.
  There is **no JSON island and no client re-render**."* Impl
  `fui:blocks/renderers/data-table/DataTableEnhancer.ts:4-14`: *"reorders/hides the EXISTING SSR `<tr>` nodes …
  `appendChild` re-parents, never clones … idempotent."* Its `connectedCallback` early-returns unless it finds a
  `table.data-table` child (`fui:blocks/renderers/data-table/DataTableEnhancer.ts:276-280`), and `readColumns`
  skips headers without `data-sortable` — so on a **keyless `<table>` (no `.data-table` class, no `data-*`) it is
  pure passthrough**. The source of truth is the `data-*` data, not the rendered `<td>` text — which is exactly why
  reading the live subtree is compliant, not markup-as-source ingestion.
- **What the docs register today is the *render-from-data* kernel.** `we:src/_layouts/base.njk:493-494` imports
  `fui:embed/data-table-in-document.ts`, whose entry (`:29-45`) calls **`registerDataTable`** → **`DataTableModule`**
  (`.rows`/`.config` → `host.replaceChildren(renderDataTable(...))`,
  `fui:blocks/renderers/data-table/DataTableBehavior.ts:63`). For a *build-SSR, `data-*`-keyed* doc table the correct
  client kernel is the **enhancer** (refine in place), not the runtime `replaceChildren` behavior — so the R-pin is
  still to register `registerDataTableEnhancer`.
- **Why the 5 wraps don't empty — a guard, not a contract.** `DataTableModule.sync()` is
  `if (!this.isConnected || !this._config) return;` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:96`):
  a markup-only wrap sets no `.config`, so `sync()` returns early and the inner `<table>` survives. Load-bearing and
  undocumented — the wrap is *tolerated by an early-return*, not blessed. Set `.config` and it `replaceChildren`s.
- **The #1606 `<we-code-view>` precedent differs** (shadow-rooted slot projection,
  `fui:blocks/renderers/data-table/DataTableBehavior.ts:110`) — not the mechanism here.

## The governing rule (the #2007 discriminator — operative authority #1818 + #1570 + #1867)

- **R1 — restructure vs enhance-in-place.** A `we-` block that **re-renders or restructures** its output (sort by
  rebuild, mobile-card view, re-layout) is fed inert `<template>` or `[[ ref ]]` **data** — never live author
  markup as source (#1818). A **structure-preserving in-place enhancer** (#1570 lane; #1867 data-table enhancer)
  **may read a live SSR subtree**, provided its source of truth is `data-*` typed keys on the nodes and it only
  reorders/hides — never reparses rendered text, never restructures. That is the ratified default.
- **R2 — the contract is the conformance test, and it already exists.** A `<we-data-table>` wrapping a live
  `<table>` conforms **iff** the table carries the #1867 contract (`<th data-sortable>` / `<td data-sort-value>` /
  `.data-table`). Absent it, the wrap enhances nothing — an inert element around a plain table (the "table inside a
  data-table makes no sense" symptom). This is decidable by #1867 **today**; no new statute is minted.
- **R3 — SSR without re-render.** The keyed `<table>` is emitted as real SSR DOM (build-rendered from data, or
  authored with the contract) and refined in place; the docs surface registers `registerDataTableEnhancer`, so the
  client path can never `replaceChildren` a config-less wrap.

## Recommended path at a glance

| Question | Verdict | Authority |
|---|---|---|
| Does `<we-data-table><table>` ever conform? | **Yes — iff the `<table>` carries the #1867 `data-*`/`.data-table` contract** and is only reordered/hidden. | #1570 + #1867 |
| Must a table *fed as its data source* & *restructured* use data? | **Yes** — restructuring (rebuild / card view) is the render-from-data lane. | #1818 |
| Are the #1600 wraps conformant? | **No** — they carry **no** contract; inert wrap around a plain table. **Missing-contract defect.** | #1867 (today) |
| Fix for a #1600 wrap? | **Complete the #1867 contract** (sortable surface) **or revert to plain `<table class="data-table">`** (presentational). | R2 |
| Client registrar? | **`registerDataTableEnhancer`** — refine in place, never `replaceChildren`. | R3 |
| New statute needed? | **No.** Operative authority is #1818 + #1570 + #1867; the authoring-facing consolidation is #2007. | #2007 |

## The call — contract-or-revert per surface; no new statute

The earlier postures — "bless every wrap", my "never ingest a table", the 3-way split — are all **withdrawn**: they
either over-blessed (ignored the missing contract) or over-forbade (branded the ratified #1867 live-DOM lane a
violation). The ratified ruling applies the #2007 discriminator to the existing #1867 contract:

- **A doc table that should be sortable → complete the #1867 contract.** Give it `.data-table`, `<th data-sortable>`,
  `<td data-sort-value>` (build-stamped from the same data the Nunjucks loop already iterates); keep the
  `<we-data-table>` wrapper; register the enhancer. It reorders in place, reads `data-*`, never re-renders.
- **A presentational doc table → revert to a plain `<table class="data-table">`.** No `<we-data-table>`; the wrapper
  earns nothing on a table nobody sorts. Keeps the styling class.
- **A data-driven *app* table (out of scope, #1827) → `<we-data-table rows="[[ ref ]]">`**, render-from-data
  (`replaceChildren`), the restructuring lane.

**No wrap is left inert.** Every #1600 `<we-data-table><table>` either gains the contract or loses the wrapper.

```html
<!-- Sortable doc table: KEEP the wrap, add the #1867 contract; enhancer reorders in place (no re-render). -->
<we-data-table><table class="data-table">
  <thead><tr><th data-sortable data-type="text"><button data-action="sort" data-field="feature">Feature</button></th>…</tr></thead>
  <tbody><tr><td data-sort-value="container-queries">Container queries</td>…</tr></tbody>
</table></we-data-table>

<!-- Presentational grid: DROP the wrap; plain native table. -->
<table class="data-table"> … </table>
```

```diff
// fui:embed/data-table-in-document.ts — client kernel for build-SSR doc tables is the enhancer (refine in place),
// not the runtime replaceChildren behavior.
-import { registerDataTable, dataTableHostCss } from '../blocks/renderers/data-table/DataTableBehavior';
+import { registerDataTableEnhancer } from '../blocks/renderers/data-table/DataTableEnhancer';
+import { dataTableHostCss } from '../blocks/renderers/data-table/DataTableBehavior';
 export function registerDataTableInDocument(doc: Document = document): void {
-  registerDataTable(DATA_TABLE_TAG);            // DataTableModule → host.replaceChildren
+  registerDataTableEnhancer(DATA_TABLE_TAG);    // DataTableEnhancer → reorders EXISTING rows via data-*; never replaceChildren
   /* …inject dataTableHostCss once (unchanged)… */
 }
```

**Withdrawn / superseded (audit trail):**
- **(a) "bless every wrap"** — ignored the missing contract; an inert wrap is not conformant.
- **my "never ingest a live `<table>`"** — over-broad; branded the ratified #1867/#1570 enhance-in-place lane a
  violation. This is exactly the collision the #2007 prep skeptic caught (Axis-2).
- **(b) "render-from-data only" / (c) "split by kind"** — folded into R1: render-from-data is the *restructuring*
  lane only; enhance-in-place is a ratified lane, not an alternative to weigh.

**Skeptic (prep + reconciliation).** The original prep SURVIVED-WITH-AMENDMENT; the **#2007 four-axis prep then
corrected the rule itself**: "owns-rendered-shape → no live DOM" collides with #1867 (Axis-2) and duplicates
#1818/#1570 (Axis-0), so the operative rule is the *restructure-vs-enhance* discriminator with authority
#1818+#1570+#1867, #1983/#1986 demoted to analogy. No interactive surface breaks: the only runtime
`replaceChildren`-island consumers (`fui:demos/loan-origination/app.ts`, `fui:demos/auto-insurance/app.ts`) register
their own tag and don't import the embed.

**Revision trail (2026-07-01).** "(a) bless every wrap" → "3-way, unwrap static" → "never ingest a table" →
**reconciled to #2007's discriminator: contract-or-revert, live-DOM enhance is ratified-compliant.** The last move
followed the #2007 prep, which showed the strict version collides with ratified #1867/#1570.

## Supported by default (not decisions)

- **App case stays render-from-data** (runtime `.rows`/`.config` → `replaceChildren`, #1827) — out of scope.
- **Harness + compute placement = FUI** (#1867) — ratified, not reopened.
- **The `data-*`-on-cell format** (#1867 Fork-2c) is the ratified sort-key transport — the enhancer is its client
  half; no new format minted.

## Statute composition (codifiedIn)

**No new platform-decisions anchor.** The ruling is fully carried by the existing cluster —
`#block-data-ingestion` (#1818, restructuring lane), `#persistent-b-data-source` (#1570, enhance-in-place lane),
`#ssr-data-table-build-harness` (#1867, the `data-*` contract + enhancer). `codifiedIn: #1818, #1570, #1867`. The
one authoring-facing addition — a short *restructure-vs-enhance* note in `we:docs/agent/block-standard.md` so an
author reads the discriminator where they look — is **#2007's** delta (a consolidating cross-ref, not new
substance). This item is the *data-table application*; #2007 is the *general authoring note*.

## Relationship to #2007

#2007 is the **general** feed-mechanism governance decision (active, GO on a consolidating block-standard note,
grounded in #1818+#1570+#1867). #1964 is the **specific** we-data-table application of that discriminator. They
agree; #1964 defers the general rule's wording and authority to #2007 and cites the same cluster. #2008 (the
dual-feed defect) is subsumed — it is the missing-#1867-contract case, decidable today.

## Evidence / context

- Item bodies that assume the wrap: #1609 / #1610–1613 — each re-scoped from "wrap the authored table" to
  "**complete the #1867 contract or revert to plain `<table>`**".
- "0 errors" in the Playwright run proves *no JS threw*, not *no table emptied* — the wraps survive only because the
  behavior kernel no-ops without `.config`; registering the enhancer (R3) removes that latent cliff.
- Resolving unblocks #1609 and closes the #1600 epic; migration work tracked by **#2027**. **Separate** open item:
  `standard-section` / `standard-card` (#1954–1959) render but don't upgrade (a bug to investigate, not this
  decision).
