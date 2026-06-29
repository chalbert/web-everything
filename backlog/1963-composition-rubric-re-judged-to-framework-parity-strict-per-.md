---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-29-composition-framework-parity.md
tags: [webblocks, block-standard, composition, dom-less, framework-parity, adoption, decision]
---

# Composition rubric re-judged to framework-parity — strict per-case mechanism selection at a zero-compromise bar

WE already ships the composition **mechanisms** and a ratified per-*family* rule — but it has never been
consolidated into one strict **per-case** rubric, nor re-judged against a framework-parity bar. This decision
does that. It is **adoption-critical**: a native-first system that can't match framework composition DX never
wins first-level developer adoption, no matter how good its standards are.

**This card does not re-derive the mechanisms** (they're built — see Inputs). It (a) unifies the two existing
taxonomies into one matrix, (b) re-judges every cell against the bar below, and (c) emits *invent-case* child
items where nothing clears it.

## The acceptance bar (every per-case solution must clear all five)

1. **Ergonomics ≥ frameworks** — authoring DX competitive with React/Vue/Svelte/Solid, not "good for web
   components."
2. **Zero compromise** — no breakage of **layout** (flex/grid direct-child), **CSS** (selector/cascade), or
   **accessibility** (AX tree + HTML content-model). See the cost enumeration in #1962.
3. **A no-compromise solution for *every* case** — an uncovered case is not allowed to stand; it becomes a
   build/invent item.
4. **Open to net-new mechanisms** — where no existing option clears the bar, **invent a plug** (proposed
   standard, per *Plug = Proposed Missing Standard*), don't settle for a compromised one.
5. **Authoring-surface-agnostic** — clean in **plain HTML** (declarative/SSR) **and JSX** (and other valid
   approaches: imperative DOM, templates). No mechanism may force a single authoring mode.

## Two taxonomies to reconcile (the reason this isn't already done)

- **§7 block families A/B/C** ([we:block-standard.md](../docs/agent/block-standard.md), ratified
  #1321/#1381/#1456/#1457) — covers only a *block's runtime shape* (transient → native vs persistent light-DOM
  vs shadow). ~80% confidence; chosen "by what the consumer needs," **never benchmarked to framework parity**.
- **`/research/dom-less-composition` A–I catalog** ([research topic](/research/dom-less-composition/)) — covers
  the *broader* composition surface (comment/virtual elements, fragments, `display:contents` providers,
  behaviors, mixins, portals, `is=`). A **catalog**, not a strict ratified per-case rule.

No single artifact spans both. An author choosing a mechanism for a *non-block* composition case today has a
catalog to read, not a rule to apply.

## The spine — the host node is the API surface, so it is a budgeted resource

The single principle the whole rubric hangs on (prep survey — [relatedReport](../reports/2026-06-29-composition-framework-parity.md)):
a framework component is a **function/object** in a virtual tree — only leaf elements reify as DOM, so 10 nested
providers cost **zero** nodes. A custom element is **defined as a DOM element**: `customElements.define` binds
behaviour to a *tag*, and a tag is a node with a box, an event-path slot, an AX entry, a `:host`. Slotting,
Shadow-DOM scoping, `connectedCallback` lifecycle, `ElementInternals` semantics, and focus are **all keyed off
that node** — you cannot have them and not have the node. So the platform charges per node *for a reason*, and
**no emerging standard removes it** (`display:contents` removes the box not the node; `moveBefore()` makes
reparenting non-destructive not free; DOM Parts is proposal-stage and addresses *content* regions, not CE hosts;
`ElementInternals` makes the node *worth* paying for).

Two claims must be kept apart here (skeptic pass-1): the **descriptive** one — *slot/shadow/AX/lifecycle are
keyed off the node* — is uncontestable. The **prescriptive** jump — *therefore budget the host node and parity
is a discipline, not a missing feature* — is **only true where a zero-node mechanism exists for the authoring
surface in use**, and that is **not** uniformly true:

- On **JS / JSX** surfaces, zero-node mechanisms exist (functional components, directives, mixins) → **budget
  the host node, achieve zero-node parity.** True.
- On the **declarative-HTML** surface, plain HTML has only *elements*, not functions → the best available is
  `display:contents` per layer, which is a **cheap node, not zero** (the box is gone but the node, event-path,
  AX entry, content-model position remain). For **deep structural nesting** this still breaks bar-criterion 2
  (see #1962's cost enumeration). So on declarative HTML, deep structural composition reaches only *cheap-node*
  composition — **an open gap, not parity** (Fork 2).

**Therefore the codified rule is scoped:** *budget the host node — pay it only for slot/shadow/AX-identity/
lifecycle, route everything else through a zero-node mechanism; this yields full parity on JS/JSX surfaces, and
cheap-node (not zero) composition on declarative HTML, where deep structural nesting remains an open invention.*
The unscoped "parity is a discipline, not a missing feature" would be **false in plain HTML** — the honest rule
names the surface.

## Recommended path at a glance

Verdict key: ✅ clears the bar · ◐ parity *pending* a named confirm · ⚠️ **unmet** (a real compromise/gap — becomes
a tracked item per bar-rule 3). *The verdicts match the [report](../reports/2026-06-29-composition-framework-parity.md)'s
honesty — no compromised cell is graded green.*

| Element | Verdict | Why |
|---|---|---|
| **The 5-point bar** (codify as the standing test) | **Supported by default — codify** *(criteria derived: rule 4 = Plug = Proposed Missing Standard, #95; rule 2's AX/content-model enum = #1962)* | The decision's core output. Its **first honest act is to mark the cases it fails** (8, 10-HTML) — not to grade them passed. |
| **The budgeted-host-node principle** — **scoped** | **Supported by default — codify (JS/JSX zero-node; declarative-HTML cheap-node = open gap)** | Descriptive claim (node = API surface) uncontestable; prescriptive "discipline = parity" holds only where a zero-node mechanism exists for the surface. |
| **Cases 4/5, 7** (if/for/switch · behaviours) | ✅ **at parity today** | Comment-anchor directives (#1130) + mixins/`CustomAttribute` — zero-node, HTML + JSX, built. |
| **Cases 2** (grouped/reactive) | ◐ **parity *pending* the reactivity-primitive confirm** | The group-CE + form-associated-children split is ratified (#1456); ergonomic parity assumes a framework-grade signals/observed-property primitive — confirm WE's or file it. *Cites #1456, not re-deciding it.* |
| **Cases 3, 6, 9** (fragment · DI provider · portal) | ◐ **parity *pending* a named confirm** | Built (#1044 provider, `webportals`); riders: case 6 AX-tree across Chromium/Safari, case 9 `moveBefore` cross-browser fallback. |
| **Case 1** (real-element leaf) | **→ delegated to #1962** | Emit-to-native (transient) is *full* parity — what React/Svelte/Solid do. Mechanism choice is #1962's facet. |
| **Fork 1 — case 8** (`is=` / behaviour on an *existing* native element) | ⚠️ **UNMET** — policy **(a)** `is=` PE-only + autonomous CE + `ElementInternals`, but **no zero-compromise path exists** | Safari refuses `is=` (#97); `ElementInternals` gives role/form **not behaviour**, and **does not apply to a foreign element**. (a) is the right *policy*; the *case* stays a tracked gap. |
| **Fork 2 — case 10** (deep STRUCTURAL composition) | ⚠️ **UNMET in declarative HTML** — policy **(a)** budgeted-host discipline clears **JS/JSX**; declarative-HTML deep nesting reaches only cheap-node | Not "parity by discipline" unqualified: zero-node holds in JS/JSX; the declarative-HTML deep-nesting path is a **genuine open invention** (DOM Parts watch / generalize transient-to-comments). |

## Supported by default (forced / clear — not forks)

1. **The acceptance bar** (the five criteria above) — codified into `we:block-standard.md` as the standing test.
   Not a fork: it *is* the ruling the card exists to make. **Its criteria are derived, not novel** — rule 4 is
   *Plug = Proposed Missing Standard* ([we:platform-decisions.md](../docs/agent/platform-decisions.md), #95); rule
   2's layout/CSS/AX/content-model enumeration is #1962's cost analysis. **The bar's first act is to mark the
   cases it *fails* (8, 10-in-HTML) — codifying the test and grading it already-passed are two different
   rulings; this card does only the former.**
2. **The budgeted-host-node principle — *scoped*** (skeptic pass-1, Target B): the **descriptive** half (node =
   API surface; slot/shadow/AX/lifecycle keyed off it) is uncontestable and codified. The **prescriptive** half
   (*budget the host → parity*) is codified **scoped to the authoring surface**: full zero-node parity on
   JS/JSX; **cheap-node, not zero, on declarative HTML** (Fork 2's open gap). The broken alternative the bar
   forbids ("nest registered hosts for structural layers") pays all of #1962's layout/CSS/AX costs.
3. **Cases 4/5, 7 — at parity, ratify the assignment.** if/for/switch → comment-anchor directives
   (`CustomComment` #1130 → `ForEach`/`ViewIf`/`ViewSwitch`,
   [fui:plugs/webdirectives/CustomComment.ts](../../frontierui/plugs/webdirectives/CustomComment.ts)); behaviours
   → mixins + `CustomAttribute`. Zero-node, HTML + JSX, built.
4. **Case 2 (grouped/reactive) — parity *pending* a confirm, not clear.** The group-CE + form-associated-children
   split is **already ratified (#1456/#1457 — this card *cites*, not re-decides it)**; but ergonomic parity
   (bar-rule 1) assumes a framework-grade reactivity primitive (signals / observed properties). **Demote to
   pending** until WE's reactivity glue is confirmed framework-grade or filed as a build item.
5. **Cases 3, 6, 9 — parity *pending* a named confirm**, not clear: case 6 needs an AX-tree confirm across
   Chromium/Safari (regression fixed Safari 16 / FF 62; provider role benign — the injector chain already walks
   a `display:contents` host, [fui:plugs/webinjectors/InjectorRoot.ts](../../frontierui/plugs/webinjectors/InjectorRoot.ts), #1044);
   case 9's `moveBefore()` (Chrome 133) needs a cross-browser fallback. Each rider is a child build item, not a
   green cell.

## Considered & rejected by precedent

- **Customized built-ins (`is=`) as a *load-bearing foundation*** — foreclosed by Safari's *permanent* refusal
  ([WebKit #97](https://github.com/WebKit/standards-positions/issues/97)) **and** statute-barred by the
  native-first **single-substrate floor** ([we:platform-decisions.md](../docs/agent/platform-decisions.md)): a
  dual native-vs-shimmed contract isn't permitted. `is=` is usable only as progressive enhancement (Fork 1). Note
  this **demotes, not forbids** it — consistent with §7's "compliance is a spectrum, nothing is a hard blocker"
  (see *Statute reconciliation*).

## Fork 1 — case 8: behaviour on an *existing* native element with no wrapper

*Fork-existence:* a real either/or — make `is=` load-bearing (with a polyfill) vs treat it as progressive
enhancement and meet the native-semantics need another way. They trade off (authoring ergonomics of
`<button is="…">` everywhere vs a permanent non-standard shim). The **excluded/broken** branch is "rely on
`is=` working cross-browser" — Safari will never ship it.

- **(a) — `is=` is progressive-enhancement-only; autonomous CE + `ElementInternals` for owned semantics.**
  *(default)* Never make `is=` load-bearing: where you own the element, emit an autonomous CE and grant native
  semantics via `formAssociated` + `attachInternals()` (`internals.role`, `setFormValue`) — Baseline since 2023,
  cross-browser; where a *real* native element is required, emit one (transient, case 1). `is=` may *enhance* a
  native element where present, degrading to the plain native element in Safari (still functional).
- **(b) — polyfill `is=` and make it load-bearing.** Restores `<button is="…">` ergonomics everywhere via a shim
  (`@ungap/custom-elements`-style). A permanent non-standard maintenance tax with upgrade-timing/SSR edge cases,
  on a feature the platform will never converge on. Acceptable as a *compat layer*, wrong as a foundation.

```js
// Fork 1 (a) — owned element: autonomous CE gets native semantics WITHOUT is=, cross-browser:
class WeToggle extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  connectedCallback() { this.#internals.role = 'switch'; this.#internals.ariaChecked = 'false'; }
  // …focus/keyboard wired explicitly (the residual is= would have given for free)
}
// `is=` only as enhancement, never required: <button is="we-fancy"> → plain <button> in Safari, still works.
```

**Default: Fork 1 (a) is the right *policy* — but case 8 stays ⚠️ UNMET, not "cleared" (skeptic).** `is=`-as-
load-bearing (b) is not merely worse, it is **statute-barred** by the native-first single-substrate floor (no
dual native-vs-shimmed contract), so (a) is the correct policy. But (a) does **not** make case 8 a green cell:
`ElementInternals` grants **role/form semantics, not native behaviour** (focus ring, implicit submit, label
click-through, keyboard activation — all hand-wired, per #1962), and it applies only to **your own** autonomous
element — for case 8's defining constraint (a native element you *don't own*, customized in place) it does not
apply at all, and the fallback ("emit a fresh element via transient") is **case 1, a different case**. So case 8
*as stated* has **no in-place zero-compromise solution** → it is a **tracked gap** (bar-rule 3), not a resolved
cell.

`Skeptic:` REFUTED-as-cleared → policy **(a)** stands (and (b) is statute-barred), but the **verdict flips to ⚠️
UNMET**: the summary table no longer grades case 8 green. Pass-1: choosing PE-only `is=` is the right *kind* of
call; the dodge was labelling the *outcome* resolved. Pass-3: `ElementInternals` was over-cited as "cross-browser
native semantics" — it delivers role/form, not behaviour, and not on foreign elements. Folded: **file the
behaviour-on-a-foreign-native-element gap** as a child item.

## Fork 2 — case 10: deep STRUCTURAL composition (the contested case)

*Fork-existence:* a real either/or that the prep survey's two expert passes split on. Both branches are coherent
and trade off: a **discipline** (route structural layers through existing zero-node mechanisms) vs an
**invention** (a net-new primitive for HTML-declarative true-zero-node nesting). The **excluded/broken** branch
is "nest 10 registered custom-element hosts" — it pays all of #1962's layout/CSS/AX costs and fails the bar.

- **(a) — budgeted-host discipline: structural layers go zero-node.** *(default)* Codify: a structural /
  provider / boundary layer is authored as a **function/directive render** (JSX functional components #052;
  comment-anchor directives; mixins for behaviour) — zero nodes, exactly as frameworks compile structural layers
  away — or, where a host is unavoidable, `:host{display:contents}` (box-erased) + `moveBefore()` for
  relocation. A registered `customElements.define` host is **budgeted** to layers that genuinely need slot /
  shadow / AX-identity / lifecycle. Achievable today; matches React/Vue/Svelte/Solid (which all do exactly this).
- **(b) — invent a net-new primitive (plug).** A structural/controller construct that composes in JS and stamps
  only leaf DOM, giving HTML-*declarative* true-zero-node deep nesting (plain HTML has only elements, not
  functions, so the discipline's zero-node path is JSX/JS-only). The honest residual the pessimistic pass named.
  But: the zero-node mechanisms already exist for JS/JSX; the standards-track version (DOM Parts) is
  proposal-stage and content-region-only. Over-investment vs (a) unless an HTML-declarative deep-nesting need is
  concretely shown.

```jsx
// Fork 2 (a) — 10 structural layers as zero-node function components (parity with React HOCs), JSX surface:
const Provided = withTheme(withLocale(withAuth(/* …7 more… */ Leaf)));   // 0 host nodes; only <Leaf/>'s DOM lands
// HTML-declarative surface today: display:contents host (box-erased) OR comment-anchor directive (zero layout node):
// <we-theme-scope style="display:contents"><we-locale-scope style="display:contents">…<leaf/>…
```

**Default: Fork 2 (a) clears *JS/JSX only*; declarative-HTML deep nesting is ⚠️ UNMET — a genuine open
invention (skeptic-corrected).** On JS/JSX surfaces (a) reaches zero-node parity and is the right rule. But the
original "(a) discipline = parity today, not an invent-case" was the card's **central dodge**: it silently
restricted "parity" to JSX. On the **declarative-HTML** surface — which bar-rule 5 *requires* — plain HTML has
only elements, so deep structural nesting falls back to `display:contents`-per-layer = **cheap node, not zero**,
breaking bar-criterion 2 (content-model foster-parenting, AX-pairing, structural-selector and tree-walk shifts —
#1962) for the very case under judgment. So the honest split:

- **JS/JSX deep structural composition → (a), clears.** Function/directive render, zero-node, ratify.
- **Declarative-HTML deep structural composition → UNMET → (b)-flavoured open invention.** No zero-node path
  exists buildless today; the standards-track candidate (DOM Parts `ChildNodePart`) is proposal-stage/unshipped.
  This is a **real gap, not a closed cell** — file it: (i) confirm the actual declarative deep-nesting needs,
  (ii) if shown, **generalize the transient-to-comments bridge** (author a tag → becomes comment anchors → zero
  *layout* node) as the WE-side mechanism, and (iii) watch DOM Parts as the standards adopt-path. Do **not** ship
  "case 10 = parity by discipline" unqualified.

`Skeptic:` REFUTED (the central dodge) → split. Pass-0: "(a) parity today, not an invent-case" classified case 10
as solved by quietly scoping parity to JSX; the card's own text admits the HTML surface gets only a *cheap node*.
Pass-1: "use JSX functional components" as the parity answer for a **native-first** system whose surface is
declarative custom elements is retreating to the compiler — the thing native-first is defined against — so it
cannot be claimed as in-surface parity. Pass-3: "frameworks compile structural layers away, so WE should too"
over-reads compiled-surface prior art to license a *buildless declarative* default. Folded: JS/JSX clears;
declarative-HTML deep nesting is an **explicit UNMET gap** carried into `we:block-standard.md`, with the
transient-to-comments generalization as its candidate fix.

## Statute reconciliation with §7 (skeptic — required before ratification)

This card introduces a selection rule over the same turf §7 already governs; the precedence must be stated
([we:block-standard.md](../docs/agent/block-standard.md) §7, #1381/#1456/#1457):

1. **Two selection rules, ordered.** §7's rule picks a *block's runtime family* "by what its primary consumer
   needs" (A transient / B persistent / C shadow). This card's **budgeted-host-node** rule is the **higher
   standing test** of which it is the block-shape application: §7 stays the rule for *block runtime shape*, this
   card's bar + budget-rule govern the *broader composition surface* and license future mechanism choices. They
   are **different altitudes, not rivals** — but where they touch the same cell (a structural provider a consumer
   wants a live ref to), **the bar governs and §7's consumer-need is applied beneath it.** Stated, not implied.
2. **Bar vs §7's "compliance is a spectrum."** §7 item 2 holds that no-element/CSS-only and `is=` are
   "lower-compliance choices, **not disallowed** — a risk the author accepts." The bar's zero-compromise
   criterion **demotes** `is=`-load-bearing to lower-compliance/PE-only; it does **not** *forbid* it (that would
   contradict §7). Fork 1 (a) must read as *demote, not prohibit* — reconciled.
3. **Cases 2 / grouped-control cite, not re-decide, #1456/#1457.** The group-CE + form-associated-children split
   is ratified statute; this card references it as an input and does not re-open it.

## Outcome shape (what ratifying this produces)

- A **single strict per-case rubric** in `we:block-standard.md` (consolidating §7 families with the dom-less
  catalog under the *scoped* budgeted-host-node spine), each case naming its mechanism **and its honest verdict
  (✅ / ◐ / ⚠️)** — including the two cells that do **not** clear (8, 10-in-HTML).
- The **5-point bar** codified as the standing test for future mechanism choices, with the §7 precedence stated.
- **Child items for every ◐ / ⚠️** (gaps tracked, never graded green): (i) case 6 AX-tree confirm; (ii) case 9
  `moveBefore` cross-browser fallback; (iii) reactivity-primitive parity confirm (cases 2/4); (iv) **case 8 —
  behaviour-on-a-foreign-native-element gap** (no in-place zero-compromise path); (v) **case 10 —
  declarative-HTML deep-structural-nesting gap** (candidate fix: generalize the transient-to-comments bridge;
  watch DOM Parts).

## Inputs & relationships

- **Inputs (built, ratified):** §7 families #1321/#1381/#1456/#1457 · `CustomComment` #1130 · view directives
  #1217 · `display:contents` provider #1044 · `webportals` · JSX strategy #052 ·
  [/research/dom-less-composition](/research/dom-less-composition/) · [/research/composition-framework-parity](/research/composition-framework-parity/).
- **Facet:** **#1962** (transient) is case 1's mechanism choice — prepared/resolved separately; the benchmark
  shows transient (emit-to-native) is *parity-competitive*, not a liability, for behaviour-free leaves.
- **Downstream:** the block-conversion epic **#1442** inherits whatever this ratifies.
- **No `blockedBy` on #1960/#1961** — those mitigations stand regardless.
