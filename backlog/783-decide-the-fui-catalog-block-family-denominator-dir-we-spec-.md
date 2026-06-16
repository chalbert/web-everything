---
type: decision
workItem: story
size: 3
parent: "731"
status: open
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-fui-catalog-family-denominator.md
relatedProject: webdocs
tags: [frontierui, webdocs, catalog, completeness-gate, denominator, decision-prep]
---

# Decide the FUI catalog-block-family denominator + dir→WE-spec mapping rule

**Prepared, ready to ratify.** [#706](/backlog/706-generate-fui-s-block-catalog-from-a-derived-manifest-and-ren/)
fixed the invariant — *every implemented `frontierui/blocks/` family must resolve to ≥1 manifest entry, gated
like WE's `check-demos` forces every demo folder to be registered* — but left **family** (the gate's
**denominator**) undefined. This decision defines the denominator, the dir→WE-spec **mapping rule**, and the
no-spec-dir handling. Grounded in a prior-art survey (CEM analyzer · Storybook · Nx) published as
`/research/fui-catalog-family-denominator/` (report linked via `relatedReport`). After the fork-existence test
it reduces to **two forced invariants + one genuine on-merit fork** (denominator granularity, recommended
**flat-dir**); most of the item's apparent complexity (name-mismatch, multi-block) is already handled by the
manifest's `sourcePath` field and is **not** a decision.

## The mapping is already mechanized — `sourcePath`, not dir-name

