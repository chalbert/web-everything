---
name: project_block_explorer_chrome_decoupled_from_distribution
description: "#809 ruling: Block-Explorer workbench is a FUI-owned product; chrome decoupled from distribution (iframe+chrome vs mode-C no-chrome); manipulation channel fork dissolved"
metadata: 
  node_type: memory
  type: project
  originSessionId: 41bc40a8-a173-4628-a47d-974613b4f7d8
---

#809 ruling (2026-06-16): the interactive Block-Explorer **workbench** (live theme/trait switch, inspect, exploded view) is a **FUI-owned, FUI-hosted product**, not WE docs chrome. The key move: **chrome is decoupled from distribution**. A FUI block has two distributions and the chrome rides only one:
- **iframe + chrome** — chrome (switcher/trait/inspect) AND block served **same-origin inside one iframe**; manipulation+inspection are intra-FUI host-side DOM, **no WE↔FUI channel, no postMessage manipulation protocol**. Embeddable on ANY site (the user's driving requirement: "embed FUI with the chrome on other sites").
- **in-document, no chrome** — mode C (#765/#786) re-cast as the **bare-component** distribution, NOT a manipulation channel.

So the original forks were superseded: **Fork 1 (mode C vs iframe-message-protocol) → DISSOLVED** (no cross-boundary channel exists once chrome+block are co-located in FUI); **Fork 2 (locus) → B (FUI-owned)**.

**Why it flipped mid-discussion:** the prepared default was 1-A (mode C) + 2-A (WE chrome). It assumed the workbench was WE-docs-only. Once the user said the *chrome* must be embeddable on third-party sites, 2-A can't deliver (mode C is WE↔FUI-only; third parties get only the bare block via iframe) — and making the workbench FUI-hosted same-origin **dissolves** Fork 1's cross-origin-inspection problem by moving the origin boundary outside the whole workbench.

**Downstream:** filed #815 (FUI workbench shell, `locus: frontierui`); re-homed #749/#750/#806 to `locus: frontierui` (blockedBy #815); **#755 splits at the layer seam** — rendered-component inspection (ARIA/computed/source/event-log) → FUI workbench; WE-**standards** panels (intent→ARIA, token provenance #747/#364, the #092 graph) → a **WE-docs overlay** around the embed (WE data, doesn't travel to third parties). Recorded in `docs/agent/demo-workflow.md`. `impl→FUI` honoured: FUI owns rendering AND the workbench that drives it.

Locus is encoded via the `locus:` frontmatter field (values: frontierui / plateau-app / exercise-app / webeverything), NOT `relatedProject` (which keys to a WE standard domain in projects.json — no `frontierui` value exists there). Builds on [[project_docs_rendering_boundary_we_iframes_fui]] and the #765 ownership-not-mechanism sharpening; relates to dogfood epic [[project_dogfood_we_site_on_fui_components]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#we-fui-embed-boundary` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
