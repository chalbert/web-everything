---
kind: decision
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-rules-readpath-prep-1792.md
tags: [website, governance, docs, exposure]
---

# Expose the project's general rules on the website (statute layer has no read path)

The project's general rules — the statute layer in [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) plus its siblings under [we:docs/agent/](docs/agent/) — have **no URL on the docs site**. Eleventy's input dir is `we:src/` only (`we:.eleventy.js:265-280`), so the entire `we:docs/` tree sits outside the build with no passthrough. This violates the standing "expose everything through the website" rule: every other artifact type (protocols, intents, research, blocks, projects, …) has an auto-rendered catalog, but the rules that govern them are repo-only. Worse, `codifiedIn:` citations across the backlog 404.

## Grounding digest

- **The cite debt is bigger than one file.** `codifiedIn:` values across `we:backlog/*.md` point at **four** docs, all currently 404: **211 → `we:docs/agent/platform-decisions.md`**, 7 → `we:docs/agent/block-standard.md`, 4 → `we:docs/agent/backlog-workflow.md`, 2 → `we:docs/agent/vision-tiers.md`. The platform-decisions cites span **57 distinct anchors** (top: `#constellation-placement` ×42, `#project-protocol-bar` ×25, `#monetization` ×16). One (`#relocation-granularity`) is an **inline** `{#...}` anchor (`we:docs/agent/platform-decisions.md:133`), not a `###` heading — any render must preserve inline anchors too.
- **`we:docs/agent/platform-decisions.md` is prose, not records.** 1564 lines, 57 `### <title> {#anchor}` rule headings under `## The standing rules`, densely cross-linked (rule bodies reference sibling anchors inline). It is a **single living file edited on every decision-resolve** (`we:docs/agent/platform-decisions.md:14-20,35-37`). The per-rule machinery the project tracks — `codifiedIn`, supersedes-edges, status — lives on the **decision items' frontmatter**, not on the rule prose.
- **Two existing catalog shapes.** *Protocols* = index-only, cards deep-link into the owning project page (`we:src/protocols.njk:50-75`). *Research topics* = registry + auto-rendered **detail page** with a per-id prose partial and a gate that requires the partial exist (`we:src/research-topic-pages.njk:1-11,66`; `we:scripts/check-standards.mjs:143-145`). Both filter on **structured frontmatter fields** (`ownedByProject`/`status` at `we:src/protocols.njk:19-47`) that the prose rules **do not have**.
- **The render itself is the shared cost.** Passthrough copy ships files raw (an unrendered download); getting `we:docs/agent/*.md` through the markdown engine with anchors needs a real collection/pagination template (the `we:src/research-topic-pages.njk:1-6` pattern) — a cost (a), (b), and (c) **all** pay, so it doesn't decide the fork.
- **No `we:src/_data/rules/` exists** (option (b) is greenfield). `/governance/` returns 200 but is a hand-authored steward→foundation *narrative* (`we:src/governance.njk:1-5,57-120`), unrelated to statute rules. New catalog route segments must be added to the Vite dev-proxy allowlist (`we:vite.config.mts:127`) or `check:standards` fails (`we:scripts/check-standards-rules.mjs:1134-1143`).

## The axis

The decision is **where the rules' authoring source-of-truth lives, and how much structure is derived from it** — pinned between two real pulls. The "catalogs auto-render from JSON" convention ([catalogs-auto-render]; `we:src/research-topic-pages.njk`) pulls toward promoting each rule to a record; the "author in the standard's own form / minimize lock-in" rules ([authoring-sot-is-the-standard-form], [minimize-lock-in]) plus the single-living-file resolve workflow (`we:docs/agent/platform-decisions.md:14-20`) pull toward keeping markdown as SoT. The grounding dissolves the item's original A-vs-B binary: the rules are **prose**, not the structured records the catalog pattern was built for, so a faithful synthesis (**(c)**) keeps the markdown SoT but derives just enough — a rendered index across all four cited docs and a gate that every `codifiedIn:` anchor resolves — without a records migration or an invented filter UI.

## Recommended path at a glance

| Fork | Axis | Options | Default |
|---|---|---|---|
| **1** | Read-path shape / authoring SoT | (a) markdown-lift only · (b) registry decomposition · (c) rendered index over markdown SoT + cross-doc anchor gate | **(c)** |
| **2** | Root governance-narrative docs routing | (a) all under `/rules/` · (b) narratives → `/governance/`, statute → `/rules/` | **(b)** |

## Fork 1 — read-path shape (where the authoring SoT lives)

*Fork-existence:* a real either/or — the three options pick **different steady-state sources of truth** (rendered markdown vs. per-rule records vs. markdown-plus-derived-index) that cannot all be the SoT at once. The excluded branches: (a) leaves the statute layer non-first-class (renders the docs but adds no index/gate, so anchor drift in a file edited every resolve silently re-breaks cites); (b) abandons the markdown authoring form and the single-file resolve workflow to chase a records-catalog the prose content doesn't want.

