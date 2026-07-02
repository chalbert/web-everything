# Reserved delimiter-family policy — prior-art survey (reservation partitions + escape/override grammars)

**Date**: 2026-07-02
**Point:** Prep research for decision #2112 — how platforms partition a syntax keyspace into platform-reserved vs userland-legal, and what the raw/verbatim escape-hatch + delimiter-override grammar looks like across template engines; concludes the Custom-Elements hyphen rule is the *wrong* analogue (it protects a registration-less, globally-shared, forward-growing namespace) and the delimiter keyspace under #2074 is a *registration-mediated, app-scoped* namespace whose honest policy is a host-token blocklist (the tokenizer tag-open slice) + dispatch-key collision + per-bundle-declared escape grammars.
**Research page**: `/research/reserved-delimiter-family-policy/`

---

## Question

#2074 ratified `customNodes` (delimiter-keyed node recipes) with `static open` as the registration key, a normative
`DelimiterCollisionError`, and "a raw/verbatim escape hatch + delimiter-override is a mandatory conformance
requirement" — but deferred to #2112 *which* opens are platform-reserved vs userland-legal (the would-be
Custom-Elements hyphen-rule analogue) and the exact escape-hatch/override grammar. This survey grounds that call.

## The reservation-partition pattern across platforms

Three distinct partition techniques recur, keyed to *what kind of namespace* is being protected:

| Platform / namespace | Partition rule | Technique | Why that technique |
|---|---|---|---|
| **HTML custom elements** (tag names) | Userland MUST contain a hyphen (valid custom element name); everything hyphen-less is the platform's, forever | **Marked subspace for userland** | The tag namespace is *global, registration-less at parse time, and forward-growing* — the parser must classify a name as custom without any registry lookup, and future HTML elements must never collide with deployed pages |
| **HTML custom elements** (reserved names) | `annotation-xml`, `color-profile`, `font-face`, `font-face-src`, `font-face-uri`, `font-face-format`, `font-face-name`, `missing-glyph` are hyphenated yet forbidden | **Blocklist carve-out** | Legacy SVG/MathML names already occupy the marked subspace — a blocklist patches the partition where history overlaps it |
| **CSS custom properties** | `--*` is userland's forever (the spec explicitly promises CSS will never mint `--`-prefixed properties); `-vendor-` prefixes were the implementor space | Marked subspace (inverted: the *platform* cedes the marked space) | Same registration-less shared namespace as tags — a stylesheet property name is classified lexically |
| **`data-*` attributes** | Prefix reserved for authors; the platform promises never to mint `data-*` | Marked subspace | Attribute names are host-shared and registration-less |
| **JS private fields** | `#name` is per-class lexical, structurally uncollidable with public/platform properties | Sigil partition | Hard language-level separation, no registry |
| **XML** | Names beginning `xml` (case-insensitive) reserved; PI target `xml` reserved | Prefix blocklist | Small closed reservation over an otherwise-free space |
| **WHATWG PR #12118** (ProcessingInstruction, merged 2026-06-25) | `<?target data?>` parses to a real PI node, gated by a target-name grammar + a blocklist (`xml`, `xml-stylesheet`) | Grammar + blocklist | The platform's freshest delimiter→node opening uses exactly *bounded grammar + named blocklist*, not a marked subspace |
| **npm unscoped names** | First-come-first-served through the registry; squatting/typosquatting handled by moderation | **Registration-mediated first-come** | A registry arbitrates every claim, so no lexical partition is needed |
| **npm scoped packages** | `@scope/name` — ownership of the scope partitions the space | Ownership namespacing | RFC 6648-style: namespace by *ownership*, not by status |
| **IANA URI schemes** | Permanent/provisional registration; provisional is essentially first-come | Registration-mediated | Registry arbitration again — the partition is procedural, not lexical |

**Synthesis — which technique fits a keyspace is decided by two properties:** *(1) is the namespace shared with the
host platform at the point of classification?* and *(2) is a registry present to arbitrate claims?* A marked
subspace (hyphen rule) is the answer only when the namespace is **shared + registration-less + forward-growing**.
When a **registry mediates every claim** (npm, IANA, `define()`-time), first-come + typed collision errors + a small
blocklist of the host's own tokens is the entire policy — no lexical partition is needed or used.

