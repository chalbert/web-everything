---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "Activation lifecycle (activatedCallback/deactivatedCallback/isActivated/activationSurface on CustomAttribute) + inert dead-zone in frontierui CustomAttributeRegistry + Polling trait + inert-dead-zone demo/e2e + traits.json spec"
tags: [webtraits, webbehaviors, activation-lifecycle, accessibility, inert, dead-zone, native-first]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Implement the `inert` dead-zone — behaviour-disable scope + shared activation lifecycle

Build the capability whose design was ruled in
[#222](/backlog/222-inert-dead-zone-behaviour-disable-scope/): an `inert` (native) subtree acts as a
**behaviour-activation boundary** — interaction-driven traits within it go **dormant** by default,
with a per-usage re-enable. The disable-counterpart to #202's per-usage enable.

**Settled design (from #222 — do not re-litigate):**

- **Honour native `inert`** as the dead-zone primitive (no parallel marker). It inherits down the
  subtree. `aria-disabled` / `aria-hidden` are documented-but-distinct; behaviours do not key off them.
- **Auto-dormant, scoped by meaning.** A behaviour declares its *activation surface*: interaction-driven
  behaviours (drag, open, click) auto-deactivate inside `inert`; interaction-independent behaviours
  (autosave, polling) are unaffected. No blanket "all behaviours stop" — that's the autosave bug.
- **Per-usage re-enable `<trait>-active`** (presence = re-enable), matching the `<trait>-delivery`
  suffix convention from #202. E.g. `<ul sortable sortable-active>` keeps `sortable` live inside an
  inert region. Must not collide with the value slot (`sortable="desc"`) or `<trait>-delivery` (#202).
- **Shared `activate()` / `deactivate()` lifecycle** (co-owned with
  [#221](/backlog/221-behaviour-activation-gated-on-visibility/)): a behaviour has orthogonal
  *connected* (in DOM) and *active* (should run) states; `connectedCallback` /
  `disconnectedCallback` stay about DOM presence. Both the visibility gate (#221) and this dead-zone
  toggle the *active* state. Specify the contract once here; #221 consumes it.

**Scope (when picked up):**

- **Lifecycle contract** — define `activate()` / `deactivate()` on the behaviour/trait base (or the
  `CustomAttributeRegistry` upgrade path), distinct from connect/disconnect. Document the
  connected-vs-active state model. This is the foundation #221 reuses, so land it cleanly.
- **`inert` observer** — a `MutationObserver` watching the `inert` attribute and ancestor `inert`
  (inherited), toggling contained interaction-driven behaviours' active state on inert ↔ live flips.
- **Activation-surface declaration** — a way for a trait to declare whether it's interaction-driven
  (auto-honours `inert`) or not; default for the reference traits.
- **`<trait>-active` override** — runtime honouring of the per-usage re-enable; conflict-free with the
  value slot and `<trait>-delivery`.
- **Spec** — a *The `inert` Dead-Zone* section on `/projects/webtraits/`
  (`src/_data/traits.json` + `project-webtraits.njk`): native `inert` rationale, auto-dormant scoping,
  the `<trait>-active` override, and the shared activation lifecycle.
- **Conformance demo + e2e (DoD)** — an interaction-driven trait inside an `inert` region that stays
  dormant, re-enabled by `<trait>-active`, and reactivates when the region flips live; an
  interaction-independent trait proven unaffected. Re-run `check:standards`; Frontier UI suite green.

Successor to the [#222](/backlog/222-inert-dead-zone-behaviour-disable-scope/) design ruling
(2026-06-09). Coordinate the shared lifecycle with
[#221](/backlog/221-behaviour-activation-gated-on-visibility/).

## Resolution (2026-06-09)

The `inert` dead-zone shipped, built on the #222 ruling. Spec documented in webeverything; lifecycle
contract + machinery + reference traits + demo + e2e in Frontier UI (mirroring the #202 split). Full
Frontier UI trait suites green; `tsc` clean; webeverything `check:standards` 0 errors.

**Activation lifecycle contract (the foundation #221 reuses) — `CustomAttribute` (byte-identical in
both repos).** A behaviour now has two orthogonal states: *connected* (`isConnected`, in the DOM) and
*activated* (`isActivated`, should run). New optional `activatedCallback()`/`deactivatedCallback()`
hooks carry start/stop-running work; `connectedCallback`/`disconnectedCallback` stay DOM-presence. A
new static `activationSurface: 'interaction' | 'ambient'` (default `'interaction'`) declares whether a
trait honours the dead-zone.

- **Naming deviation from the #222 ruling, on purpose.** The ruling named the lifecycle
  `activate()`/`deactivate()`; shipped as **`activatedCallback()`/`deactivatedCallback()`** to (a)
  follow the platform's existing `connectedCallback`/`attachedCallback` lifecycle-callback convention
  on this base, and (b) avoid colliding with pre-existing domain methods — `TabGroupBehavior.activate(name)`
  and `RouteLinkBehavior.isActive` are real `CustomAttribute` subclasses, and the registry *calls*
  these hooks, so a bare `activate()` would have wrongly invoked the tab method. State flag is
  `isActivated` (the `RouteLinkBehavior.isActive` getter is left untouched).

**Registry machinery — Frontier UI `plugs/webbehaviors/CustomAttributeRegistry.ts` (the impl fork; WE
registry stays the clean base).** `#addAttribute` decides activated state right after connect via
`#shouldBeActivated`; `#removeAttribute` deactivates before teardown. `#shouldBeActivated`: ambient →
always activated; interaction-driven → dormant inside `inert` (`closest('[inert]') !== null`, since
`inert` inherits) unless the placement carries the runtime-read `<trait>-active`. The per-root
`MutationObserver`'s `attributeFilter` gains `'inert'`; an `inert` flip routes to `#onInertChanged`,
which walks the subtree and re-evaluates every connected trait (nested inert resolves correctly via
`closest`).

**`<trait>-active` per-usage re-enable.** Runtime-read (`el.hasAttribute('<name>-active')`) — *not*
build-time like `<trait>-delivery` (#202), so no Enforcer change; the enforcer's usage regex already
won't mis-match the `-active` suffix.

**Reference traits + demo + e2e.** `Sortable` refactored so its click listener lives in
`activatedCallback`/`deactivatedCallback` (interaction-driven, the default surface); new ambient
`Polling` trait (`activationSurface = 'ambient'`, ticks `data-poll-count` on an interval) as the
"unaffected" counter-example. `polling` wired into the Enforcer `traitMap`. Demo
`demos/inert-dead-zone.{html,ts}` (zone starts `inert`: plain `sortable` dormant, `sortable sortable-active`
live, `polling` ticking; a button flips `inert`). E2e `plugs/__tests__/e2e/inert-dead-zone.spec.ts`
asserts the markers inside `inert`, re-activation on flip-live, re-dormancy on flip-back, and the
ambient tick advancing throughout. 7 new unit tests in `CustomAttributeRegistry.inert.test.ts`.

**Spec.** New *The `inert` Dead-Zone — a behaviour-activation scope* section on `/projects/webtraits/`
(`src/_data/traits.json` + `project-webtraits.njk`): native-`inert` rationale, auto-dormant scoping by
activation surface, the `<trait>-active` override, and the connected≠activated lifecycle (noting #221
consumes it).

**Insight surfaced:** `inert` *natively* blocks pointer/keyboard events to its subtree, so for
click-driven traits the platform already stops the interaction — the activation gate is the
*scripting* complement (stops the behaviour's own machinery, gives a clean activate/deactivate
contract that composes with #221 and survives `inert` flipping live). The e2e therefore asserts
lifecycle markers inside `inert` and only clicks once the region is live.

**Harvested (own item):** [#226](/backlog/226-trait-active-runtime-reevaluation/) — re-evaluate
`<trait>-active` when the override attribute itself toggles at runtime (today it's read at apply-time
and on `inert` flips, but not on a bare `-active` add/remove with `inert` unchanged).

## Progress

**Status:** resolved 2026-06-09.

**Branch:** docs/standard-authoring-workflow (webeverything); frontierui working tree.

**Done:** (1) `activatedCallback`/`deactivatedCallback`/`isActivated`/`activationSurface` on
`CustomAttribute` (both repos, identical); (2) active-state + inert `MutationObserver` in the FUI
registry; (3) `Sortable` refactor + ambient `Polling` + vite `traitMap`; (4) `inert-dead-zone` demo +
e2e; (5) 7 unit tests; (6) spec section in `traits.json` + `project-webtraits.njk`; (7) gates green —
FUI 93 webbehaviors unit + 30 enforcer + 108 e2e, `tsc` clean; WE 63 unit + `check:standards` 0 errors;
spec page renders.

**Next:** none — the shared activation lifecycle is now available for
[#221](/backlog/221-behaviour-activation-gated-on-visibility/) (visibility gate) to consume.
Follow-up [#226](/backlog/226-trait-active-runtime-reevaluation/).
