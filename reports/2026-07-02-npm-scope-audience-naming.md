# npm scope naming across the constellation — prior-art survey + prep session report (#2155)

Prep session for backlog #2155 (`/prepare all` lane, 2026-07-02). Research + authoring only — no ruling.
Published as the `/research/` topic `npm-scope-audience-naming`.

## Question

Six npm orgs are registered (`@frontier-ui`, `@frontierui`, `@plateauapp`, `@plateaudev`, `@plateaujs`,
`@webeverything`). Before the first Plateau/FUI publish, how should scopes map to the constellation
(WE standard → Frontier UI impl → plateau-app product), so the naming is a cite-able rule?

## In-repo grounding (verified 2026-07-02)

**Packages that exist today, per repo (grep of every non-vendored package manifest `"name"`):**

- **WE** — root `web-everything` ([we:package.json](package.json), the 11ty site, never published) plus four
  `@webeverything/*` packages: [we:contracts/package.json](contracts/package.json) (`@webeverything/contracts`),
  [we:capability-manifest/package.json](capability-manifest/package.json),
  [we:webcases/package.json](webcases/package.json),
  [we:validation-generation/package.json](validation-generation/package.json).
- **FUI** — root `frontierui` plus **14 `@frontierui/*` packages**: `fui:blocks/package.json`,
  `fui:plugs/package.json`, `fui:workbench/package.json`, `fui:compiler/package.json`, and ten workspaces
  under `fui:packages/` (maas-check, rollup-plugin, vite-plugin, esbuild-plugin, jsx-runtime, webdocs-ui,
  component-compiler, rich-text-editor-slate, auto-update-orchestrator).
  **Zero `@frontier-ui/*` (hyphenated) names anywhere.**
- **plateau-app** — root `plateau-app` (`plateau:package.json`, deployed not published) and
  `plateau-ide-bridge` (`plateau:src/dev-browser/ide-bridge/vscode-extension/extension/package.json` — a VS
  Code extension; ships to the VS Code marketplace, not npm). **Zero `@plateau*` packages exist or are named
  in code.** The "compliance-suite" product exists only as conformance-engine code
  (`plateau:src/conformance-engine/`), not as a package.

**Registry state (anonymous probe, `https://registry.npmjs.org/-/org/<name>/package`, 2026-07-02):** all six
orgs return `{}` — **registered, zero packages each** (a nonsense org returns `Scope not found`). So the orgs
are held; *who* owns them can only be confirmed from the human's npm account (`npm org ls`, dashboard) —
noted in the item as the human verification step.

**Statutes and sibling rulings touching this turf:**

- [constellation-placement rule 3](docs/agent/platform-decisions.md) — `@webeverything` = standard artifacts
  only (type-only distribution), never imports FUI; already the cite-able rule for the WE scope.
- The `npm-scope-mirrors-layer` rule family under the same anchor (cited at
  [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md), ~line 1217) — scope tracks the
  constellation layer; impl/tooling publishes FUI-owned, never `@webeverything`.
- #907 (decided 2026-07-02, recorded in
  [we:backlog/907-first-real-publish-of-webeverything-contracts-migrate-a-cons.md](backlog/907-first-real-publish-of-webeverything-contracts-migrate-a-cons.md)):
  `@webeverything/contracts` publishes **public + provenance**; `@frontierui/*` and `@plateaujs/*` "stay
  private until go-public"; the naming boundary itself is explicitly delegated to **#2155**.
- #2128 ([we:backlog/2128-pilot-consumption-channel-publish-the-pilot-scoped-artifact-.md](backlog/2128-pilot-consumption-channel-publish-the-pilot-scoped-artifact-.md))
  — the pilot channel requires an external team to consume published FUI blocks/plugs "with no
  constellation-insider support"; a restricted package hands them read tokens, which is insider friction.
  This makes "go" a per-package-set event, not one launch date.
- #1987/#1991 ([attribute-name-colon-namespacing](docs/agent/platform-decisions.md)) — naming statutes, but
  **scoped to HTML attribute spelling**, not npm scopes (citation-scope: supporting context only).

## Prior-art survey — how comparable ecosystems split scopes

