---
type: decision
workItem: task
parent: "1088"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#native-first-baseline"
relatedReport: reports/2026-06-19-custom-element-downgrade-semantics.md
preparedDate: "2026-06-19"
tags: [webregistries, custom-elements, polyfill, native-first]
---

# Define CustomElementRegistry.downgrade() semantics

The scoped `CustomElementRegistry` polyfill in [webregistries](/projects/webregistries/) carries a stub
whose body is literally the question — `downgrade() { /* TODO: What should downgrade do? */ }` at
[we:plugs/webregistries/CustomElementRegistry.ts:134-137](../plugs/webregistries/CustomElementRegistry.ts#L134).
Unlike every other method on this polyfill (`define`, `get`, `upgrade`, `whenDefined`), native
`CustomElementRegistry` has **no `downgrade`** — so there is no native API to mirror. Carved out of
completion epic #1088 (could-not-split, [we:reports/2026-06-19-backlog-split-analysis.md](../reports/2026-06-19-backlog-split-analysis.md)).
Grounded by the [downgrade-semantics](/research/custom-element-downgrade-semantics/) research topic.

The survey returns one consistent answer: the custom-elements machinery is **monotonic by design, twice
over**, and any "downgrade" fights both invariants. (1) Element upgrade is a **one-way prototype swap** —
the HTML custom-element-state machine moves *undefined → uncustomized/failed → custom* with no edge back,
and no platform primitive un-upgrades a live node. (2) The registry is **append-only** — native exposes
`define`/`get`/`getName`/`whenDefined`/`upgrade` and notably **no `undefine`**. The standards basis for
this whole polyfill (the WICG *Scoped Custom Element Registry* proposal) adds a constructor +
`ShadowRoot` binding only and explicitly defers teardown to "a user-land abstraction, post-MVP." Global
teardown is already `removePatches()`'s job ([we:plugs/webregistries/index.ts:72-80](../plugs/webregistries/index.ts#L72)).
So the real question is not "what should downgrade do?" but "should a faithful polyfill carry a method
the platform deliberately omits?" — and the [native-first](/projects/webregistries/) answer is no.

## Ruling — RATIFIED 2026-06-19 (~Med-high; native-first)

**(B) — drop the method.** A polyfill's contract is the native surface, and native `CustomElementRegistry`
omits `downgrade` on purpose: element upgrade is a one-way prototype swap (no primitive un-upgrades a live
node) and the registry is append-only (no `undefine`). (A) revert-to-stand-ins and (C) un-scope-helper both
fight those invariants and are rejected. `removePatches()` stays the sole, global-scoped teardown affordance;
a real per-subtree teardown need (e.g. micro-frontend unmount) is designed *then* as a **named non-standard
extension**, not reopened here.

**Red-team:** the API-symmetry attack (`upgrade(root)` exists ⇒ `downgrade(root)` "expected") fails — the
platform ships `upgrade` *without* `downgrade` precisely because upgrade is one-way; mirroring that asymmetry
*is* the native-first position. No standard is created. Residual: a real micro-frontend-unmount requirement
would revisit as a named non-standard extension (not a reopening of this call).

**Codified:** [we:docs/agent/platform-decisions.md#native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline)
(polyfill-surface-fidelity corollary). **Successor build** (now agent-ready): delete the `downgrade()` stub at
[we:plugs/webregistries/CustomElementRegistry.ts](../plugs/webregistries/CustomElementRegistry.ts#L169) and the
`'should have downgrade method'` assertion at
[we:plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts:220](../plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts#L220).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · downgrade() semantics** | **(B) drop the method — mirror the platform's deliberate omission** | (A) revert elements to stand-ins *(rejected)* · (C) un-scope helper *(rejected)* | **Med-high (~75%)** — both alternatives fight the one-way / append-only invariants |

## Fork 1 — what should `downgrade()` do?

**Fork-existence:** a real fork — the TODO poses an open either/or (ship some semantics vs ship nothing),
and exactly one branch is correct. The "do something" branches are the flawed ones: **(A) is broken**
because element upgrade is irreversible at the platform level (no primitive un-upgrades; a
`setPrototypeOf` hack runs no downgrade lifecycle and breaks the element's identity/state contract), and
**(C) is broken/redundant** because global teardown is already `removePatches()`'s job and the native
registry is append-only (its stand-ins can't be un-defined anyway). So the correct branch is to mirror
the platform's deliberate omission.

- **(A) Revert upgraded elements in a subtree back to their stand-ins.** Symmetric-looking with
  `upgrade(root)` — but mirrors no native behaviour. There is no platform primitive to un-upgrade; it
  would manually `setPrototypeOf` live nodes ([we:plugs/webregistries/CustomElementRegistry.ts:130-132](../plugs/webregistries/CustomElementRegistry.ts#L130) is the upgrade side), run no downgrade callback (none exists), and silently break identity/state. *Rejected — fights the one-way upgrade invariant.*
- **(B — recommended) Drop the method.** A polyfill's contract is the native surface, and native omits
  `downgrade` on purpose (upgrade one-way, registry append-only). Remove it; let
  [removePatches()](../plugs/webregistries/index.ts#L72) remain the sole, global-scoped teardown
  affordance. If a concrete per-subtree teardown need ever surfaces (e.g. a micro-frontend unmount),
  design it *then* as a named, explicitly non-standard extension with documented identity/state
  semantics — not a mystery method whose name implies a symmetry the platform refuses to provide.
- **(C) A `removePatches()`-time helper that un-scopes a root.** Redundant — `removePatches()` already
  restores the native global registry ([we:plugs/webregistries/index.ts:72-80](../plugs/webregistries/index.ts#L72)) and can't un-define the native stand-ins it registered. A per-root un-scope inherits A's impossibility for any already-upgraded element. *Rejected.*

**Default: (B) — drop the method.** Most native-faithful; minimizes lock-in. Once ratified this becomes a
≤1 task: delete the `downgrade()` stub (and its declaration, if `window.CustomElementRegistry` typing
needs it removed too).

**Red-team note for the deciding turn:** the strongest attack on (B) is the API-symmetry argument — `upgrade(root)` exists, so a `downgrade(root)` "feels" expected. Counter: the platform ships `upgrade` *without* `downgrade` precisely because upgrade is one-way; the asymmetry is intentional, and mirroring it is the native-first position. The residual that survives: if a real micro-frontend-unmount requirement lands, revisit as a named non-standard extension (not a reopening of this call).
