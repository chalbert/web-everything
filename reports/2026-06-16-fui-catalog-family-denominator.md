# FUI catalog-block-family denominator + dir→WE-spec mapping rule

**Decision prep for [#783](../backlog/783-decide-the-fui-catalog-block-family-denominator-dir-we-spec-.md)** — slice (b) of the
FUI block-catalog completeness epic [#731](../backlog/731-build-fui-block-catalog-completeness-gate-fill-authored-entr.md),
executing the [#706](../backlog/706-generate-fui-s-block-catalog-from-a-derived-manifest-and-ren.md) ruling.
Published as the `/research/` topic `fui-catalog-family-denominator`.

## The question #706 left open

#706 ratified a **fixed invariant**: *"Every implemented `blocks/` family must resolve to ≥1 manifest
entry, gated in `check-standards` the way WE's `check-demos` forces every demo folder to be registered."*
It deliberately did **not** define the load-bearing word **family** — i.e. the gate's **denominator**: the
set of dirs under `frontierui/blocks/` the gate iterates and demands coverage for. #783 defines it, plus the
**dir→WE-spec mapping rule** (incl. name-mismatched and multi-block dirs) and what to do with dirs that have
no WE spec.

This is **not** greenfield standard authoring — it ratifies a classification over an *existing* tree and an
*existing* gate pattern. The web survey below grounds the granularity choice; the rest is concrete-refs work.

## The tree as it actually is (verified 2026-06-16)

`frontierui/blocks/` has **24** dirs (23 + `__tests__`). FUI's impl manifest
(`fui:frontierui/src/_data/blocks.json`, 23 entries — filled to completeness by the resolved #737) already
carries a **`sourcePath`** field on every entry pointing at the dir it realizes
(`fui:src/_data/blocks.json:10` `"sourcePath": "blocks/stores/simple"`, etc.). Mapping each entry's `sourcePath`
back to a top-level dir:

| Top-level `blocks/` dir | Maps to WE spec(s) via `sourcePath` | Notes |
|---|---|---|
| `attributes/` | `event-behaviors` (`blocks/attributes/on-event`) | category dir; mapped at sub-dir |
| `audit/` | `audit-trail` | **name-mismatch** (audit → audit-trail) |
| `background-task-surface/` | `background-task-surface` | 1:1 |
| `data-grid/` | `data-grid` | 1:1 |
| `droplist/` | `droplist` | 1:1 (many internal files, one block) |
| `for-each/` | `for-each` | 1:1 |
| `lifecycle/` | `lifecycle` | 1:1 |
| `master-detail/` | `master-detail` | 1:1 |
| `navigation/` | `nav-list` (`blocks/navigation`) | **name-mismatch**; also registers `nav:section` (no spec — see below) |
| `parsers/` | `handler-expression-parser`, `double-curly-bracket-parser`, `double-square-bracket-parser` | **multi-block** (3 specs in one dir); `call/`, `pipe/`, `value/` are internal sub-parsers (no spec) |
| `renderers/` | — | **UNMAPPED** — `we:index.ts:11` re-exports the published `@frontierui/jsx-runtime` (#265); `renderers/data-grid/` is data-grid-internal render helpers |
| `resource-loader/` | `resource-loader` | 1:1 |
| `router/` | `router` | 1:1 |
| `selection/` | `selection` | 1:1 |
| `stepper/` | `stepper` | 1:1 |
| `stores/` | `simple-store` (`blocks/stores/simple`) | **name-mismatch** (stores → simple-store) |
| `tabs/` | `tabs` | 1:1 |
| `text-nodes/` | `interpolation-text-node` (`blocks/text-nodes/interpolation`) | **name-mismatch** |
| `traits/` | — | **UNMAPPED** — FUI *trait* impls (Highlight/Polling/Revealable/Sortable), governed by a **separate** catalog (`we:src/_data/traits.json` + the `walkTraits` drift gate, `we:scripts/check-standards.mjs:95-116`) |
| `transient/` | `transient-component` | **name-mismatch** |
| `tree-select/` | `tree-select` | 1:1 |
| `type-ahead/` | `type-ahead` | 1:1 |
| `view/` | `view` | 1:1 |
| `__tests__/` | — | tests |

**Key consequence:** with `renderers/`, `traits/`, `__tests__/` set aside, **all 21 remaining top-level dirs
already have ≥1 manifest entry** whose `sourcePath` resolves within them. So a top-level-dir denominator is
**green today** with zero new entries — the documented disease (#706's "16 whole families unpublished") is
already cured by #737; the gate's job is to *keep* it cured.

## The two precedents the gate sits between

1. **`check-demos` (`we:scripts/check-demos.mjs:42-77`)** — the precedent #706 explicitly cited. It is
   **flat dir-based**: `readdirSync(demos/)` filtered to folders containing `we:index.html`, then "every folder
   must have a `we:demos.json` entry." One level, no recursion, no registration parsing.
2. **The trait gate (`fui:frontierui/scripts/check-standards.mjs:95-116`)** — `walkTraits` recurses `blocks/**`,
   keys off files in a dir named `traits/`, and excludes infra with an **explicit set**
   (`TRAIT_NON_TRAIT = {index, types}`, plus skipping `__tests__`). Internal precedent that an explicit
   infra-exclusion list is the house style.

Both are pure filesystem checks (no server, no registration enumeration), composing into the gate's
descriptor shape.

## Prior art — how catalog tools define their discovery unit

Surveyed CEM analyzer, Storybook, and Nx (sources in the `/research/` topic). One convergent finding:

- **Discovery keys off an explicit marker, with the unit's NAME decoupled from its directory path.** CEM's
  `@custom-elements-manifest/analyzer` discovers per *module → declaration* and resolves a tag name from the
  `customElements.define('x-foo', …)` call — **never** from filename/dirname; one module may emit many
  declarations. Storybook globs `*.stories.*` files (file-presence marker); the unit is the story file.
  Nx discovers "projects" by a **marker file** (`we:project.json`/`we:package.json`), not a dir-name convention.
- **Infra is excluded by *absence of the marker*, not primarily by a denylist** (denylists appear only as a
  secondary refinement — Nx negating a `workspaces` glob, Storybook narrowing its glob).
- **Many units per dir/file is normal and handled** (CEM many declarations/module; Storybook many stories/dir).

**How this bears on the call:** the survey *strongly confirms* the mapping invariant (a manifest's authored
`sourcePath` is exactly the "name decoupled from path" marker — CEM resolves names the same way, never by
dirname, which is why our name-mismatch dirs are non-issues). It *steelmans* the registration-name
granularity branch (the broad norm is marker/registration-based discovery, finer than a dir). The
counterweight that keeps the gate **dir-based**: (a) the inverse goal — those tools *discover what exists*;
this gate *forces coverage of what exists in the manifest*, whose nearest precedent is `check-demos`
(dir-based); (b) **implementer-agnosticism** — the completeness invariant is WE-standard-owned (#706) and must
read any implementer's filesystem, while registration-name granularity couples the gate to FUI's
`attributes.define` convention.

## The decision, after the fork-existence test

Most of #783's surface is **not** a decision once classified:

- **Mapping rule = `sourcePath`-anchored, not name-matched** — *forced invariant*. Coverage = "≥1 manifest
  entry whose `sourcePath` falls within the dir." Name-mismatch (stores→simple-store, navigation→nav-list,
  transient→transient-component, text-nodes→interpolation-text-node, audit→audit-trail) and multi-block
  (parsers→3) are handled **by construction** — already true in `fui:blocks.json`. A dir-name==id rule would be
  *broken* (it breaks every name-mismatch). Survey-confirmed (CEM resolves names off the `define()` marker,
  not the path). **Not a branch — already the case.**
- **Infra exclude-set = {`__tests__`, `traits/`, `renderers/`}** — *forced invariant*. Each is broken to
  include: `__tests__` is tests; `traits/` is double-governed by the separate `we:traits.json` gate
  (`we:check-standards.mjs:95-116`) and carries no catalog block; `renderers/` is a published-package re-export
  (`@frontierui/jsx-runtime`, #265) + data-grid-internal helpers, no standalone block. House style for the
  exclusion is an explicit set (cf. `TRAIT_NON_TRAIT`).
- **No-WE-spec *dirs*** — at dir granularity, the *only* dirs with no WE spec are the three infra dirs above →
  **exclude** (not "create a spec"). There is no whole implemented-block dir missing a spec. (The one genuine
  *sub-dir* impl-without-spec — `nav:section` — is captured below, independent of the gate.)

What's left is **one genuine on-merit fork**:

### Fork 1 — denominator granularity: flat dir vs registered-name

- **A — Flat top-level dir + explicit infra exclude-set (recommended).** Denominator = each top-level
  `blocks/<dir>` minus `{__tests__, traits, renderers}`; covered iff ≥1 manifest `sourcePath` resolves within
  it. Mirrors `check-demos` exactly (the #706 precedent), pure-filesystem (implementer-agnostic — works on any
  manifest, no FUI registration coupling), deterministic, **green today**. *Merit downside:* blind to
  same-dir sibling drift — a second registered behavior in an already-covered dir (e.g. `nav:section` inside
  `navigation/`) is not caught.
- **B — Registered-name denominator.** Enumerate every registered public name (`attributes.define(…)` /
  `customElements.define(…)`) and require each to map to a manifest entry. Catches `nav:section` and any future
  same-dir sibling. *Merit downsides:* couples the WE-standard-owned invariant to FUI's registration
  convention (a portability regression for a gate #706 says the standard owns), and reintroduces an
  **internal-name exclusion list** (the `call`/`pipe`/`value` sub-parsers, trait registrations) — more drift
  surface, the very thing the gate fights.

**Recommended: A.** It is the literal `check-demos` precedent #706 named, kills the documented family-level
drift, stays implementer-agnostic, and is green with no new entries. The sibling-drift gap is real but rare
and is better handled as a *captured follow-up* than by coupling the gate to a registration convention.

*Rejected sub-option — leaf-dir recursion* (recurse category dirs like `parsers/`, `text-nodes/`, `stores/`
to their child family dirs): it reintroduces exactly the `call`/`pipe`/`value` internal-exclusion problem
(those are leaf dirs with no public registration) for little gain over flat-dir, since it *still* misses the
same-dir sibling case (`nav:section`) that motivated going finer. If you want to catch siblings, go to B;
otherwise flat-dir is simpler than leaf recursion at the same coverage.

## Captured follow-ups (not fork branches)

- **`nav:section` has no WE spec.** `NavSectionBehavior` (`we:blocks/navigation/NavSectionBehavior.ts`) is a real,
  registered (`nav:section`) W3C-APG **Disclosure Navigation** behavior with **no** WE `fui:blocks.json` entry. It
  is genuine impl-ahead-of-spec drift, invisible to a dir-based gate (its dir is covered by `nav-list`). →
  file a build: author the WE `nav-section` (disclosure-navigation) block spec + FUI manifest entry. Independent
  of the granularity ruling.
- **Deferred: registered-name coverage check.** If same-dir sibling drift recurs, revisit Fork-1 option B as a
  *second, lighter* check layered on the dir gate — not a replacement.

## Per-fork classification (against the architecture)

- **Layer:** the gate is a **build-time devtools/check** (`check-standards` rule) — no runtime, no DI, no
  Protocol. The *completeness invariant* is WE-standard-owned (#706); the *denominator/gate code* is FUI's
  instantiation, living in `fui:frontierui/scripts/check-standards.mjs` (#784). No new Block/Intent/Protocol.
- **Fixed mechanic vs dimension:** the invariant is a fixed mechanic (always on, #706). The denominator
  granularity is a fork because both branches are coherent end-states that cannot coexist as the gate's unit.
- **Default = most permissive / least-coupling:** flat-dir is the most implementer-agnostic, lowest-coupling
  denominator that satisfies the invariant — the most-flexible default for a standard-owned gate.
