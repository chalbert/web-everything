---
kind: decision
status: resolved
locus: frontierui
dateOpened: "2026-06-29"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#transient-exposed-api"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-29-transient-element-exposed-api.md
tags: [webcomponents, fui-boundary, transient-element, api-surface, decision]
---

# Transient element exposed API — the stable read/event surface across self-replacement

A transient (A-family) custom element (`TransientElement`,
[fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)) replaces
itself with a native element on upgrade. The problem: **the surface a consumer reads renames across the swap.**
On `we-filter-chip` the authored `selected` boolean becomes a *computed* `aria-pressed` string and `value`
becomes `data-value` ([fui:blocks/filter-chip/FilterChipElement.ts:52-64](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L52-L64)),
while any host-bound listener is discarded entirely. So `aria-pressed` is `null` pre-upgrade and `selected`
is gone post-upgrade — **neither read is correct in both phases.**

This card decides the **stable API a transient element exposes** so a consumer gets one consistent
read/event surface regardless of upgrade timing. **Blocks #1960** — the WE consumer-rule wording depends
on what this surface is.

## Ruling — ratified 2026-07-01

1. **Fork 1 → (b)-narrow.** Fix the *gratuitous* identity rename: stop excluding `value` so the base copies
   the authored `value` verbatim onto the survivor — identity is read by the **same name** in both phases.
   `selected`→`aria-pressed` stays the one *forced* a11y state rename, documented as the explicit carve-out to
   [we:block-standard.md:271](../docs/agent/block-standard.md#L271) (no statute amendment; a cross-ref states the
   carve-out). Free, no sync burden, statute-honoring.
2. **Forced invariants ratified as stated:** `aria-pressed` is the canonical survivor state key; the
   detached-host stance (a replaced host is detached-not-dead — never hold a ref across upgrade, re-query from a
   stable ancestor, gate on `Node.isConnected`).
3. **Event API — deferred (not a merit fork).** No `chip-change`/`toggle` CustomEvent now; YAGNI, double-fires
   with native `click`. Un-gate trip-wire (a named non-delegating consumer) carried on **#1960**.

**Gated work turned agent-ready:** the FUI (b)-narrow build (un-exclude `value` on the toggle controls + the
:271 carve-out cross-ref) and the WE consumer-rule codification on #1960.

**Scope (narrowed by the prep survey — [relatedReport](../reports/2026-06-29-transient-element-exposed-api.md)):**
the attribute *rename* is **not** A-family-wide. Of the ~14 `TransientElement` subclasses, only the two
**toggle controls** rename their state (`FilterChipElement`: `selected`→`aria-pressed`, `value`→`data-value`;
`ButtonTransientElement`: `pressed`→`aria-pressed`, `controls`→`aria-controls`/`aria-expanded`). The rest are
**pure-presentational** (Badge/Tag/Card — no state to read) or **fully rebuilt** (TextField/Progress/Meter/
NumberInput — state lives in nested native controls). So the live decision is about the **toggle-state read
surface on the two toggle controls**, generalized into a transient-family rule.

## Grounding — the rename, per phase

