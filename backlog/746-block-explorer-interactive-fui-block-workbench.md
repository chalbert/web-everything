---
kind: epic
parent: "1255"
status: open
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/, label: "Feeder epic — Web Docs pipeline (#623)" }
tags: [webdocs, block-explorer, workbench, theming, traits, adapters, plateau-embed, storybook]
---

# Block Explorer — the interactive FUI block workbench (live theme/trait switching, embedded configurators, polyglot adapter panel)

Turn each FUI block "do" page into a live, inspectable, re-themeable, polyglot **workbench** — the interactive layer on top of the per-component surface (#727: FUI render + props/token/a11y panels). Where #727 *shows* a block, the Explorer lets you *manipulate* it: browse every piece it's made of, swap design systems and activate traits live, open embedded Plateau configurators (theme + technical) as lead-gen seams, and generate/test the component across frameworks. Per the constellation it lives in **FUI**; WE embeds it via the #701 `fuiDemo` iframe; the configurator panels are **Plateau embeds**.

> **Builds on #970.** This workbench is the *rich manipulation layer*; the base — every FUI block detail page actually hosting its own live demo (slot + authored demos + completeness gate) — is the **#970** epic. #746 assumes that base render surface exists; effectively `blockedBy` **#971** (the per-block demo slot).

## Why a new epic and not folded into #623/#727

#623 is the *discovery→standards→catalog* feeder (what the docs surface is *made of*); #727 is its *per-component live surface* (render + static panels). This epic is the **interactive workbench** that sits on #727: live switching, embedded Plateau tools, polyglot generation. Keeping it separate respects bias-toward-separation — #727 can ship the static per-component view without waiting on the live-switching machinery, and the workbench builds on it incrementally.

## The slices

| # | Item | What it adds | Blocked by |
|---|---|---|---|
| 1 | **#748** — block anatomy / composition view | list + browse every piece (traits/plugs/intents/tokens/providers), exploded layer view, toggle-to-degrade | — |
| 2 | **#747** — *decision*: design system = theme + intents bundle (manifest + `/design-systems/` catalog) | the keystone format the switcher/creator consume | — |
| 3 | **#749** — live theme / design-system switcher | swap presets live, A/B + token-diff, axis sliders, dark/RTL/container-query | #747, #727 |
| 4 | **#750** — live trait activation panel | toggle/activate traits live, trait state-machine inspector | #727 |
| 5 | **#751** — embedded theme/design-system creator (Plateau) | "Your theme" → Plateau embed, localStorage save, import/screenshot→tokens | #747 |
| 6 | **#752** — embedded technical configurator (Plateau) | per-block render/transport/chunk config + cost preview, deep-link to full one | — |
| 7 | **#753** — polyglot adapter panel | generate component per framework/language, live-test + conformance badge, reverse-ingest demo | #547 |
| 8 | **#754** — shareable permalink + export-as-code | URL that reproduces the exact configured view; copy block as code | #749 |
| 9 | **#755** — inspection devtools | "why this token" trace, source/ARIA pane, event log, provider↔consumer graph | #727 |

## Boundary (what this epic does NOT own)

- The per-component live render surface + static props/token/a11y panels → **#727**.
- The token model / DTCG↔CSS / platform default token set → **webtheme (#364)**.
- The served Web Docs product, hosting, open-core tiering → **#398 / #428**.
- The MaaS *server-origin* polyglot generation (vs the *component* polyglot panel here) → **#463/#505/#507** (shared generation-adapter core #547).
- Pushing a configured block onto a live deployed app → **dev-browser #410/#141** (a downstream consumer, not built here).

## Acceptance (epic done when)

- [ ] The design-system manifest format + `/design-systems/` catalog are ratified (#747) and switching works live (#749).
- [ ] A block page shows its full anatomy with each piece independently browsable (#748).
- [ ] Traits activate live (#750); the embedded Plateau creator (#751) and technical configurator (#752) are wired as lead-gen seams.
- [ ] The polyglot panel generates + live-tests the component across ≥2 targets with a conformance badge (#753).
- [ ] A permalink reproduces the exact configured view (#754) and the inspection devtools are live (#755).
