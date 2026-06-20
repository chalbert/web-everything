---
kind: decision
size: 2
parent: "854"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
preparedDate: "2026-06-17"
relatedReport: reports/2026-06-17-854-scope-declarative-scoped-registration-spelling.md
relatedProject: webcomponents
tags: [webcomponents, component, declarative, scoped-registry, naming]
crossRef: { url: /blocks/component/, label: Component block }
---

# Attribute name for consumer-side scoped-registry association (`scope=` is overloaded — `registry=` vs alternatives)

Carved from [#854](/backlog/854-scope-declarative-scoped-registration-spelling-on-component/), which is
settling that scoped registration lives in a **runtime declared-registry + association + binding-behavior**
model (a `<script type="registry">` declaration the consumer binds by reference, mirroring the shipped
`<script type="injector">` DSL). #854 settles the **model**; #900 settles only the **spelling of the
association attribute** the consumer carries to bind a declared registry. Working name `scope=`. This is a
deliberately low-stakes naming call given its own ratification so #854's model isn't held hostage to a
bikeshed.

## Grounding digest

**Tree (verified this prep):**
- **The shipped injector DSL already chose this exact attribute and named it after the script type.**
  [`we:declarativeInjector.ts:38`](../plugs/webinjectors/declarativeInjector.ts#L38) —
  `export const INJECTOR_ASSOC_ATTR = 'injector'` — and the script type
  ([`:35`](../plugs/webinjectors/declarativeInjector.ts#L35)) is `INJECTOR_SCRIPT_TYPE = 'injector'`. The
  association attribute **equals** the `<script type="…">` token: `<script type="injector" id="x">` ↔
  `<el injector="x">`. The id→object index is `byId`
  ([`:60`](../plugs/webinjectors/declarativeInjector.ts#L60)), resolved as a *local DOM IDREF*
  (`result.byId.get(assoc)`), not a global namespace. Registries are the structurally identical machine
  (#854's "the `webinjectors` DSL already solved the parallel problem"), so the consistent analog is a
  `<script type="registry">` declaration ↔ a **`registry="id"`** association attribute.
- **`scope` is already a live, differently-meaning attribute in this very tree** — so reusing it for
  registry association is a *collision*, not just a connotation:
  - native `<th scope="col|row|rowgroup">` — emitted by the data-table renderer
    ([`we:renderDataTable.ts:398`](../blocks/renderers/data-table/renderDataTable.ts#L398)).
  - WE's own `scope="cross-list"` reorder-group marker
    ([`we:renderCrossListReorder.ts:435`](../blocks/renderers/reorderable-list/renderCrossListReorder.ts#L435)).
- **The block page pre-commits to the contested `scope` spelling** —
  [`we:component.njk:105`](../src/_includes/block-descriptions/component.njk#L105) describes a
  "Tier-2 `scope` attribute … global by default." A presumption to reconcile at ratify time (same caveat
  #854 already flags).
- **#854 re-homes registry-scope OFF `<component>`** (a `<component>` is a build-time transform, gone by
  runtime; a scoped registry is inherently a runtime object). So the **consumer** that carries this
  attribute is a real runtime element (or the dom-less registration declaration), **not** `<component>`.
  This is why #900 is framed "consumer-side," not "component-side."

**Prior art (already surveyed for #854 — this is the same ground, no new web survey needed; full
findings in [the related report](../reports/2026-06-17-854-scope-declarative-scoped-registration-spelling.md)
and research topic [`scoped-registry-declarative-spelling`](/research/#scoped-registry-declarative-spelling)):**
- **Native IDREF-association attributes are bare nouns, never verb-prefixed:** `for`, `form`, `list`,
  `headers`, `popovertarget`, `aria-labelledby`. None is `use-*`/`bind-*`. The platform idiom for "this
  element associates with that one by id" is a single noun naming *what is referenced*.
- **The native scoped-registry option is literally named `customElementRegistry`** (the `attachShadow`
  option; **not** `scope`, **not** `registry` alone). The platform's own word for the referenced thing is
  *registry*, reinforcing a registry-noun spelling over `scope`.
- **No library or spec spells this concern `scope`:** `@open-wc/scoped-elements`, Lit
  `@lit-labs/scoped-registry-mixin`, and the `@webcomponents` polyfill all reach the **registry object**
  through the host class; `scope` as a markup token appears nowhere in the scoped-registry prior art.

## Axis-framing

There is exactly **one** axis here: the **token** the consumer writes to bind a declared registry. It is a
pure naming/spelling choice over an association attribute whose *mechanism* (#854: local IDREF and/or the
`{{ expr }}` object form) and *placement* (runtime consumer / dom-less registration declaration, not
`<component>`) are settled elsewhere. The token is **shared across #854's E (`{{ expr }}` object) and F
(local IDREF) forms** — both write the same attribute, one carrying an id string, the other an expression
— so #900's answer is robust to however #854 lands E vs F vs both. The deciding criteria are
**consistency** with the already-shipped `injector=` precedent (`INJECTOR_ASSOC_ATTR` = the script type)
and **native idiom** (bare-noun IDREF attrs; the platform's own word *registry*). Both criteria point the
same way and **reverse the item's working title**: `scope=` is the branch they *exclude* — it collides with
three live meanings (CSS `@scope`, JS/lexical scope, and the native `<th scope>` / WE `scope="cross-list"`
attributes already in this tree), reintroducing the overload the carve exists to remove. The native-aligned,
precedent-consistent spelling is **`registry="<id>"`** (mirroring `<script type="registry">` ↔
`registry="id"`, exactly as `<script type="injector">` ↔ `injector="id"`).

## Recommended path at a glance

| Fork | Decision | Recommended default | Confidence | The residual is… |
| --- | --- | --- | --- | --- |
| 1 | Token for the consumer-side scoped-registry association attribute | **B — `registry="<id>"`** (analog of `injector="id"`; attr = the `<script type="registry">` type) | ~85% | whether a future reader confuses `registry="id"` (*associate with* a registry) with "*is* a registry" — a `for`-style mild ambiguity all IDREF attrs carry; if that bites, a verb form (`use-registry=`) is the fallback, but it breaks the injector-DSL symmetry |

**Supported by default (not forks — no excluded branch):**
- **Whatever token Fork 1 picks is used everywhere the same concern appears.** If #854 ever adds a
  component-side sugar or any other directive that names a registry, it reuses the Fork-1 token verbatim —
  you would never deliberately spell the *same* concept two different ways, so there is no second fork
  here (the original item's "(if a component-side sugar is added) the desugaring attribute" concern). Given
  #854 re-homes scope **off** `<component>`, a component-side sugar is currently *off*; this rule just
  guarantees consistency if it ever returns.
- **The declaration is `<script type="registry">`**, matching the attribute and the
  `<script type="injector">` precedent — a mechanical consequence of choosing the `registry` token, not a
  separate decision.
- **The id is a local DOM IDREF** (document-scoped, collision-safe, resolved via a `byId`-style index),
  exactly like `injector=` — settled by #854's model, not re-litigated here.

## Fork 1 — Token for the consumer-side scoped-registry association attribute

**Fork-existence justification:** a single canonical attribute token must ship; the spellings are
mutually exclusive (you cannot have two canonical names for one association), and the working-name branch
`scope=` is positively *excluded* — it collides with three live meanings already in this tree (native
`<th scope>` and WE `scope="cross-list"`), plus CSS `@scope` and JS scope, reintroducing the overload the
carve exists to remove. Genuine "cannot-coexist" naming fork.

| Option | Spelling | For | Against |
| --- | --- | --- | --- |
| A | `scope="<id>"` (the working name) | Matches the pre-committed [`we:component.njk:105`](../src/_includes/block-descriptions/component.njk#L105) wording; short. | **Collides** with native `<th scope>` ([`we:renderDataTable.ts:398`](../blocks/renderers/data-table/renderDataTable.ts#L398)) and WE's own `scope="cross-list"` ([`we:renderCrossListReorder.ts:435`](../blocks/renderers/reorderable-list/renderCrossListReorder.ts#L435)), plus CSS `@scope`/JS scope. Names the *concept fused by the old framing* (#854 split consumption vs placement) — the very ambiguity the carve removes. Matches no scoped-registry prior art. |
| **B — recommended** | **`registry="<id>"`** | **Exact analog of the shipped `injector="id"` (`INJECTOR_ASSOC_ATTR` at [`we:declarativeInjector.ts:38`](../plugs/webinjectors/declarativeInjector.ts#L38)); attr = the `<script type="registry">` token. Bare-noun IDREF idiom (`for`/`list`/`form`/`headers`). Uses the platform's own word (`customElementRegistry`). Zero overload.** | **Mild `for`-style ambiguity: "associate-with-a-registry" vs "is-a-registry" — shared by every IDREF attribute and resolved by context (it sits on a *consumer*, not a declaration).** |
| C | `use-registry="<id>"` | Verb prefix disambiguates "consume" from "declare"; reads as an action. | **No native precedent** — platform IDREF attrs are bare nouns, never `use-*`/`bind-*`. **Breaks symmetry** with `injector=` (the strongest consistency signal); WE would carry one bare-noun association (`injector`) and one verb-prefixed (`use-registry`) for the same machine. |
| D | other (`registryref=`, `defines-in=`, `register-into=`, `for-registry=`) | Each disambiguates a niche reading (placement vs consumption). | All either invent a non-idiomatic compound or re-encode the consumption-vs-placement split that #854 already located in the *declaration*, not the association attribute. None matches the injector precedent. |

**Recommended default: B — `registry="<id>"`.** Two independent criteria converge on it: (1) **consistency** —
WE already shipped `injector="id"` keyed to `<script type="injector">`, and registries are the structurally
identical subtree-scoped, `extends`-composed, shadow-bounded machine, so the parallel association *should*
read identically; (2) **native idiom** — bare-noun IDREF attributes (`for`/`list`/`form`/`headers`/
`popovertarget`) are the platform pattern, and *registry* is the platform's own word for the referenced
object (`attachShadow({ customElementRegistry })`). `scope=` (A) is excluded on collision; `use-registry=`
(C) is the fallback only if the mild `for`-style "associate vs is" ambiguity proves to bite in review — but
it costs the injector-DSL symmetry, which is the higher-value invariant. Confidence ~85%; the residual is
purely whether reviewers find `registry=` ambiguous enough to pay the symmetry break, which the
`injector=` precedent (live, unambiguous in practice) suggests they will not.

> **Red-team note for the deciding agent.** The attack on B: "`registry="x"` reads as *this element is
> registry x*, not *this binds to registry x*." Defence: every native IDREF attr carries the same nominal
> ambiguity (`for="x"` doesn't mean *is-x*), resolved by where it sits — and the shipped `injector="id"`
> proves WE-users already parse this idiom without confusion. If the skeptic still lands it, the move is C
> (`use-registry=`), **not** A — A's collision is the larger defect.

## Sequencing note

#900 is robust to #854's open E-vs-F call (the token is shared), so it can be **ratified independently** —
but it only takes effect once #854's association mechanism lands. Ratify #900 alongside or just after
#854's model so the attribute it names actually exists; until then it's a settled spelling waiting for its
mechanism.

## Resolution — ratified 2026-06-18 (`registry=`)

The consumer-side scoped-registry association attribute is **`registry=`** (paired with
`<script type="registry" id="x">` ↔ `<el registry="x">`). It mirrors the shipped `injector=` precedent
(`INJECTOR_ASSOC_ATTR === INJECTOR_SCRIPT_TYPE`, [we:declarativeInjector.ts:38](../plugs/webinjectors/declarativeInjector.ts#L38))
and the native `customElementRegistry` vocabulary, and avoids the live `scope=` collisions (native `<th scope>`,
the `cross-list` reorder marker). A deliberately low-stakes naming call the card itself flagged as a bikeshed;
ratified under the standing authorization to resolve non-critical movable calls (a token rename is trivially
reversible). **Carry-over for [#902](854):** reconcile the pre-existing `scope=` presumptions in
[we:component.njk:105-106,151](../src/_includes/block-descriptions/component.njk#L105) to `registry=` when the
#854 mechanism lands (#902 owns that reconcile).
