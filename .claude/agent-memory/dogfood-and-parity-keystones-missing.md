---
name: dogfood-and-parity-keystones-missing
description: "Both \"resolved\" themes (WE-docs dogfood, design-system parity) are blocked on a missing keystone the backlog papered over"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5518aaba-b0b7-4d31-9031-4e679a686398
---

Code audit 2026-07-01 found two backlog areas marked largely "resolved" are actually blocked on a missing keystone capability:

1. **WE-docs is NOT SSR'd from our components.** 27/43 templates have zero `we-*`; the only build-time component→HTML path is the data-table resolver (`we:.eleventy.js:273`). Badges/tags/cards are client-upgraded transient CEs, not SSR. Keystone = **#2016** (Eleventy shortcode that renders we-card/badge/tag to HTML at build, reusing the data-table subprocess pattern). Blocks A1–A4 (#2018–#2021).

2. **Design-system parity is nowhere near 100%.** #1243 shadcn "resolved" is a **stub** — no shadcn token file, no harness, no gap list, just aliases *named* for shadcn in `fui:webtheme/defaultTokens.ts`. The "flavors" are 3 hardcoded ~5-token workbench presets. The integration seam is broken: DTCG runtime (`fui:webtheme/`) is the contract but components read legacy `fui:plugs/webtheme/ThemeSource`. Keystone = **#2017** (manifest→ThemeSource loader). Blocks B1–B4 (#2022–#2025).

**UPDATE 2026-07-01 (batch grounding):** #2016 is **NOT no-decision** — card/badge/tag are used as inline-slot wrappers, not `config=` data bindings, so build-time SSR forks on markup-as-source vs data-as-source. That is the **same fork as #1964**, ruled by the general **feed-appropriateness rule #2007** (static→unwrap, interactive→enhance, data→render-from-data). So #2016 is now `blockedBy: #2007`, and the A-slices (#2018–#2021) sit behind it. The FUI render side is clean (`createBadge/Tag/Card`→`.outerHTML`; data-table build tool is the template) — only the WE input contract is gated.

**CORRECTION 2026-07-01b (batch pre-flight disproved the #2017 call).** #2017 is **NOT** "genuinely no-decision / build now" — it is now `blockedBy: #2026`. Its Digest premise is **false**: it claims components "read legacy `ThemeSource`", but a grep found **ZERO** consumers of `resolveTheme`/`getRootTheme`/`ThemeSource` outside `fui:plugs/webtheme/` itself. The card/badge read a hand-authored site vocabulary (`--color-*`/`--radius-*`), **neither** the legacy `--token-*` emit **nor** the DTCG compile names — so a manifest→ThemeSource loader paints `--token-*` that nothing consumes and re-themes nothing live. The real keystone is **#2026** (decide the component theme-consumption seam: does `ThemeSource` project to the components' `--color-*` names, or do block CSS migrate onto `var(--token-*)`?); #2017 unblocks only after it. (#1964 got ratified this session — the #2007/#1964-first guidance below was validated.)

**Why:** confirms [[index-verif]] discipline — backlog `resolved` ≠ code shipped, AND a proposed "no-decision" keystone can hide a fork until you ground it (a Digest that says "components read X" is a **prose claim to grep**, not a fact). **How to apply:** ratify **#2007 + #1964 FIRST** (done for #1964) — that unblocks #2016 + the A-slices cleanly. For parity, **#2026 is the keystone to decide before #2017 can build** — do not treat #2017 as agent-ready. See [[verify-ratified-citation-against-live-status]].
