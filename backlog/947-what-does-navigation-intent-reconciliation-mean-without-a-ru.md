---
kind: decision
size: 3
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-18"
dateStarted: "2026-06-22"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#intent-conformance-is-block-compliance"
locus: webeverything
relatedProject: webdocs
relatedItem: "934"
tags: [intents, conformance, traits]
---

# What does navigation-intent reconciliation mean without a runtime conformance gate

Carved out of #934 (could-not-split slice g): what would it mean to "reconcile the navigation intent
meaningfully" at runtime, given WE has no runtime conformance gate?

## Reframe (2026-06-23 discussion) — what "reconcile" / "conformance" actually mean

The original framing below treated "reconcile-as-conformance" as needing a **runtime conformance gate**
(a DOM watcher), concluded it has *no honest meaning*, and offered only "fake a tie (forbidden)" or
"build the gate (separate epic)." That over-rotated on one (wrong) shape. The corrected model:

- **An intent is an interface; blocks (components/behaviors) implement it.** An intent alone does nothing
  — like an unimplemented interface. [`we:webtraits/intentProfileResolver.ts`](../webtraits/intentProfileResolver.ts)
  is literally the layer that maps an active intent profile → the traits/blocks that implement it
  (**indirectly**: the intent never names a trait; the resolver does — keeps intents UX-only, traits
  technical).
