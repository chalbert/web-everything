# Split analysis — #076 "Make more of the custom-element imperative API declarative on `<component>`"

**Date:** 2026-06-17 · **Target:** [#076](../backlog/076-component-declarative-wc-apis.md) (storied epic) · **Trigger:** "did we go as far as we could? it needs more slicing"

## Why the epic *looks* exhausted but isn't

#076 already has resolved children — #082 (attachInternals), #084 (preserve-on-move), #792 (DC-4 binding decision), #825/#830 (`observe=` reflection). Its body reads "all buildable work landed; remainder design-blocked." **That read is stale.** Tracing each "design-blocked" line to its real backlog home shows the gating decisions have since ratified, so two of them are now plain builds — and they were never re-inventoried after their blockers cleared.

What the `<component>` lowering parses today ([we:declarativeComponent.ts:51-76](../blocks/renderers/component/declarativeComponent.ts#L51-L76)): `name`, `shadow`, `delegates-focus`, `clonable`, `serializable`, `form-associated`, `default-role`, `preserve-on-move` (+ `observe=` in class-gen). Everything below is **not** exposed.

## Could split — ready build slices (mis-labelled "blocked", now agent-ready)

| Slice | What | Why it's ready now | type / size |
|---|---|---|---|
| **S1** | `behavior`/`extends` tier-2 enhancement hook → associate a *registered* class/trait on `<component>` | **DC-5 ratified 2026-06-08** ([#044](../backlog/044-component-scripting-hook.md)): declarative-only tier-1, tier-2 `behavior`/`extends` to a registered class — no inline `<script>`. The design is settled; the declarative attribute is simply unbuilt. #076 still calls this "design-blocked (DC-5)" — wrong. | idea · 3 |
| **S2** | default-ARIA defaults **beyond role** (`default-aria-*` → `internals.ariaLabel`/`ariaChecked`/`ariaExpanded`/`ariaValueNow`/…) | Same constructor-time map-through shape as the shipped `default-role` ([we:declarativeComponent.ts:132](../blocks/renderers/component/declarativeComponent.ts#L132)) — platform-settled semantics, no binding layer. Never inventoried; `default-role` covers *only* role. | idea · 3 |

**DAG:** S1 and S2 are independent of each other and of all resolved children. Each lands a fixture + tests + a Feature-Inventory row, leaving a valid demoable state — same pattern as #082/#084. S2 carries a micro-spelling choice (`default-aria-*` prefixed attrs) but it follows the `default-role` precedent, so it's a build not a fork.

## Could split — genuine open design (un-lump into its own decision item)

| Slice | What | Failed condition / why a decision not a build |
|---|---|---|
| **S3** | scoped registration `scope=` declarative spelling on `<component>` | Runtime construction for scoped autonomous elements is fixed ([#228](../backlog/228-scoped-autonomous-element-construct-and-lifecycle.md), resolved 2026-06-10), but the **author-facing `scope=` design** (how a definition declares its scoped registry, native scoped-registry alignment) is still unsettled. Belongs as a `type:decision` child, not a checklist line buried in the epic. |

## Could not split — genuine defer / resolve-in-place

| Line in #076 body | Disposition | Unblocking action |
|---|---|---|
| `observe=` reflection | **Done** — shipped via #825/#830 (resolved). Body is stale. | Update body; no slice. |
| Constraint validation ("compose target undecided") | **Decided by separation** — [#085](../backlog/085-validation-adapters-multi-language.md) explicitly does *not* wire validation into any component; the default adapter emits to `ElementInternals.setValidity`. A form-associated `<component>` (S of #082) composes Web Validation; there is **no `<component>` attribute to build**. | Resolve the line "composes via Web Validation #085"; no slice. |
| `attachInternals` → custom states (DC-14) | Parked — "seeding-only is low-value; revisit on concrete use." | Re-open on a real use; keep as a parked note. |
| Manual slot assignment (`slotAssignment:'manual'`) | Defer (tier-3 footgun) — opting in renders empty slots without a JS `slot.assign()` layer. | Needs the behavior hook (S1) first to supply the assign layer. |
| Shared / cross-instance `adoptedStyleSheets` | Defer — no declarative form exists yet. | Own design call later; not lumpable as a build. |
| Reactive bindings | Defer — depends on unshipped Template Instantiation / DOM Parts. | Platform-blocked; revisit when those ship. |

## Proposal

Scaffold **3 children** under #076 and reconcile the body:
- **S1** `behavior`/`extends` hook — idea·3, unblocked (cite DC-5/#044 ratification).
- **S2** default-ARIA defaults beyond role — idea·3, unblocked.
- **S3** `scope=` declarative spelling — `type:decision`, the one genuinely-open design call.
- Body fixes: mark `observe=` done (#825/#830); resolve constraint-validation as "composes via #085"; leave custom-states / manual-slot / shared-stylesheets / reactive-bindings as recorded defers.

Net: the epic moves from "looks done, actually stale" to **2 ready builds + 1 honest open decision + 4 recorded defers**.
