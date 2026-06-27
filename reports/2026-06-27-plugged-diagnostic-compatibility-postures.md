# Plugged diagnostic & compatibility postures — prior-art + architecture prep (decision #1872)

**Date:** 2026-06-27
**Decision:** [#1872](../backlog/1872-plugged-diagnostic-mode-zero-behaviour-change-residue-probe-.md) —
a config-selectable **posture family** between `unplugged` and `plugged`, built on a *pass-through* Proxy over
the native methods plugged mode patches (`createElement`, insertion methods) that **never changes method
semantics — only observes**. Two new postures: **diagnostic** (warn when unowned code hits a path `unplugged`
silently no-ops) and **compatibility** (enqueue an automatic `upgrade(root)` for un-upgraded roots unowned code
touches, recovering *portable* capabilities without prototype patching).
**Parent:** [#1836](../backlog/1836-...-make-every-plug-public-api-functional-unplugged.md) (make every plug
public API functional unplugged); built on the [#1839](../backlog/1839-...-residue-bar.md) residue bar.
**Relates:** [#1844](../backlog/1844-...-static-parity-table.md) (static parity table), [#1167](../backlog/1167-...-autonomous-explorer.md) (explorer — a consumer of diagnostic output).

## The question

`unplugged` is the clean, manual `register`/`upgrade(root)` product surface
(`fui:plugs/unplugged.ts:36-177`) — but it **silently misses unowned construction**: a third-party lib that
builds a subtree and inserts it without ever calling `upgrade()` gets no WE capabilities, with no signal that
anything was missed. `plugged` (`fui:plugs/bootstrap.ts:114-140`) recovers everything by patching the page
realm's prototypes — but that is exactly the heavy, semantics-altering posture the epic exists to make optional.
The proposal asks: is there a **middle** that keeps native method semantics untouched (the invariant that
separates it from `plugged`) yet still (a) *signals* the miss and (b) *retroactively recovers* the portable
slice of capability — and what are the right defaults for the four mechanism choices that build it?

The hard boundary is set by the **residue bar** (`we:docs/agent/platform-decisions.md:888-894`,
`#plugged-only-residue-bar`): a capability is genuine residue **iff** its observable contract requires
intercepting a native method on a node the plug holds *no handle to* **and** that contract — *including
transparency* — cannot be reproduced by WeakMap-keyed out-of-band state. Everything else is *portable*
(`fui:plugs/core/ElementAttachment.ts` — the `WeakMap`-keyed attachment #1842 landed). The compatibility posture
recovers exactly the portable set and **no further**: a detached node never inserted produces no root call to
observe, and transparent `createElement` tagging needs the value *at creation* not insertion — so true Fork-1
residue stays `plugged-only`.

## Prior art — the patterns this posture family mirrors

The survey is decisive: every piece of this mechanism is a well-trodden web-platform pattern, and each community
has already settled the tradeoff we face.

### 1. The Custom Elements UPGRADE lifecycle — the compatibility posture's exact model

`customElements.upgrade(root)` **is** the compatibility posture in miniature. Per
[MDN](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/upgrade) and the
[WHATWG HTML spec §4.13](https://html.spec.whatwg.org/multipage/custom-elements.html):

- It **upgrades all custom elements in a subtree, even before they are connected** — i.e. retroactively
  enhances DOM that arbitrary code built but never initialised. This is precisely "a lib inserts a subtree,
  never calls `upgrade()`".
- It is **idempotent**: upgrading an already-upgraded element is a no-op (the element's *custom element state*
  is already `custom`; the upgrade reaction early-returns). MDN's worked example asserts `el instanceof
  SpiderMan` only flips on the *first* `upgrade()`.
- The platform splits the work two ways by design: the per-element upgrade itself runs **synchronously** the
  moment a connected element is reached, but the *discovery* of candidates is **batched** — the spec keeps an
  **upgrade-candidate registry** ("an ordered set of elements") and enqueues a *custom element upgrade reaction*
  per candidate, drained off the **backup element queue / microtask checkpoint**
  ([PR whatwg/html#3535](https://github.com/whatwg/html/pull/3535/files)). The lesson WE should copy: **make the
  individual upgrade synchronous and idempotent, but batch the discovery/scheduling**.
- Un-upgraded-but-disconnected elements are a real category the spec explicitly serves with `upgrade()` — the
  same category our residue bar calls "no root call to observe", confirming the boundary is principled, not an
  implementation gap.

### 2. MutationObserver-driven retroactive enhancement — global vs per-root cost

The granularity question (Q1) is an active WHATWG debate.
[whatwg/dom#1287](https://github.com/whatwg/dom/issues/1287) argues that **per-root observation is
insufficient** for polyfills that retroactively enhance DOM built by arbitrary code: components create roots
unpredictably, so per-root requires either tight coupling (every creator must opt the observer in) or a
"brute-force" loop over all elements that the issue calls *"extremely wasteful."* The proposal is a single
**global-observe** primitive precisely because N per-root observers don't compose and miss
declarative/pre-existing roots. [MDN's MutationObserver
guide](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe) confirms `subtree: true`
already extends one observer to a whole subtree — so one observer scales better than many. **Paradigm: one
global instrument beats N per-root instruments for catching unowned construction; the cost is a single
always-on observer, not per-root setup/teardown bookkeeping.** This is the same conclusion `plugged` already
embodies (one set of prototype patches, not per-root).

### 3. JS Proxy as a transparent pass-through OBSERVER

The substrate is a Proxy that forwards every operation to the native target and only *observes*. Per
[MDN Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) and
[javascript.info/proxy](https://javascript.info/proxy): a handler with no traps is a **transparent wrapper**;
the discipline is to **use `Reflect.apply`/`Reflect.get` inside each trap to forward default behaviour
unchanged**, so semantics are provably preserved. Two pitfalls the survey flags directly bear on us:

- **Identity** ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)):
  `proxy === target` is `false`. If we install the Proxy *as* `document.createElement`, callers doing
  `document.createElement === origCreateElement` break — but that is an exotic check; the real risk is
  re-entrancy and `this`-binding, handled by `Reflect.apply(target, thisArg, args)`.
- **Performance**
  ([EisenbergEffect](https://eisenbergeffect.medium.com/the-prickly-case-of-javascript-proxies-b6c3833b738)):
  trap invocation is measured **5–20% slower than raw access**; the community rule is *selective/filtered*
  observation, never wrapping hot paths broadly. For us this argues the Proxy wraps only the handful of residue
  methods (`createElement` + insertion verbs), not the whole DOM — which is what the residue surface already is.

**Paradigm: a no-semantic-change observer is a Reflect-forwarding Proxy/wrapper on a *small, named* method set;
the cost is a constant per-call trap overhead on those methods only.**

### 4. Polyfill "compatibility mode" — patching vs non-patching

The plugged/unplugged seam is the same tension the web-components polyfills settled as **patching vs
`noPatch`**. Per the [Polymer polyfills docs](https://polymer-library.polymer-project.org/3.0/docs/polyfills)
and [ShadyDOM #237](https://github.com/webcomponents/polyfills/issues/237): the **patching** path rewrites
native DOM methods so any code self-upgrades regardless of load order (convenience, broad reach — our
`plugged`); the **`noPatch`** path avoids mutating natives but demands explicit cooperation/ordering
(predictability, lower blast radius — our `unplugged`). Lit ships a `polyfill-support` shim that *detects*
`ShadyDOM.noPatch` and adapts — i.e. a **posture is a selectable mode the consumer picks, with the library
adapting behaviour to it**, exactly the config-selected posture menu #1872 proposes. The communities converged
on offering *both* modes rather than picking one — supporting the "config dimension, not exclusive fork"
reading of several questions below.

### 5. Microtask batching / dedup for coalescing upgrades

The scheduling question (Q2) is the canonical **dirty-set + microtask-flush** pattern. Per
[MDN's microtask guide](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) and
[the queueMicrotask patterns writeup](https://thelinuxcode.com/nodejs-queuemicrotask-microtasks-event-loop-ordering-and-real-world-patterns-i-actually-use/):
collect repeated synchronous calls into a set, schedule **one** `queueMicrotask` flush per tick, and you flush
once no matter how many times you were called — Vue's reactivity and React 18's automatic batching both use
this. The dedup falls out naturally: a `Set<RootNode>` of dirty roots collapses N insertions touching the same
root into one `upgrade(root)`; `upgrade` being idempotent (finding 1) makes even a duplicate flush harmless. The
one documented hazard — **recursive microtask starvation** (a flush that schedules more microtasks) — is
avoided by flushing a *snapshot* of the dirty set and clearing it before draining.

## The WE semantic delta

What is genuinely new here, beyond the borrowed paradigms: WE applies the residue bar **live**. The platform's
`customElements.upgrade()` recovers one capability (element classness); our compatibility posture runs the
*whole registered plug set*'s `upgrade(root)` (`fui:plugs/unplugged.ts:126-143`) against roots that unowned code
touched — recovering every *portable* plug capability (behaviors, contexts, stores, expressions…) without any
prototype patch. The Proxy is not a polyfill of a missing native method; it is an **observation tap on the
residue surface** whose sole output is either a dev warning (diagnostic) or a dirty-set entry (compatibility).
The invariant — `Reflect`-forward, never alter the return/effect of the native call — is what keeps all four
postures honestly *not* `plugged`: `plugged` is the only posture that changes what the native method *does*.

## The four questions — standing-test verdict, options, recommended default

> **Standing test applied to each:** is this a *real fork* (one branch broken, or two coherent branches that
> genuinely cannot coexist), or is it **support-both / a config dimension** with a default? Three of the four
> dissolve into config dimensions; one is a real fork.

### Q1 — Proxy granularity: one global native-method Proxy vs per-root instrumentation

**Verdict: real fork (not a dimension).** The two are not composable end-states for the *same* job — you pick
one mechanism to catch unowned construction. Per-root cannot even see construction by code that never hands you
the root (the whole motivating case), so it isn't a coherent second branch for the stated goal.

- **Global native-method Proxy** — one Reflect-forwarding wrapper on `createElement` + insertion verbs; catches
  *all* unowned construction; constant trap cost on those methods; trivial teardown (restore the originals).
- **Per-root instrumentation** — a MutationObserver per attached root; misses construction on roots you were
  never given (whatwg/dom#1287's core complaint); N-observer bookkeeping and teardown; "brute-force" scanning is
  *"extremely wasteful."*

**Recommended default: global native-method Proxy.** *Confidence: high.* It is the only branch that actually
satisfies "observe unowned construction", it mirrors what `plugged` already does (one realm-level instrument),
the Proxy-perf literature says a *small named method set* is the safe place to pay trap cost, and teardown is a
clean restore. Per-root is defeated by the motivating case, not merely costlier. (Note: a MutationObserver with
`subtree:true` is the natural *complement* for the **insertion** signal — "this root just got touched" — while
the Proxy carries the **construction** signal; that's one global instrument of each kind, still global, not
per-root.)

### Q2 — Compatibility upgrade scheduling: sync vs microtask queue; dedup; ordering

**Verdict: real fork on sync-vs-async (they cannot coexist for a given trigger), but the dedup/idempotency parts
are settled mechanics, not forks.** You either run `upgrade(root)` inside the observed call or defer it.

- **Synchronous (upgrade inside the trap)** — recovers capability immediately, but **re-enters the page's own
  mutation mid-call** (the page inserts, we synchronously upgrade before its next line) and pays full upgrade
  cost on every touch with no coalescing — re-orders effects relative to the page.
- **Microtask queue (dirty-set + `queueMicrotask` flush)** — collect dirty roots, flush once per tick; dedups
  repeated touches of the same root into one idempotent `upgrade`; runs *after* the current synchronous burst so
  it never interleaves with the page's own mutations; matches Vue/React-18 batching and the platform's own
  batched upgrade-candidate draining.

**Recommended default: microtask-batched dirty-set, leaning on `upgrade`'s idempotency for dedup.**
*Confidence: high.* The platform itself batches upgrade-candidate discovery while keeping the per-element upgrade
synchronous — we copy that split exactly: *discovery batched, the `upgrade(root)` call itself synchronous when
the flush runs*. Microtask (not `setTimeout`) keeps recovery within the same task so it's invisible to the
page's macrotask logic; flushing a snapshot avoids recursive-starvation. Idempotent `upgrade` (Q-finding-1)
makes a doubled flush a no-op, so dedup is "nice-to-have for cost", not correctness-critical. *Residual:* if a
consumer needs synchronous recovery (rare; e.g. it reads a WE capability in the same tick it inserts), expose a
`flush()` escape hatch rather than making sync the default — file as a follow-up only if a real consumer
appears.

### Q3 — Per-plug vs global posture selection in the config schema

**Verdict: NOT a fork — a config dimension (support both, with a default).** Per-plug and global are not
mutually exclusive: the standard shape is **a global default the project sets, overridable per-plug**, exactly
the `config-extends-platform-default` carve already ratified (`project_config_surface_three_layer_carve`). One
branch isn't broken; they coexist as default + override.

- Global-only — one posture for the whole page; simplest schema; can't say "diagnostic everywhere but
  compatibility for the one legacy widget".
- Per-plug-only — maximal control; verbose; no sane single knob for "just turn diagnostics on".
- **Global default + per-plug override** — `{ posture: "diagnostic", plugs: { webcontexts: "compatibility" } }`;
  one knob for the common case, granular escape for the exception.

**Recommended default: global default + optional per-plug override.** *Confidence: high.* This is the
most-flexible-default bias (`feedback_most_flexible_default`) and the literal shape of the three-layer carve:
the WE type-only enum offers the menu, the project config sets a global value, and an optional per-plug map
overrides. Make the per-plug map *optional* so the 90% case is a single string. The contract/enum lives in WE
(type-only), the resolver/impl in FUI, the selected values in the project config — no new architectural seam.

### Q4 — Parity-table coupling (#1844): does compatibility move a capability's displayed state?

**Verdict: NOT a fork — a presentation choice that the residue bar already decides.** The table states a
*measured fact about the FUI runtime under `unplugged`* (`we:docs/agent/platform-decisions.md:892`); compat is a
*runtime posture*, not a change to that fact, so they don't conflict — compat is additive metadata.

- **Move the state** — under compat, a portable-but-not-yet-triggered capability would display `works`. But this
  *lies about the unplugged truth* and couples a static table to a runtime config value, breaking the table's
  "measured fact" contract.
- **Posture-neutral table + a separate "recoverable under compatibility" column/footnote** — the row keeps its
  `unplugged` 3-state verdict (`works` / `works-with-caveat` / `plugged-only`); a separate column marks whether
  the gap is *closed by the compatibility posture* (portable) vs *true residue* (Fork-1, never closed).

**Recommended default: posture-neutral table; compatibility is a separate column/footnote.** *Confidence: high.*
The residue bar already partitions capabilities into portable vs plugged-only; the compat column is just the
*display* of that existing partition restricted to the `plugged-only`-looking rows that are actually merely
not-yet-triggered. It keeps the table a stable measured fact (#1844's contract), avoids coupling a doc artifact
to a runtime knob, and gives the reader the genuinely useful distinction: "this gap closes if you turn on
compatibility" vs "this gap is the real missing standard". This is bias-toward-separation
(`feedback_bias_separation_decoupling`): two facts (unplugged state; compat-recoverable) → two columns.

## Forks the survey added or dissolved

- **Dissolved Q3 and Q4** from forks into a config dimension (Q3) and a presentation choice the residue bar
  already settles (Q4). Neither has a broken branch; both are support-both/default.
- **Sharpened Q2**: the sync-vs-async *is* a real fork, but the dedup/idempotency sub-questions are settled
  mechanics (the platform's own batched-discovery/synchronous-upgrade split + idempotent `upgrade`), not open
  forks. Surfaced one **residual** (a `flush()` escape hatch for sync recovery) rather than a fork.
- **Added no new fork.** The survey *confirmed* Q1 is the one genuine, non-composable fork (global Proxy beats
  per-root on the motivating case, per whatwg/dom#1287).

## References

- [CustomElementRegistry.upgrade() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/upgrade)
- [Custom elements §4.13 — WHATWG HTML Standard](https://html.spec.whatwg.org/multipage/custom-elements.html) ·
  [Add customElements.upgrade() — whatwg/html#3535](https://github.com/whatwg/html/pull/3535/files)
- [Global shadow-tree observation for polyfills — whatwg/dom#1287](https://github.com/whatwg/dom/issues/1287) ·
  [MutationObserver.observe() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe)
- [Proxy — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) ·
  [Proxy and Reflect — javascript.info](https://javascript.info/proxy) ·
  [The Prickly Case of JavaScript Proxies — Eisenberg](https://eisenbergeffect.medium.com/the-prickly-case-of-javascript-proxies-b6c3833b738)
- [Polymer polyfills (patching vs noPatch)](https://polymer-library.polymer-project.org/3.0/docs/polyfills) ·
  [ShadyDOM noPatch — webcomponents/polyfills#237](https://github.com/webcomponents/polyfills/issues/237)
- [Microtask guide — MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) ·
  [queueMicrotask batching patterns](https://thelinuxcode.com/nodejs-queuemicrotask-microtasks-event-loop-ordering-and-real-world-patterns-i-actually-use/)
- Internal: [#1872](../backlog/1872-plugged-diagnostic-mode-zero-behaviour-change-residue-probe-.md),
  residue bar (`we:docs/agent/platform-decisions.md:888-894`),
  `fui:plugs/unplugged.ts`, `fui:plugs/bootstrap.ts`, `fui:plugs/core/ElementAttachment.ts`.
</content>
</invoke>
