# Configurable attribute-naming scheme — #1992 prep session (prior art, forks, skeptic + screen)

**Date**: 2026-07-02
**Point**: Brought decision #1992 (the #1987-deferred configurable directive-separator mechanism) to the Definition of Ready — reframed the knob from a separator char to a naming-scheme config dimension, prepared four forks with bold defaults, survived two skeptic passes (all SURVIVES-WITH-AMENDMENT, amendments folded) and a 4/4-clear two-confusion screen.
**Research page**: `/research/configurable-attr-naming-scheme/`

---

## Question

#1987 ratified colon as WE's internal authoring spelling and settled the posture that the separator is
app-configurable (the objector escape hatch + the migration bridge to an eventual WG-ratified spelling,
`enh-*` never `we-*`), deferring the mechanism to #1992. What is the mechanism's contract: where does the
knob live, what value does it take, how deep does it reach, and what is the migration path?

## Recommendation

Four forks at DoR (defaults bold in the item):

1. **Value-space** → a naming-scheme flavor dimension `attrNaming` on the ratified
   config-extends-platform-default surface (forced invariant — a separator-char knob is subsumed and
   broken: it cannot express `enh-*` and is undefined over the post-#1991 family-less names; a mapper
   function violates config-is-data). Normative flavor-validity rules are the core: total, injective,
   native-namespace-safe, single-valued — validated by the FUI resolver, not assumed. Platform ships
   `colon-namespace` only; `enh-prefix` reserved and pinned (hyphen-join; family-less stays bare).
2. **Remap identity** → canonical-everywhere projection (forced invariant): the colon name is the identity
   in every API plane (`define()`, callbacks, `observedAttributes`, docs); the spelled DOM name comes via an
   explicit accessor; the scheme applies only at the DOM↔registry boundary
   (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:308-309,463-464`). The hatch is honestly
   DOM-spelling-only.
3. **Flavor exclusivity** → single-valued flavors (exclusive matching): canonical spelling goes inert under
   a remap — silently in production, with a dev-mode straggler diagnostic; additive normalization rejected
   as a standing contract (re-opens per-author variance, the thing #1987 actually excludes); a transitional
   dual-match mode is reserved for a real colon→`enh-*` migration event.
4. **Value scope** → app-pinned: the `attrNaming` chain terminates at app scope, codified as an explicit
   amendment clause on `config-extends-platform-default` ("a surface statute may pin a dimension's chain
   depth") — the config system's first non-nestable dimension.

## Key findings

- **Stale premise fixed**: the item carried a `blockedBy` #1991 premise (bare-hyphen attrs migrating INTO
  colon). #1991 resolved 2026-07-01 with the opposite ruling (family-only colon) — the blocker is gone in
  status and substance, and the reversal is evidence for the scheme framing.
- **Prior art splits exactly along the forks**: Vue 0.x removed its configurable prefix in 1.0
  (vuejs/vue#2415 — published-code spelling forks the ecosystem → Fork 2); Alpine's surviving
  `Alpine.prefix()` is exclusive + projection-shaped, and its shorthand-breaks lesson makes totality a
  validity rule (→ Fork 1); AngularJS's five-spelling additive normalization vs htmx's standing
  `hx-*`/`data-hx-*` dual frame Fork 3; Vue `delimiters` is the surviving exclusive-swap knob.
- **Skeptic pass (two agents, four attack axes)**: all forks SURVIVES-WITH-AMENDMENT; no default flipped
  except one sub-default — the first draft had callbacks receiving the *spelled* name, refuted as the Vue
  defect relocated to the callback, flipped to canonical + accessor. Other landed hits, folded: the bare
  string config example was contract-invalid (a `DimensionPointer` per #1702 → `extendsFlavor(…)`); the
  `on:click`→`onclick` native-collision landmine → name-guard extended over flavor images (a real
  registry-name-guard statute collision, now reconciled); a false #1989 citation (no residue sigil exists —
  residue is the comment open/close grammar; scope exclusion rewritten); #1991's back-compat aliases are a
  ratified sibling running additive — fenced as transitional; the most-permissive-default statute line
  confronted (it governs the value default, not mechanism validity); the app-scope pin was promoted from an
  unratified "narrower statute wins" footnote to Fork 4.
- **Two-confusion screen (fresh-context agent)**: 4/4 clear — every fork observable across the WE↔FUI
  boundary (config surface, API contract, markup behavior, attach scope); no merit-vs-prioritization
  confusion (the one prioritization-adjacent move, transitional dual-match, is a reserved scoped exception,
  not a deferred branch).
- **Settled, not forks**: default colon (ratified); surface scope = behaviour/event attr names only
  (comment names grammar-locked `fui:plugs/webdirectives/CustomCommentParser.ts:34`; `type=` values reject
  colon `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:79-87`); layer placement (WE contract type +
  FUI resolver per #1662/#1702); `enh-*`-never-`we-*`.

## Files created/modified

| File | Action |
|---|---|
| `we:backlog/1992-configurable-directive-separator-mechanism-the-objector-esca.md` | Rewritten to prepared-fork shape (4 forks, Skeptic + Screen lines, statute-overlap reconciled) |
| `we:src/_data/researchTopics/configurable-attr-naming-scheme.json` | New research-topic registry entry |
| `we:src/_includes/research-descriptions/configurable-attr-naming-scheme.njk` | New research write-up |
| `we:reports/2026-07-02-configurable-attr-naming-scheme.md` | This report |
