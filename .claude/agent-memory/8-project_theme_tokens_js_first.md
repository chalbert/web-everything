---
name: project-theme-tokens-js-first
description: "Theme tokens are JS-first (injector is SoT); CSS vars are a one-way projection; CSS can't be SoT — off-DOM/pre-attach;"
metadata: 
  node_type: memory
  type: project
  originSessionId: 30a9b496-3b57-4fe6-8422-f73596e326c6
---

Theme tokens (colour, layout, spacing, fonts, radii — every CSS-relevant value) are **JS-first**: the runtime
source of truth is JS, held in the injector WE already ships (`webinjectors`/`webcontexts`). CSS custom
properties (`--token-*`) are a **derived, one-way (JS→CSS) projection** for the declarative paint path — never
the source, never hand-authored in parallel (single source ⇒ no drift). Components read the **injector** to
*know* their theme; CSS vars exist only to paint; `getComputedStyle` is never in the compute path.

**Why CSS can't be the source (don't default to it):** a detached element resolves an inherited/scoped var to
`""` (browser-validated) — no constructor/pre-attach read; a worker/OffscreenCanvas, a `console.log("%c", …)`,
SSR, and tests have **no element at all**. The `connectedCallback` read, even when it resolves, is a forced
sync style recalc and the earliest possible point (deferring → FOUC).

**Don't invent a new DI/registry for this** — the injector already is the JS-first substrate. A "value→token"
provider instinct (e.g. categorical taxonomy [[project_block_explorer_chrome_decoupled_from_distribution]]
sibling work, #1670) reduces to a token family (`--cat-*`) on this runtime, not a new mechanism.

Statute: cite `we:docs/agent/platform-decisions.md#tokens-js-first` (ratified #1682, codified 2026-06-23).
Refines the `design-tokens` protocol runtime tier; build is #1683. Composes [[project_platform_decisions_statute_layer]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#tokens-js-first` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
