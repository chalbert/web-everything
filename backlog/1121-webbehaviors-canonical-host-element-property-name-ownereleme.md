---
kind: decision
parent: "1095"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#host-backreference-naming"
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-host-element-backreference-naming.md
tags: []
---

# webbehaviors: canonical host-element property name — ownerElement vs target

Open fork carved from #1095 (could-not-split). The `CustomAttribute` base class exposes the element it
is attached to under two conflicting names: the **spec** names it `ownerElement`
(we:src/_includes/project-webbehaviors.njk:40,52,56,64,88), the **impl** names it `target`
(we:plugs/webbehaviors/CustomAttribute.ts:131,156,206,366). This item picks the canonical name and the
scope of the change.

## Grounding digest

- `CustomAttribute` **chains its prototype to `Attr.prototype`** (we:plugs/webbehaviors/CustomAttribute.ts:196-200),
  so each instance *is-a* `Attr` at runtime. Native [`Attr.ownerElement`](https://developer.mozilla.org/en-US/docs/Web/API/Attr/ownerElement)
  is the read-only property returning "the Element the attribute belongs to" — so `ownerElement` is not
  an analogy for this class, it is *the* native property.
- The web platform names a host back-reference **by the relationship's semantics**, not one universal
  name: attribute→element is `ownerElement`; shadow-root→host is `ShadowRoot.host`; node→document is
  `ownerDocument`; and `target`/`currentTarget` (`Event`, `MutationRecord`) name a **transient
  dispatch/observation**, not persistent ownership. `target` also collides with the `e.target` a
  behaviour reads inside its own listeners (we:plugs/__tests__/e2e/webbehaviors-simple.spec.ts:20).
- For **non-attribute** host-attached objects the ecosystem word is consistently **`host`** (Lit
  `ReactiveControllerHost`, `ShadowRoot.host`, Angular host element / `@HostBinding`, Stimulus
  `this.element`) — never `target`.
- **Blast radius** of renaming `CustomAttribute.target` → `ownerElement`: only `CustomAttribute` + its
  `Attr`-derived subclasses (we:plugs/webbehaviors/UndeterminedAttribute.ts,
  we:plugs/webregistries/ScopedRegistryAttribute.ts:43) + ~12 test refs + ~16 demo refs
  (we:demos/declarative-spa.html, we:demos/declarative-spa-unplugged.html) + a few docs njk
  (we:src/_includes/block-descriptions/broadcast.njk, we:src/_includes/block-descriptions/view.njk).
  The spec njk already says `ownerElement`, so it *converges*. It does **not** touch the parallel
  `target` on `Injector` (we:plugs/webinjectors/Injector.ts:69) or `CustomContext`
  (we:plugs/webcontexts/CustomContext.ts:79) — separate class families, the sibling decision.
- Prior art published as the `/research/host-element-backreference-naming/` topic; full grounding in
  the `relatedReport`.

## The axis

Two things must be decided: **(1)** which name is the canonical host property on `CustomAttribute`, and
**(2)** whether the change is scoped to `CustomAttribute` (an `Attr`) or unified across the plugs
platform's other host-attached classes. The two are independent — (1) is settled by native `Attr`
alignment; (2) turns on whether "host element" is one platform-wide name or a semantically-typed one.
The "add an alias getter" option from the carve is not a third canonical name — it is a rollout tactic
(below), since a permanent dual name is itself excluded.

## Recommended path at a glance

| Fork | Decision | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|---|
| 1 | Canonical host-property name | **`ownerElement`** (align impl to spec + native `Attr`) | keep / amend spec to `target` (discards native alignment) | ~90% |
| 2 | Scope of the rename | **`CustomAttribute` + `Attr`-subclasses only** | force-unify one name across `Injector`/`CustomContext` too | ~80% |

**Supported by default (not forks):**
- *Rollout tactic* — land `ownerElement` as canonical and optionally keep `target` as a **deprecated
  alias getter** for one cycle to stage the ~30-ref blast radius, removed in a mechanical follow-up.
  Identical end-state to a big-bang rename, so this is prioritization, not a merit fork.
- *Sibling naming* — the `Injector`/`CustomContext` host property (`target` today) is a separate call
  that, by the survey, should land on **`host`** (they are not attributes). File under #1042; do not
  decide it here.

## Fork 1 — canonical host-property name

*Fork exists because:* the alternative branch is **broken** — naming the host property `target` (option
C: amend the spec) discards the *exact* native name (`Attr.ownerElement`) for a class that literally
chains to `Attr.prototype`, and imports event-dispatch connotation (`Event.target`) onto a persistent
ownership relation. One name must be canonical; you cannot have both.

- **Option A — `ownerElement` (rename impl to match the shipped spec). [DEFAULT]** Native-first: the
  property already exists on `Attr`, which `CustomAttribute` becomes at runtime; the spec already ships
  this name; behaviours stop colliding `this.target` with `e.target`.
- Option C — `target` (amend the spec to match the impl). Smallest code change, but the spec would
  diverge from the native `Attr` it builds on. Rejected by the native-first default.

*Red-team note:* the only argument for the default's alternative is "less churn." That is a rollout cost,
not a correctness claim (see the rollout tactic above) — it must not flip the canonical name.

## Fork 2 — scope of the rename

*Fork exists because:* the two branches are **mutually exclusive end-states** and both are coherent —
either "host element" is one platform-wide name (unify) or it is semantically-typed per the platform's
own precedent (scope to `Attr`). They cannot both hold.

- **Option A — scope to `CustomAttribute` + its `Attr`-derived subclasses only. [DEFAULT]** Mirrors the
  platform, which names host refs by semantics (`ownerElement` for `Attr`, `host` for `ShadowRoot`).
  `Injector`/`CustomContext` are not attributes, so `ownerElement` would be *wrong* for them; their
  rename (toward `host`) is filed separately under #1042.
- Option B — unify one host-element name across all plugs (`CustomAttribute`, `Injector`,
  `CustomContext`) now. Buys cross-plug DX consistency, but forces either misapplying `ownerElement` to
  non-attributes or perpetuating the non-native `target` everywhere. Weaker on native alignment.

*Red-team note:* the consistency argument for unifying is real DX friction (two host names in the
interim). The default accepts that friction because the platform itself diverges by semantics, and
because a wrong-but-uniform name is worse than two right ones; revisit if the sibling #1042 call lands
soon enough to unify in one pass.

Once ratified the rename is a small, mechanical task.

## Ruling — RATIFIED 2026-06-19 (A / A)

- **Fork 1 → Option A: `ownerElement`** — **RATIFIED 2026-06-19.** Canonical host-element property on `CustomAttribute`.
  Rename the impl `get target()` to `get ownerElement()` to converge on the already-shipped spec and the
  native `Attr.ownerElement` (verified: `CustomAttribute` chains to `Attr.prototype` at
  we:plugs/webbehaviors/CustomAttribute.ts:200, so each instance *is-a* `Attr` — `ownerElement` is the
  exact native name, and the own getter correctly shadows it). Confidence ~90%. Red-team failed: the
  only counter ("less churn" → amend spec to `target`) is a rollout cost, not a correctness claim, and
  it discards native alignment + imports `Event.target` dispatch connotation onto persistent ownership.
- **Fork 2 → Option A: scope to `CustomAttribute` + its `Attr`-derived subclasses only** — **RATIFIED 2026-06-19.**
  (`UndeterminedAttribute`, `ScopedRegistryAttribute`). Do **not** unify one host name across
  `Injector`/`CustomContext` — they are not attributes, so `ownerElement` would be semantically wrong
  for them. The platform names host refs by semantics (`Attr.ownerElement` vs `ShadowRoot.host`), so two
  right names beat one wrong-but-uniform name. Confidence ~80%; residual = interim two-host-name DX
  friction, accepted. Sibling rename (`Injector`/`CustomContext` → `host`) stays filed under #1042.
- **Rollout** (not a fork): land `ownerElement` as canonical; optionally keep `target` as a deprecated
  alias getter for one cycle to stage the ~30-ref blast radius, removed in a mechanical follow-up.
  Identical end-state, so prioritization not merit.

The mechanical rename is the already-filed successor **#1122**, which now becomes agent-ready.
