---
kind: story
size: 3
parent: "746"
status: resolved
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/block-pages.njk
tags: []
---

# Block-Explorer WE-standards overlay — why-this-token provenance, intent→ARIA proof, provider↔consumer graph around the embed

The WE-locus half of the #755 split (#809). Around the embedded FUI workbench (`fui:workbench-host.html`), render WE-owned standards panels from WE's OWN data, NOT inside the iframe: (1) why-this-token provenance (computed→source token + intent, #747/#364), (2) the intent→ARIA mapping proof (authored intent attrs ⟷ resolved platform ARIA), (3) the #092 provider↔consumer graph the block participates in. A focus/selection sync (workbench→overlay) is a build detail, not a manipulation protocol. These panels are WE-docs chrome and don't travel to third-party embedders. Substrate (#747/#364/#092) all resolved. The FUI inspectors half shipped in #755.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17).**

- **Overlay placement** — `we:block-pages.njk` renders a new **WE Standards overlay** section *immediately after* the `fuiDemo` embed (the FUI-hosted workbench/demo), so it literally wraps the embed. Built from WE's own `fui:blocks.json`/`we:intents.json`/`componentTokens` data — never reaching into the iframe (the demo runs in FrontierUI; the panels are Web-Docs chrome that don't travel to third-party embedders, per the #755/#809 boundary). Gated on an embed being present; each panel degrades independently on absent substrate.
- **(2) Intent → platform ARIA proof (the genuinely-new panel)** — a two-column bridge pairing the **declared UX intent** (`implementsIntent` + composed intents, linked to `/intents/`) against the **resolved platform ARIA / web standards** (the block's `webStandards` concerns, humanized via the `webStandardsRows` filter). This pairing — intent ⟷ ARIA — existed nowhere on the page; "Implements Intent" showed dimensions and "Accessibility & Web Standards" showed ARIA, but never the explicit *intent resolves to ARIA* proof.
- **(1) Why-this-token provenance** — a compact one-line provenance (`--token` → `var(--alias)` → resolved literal) drawn from the #829 `componentTokens` resolver (the #747/#364 substrate), linking down to the full Component-tokens table — summarized around the embed, not duplicated.
- **(3) Provider↔consumer graph (#092)** — a compact count of providers composed (`dependsOn`) and consumers (`usedBy`, the reverse edge), framing the minimize-lock-in/degradation surface, linking to the full bidirectional Anatomy graph.
- **Non-duplication** — panels (1) and (3) summarize-and-link rather than re-render the detailed Component-tokens / Anatomy sections below; only the intent→ARIA bridge is rendered in full (it has no other home). The focus/selection sync (workbench→overlay) is explicitly out of scope per the body ("a build detail, not a manipulation protocol"). Verified in a full 11ty build (`autocomplete`: intent→ARIA with `aria-combobox`; `tabs`: provider↔consumer "composes 1 provider"); `check:standards` green.

`graduatedTo` → `we:src/block-pages.njk` (the overlay render).
