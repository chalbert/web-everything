---
kind: decision
status: resolved
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#attribute-name-colon-namespacing"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-we-naming-convention.md
tags: [naming, attribute-naming, webdirectives, block-standard, native-first, customattribute, decision]
---

# Attribute-naming convention — review colon namespacing (view:if) vs native-shaped alternatives; audit existing block/behavior/directive attr names

**Prepared, ready to ratify.** The cross-cutting naming review #1983/#1986 triggered: WE spells author markers in
several conventions (~30 colon sites, ~8 bare-hyphen, `data-*`, bare, and `type=` bare values), and #1983 moved
*directives* off `view:if` colon onto `<template type=>` on "colons are XML-only" grounds — so the same question
now sits over **every** author-name surface. Grounded in a full audit of both repos + a prior-art survey
published as the [`we-attribute-naming-convention`](/research/we-attribute-naming-convention/) topic (report via
`relatedReport`). Decided **per surface** — they do not all want the same answer, which is itself the ratified
discipline (`we:docs/agent/platform-decisions.md:672` — *separators track what each namespace permits, not
uniformity*).

## Grounding digest

The colon convention is **already ratified** — not a style aside: `we:docs/agent/platform-decisions.md:672-673`
(the `registry-name-guard` ruling, derived from the native-first baseline) states *"the separator set tracks what
each namespace permits (not uniformity): tags are hyphen-only … **attributes accept hyphen or colon (`xml:lang`,
`nav:list`)**"* — naming a WE colon attribute as legitimate. Reinforced by a **machine-checked** sibling: custom
intent IDs are `owner:intent` (single colon, RFC 6648 "namespace by ownership not status",
`we:docs/agent/platform-decisions.md:1516`, #1913), and the comment grammar **mandates** colon `ns:name`
(`fui:plugs/webdirectives/CustomCommentParser.ts:34`). (`we:docs/agent/conventions.md:10-14` also records colon,
but as an *un-ratified* style line — the ratifying authority is `:672`, not the style guide.) **The
counter-pressure:** the *platform's* author-attribute convention is **hyphen** — `data-*`/`aria-*`,
custom-**element** names must contain a hyphen (collision-safety), and the live proposals
([WICG/webcomponents#1029](https://github.com/WICG/webcomponents/issues/1029),
[whatwg/html#2271](https://github.com/whatwg/html/issues/2271)) propose author **attributes** must contain a
hyphen (floating an `enh-*` reserved prefix) — **not** colon; and a colon on an HTML attribute spec-*means* "XML
namespace" (`xml:lang`, `xlink:href`). Colon's defence: heavy **framework** precedent (Svelte's whole surface —
`on:click`/`bind:value`/`use:action`), and it is **collision-safe by construction** (native HTML attribute names
never contain a colon).

## Audit — every WE author name, bucketed (the prep's main deliverable)

| Surface | Spelling today | Representative names | `file:line` | Count |
|---|---|---|---|---|
| **Behavior/event attribute NAMES** | **colon** | `view:if/switch/show`, `nav:list/section`, `route:guard/loader/outlet`, `grid:cell-edit`, `on:click` (+~18 event variants) | `fui:blocks/view/registerViewDirectives.ts:14-16`, `fui:blocks/router/types.ts:318-322`, `fui:blocks/attributes/on-event/OnEventAttribute.ts:277-295` | ~30 |
| Behavior attribute NAMES | bare-hyphen (no `data-`) | `type-ahead`, `droplist-anchor/anchored/selection`, `focus-delegation`, `navigation-guard` | `fui:blocks/type-ahead/registerTypeAhead.ts:16`, `fui:blocks/droplist/registerDroplistMenu.ts:52-55` | ~8 |
| Author data attributes | `data-*` hyphen | `data-bind`, `data-track`, `data-portal`, `data-url-sync` | `fui:plugs/webanalytics/TrackAttribute.ts:25` | ~6 |
| Native-aligned attrs / structural sub-attrs | bare | `multiple`, `active`, `open`, `items`, `key`, `as`, `case`, `default` | `we:src/_data/blocks/`, `fui:blocks/for-each/ForEachBehavior.ts:99` | ~12 |
| Comment-directive NAMES | colon (grammar-locked) | `resource:loader`, `snippet:define/render`, `control:for-each`, `portal:TARGET` | `fui:plugs/webdirectives/CustomCommentParser.ts:34`, `fui:blocks/renderers/jsx/htmlToJsx.ts:34` | ~6 |
| Directive form / `type=` VALUES | bare value | `type="if"/"switch"/"injector"/"registry"/"context"` | `we:docs/agent/block-standard.md:375`, `fui:plugs/webinjectors/declarativeInjector.ts:107` | ~6 |
| Injector domain identity | `@`-prefixed *value* | `@date/core` (a domain string, never an attribute name) | `fui:plugs/webinjectors/declarativeInjector.ts:47` | 1 surface |
| Customized built-in (**retiring**) | `is="…"` bare value | `is="for-each"`, `is="snippet"` | `fui:blocks/renderers/jsx/htmlToJsx.ts:11` (→ retired #1983/#1986) | — |

**Divergence the audit surfaces (conformance, not forks):** the bare-hyphen behavior attrs (`type-ahead`,
`droplist-*`, `focus-delegation`) sit in **no** reserved prefix, so they are the *actually* collision-unsafe
names (not the colon ones); and a **double-colon** outlier `route:guard:leave`
(`fui:blocks/router/types.ts:319`) has **no precedent** anywhere (native, XML, or framework). These are cleanup
items the ruling triggers, not separate decisions.

## Axis-framing

The review is **per surface** — and `we:docs/agent/platform-decisions.md:672` already rules that the right
discipline is *per-namespace, not uniform*, so "one convention everywhere" is itself the wrong frame. Most
surfaces are settled. Native-aligned attributes stay **bare** (`multiple`) + `data-*` for author data; the
**directive form** is `type=` and **core `type=` values are bare** (`if`) — settled by #1983 (native enum idiom,
`<script type="module">`); **comment-directive names** keep colon `ns:name` (grammar-locked; a comment can
*never* collide with a native attribute, so native-shaped pressure doesn't reach it). That leaves two real calls:
**Fork 1** — the **behavior/event attribute-name** convention (the ~30 colon sites): reaffirm colon or migrate to
the native-shaped hyphen; and **Fork 2** — third-party **`type=` value** namespacing (the axis #1986 delegated
here). The tension on Fork 1 is real — native-first + the live proposals pull toward hyphen — but it is
**adjudicated**: `:672` already ruled colon a permitted attribute separator, and #1983 scoped its colon-rejection
to the directive *discriminator*, explicitly carving name-/value-namespacing **to #1987**
(`we:docs/agent/block-standard.md:399-401`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — behavior/event attribute-name convention | **keep colon** (`on:click`, `layout:grid`) — per `we:docs/agent/platform-decisions.md:672` (+ F5 honesty caveat) | migrate to native hyphen-prefix (`enh-*`/`we-*` reserved) | med-high |
| **Fork 2** — third-party `type=` value namespacing | **`owner-kind` hyphen** (`acme-card`; bare reserved for core) — matches the native `type=`/custom-element idiom | colon `acme:card` · reverse-DNS | high |

*No forced invariant sits above these — the directive-form/`is=` retirement is #1983's, not re-opened here.*

> **Adjacent, not in scope here:** the **directive applied-residue / region-annotation marker grammar** (unify
> today's `:start`/`:end` vs `/`-close split into one reserved, matcher-excluded sigil) — raised by #1986's family
> invariant — is a sibling token-grammar question but a *distinct* surface from the *authoring* names/values this
> review buckets. Tracked separately as **#1989** (blocked by #1986, resolved); cross-referenced so the reserved
> grammars stay consistent when both ratify.

## Settled by precedent (not forks)

- **Native-aligned attributes → bare lowercase** (`multiple`, `active`, `open`) and **author data → `data-*`**
  (`we:docs/agent/conventions.md:9,14`). The native surface is preserved as-is; this review does not touch it.
- **Directive form → `type=`; core `type=` values → bare** (`type="if"`) — settled #1983 (native `type` enum
  idiom; `we:docs/agent/block-standard.md:375`). Bare is reserved for **core**; third-party values are Fork 2.
- **Comment-directive names → colon `ns:name`** — grammar-locked (`fui:plugs/webdirectives/CustomCommentParser.ts:34`)
  and on a surface with **no native-attribute collision risk** (inside a comment), so the native-shaped pressure
  is weakest here; reaffirm.
- **Event attribute *values* → bare Action IDs** (`on:click="save"`) — `we:docs/agent/conventions.md:12`.

## Fork 1 — behavior/event attribute-name convention: keep colon vs migrate to hyphen

**✅ RATIFIED 2026-06-30 → keep colon, with amended framing.** Operationally: colon stays for the ~30 behavior/event
attribute names (`view:if`, `on:click`, `nav:list`); **no migration**. The red-team (throwaway skeptic, prompted
only to refute) landed a real hit on **propose-in-platform-shape** — for an author-*extension* attribute the
platform's closest convention is `data-*`/`aria-*` (hyphen) and the only *proposed* author-attribute standard is
`enh-*` (hyphen), so presenting colon as *the native-shaped standard proposal* is the wrong claim. The hit was
**absorbed by amendment, not overturn** (the skeptic itself concluded "don't-chase-an-unshipped-draft → defer, not
migrate", and `:672` cites `nav:list`, not only `xml:lang`). The amended framing the codification must carry:

1. Colon is WE's **current collision-safe internal authoring spelling** for namespaced directives — **not** claimed
   as the platform-shaped standard proposal.
2. The closest *proposed* author-attribute standard is **hyphen** (`enh-*`, [WICG#1029](https://github.com/WICG/webcomponents/issues/1029));
   WE **declines to chase it while unshipped** (don't-chase-a-draft) — a deliberate hold, not a claim colon is more native.
3. The **app-configurable separator** (posture settled here; mechanism deferred to a follow-up) is how WE reconciles
   to the eventual ratified shape — the bridge between "colon today" and whatever the WG ratifies. **Never `we-*`**
   (a pure vendor prefix); if hyphen ever wins it is `enh-*`.

**Fork-existence:** a genuine either/or — both coherent, cannot both be the catalog convention. The excluded
branch is *not* broken (so it's a weigh, not a reaffirmation): native-first + #1983's "colons are XML-only"
language give the hyphen branch real force.

Crux: the ~30 colon attribute names (`fui:blocks/view/registerViewDirectives.ts:14-16`, etc.) are the most-used
WE author marker; `we:docs/agent/platform-decisions.md:672` already permits a colon attribute separator
(`nav:list`); but the platform's *own* author-attribute convention is hyphen.

- **(a) Keep colon** (`on:click`, `layout:grid`, `nav:list`) *(recommended default, med-high)*:
  - **ratified, not just style** — the authority is `we:docs/agent/platform-decisions.md:672-673` (*attributes
    accept hyphen or colon; `nav:list`*), a ruling derived from the native-first baseline, **plus** #1913's
    machine-checked `owner:intent` colon idiom (`:1516`). Cite `:672`, **not** the un-ratified
    `we:docs/agent/conventions.md:10` — the latter is a style line; the decider should rest the rule on the
    statute.
  - **collision-safe by construction** — a colon attribute can *never* clash with a native attribute (HTML
    attribute names never contain a colon). The audit's bare-hyphen attrs (`for-each`, `type-ahead`) are the
    *un*-safe ones — no reserved prefix; the standards-shaped hyphen form done *properly* needs a reserved prefix
    (`enh-on-click` / `we-on-click`, per [WICG#1029](https://github.com/WICG/webcomponents/issues/1029)) — more
    verbose than colon for the *same* guarantee.
  - **#1983 does not indict it** — #1983 ruled the directive *kind* discriminator is `type=` (an "is-a" idiom)
    and explicitly carved name-namespacing **out to #1987** (`we:docs/agent/block-standard.md:399-401`); `:672`
    rules uniformity the wrong principle. So "colon must die everywhere for #1983-consistency" is refuted by
    #1983's own scoping.
  - **Amendment folded (the one place the skeptic landed):** a colon on an HTML attribute *spec-means* an XML
    namespace prefix (`xml:lang` → prefix `xml`). The codification **must state the honesty caveat**: WE's `:`
    is the `:672`/#1913 **ownership-colon idiom** (collision-safe-by-construction), **not** an XML-namespace
    declaration; WE declines the reserved-prefix hyphen form as verbose while #1029/#2271 are **unshipped**.
- **(b) Migrate to native hyphen-prefix** (`enh-*` reserved — **never `we-*`**) — *Rejected (the live alternative,
  fairly weighed):* aligns with native-first's *letter* and the only proposed-standard author-attribute rule, and
  removes the XML-namespace semantic-mismatch — but the proposals are **unshipped**, the proper form is more
  verbose, colon already carries the *same* collision guarantee, and `:672` has ratified colon as permitted. The
  benefit is matching an unshipped proposal; the cost is a ~30-site migration. Not worth overturning a statute.
  **If hyphen ever wins, the prefix must be `enh-*` (the actual [WICG#1029](https://github.com/WICG/webcomponents/issues/1029)
  floated reserved prefix), not `we-*`:** a `we-*` prefix is a pure *vendor* prefix — it bakes "this is ours, not
  the platform's" into the author surface, the exact opposite of proposing-in-platform-shape. The colon's edge is
  that it sidesteps the vendor prefix entirely while staying collision-safe.

`Skeptic: SURVIVES-WITH-AMENDMENT — the prep skeptic attacked keep-colon hardest on native-first/#1983-consistency
("colon must die everywhere"). It REFUTED that attack via citation: `we:docs/agent/platform-decisions.md:672-673`
ratifies colon as a permitted attribute separator (`nav:list`) and rules uniformity wrong, and #1983 scoped its
colon-rejection to the directive discriminator, carving names to #1987 (`we:docs/agent/block-standard.md:399-401`).
The one merit hit that landed — colon spec-means XML-namespace (F5) — is folded as the honesty caveat above, and
the citation re-based from the un-ratified `we:docs/agent/conventions.md:10` to `:672`. Default held.`

**Shipped-form ≠ final spelling (the deeper "why keep colon").** A ratified standard earns *bare* names by the act
of ratification — ratifying *is* claiming the namespace. WE, pre-ratification, cannot claim it, so it **must**
disambiguate (colon or reserved-hyphen-prefix); and whatever form WE ships is **never** the final spelling anyway
(a WG would pick the canonical bytes — no `we-`, likely no colon). So "most standard-shaped" can't mean "guess the
final spelling"; it means: ship the form that's collision-safe today, least verbose, and encodes the **durable
semantics** (a namespaced directive) — leaving the *transitional* collision-marker out of the design. Colon encodes
the durable namespacing idiom; a reserved-hyphen prefix encodes a transitional collision-marker. That is the
sharper rationale: don't bake a provisional vendor/collision artifact into a proposed-standard's shape.

**Configurability = the objector escape hatch + migration capability, not an author knob (posture settled here;
mechanism deferred).** Ship **one** opinionated default (colon) — a single teachable convention keeps docs,
examples, the comment parser, and matchers from forking. The answer to "colons are awful" is *not* to re-litigate
the default but to point at deep config: the registry already mediates name→behavior binding, so the separator is
swappable per-app via settings. This is the same capability that makes a future colon→ratified-spelling swap cheap
and mechanical (the migration de-risker). The **stance** is ratified here (default colon; separator intended to be
app-configurable as the escape hatch); the **config mechanism** itself is out of scope — spawned as a follow-up
build item.

## Fork 2 — third-party `type=` value namespacing

**✅ RATIFIED 2026-06-30 → `owner-kind` hyphen** (`type="acme-card"`; bare `type="if"` reserved for core). Red-team
(strongest alt = colon `acme:card`, "match Fork 1's colon for consistency") **failed**: `:672` rules separators
track per-namespace permission not uniformity, and a `type=` *value* surface has native precedent bare/slash-MIME,
never colon — so matching the surface beats matching the sibling fork; `acme-card` is the native custom-element
idiom and preserves RFC 6648 ownership-not-status without #1983's no-native-analog defect.

**Fork-existence:** a genuine either/or on the third-party value spelling (the axis #1986 delegated). Core values
are bare (settled); the only question is how a *third-party* kind is spelled so it can't collide with core or a
future native `type` value.

- **(a) `owner-kind` hyphen** (`type="acme-card"`; bare `type="if"` reserved for core) *(recommended default,
  high — flipped from an initial colon lean by the prep skeptic)*: `type=` is the `<script type="module">` /
  `<input type="checkbox">` **is-a** idiom (settled #1983, `we:docs/agent/block-standard.md:382-385`), and native
  `type` values are **never colon-namespaced** — they are bare keywords or slash-MIME (`text/css`). A
  hyphen-prefixed value reads as a normal keyword token and matches the custom-element `acme-card` idiom the
  platform *requires*. It still encodes namespace-by-ownership (RFC 6648): owner-prefixed for third-party, bare
  for core, promotion = drop the prefix — the #1913 *principle* without the colon-in-`type=` defect. Satisfies
  the #1986 name-guard (the registry guards its keyspace; the grammar is `[owner]-[kind]`).
- **(b) colon `acme:card`** — *Rejected:* a colon **inside a `type=` value** has **zero native precedent** and
  reopens the exact "no native analog" defect #1983 spent its ruling escaping; codifying it into
  `we:docs/agent/block-standard.md` would contradict the `type=`-is-a section directly above. #1913's
  `owner:intent` colon is an **intent-ID** ruling (`:1516`, fenced to the JSON keyspace) — it does **not** reach
  HTML `type=` values, so citing it here is scope-creep.
- **(c) reverse-DNS `com.acme.card`** — *Rejected:* verbose, no WE precedent, dots carry their own DOM meaning.

`Skeptic: REFUTED the colon default → flipped to hyphen `acme-card`. Classification: a `type=` value is the
`<script type>`/`<input type>` is-a idiom (#1983), whose native values are bare/slash-MIME, never colon — so
colon-in-value reopens #1983's no-native-analog defect and would contradict `we:docs/agent/block-standard.md:382-385`.
#1913's `owner:intent` colon is an intent-ID JSON-key ruling (`:1516`), out of scope for `type=` values. Hyphen
`owner-kind` preserves RFC 6648 ownership-not-status without the defect, matching the custom-element `acme-card`
idiom.`

## Conformance cleanup (triggered by the ruling — not forks)

**Spawned at resolve:** the impl cleanup below → **#1991** (task, blocked by #1987); the deferred configurable-
separator mechanism → **#1992** (story, blocked by #1987).

- **Bare-hyphen behavior attrs** (`type-ahead`, `droplist-anchor/anchored/selection`, `focus-delegation`,
  `fui:blocks/droplist/registerDroplistMenu.ts:52-55`) are collision-unsafe under Fork 1(a)'s rationale (no
  reserved prefix); migrate to the colon namespace (`droplist:anchor`). A follow-up build item.
- **Double-colon outlier** `route:guard:leave` (`fui:blocks/router/types.ts:319`) — no precedent on any
  convention; normalize to single-colon (`route:guard-leave`).

## Statute-overlap (reconciled here)

#1987 codifies into `we:docs/agent/conventions.md` (the naming authority, turning its style line into a ratified
rule) and cross-refs `we:docs/agent/block-standard.md` / `we:docs/agent/platform-decisions.md`. Anchors:

- **`registry-name-guard` separator rule** (`we:docs/agent/platform-decisions.md:672-673`) — the **ratifying
  authority** for Fork 1(a): *attributes accept hyphen or colon (`nav:list`); separators track per-namespace
  permission, not uniformity.* #1987 reaffirms + sharpens (the F5 honesty caveat); composes.
- **#1913 `custom-intents-namespace-by-ownership`** (`we:docs/agent/platform-decisions.md:1516`) — supplies the
  **ownership-not-status (RFC 6648)** *principle* both forks honour, but its **colon** is scoped to **intent
  IDs** (a JSON keyspace), so it does **not** license colon on HTML attribute names *or* `type=` values — it is
  supporting house-idiom evidence, not the dispositive citation. Fork 2 keeps its *principle* (owner-prefix,
  promotion drops it) while using hyphen for the `type=`-value surface.
- **#1983 directive-form** (`we:docs/agent/block-standard.md:382-401`) — `type=` is the bare/slash is-a idiom and
  #1983 carved value-namespacing to #1987; Fork 2(a) hyphen *composes*, Fork 2(b) colon would *collide*.
- **#1986 name-guard** — Fork 2 supplies the value-keyspace guard grammar (`[owner]-[kind]`) #1986 required.

## Relationships

- **Settles** the `type=`-value namespacing #1986 delegated here (Fork 2) and the `view:`-vs-`control:` namespace
  concern #1983 deferred (Fork 1 + comment-name reaffirmation).
- **Codifies into** `we:docs/agent/conventions.md` (naming authority), resting the rule on
  `we:docs/agent/platform-decisions.md:672`.
- Surfaced from the #1983/#1986 prep discussion (2026-06-30); see `we:reports/2026-06-30-directive-authoring-forms.md`,
  `we:reports/2026-06-30-typed-inert-container-registries.md`, and the new `we:reports/2026-06-30-we-naming-convention.md`.