| | Pre-upgrade (`<we-filter-chip>`) | Post-upgrade (`<button class="fui-filter-chip">`) |
|---|---|---|
| State | `selected` (boolean present/absent) | `aria-pressed` (`"true"`/`"false"`) |
| `getAttribute('aria-pressed')` | `null` ⚠️ | `"true"`/`"false"` ✅ |
| `hasAttribute('selected')` | ✅ | `false` ⚠️ (excluded, [fui:FilterChipElement.ts:52-53](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L52-L53)) |
| Identity | `value="open"` | `data-value="open"` |
| Host listener (`chip.addEventListener`) | bound | **discarded** ([fui:TransientElement.ts:75](../../frontierui/blocks/transient/TransientElement.ts#L75)) |

The base **moves** children (so child listeners survive) and **copies** non-excluded attributes; it cannot
transfer the host's own listeners (no DOM API exists). Full mechanism table in #1960.

## Semantic foundation — a replaced host is *detached*, not *dead*

The platform fact that makes a contract necessary rather than stylistic: **operating on a replaced transient
element never throws.** After `replaceWith` removes the host ([fui:TransientElement.ts:75](../../frontierui/blocks/transient/TransientElement.ts#L75)),
the held object is a fully-valid `HTMLElement` that simply isn't in the document tree. The DOM has no concept
of an invalidated node — every method runs against the **orphaned subtree** and **silently no-ops**; there is
no error to catch. That is the danger: misuse is invisible, not loud.

| Operation on the detached host | Behaviour | Standards basis |
|---|---|---|
| `getAttribute`/`setAttribute`/`classList`/`textContent` | runs — reads/writes the **stale orphan** | DOM §4.9 (position-agnostic) |
| `querySelector`/`closest`/`matches` | runs, scoped to the **detached subtree** only | DOM §4.4 |
| `addEventListener` | binds, but **never fires** (unrendered node, off every propagation path) | DOM §2.9 event path |
| `dispatchEvent` | fires own listeners; bubbles **only within the detached subtree** | DOM §2.9 |
| `getBoundingClientRect()` | **all-zero** `DOMRect` | CSSOM-View |
| `offsetParent`/`offsetWidth` | `null` / `0` | CSSOM-View |
| `focus()`/`scrollIntoView()` | **silent no-op** | HTML §focusable, CSSOM-View |
| `parentNode`/`parentElement` | `null` | DOM (removed from parent) |
| `getRootNode()` | the **detached root** (itself), not `document` | DOM §4.4 |
| **`isConnected`** | **`false`** — the reliable liveness signal | **WHATWG DOM §4.4** |

`Node.isConnected` is *defined* for exactly this question ("true iff the node's shadow-including root is a
document"), so it is the standards-blessed, single-property liveness check — not a `try/catch` or a bespoke
`isAlive` flag. This anchors the contract under **native-first (#75)**: the platform already supplies the
liveness primitive.

**Three states, not two** (replacement is deferred to a microtask — [fui:TransientElement.ts:75](../../frontierui/blocks/transient/TransientElement.ts#L75)):
(1) pre-upgrade — chip connected, plain `HTMLElement`; (2) the **microtask window** — `connectedCallback`
has synchronously built the `<button>` but `replaceWith` is still queued, so the chip is *still connected*
while the button is *detached* (`isConnected === false`); (3) post-replacement — chip detached, button
connected.

**Stance (clear + standards-supported):** operating on a replaced transient element does not error — it
silently no-ops, because per the DOM standard a removed node is a valid *disconnected* node, not an invalid
one. The contract cannot rely on failure to surface misuse. **Never hold a transient-element reference across
its upgrade; re-query live from a stable ancestor.** If a reference genuinely must be retained, **assert
`Node.isConnected` before trusting it** — the platform's own liveness primitive — rather than inventing a
custom guard. This holds regardless of which guarantee (Fork 1/2) is chosen below.

> **Precision riders (prep survey):** the zero `getBoundingClientRect` is because the element is **not
> rendered** (the same reason `display:none` zeros it), not literally "disconnected". And per the HTML spec,
> **self-replacement is not a sanctioned pattern** — authors are warned against tree manipulation in custom-element
> reactions, and `connectedCallback` can fire **more than once** and even with `isConnected === false`, so the
> unwrap must stay idempotent (the existing `#replaced` guard, [fui:TransientElement.ts:54-55](../../frontierui/blocks/transient/TransientElement.ts#L54-L55)).

## Recommended path at a glance

| Element | Verdict | Why |
|---|---|---|
| **`aria-pressed` is the canonical survivor state key** | **Supported by default — not a fork** | ARIA-mandated for a toggle button ([WAI-ARIA APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)); the survivor *must* carry it for a11y, so it can't be "designed away". |
| **Detached-host stance** (never hold a ref across upgrade; re-query / delegate; gate on `isConnected`) | **Supported by default — not a fork** | The only alternative (trust a held ref) is the *shipped regression*; forced invariant. |
| **Fork 1 — phase-stable read mechanism** | **(b)-narrow: fix the *gratuitous* rename — identity survives un-renamed** *(default, flipped by skeptic)* | The survey ranks "make the mechanism stable" **above** "rely on docs". Un-excluding `value` is **free** (no sync burden) and *honors* [we:block-standard.md:271](../docs/agent/block-standard.md#L271) ("attribute-shaped reactivity is kept"); `aria-pressed` stays the one *forced* a11y rename. |
| **Event API — ship a stable `chip-change`/`toggle` event now?** *(not a merit fork — a timing deferral)* | **Defer** (advisory; trip-wire on #1960) | APG's baseline is `click`+read `aria-pressed`, no event; a custom event **double-fires** with native `click`; no A-family element ships one today. YAGNI until a non-delegating consumer exists — a *prioritization* call, not a design one. |

## Supported by default (forced invariants — not forks)

1. **`aria-pressed` is the canonical state key on the survivor.** Not a fork (the excluded branch — "expose
   toggle state via some other survivor attribute instead of `aria-pressed`" — is *broken*: a toggle button is
   required to carry `aria-pressed` for a11y, [WAI-ARIA APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/),
   and the tree already computes it, [fui:FilterChipElement.ts:61](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L61)).
   Every leading design system reads `aria-pressed` on a native button; FUI's own helper already does
   ([fui:FilterChip.ts:82-83](../../frontierui/blocks/filter-chip/FilterChip.ts#L82-L83)).
2. **The detached-host stance** (the *Semantic foundation* section above): a replaced host is detached not dead,
   operations no-op, never hold a ref across upgrade, gate on `isConnected`. The only alternative is the shipped
   regression — forced invariant.

## Considered & rejected (settled by precedent — recorded, not forks here)

The survey surfaced two alternatives that the wider web actually prefers; both are out of scope for *this* card
by precedent, but are recorded so the ruling shows they weren't missed:

- **Don't self-replace — keep the host as the API surface.** This is the dominant real-world choice (HTML web
  components / Lit / Shoelace all *persist* the host), and it dissolves the whole stale-ref/lost-listener/rename
  problem set. **Out of scope, but load-bearing — stated, not buried (skeptic flag):** this card's *entire*
  problem set is **downstream of the ratified A-family self-erase choice** ([we:block-standard.md:243](../docs/agent/block-standard.md#L243),
  chosen for zero-wrapper native semantics & SSR). `(b)-narrow` in Fork 1 exists precisely to claw back what
  self-erase throws away (host listeners, authored attribute names). Reversing self-erasure is a higher-altitude
  reconsideration of that statute — a *separate* decision item against `we:block-standard.md`, not a fork here —
  but the ruling must record that it is mitigating a problem the dominant precedent would dissolve outright, not
  treat the out-of-scope routing as cost-free.
- **Customized built-in (`is="button"`).** The standards-blessed way to get a real `<button>` with inherited
  semantics without a swap. **Foreclosed:** WebKit [will never ship it](https://github.com/WebKit/standards-positions/issues/97)
  — which is *why* the transient self-replacement pattern exists in the first place.

## Fork 1 — the phase-stable read mechanism

*Fork-existence:* a real either/or — make the read **mechanism** phase-stable (FUI keeps the authored key on the
survivor) vs paper over the rename with a **documented** read contract. They genuinely trade off (a small FUI
change vs a latent footgun that only helps consumers who read the doc). The **excluded/broken** branch is "read
the renamed key off the host *pre-upgrade*" — `getAttribute('data-value')`/`('aria-pressed')` is `null` before
upgrade (the shipped regression's root).

**The honest split the framing hid (skeptic pass-1).** There are *two* renames doing *different* work, and they
must not be lumped:

- `selected` → `aria-pressed` is **forced** — a toggle button is *required* to carry `aria-pressed` for a11y
  ([WAI-ARIA APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)); the survivor must have it. Not
  negotiable, and **APG settles only this *state* key** — it says nothing about identity or phase.
- `value` → `data-value` is **gratuitous** — there is *no* a11y reason to rename identity; this is the rename the
  survey names as the actual anti-pattern (report §3). `data-value` is only set *post-upgrade* in `decorate`
  ([fui:FilterChipElement.ts:64](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L64)), so pre-upgrade
  reads (initial render, SSR snapshot, test fixtures) see authored `value` and post-upgrade reads see
  `data-value` — the identity key renames across the swap for zero benefit.

- **(a) — documentation-only phase-split read contract (rejected default).** Codify "read live `aria-pressed` at
  interaction time; read initial `selected`/`value` pre-upgrade; never assume one name spans the upgrade." Zero
  FUI change. **Refuted:** this adopts *docs-over-mechanism*, which the survey ranks **below** "make the mechanism
  stable" (report §6); it *describes* the regression class rather than closing it, and it **contradicts its own
  `codifiedIn` anchor** — [we:block-standard.md:271](../docs/agent/block-standard.md#L271) promises transient
  blocks *keep* attribute-shaped reactivity, but (a) leaves `value` renamed and `selected` dropped.
- **(b)-narrow — fix the gratuitous rename; identity survives un-renamed.** *(default)* Stop excluding `value`
  ([fui:FilterChipElement.ts:53](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L53)) so the base copies
  the authored `value` verbatim onto the survivor — identity is then read by the **same name** in both phases.
  Keep `aria-pressed` as the one *forced* state rename (document that, and only that). **No sync burden, no
  duplicated state** — `value` is immutable identity, not toggled. *Honors* [we:block-standard.md:271](../docs/agent/block-standard.md#L271).
- **(b)-wide — mirror state into a second survivable attr (rejected strawman).** Keep `selected` *and*
  `aria-pressed` on the survivor, synced on every toggle. This is the expensive (b): a permanent
  dual-source-of-truth for the *state* key, the drift bug APG cautions against. Correctly disliked — but it is
  *not* the only (b); the card originally conflated it with (b)-narrow.

```js
// Fork 1 (b)-narrow — un-exclude `value`; identity reads the SAME name pre- and post-upgrade:
get excludedAttributes() { return ['selected', 'count', 'variant']; }  // ← drop 'value' (was line 53)
// → survivor is <button value="open" aria-pressed="true" …>; consumer reads chip.getAttribute('value') in BOTH phases.

// consumer (unchanged delegated read; identity now phase-stable):
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.fui-filter-chip');
  if (!chip) return;
  applyFilter(chip.getAttribute('value'),                       // ← one identity key, valid pre & post upgrade
              chip.getAttribute('aria-pressed') === 'true');    // forced a11y state key (post-upgrade live read)
});
```

**Default: Fork 1 (b)-narrow.** Make the mechanism stable where it is *free* (identity `value` survives by its
authored name), and document only the one genuinely-forced rename (`selected`→`aria-pressed`). This is the
position that satisfies the survey's "reflected-and-stable" lesson without the dual-state cost of (b)-wide.

**Statute reconciliation (skeptic pass-2, #1886).** `codifiedIn` → FUI transient-family contract doc + a
cross-ref in [we:block-standard.md:271](../docs/agent/block-standard.md#L271). :271 promises transient blocks
*keep* "attribute-shaped reactivity and native events". (a) would have **broken** that promise (drops `selected`,
renames `value`) and needed :271 amended; **(b)-narrow honors it** — the authored identity attribute is kept, and
the single `selected`→`aria-pressed` rename is recorded as the explicit, a11y-justified exception to :271's
keep-the-attribute rule. No statute amendment required; the cross-ref states the one carve-out.

`Skeptic:` REFUTED → flipped (a)→(b)-narrow. The attack: (a) is "docs over mechanism," which the grounding survey
explicitly ranks lower, and it contradicts its own [we:block-standard.md:271](../docs/agent/block-standard.md#L271)
anchor. Pass-1 separated the *forced* state rename (`selected`→`aria-pressed`, a11y) from the *gratuitous* identity
rename (`value`→`data-value`), dissolving the card's false (a)-vs-expensive-(b) binary; (b)-narrow (un-exclude
`value`) is free and statute-honoring. Pass-2 found the :271 overlap (now reconciled above). Pass-3: APG citation
downgraded — it authorizes only the *state* key, not the identity/phase question, so it no longer "blesses" the
`value` rename.

## Not a merit fork — deferral: should the transient element ship a stable change event now?

**This is a prioritization call, not a design decision, and should not be ratified as a peer fork to Fork 1.**
The *design* is already settled (if shipped: a bubbling `CustomEvent` reusing the B-family convention, below).
The only open question is **timing** — build it now vs. defer — which is resolved by YAGNI/sequencing, not by a
principle. Recorded here so the ruling shows it was considered; the live trip-wire lives on **#1960**.

*Sequencing:* additive, so it does not compete with the read contract. **Supersedes #1960's Fork 2** — the event
is a FUI build, so if it is ever built it is built here (FUI locus) and #1960 consumes the outcome.

- **(a) — no, not now.** *(default)* APG's blessed baseline is native `click` + read `aria-pressed`, **no**
  custom event; delegation already works for every current consumer. A `chip-change` CustomEvent would
  **double-fire with native `click`** (both bubble to the same ancestor → consumers must bind exactly one), and
  **no A-family transient element ships a CustomEvent today** — they expose state via native events + attributes;
  only persistent B-family behaviors dispatch (`step-change`, [fui:StepperBehavior.ts:20-21](../../frontierui/blocks/stepper/StepperBehavior.ts#L20-L21)).
  Keep advisory.
- **(b) — yes, ship it now.** A bubbling `CustomEvent` on the upgraded button reusing the B-family convention.
  Removes any need for consumers to know the toggle semantics; costs cross-repo FUI work, a permanent public API,
  and the native-`click` double-signal.

```js
// Fork 2 (b) — what shipping it looks like, and the double-fire it carries:
btn.addEventListener('click', () => {
  const pressed = btn.getAttribute('aria-pressed') === 'true';
  btn.dispatchEvent(new CustomEvent('chip-change', { detail: { value: btn.dataset.value, pressed }, bubbles: true }));
});
// …native `click` ALSO bubbles to document — a delegated consumer now sees BOTH per toggle and must bind one.
```

**Default: Fork 2 (a) — no, not now (advisory).** Un-gate trigger (concrete): a *named* second consumer that
genuinely **cannot** satisfy its need via delegate-on-native-`click` + `aria-pressed` read — e.g. a
framework/non-DOM binding needing the change signal without a DOM listener. Until then it is YAGNI and nets a
double-signal. Design systems that *do* ship a toggle event (Shoelace `sl-change`) explicitly tell consumers to
stop listening to `click` — the discipline a bespoke event would force on every WE/plateau consumer.
**Tracking (skeptic amendment):** the trigger is carried on the consumer card **#1960** (which `blockedBy` this
one) — when a consumer there hits the can't-delegate wall, it resurfaces the event as a real item rather than
relying on this advisory not to rot.

`Skeptic:` SURVIVES (as advisory). No named near-term consumer cannot delegate; the shipped fix already works via
`click`+`aria-pressed`; the double-fire trap and "no A-family element ships an event" both hold. Strongest attack
beaten — "a non-DOM binding might need it" — because the default names a concrete un-gate trigger, leaving the
door open without paying the double-signal now. Amendment folded: the trigger is tracked on #1960, not left as
bare prose.

## Context

- Split out of **#1960** (WE↔FUI chip-upgrade listener contract) when the "read `aria-pressed`" question
  surfaced that the state attribute *renames* across the upgrade — a transient-API question, not a chip
  consumer-rule question. #1960 is `blockedBy` this card.
- WE holds zero implementation (#1282): any reflected-attr/event change (Fork 1(b)/2(b)) is built in FUI; the WE
  side only codifies the resulting consumer rule.
- Prior-art survey + standards citations: [relatedReport](../reports/2026-06-29-transient-element-exposed-api.md)
  and the [/research/ topic](/research/transient-element-exposed-api/).