FUI's impl manifest (`frontierui/src/_data/blocks.json`, 23 entries, filled by the resolved
[#737](/backlog/737/)) carries a **`sourcePath`** on every entry pointing at the dir it realizes
(`src/_data/blocks.json:10` → `"sourcePath": "blocks/stores/simple"`). So coverage is *"does ≥1 manifest entry's
`sourcePath` fall within this dir?"* — and the item's "tricky" cases dissolve, because the mapping is **authored
on the entry, never inferred from the dirname**:

| Concern from the item | Handled by `sourcePath` — already true in `blocks.json` |
|---|---|
| name-mismatch (`navigation→nav-list`, `stores→simple-store`, `transient→transient-component`, `text-nodes→interpolation-text-node`, `audit→audit-trail`) | each entry's `sourcePath` points into the real dir; the `id` is decoupled from the dirname (exactly how CEM resolves tag names from `customElements.define()`, never the path — survey) |
| multi-block (`parsers→` `handler-expression-parser` + `double-curly-bracket-parser` + `double-square-bracket-parser`) | three entries with `sourcePath` `blocks/parsers/handler-expression`, `…/text-node/double-curly`, `…/text-node/double-square` — many entries per dir is normal |

**Net:** with the three infra dirs (below) excluded, **all 21 remaining top-level dirs already map** — the gate
is **green today** with zero new entries.

## Recommended path at a glance

| # | The call | Recommended | Main alternative | Confidence |
|---|---|---|---|---|
| I1 | Mapping rule | **`sourcePath`-anchored coverage** (≥1 entry's `sourcePath` within the dir) | dir-name == id matching | Forced invariant — alt is broken (breaks every name-mismatch) |
| I2 | Infra exclude-set | **`{__tests__, traits, renderers}`** excluded from the denominator | include them | Forced invariant — alt double-governs traits / false-positives a package re-export |
| 1 | Denominator **granularity** | **A — flat top-level dir + explicit infra set** (mirrors `check-demos`, implementer-agnostic, green today) | B — registered-name (catches same-dir siblings like `nav:section`) | **Med-high** — the one real call |

## Forced invariants (ratify, not weigh)

**I1 — Mapping is `sourcePath`-anchored, not name-matched.** A dir is *covered* iff ≥1 manifest entry's
`sourcePath` resolves within it. This is the only correct rule (it already drives the 23 entries); a
`dir-name == id` rule is *broken* — it breaks all five name-mismatch dirs above. Survey-confirmed: CEM, the
closest standard, resolves a unit's name from its `define()` marker, never its directory.

**I2 — Infra exclude-set = `{__tests__, traits, renderers}`.** Each is *broken* to include:
- `__tests__/` — tests.
- `traits/` — FUI **trait** impls (`Highlight`/`Polling`/`Revealable`/`Sortable`), already governed by the
  **separate** `traits.json` drift gate (`frontierui/scripts/check-standards.mjs:95-116`, the `walkTraits`
  bidirectional check). No catalog block lives here; including it double-governs the same files.
- `renderers/` — `blocks/renderers/index.ts:11` re-exports the **published** `@frontierui/jsx-runtime` package
  (#265); `renderers/data-grid/` is the data-grid block's internal render helpers. No standalone catalog block.

House style for the exclusion is an explicit set (cf. `TRAIT_NON_TRAIT = {index, types}` in the same gate). The
**no-WE-spec *dirs*** the item asks about (*"exclude or create the spec"*) are **exactly these three infra dirs**
→ **exclude**. There is no whole implemented-block dir missing a spec.

## Fork 1 — denominator granularity: flat dir vs registered-name

The genuine on-merit either/or: what *unit* does the gate iterate to demand coverage?

- **Option A — flat top-level dir + explicit infra exclude-set (recommended).** Denominator = each top-level
  `frontierui/blocks/<dir>` minus `{__tests__, traits, renderers}`; covered iff ≥1 manifest `sourcePath`
  resolves within it. Implemented as a `readdirSync('blocks')` check in `frontierui/scripts/check-standards.mjs`
  (#784), mirroring `check-demos` (`scripts/check-demos.mjs:42-77`) — the precedent #706 explicitly named.
  *Merit pros:* pure-filesystem and therefore **implementer-agnostic** (the completeness invariant is
  WE-standard-owned per #706 and must read any implementer's tree, not FUI's registration convention);
  deterministic; **green today**. *Merit con:* blind to **same-dir sibling drift** — a second registered
  behavior in an already-covered dir (e.g. `nav:section` inside `navigation/`, covered by `nav-list`) is not
  caught.
- **Option B — registered-name denominator.** Denominator = every registered public name
  (`attributes.define(…)` / `customElements.define(…)`); each must map to a manifest entry. *Merit pro:* catches
  `nav:section` and any future same-dir sibling. *Merit cons:* **couples the WE-standard-owned invariant to
  FUI's registration convention** (a portability regression for a gate #706 says the *standard* owns), and
  **reintroduces an internal-name exclusion list** (the `call`/`pipe`/`value` sub-parsers under `parsers/`,
  trait registrations) — more drift surface, the very thing the gate fights.

**Recommended default: A.** It is the literal `check-demos` precedent #706 cited, kills the documented
family-level drift, stays implementer-agnostic, and is green with no new entries. The sibling-drift gap is real
but rare, and is better captured as a follow-up build (below) than by coupling the gate to a registration
convention.

*Rejected sub-option — leaf-dir recursion* (recurse category dirs `parsers/`/`text-nodes/`/`stores/` to their
child family dirs): reintroduces the `call`/`pipe`/`value` internal-exclusion problem (leaf dirs with no public
registration) for little gain, since it *still* misses the same-dir sibling case (`nav:section`) that motivates
going finer. If you want siblings caught, go to B; otherwise flat-dir is simpler at the same coverage.

## Captured follow-ups (not fork branches — file at ratification)

- **`nav:section` has no WE spec.** `frontierui/blocks/navigation/NavSectionBehavior.ts` is a real, registered
  (`nav:section` — `registerNavigation.ts`) **W3C-APG Disclosure Navigation** behavior with no WE `blocks.json`
  entry. Genuine impl-ahead-of-spec drift, invisible to a dir-based gate (its dir is covered by `nav-list`). →
  file a build to author the WE `nav-section` / disclosure-navigation block spec + FUI manifest entry,
  independent of the granularity ruling.
- **Deferred enhancement:** if same-dir sibling drift recurs, revisit Fork-1 Option B as a *second, lighter*
  check layered on the dir gate — not a replacement.

---

## Context

**Per-fork classification (against the architecture).** The gate is a **build-time devtools/check** (a
`check-standards` rule) — no runtime, no DI, no Protocol; no new Block/Intent. The *completeness invariant* is
WE-standard-owned (#706); the *denominator/gate code* is FUI's instantiation, living in
`frontierui/scripts/check-standards.mjs` (built by [#784](/backlog/784/)). The most-flexible/least-coupling
default (flat-dir, filesystem-only) is the most implementer-agnostic denominator that satisfies the invariant.

**Where this sits.** Slice (b) of epic [#731](/backlog/731/). Ratifying this unblocks #784 (add the gate +
reconcile residual entries); [#785](/backlog/785/) (document derivation-source as a Web-Docs dimension) is
already resolved. The mapping/denominator was the fork the resolved [#737](/backlog/737/) deliberately left
behind (*"Impls with no WE spec id stay unregistered … those belong to the #731 family/mapping decision"*).

**Prior art** (full survey: report + `/research/fui-catalog-family-denominator/`): CEM analyzer (per
module→declaration, tag name from `define()` not dirname), Storybook (`*.stories.*` file-glob marker), Nx
(`project.json` marker files) — all key discovery off an explicit **marker** with the name **decoupled from the
directory path**, infra excluded by absence-of-marker. This confirms I1 and steelmans Fork-1 B.
