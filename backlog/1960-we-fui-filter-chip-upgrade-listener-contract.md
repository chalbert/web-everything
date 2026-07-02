---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-29-we-fui-chip-upgrade-listener-contract.md
tags: [webcomponents, fui-boundary, filter-chip, transient-element, decision]
---

# WE↔FUI chip-upgrade listener contract: codify the consumer rule; gate it? ship a FUI event?

A FUI `<we-filter-chip>` is a transient custom element (the `TransientElement` self-replacement pattern,
[we:block-standard.md:243](../docs/agent/block-standard.md#L243), family **(A)**): on upgrade it **replaces
itself with a native `<button class="fui-filter-chip">`** ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)
`queueMicrotask(() => this.replaceWith(el))`), and the original element — with any listeners bound directly
to it — is detached and discarded. WE-side JS that wires those chips loses any handler it attached *before*
the upgrade, and any cached element reference goes stale. This shipped twice as a regression on the
`/backlog/` Prioritisation table; the summary count pills (`data-pfilter`) used direct `addEventListener` and
silently stopped filtering the moment the FUI module loaded.

## Grounding digest (from prep — [relatedReport](../reports/2026-06-29-we-fui-chip-upgrade-listener-contract.md))

- **Only the *host* element's own listeners are lost.** The base **moves** child nodes
  ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts), lines
  ~67–68) so listeners on *children* survive; `decorate`
  ([fui:blocks/filter-chip/FilterChipElement.ts](../../frontierui/blocks/filter-chip/FilterChipElement.ts)
  lines 56–84) **copies every attribute** onto the native button (so `data-pfilter`/`data-pready` and a
  computed `aria-pressed` **survive the upgrade**). The DOM exposes **no API to enumerate/transfer an
  element's own listeners** — so a "preserve the bound handlers" fix is *mechanically impossible*.
