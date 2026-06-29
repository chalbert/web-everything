# WE↔FUI chip-upgrade listener contract — delegation-required vs FUI stable interaction surface (#1960)

Prep research for decision **#1960**. A FUI `<we-filter-chip>` is a **transient** custom element (the
`TransientElement` self-replacement pattern, we:docs/agent/block-standard.md line 243; family **(A)** in
we:docs/agent/block-standard.md item 3): on upgrade it **replaces itself with a native
`<button class="fui-filter-chip">`** and the original element — with any listeners bound directly to it —
is detached and discarded. WE-side JS that drives those chips therefore loses any handler it attached
*before* the upgrade, and any cached element reference goes stale. This shipped twice as a regression on the
`/backlog/` Prioritisation table; the question is **where the durable fix lives** — a WE-side consumer
rule, or a FUI-side guarantee.

## 1. The mechanism — what is actually lost, and what is not

The self-replacement lives in **fui:blocks/transient/TransientElement.ts** (`connectedCallback` →
`queueMicrotask(() => this.replaceWith(el))`, lines ~74–75). The subclass
**fui:blocks/filter-chip/FilterChipElement.ts** (`decorate`, lines 56–84) builds the native `<button>`:
copies every attribute except `selected | count | value | variant`, maps `selected → aria-pressed +
fui-filter-chip--selected`, `value → data-value`, `count →` a nested span, `variant →` a class.

Two facts bound the footgun precisely:

- **Child listeners survive.** The base **moves** child nodes (`el.append(...this.childNodes)`,
  fui:blocks/transient/TransientElement.ts lines ~67–68) rather than cloning, so listeners on *children*
  are preserved.
- **Listeners on the host element itself are lost.** `replaceWith` swaps in a different node; the DOM has
  **no API to enumerate or transfer an element's own listeners**, so there is no hook in `TransientElement`
  to re-bind them. This is the regression surface — and it means a "preserve the bound listeners" fix is
  **not mechanically possible** for arbitrary consumer handlers.

This is distinct from a *standard custom-element upgrade*, which keeps the **same node** and therefore keeps
its listeners (web.dev/custom-elements-v1; html.spec.whatwg.org §4.13). The footgun is specific to the
**explicit self-replace** variant, not to progressive enhancement in general.

The regression is the live evidence: the readiness/kind chips survived only because
we:src/assets/js/backlog-table-sort.js (lines 198–207) used a **document-delegated** click handler; the
summary count pills (`data-pfilter`) used direct `addEventListener` and silently stopped filtering the
moment the FUI module loaded. The fix delegated them too (lines 211–233). The regression net is the
deterministic interaction lane we:tests/interaction/backlog-priority-filters.spec.ts with a **mock
`<we-filter-chip>`** (we:tests/interaction/fixtures/backlog-priority.html lines 24–41) reproducing the
self-replace.

## 2. FUI prior art — a stable-event-API precedent already exists, but only on *persistent* hosts

A constellation-wide survey of FUI interactive elements (fui:blocks/) splits cleanly in two:

| Element | Family | State exposure |
|---|---|---|
| `we-button`, `we-badge`, `we-meter`, `we-text-field`, **`we-filter-chip`** | **(A) transient → native** | native element events / attribute (`aria-pressed`) / **no CustomEvent** |
| `we-tabs` (fui:blocks/tabs/TabGroupBehavior.ts line 245) | (B) persistent | **`tab-change`** CustomEvent — `bubbles: true, cancelable` |
| `we-stepper` (fui:blocks/stepper/StepperBehavior.ts lines 20–21, 83) | (B) persistent | **`step-change` / `step-advance-blocked` / `flow-complete`** |
| `we-dockable` (fui:blocks/dockable/DockableElement.ts line 47) | (B) persistent | **`dock`** CustomEvent (bubbles) |
| `we-checkbox` (fui:blocks/checkbox/CheckboxElements.ts) | (B) persistent | `onChange` factory callback |

