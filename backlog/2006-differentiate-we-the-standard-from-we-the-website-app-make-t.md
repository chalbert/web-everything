---
kind: decision
status: open
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
preparedDate: "2026-07-01"
relatedReport: reports/2026-07-01-we-standard-vs-website-boundary.md
relatedProject: webdocs
tags: [constellation, placement, boundary, zero-implementation, website, decision]
---

# The WE-website is a product mis-homed in the WE repo — make the boundary machine-legible + decide its end-state home

## Grounding digest

The `webeverything` repo intermingles two surfaces with **no machine-legible marker of which is which**.
**WE-the-standard** (zero-impl authority): the intent/block/plug/protocol/semantic definitions
([we:src/_data/intents/](../src/_data/intents/) etc.), the meta-schemas
([we:capability-manifest/](../capability-manifest/), [we:conformance-vectors/](../conformance-vectors/)),
the conformance gate ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs)), and the
backlog/decision corpus. **WE-the-website**: a full 11ty + Vite product that *renders* the standard —
[we:.eleventy.js](../.eleventy.js), [we:vite.config.mts](../vite.config.mts), `we:src/*.njk` page templates,
`we:src/_data/*.js` Eleventy loaders, `we:src/_includes/*-descriptions/*.njk` render partials, and its own
client product features (backlog board, burndown, graph, the #184 marketing landing). Prior art
([/research/we-standard-vs-website-app-boundary/](/research/we-standard-vs-website-app-boundary/)):
standards/framework projects with a real frontend split the spec-SOURCE from the docs-SITE into separate
repos (TypeScript, React, Tailwind, JSON Schema); only *pure-render* sites stay in-repo (WHATWG). WE's site
is the *product* shape.

## The reframe (what is actually open — and what is not)

**The distinction "WE-website ≠ WE-standard" is not the open question — it is already quadruple-ratified:**
constellation rule 1 ([we:platform-decisions.md:77](../docs/agent/platform-decisions.md#L77)), the FUI-embed
rule 6 ([:185](../docs/agent/platform-decisions.md#L185)), #932 lineage, and the product-frontend statute
([:1537](../docs/agent/platform-decisions.md#L1537) — product composition "Lives in the **product's own
frontend** (e.g. the WE website), **not** WE/FUI"). So this item must **not** re-mint that rule (doing so
duplicates settled statute, and a decision item must stay a single current source of truth, not a
supersession layer).

What *is* open: **the 11ty + Vite website is delivery implementation** — an *artifact-producing render*, which
by constellation rule 1's own file-seam test ("code that **delivers a capability at runtime** … artifact-
producing … → Frontier UI / a served product → Plateau; **WE holds zero implementation**",
[:70-74](../docs/agent/platform-decisions.md#L70-L74)) belongs **out of WE**. Yet it sits in WE with no
tracking — the *untracked* twin of the ~8 relocation-debt runtimes rule 1 already names
([:103-105](../docs/agent/platform-decisions.md#L103-L105): "tracked relocation debt … **no _new_ WE-resident
delivery runtime may be added**"). The genuinely-open calls are therefore **(1) its end-state home** and
**(2) the interim mechanism** that makes the boundary machine-legible until then. **Cite rule 1/2
(file-seam placement), never rule 6** — rule 6's test is *source-dependency direction* (may the site render
FUI?), which does not reach intra-repo file classification.

Note the separability that unlocks the split: the **conformance gate stays WE** regardless — it is the
[:80-90](../docs/agent/platform-decisions.md#L80-L90) [we:capability-manifest/check.ts](../capability-manifest/check.ts)
carve-out ("checks conformance, does not deliver a capability"). The gate is *not* the website; the
artifact-producing *render* is. Splitting the render out does not take the gate with it.

## Recommended path at a glance

| Fork | Question | Recommended default |
|---|---|---|
| **1** | End-state home of the website surface | **(a) extract to a product-tier surface** (own repo / product package) that consumes the published standard — gated on #872 contract distribution |
| **2** | Interim mechanism until the extraction lands | **(b) a directory boundary** (`site/**` vs the standard surface) — drift-durable + a down-payment on Fork 1(a) |

**Supported by default (not forks):** the *naming* disambiguation — adopt a prose convention now ("Web
Everything / WE" = the standard; "the WE website / WE-docs" = the product surface) in
[we:AGENTS.md:18](../AGENTS.md#L18) (which currently conflates them: "the website IS the spec"). A
package/repo *rename* is a distribution act that lives with #872's contract-package identity, not a separate
fork here (naming-in-prose and package-rename are orthogonal acts, not two branches of one choice).

## Fork 1 — End-state home of the WE-website surface

*Fork exists because:* the excluded branch is **permanent sanctioned co-location in WE** — rule 1 forbids a
standing WE-resident delivery tier ("**not** a sanctioned standing tier … no _new_ WE-resident delivery
runtime"), so "keep the render in WE forever behind a boundary" is the *broken* branch, not a coherent
alternative end-state. Extraction vs a permanent internal boundary genuinely cannot both be the terminal state.

- **(a) Extract to a product-tier surface** *(default)* — the website moves to its own repo (or a product-tier
  package alongside plateau-app) and consumes the standard as *published data + the type-only
  `@webeverything/contracts` package* (rule 3, [:109-112](../docs/agent/platform-decisions.md#L109-L112)),
  exactly as FUI consumes WE. The WE repo keeps the definitions, meta-schemas, gate, and backlog.
  **Gated on #872** (the contract-distribution mechanism the split-out site would consume) — until #872
  publishes a consumable standard, the render can't cleanly leave. So (a) is the ratified *direction*; the
  live near-term work is Fork 2's interim.
- **(b) Permanent internal boundary** — bless the website's WE residence as a sanctioned standing surface,
  legible only by a marker. *Excluded end-state* (rule 1), retained here only to name the branch being rejected.

**Default rationale (red-teamed):** the website is artifact-producing render = product per rule 1's own test;
statute :1537 homes it in "the product's own frontend, not WE/FUI." The one real counter — "the shared
conformance gate justifies co-location" — fails: the gate is the separable conformance-tooling carve-out and
stays WE; a split-out site consumes published vectors + `@webeverything/contracts` (the dogfood rule 6 itself
blesses). The seam (`we:scripts/lib/*-loader.cjs` shared by render + gate) is a *dependency*, not a
co-location requirement — the loaders assemble the standard's own data and stay WE with the gate; the render
consumes that data across the seam.

**Skeptic:** SURVIVES (default flipped *to* this position *by* the prep skeptic). The first draft defaulted to
a permanent in-repo manifest (Fork-1(b)-flavored); the four-axis attack REFUTED it — Axis-1 merit: statute
:1537 + rule 1 :73-74 make the website a *mis-homed product*, so a manifest that blesses its WE residence
"papers over a placement violation the statutes already forbid." Flipped to extraction-as-end-state, interim
as tracked debt. Axis-2 statute-overlap: reconciled by amending *under* the constellation-placement anchor,
not minting a new rule. Axis-3 citation-scope: swapped the rule-6 citation (source-direction, out of scope)
for rule 1/2 (file-seam placement, in scope).

## Fork 2 — Interim mechanism until the extraction (Fork 1a) lands

*Fork exists because:* a glob manifest and a directory boundary are mutually exclusive mechanics for the same
classification — maintaining both is redundant drift. The excluded branch is **do-nothing-until-#872**: since
#872 is an open epic (not imminent), leaving the ambiguity live across its whole horizon is the broken branch
that the #1913/#1948 recurrences already disprove.

- **(a) Standard-surface manifest** — a standard-surface glob manifest + a `check:standards` rule that
  fails closed on any file classified as neither standard nor site. Cheapest; *is* the eventual extraction
  manifest (tells you exactly what moves in Fork 1a — no double-move). Cost: classification-by-omission can
  rot, which the fail-closed gate rule is there to prevent.
- **(b) Directory boundary** *(default)* — lift the unambiguous website files under a `site/**` root
  (`we:.eleventy.js`, `we:vite.config.mts`, `we:src/*.njk`, `we:src/assets/`, the `*-descriptions/` partials,
  the `we:src/_data/*.js` loaders), leaving the standard definitions (`we:src/_data/*/*.json`) and the shared
  loader seam classified in place. Misclassification becomes a *move*, not a forgotten edit — self-evident to
  grep/glob/the gate with no manifest to maintain — and it is a **down-payment on Fork 1(a)** (a `site/`
  subtree lifts cleanly to a repo).

**Default rationale (red-teamed):** default (b) because #872 (the Fork-1a gate) is not imminent, so the
interim must be *durable*, and a directory is self-enforcing where a manifest rots. The live counter — for an
extraction end-state, a manifest avoids moving files twice (into `site/`, then out to the new repo) and *is*
the extraction manifest — is real; it is why (a) stays a genuine contender the decider may prefer if #872 is
close. If (b) is chosen, the messy seam is `we:src/_data/`, where standard `.json` defs and site `.js` loaders
interleave — the move must split that directory at the file seam (rule 2), not lift it wholesale.

**Concrete shape** (Fork 2 turns on a code-level layout + gate rule):

```
# Fork 2(b) default — directory boundary
site/                      # the product surface (lifts to its own repo in Fork 1a)
  eleventy + vite config   pages/*.njk   assets/{js,css}/   _data/*.js (loaders)   _includes/*-descriptions/
src/_data/intents|blocks|plugs|protocols|semantics/*.json   # standard — stays
capability-manifest/  conformance-vectors/  scripts/ (check-standards gate)  backlog/   # standard — stays
scripts/lib/ (assembler loaders)   # shared seam: standard data, consumed by both gate and site _data loaders

# The fail-closed gate rule both forks need (a check:standards rule):
#   every tracked path matches exactly one of {standardSurface, siteSurface};
#   an unclassified path is a hard error — so new site code can never masquerade as standard.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT. Axis-1 merit attack REFUTED the first-draft manifest default (2a) on
drift-durability + down-payment grounds → flipped default to the directory boundary (2b). Amendment folded:
whichever mechanism wins, it carries the **fail-closed classification gate rule** (an unclassified path errors)
— that neutralizes the manifest's rot objection and keeps 2(a) a live alternative for a near-term #872.

## Downstream / unblocks

- Clears the recurring placement ambiguity behind **#1913** (FUI/product) and **#1948** — a placement call can
  then cite a machine-legible classification instead of re-deriving it.
- **#872** (contract distribution) is the hard prerequisite for Fork 1(a); this decision states the dependency
  rather than duplicating #872. The package/repo *rename* rides #872's contract-package identity.
- On ratify, the ruling **amends constellation rule 1** (adds the website as named product-tier relocation
  debt + the interim classifier) — it does **not** open a new platform-decisions anchor.
