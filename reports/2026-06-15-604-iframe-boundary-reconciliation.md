# Reconciling #604 ("WE renders real FUI blocks") with the #700/#701 iframe boundary

**Date:** 2026-06-15 · **For:** backlog #707 (decision prep) · **Status:** grounding artifact (no human call yet)

## Why no web survey / `/research/` topic

This is a **ratify-existing-internal-ground** decision, not a greenfield design. There is no external
prior art to survey: the question is purely how one constellation epic (#604) should be realigned to a
boundary **already ruled** inside the constellation (#700 DC-7, realised #701, applied in #705). Per the
prepare rubric, a decision that only ratifies already-decided ground "skips the web survey but still
needs the concrete-refs check." So this report is the grounding artifact; the prior art is the prior
rulings, linked below — not a `we:researchTopics.json` entry.

## The grounding rulings

- **#700 (DC-7 ruling)** — ruled out cross-repo import of FUI block code into WE. The only sanctioned
  WE→FUI surface is an iframe window onto a FUI-hosted demo.
- **#701** — built the realisation: the `fuiDemo` Eleventy shortcode
  (`we:.eleventy.js:38`), a sandboxed, FUI-branded iframe pointing at `FUI_DEMO_BASE` (`:3001` dev).
- **#705** — applied the boundary to FUI's own block surface, recorded the **same reconciliation flag
  against #604** that #707 now discharges ("#604's acceptance still says 'the WE site renders a live
  interactive instance of the real FUI block' … needs realigning to the iframe boundary").
- Memory `project_docs_rendering_boundary_we_iframes_fui` — FUI owns impl **and** its rendered display;
  WE never imports/renders FUI block code, only embeds FUI-hosted demos via `fuiDemo`.

## What the real tree says

- **No WE→FUI import seam exists.** `vite.config.mts:167-180` aliases only `@core` / `@web*` → `/plugs/*`;
  there is no `frontierui` alias in `vite.config.mts` or `we:.eleventy.js`. WE cannot resolve FUI block
  source today, by design.
- **The iframe mechanism already exists and is already used on a block page.** `fuiDemo`
  (`we:.eleventy.js:38`) renders a sandboxed iframe; `we:src/_includes/block-descriptions/component.njk:235`
  already calls `{% fuiDemo "fui:component-converter.html", … %}`. Block pages (`we:src/block-pages.njk:35`)
  include `block-descriptions/{id}.njk`, so **every block page can already host a FUI demo via the same
  one-liner.**
- **#604's premise is the part that's gutted, not the deliverable.** #604 wanted WE to *render the real
  FUI composition* ("HMR on the FUI source updates the page", Fork-2 "import the `@frontierui` package
  surface"). Both require the import seam #700 killed. What survives — a **live, FUI-hosted demo embedded
  next to each block's code sample** — is fully reachable through `fuiDemo`.

## Consequences of realigning (not separate decisions — they fall out of the direction)

1. **#604's `blockedBy: ["170"]` dissolves.** #170 (plugs duplication / unified WE↔FUI runtime) was a
   prerequisite *because WE would import FUI code through a shared runtime*. An iframe embeds a
   FUI-hosted demo served by FUI's own vite (`:3001`) with FUI's own plugs — no shared runtime, so #170
   is no longer a #604 prerequisite.
2. **The conformance/dogfooding rationale migrates to FUI's side.** "Page breaks when the impl breaks"
   only holds if WE renders the impl. Under the iframe boundary, that strong signal lives on FUI's own
   derived catalog (#705's build); WE's signal weakens to "the FUI-hosted demo loads." This is a
   rewrite of #604's *Why*, not a loss to litigate.

## The two genuine forks (for #707)

1. **Direction** — realign #604 to the iframe boundary vs. carve a justified exception where WE renders
   FUI source. The exception requires exactly the import #700 ruled out → not a coherent branch.
   **Near-confirm: realign.**
2. **What #604 becomes** — the real call. (A) rescope #604 in place as an iframe-embedding epic, or
   (B) resolve #604 as superseded and graduate a thin follow-on story. Both coherent; this is where
   judgment is needed.