- **So "reconcile = conformance" honestly means: does the block implementing the intent satisfy its
  contract** — *not* a runtime DOM gate. That conformance splits in two:
  - **Static / contract conformance** — does the block declare the `intentDimension`s the intent requires,
    bundle the required traits? Checkable in **WE at build time** (resolver / `we:webcases/requirementValidator.ts` shape).
  - **Behavioral conformance** — does the *rendered* component behave per the intent (keyboard, dismiss,
    a11y)? Needs a running subject. Placement (already ratified): **contract → WE**, **runner/verifier →
    Plateau** (neutral, so *any* implementer consumes it — FUI is just one subject), **subject → FUI**.
    This is exactly [#1566](/backlog/1566-decision-we-renderer-conformance-mechanism-after-the-backend-/) /
    [#1597](/backlog/1597-move-conformance-runner-judge-clock-impl-fui-plateau-neutral/) /
    **[#1576](/backlog/1576-relocate-the-explorer-conformance-engine-runner-judge-bindin/)** (open) — the
    verifier→Plateau relocation. `we:webcompliance/` today is a generic policy/gate/waiver engine and is
    **not** intent-aware; intent↔block conformance is future work, *not* a #934 concern.

**Net effect on the ruling:** the descope from #934 **still holds** (conformance is a block↔intent
compliance concern whose runner lives in Plateau, not a docs-chrome concern), but the *reason* sharpens
and the foreclosure-guard now **points at #1576** rather than naming a new "runtime-gate" epic.

## Grounding digest

- WE's intent→trait resolution is **build-time only** — `we:webtraits/intentProfileResolver.ts` resolves an
  `IntentProfile` at build time, pure/side-effect-free. There is no runtime *DOM conformance gate* — but
  that was never the right shape for "conformance" (see Reframe).
- The active intent profile is **already present in the runtime DOM**: the webintents standard requires
  the server to emit it as `data-intent-*` attributes on the root/scope (`data-intent-density`,
  `-motion`, `-mode`…), and elements carry semantic intents too (`action-intent="primary"`). So sibling
  (3) "see the intent on a page" is **near-zero cost** — an inspector *reads attributes already there*,
  it does not stamp anything.
- **#934 is now resolved** ([#934](/backlog/934-we-docs-chrome-composes-real-we-traits-instead-of-hand-rolle/)) —
  its done-when was met *without* navigation-intent reconciliation, empirically confirming the descope.
- No new `/research/` topic — this rules a scope/semantic call against the real resolver, the webintents
  standard, #934's outcome, and the ratified verifier-placement cluster (#1566/#1576/#1597).

## Axis framing — three meanings of "reconcile," only one is in dispute

"Reconcile the navigation intent" silently bundles three different things, and the fork only excludes one:
(1) **intent→conformance reconciliation** — does the block implementing the intent satisfy its contract
(static, WE) and behave per it (behavioral; contract→WE, verifier→Plateau, subject→FUI); *not* a runtime
DOM gate, and **not** a #934 docs-chrome concern — *this* is what gets descoped; (2) **conflicting
nav-intent reconciliation** — coordinate two sources both asserting a nav role at runtime (host + embedded
chrome), which is *not* conformance-checking and is a legitimate coordinator concern; (3) **read-only
intent surfacing** — expose the active intent on a page at runtime as inert diagnostics, near-zero cost
because the intents already render as `data-intent-*` / element attributes. The default descopes (1) from
#934; the amendment routes (2) and (3) rather than burying them with (1).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — meaning of runtime nav-intent reconcile in #934 | **(a) rule intent→conformance reconcile OUT of #934's scope** (conformance = compliance-of-block-against-intent, whose runner lives in Plateau per #1576; #934 resolved without it), + disposition the two siblings it does *not* cover | (b) build/run intent-conformance inside #934 — excluded: it's the contract→WE / verifier→Plateau / subject→FUI cluster (#1576), never #934's docs-chrome scope | **high** — #934 resolved without it; placement already ratified |

## Fork 1 — what runtime nav-intent reconciliation means here

**Fork-existence justification:** forced invariant — the "give reconcile a meaning by building a runtime
conformance gate" branch is the *excluded* one: intent-conformance is the contract→WE / verifier→Plateau /
subject→FUI mechanism (#1566/#1576/#1597), a separate track #934's done-when does not require (and #934 has
now resolved without it), so smuggling it into #934 is silent scope-expansion. So this is a **ratify
descope**, with the substantive prep being the disposition of the two adjacent meanings the descope must
not also kill.

**Crux:** "reconcile" as *conformance* has a real meaning — does the implementing block satisfy the intent
contract (static, WE) and behave per it (behavioral; runner→Plateau, subject→FUI) — but that meaning lives
in the conformance cluster (#1576), **not** in #934's docs chrome. The other two meanings
(conflict-coordination, read-only surfacing) also exist and must be routed, not buried.

**Options:**

- **(a) Rule intent→conformance reconcile out of #934's scope** *(recommended default)* — intent-conformance
  is compliance-of-block-against-intent: static in WE (resolver/`requirementValidator` shape), behavioral
  via the verifier whose home is **Plateau** so any implementer consumes it (subject→FUI). That is the
  #1566/#1576/#1597 cluster, not #934. #934's done-when never required it and resolved without it. Descope
  it. **Amendment — disposition the two siblings:** (2) runtime reconciliation of *conflicting* nav-intent
  sources → **absorbed** by the resolved horizontal-menu **coordinator** trait
  ([#943](/backlog/943-build-the-horizontal-menu-coordinator-trait/), resolved — sibling-exclusive open,
  outside-click/focus dismiss via composedPath, Escape→collapse+refocus); (3) read-only surfacing of the
  active intent on a page → **file a real card** (an *intent inspector* dev overlay reading the existing
  `data-intent-*` / element attributes — wanted, near-zero cost). **Foreclosure-guard:** the future
  intent-conformance work is the verifier-placement cluster — **point at [#1576](/backlog/1576-relocate-the-explorer-conformance-engine-runner-judge-bindin/)**, so the descope reads as *deferred*, not *denied* (no new epic needed).
- **(b) Build/run intent-conformance inside #934** — *Rejected (out of scope).* Valuable, but it's the
  contract→WE / verifier→Plateau / subject→FUI track (#1576), never hidden #934 scope.

**Recommended default: (a) descope, with the sibling-disposition (#943 absorbs (2), card for (3)) +
foreclosure-guard pointing at #1576.**

**Skeptic:** SURVIVES-WITH-AMENDMENT, then further corrected in discussion. The original skeptic caught
that "reconcile" was over-claimed as ≡ "conformance gate," killing two non-conformance meanings — folded
in. The 2026-06-23 discussion went further: the *conformance* meaning itself was mis-shaped as a runtime
DOM gate; it is actually compliance-of-block-against-intent (static→WE, behavioral→verifier@Plateau,
subject→FUI), already tracked at #1576. The descope is even safer under the corrected model (conformance
provably isn't a #934 concern), and sibling (3) upgrades from a parked diagnostic to a wanted, near-zero
inspector because the intents already live in the DOM as `data-intent-*`.