| Ecosystem | Scope shape | What the split encodes |
|---|---|---|
| `@types` (DefinitelyTyped) | one scope, thousands of packages | **scope = audience/purpose, package name = product** — the canonical shape |
| `@angular` vs `@angular-devkit` / `@schematics` | multi-scope, all public | product-line/audience split (framework consumers vs build-tooling infrastructure) — note `-devkit` is **public**, "dev" ≠ internal |
| `@vue` vs `@vitejs` | scope per project | a **distinct public product identity** earns a scope (Vite ≠ Vue); Vue's own internals (`@vue/compiler-sfc`) stay in the consumer scope |
| `@lit` vs `@lit-labs` | scope per **support policy** | stability/publish-policy boundary; graduation = deliberate republish under `@lit` (rename cost accepted knowingly) |
| `@web` (Modern Web), `@open-wc` | one scope, many tools | one umbrella scope; products differentiated by name (`@web/dev-server`, `@web/test-runner`) |
| `@astrojs` | unscoped flagship (`astro`) + one scope for integrations | scope = the project's extension namespace |
| `@shoelace-style` → Web Awesome | forced scope migration | the **lock-in evidence**: a brand rename froze the old scope (`@shoelace-style/shoelace` archived, `sl-` → `wa-` prefixes, full republish under a new Font Awesome-owned scope) |

**Pattern:** no surveyed ecosystem splits scopes for *private/internal* packages — companies keep restricted
packages inside the public org (npm access is **per-package**, not per-scope). A second scope appears for
(i) a distinct public product identity (Vite), (ii) a support/stability policy channel (`@lit-labs`), or
(iii) a public tooling product-line (`@angular-devkit`). Never for privacy.

## npm mechanics that bound the decision

- A scope **is** an org (or user) name; holding the org is the only squatting defense.
- `--access public|restricted` is **per package**; restricted requires the org's paid plan; **provenance
  requires public**.
- **Asymmetric reversibility**: restricted → public is a one-flag flip; public → gone is fenced by npm's
  unpublish policy (72-hour/dependents rules). The reversible posture is the safe default.
- **No scope rename exists**: npm's own "renaming an organization" doc
  (https://docs.npmjs.com/renaming-an-organization) is "create a new org, republish everything, ask support
  to unpublish the old" — i.e. a scope choice is near-permanent.

## Where the research reshaped the item

1. **Fork A's default flipped** (two Plateau scopes → **one live scope**): the audience-boundary rationale
   ("distinct access policy per scope") is not how npm works — access is per-package — and every prior-art
   scope split tracks public identity or support policy, never privacy. Zero internal Plateau packages exist
   or are planned, so `@plateaudev` is speculative structure (reserve-structure-for-real-families); it stays
   a defensive hold with a named re-open trigger (a real `@lit-labs`-style policy channel).
2. **Fork B's "go" got a definition**: per-package-set first-external-consumer event (#2128's pilot is the
   first one), not a single launch date; and the standing rule was made total (restricted by default, a flip
   is always an explicit decision) so no residue is left for paid-product GA distribution.
3. **`@frontierui` vs `@frontier-ui` was promoted from "settled input" to a (fast) fork** — it is a live
   naming either/or the item was asserting rather than ruling; the default is unchanged, now grounded.

## Outcome

Item #2155 rewritten to the prepared-fork shape: 3 forks, each with (a)/(b)(/(c)) options, tradeoffs, a bold
default, fork-existence justification, `Skeptic:` and `Screen:` lines. Skeptic verdicts: Fork 1 SURVIVES;
Fork 2 SURVIVES-WITH-AMENDMENT (second earned-scope re-open trigger composing the brand-on-distinctness
statute; the `@plateaujs`-over-`@plateauapp` spelling grounded in a ruled line; org-level-controls wording
corrected); Fork 3 SURVIVES-WITH-AMENDMENT (rationale re-grounded per half — `@plateaujs` restricted =
compliance with the monetization statute #1590, `@frontierui` rests on reversibility + pre-1.0 churn; a
provenance-gap rule added — restricted versions never gain provenance retroactively, each go ships a fresh
attested version; irreversibility tightened to disclosure + unpublish fencing). Screen: Fork 2
flagged(prio) → the "zero-member family / speculative scaffolding" con re-grounded on merit; Forks 1 and 3
clear. Human actions noted in the item: authoritative org-ownership confirmation and any plan/billing change
are npm-account actions; the ratify turn must re-check #907's decision text is still live (open story,
publish unexecuted per #2157).

Sources: [npm — Renaming an organization](https://docs.npmjs.com/renaming-an-organization) ·
[Web Awesome — Migrating from Shoelace](https://webawesome.com/docs/resources/migrating-from-shoelace) ·
[shoelace-style/shoelace (archived README)](https://github.com/shoelace-style/shoelace)
