---
name: prepared-axis-settled-check-siblings
description: "A prepared decision's axis marked settled/inherited can be stale when a sibling item applying the same standard reshaped it — verify against siblings, not just the cited standard."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6ef5b7d-585b-45bd-a654-a747d9d3d00a
---

A prepared decision item often marks some axes **"settled / inherited — not a fork"** to narrow the live call. That label is a **prose claim about the design, not a fact** — and it can be stale in a way [[verify-ratified-citation-against-live-status]] does **not** catch: the cited standard is real and live, but a **sibling item that applied the same standard** has since reshaped how *this* item's axis resolves. Before ratifying, open the nearest siblings (same parent/epic, same standard) and check how they actually applied it — the concrete precedent lives in the sibling, not only in the standard's own text.

Worked example (#1977 defer directive, 2026-07-01): the prepared item declared its **form** axis "settled by #1983 → *mixed* (comment boundary + live placeholder)". But sibling #1976 (async region, same #1975 catalog, same #1983 standard) had already **reclassified** its first-shown branch (`pending`) as a *stamped inert branch*, making the whole region a pure-inert **`<template type="defer">` wrapper** — not mixed. The user caught it ("not up to date with our latest directive design decision, e.g. template wrapper"). Correct move: reground the axis on the sibling precedent and rewrite the item *before* presenting/ratifying.

**Why:** a "settled" axis is where you *stop looking* — so a stale one silently ships the wrong form/shape at ratification, and the prep skeptic won't flag it because it only attacks the *live* fork. The freshest concrete precedent for how a shared standard applies is the most recently-ruled **sibling**, which is usually drafted after the item you're holding. Same family as [[naming-fork-precedent-discipline]] and [[verify-ratified-citation-against-live-status]] (verify claimed-state, don't trust the label), but the distinct axis is **sibling-application precedent > the item's own "inherited" assertion**. **How to apply:** when a prepared item marks an axis settled/inherited, don't take it on faith — pull the sibling items that applied the same standard and confirm the axis still resolves the way the item says; if a sibling reshaped it, rewrite the item's axis first, then ratify against the corrected item.
