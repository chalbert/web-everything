---
kind: decision
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#custom-intents-namespace-by-ownership"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md
relatedProject: webintents
tags: [intents, meta-schema, namespacing, extensibility, native-first, custom-intents]
---

# Realize app-authored custom intents — meta-schema + registry for product-minted intents

`intents-ux-only` ([we:docs/agent/platform-decisions.md:378](../docs/agent/platform-decisions.md)) ratifies that intents are *"an open, never-finished system: custom non-standard intents must coexist conflict-free — standardize the meta-schema, not the list."* That promise is **unrealized**: WE ships a fixed 97-file catalog ([we:src/_data/intents/](../src/_data/intents/)) with no seam for a product to mint and use its **own** intent. This decides the seam's shape. **Recommended path:** scope-style `owner:intent` namespacing (colon separator) · build-time declarative manifest (the existing glob seam) · most-permissive ignore of unknown intents (grounded on must-ignore/forward-compat) · *additive* `extends` (a custom intent adds new namespaced dimensions, and may add `owner:value`-namespaced values to *open-numbered* standard dimensions; closed enums untouchable).

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
| **Fork 1 — Namespacing convention** | scope-style `owner:intent`, **colon** separator (standard ids stay bare) | full reverse-DNS `com.acme.lozenge`; sub-fork: `@owner/intent` spelling | High |
| **Fork 2 — Unknown-intent behavior** *(genuine choice, not a forced exclusion)* | most-permissive ignore + `mustUnderstand:true` opt-in + build-time warn-on-unknown — wins on **must-ignore/forward-compat** | throw-by-default | High |
| **Fork 3 — Composition (`extends`)** | **additive** `extends` — add new namespaced dimensions; add `owner:value`-namespaced values to *open-numbered* standard dimensions; never override inherited, never widen a *closed* enum | standalone-only | Med-high |
| **Fork 3 (d) — cross-author value-addition to a standard dimension** | **allowed iff open-numbered AND namespaced (`owner:value`)**; closed enums (#1337) untouchable by anyone | bare (unnamespaced) widening | High |

## Ruling — RATIFIED 2026-06-28

Codified as [custom-intents-namespace-by-ownership](../docs/agent/platform-decisions.md) (`codifiedIn`).

- **Fork 1 — Namespacing:** scope-style **`owner:intent`**, **colon** separator; standard ids stay bare; promotion = drop the prefix (alias, never rename). Reverse-DNS and the `@owner/intent` spelling rejected.
- **Fork 2 — Unknown-intent:** **most-permissive ignore** (must-ignore / forward-compat) + per-intent **`mustUnderstand: true`** fail-fast opt-in + **build-time warn** on unrecognized non-namespaced ids. (Reclassified from forced-exclusion to a genuine choice; `:385` supporting, not dispositive.)
- **Fork 3 — Composition:** **additive `extends`** — add new namespaced dimensions; add **`owner:value`-namespaced** values to **open-numbered** standard dimensions only; never override/shadow an inherited dimension; **closed enums (#1337) untouchable by anyone**. Open-vs-closed (does anything downstream reason over the values?) is the gating judgment. Bare/closed-enum widening rejected at validate-time.
- **Placement (#1282):** meta-schema *definition* + `validateIntent` extension → **WE**; manifest glob-loader + runtime register-API → **FUI/product** (register-API demand-gated follow-up).

Spin-off builds filed at resolve: **#1929** (WE meta-schema definition + `validateIntent` extension — agent-ready) → **#1930** (FUI/product manifest glob-loader, `blockedBy` #1929) → **#1931** (runtime register-API, demand-gated). Methodology leftover: **#1932** (citation-scope check for the decision red-team).

## Fork 1 — Namespacing convention

*Why it's a fork (case a — flawed branch excluded):* a **status prefix** (`custom-`/`x-`) is broken per **RFC 6648** — the name lies the moment a custom intent promotes to standard, forcing a rename that breaks every consumer's authored profile. That defect makes the fork real; the live choice is between the two coherent survivors.

- **(a) Scope-style `owner:intent`** (e.g. `acme:lozenge`); standard intents stay bare. **← default.**
- (b) Full reverse-DNS `com.acme.lozenge` — collision-free but over-specifies a registry with no DNS/vendor-trust requirement (ceremony borrowed from Java packages, not this repo's namespace model).
- (c) ~~Status prefix `custom-lozenge`~~ — **excluded/broken** (RFC 6648; lies on promotion).

The `:` separator plays the custom-elements-dash role — bare standard ids can never collide with a scoped custom id, current or future — and it is confirmed free of the `.`-delimited dimension keyspace (resolver `:47`). Promotion to standard is then *drop the prefix* (an alias/registration), never a rename. Confirmed non-colliding with the flat `dupCheck` arbiter ([we:scripts/check-standards.mjs:426](../scripts/check-standards.mjs)).

**Sub-fork — separator spelling (`owner:intent` vs `@owner/intent`).** The prior-art report floated two scope spellings ([we:reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md:17](../reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md)): colon `acme:lozenge` and npm-scope `@acme/lozenge`. **Colon wins** — `:` is verified free of the `.`-delimited dimension keyspace (resolver `:47`) so it can never be confused with a dimension key, whereas `@owner/intent` borrows npm's `@scope/` ceremony (and `/` reads as a path separator) for no property this registry needs once ownership is already anchored by `provenance`. Standard ids stay bare either way; this is the `@namespace/…`-style convention surfaced in earlier discussion, decided *against* in favor of the colon.

**Skeptic:** SURVIVES. `owner:intent` is the minimal disambiguator that keeps standard ids bare (so promotion = drop the prefix, zero consumer churn) while making collisions structurally impossible; reverse-DNS adds verbosity for a trust property this registry doesn't need. `:` verified free of the dimension-key `.` namespace.

## Fork 2 — Unknown-intent behavior

*Why it's a fork (case b — real either/or):* throw-vs-ignore on an unrecognized id is a **genuine choice**, not a forced exclusion. The earlier framing cited `intents-ux-only:385` (*"defaults are the most permissive value; restriction is the author's opt-in"*) as if it *forbade* throwing — but `:385` is a **value-default** rule (the default *value* of a dimension), not an engine-robustness rule about unknown ids. Citing it as authority here **over-extends its scope** (the citation-scope miss recorded in *Lineage*). Both branches are coherent; the default wins on its own merit below, with `:385` as supporting context only.

- **(a) Graceful most-permissive ignore** — an unknown intent degrades to most-permissive (its traits simply aren't gated → behave as ungated), with a per-intent **`mustUnderstand: true`** opt-in for fail-fast (native precedent: SOAP `mustUnderstand`, HTTP `Prefer: handling=strict`) **and a build-time `warn`-on-unrecognized-non-namespaced-id** (mirrors the `[Router] Invalid route pattern` diagnostic, #1187) so the permissive default isn't a silent-typo footgun. **← default.** *Why it wins (the load-bearing reason):* the **must-ignore discipline** every successful extensible format adopts — HTML ignores unknown tags, CSS drops unknown properties, JSON consumers ignore unknown fields. In a distributed system a manifest authored against a *newer* vocabulary must **degrade**, not hard-break, on an *older* engine; throw-by-default makes the system forward-incompatible. (`:385`'s most-permissive spirit aligns, but is supporting, not dispositive.)
- (b) Throw-by-default — coherent but **inferior**: forward-incompatible (an older engine hard-fails on any newer custom intent it hasn't loaded), and makes restriction the default. The `mustUnderstand: true` opt-in already recovers fail-fast wherever an author genuinely wants it, so throwing buys nothing the opt-in doesn't.

**Skeptic:** SURVIVES **as a choice** (re-classified from forced-exclusion). The must-ignore / forward-compat argument — not the `:385` citation — is load-bearing; the build-time warn closes the silent-typo footgun without re-breaking forward-compat (a throw would). Attack ("unknown id is usually a typo, so fail fast") is answered by warn-on-unknown + `mustUnderstand` opt-in, which catch the typo without sacrificing forward-compat.

## Fork 3 — Composition (`extends` a standard intent)

*Why it's a fork (case a — flawed branch excluded):* **override-mode `extends`** (Tailwind-style last-write-wins on a dimension *name*) is broken — it is precisely the *"second home for a declared axis"* that #1884 `presentation-axis-is-intent-owned` (`:1468`) and `realize-a-declared-axis; never stand up a second home` (`:1473`) forbid: `acme:surface extends surface` overriding the `radius` dimension creates two homes that can silently contradict on one axis. The statute's actual prescription is *extend the owning intent's dimensions* (additively), not fork-and-override.

- **(a) Additive `extends`** — a custom intent may **add wholly-new dimensions** (its own open, *namespaced* value sets — open vocabulary, no collision with the standard space), **and** may **add values to a standard dimension** *iff* that dimension is **open-numbered** and the added value is **namespaced** (`owner:value` — see (d)). It may **not** override/shadow an inherited dimension, and **not** widen a *closed* standard enum (e.g. action `neutral|danger`, #1337 non-negotiable `:1465`). Rejected at validate-time. **← default.**
- (b) ~~Override-mode `extends`~~ (Tailwind last-write-wins on dimension name) — **excluded/broken** (second-home drift; contradicts #1884/#1128/#1337).
- (c) Standalone-only — coherent but inferior: with no `extends` at all, a custom intent that genuinely builds on a standard one must re-declare shared dimensions by hand. (This downside is *merit*, not cost: re-declaration is a fresh, unlinked copy of a standard axis — a divergence surface the additive form structurally prevents, not merely "more to type.")
- **(d) Cross-author value-addition to a standard dimension — ALLOWED iff the dimension is open-numbered AND the value is namespaced (`owner:value`).** *Decided here* (this clause was briefly carved to a follow-up, then folded back after the concrete `caution`-on-`severity` case — below). The open-numbered axis (#1318/#1427) exists precisely so authors mint members; the only wrinkle is that #1318's *flat, unnamespaced* value model was authored for the **single WE catalog authority** (the standard's own evolution), not the cross-author case — so a bare cross-author value (`caution`) collides with a future standard value of the same name (the RFC 6648 failure, one layer below intent ids). The fix is **Fork 1's principle applied to values: namespace by ownership.** A consuming lib adds **`acme:caution`** to the open severity axis with its own style + ordering — cannot collide; promotion to standard = **drop the prefix** (`acme:caution` → `caution`, an alias, never a rename).
  - **Guardrail 1 — open-numbered only.** **Closed enums (#1337) stay untouchable by *anyone*.** A closed set is closed because it is **semantically load-bearing**: a downstream consumer (a11y live-region politeness, alert routing, log-severity ranking) must understand *every* member, and an unknown one breaks that reasoning. The **open-vs-closed call is the gating judgment**: a dimension is *open* when nothing downstream reasons over its values (pure presentation — color / icon / ramp), *closed* when a finite set drives behavior / a11y / semantics. (Worked example: a `message level` axis that only drives color+icon is open → `acme:caution` slots in; one that drives ARIA live politeness is closed → model `caution` as its own attribute or map onto an existing level + a presentational variant.)
  - **Guardrail 2 — namespaced only.** A **bare** (non-namespaced) cross-author value added to a standard dimension is **rejected at validate-time**; it must be `owner:`-scoped.

**Skeptic:** DEFAULT evolved through three passes — (1) override-mode → narrowed to additive; (2) "additive" silently included **bare** cross-author value-widening of standard dimensions, which over-extends #1318's single-author flat-value scope and opens a value-collision; (3) **resolved in-place, not deferred** — cross-author value-addition is *allowed but **namespaced*** (`owner:value`) on **open-numbered** dimensions only, closed enums (#1337) untouchable. Namespacing closes the collision (Fork 1's RFC-6648 principle at the value layer) **without** blocking the most common real need (the `caution`-on-`severity` case that would otherwise have been wrongly forbidden by "strict add-only").

## Supported by default (not decisions)

These are forced by existing statute or are the status quo — recorded here so the decider doesn't spend judgment on them:

- **Registration timing is not a fork.** Build-time declarative registration **is the existing seam** — a per-product intent manifest globbed in exactly like [we:src/_data/intents/](../src/_data/intents/) (`loadIntents` readdir). A runtime register-API is a **demand-gated follow-up** (decided only when a real dynamic-host consumer — a plugin host / user-authored dashboard — exists, with CSS's `@property` declarative-first-plus-runtime-hatch as the shape), filed as a separately-prioritized item — *not* a branch ratified here. (Dissolved per the fork-existence test: nobody proposes runtime-only; the only argument against shipping the hatch now is "no consumer yet," which is prioritization, not merit.)
- **Placement (zero-impl line, #1282).** The meta-schema **definition** + the `validateIntent` extension ([we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs)) live in WE — the sanctioned definitions-plus-validate-script carve-out. The product-manifest **glob loader** and any runtime register-API are runtime impl → **FUI / the product**, never WE.
- **Most-permissive per-dimension default** (`intents-ux-only:385`) — each custom dimension carries a `default` that is its most permissive value.
- **Namespace by ownership, never by status** (RFC 6648) — graduation to standard drops the scope prefix (alias/registration), never a rename.

## Statute composition

This realizes `intents-ux-only` (`:378`/`:385`) and composes — without contradiction, once Fork 3's cross-author additions are ownership-namespaced — with `presentation-axis-is-intent-owned` (`:1468`, the #1884 parent), `open-numbered-variants` (`:1420`), the tone axis (`:1458`), and the #1337 closed-enum line (`:1465`). The custom-intent meta-schema is the **intent-level ring** around #1318's value-level open-numbered axis: #1318 opens *values within* a standard intent for the **single WE authority**; this opens *whole intents* (Fork 1) **and extends #1318's value-openness to the cross-author case** via value-level ownership-namespacing (`owner:value`, Fork 3(d)) — both under the same open-but-fenced discipline, both fenced off from #1337 closed enums. On resolve, codify as a new anchor (e.g. `custom-intents-namespace-by-ownership`, spanning intent-id *and* value-level namespacing) cross-linking these and setting `codifiedIn`.

## Meta-schema shape (the prepared target)

```jsonc
{
  "id": "acme:lozenge",        // Fork 1: scope-prefixed; standard ids stay bare
  "name": "Lozenge Intent",
  "extends": "tag",            // Fork 3: OPTIONAL — additive (add new namespaced dimensions; add owner:value-namespaced values to OPEN-numbered standard dimensions; never override inherited, never widen a CLOSED enum)
  "dimensions": {              // same shape as standard intents
    "emphasis": { "description": "…", "values": ["subtle", "bold"], "default": "subtle" }
  },
  "mustUnderstand": false,     // Fork 2: false (default) = graceful ignore; true = fail-fast
  "provenance": "com.acme"     // owner anchor (audit/dedupe) — ownership, never status
}
```

## Lineage

Surfaced 2026-06-28 by [#1884](/backlog/1884-presentation-trait-style-vocabulary-intents-parallel-style-a/) (resolved: presentation axis is intent-owned — valid *only if* apps can extend the model). Prepared 2026-06-28: prior-art survey (7 systems) → [/research/app-authored-custom-intents-meta-schema-registry/](/research/app-authored-custom-intents-meta-schema-registry/); forks classified against the architecture and skeptic-attacked (Fork 2 "registration timing" dissolved as a fake fork; Fork 3 narrowed from override-mode to additive-only to compose with the #1884/#1128 second-home statute; warn-on-unknown amendment folded into Fork 2). Realizes the promise of the now-resolved parent ruling #1884 (no live `blockedBy` — #1884 is resolved; the relationship is lineage, not a prerequisite).

**Refined in discussion 2026-06-28 (pre-ratification, still `active`):** (1) **Fork 2 reclassified** from forced-exclusion to a *genuine choice* — the `:385` citation over-extended a value-default rule onto engine error-handling; the default re-grounded on **must-ignore / forward-compat**. (2) **Fork 3 evolved through three passes** — override-mode → additive → caught that *bare* cross-author value-widening over-extends #1318's single-author flat-value scope (value-collision) → **resolved in-place, not deferred**: cross-author value-addition is *allowed but namespaced* (`owner:value`) on **open-numbered** dimensions only, **closed enums (#1337) untouchable by anyone** (Fork 3(d)). Driven by the concrete `caution`-on-`severity` case (a "strict add-only" rule would have wrongly forbidden it); namespacing applies Fork 1's RFC-6648 principle at the value layer. **Open-vs-closed is the gating judgment** — is anything downstream (a11y/behavior/logging) reasoning over the values. (3) **Fork 1 separator sub-fork** (`:` vs the `@owner/intent` npm-scope spelling) made explicit — colon chosen. **Root cause shared by the Fork-2 and Fork-3 misses:** *citation-scope over-extension* — a statute cited as authority for a case wider than the scope it was authored for. This surfaced a proposed **citation-scope check** for the decision red-team (*backlog-workflow.md → Red-team the default*), distinct from the existing grounding-claim (`:294`) and statute-overlap (`:333`/#1886) checks.