This is already WE statute in a sibling form:
[we:docs/agent/platform-decisions.md#registry-name-guard-namespace](../docs/agent/platform-decisions.md) ("guard the
namespace you share with the host, not every `define()`") ruled that framework-internal registry keys that never
reach a host-shared namespace stay unguarded — and it derives from the same native-first observation (native
`customElements.define` guards *only* the one host-shared namespace).

## Where the delimiter keyspace sits on that map

- **Classification point:** `customNodes` recipes scan **Text-node content after HTML parsing**
  (`fui:plugs/webexpressions/CustomTextNodeParser.ts:84-116`). The tokenizer's tag-open state fires only on `<`
  followed by `!`, `/`, `?`, or an ASCII letter — that exact slice is host-shared at the authoring surface (typed
  raw it becomes markup; it reaches Text data only via entity escaping or `textContent`), while any other `<` (e.g.
  ERB's `<%`) is emitted as a literal character and stays ordinary, freely-claimable text. So the reservation over
  the tokenizer slice is **cross-channel-incoherence policy** (the same author string is markup on one channel,
  recipe on another), not "unreachability" — escaped occurrences are reachable.
- **Registry mediation:** every open enters through `customNodes.define()` per app — there is no global,
  registration-less claim. Collision is detectable at define time (`DelimiterCollisionError`, normative per #2074 —
  [we:docs/agent/block-standard.md#custom-node-recipes](../docs/agent/block-standard.md)).
- **Forward growth:** the platform's most plausible future claim on text-level delimiters is DOM Parts / Template
  Instantiation (`{{ }}` inside `<template>`) — i.e. the platform's likeliest future token is **the most popular
  userland open**. A hyphen-rule-style "userland must mark; unmarked is the platform's" partition would therefore
  outlaw exactly the grammars the framework bundles exist to reproduce (`{{` `{%` `{#` `{` `@if` … — #2114–#2119),
  while protecting nothing the tokenizer doesn't already protect.
- **Machine-reserved space:** comment-interior residue sigils (leading `[` / `]` / `/`) are already
  matcher-excluded machine grammar by ratified statute
  ([we:docs/agent/block-standard.md#directive-registration-mechanism](../docs/agent/block-standard.md) rule 5); the
  concrete sigil choice is #1989's open proposed ruling.

**Current collision ground truth (the gap #2104 fills):** parsers are today "evaluated in registration order — the
first parser whose delimiters match wins" (`fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts:14-16`) — no
exact-match collision detection, no longest-match arbitration. The shipped opens are `{{`/`}}` and `[[`/`]]`
(`fui:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts`,
`fui:blocks/parsers/text-node/double-square/DoubleSquareBracketParser.ts`).

**Prefix-overlap must be legal:** the sanctioned bundles require co-resident prefix-overlapping opens *within one
flavor* — Handlebars `{{` + `{{{` + `{{!` + `{{>` (#2114), Svelte `{` + `{#` + `{@` + `{:` (#2118), Blade `{{` +
`{!!` (#2116). And bundles co-reside *same-open regions* (`{{#if}}`/`{{#each}}`; #2074's own table has two `{#`
rows split by `regionName`). So "collision" cannot mean prefix overlap **or bare-`open` equality**; it can only
mean **exact equality of the full dispatch key** (`open`; plus `regionName` for regions) **among live recipes**,
with **longest-match-first tokenization** as the normative disambiguator (exactly how Mustache already
distinguishes `{{{` from `{{`).

## Escape-hatch + override grammars across template engines

| Engine | Raw/verbatim region | Char-level escape | Delimiter override |
|---|---|---|---|
| Mustache | — | — | **In-band** set-delimiter tag `{{=<% %>=}}` (the lone in-band override in the field) |
| Handlebars | `{{{{raw}}}}…{{{{/raw}}}}` (raw block) | `\{{escaped}}` | — |
| Liquid | `{% raw %}…{% endraw %}` | — | — |
| Jinja2 | `{% raw %}…{% endraw %}` | `{{ '{{' }}` (expression emitting the literal) | **Out-of-band** `Environment(block_start_string=…, variable_start_string=…)` |
| Nunjucks | `{% raw %}` / `{% verbatim %}` | — | Out-of-band `nunjucks.configure({ tags: {…} })` |
| Vue | `v-pre` (attribute-keyed skip region) | — | Out-of-band app option `delimiters: ['${', '}']` |
| Angular | `ngNonBindable` (attribute-keyed skip) | — | (historic per-component `interpolation` config, since removed) |
| Svelte | — | `{'{'}` / `&lbrace;` (expression/charref emitting the literal) | — |
| Blade | `@verbatim…@endverbatim` | `@{{ }}` prefix escape | — |
| ERB | — | `<%%` literal | — |
| HTML itself | RAWTEXT elements (`<script>`, `<style>`), RCDATA (`<textarea>`, `<title>`), CDATA in foreign content | `&lt;` character references | — |

**Synthesis:**

1. **The escape hatch is universal and mandatory** (every `{{`-engine ships one, because stacking template layers
   makes the popular opens collide) — #2074 already ratified this as a conformance requirement; only the grammar
   shape was left open.
2. **Two escape shapes recur:** a **raw region** (spelled *in the flavor's own delimiter family* — `{% raw %}` for
   `{%`-engines, `@verbatim` for the `@`-sigil engine, `{{{{raw}}}}` for mustache-family) and a **char-level escape
   prefix** (`\{{`, `@{{`, `<%%`). They *coexist* in the engines that have both (Handlebars, Blade) — they are
   complementary constructs, not rivals.
3. **No engine reserves a universal cross-flavor escape token.** The raw construct is always in-grain with the
   flavor's own grammar. HTML's own analogue agrees: raw-text scanning is a property of *specific named regions*
   (`<script>`), not a universal escape token.
4. **Delimiter override is app-level configuration** everywhere except Mustache's in-band set-delimiter tag (a
   minority-of-one; and even it is expressible as a recipe under #2074's model rather than a policy concern). Vue's
   `delimiters` app option is the exact shape of #2074's declared `static open`/`static close` + WE's
   config-extends-platform-default — an app *re-declares*, nothing is "overridden" in a bespoke mechanism.
5. **Model-shape observation for the raw region:** #2074's nature enum (`value` / `children:'inert'|'live'` /
   marker) has no value meaning "content is *not scanned* and emitted verbatim" — `'inert'` means
   template-instantiable, which still implies scanning for nested recipes. A raw region is grammatically a region
   whose payload is excluded from recipe scanning (content stays as parsed — raw suppresses *recipe* processing,
   never HTML parsing: Blade's `@verbatim` keeps its markup real elements) — a natural third `children` value
   (`'raw'`), mirroring HTML's RAWTEXT content model as the native-first shape.

## Recommendation (feeds the item's forks)

- **Fork 1 (partition law):** host-token blocklist only — the tokenizer tag-open slice (`<` + `!`/`/`/`?`/letter)
  is reserved on cross-channel-incoherence grounds; the comment-interior residue keyspace is a *different surface*
  (disjointness ratified as #1986 rule 5; the concrete sigils and comment-vs-text surface choice are #1989's open
  turf — a text-family reservation, if #1989 ratifies one, is minted by that ruling); **every other open is
  userland-legal**, first-registered within an app, arbitrated by `DelimiterCollisionError`. The hyphen-rule
  analogue is a false analogy for a registration-mediated, app-scoped keyspace and would outlaw the #2094 bundles.
- **Fork 2 (collision predicate):** collision = **exact dispatch-key equality** (`open` for value/marker recipes;
  (`open`, `regionName`) for regions — #2074's own table co-resides two `{#` regions) among live recipes after
  config resolution; tokenization is **longest-match-first** — forced by the bundles' own grammars (`{{`/`{{{`,
  `{`/`{#`, `{{#if}}`/`{{#each}}`).
- **Fork 3 (escape grammar):** verbatim is a **nature value** (`children:'raw'`), and each bundle **declares its
  flavor's own raw construct as an ordinary recipe** — no platform-reserved universal escape token. Char-level
  escape prefixes are an anticipated model gap routed to the #2113 scorecard gap lists (the #2094
  evidence-not-guess discipline), like `{{else}}`.
- **Not a fork:** delimiter override — a config dimension
  ([we:docs/agent/platform-decisions.md#config-extends-platform-default](../docs/agent/platform-decisions.md));
  opens are declared statics, an app re-declares via config; distinct turf from #1992 (attribute-name separator,
  not delimiters).

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-07-02-reserved-delimiter-policy-prior-art.md` | This survey |
| `we:src/_data/researchTopics/reserved-delimiter-family-policy.json` | Research-topic registry entry |
| `we:src/_includes/research-descriptions/reserved-delimiter-family-policy.njk` | Research write-up |
| `we:backlog/2112-reserved-delimiter-family-policy-which-opens-are-platform-re.md` | Rewritten to the prepared-fork shape |