The FUI **CustomEvent convention is established and uniform** (fui:blocks/stepper/StepperBehavior.ts
lines 20–21):

```ts
const evt = (name, detail, cancelable = false) =>
  new CustomEvent(name, { detail, bubbles: true, cancelable });
```

kebab-case name, `bubbles: true` (so a document-delegated listener catches it), `cancelable` only when the
change can be vetoed, an event-specific `detail`. Events seen: `tab-change`, `step-change`, `dock`,
`code-copy`, `range-change`, `tree-change`, `pagination-change`, `data-table-change`.

**Two conclusions for the fork:**

1. A stable bubbling change-event is **not greenfield** — it is the ratified FUI pattern for *every*
   stateful **(B)** element. Adding `chip-change` reuses an existing convention.
2. **No persistent custom-element host is required.** The filter-chip already attaches a click→toggle
   listener to the *native* `<button>` via the `onToggle` factory (fui:blocks/filter-chip/FilterChip.ts
   lines 70–76); the native button **is** the stable host after upgrade. Promoting that callback to a
   **built-in bubbling `chip-change` CustomEvent dispatched from the native button** is a small change that
   does **not** require converting filter-chip from family (A) to (B), and so does **not** unwind the
   native-`<button>` / native-form / a11y benefit that motivated transient self-replacement (#1381). This
   dissolves the item's original worry that B2 "must not regress self-replacement."

## 3. The gate question (Fork A) — an open `addEventListener` sniff is already a *rejected* shape

Fork A proposes backing the WE consumer rule with a lint flagging `addEventListener` on a
`[data-pfilter]`/`[data-pready]` selector. The platform has **already ruled on exactly this gate shape**:
the `compose-dont-handroll` rule (we:docs/agent/platform-decisions.md, #933, ~lines 710–739) states
**"Open-ended `addEventListener` sniffing is *rejected* (false-positive factory)"** and mandates a
**curated, id/selector-scoped deny-list, warn-first → ERROR** instead. The same conclusion is restated at
we:docs/agent/platform-decisions.md line 728. There is working precedent in
we:scripts/check-standards-rules.mjs (`COMPOSE_DENY_LIST`, lines 1624–1639): a curated
`signature`-regex-AND-`appliesTo`-allow-list shape, `COMPOSE_TRAITS_ENFORCED = false` until
false-positive-free.

So Fork A's gate is feasible **only** as a curated deny-list keyed to the *known* chip selectors — which
catches the regression class that already shipped, but **cannot** generalise to "a listener was bound to any
self-replacing element" (that would be the rejected open sniff). The gate is therefore narrow and
heuristic by construction — a material strike against Fork A, and a statute-overlap that must be reconciled
if Fork A is chosen.

## 4. Classification (7-question pass)

1. **Which layer?** A **block interaction/interface contract** at the WE↔FUI boundary — how a transient
   block exposes interactive state to a consumer. Codifies into the transient-family rule
   (we:docs/agent/block-standard.md item 3 / §7.7) and/or `we-fui-embed-boundary`
   (we:docs/agent/platform-decisions.md).
2. **Protocol or intent dimension?** Neither — an **event/interaction surface** contract on a block.
3. **Expose the whole axis?** Yes — generalise beyond filter-chip: *any transient element that carries
   interactive state* should expose a stable event, not just this one chip.
4. **Fixed mechanic or dimension?** **Fixed mechanic** — a bubbling CustomEvent convention, not a
   per-deployment knob.
5. **DI-injectable?** No.
6. **Most-permissive default?** The consumer-facing most-permissive default is "consumers receive a stable
   event they can delegate on, and never have to know the node identity churns" — Fork B2.
7. **Seam between intents?** The seam is the known WE↔FUI consumer↔provider boundary; the impl lives in FUI
   (WE holds zero implementation — a gate/validate-script is the only thing that may live WE-side).

Classification verdict: **support generalising the rule to the transient family; the durable fix is a
FUI-side stable event (B2); a WE gate, if any, is a curated deny-list, never an open sniff.**

## 5. Constellation legality

Both forks are constellation-legal. Fork B builds the dispatch in **FUI** (impl side — correct per #1282
WE-holds-zero-implementation). Fork A builds a **gate** in WE — explicitly permitted ("OK in WE:
definitions + validate scripts"). WE only ever **consumes** the event and **codifies** the consumer-facing
contract.

## 6. Net — the prepared shape

- **Fork 1 — boundary ownership: default Fork B (FUI guarantees a stable interaction surface).** FUI already
  owns this pattern for every (B) element; pushing the fix to the source removes the footgun for *all*
  consumers (WE today, plateau-app tomorrow) instead of taxing each consumer's memory forever. Fork A is the
  safe fallback if FUI cannot take the change — but its gate is narrow (curated deny-list only) and the
  burden stays on every consumer.
- **Fork 2 (if B) — mechanism: default b2-event (built-in bubbling `chip-change` CustomEvent on the upgraded
  native button).** Reuses the ratified FUI event convention; no family-A→B conversion; native-button
  benefit intact. b1 (preserve/re-emit listeners) is the **broken** branch (DOM cannot enumerate an
  element's listeners). b2-aria (documented `aria-pressed` MutationObserver contract) is coherent but a
  more awkward consumer ergonomic than an event and has no FUI precedent.

## 7. Skeptic resolution — the recommended default flips B→A

A hostile skeptic pass attacked §6's original default (Fork B / B2-event) on four axes and the default
**flipped**:

- **(0) Classification (dispositive).** "Which side owns the fix" is a **false dichotomy**: WE codifies a
  consumer rule *either way* (WE holds zero implementation — even under B it "only consumes and codifies the
  consumer contract"), and a FUI event is **additive** (native `click` still bubbles), not exclusive. So the
  decision is a **forced consumer-contract** (already shipped + regression-netted) plus a
  **separately-prioritized go/no-go** on a FUI event — not a boundary fork.
- **(1) Merit.** A `chip-change` event **double-fires with native `click`** (both bubble to the same
  delegated ancestor) — a new footgun of the same kind the decision claims to remove.
- **(2) Statute-overlap.** A bespoke event sits in tension with #1381's *native-events-kept* clause for
  family-A (we:docs/agent/block-standard.md line 271); Fork A's *gate* must be re-shaped to #933's curated
  deny-list (open `addEventListener` sniffing banned).
- **(3) Citation-scope.** #1381 governs **mechanism-selection** (transient vs persistent vs shadow), not
  event-API design — its "native events kept" clause argues *for* delegating on native `click`, the opposite
  of how §2/§6 originally cited it.

**Resolved prepared shape:** the WE consumer contract (delegate + survive-by-`data-*`/`aria-pressed`, never
cache the transient node) is a **forced invariant → codify** (alternative is the shipped regression);
**Fork 1 (enforcement)** defaults to the interaction-test lane only (no source gate); **Fork 2 (ship a FUI
`chip-change` event?)** defaults to **no, not now** (advisory, un-gate trigger = a consumer that genuinely
cannot delegate). §6's "default Fork B" is superseded by this section.

## Sources

- web.dev — Custom Elements v1 (upgrade keeps the same node): https://web.dev/custom-elements-v1/
- WHATWG HTML §4.13 Custom elements: https://html.spec.whatwg.org/multipage/custom-elements.html
- Open Web Components — Events (bubbles/composed as API surface): https://open-wc.org/guides/knowledge/events/
- WAI-ARIA APG — Button (toggle / `aria-pressed`) pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- Cloud Four — Web Components as Progressive Enhancement: https://cloudfour.com/thinks/web-components-as-progressive-enhancement/
