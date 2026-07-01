# WE-standard ↔ WE-website boundary — grounding survey for #2006

**Date:** 2026-07-01 · **Item:** #2006 (decision) · **Type:** prep grounding, no ruling.
**Research topic:** `/research/we-standard-vs-website-app-boundary/`

## The two intermingled surfaces (grounded inventory)

The `webeverything` repo holds both surfaces with no machine-legible marker of which is which.

**SURFACE A — WE-the-standard (zero-impl authority):**
- `we:src/_data/intents/*.json`, `we:src/_data/blocks/*.json`, `we:src/_data/plugs/*.json`,
  `we:src/_data/protocols/*.json`, `we:src/_data/semantics/*.json` — the definitions
- `we:capability-manifest/`, `we:conformance-vectors/`, `we:validation-generation/` — meta-schemas
- `we:scripts/check-standards.mjs`, `we:scripts/check-standards-rules.mjs` — the conformance gate
- `we:backlog/*.md`, `we:reports/*.md`, `we:contracts/` — decision corpus + contracts

**SURFACE B — WE-the-website (11ty + Vite product that renders A):**
- `we:.eleventy.js`, `we:vite.config.mts` — build config
- `we:src/*.njk` (index, backlog, intent-pages, block-pages, …) — page templates
- `we:src/_data/*.js` — Eleventy data loaders (the intents / blocks / backlog / site loaders)
- `we:src/_includes/*-descriptions/*.njk` — spec render partials
- `we:src/assets/js/*.js`, `we:src/assets/css/` — site client features (board, burndown, graph)

**The shared seam:** `we:scripts/lib/intents-loader.cjs` (and the sibling `*-loader.cjs`) is `require()`d by
**both** `we:src/_data/intents.js` (site render) **and** `we:scripts/check-standards.mjs` (the gate). CJS is
deliberate — one assembler feeds the synchronous Eleventy 2.x config and the ESM validators alike. So one
spec source drives both the render and the conformance gate.

## Why rule 6 doesn't already settle it

`we:docs/agent/platform-decisions.md` rule 6 (near L185) ratifies "the WE *website* ≠ the WE *standard*" —
but its test is explicitly **"source-dependency direction (WE→FUI), not runtime execution or rendered
pixels."** It governs the **WE↔FUI** boundary (may the site render/run FUI? — yes, by construction, as long
as it doesn't build-time `import '@frontierui'`). It does **not** reach **intra-repo legibility** — the thing
#2006 targets. And `we:AGENTS.md:18` ("the website IS the spec") conflates the spec *data* with the render
*partials*, cementing the ambiguity.

## Prior-art survey

**Separate-repo camp (product sites):** TypeScript (`microsoft/TypeScript` vs `microsoft/TypeScript-Website`),
React (`facebook/react` vs `reactjs/react.dev`), Tailwind (`tailwindlabs/tailwindcss` vs `…/tailwindcss.com`),
JSON Schema (spec repo vs `json-schema-org/website`).

**Same-repo-build-artifact camp (pure-render sites):** WHATWG HTML (`whatwg/html` → html.spec.whatwg.org built
in-repo), CSSWG drafts.

**The discriminator that predicts the camp:** is the site a *pure render* of the spec (build artifact → keep
in-repo) or a *product* with its own content + interactive features (separate repo)? WE's site is the
**product** shape (board/burndown/graph/#184 landing) — arguing for eventual product-tier separation — **but**
it uniquely also *hosts the conformance gate* over the spec, a coupling the framework docs sites lack. That
coupling is why the durable near-term move is a **machine-legible internal boundary**, not an immediate split.

## Classification (constellation/placement governance)

Not a new WE standard — a placement/legibility ruling. Binding statutes: #1246/#1282 (zero-impl), rule 6
(website≠standard on the WE↔FUI axis), #872 (contract distribution — the prerequisite that would let a
split-out site consume a *published* standard). The 7-question layer pass is N/A (no intent/protocol layer);
the governing bias is separate-and-decouple, but tempered by the single-gate dogfood coupling.

## Forks brought to DoR

1. **Separation mechanism** — (a) one repo + machine-legible internal boundary [default]; (b) extract the
   website into a separate repo / product-tier package; (c) documentation-only clarification.
2. **Classification marker** (conditional on 1a) — (a) a standard-surface manifest [default]; (b) directory
   reshuffle (`standard/` vs `site/`); (c) per-file frontmatter.
3. **Naming disambiguation** — (a) prose convention only [default]; (b) rename the package/repo.
