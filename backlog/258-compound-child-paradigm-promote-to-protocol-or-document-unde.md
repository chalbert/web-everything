---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [paradigm, compound-children, selection, tabs, protocol, decision, harvest]
---

# Compound-child paradigm — promote to protocol or document under Selection

Decide whether the recurring **compound-child** pattern — sub-elements that act as a parent's options (`<segment>` in segmented-control, `<tab>` in Tabs, `<option>` in `<select>`) — should be promoted to its own protocol/semantics contract cross-referenced by Selection + Tabs, or remain documentation of Selection's existing grouping. Surfaced while authoring the [Segmented Control block](/blocks/segmented-control/) (#176), which adopts the pattern directly. **Recommended default: document it as a shared paradigm (a protocol/semantics term), not a new UX intent** — it is an authoring-and-lowering convention with no UX dimensions of its own.

## Context

The `Compound Child` glossary term is already seeded in `semantics.json`, and the Segmented Control block's design decisions + description page reference this open fork explicitly (it deliberately does not settle it). The pattern recurs across the standard: a parent declares its options as **authored children**, those children map to the parent's value model, and under the JSX adapter the same authoring lowers to an `options` array rather than rendered child components.

## The fork

- **Document under Selection (recommended).** Treat "compound child → option" as a named paradigm — a protocol/semantics contract cross-referenced by the Selection Intent and Tabs — without minting a new intent. Rationale: it has no UX dimensions of its own (it is an authoring + lowering convention), so per the taxonomy it is closer to a Protocol/semantics term than an Intent. Lowest surface area: not a configurable dimension, a fixed mechanic.
- **Promote to its own protocol.** A first-class `compound-child` protocol owned by Web Blocks, with a conformance contract (how children map to the value model, how the adapter lowers them). Warranted only if multiple independent vendors need to interoperate on the child-authoring shape — verify that demand first.
- **Do nothing structural.** Leave each block to document its own children ad hoc. Rejected: that is the status quo the harvest flagged as a gap (the pattern is real and shared).

## Before deciding

- Verify overlap with Selection's grouping (`<optgroup>` / `role=group`) and with the Tabs block's `<tab>` children — is there already a contract to extend rather than invent?
- Check whether the JSX adapter's children→options lowering is already specified anywhere (the render-strategy / component-compiler path).

## Decision (2026-06-11)

**Document it as a shared semantics paradigm — the existing `Compound Child` glossary term — cross-referenced *by* Selection + Tabs + the Segmented Control block. Do not mint a protocol now; do not nest it under Selection's grouping.**

Two pre-decision findings shaped the call:

- **Selection's `grouping` is a different concern.** [`intents.json`](../src/_data/intents.json) `grouping` (`flat`/`grouped`, `<optgroup>`/`role=group`) *arranges* options into labeled sets; it does not *declare* options. So "document under Selection's grouping" was a mismatched home — Compound Child is a **sibling** of grouping, not subordinate to it.
- **The cross-standard shape is less uniform than claimed.** Only `<segment>` (Segmented Control) and native `<option>` are the strict positional compound-child form. Tabs binds via `tab-trigger`/`tab-panel` **attributes** on arbitrary elements ([`TabGroupBehavior.ts`](../blocks/tabs/TabGroupBehavior.ts)), so it is a related-but-distinct variant, not a third instance.

Rejected **promote-to-protocol** *for now*: the item's own bar — proven multi-vendor interop demand — is unmet, and a protocol is the one real lock-in. It has no UX dimensions, so it is not an intent and is a fixed mechanic, not a configurable dimension. Rejected **do-nothing**: the harvest flagged the ad-hoc status quo as the gap.

The one real conformance contract — how authored children lower to an `options` array under the JSX adapter — is **unspecified anywhere** today. It is the latent protocol seed and is tracked standalone as **#281** (its natural owner is the render-strategy / component-compiler path, not Selection); a future protocol would crystallize there if interop demand appears.

**Applied:** enriched the `Compound Child` term in [`semantics.json`](../src/_data/semantics.json) (settled language, Tabs corrected to related-but-distinct, lowering noted as the seed); added cross-refs from the Selection grouping description, the Tabs block description, and the Segmented Control block description (open-decision blockquote → settled).
