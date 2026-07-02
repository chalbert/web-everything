---
kind: decision
status: open
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
preparedDate: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, reserved-names, escape-hatch, standard-proposal, decision]
relatedReport: reports/2026-07-02-reserved-delimiter-policy-prior-art.md
---

# Reserved delimiter-family policy — which opens are platform-reserved for userland custom nodes

Deferred child of [#2074](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/) (`customNodes` node
recipes), now **prepared**: no reservation design existed; the three forks below are grounded in a prior-art survey
of reservation partitions + escape/override grammars across platforms, published as the
[`reserved-delimiter-family-policy`](/research/reserved-delimiter-family-policy/) topic (session report via
`relatedReport`), each with a recommended default in **bold**. The headline finding: the Custom-Elements hyphen rule
is the **wrong analogue** — it protects a *registration-less, globally-shared, forward-growing* namespace, while the
#2074 delimiter keyspace is *registration-mediated and app-scoped* — so the honest policy is a **narrow host-token
blocklist + dispatch-key collision + per-bundle-declared escape grammars**, not a marked userland subspace.

**Standing test.** Not a validation gate: the original "do we reserve a family now, on what trigger" framing
dissolves — Forks 1 and 2 are **forced-invariant ratifies** (each names a positively broken alternative) and Fork 3
is the one genuine weigh; the "low urgency until a collision / #2094 forces it" clause is ordering, never a gate
verdict (#1961/#2092 — timing is backlog priority, recorded under Context). The one genuine cross-sibling
dependency — #1989's open residue-form choice — is absorbed *inside* Fork 1 (a)'s machine-family clause, not a
blocker on ruling the law.

**Axes.** (1) The **keyspace-partition law** — which `static open` values `customNodes.define()` may accept
(conformance spine: [we:docs/agent/block-standard.md](docs/agent/block-standard.md#custom-node-recipes); the
normative `DelimiterCollisionError` per #2074, deferred here for *which opens are legal*). (2) The **collision
predicate** — what "colliding" means, given prefix-overlapping opens co-resident in every real bundle
(`fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts:14-16` is today registration-order first-match-wins, no
collision detection — the #2104 gap). (3) The **raw/verbatim escape-hatch grammar** — #2074 ratified the hatch as a
mandatory conformance requirement; the open half is its exact shape (the nature enum at
[we:docs/agent/block-standard.md](docs/agent/block-standard.md#custom-node-recipes) rule 3 has no "unscanned"
value today). Delimiter *override* is settled by enumeration — see "Not decisions" below.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — keyspace-partition law | **host-token blocklist only (`<` + `!`/`/`/`?`/letter roots); every other open userland-legal, registry-arbitrated** (forced invariant) | hyphen-rule analogue (marked userland subspace) · WE-reserved future family | high |
| **Fork 2** — collision predicate | **collision = exact dispatch-key equality (`open`; + `regionName` for regions) among live recipes in one registry scope; tokenization longest-match-first** (forced invariant) | prefix-overlap or bare-`open` collision (*both broken*) | high |
| **Fork 3** — raw/verbatim escape grammar | **`children: 'raw'` scan-suppression nature; each bundle declares its flavor's raw construct as an ordinary recipe; no reserved universal token** | normative universal raw construct (MUST) | med-high |

## Fork 1 — the keyspace-partition law: host-token blocklist, not a marked userland subspace

*Fork-existence:* a forced invariant — a keyspace has exactly one legality law, and both alternatives are positively
broken here: a marked userland subspace (b) outlaws every grammar the sanctioned #2114–#2119 bundles reproduce, and
a speculative WE-reserved family (c) reserves keyspace ahead of any ratified consumer. This is a **ratify**.

**Crux.** Prior art partitions a syntax keyspace three ways, keyed to the namespace's nature: a *marked subspace*
(custom-elements hyphen rule, CSS `--*`, `data-*`) where the namespace is host-shared, registration-less, and
forward-growing; a *blocklist carve-out* (custom elements' reserved names; WHATWG PR #12118's PI target blocklist —
the platform's freshest delimiter→node opening); and *registration-mediated first-come* (npm unscoped, IANA)
wherever a registry arbitrates. The #2074 keyspace is registration-mediated and app-scoped: recipes scan **Text
content after HTML parsing** (`fui:plugs/webexpressions/CustomTextNodeParser.ts:84-116`). Only a **narrow, precisely
bounded** slice of that keyspace is host-shared: the HTML tokenizer leaves the data state exactly on `<` followed by
`!`, `/`, `?`, or an ASCII letter — any other `<` (e.g. `<%`) is emitted as a literal character and stays ordinary
text. A recipe open rooted in that tokenizer slice is **cross-channel incoherent**: typed raw in markup it is
consumed as markup (a tag, a bogus comment), while the *same string* arriving via `&lt;!`-escaping or
`el.textContent = '<!foo>'` is matchable Text data — so the recipe silently fires on some authoring channels and
never on others. That incoherence, not "unreachability", is what justifies a define()-time **error** (not the warn
tier — #2074's warns are for contradictory-but-functional *configs*; an open in the host slice is a name-legality
defect, the exact class `customElements.define` answers with a `SyntaxError`). WE statute carries the discriminator:
[registry-name-guard-namespace](docs/agent/platform-decisions.md#registry-name-guard-namespace) — *guard the
namespace you share with the host, not every `define()`* — applied sharply: this keyspace is **partially**
host-shared, so guard exactly the shared slice and nothing else. (Its rule 2 left text-node registry keys unguarded
— written when those keys were *names* like `mustache`/`polymer` that never touch a host surface; #2074 re-keyed
recipes by the delimiter grammar itself, whose tokenizer slice *is* host-shared — so codifying this fork
**instantiates rule 2 with an amendment**, with lineage; see Statute-overlap.)

- **(a) Host-token blocklist only** *(default)* — reserved (define()-time `ReservedDelimiterError`): opens rooted at
  **`<` + `!`/`/`/`?`/ASCII-letter** (the exact tokenizer tag-open set — the host-shared slice, matchable only with
  cross-channel incoherence). **Every other open is userland-legal**, first-registered within an app, arbitrated by
  `DelimiterCollisionError` (Fork 2). Two scope notes that keep the law honest: **(i)** the blocklist tracks the
  host tokenizer, so it is closed **per platform version** — if the platform later claims a text-level token (DOM
  Parts' `{{ }}` is the live candidate), the blocklist grows with it, and already-registered recipes keep working
  through app-level re-keying (a migration story; no lexical partition could *prevent* the overlap, since the
  platform's likeliest claim is the most popular userland open). **(ii)** **Machine-reserved families are minted by
  the ruling that creates the machine grammar, never pre-reserved here:** #1986 rule 5 (ratified) requires authored
  and residue grammars to be disjoint and matcher-excluded; *where* the residue grammar lives is
  [#1989](/backlog/1989-directive-applied-residue-region-annotation-marker-grammar-u/)'s open choice (its current
  proposal is comment-interior brackets — a different scan surface, no text-open reservation; its earlier
  reflected-delimiter branch, e.g. `{$…$}`, would claim a text family). If #1989 ratifies a text-keyspace residue
  form, *that ruling* adds the family to the reserved set with its consumer attached — this law just defines the
  extension mechanism.
- **(b) Hyphen-rule analogue — userland opens must carry a mark; unmarked space reserved for the platform** —
  *Rejected (broken):* outlaws every grammar the #2094 bundles exist to reproduce (no framework open carries a
  distinguishing mark), and the technique's precondition — registration-less lexical classification of a shared,
  forward-growing namespace — does not hold in a registry-mediated, app-scoped keyspace.
- **(c) WE pre-reserves a named future family (e.g. `{$`)** — *Rejected as written, absorbed as the (a)(ii)
  mechanism:* a reservation ahead of a ratified consumer is speculative squatting (mandate-nothing); the one named
  candidate consumer (#1989's reflected-delimiter residue branch) mints its own reservation *through its own
  ratification* per (a)(ii), so nothing is foreclosed and nothing is squatted.

```ts
// (a) in practice — define()-time legality:
customNodes.define(class X extends CustomNode { static open = '<%' })  // LEGAL: '<'+'%' never enters the
                                                                       // tokenizer's tag-open state (ERB lives)
customNodes.define(class Y extends CustomNode { static open = '<!' })  // ReservedDelimiterError: host tag-open
                                                                       // slice — markup when raw, text when escaped
customNodes.define(class Z extends CustomNode { static open = '{{' })  // legal; collides only with a live recipe
                                                                       // sharing its dispatch key (Fork 2) — and
                                                                       // "live" is judged AFTER config resolution,
                                                                       // so re-keying the platform-default '{{' via
                                                                       // the extends chain supersedes, never throws
```

Skeptic: LANDS → amended, default retained in narrowed form — the attack disproved the original blocklist content
("all `<`-rooted opens", "reserved by fact/unreachable": `<%` survives tokenization, and `&lt;!`/`textContent` make
`<!` reachable in Text data), the closed-forever claim, the false `customElements`-arbitration analogy, the import
of #1989's unratified comment-interior sigils into this keyspace's blocklist, and the friction-free citation of
registry-name-guard-namespace (whose rule 2 exempts text-node registry keys — the citation now carries an explicit
rule-2 amendment for grammar-keyed registries; see Statute-overlap). Fixes: blocklist narrowed to the exact
tokenizer tag-open set, error re-grounded as cross-channel-incoherence *policy* (error-not-warn grounded on the
`customElements` invalid-name precedent), closedness restated per-platform-version, machine families made
mint-on-ratification (#1989's reflected-delimiter branch no longer foreclosed — the earlier "zero consumer"
rejection of (c) was false), fork-existence relabeled ratify-not-weigh. The law choice itself survived the
strongest pro-(b) case (future-platform-proofing), which fails on its own precondition and on the bundles as filed
evidence.
Screen: clear — fresh-context agent (2026-07-02): the ruling is author-observable (which `static open` values
`define()` accepts, which throw — the `customElements.define` name-legality analogue), and with cost stripped the
branches remain different legal keyspaces (correctness + precedent stakes), not orderings of one end-state.

## Fork 2 — the collision predicate: dispatch-key equality + longest-match (forced invariant)

*Fork-existence:* a forced invariant — the alternatives are positively broken: prefix-overlap-as-collision outlaws
Handlebars `{{`/`{{{`/`{{!`/`{{>` (#2114), Svelte `{`/`{#`/`{@`/`{:` (#2118), and Blade `{{`/`{!!` (#2116); and
bare-`open` equality falsely collides #2074's own ratified examples (`{#each}` vs `{#ctx}` — both `open='{#'`) and
every bundle with two block constructs on one sigil (`{{#if}}`/`{{#each}}`, `{% if %}`/`{% for %}`/`{% raw %}`).
This is a **ratify**, not a weigh.

- **(a) Collision = exact equality of the full dispatch key among live recipes in one registry scope; tokenization
  is longest-match-first** *(default)* — the dispatch key is `open` alone for value/marker recipes and
  **(`open`, `regionName`)** for region recipes: the region name is part of the key exactly as `</section>`'s
  name-echo is part of native close matching, so `{#each}` and `{#ctx}` (and `{% raw %}` beside `{% for %}`)
  co-exist by construction. Longest-match-first orders scanning: `{{{` wins over `{{` wins over `{` (how Mustache
  already distinguishes triple from double mustache); `DelimiterCollisionError` fires only on an *identical*
  dispatch key. **Quantifier (normative, not an impl note):** "live" ranges over the recipes of **one registry
  scope, after config resolution** — the app-level `customNodes` registry today (#2074 Fork 2: one registry over
  the delimiter surface), with the
  [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) nearest-wins
  chain resolved first, so an app that re-keys a platform-flavor recipe *supersedes* it (the flavor entry is no
  longer live) rather than colliding with it; a future scoped registry judges per scope, following the
  scoped-`customElements` trajectory. Observable contract: `{{{x}}}` parses as the `{{{` recipe, never as `{` +
  `{{x}}` + junk. One honesty note: exact dispatch-key equality deliberately does **not** detect semantic prefix
  capture across co-resident flavors (Svelte's `{` beside Handlebars' `{{`: `{{x}}` routes to `{{` by longest
  match, no error) — the same mechanism the within-flavor grammars require, so any predicate that flagged it would
  outlaw the sanctioned bundles.
- **(b) Prefix overlap is a collision · bare-`open` equality** — *Rejected (broken):* see the fork-existence line;
  both are disproven by the bundles' own grammars and #2074's ratified examples, not asserted.
- **(c) Bundle-scoped tokenizers (collision judged flavor-vs-flavor, one tokenizer per bundle)** — *Rejected:*
  re-partitions the keyspace by bundle and re-creates the collision undetected at the bundle boundary — #2074
  Fork 2 ratified *one* registry over the delimiter-keyed surface precisely so co-resident recipes compose in one
  keyspace; a per-flavor tokenizer is that monolith-vs-siblings question re-litigated per bundle.
- **(d) Priority/specificity resolution instead of an error** — *Rejected:* silent shadowing of a co-registered
  grammar is data loss the author never sees (the merge-not-shadow family of rulings); #2074 already ratified the
  *typed error* posture — this fork only supplies its predicate.
- **(e) Registration-order first-match (the shipped incumbent)** — *Rejected:* order-dependent (the same page
  parses differently by `define()` order) and collision-silent; longest-match is the order-independent,
  declarative form of the same disambiguation.

Today none of this exists: parsers run in registration order, first match wins
(`fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts:14-16`); the shipped opens `{{`/`[[`
(`fui:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts`,
`fui:blocks/parsers/text-node/double-square/DoubleSquareBracketParser.ts`) are disjoint so it has never mattered.
#2104 builds the error; this fork supplies its predicate (impl note: longest-match needs a single-pass
multi-recipe scanner — a rewrite of the per-parser `indexOf` loop, not a patch; that cost lives on #2104's `size`,
not here).

Skeptic: LANDS → amended, tokenization half retained — the attack decisively refuted bare-`open` exact-equality
(it fires on `{{#if}}` + `{{#each}}`, i.e. on every real bundle, by #2074's own region shape); fixed by keying
collision on the full dispatch key (`open`, + `regionName` for regions), which also snaps Fork 3's example back to
the parent's decomposition (whitespace-tolerant `{% raw %}` matching). Also landed: the two-branch framing had
untested third options (bundle-scoped tokenizers; priority resolution; the shipped registration-order incumbent) —
now named and rejected on merit — the "live" quantifier was misfiled as an impl note (now normative in (a),
including post-config-resolution liveness so a re-keyed platform default supersedes rather than throws), and the
cross-flavor prefix-capture blind spot is now stated honestly. Longest-match-first survived every attack tried
(Svelte `{` vs `{{` cross-flavor reroute has no correct semantics to betray; within a bundle maximal munch
reproduces each engine's own disambiguation).
Screen: clear — fresh-context agent (2026-07-02): fully observable (which registrations throw, what a page parses
to, supersede-vs-throw on re-key), with the one impl concern (scanner rewrite) correctly quarantined onto #2104;
branches diverge cost-free (silent shadowing = data loss; order-dependence = same page parsing differently).

## Fork 3 — the raw/verbatim escape-hatch grammar: a scan-suppression nature, per-bundle-declared

*Fork-existence:* a genuine either/or on the **normative** question — "the standard reserves one universal raw
construct every conforming engine MUST honor" and "no reserved token; each bundle declares its flavor's raw
construct" cannot coexist as one conformance rule (a mandated universal token *is* a keyspace reservation — the lone
entry Fork 1's law would otherwise forbid). The *config* variant of a universal construct — the platform-default
flavor shipping a raw recipe — is **not** the rival branch: it is expressible over (a)'s kernel (the composability
probe) and is absorbed into (a) as supported-by-default.

**Crux.** #2074 ratified *that* a raw/verbatim hatch is mandatory (Supported-by-default list); the open half is its
grammar. Survey: every engine spells its raw construct **in its own flavor's grammar** (`{% raw %}` for
`{%`-engines, `@verbatim` for Blade, `{{{{raw}}}}` for Handlebars, `v-pre`/`ngNonBindable` as attribute-keyed
skips); **no engine reserves a cross-flavor universal token** — raw-ness is everywhere a property of a *named
construct*, never of a universal escape (HTML agrees: RAWTEXT is a property of named regions like `<script>` —
cited for the named-region point only; RAWTEXT itself operates at the tokenizer, a stage earlier than recipes).
Model gap: the #2074 nature enum (`value` / `children:'inert'|'live'` / marker) cannot express "content is **not
scanned** for any recipe's open" — `'inert'` still means recipe-scannable template content. And because recipes run
post-HTML-parse, a raw region's payload may already *be* elements (Blade's `@verbatim <div>{{x}}</div>` keeps the
`<div>` a real element whose text shows literal `{{x}}`) — so raw semantics must be **scan-suppression over the
region's existing content**, never re-materialization to text.

- **(a) Extend the nature enum with `children: 'raw'` — a scan-suppression region: the region's content is excluded
  from all recipe scanning (delimiters inside are inert literal content), and the polyfill leaves the existing
  nodes untouched (text stays text, markup stays markup); each bundle declares its flavor's raw construct as an
  ordinary recipe using it** *(default)* — grammar-faithful (a Liquid author types `{% raw %}`, a Blade author
  `@verbatim` — the #2113 scorecard scores the real construct), reservation-free (Fork 1's law stays clean), and
  implementable at the real pipeline stage (the shipped scan-exclusion seam,
  `fui:plugs/webexpressions/CustomTextNodeParser.ts:57-63` `excludedElements`, is this semantics at element
  granularity — the region form generalizes it; an impl pointer, not part of the standard). A platform-default
  flavor MAY ship a raw recipe of its own (config content per
  [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default)) — supported
  by default, no reservation involved. **The default flavor's own mandatory hatch:** #2074 makes the hatch a
  conformance requirement of *every* delimiter system, including WE's shipped `{{`/`[[` flavor, which has no
  framework construct to copy — its concrete raw spelling is **flavor content, not standard grammar** (the
  mustache-family precedent `{{{{raw}}}}` is the in-grain candidate), named when #2113 scores the native grammar
  as bundle zero; a config value, so deferring it leaves no ratifiable residue here. Two scope notes: **(i)** a
  region's payload spanning already-parsed elements (open and close markers in different Text nodes) is the
  *general* region-scan concern every `children` recipe has (#2110's build turf), not a raw-specific gap;
  **(ii)** the enum extension ratifies *now* while the escape-prefix routes to evidence (below) on a principled
  asymmetry — the raw **region** is already a ratified mandatory requirement whose inexpressibility in the current
  enum is proven by the parent standard itself, while the prefix is merely *anticipated* and mandated by nothing.

  ```ts
  // Liquid bundle (#2115) — the flavor's own raw construct, an ordinary '{%' region recipe
  // (same open as the other {% %} statements; dispatched by regionName per Fork 2):
  customNodes.define(class Raw extends CustomNode {
    static open = '{%'; static close = '%}'                 // the open marker: '{% raw %}'
    static regionName = 'raw'; static regionClose = '{% endraw %}'
    static children = 'raw'                                  // NEW nature value: content unscanned
  })
  // Blade bundle (#2116) — keyword grammar, declared close (#2074 Fork 3: declared, never derived):
  customNodes.define(class Verbatim extends CustomNode {
    static open = '@verbatim'; static close = ''             // keyword open, no bracket to terminate
    static regionName = 'verbatim'; static regionClose = '@endverbatim'
    static children = 'raw'
  })
  ```
  ```html
  {% raw %}Hello {{ user }} — literal, no recipe fires{% endraw %}
  @verbatim <p>{{ this markup stays a real element }}</p> @endverbatim
  ```
- **(b) A normative universal raw construct (MUST) all conforming engines honor** — *Rejected (dominated):* buys no
  interop a flavor construct doesn't already deliver (any raw region already suppresses *every* co-resident recipe
  registry-wide — the suppression is global even though the spelling is flavor-local), breaks bundle fidelity (the
  #2113 scorecard would score a WE-invented token no framework ships), re-opens the reservation Fork 1 closes, and
  its entire value is expressible over (a)'s kernel as a platform-flavor recipe — a facade, so mandating it rules
  nothing.
- **(c) Character-level escape prefix as the sole mechanism (`\{{`)** — *Rejected as the sole mechanism, not as a
  construct:* prior art shows prefix-escapes *coexist* with raw regions (Handlebars `\{{` + `{{{{raw}}}}`, Blade
  `@{{` + `@verbatim`) — complementary, not rival; see the deferral note below.

**Deliberately routed to evidence, not guessed (the #2094 discipline):** the char-level escape *prefix* (`\{{`,
`@{{`, `<%%`, Svelte `{'{'}`) is an anticipated recipe-model gap — a prefix that suppresses the following open is
not expressible as a recipe today. Exactly like the `{{else}}`/`{:else}` mid-region-marker gap, it gets its decision
card **from the first confirming #2113 scorecard gap list** (#2114 Handlebars and #2116 Blade will surface it), not
from a guess here. This is a named out-of-scope with a filing mechanism, not an open residue.

Skeptic: LANDS → amended, per-bundle half retained — the attack refuted "materializes as literal Text" (unfaithful
to every engine — raw suppresses expression scanning, not element construction — and a #2074-rule-2 firewall breach:
a nature definition must not name a host; redefined as scan-suppression, polyfill leaves nodes as parsed) and the
whole-string-open example (`open='{% raw %}'` is whitespace-brittle and off #2074's region shape; corrected to
`open='{%', regionName='raw'`, which forced Fork 2's dispatch-key fix), and landed three more: (b)'s config variant
composes over (a)'s kernel (fork rescoped to the *normative* mandate question; flavor-default raw recipe absorbed
as supported-by-default), the default flavor's own mandatory hatch was unaddressed (now named: flavor content,
`{{{{raw}}}}`-style candidate, delivered at #2113 bundle zero), and the ratify-now-vs-route-to-evidence asymmetry
against the escape prefix needed its principle stated (mandated-and-proven gap vs anticipated gap — now in (a)).
The (b) rejection's old "raw regions never interoperate across flavors" premise was also refuted (suppression is
registry-global) and replaced. Survived: per-bundle declaration itself (no engine ships a universal token), and
`children:'raw'`'s necessity (text-only `value`-nature workarounds trim whitespace, overload a ratified semantic,
and can't span elements; `'inert'` still means scannable).
Screen: clear — fresh-context agent (2026-07-02): the ruling fixes what authors write and what pages do (the FUI
`excludedElements` pointer is expressly labeled impl-only); the closest prio call — (b)'s config variant collapsing
into (a) — was judged pre-empted by the fork's rescope to the normative-MUST question, where a genuine merit
difference (lock-in, precedent, grammar fidelity) survives with cost stripped; the deferred escape-prefix is
honestly routed to evidence, not a smuggled timing gate. The standing-test paragraph was screened too: passes
(each fork retains a real merit question with timing/substrate/demand stripped; the urgency clause is quarantined
under Context as ordering).

## Not decisions (supported / settled by default)

- **Delimiter override — the conformance floor is settled by enumeration, the value is config.** #2074 ratified
  "escape hatch + delimiter-override" as a mandatory conformance requirement; its only coherent shape is
  **out-of-band re-declaration** — an app re-keys a recipe's grammar at registration/config time (the exact shape
  of Vue's `delimiters` app option; #2119 notes the parity), governed by
  [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) (Q6 fixes the
  platform-default flavor to the shipped `{{`/`[[` grammars; a custom grammar is the app's opt-in). The
  override↔collision interaction is that anchor's own mechanism, not a new rule: `extends` is an ordered
  **nearest-wins** chain, so the app's value **supersedes** the flavor's recipe *before* Fork 2's predicate
  quantifies "live" — re-keying never throws (encoded in Fork 2 (a)'s quantifier). The only in-band alternative in
  the field, Mustache's set-delimiter tag `{{=<% %>=}}`, is **not expressible in the recipe model** (it mutates
  the scanner's live token set mid-stream; a recipe has static grammar + an `upgrade()`) — a model gap of the same
  species as the escape prefix, routed the same way (the #2114 Mustache gap list is where it surfaces, if ever),
  and deliberately **not required**. So there is no live rival and nothing to ratify.
- **Turf: #1992 is a different surface** — the configurable *directive-separator* mechanism governs
  attribute-**name** separators (`on:*`, `nav:*`), not paired delimiters; same principle-family
  ([attribute-name-colon-namespacing](docs/agent/platform-decisions.md#attribute-name-colon-namespacing)), disjoint
  turf. Cited to prevent overlap, not as authority.

## Context

- **Timing (ordering, not a gate):** nothing is blocked on this ruling today — `DelimiterCollisionError` is
  normative and buildable without it (#2104 encodes the error; Fork 2 sharpens its predicate). Urgency arrives with
  the first cross-bundle co-residence or the #2113 scorecard's first collision evidence. That is backlog priority,
  handled at selection time.
- **Sibling reconciliation (2026-07-02):** the #2094 slice-out (#2113–#2119) *reshaped* this item — the bundles'
  sanctioned grammars are hard evidence for Fork 1 (a) and Fork 2 (a) (any law that outlaws `{{`, prefix overlap,
  or shared-sigil regions contradicts already-filed work), and #2115/#2116 name the raw constructs Fork 3 (a) must
  carry. #1989 remains open (proposed ruling awaiting ratification post-#2074); this item takes #1986 rule 5
  (ratified) as the disjointness authority and leaves both the sigil choice *and* the comment-vs-text surface
  choice with #1989 — Fork 1 (a)(ii)'s mint-on-ratification clause is how either outcome composes with this law.
- **Statute-overlap (reconcile at codification):** one anchor needs an **amendment-grade** reconciliation, not a
  friction-free compose —
  [registry-name-guard-namespace](docs/agent/platform-decisions.md#registry-name-guard-namespace) rule 2 exempts
  "parser / text-node registry keys" from guarding, written when those keys were *names* (`mustache`, `polymer`)
  that never touch a host surface; #2074 re-keyed recipes by the delimiter grammar itself, whose tokenizer tag-open
  slice **is** host-shared, so Fork 1 (a) *instantiates the anchor's own test* (guard the shared namespace) while
  **amending rule 2's exemption** for grammar-keyed registries — cite the lineage, don't silently override. Also
  extends the [custom-node-recipes](docs/agent/block-standard.md#custom-node-recipes) spine (Fork 3 (a) adds a
  `children` value — an enum extension, reversible with lineage; Fork 2 supplies the `DelimiterCollisionError`
  predicate the spine deferred here — reconciling the spine's two same-`{#` example rows via the dispatch key).
- Lineage: #2074 (parent frame, ratified 2026-07-01) → this; siblings #2094/#2113–#2119 (bundles), #2104 (error
  build), #1989 (residue sigils), #1992 (separator mechanism, disjoint turf). Research:
  [`reserved-delimiter-family-policy`](/research/reserved-delimiter-family-policy/);
  report `we:reports/2026-07-02-reserved-delimiter-policy-prior-art.md`.
