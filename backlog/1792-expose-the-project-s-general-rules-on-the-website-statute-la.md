---
kind: decision
status: open
dateOpened: "2026-06-26"
tags: [website, governance, docs, exposure]
---

# Expose the project's general rules on the website (statute layer has no read path)

The project's general rules — the statute layer in [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) plus its siblings under [we:docs/agent/](docs/agent/) ([we:AGENTS.md](AGENTS.md), conventions, architecture, the workflow docs) — have **no URL on the docs site**. Eleventy's input dir is `we:src/` only, so the entire `we:docs/` tree sits outside the build with no passthrough. This violates the standing "expose everything through the website" rule: every other artifact type (protocols, intents, research, blocks, projects, …) has an auto-rendered catalog, but the rules that govern them are repo-only. Worse, `codifiedIn: we:docs/agent/platform-decisions.md#anchor` citations across the backlog point at pages that were never built — the links 404.

## The fork

Decide **how** the rules get a read path. Two coherent end-states:

- **A — markdown-lift (cheap first step).** Render `we:docs/agent/*.md` to pages under a `/rules/` (or `/governance/`) route, keeping markdown as the source of truth, with heading anchors so existing `codifiedIn:` links resolve. Lowest effort; preserves how the rules are authored today. Doesn't make rules first-class/filterable like the other catalogs.
- **B — registry catalog (default).** Promote each rule to a `we:src/_data/rules/<id>/` entry with an auto-rendered index, mirroring `/protocols/` and `/intents/`. Rules become cite-able, filterable, link-resolvable entities, and `codifiedIn` becomes machine-enforceable. More work; changes the authoring SoT from one big markdown file to per-rule entries.

**Default: B** — it matches the existing "catalogs auto-render from JSON" convention (the same pattern /protocols/ and /intents/ already use) and makes the `codifiedIn` citation discipline ([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) = the cite-able statute layer) actually enforceable rather than aspirational. **A is a fine cheap interim** if a read path is wanted before the registry work lands.

## What you decide

Pick A, B, or A-then-B (ship the markdown-lift now, migrate to the registry later). Then this resolves into the build story for the chosen shape.

## Acceptance

- A `/rules/` (or chosen route) surface exists and is reachable from the site nav.
- [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) (and chosen siblings) render to that surface.
- Existing `codifiedIn: we:docs/agent/platform-decisions.md#<anchor>` links resolve (no 404).
- `check:standards` green.
