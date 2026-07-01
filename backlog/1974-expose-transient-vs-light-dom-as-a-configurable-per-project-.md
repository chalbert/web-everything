---
kind: story
size: 3
parent: "1963"
status: open
blockedBy: []
dateOpened: "2026-06-29"
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
