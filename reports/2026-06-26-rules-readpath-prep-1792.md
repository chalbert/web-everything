# Decision prep — #1792: expose the project's general rules on the website

**Date:** 2026-06-26
**Item:** [#1792](/backlog/1792-expose-the-project-s-general-rules-on-the-website-statute-la/) — the statute layer (`we:docs/agent/platform-decisions.md` + siblings) has no URL; `codifiedIn:` links 404.
**Type:** internal-architecture decision (no greenfield browser-standard design → no web survey; concrete-refs grounding only, per *backlog-workflow.md → Fork-readiness pass*).

## What the grounding pass found (concrete refs)

- **`we:docs/agent/` is outside the build.** Eleventy input = `we:src/` only; passthrough copies `we:src/css`, `we:src/assets`, `we:demos`, `we:plugs`, `we:design-refs` — **no `we:docs/` copy or watch** (`we:.eleventy.js:265-280`). The decision body's premise is accurate.
- **Two existing catalog shapes, not one.** *Protocols* = index-only; cards link to anchors **inside the owning project page** (`/projects/<owner>/#<anchor>`), no standalone detail page (`we:src/protocols.njk:50-75`, validator `we:scripts/check-standards-rules.mjs:767-788`). *Research topics* = the true "registry + auto-rendered **detail page**" pattern: pagination over `researchTopics`, `permalink: research/{{ topic.id }}/`, body pulls a per-id prose partial `research-descriptions/<id>.njk` (`we:src/research-topic-pages.njk:1-11,66`), and a gate **requires** the partial exist (`we:scripts/check-standards.mjs:143-145`). This is the model Fork B would mirror.
- **The citation debt:** **211** `codifiedIn:` values across `we:backlog/*.md` point at `we:docs/agent/platform-decisions.md#<anchor>`, spanning **57 distinct anchors** (top: `#constellation-placement` ×42, `#project-protocol-bar` ×25, `#monetization` ×16, `#we-fui-embed-boundary` ×15, `#component-dc` ×15). All currently 404. One (`#relocation-granularity`) is an **inline** `{#...}` anchor (`we:docs/agent/platform-decisions.md:133`), not a `###` heading — any render must preserve inline anchors too.
- **`we:docs/agent/platform-decisions.md` shape:** 1564 lines, **57 `### <title> {#anchor}` rule headings** under `## The standing rules`, plus a documented "codifiedIn-at-resolve" authoring workflow (`we:docs/agent/platform-decisions.md:14-20`) — it is a **single living file edited on every decision-resolve**.
- **No `we:src/_data/rules/` exists** — Fork B is fully greenfield.
- **`/governance/` returns 200 but is unrelated:** `we:src/governance.njk` is a hand-authored steward→foundation lifecycle narrative (`:1-5,57-120`), not a statute catalog. Reusing that route would collide with its purpose.
- **Nav + route gate:** nav is static `weNavLink` markup in `we:src/_layouts/base.njk` (About group `:95-97`, beside `/governance/`). A new catalog route segment must also be added to the Vite dev-proxy allowlist regex (`we:vite.config.mts:127`) or `check:standards` fails (`we:scripts/check-standards-rules.mjs:1134-1143`).

## How the grounding reshaped the fork

The item framed a binary A (markdown-lift) vs B (registry decomposition), default B. The grounding surfaces the decisive distinction the binary hid: **protocols/intents/research are structured *records* (fields, dimensions, per-id metadata); the rules are *prose* in a single living file edited on every resolve.** B cargo-cults a records-catalog onto prose and moves the authoring SoT off markdown — against [authoring-sot-is-the-standard-form] and [minimize-lock-in]. A leaves the statute layer non-first-class (no filterable catalog), against [catalogs-auto-render].

That tension resolves to a **third, synthesis option C** (research is expected to reshape forks): **markdown stays the authoring SoT; a build-time step harvests the 57 `### {#anchor}` headings into a lightweight derived index** that renders a filterable `/rules/` catalog linking back to the rendered markdown sections, and a gate asserts every `codifiedIn:` anchor resolves. C buys B's read-path + filterability + machine-enforceable citations **without** changing how rules are authored. C is the new default; pure-A and pure-B are the excluded branches.

## Recommendation
- **Fork 1 (read-path shape): default C** (derived index over markdown SoT). Excludes pure-A (no catalog) and pure-B (abandons markdown authoring form + the single-file resolve workflow).
- **Fork 2 (root governance docs routing): default** — statute *rules* → `/rules/`; the governance *narratives* (`we:DEV_GUIDE.md`, `we:SELF-DRIVEN-PROJECT-DRAFT.md`, `we:CLA.md`) → extend the existing `/governance/` page (content-type match), not `/rules/`.

Skeptic verdicts folded into the item body.
