---
kind: decision
size: 2
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-14"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
codifiedIn: "docs/agent/platform-decisions.md#brand-on-distinctness"
graduatedTo: none
tags: []
---

# Position webplugs — market the plugs runtime as a standalone product/brand? (deferred)

Whether to stand 'webplugs' up as a separately-marketed product/brand — a positioning call independent of
the code home.

## Grounding digest

- The **code home is already ruled** — #606 (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement)
  rule) placed the plugs runtime as `@frontierui/plugs`, a granular sub-package (the `@lit/reactive-element`
  precedent), and explicitly **deferred the brand question as non-blocking**.
- #606 also found the real *product surface* is the **unplugged, non-invasive library**; the
  framework-agnostic global-patching runtime (`fui:plugs/bootstrap.ts`) is a **POC/demo**, not a shipped
  product — so the runtime has no standalone product surface today, and exactly **one** consumer
  (plateau-app) plus WE's own demos.
- Governing principle: **never brand/price on a shifting category** — base it on a **structural
  product-distinctness** property, not appetite (the [monetization](docs/agent/platform-decisions.md#monetization)
  rule; the soft/revisitable monetization stance, #775).
- No new `/research/` topic — a positioning call ratified against #606's findings + the brand stance.

## Axis framing — separate brand vs fold, on a structural test

The axis is *does webplugs warrant a separate product brand*, decided on **structural product-distinctness**,
not on adoption-hope. The tempting analogy — ReactDOM/React, Rollup/Vite are runtimes branded apart from
what's built on them — fails here: those are *shipping products millions consume directly*, whereas
`@frontierui/plugs` is a sub-package with one consumer and (per #606) **no standalone product surface** —
exactly the `@lit/reactive-element` case, which Lit does **not** separately market. So the structural
distinctness a separate brand needs is absent today; branding now would be branding on appetite, which the
rule forbids.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — separate webplugs brand vs fold | **(a) fold — no separate brand; webplugs stays a sub-package identity** under the constellation/FUI brand, revisited only on a structural standalone-product event | (b) stand up a separate webplugs product/brand now — excluded: no standalone product surface (#606); branding on adoption-hope is the forbidden "shifting category" move | **high** — #606 already found no product surface |

## Fork 1 — does webplugs get a separate product brand

**Fork-existence justification:** genuine either/or — a thing is either separately branded or folded at a
given time; the branches cannot coexist. The excluded branch (b) "separate brand now" is flawed on the
**merits** (structural, not timing): #606 found the plugs runtime has no standalone product surface and one
consumer, so it lacks the product-category distinctness a separate brand requires — and the governing rule
bans branding on appetite/adoption-hope. (This is a structural-property call, not a prioritization "later
is cheaper" one.)

**Crux:** a separate product brand is earned by **structural product-distinctness** (a real standalone
consumer surface), which `@frontierui/plugs` — one consumer, runtime-as-POC per #606 — does not have today.

**Options:**

- **(a) Fold — no separate brand** *(recommended default)* — webplugs stays a sub-package identity
  (`@frontierui/plugs`) under the constellation/Frontier-UI brand, the `@lit/reactive-element` precedent
  (Lit does not separately market its reactive-element runtime). The sub-package name + npm scope + contracts
  already exist, so a later split is the *cheapest possible* path — folding forecloses nothing.
- **(b) Stand up a separate webplugs product/brand now** — *Rejected (flawed branch).* The "infra runtimes
  are branded apart" analogy (ReactDOM, Rollup) fails because those ship to millions directly; webplugs has
  no standalone product surface (#606) and one consumer. Branding now to *drive* the adoption that would
  *create* the case is the circular, appetite-based move the rule forbids.

**Recommended default: (a) fold, with the structural un-park trigger below.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the "structurally-distinct runtime" attack (ReactDOM/Rollup
precedent) is **refuted** by #606's own findings — the runtime is a POC with no product surface and one
consumer (`@lit/reactive-element`, which Lit doesn't separately brand); the "fold forecloses a future
brand" attack is **backwards** (a sub-package is the *cheapest* path to a later split); and the
chicken-and-egg "branding drives adoption" attack **is** the forbidden appetite-based move. **Amendment
folded in — a structural un-park trigger:** reopen this call only when **webplugs gains ≥1 external consumer
that depends on it *without* depending on `@frontierui/blocks` / FUI components** (a real standalone-product
surface) — brand on that structural event, never on appetite.

## Ratified — 2026-06-22

**Fork 1 → (a) fold.** No separate webplugs brand; `@frontierui/plugs` stays a sub-package identity under
the constellation/Frontier-UI brand (the `@lit/reactive-element` precedent). Excluded branch (b) "separate
brand now" is flawed on the merits — #606 found no standalone product surface and one consumer, so branding
now would be the forbidden appetite-based move.

Codified as statute in
[platform-decisions § brand-on-distinctness](docs/agent/platform-decisions.md#brand-on-distinctness).

**Un-park trigger (reopen this exact call, fast ratify — not fresh research):** webplugs gains ≥1 external
consumer that depends on it *without* depending on `@frontierui/blocks` / FUI components — a real standalone
product surface. Brand on that structural event, never on appetite.
