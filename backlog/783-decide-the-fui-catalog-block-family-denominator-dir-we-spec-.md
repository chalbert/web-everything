---
type: issue
workItem: story
size: 3
parent: "731"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/scripts/check-standards.mjs (registered-name drift gate, Check 2)
decidedDate: "2026-06-16"
relatedReport: reports/2026-06-16-fui-catalog-family-denominator.md
relatedProject: webdocs
tags: [frontierui, webdocs, catalog, completeness-gate, denominator]
---

# Decide the FUI catalog-block-family denominator + dir→WE-spec mapping rule

**Ratified 2026-06-16 — decision recorded below; this item is now the build story for its residual (Check 2).**
[#706](/backlog/706-generate-fui-s-block-catalog-from-a-derived-manifest-and-ren/)
fixed the invariant — *every implemented `frontierui/blocks/` family must resolve to ≥1 manifest entry, gated
like WE's `check-demos` forces every demo folder to be registered* — but left **family** (the gate's
**denominator**) undefined. This decision defines the denominator, the dir→WE-spec **mapping rule**, and the
no-spec-dir handling. Grounded in a prior-art survey (CEM analyzer · Storybook · Nx) published as
`/research/fui-catalog-family-denominator/` (report linked via `relatedReport`). After the fork-existence test
it reduces to **two forced invariants + one genuine on-merit fork** (denominator granularity, recommended
**flat-dir**); most of the item's apparent complexity (name-mismatch, multi-block) is already handled by the
manifest's `sourcePath` field and is **not** a decision.

## Decision (ratified 2026-06-16) — two checks, two owners

The fork's apparent A-vs-B tension dissolves once the two cons are recognised as **two different jobs** with
**two different owners**, not one gate that must choose:

