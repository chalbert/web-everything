---
kind: decision
size: 8
status: open
parent: "1836"
relatedProject: webplugs
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-plugged-diagnostic-compatibility-postures.md
tags: [plugs, unplugged, residue, diagnostic, compatibility, dev-experience, config]
---

# Plugged diagnostic & compatibility modes: a zero-semantics-change observe-only posture family between unplugged and plugged

## Digest

A config-selectable posture family **between** unplugged and plugged, built on an **observe-only
prototype-method wrapper** over the native methods plugged patches (`createElement`, insertion methods) that
**never changes method semantics — only observes**. Two new postures: **diagnostic** warns when unowned code
hits a path unplugged silently no-ops (the #1839 residue surface); **compatibility** enqueues an automatic
`upgrade(root)` for un-upgraded roots unowned code touches, recovering *portable* capabilities without prototype
patching. Two real forks: the **observation instrument** (one global instrument; wrapper vs a global
MutationObserver for compatibility) and **upgrade scheduling** (microtask-batched + a shipped `flush()`).
Per-plug-vs-global selection and parity-table coupling are **support-both/config**, not forks.

## Substrate correction (skeptic-folded) — it is a prototype-method wrapper, NOT a JS `Proxy`

The original framing called the substrate a "pass-through Proxy." That is a **mismodel**: there is **no
`new Proxy` anywhere in the plugs tree**, and plugged itself works by **reassigning prototype members** —
`Document.prototype.createElement` (`fui:plugs/webinjectors/Node.injectors.patch.ts:88`),
`Object.defineProperties(Element.prototype, { append, prepend, … })`
(`fui:plugs/core/utils/pathInsertionMethods.ts:180`, which captures the `originalDescriptor` first). The
posture substrate "mirrors what plugged already does" **only** if it is the same shape — `const original =
proto.method; proto.method = function (…) { observe(this); return original.apply(this, …) }`. This is strictly
safer than a `Proxy` (no `proxy !== target` identity break, no `instanceof` surprise, no exotic-object traps).
Everywhere below, "instrument" / "wrapper" = this observe-then-forward prototype patch, not a `Proxy`.

## The spectrum

One observe-only instrument over the residue surface, four postures of increasing intervention — the invariant
across all of them is **native method semantics are never altered** (that is what separates this from plugged):

1. **unplugged** *(baseline, exists)* — clean, manual `register`/`upgrade(root)`; the safe-now product surface
   (#606, `fui:plugs/unplugged.ts`). Unowned construction silently misses.
2. **diagnostic** — install observe-only instrumentation on the residue surface. On a call unplugged can't
   reproduce, **warn** (call-site, which plugged-only capability, the manual fix). The degenerate observe-only
   case of the substrate.
3. **compatibility** — same observation, but on detecting an **un-upgraded root** touched by unowned code,
   **enqueue `upgrade(root)`** (batched, deduped) so the portable capabilities apply retroactively — *without*
   patching the method's own behavior. More like an upgrade queue than a patch.
4. **plugged** *(exists)* — full prototype patching; the only posture that reaches true residue
   (`fui:plugs/bootstrap.ts:114-184`).

The hard boundary stays the #1839 residue bar (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`):
a detached node never inserted produces **no root call to observe**, and transparent `createElement` tagging
needs the value **at creation** not insertion — so the genuinely-missing-hook cases stay `plugged-only`.
Compatibility narrows the gap to *precisely* that residue, no further.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| **Fork 1 — observation instrument & scope** | **One global prototype-method wrapper (observe-then-forward), not per-root** | A global MutationObserver (compatibility-only, no call-site) | High on global; med-high on wrapper-vs-MO |
| **Fork 2 — compatibility upgrade scheduling** | **Microtask-batched dirty-set flush + a shipped synchronous `flush()`** | Synchronous upgrade-on-detect | Med-high (batched right; `flush()` mandatory) |

**Supported by default (not forks):** per-plug-vs-global posture selection (config dimension), parity-table
coupling (presentation choice, already settled by the residue bar). See *Supported by default*, below.

## Fork 1 — the observation instrument and its scope

*Fork-existence:* **per-root instrumentation is the broken branch** — it cannot see roots that unowned code
*never hands you*, which is the entire motivating case ("a 3rd-party lib builds a subtree and inserts it but
never calls `upgrade()`"); whatwg/dom#1287 calls per-root scanning "extremely wasteful," and native
`customElements.upgrade` uses a realm-level candidate registry, not per-root. So **one global instrument** is
forced. The genuine residual either/or is *which* global instrument, and it differs by posture (sub-fork below)
— diagnostic needs call-site attribution that only the method wrapper gives, so the instruments don't collapse
to one trivially.

- **One global prototype-method wrapper (observe-then-forward) — RECOMMENDED.** Wrap the **same** small method
  set plugged already patches (`createElement`, the insertion methods) with observe-only bodies. It is a strict
  **subset** of what plugged wraps, with a **lighter** body (observe vs construct-and-swap,
  `fui:plugs/core/utils/pathInsertionMethods.ts`), so its perf/compat blast radius is *smaller* than a posture
  (plugged) that already ships and passes its third-party-lib interaction harness
  (`fui:plugs/__tests__/patch-interaction.test.ts`). It gives **call-site attribution** (which the diagnostic
  posture's warning needs) and serves both postures from one hook.
  - **Sub-fork (instrument per posture):** *diagnostic* must use the method wrapper (call-site is the whole
    point); *compatibility* could instead use a **global `MutationObserver(subtree:true)`** on `document` — a
    post-hoc, semantics-free tap that observes every connected insertion *without patching any method* (even
    more "never alter the native call" than wrapping `append`), at the cost of no call-site. **Default: the
    unified method wrapper** (one substrate, call-site available); evaluate the MutationObserver as a lighter
    compatibility-only instrument at build time — it is a real, under-explored alternative, not a rejected one.
- **Per-root instrumentation** — *Rejected.* Defeated by the motivating case (can't see un-handed roots) and
  wasteful (whatwg/dom#1287).

*Riders (skeptic-folded, must be stated in the build):* (1) the postures and plugged both own
`Element.prototype.append` etc., so they are **install-time mutually exclusive** — never co-installed (the
spectrum is pick-one, fine). (2) insertion-patch teardown is currently **irreversible**
(`fui:plugs/webcomponents/Element.insertion.patch.ts` `removePatch` is a no-op for insertion methods), so
**switching posture at runtime needs a page reload**, not a hot swap.

*Code example (Fork 1 default — observe-then-forward wrapper, and the compatibility-only MO alternative):*

```ts
// RECOMMENDED: a prototype-method WRAPPER (NOT a Proxy) — same shape as the existing plugged patches
// (cf. fui:plugs/webinjectors/Node.injectors.patch.ts:88), body reduced to observe-then-forward.
const original = Element.prototype.append;
Element.prototype.append = function (...nodes) {
  observeResidueHit('Element.append', this);   // diagnostic: warn w/ call-site; compatibility: enqueueUpgrade(this)
  return original.apply(this, nodes);          // semantics unchanged — forwarded verbatim
};

// Compatibility-ONLY alternative under evaluation: a global MutationObserver — no method patch, no call-site.
new MutationObserver(records => {
  for (const r of records) for (const n of r.addedNodes) enqueueUpgrade(n);  // post-hoc, semantics-free
}).observe(document, { childList: true, subtree: true });
```

*Skeptic: SURVIVES-WITH-AMENDMENT — global beats per-root (high confidence): per-root cannot see un-handed
roots (whatwg/dom#1287), the motivating case. Two amendments folded: **(1)** the substrate is a
**prototype-method wrapper, not a `Proxy`** — verified no `new Proxy` in the plugs tree and plugged patches
prototype members (`fui:plugs/core/utils/pathInsertionMethods.ts:180`), so the "mirrors plugged" grounding only
supports the wrapper, which is also strictly safer (no identity break); **(2)** split the instrument by posture
— diagnostic needs the method wrapper for call-site, but **compatibility could use a global MutationObserver**
(lighter, post-hoc, no method patch), an under-explored alternative to decide at build. Riders added:
install-time mutual-exclusion with plugged, and reload-not-hot-swap because insertion-patch teardown is
irreversible.*

## Fork 2 — compatibility upgrade scheduling

*Fork-existence:* a genuine either/or with no broken branch a priori — **synchronous upgrade-on-detect** and
**microtask-batched flush** are both coherent and produce *different observable timing*, so they cannot both be
the mechanism. Dedup/idempotency are **settled mechanics**, not a fork (`upgrade` is idempotent — re-running
just re-walks; `fui:plugs/unplugged.ts:27-28` keys an `upgradedRoots` Set).

- **Microtask-batched dirty-set flush + a shipped synchronous `flush()` — RECOMMENDED.** Collect touched
  un-upgraded roots into a dirty `Set`, flush once per microtask over a snapshot (avoids recursive
  starvation), idempotent per root. Matches the platform's *batched-discovery* path and Vue/React-18 batching;
  never interleaves mid-mutation. **The synchronous `flush()` escape hatch ships in the default** (not deferred)
  because the live-read-before-flush window is *foreseeable*: between insertion and the microtask, the
  un-upgraded root is live and a layout-measuring widget that inserted it may read pre-upgrade state — `flush()`
  lets such a consumer force the upgrade synchronously.
- **Synchronous upgrade-on-detect** — *Rejected as the default.* Immediate, but it **re-enters the page's own
  mutation mid-call** (the heavy construct-and-swap behavior the epic is trying to get away from), a documented
  re-entrancy footgun, and it cannot coalesce a hot insert loop.

*Two corrections folded (don't repeat the report's claims uncritically at ratify):* (i) **"matches the
platform" cuts both ways** — native Custom Elements upgrade for a *connected, imperatively-inserted* element is
**synchronous at connect**, batched only for *discovery*; so the platform argues *partly for* sync on this exact
trigger. The batched default still wins on the re-entrancy ground, not on a clean platform-parity claim. (ii)
**dedup is cost-load-bearing, not just nice-to-have** — `fui:plugs/unplugged.ts` `upgrade` has **no early-return
on already-upgraded roots**; it re-walks every plug on each call, so a doubled flush re-walks the whole tree.
The dirty `Set` dedup is real work-avoidance.

*Code example (Fork 2 default — batched flush + shipped escape hatch):*

```ts
const dirty = new Set();
let scheduled = false;
function enqueueUpgrade(root) {
  dirty.add(root);
  if (!scheduled) { scheduled = true; queueMicrotask(flush); }
}
function flush() {
  scheduled = false;
  const batch = [...dirty]; dirty.clear();   // snapshot first — avoid re-entrant starvation
  for (const root of batch) upgrade(root);   // idempotent, but re-walks (unplugged.ts) → dedup is cost-load-bearing
}
export function flushUpgradesNow() { flush(); }  // SHIPPED escape hatch for a synchronous post-upgrade reader
```

*Skeptic: SURVIVES-WITH-AMENDMENT — batched is the right default (re-entrancy is the worse failure of sync), but
the prepared default is amended in two ways the report under-weighted: the synchronous **`flush()` escape hatch
is promoted from follow-up to a shipped part of the default** (the live-read-before-flush window is foreseeable,
not hypothetical), and the "matches the platform" justification is corrected (native CE upgrade for connected
imperative insertion is *synchronous*; batched wins on re-entrancy, not parity). Dedup noted as cost-load-bearing
(`fui:plugs/unplugged.ts` re-walks, no early-return).*

## Supported by default (standing test → not forks)

- **Per-plug vs global posture selection — config dimension, support both.** This is the literal three-layer
  carve: the posture **enum** is a WE type-only contract, the instrument is **FUI**, the **selected value** is
  the **project config** (config-extends-platform-default). Default: a **global posture** with an **optional
  per-plug override map** (most-flexible-default — the 90% case is one string; per-plug is opt-in). No excluded
  branch ⇒ no fork.
- **Parity-table coupling (#1844) — presentation choice, already settled by the residue bar.** The static
  parity table states the **unplugged truth** (3-state, posture-neutral); compatibility adds a **separate
  "recoverable under compatibility" column/footnote** distinguishing *portable-not-yet-triggered* from *true
  residue*. Moving a capability's displayed state by posture would lie about the unplugged baseline and couple a
  static table to a runtime knob (bias-toward-separation: two facts → two columns). No excluded branch ⇒ not a
  fork.

## Per-fork classification

- **Layer (three-layer carve):** posture **enum/contract** → WE (type-only); observe-only **instrument + upgrade
  queue** → FUI impl; **selected posture value** → project config. Matches the ratified contract/impl/value
  split.
- **Protocol/intent dimension:** none — this is a plug-runtime posture, not an intent or protocol.
- **DI-injectable:** the posture is config-selected, not a runtime registry; the instrument is install-time, not
  injected per call.
- **Most-permissive default:** all postures are **dev-affordances first** — diagnostic and compatibility
  default **off in prod**; unplugged stays the safe-now baseline.
- **Seam:** diagnostic output is a signal source the autonomous explorer (#1167) can consume — a downstream
  consumer, not a coupling that changes this design.

## Lineage

Parent #1836 (make every plug public API functional unplugged). Built on the #1839 residue bar — the strict
contract-portability predicate it applies **live** (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`).
Relates #1844 (parity table — the static counterpart), #1167 (explorer — a consumer of diagnostic output),
#1858 (unplugged ergonomics). Prepared 2026-06-27: prior-art survey (Custom Elements upgrade lifecycle,
MutationObserver auto-upgrade, Proxy-vs-prototype-patch, polyfill patching postures, microtask batching) +
FUI-tree grounding, published as research topic `plugged-diagnostic-compatibility-postures` and report
[we:reports/2026-06-27-plugged-diagnostic-compatibility-postures.md](reports/2026-06-27-plugged-diagnostic-compatibility-postures.md).
Surfaced in discussion while ratifying #1839.
