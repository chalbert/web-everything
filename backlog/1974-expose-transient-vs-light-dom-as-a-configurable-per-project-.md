---
kind: story
size: 3
parent: "1963"
status: resolved
blockedBy: ["2159"]
dateOpened: "2026-06-29"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Migrate soft-transient presentational blocks to light-DOM (drop transient)

**Repointed by #1962 (2026-07-01 ruling: wrapper-first).** The original premise — expose transient ↔ light-DOM as
a per-project *configurable* for the 7 soft-transient blocks — was **withdrawn**: #1962 ruled the soft-7 are
**light-DOM full-stop**, not a self-erasure opt-in (self-erasure is spec-unsanctioned and buys nothing for a
behaviour-free leaf). So this story becomes a straight migration.

Convert the 7 presentational blocks — **badge, tag, section-card, auto-heading, meter, progress, card** — from the
`TransientElement` self-erase shape to a persistent **light-DOM** element (a `display:contents` wrapper where a box
would break flex/grid). No configurable toggle. Native-first is preserved: these emit their natural native tag
(`<span>`/`<div>`/`<hN>`/`<progress>`/`<meter>`) inside a persistent, styleable, nameable host. Part of the broader
FUI transient→wrapper migration filed under #1962; this story is the soft-7 slice. Ratified under #1963; default
set by #1962.

## Blocked — the concrete leaf base-element contract is undecided + unbuilt (#2028, 2026-07-01 batch pre-flight)

Claimed under a serial batch; the pre-flight found the mechanism this "straight migration" needs does **not yet
exist**. #1962 ratified the *policy* (soft-7 → light-DOM, no self-erasure) but never defined the concrete
**base-element contract**, and there is no reference implementation: a grep of `fui:blocks/**` finds no persistent
light-DOM base class — all seven leaves still `extend fui:blocks/transient/TransientElement.ts`. Converting them
first requires **deciding the leaf shape** (filed as **#2028**):

1. Does the persistent host **style itself** directly (host carries `.fui-badge` etc. + `role`, `display:contents`
   only where a box breaks flex/grid) **or wrap a natural native tag** as a child (this body's *"emit `<span>`/…
   inside a styleable host"*)? These produce materially different DOM + CSS-targeting.
2. Where do `role` / `aria-label` / accessible-naming / CEM land — host or native child?
3. The **zero-wrapper → wrapper** change alters every consumer's DOM (transient shipped a *bare* native tag; a
   persistent host adds a node), so demos + `we:src` consumers are a real regression surface, not a free swap.

**Update (2026-07-02, batch-2026-07-02):** #2028 is now **resolved** — the contract is ratified (host-is-node for
badge/tag/card/section-card/auto-heading; wrap-child for progress/meter). But the reference base is still **unbuilt**:
a grep of `fui:blocks/**` finds no persistent light-DOM base class. The residual blocker moved from "undecided
contract" to "unbuilt reference base," now filed as the concrete prerequisite **#2159** (build `LightLeafElement` +
pilot badge). The frontmatter previously carried **no** `blockedBy` edge (the block lived only in this prose, so the
selector surfaced it as ready and a lane wasted a claim on it); it is now `blockedBy: #2159`. Once #2159 ships the
base + pilot, the soft-7 conversion here is the mechanical size·3 slice it was scoped as. Do **not** pick a shape
ad-hoc to force batchability.