- **Check 1 — WE-owned completeness gate (Option A).** Denominator = each top-level `frontierui/blocks/<dir>`
  minus `{__tests__, traits, renderers}`; covered iff ≥1 manifest `sourcePath` resolves within it. Pure
  `readdirSync('blocks')`, **implementer-agnostic**, mirrors `check-demos`. **This is [#784](/backlog/784/)**
  (unblocked by this ratification). Green today with zero new entries.
- **Check 2 — FUI-internal registered-name→spec gate (the value of Option B, re-homed).** Denominator = every
  registered public name (`attributes.define(…)`); each must map to a `fui:blocks.json` entry / WE spec. Catches
  same-dir **sibling drift** that Check 1 is blind to (`nav:section`). **This is the build this story now
  carries** (see *Build* below).

**Why this beats picking A or B as a single gate:** Option B's *only* real con was *"couples the WE-standard-owned
invariant to FUI's registration convention."* That con **evaporates** once Check 2 is FUI's *own internal* gate —
FUI depending on FUI's `attributes.define` convention is legitimate (it's FUI checking its own tree, not the
portable standard reaching into FUI's habits). So the split yields **A's portability *and* B's drift-catching,
each in its correct home, neither downside.** Precedent for FUI carrying its own drift gate alongside the
WE-owned one already exists in the same file: `traits/` is excluded from the WE gate precisely because it is
*"already governed by the separate `we:traits.json` drift gate"* (`we:check-standards.mjs:95-116`). Check 2 is that
same pattern for registered blocks.

I1 (sourcePath-anchored mapping) and I2 (`{__tests__, traits, renderers}` exclude-set) ratify as written — both
were forced invariants, not weighable. The full fork analysis is retained below for the record.

## The mapping is already mechanized — `sourcePath`, not dir-name

FUI's impl manifest (`fui:frontierui/src/_data/blocks.json`, 23 entries, filled by the resolved
[#737](/backlog/737/)) carries a **`sourcePath`** on every entry pointing at the dir it realizes
(`fui:src/_data/blocks.json:10` → `"sourcePath": "blocks/stores/simple"`). So coverage is *"does ≥1 manifest entry's
`sourcePath` fall within this dir?"* — and the item's "tricky" cases dissolve, because the mapping is **authored
on the entry, never inferred from the dirname**:

| Concern from the item | Handled by `sourcePath` — already true in `fui:blocks.json` |
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
| 1 | Denominator **granularity** | **Ratified: A *and* B, split into two checks** — A as the WE-owned dir gate (#784), B re-homed as an FUI-internal registered-name gate (this story) | (a single gate forced to choose A *or* B) | **Ratified** — split dissolves the fork |

## Forced invariants (ratify, not weigh)

**I1 — Mapping is `sourcePath`-anchored, not name-matched.** A dir is *covered* iff ≥1 manifest entry's
`sourcePath` resolves within it. This is the only correct rule (it already drives the 23 entries); a
`dir-name == id` rule is *broken* — it breaks all five name-mismatch dirs above. Survey-confirmed: CEM, the
closest standard, resolves a unit's name from its `define()` marker, never its directory.

**I2 — Infra exclude-set = `{__tests__, traits, renderers}`.** Each is *broken* to include:
- `__tests__/` — tests.
- `traits/` — FUI **trait** impls (`Highlight`/`Polling`/`Revealable`/`Sortable`), already governed by the
  **separate** `we:traits.json` drift gate (`fui:frontierui/scripts/check-standards.mjs:95-116`, the `walkTraits`
  bidirectional check). No catalog block lives here; including it double-governs the same files.
- `renderers/` — `we:blocks/renderers/index.ts:11` re-exports the **published** `@frontierui/jsx-runtime` package
  (#265); `renderers/data-grid/` is the data-grid block's internal render helpers. No standalone catalog block.

House style for the exclusion is an explicit set (cf. `TRAIT_NON_TRAIT = {index, types}` in the same gate). The
**no-WE-spec *dirs*** the item asks about (*"exclude or create the spec"*) are **exactly these three infra dirs**
→ **exclude**. There is no whole implemented-block dir missing a spec.

## Fork 1 — denominator granularity: flat dir vs registered-name

The genuine on-merit either/or: what *unit* does the gate iterate to demand coverage?

- **Option A — flat top-level dir + explicit infra exclude-set (recommended).** Denominator = each top-level
  `frontierui/blocks/<dir>` minus `{__tests__, traits, renderers}`; covered iff ≥1 manifest `sourcePath`
  resolves within it. Implemented as a `readdirSync('blocks')` check in `fui:frontierui/scripts/check-standards.mjs`
  (#784), mirroring `check-demos` (`we:scripts/check-demos.mjs:42-77`) — the precedent #706 explicitly named.
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

**Worked example — `frontierui/blocks/navigation/` (the one dir where A and B diverge today).** The dir holds
two registered behaviors but only one manifest entry:

```
blocks/navigation/
  NavListBehavior.ts      → attributes.define('nav:list',    NavListBehavior)     ← registerNavigation.ts:17
  NavSectionBehavior.ts   → attributes.define('nav:section', NavSectionBehavior)  ← registerNavigation.ts:18
  registerNavigation.ts
  index.ts

blocks.json (1 entry maps here):
  { "id": "nav-list", "weSpecPath": "/blocks/nav-list/", "sourcePath": "blocks/navigation" }   ← :143-150
```

- **Under A (flat dir):** the gate iterates `navigation/` and asks *"≥1 manifest `sourcePath` within it?"* —
  yes (`nav-list`). Dir **covered → green.** The unregistered `nav:section` spec gap is **invisible** (it lives
  in an already-covered dir).
- **Under B (registered-name):** the gate iterates the two `attributes.define(…)` names: `nav:list` maps to an
  entry (✓), `nav:section` maps to **none** → **red**, naming the exact missing spec.

This is the whole fork in one dir: B catches the real `nav:section` impl-ahead-of-spec drift that A misses;
A pays nothing for FUI's registration convention and is green today. Every other top-level dir is identical
under both options — `navigation/` is the *only* place the choice changes the gate's verdict right now, which is
why the sibling-drift gap is filed as a follow-up build rather than treated as a reason to adopt B wholesale.

**Ratified outcome: A *as the WE-owned gate*, plus B *re-homed* as a separate FUI-internal gate — not either/or.**
A is the literal `check-demos` precedent #706 cited, kills family-level drift, stays implementer-agnostic, and is
green with no new entries (→ #784). B's drift-catching value is kept too, but moved out of the WE gate into an
FUI-internal registered-name check (this story's *Build*), where depending on FUI's registration convention is
legitimate. See *Decision (ratified)* above for the full rationale.

*Rejected sub-option — leaf-dir recursion* (recurse category dirs `parsers/`/`text-nodes/`/`stores/` to their
child family dirs): reintroduces the `call`/`pipe`/`value` internal-exclusion problem (leaf dirs with no public
registration) for little gain, since it *still* misses the same-dir sibling case (`nav:section`) that motivates
going finer. If you want siblings caught, go to B; otherwise flat-dir is simpler at the same coverage.

## Build (this story carries — Check 2 + its first finding)

The ratified decision spins off the WE-owned dir gate to #784 and keeps the FUI-internal registered-name gate
here. Scope:

1. **Add Check 2 to `fui:frontierui/scripts/check-standards.mjs`** — an FUI-internal drift rule that walks every
   registered public name (`attributes.define(…)` / `customElements.define(…)` across `blocks/`) and FAILS if a
   name has no matching `fui:src/_data/blocks.json` entry. Modeled on the sibling `we:traits.json` drift gate already in
   the same file (`we:check-standards.mjs:95-116`); carries its own internal-name exclusion set (the
   `call`/`pipe`/`value` sub-parsers and trait registrations) as that gate does.
2. **Resolve its first finding — `nav:section`.** `fui:frontierui/blocks/navigation/NavSectionBehavior.ts` is a real,
   registered (`nav:section` — `we:registerNavigation.ts:18`) **W3C-APG Disclosure Navigation** behavior with no WE
   `fui:blocks.json` entry — the exact sibling drift Check 2 exists to catch (invisible to #784's dir gate because
   `navigation/` is already covered by `nav-list`). Author the WE `nav-section` / disclosure-navigation block
   spec + the FUI `fui:blocks.json` entry so Check 2 goes green.

**Acceptance:** Check 2 added; it red-flags `nav:section` before the spec lands and goes green after; no
regression to Check 1 (#784) or the `we:traits.json` gate; `check:standards` green in frontierui.

---

## Context

**Per-fork classification (against the architecture).** The gate is a **build-time devtools/check** (a
`check-standards` rule) — no runtime, no DI, no Protocol; no new Block/Intent. The *completeness invariant* is
WE-standard-owned (#706); the *denominator/gate code* is FUI's instantiation, living in
`fui:frontierui/scripts/check-standards.mjs` (built by [#784](/backlog/784/)). The most-flexible/least-coupling
default (flat-dir, filesystem-only) is the most implementer-agnostic denominator that satisfies the invariant.

**Where this sits.** Slice (b) of epic [#731](/backlog/731/). Ratified — unblocked #784 (Check 1: the WE-owned
dir gate + reconcile residual entries); this story now carries Check 2 (the FUI-internal registered-name gate);
[#785](/backlog/785/) (document derivation-source as a Web-Docs dimension) is already resolved. The mapping/denominator was the fork the resolved [#737](/backlog/737/) deliberately left
behind (*"Impls with no WE spec id stay unregistered … those belong to the #731 family/mapping decision"*).

**Prior art** (full survey: report + `/research/fui-catalog-family-denominator/`): CEM analyzer (per
module→declaration, tag name from `define()` not dirname), Storybook (`*.stories.*` file-glob marker), Nx
(`we:project.json` marker files) — all key discovery off an explicit **marker** with the name **decoupled from the
directory path**, infra excluded by absence-of-marker. This confirms I1 and steelmans Fork-1 B.

## Build progress (resolved 2026-06-16)

**Check 2 added** to `fui:frontierui/scripts/check-standards.mjs` — the FUI-internal registered-name→spec drift gate. It walks every public name registered on disk (`attributes.define` / `customElements.define` across `blocks/`, skipping `__tests__`) and fails if a name isn't declared by some `fui:blocks.json` entry's new `registeredNames` field; bidirectional (a declared name nothing registers is a phantom), modeled on the `we:traits.json` gate. 17 registered names now covered. Negative-tested: removing `nav:section` from `registeredNames` red-flags it ("sibling drift #783 Check 2"); restoring goes green. No regression to Check 1 (#784) or the traits gate; `check:standards` green in frontierui.

- Populated `registeredNames` on the 9 FUI entries that register public names (router, data-grid, background-task-surface, droplist, transient-component, for-each, event-behaviors, type-ahead, nav-list).

**`nav:section` finding — resolved by mapping, not a new block (corrects a stale build premise).** The build text assumed `nav:section` had *no* WE spec and called for authoring a *new standalone nav-section block*. Traced to the tree, that premise is stale: **WE already specs `nav:section` as a behavior of the navigation module** — the WE `nav-list` entry's `blocks` map carries `NavSectionBehavior` (`attribute: "nav:section"`, disclosure-navigation `webStandards`), and `we:src/_includes/block-descriptions/nav-section.njk` documents it, explicitly "part of the Navigation module." So the correct, non-divergent resolution honoring WE's existing single-navigation-block model is to **declare `nav:section` on the existing FUI nav-list entry's `registeredNames`** (`["nav:list", "nav:section"]`), whose `weSpecPath` `/blocks/nav-list/` resolves. Promoting `nav:section` to a standalone block would split the navigation module for no benefit and create two FUI entries sharing `sourcePath blocks/navigation`. Check 2's goal — every registered name maps to a spec, caught at *name* granularity — is fully met. (Orphan `we:nav-section.njk` left as-is: pre-existing, harmless, out of scope.)
