---
kind: decision
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#attribute-name-colon-namespacing"
tags: [naming, colon-namespace, attribute-conformance, frontier-ui]
---

# Behaviour-attr colon is family-only; family-less behaviours stay bare single-hyphen (`type-ahead`)

Forked out of the migration story to pin `type-ahead`'s colon target. The fork instead **exposed a
weakness in #1987 Fork 1's blanket "all behaviour attrs colon-namespaced"**: `type-ahead` has no
family, so the `namespace:member` grammar forced an *invented* namespace (`list:` / `nav:`) purely to
satisfy the rule — a DevX cost for no collision benefit. Grounding the collision premise showed native
HTML does **not** separate multi-word attribute names with hyphens — it **smashes** (`shadowrootmode`,
`contenteditable`, `crossorigin`); bare hyphenated native attrs are two legacy cases (`accept-charset`,
`http-equiv`) plus the `data-*` / `aria-*` prefix families. So a bare single-hyphen author attr is not
at meaningful native-collision risk, and a colon on a *singleton* buys neither sibling-disambiguation
nor readability.

## Ruling (amends #1987 Fork 1 — ratified 2026-07-01)

**Keep behaviour-attr names as simple as possible. The colon namespace is used only for a *family* — a
surface/domain with ≥2 related members (or an established control-flow/event group). A *family-less*
behaviour stays a bare single-hyphen name and takes no colon.**

- `type-ahead` **stays `type-ahead`** (family-less). Not `list:type-ahead`, not `type:ahead`.
- The colon still carries collision-safety-by-construction + sibling disambiguation *where a family
  exists* — the only place those pay off.
- A family-less name that later gains a sibling colon-ifies then (a one-time mechanical rename).

### Reclassification of the rename list (grounded in FUI `src`)

**Families → colon** (rename where currently bare/double-colon):
- `droplist-anchor` / `droplist-anchored` / `droplist-selection` → `droplist:anchor` / `droplist:anchored`
  / `droplist:selection` (droplist family, 3 members)
- `route:guard:leave` → `route:guard-leave` (route family: link/prefetch/…; double-colon collapses to a
  single-colon hyphenated member)
- already-ratified families, unchanged: `on:*`, `view:*`, `grid:*`, `nav:*`

**Family-less → bare single-hyphen** (no rename — already bare, and now ratified to *stay* bare):
- `type-ahead` (standalone)
- `focus-delegation` (no focus family)
- `navigation-guard` (standalone leave-guard; not a member of `nav:`)

Net effect: the migration **shrinks** — only genuine families (droplist, `route:guard-leave`) actually
rename; the three family-less attrs stay put.

### Known tradeoff (red-teamed, accepted)
This reintroduces a per-attr "is it a family?" judgment that #1987's blanket rule eliminated. Accepted
because that judgment is cheap and objective (does a registered sibling exist?) — unlike the
collision-risk judgment #1987 rightly feared — the future-sibling colon-ify is mechanical and rare, and
the DevX + honesty win (no invented `list:` namespace) outweighs it.

## Graduates to
Statute amended: `we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing` (Fork 1 +
lineage carry the family-only clause). Successor mechanical rename → re-scaffold as a story: colon-ify
only the family members (`droplist:*`, `route:guard-leave`), leave family-less attrs (`type-ahead`,
`focus-delegation`, `navigation-guard`) bare. Back-compat aliases for any name that actually changes.
