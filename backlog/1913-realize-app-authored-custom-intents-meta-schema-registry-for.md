---
kind: decision
status: open
dateOpened: "2026-06-28"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md
relatedProject: webintents
tags: [intents, meta-schema, namespacing, extensibility, native-first, custom-intents]
---

# Realize app-authored custom intents — meta-schema + registry for product-minted intents

`intents-ux-only` ([we:docs/agent/platform-decisions.md:378](../docs/agent/platform-decisions.md)) ratifies that intents are *"an open, never-finished system: custom non-standard intents must coexist conflict-free — standardize the meta-schema, not the list."* That promise is **unrealized**: WE ships a fixed 97-file catalog ([we:src/_data/intents/](../src/_data/intents/)) with no seam for a product to mint and use its **own** intent. This decides the seam's shape. **Recommended path:** scope-style `owner:intent` namespacing · build-time declarative manifest (the existing glob seam) · most-permissive ignore of unknown intents · *additive-only* `extends` of a standard intent.

## Grounding

- **Research topic** (prior-art survey, 7 systems): [/research/app-authored-custom-intents-meta-schema-registry/](/research/app-authored-custom-intents-meta-schema-registry/) · full citation bank in [we:reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md](../reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md).
- **Ratified principle** this realizes: `intents-ux-only` ([we:docs/agent/platform-decisions.md:378](../docs/agent/platform-decisions.md), meta-schema clause `:385`).
- **Surfacing parent**: [#1884](/backlog/1884-presentation-trait-style-vocabulary-intents-parallel-style-a/) `presentation-axis-is-intent-owned` (`:1468`) — "the single intent model owns all UI/UX config *only if apps can extend it*."

The native pattern the survey converges on (custom-elements' mandatory dash, CSS `--`, DTCG leading `$`): **the standard concedes one side of a syntactic boundary to authors and permanently keeps the other** — collision-free against the entire current *and future* standard vocabulary with no central prefix-ownership table. App-vs-app collisions are then solved by anchoring to **owned identity** (npm scope / reverse-DNS), and **RFC 6648** is the named guardrail: namespace by *ownership*, never by *status* (`x-`/`custom-` lie on promotion and force an interop-breaking rename).

## The axes

The decision decomposes into the orthogonal axes the survey surfaced — *namespacing · registration timing · unknown-intent behavior · composition* — each pinned to the real tree:

- **Namespacing** — the collision arbiter today is a flat-`id` uniqueness check ([we:scripts/check-standards.mjs:426](../scripts/check-standards.mjs) `dupCheck(intents, …)`) over a directory-glob assembly ([we:scripts/lib/intents-loader.cjs:17](../scripts/lib/intents-loader.cjs) `readdirSync`). Standard ids are bare kebab-case (`action`, `navigation`); a custom id must be structurally non-colliding against current *and future* standard ids. Composes the existing host-namespace statute `registry-name-guard-namespace` ([we:docs/agent/platform-decisions.md:654](../docs/agent/platform-decisions.md)).
- **Registration timing** — intents load build-time via the glob above; the resolver [we:webtraits/intentProfileResolver.ts:57](../webtraits/intentProfileResolver.ts) (`resolveTraits`/`bundlePlan`) is a *pure build-time function* with no namespace, no `extends`, no unknown-intent throw today. An intent is **data**, not code — so it sits with the declarative precedents.
- **Unknown-intent behavior** — `intents-ux-only` mandates *"Defaults are the most permissive value; restriction is the author's opt-in"* (`:385`), which constrains what an engine may do with an id it doesn't recognize.
- **Composition** — dimension keys split on `.` ([we:webtraits/intentProfileResolver.ts:47](../webtraits/intentProfileResolver.ts) `lastIndexOf('.')`), so `:` is free for a namespace separator. Whether a custom intent may build *on* a standard intent's dimensions is gated by the second-home statutes #1884 (`:1468`) / `realize-a-declared-axis` (`:1473`) and the closed-enum line #1337 (`:1465`).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — Namespacing convention** | scope-style `owner:intent` (standard ids stay bare) | full reverse-DNS `com.acme.lozenge` | High |
| **Fork 2 — Unknown-intent behavior** | most-permissive ignore + `mustUnderstand:true` opt-in + build-time warn-on-unknown | throw-by-default | High |
| **Fork 3 — Composition (`extends`)** | *additive-only* `extends` (add new dimensions; reject override/shadow of an inherited dimension) | standalone-only | Med-high |

## Fork 1 — Namespacing convention

*Why it's a fork (case a — flawed branch excluded):* a **status prefix** (`custom-`/`x-`) is broken per **RFC 6648** — the name lies the moment a custom intent promotes to standard, forcing a rename that breaks every consumer's authored profile. That defect makes the fork real; the live choice is between the two coherent survivors.

- **(a) Scope-style `owner:intent`** (e.g. `acme:lozenge`); standard intents stay bare. **← default.**
- (b) Full reverse-DNS `com.acme.lozenge` — collision-free but over-specifies a registry with no DNS/vendor-trust requirement (ceremony borrowed from Java packages, not this repo's namespace model).
- (c) ~~Status prefix `custom-lozenge`~~ — **excluded/broken** (RFC 6648; lies on promotion).

The `:` separator plays the custom-elements-dash role — bare standard ids can never collide with a scoped custom id, current or future — and it is confirmed free of the `.`-delimited dimension keyspace (resolver `:47`). Promotion to standard is then *drop the prefix* (an alias/registration), never a rename. Confirmed non-colliding with the flat `dupCheck` arbiter ([we:scripts/check-standards.mjs:426](../scripts/check-standards.mjs)).

**Skeptic:** SURVIVES. `owner:intent` is the minimal disambiguator that keeps standard ids bare (so promotion = drop the prefix, zero consumer churn) while making collisions structurally impossible; reverse-DNS adds verbosity for a trust property this registry doesn't need. `:` verified free of the dimension-key `.` namespace.

## Fork 2 — Unknown-intent behavior

*Why it's a fork (case a — flawed branch excluded):* **throw-by-default** directly contradicts the ratified `intents-ux-only` clause *"Defaults are the most permissive value; restriction is the author's opt-in"* (`:385`) — an engine that hard-fails on an id it doesn't recognize has made restriction the default. That makes the safe branch forced.

- **(a) Graceful most-permissive ignore** — an unknown intent degrades to most-permissive (its traits simply aren't gated → behave as ungated), with a per-intent **`mustUnderstand: true`** opt-in for fail-fast (native precedent: SOAP `mustUnderstand`, HTTP `Prefer: handling=strict`) **and a build-time `warn`-on-unrecognized-non-namespaced-id** (mirrors the `[Router] Invalid route pattern` diagnostic, #1187) so the permissive default isn't a silent-typo footgun. **← default.**
- (b) ~~Throw-by-default~~ — **excluded/broken** (contradicts the most-permissive statute).

**Skeptic:** SURVIVES — *with* the build-time warn amendment folded into the default (above). Without it, "ignore unknown" silently swallows a typo'd standard intent name; the fix is a diagnostic warn, not a throw (a throw would re-break the most-permissive statute).

## Fork 3 — Composition (`extends` a standard intent)

*Why it's a fork (case a — flawed branch excluded):* **override-mode `extends`** (Tailwind-style last-write-wins on a dimension *name*) is broken — it is precisely the *"second home for a declared axis"* that #1884 `presentation-axis-is-intent-owned` (`:1468`) and `realize-a-declared-axis; never stand up a second home` (`:1473`) forbid: `acme:surface extends surface` overriding the `radius` dimension creates two homes that can silently contradict on one axis. The statute's actual prescription is *extend the owning intent's dimensions* (additively), not fork-and-override.

- **(a) Additive-only `extends`** — a custom intent may **add new dimensions** (its own open value sets, fine — open vocabulary), and may widen a standard dimension's values **only where that dimension is already open-numbered** (#1318/#1427); it may **not** override/shadow an inherited dimension, nor widen a *closed* standard enum (e.g. action `neutral|danger`, #1337 non-negotiable `:1465`). Rejected at validate-time. **← default.**
- (b) ~~Override-mode `extends`~~ (Tailwind last-write-wins on dimension name) — **excluded/broken** (second-home drift; contradicts #1884/#1128/#1337).
- (c) Standalone-only — coherent but inferior: with no `extends` at all, a custom intent that genuinely builds on a standard one must re-declare shared dimensions by hand. (This downside is *merit*, not cost: re-declaration is a fresh, unlinked copy of a standard axis — a divergence surface the additive form structurally prevents, not merely "more to type.")

**Skeptic:** DEFAULT-WRONG as originally drafted (override-mode) → **narrowed to additive-only**, which is what the parent statute (#1884/#1128) already mandates. The override/last-write-wins framing was the broken part; additive `extends` composes cleanly.

## Supported by default (not decisions)

These are forced by existing statute or are the status quo — recorded here so the decider doesn't spend judgment on them:

- **Registration timing is not a fork.** Build-time declarative registration **is the existing seam** — a per-product intent manifest globbed in exactly like [we:src/_data/intents/](../src/_data/intents/) (`loadIntents` readdir). A runtime register-API is a **demand-gated follow-up** (decided only when a real dynamic-host consumer — a plugin host / user-authored dashboard — exists, with CSS's `@property` declarative-first-plus-runtime-hatch as the shape), filed as a separately-prioritized item — *not* a branch ratified here. (Dissolved per the fork-existence test: nobody proposes runtime-only; the only argument against shipping the hatch now is "no consumer yet," which is prioritization, not merit.)
- **Placement (zero-impl line, #1282).** The meta-schema **definition** + the `validateIntent` extension ([we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs)) live in WE — the sanctioned definitions-plus-validate-script carve-out. The product-manifest **glob loader** and any runtime register-API are runtime impl → **FUI / the product**, never WE.
- **Most-permissive per-dimension default** (`intents-ux-only:385`) — each custom dimension carries a `default` that is its most permissive value.
- **Namespace by ownership, never by status** (RFC 6648) — graduation to standard drops the scope prefix (alias/registration), never a rename.

## Statute composition

This realizes `intents-ux-only` (`:378`/`:385`) and composes — without contradiction, once Fork 3 is additive-only — with `presentation-axis-is-intent-owned` (`:1468`, the #1884 parent), `open-numbered-variants` (`:1420`), the tone axis (`:1458`), and the #1337 closed-enum line (`:1465`). The custom-intent meta-schema is the **intent-level ring** outside #1318's value-level open-numbered axis: #1318 opens *values within* a standard intent; this opens *whole intents* under the same open-but-fenced discipline. On resolve, codify as a new anchor (e.g. `custom-intents-namespace-by-ownership`) cross-linking these and setting `codifiedIn`.

## Meta-schema shape (the prepared target)

```jsonc
{
  "id": "acme:lozenge",        // Fork 1: scope-prefixed; standard ids stay bare
  "name": "Lozenge Intent",
  "extends": "tag",            // Fork 3: OPTIONAL — additive only (add new dimensions; no override of inherited)
  "dimensions": {              // same shape as standard intents
    "emphasis": { "description": "…", "values": ["subtle", "bold"], "default": "subtle" }
  },
  "mustUnderstand": false,     // Fork 2: false (default) = graceful ignore; true = fail-fast
  "provenance": "com.acme"     // owner anchor (audit/dedupe) — ownership, never status
}
```

## Lineage

Surfaced 2026-06-28 by [#1884](/backlog/1884-presentation-trait-style-vocabulary-intents-parallel-style-a/) (resolved: presentation axis is intent-owned — valid *only if* apps can extend the model). Prepared 2026-06-28: prior-art survey (7 systems) → [/research/app-authored-custom-intents-meta-schema-registry/](/research/app-authored-custom-intents-meta-schema-registry/); forks classified against the architecture and skeptic-attacked (Fork 2 "registration timing" dissolved as a fake fork; Fork 3 narrowed from override-mode to additive-only to compose with the #1884/#1128 second-home statute; warn-on-unknown amendment folded into Fork 2). Realizes the promise of the now-resolved parent ruling #1884 (no live `blockedBy` — #1884 is resolved; the relationship is lineage, not a prerequisite).