- **(a) markdown-lift only** — render `we:docs/agent/*.md` to `/rules/` via a collection template, heading anchors preserved. Cheapest visible step, but no index and no anchor-resolution gate, so it solves *read-path* without solving *correctness-over-time*.
- **(b) registry decomposition** — promote each rule to `we:src/_data/rules/<id>.json` + `we:src/_includes/rule-descriptions/<id>.njk`, mirroring the research-topics registry. Makes rules filterable records, but shatters the dense inter-rule cross-references into brittle cross-file IDREFs and moves the SoT off the markdown form ([authoring-sot-is-the-standard-form]); the per-rule status/supersedes metadata it would expose already lives on the decision items, not the rules ([File-Count ≠ Schema-Coupling]).
- **(c) rendered index over markdown SoT + cross-doc anchor gate (default)** — markdown stays SoT; a collection template renders all four cited docs (`we:docs/agent/platform-decisions.md`, `we:docs/agent/block-standard.md`, `we:docs/agent/backlog-workflow.md`, `we:docs/agent/vision-tiers.md`), a build step emits a plain rendered **index** (linked list of headings → sections), and a **gate scans the full `codifiedIn:` corpus against the rendered output of all four docs** so every cite resolves and drift is caught. No per-rule files; no invented filter UI.

**Default: (c).** It is the only option that resolves the *whole* cite debt (the 7 `we:docs/agent/block-standard.md` + 4 `we:docs/agent/backlog-workflow.md` + 2 `we:docs/agent/vision-tiers.md` anchors a platform-decisions-only render would still 404, e.g. `#program-definition` resolves into `we:docs/agent/backlog-workflow.md`) while preserving how rules are authored. It is "(a) plus an index and the gate" — a small delta over the cheap option, not the records migration of (b).

`Skeptic: SURVIVES-WITH-AMENDMENT` — the attack "(c) is YAGNI, just do (a)" landed on **one** sub-part: 57 prose rules have no facetable frontmatter (protocols/intents filter on fields rules lack), so a **filterable catalog is dropped** — keep only a plain rendered index. But the inverse attack ("the gate adds nothing over (a)") was refuted: cites span four docs and inline sub-anchors, and the file is edited every resolve, so the anchor-resolution gate is the load-bearing deliverable (a) omits. Amendment folded: default is now *rendered index + cross-doc gate*, no filter UI.

## Fork 2 — routing the root governance-narrative docs

*Fork-existence:* a genuine placement either/or — `we:DEV_GUIDE.md`, `we:SELF-DRIVEN-PROJECT-DRAFT.md`, and `we:CLA.md` are also outside the build, and a doc lands on exactly one route. The excluded branch (a) force-fits human-read narrative into the cite-target statute route, coupling `codifiedIn:` anchor resolution to editorial pages and drowning a deliberately humble narrative (`we:src/governance.njk:122-134`) in normative statute.

- **(a) everything under `/rules/`** — one route. Simpler nav, but mixes two genres (machine-cited statute vs. human-read narrative) and pollutes the cite-target namespace.
- **(b) narratives → `/governance/`, statute → `/rules/` (default)** — route *per file* by genre: the statute rules to `/rules/` (Fork 1), and the governance narratives to the existing `/governance/` page (`we:src/governance.njk`), which is already an editorial steward→foundation argument of the same genre. `we:CLA.md`/`we:DEV_GUIDE.md` route per-file (CLA legal, DEV_GUIDE instructional) rather than blindly.

**Default: (b).** The split tracks a real genre line — *cite-target statute* (read by agents following a `codifiedIn:` link, 224 inbound) vs. *human-read narrative* (read by a person auditing governance) — and `/governance/` is demonstrably a narrative page, not a rules home ([bias-separation-decoupling]).

`Skeptic: SURVIVES` — beat "two routes confuse readers": the routes serve two different *readers*, and folding 57 normative rules into the narrative page would couple cite-anchor resolution to an editorial surface (`we:src/governance.njk:1-139`). Per-file routing keeps `we:CLA.md`/`we:DEV_GUIDE.md` from being force-bucketed.

## What you decide

Ratify Fork 1 (default **(c)**) and Fork 2 (default **(b)**), or override. Resolving opens the build story: a docs collection template rendering the four cited docs, a `/rules/` index + nav entry (`we:src/_layouts/base.njk:95-97`) + Vite allowlist entry (`we:vite.config.mts:127`), and the cross-doc `codifiedIn:` anchor-resolution gate.

## Resolution (ratified 2026-06-27)

Both defaults ratified after grounding-verification and red-team: **Fork 1 → (c)** rendered index over markdown SoT + cross-doc anchor gate (no records migration, no filter UI); **Fork 2 → (b)** statute → `/rules/`, governance narratives → `/governance/`, per-file. Grounding confirmed against the tree: ~209 platform-decisions cites / 57 distinct anchors + 7/4/2 across the three sibling docs (all 404 today); Eleventy `input: "src"` with no `docs/` passthrough; `we:src/_data/rules/` absent; `we:src/governance.njk` is a narrative page. Build graduates to **#1828** (`blockedBy: 1792`); no new statute rule (an application of [authoring-sot-is-the-standard-form] / [bias-separation-decoupling]), so `codifiedIn: one-off`.

## Acceptance

- A `/rules/` surface exists, reachable from site nav, rendering the four cited governance docs with heading **and inline** anchors intact.
- A gate asserts every `codifiedIn:` anchor across `we:backlog/*.md` resolves to rendered output (no 404), covering all four cited docs.
- Governance narratives (`we:DEV_GUIDE.md`, `we:SELF-DRIVEN-PROJECT-DRAFT.md`, `we:CLA.md`) reachable per Fork 2.
- `check:standards` green.