- **The fix already shipped and is regression-netted.** [we:src/assets/js/backlog-table-sort.js:198-235](../src/assets/js/backlog-table-sort.js#L198)
  delegates on `document` and live-re-queries for *every* chip class; the deterministic interaction lane
  [we:tests/interaction/backlog-priority-filters.spec.ts](../tests/interaction/backlog-priority-filters.spec.ts)
  drives a **mock self-replacing chip** and asserts post-upgrade filtering still works.
- **FUI has a stable-event precedent — but only on *persistent* (B-family) hosts** (`tab-change`,
  `step-change`, `dock`; convention `new CustomEvent(name, { detail, bubbles: true, cancelable })`,
  [fui:blocks/stepper/StepperBehavior.ts](../../frontierui/blocks/stepper/StepperBehavior.ts) lines 20–21).
  **Every transient (A-family) element** (`we-button`/`we-badge`/`we-meter`/`we-text-field`/`we-filter-chip`)
  exposes state via native events + attributes, **never a CustomEvent**.
- **An open `addEventListener` sniff is already a *rejected* gate shape** — `compose-dont-handroll` (#933,
  [we:platform-decisions.md:728](../docs/agent/platform-decisions.md#L728)) rules it a "false-positive
  factory" and mandates a **curated, selector-scoped deny-list** instead (working precedent:
  `COMPOSE_DENY_LIST`, [we:scripts/check-standards-rules.mjs:1624](../scripts/check-standards-rules.mjs#L1624)).

## #1962 context (2026-07-01, wrapper-first)

#1962 ruled the block catalog **wrapper-first**: `we-filter-chip` (a behaviour-free leaf) is migrating off the
transient self-erase shape to **persistent light-DOM** under the FUI transient→wrapper migration. Once it
migrates, **the chip no longer self-replaces**, so the motivating regression here (host listeners lost on
upgrade) **dissolves at the source** — there is no upgrade to survive. Two consequences:

- The **specific filter-chip forks below become moot** post-migration; they stand as near-term mitigations until
  the migration lands.
- The **general consumer rule** ("delegate on a stable ancestor; never cache a self-replacing node") remains
  valid — but now as guidance for the **reserved transient case** (content-model children), not the block
  catalog. Re-scope the codified rule to that reserved case rather than "FUI transient elements" broadly.

## The axis

The framing in the original card — *"which side of the WE↔FUI boundary owns the durable fix, A or B"* — is a
**false dichotomy** (the pass-0 / skeptic finding that reshaped this prep). WE must codify a consumer-facing
rule **either way**: even under a full Fork-B, WE "only consumes it and codifies the consumer-facing
contract" (WE holds zero implementation, #1282). And a FUI event would be **additive**, not exclusive —
native `click` still bubbles to the same delegated ancestor, so an event *supplements* delegation, it does
not replace it. So the decision is not one boundary fork; it decomposes into one **forced invariant** (codify
the consumer rule — already shipped) plus **one genuine residual choice**: *whether FUI should additionally
ship a stable event now* (Fork 2). The enforcement question, originally authored as Fork 1, was **dissolved
by the 2026-07-01 two-confusion screen (#2091, counter-verified)** — see the settled section below; its
numbering is kept for lineage.

## Recommended path at a glance

| Element | Verdict | Why |
|---|---|---|
| **WE consumer contract** (delegate on a stable ancestor; never cache the transient node; read `data-*`/`aria-pressed`, which survive upgrade) | **Supported by default — codify, not a fork** | The alternative (bind directly to the chip) is the *shipped regression*; forced invariant. Anchors to [we:block-standard.md:271](../docs/agent/block-standard.md#L271) (transient ⇒ native events kept). |
| **Enforcement** *(settled — not a fork; dissolved 2026-07-01)* | interaction-test lane now; a #933-shaped curated gate is an *optional additive tooling build* if chip-selector wiring recurs | WE-internal tooling, invisible across the boundary; lane-vs-gate differs only on cost — ordering, not a ratify. |
| **Fork 2 — FUI ships a stable `chip-change` event?** | **No, not now** (advisory; revisit on trigger) | Delegation works today; a `chip-change` event **double-fires with native `click`**; YAGNI until a consumer genuinely can't delegate. |

## Supported by default — the WE consumer contract (forced invariant; codify)

This is **not a fork** (fork-existence test: the only alternative — bind a listener directly to the
`we-filter-chip` / cache its reference — is *broken*, it is exactly the shipped regression). Codify as a
consumer rule, anchored to the transient-family's *native-events-kept* guarantee
([we:block-standard.md:271](../docs/agent/block-standard.md#L271)) and the `we-fui-embed-boundary` cluster:

> **Wiring behaviour onto a transient (self-replacing) FUI element:** delegate the listener on a **stable
> ancestor** (container or `document`) and **re-query live**; **never** bind directly to the transient
> element and **never** cache its node reference. Read state from the attributes that **survive the upgrade**
> (`data-*`, `aria-pressed`) on the resulting native element, not from the pre-upgrade node.

```js
// ✓ survives the we-filter-chip → <button> upgrade (the shipped fix, backlog-table-sort.js:216-233)
document.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-pfilter]');      // re-query live; data-* survived the upgrade
  if (!chip) return;
  applyFilter(chip.getAttribute('data-pfilter'),
              chip.getAttribute('aria-pressed') !== 'true');  // aria-pressed set on the native button
});
// ✗ the regression: dead the instant the FUI module upgrades the chip to <button>
chip.addEventListener('click', ...);   // listener bound to a node that replaceWith() discards
```

`codifiedIn` target: `we:docs/agent/platform-decisions.md` (`we-fui-embed-boundary` cluster) + a cross-ref
from the transient-family note in `we:docs/agent/block-standard.md`.

## Settled (not a fork) — enforcement of the consumer rule (was "Fork 1")

*Screen: flagged(impl+prio) → dissolved, 2026-07-01 (#2091, counter-verified). Test-lane vs source-gate is
WE-internal enforcement tooling no consumer can observe across the boundary, and both branches yield the
identical consumer contract — the case against the additive gate was brittleness / maintenance /
duplication, i.e. cost. That makes this a tooling/ordering choice, not a ratifiable fork. Numbering kept
for lineage; nothing here needs a ratify turn.*

**Standing state:** the deterministic mock-chip lane
([we:tests/interaction/backlog-priority-filters.spec.ts](../tests/interaction/backlog-priority-filters.spec.ts))
is the enforcement — it reproduces the self-replace and asserts post-upgrade filtering, netting the
**actual** regression a source sniff only approximates. A **#933-shaped curated deny-list gate** (keyed to
the known chip selectors, following `COMPOSE_DENY_LIST`,
[we:scripts/check-standards-rules.mjs:1624](../scripts/check-standards-rules.mjs#L1624)) remains an
*optional additive tooling build*, filed and ordered like any other work **if chip-selector wiring recurs**
— its shape is already settled by statute #933 (never an open `addEventListener` sniff), so nothing about
it is a decision.

`Skeptic:` SURVIVES-WITH-AMENDMENT *(pre-dissolution history)* — the skeptic confirmed the *rule* is fine but
the originally-proposed heuristic gate is unconstitutional under #933 (open `addEventListener` sniffing
rejected). Amendment folded in: lane only; any future gate is constrained to the #933 curated-deny-list
shape.

## Fork 2 — should FUI *additionally* ship a stable `chip-change` event now?

*Fork-existence:* a genuine go/no-go — you either add the public API or you don't, and both are coherent
end-states (a future framework/non-DOM consumer might want the event; today's consumers don't). It is
*additive*, so it does not compete with the consumer rule above.

- **(a) — no, not now.** *(default)* Delegation on native `click` + reading `aria-pressed`/`data-*` already
  works for every current consumer. A `chip-change` event would **double-fire with native `click`** (both
  bubble to the same ancestor), re-introducing a "bind the right event" footgun of the same *kind* the rule
  removes; and it adds a permanent public API to a control whose transient family was chosen precisely to
  lean on **native events kept** ([we:block-standard.md:271](../docs/agent/block-standard.md#L271)), not to
  mint new ones. Keep it advisory/parked.
- **(b) — yes, ship `chip-change` now.** A built-in bubbling CustomEvent on the upgraded native button,
  reusing the FUI (B-family) convention. Removes any need for consumers to know the toggle semantics
  (`aria-pressed` flip). Costs cross-repo FUI work + a permanent API, and lives with the native-`click`
  double-signal.

```js
// Fork 2 (b) — what shipping the event looks like, and the double-fire it carries:
btn.addEventListener('click', () => {
  const pressed = btn.getAttribute('aria-pressed') === 'true';
  btn.dispatchEvent(new CustomEvent('chip-change',
    { detail: { value: btn.dataset.value, pressed }, bubbles: true }));  // bubbles to document…
});
// …but native `click` ALSO bubbles to document — a delegated consumer now sees BOTH signals per toggle
// and must bind exactly one. Fork 2 (a) avoids this: read aria-pressed on the existing `click`.
```

**Default: Fork 2 (a) — no, not now (advisory).** Un-gate trigger (concrete): a *second* consumer
(e.g. plateau-app) that genuinely **cannot** satisfy its need via delegate-on-native-`click` + `aria-pressed`
read — for instance a framework/non-DOM binding that needs the change signal without a DOM listener. Until a
named such consumer exists, shipping the event is YAGNI and nets a double-signal.

`Skeptic:` REFUTED the original B/B2-default — the prep's first pass recommended FUI ship the event (Fork 2
(b)); the skeptic flipped it on four axes: (0) classification (false dichotomy — WE codifies a rule either
way; the FUI event is a *separately-prioritized additive build*, not a boundary fork); (1) merit (the event
**double-fires with native `click`**); (2) statute-overlap (a bespoke event sits in tension with #1381's
*native-events-kept* clause for family A); (3) citation-scope (#1381 governs *mechanism-selection*, not
event-API design — its native-events-kept clause argues *for* delegating on native `click`, the opposite of
what the original prep cited it for). Default flipped (b)→(a) and folded into the shape above.

`Screen:` clear — fresh-context two-confusion screen (#2091), 2026-07-01: the event is boundary-observable
public API, and with cost stripped a merit difference remains (the native-`click` double-signal vs a
framework consumer that cannot delegate) — a genuine additive go/no-go with a concrete un-gate trigger.

## Context

- Surfaced from the Prioritisation-table regressions ([we:backlog-table-sort.js](../src/assets/js/backlog-table-sort.js)):
  dead summary pills + a silently-emptied table, both rooted in the upgrade dropping consumer wiring.
- Locked in by a deterministic interaction-test lane (`tests/interaction/`) whose **mock `<we-filter-chip>`**
  reproduces the self-replace; that harness is the regression net regardless of which fork is ratified.
- Boundary rule: WE holds zero implementation — so the consumer contract is codified WE-side as a *rule*
  (gates/validate-scripts are the only thing permitted in WE); any FUI event (Fork 2 (b)) is built in FUI.
