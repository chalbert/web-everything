---
kind: decision
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, design-source, decision]
---

# Productized design-source home + locked in-code target reference (post-artifact)

Captured 2026-08-01 (resolve later). The UI-Fidelity Gate (RRFC) assumes every UI story references a
**registry-anchored, locked design target**. Today that target is a **claude.ai artifact** we author to explore a
design — good enough to bootstrap, but not the productized home. This decision is what replaces it once we
productize. It extends the RRFC target-registry slice (filed as `x8fptpl` under the UI-Fidelity Gate epic, PR
[#947](https://github.com/chalbert/web-everything/pull/947)).

## The need
- **A real design-source home** to save and render UI design iterations — with the usual design affordances:
  **versions**, **interactions/prototyping**, history, side-by-side compare — not a one-off artifact link.
- **Multiple design SOURCES.** Designs will arrive by more than one path; we must support **external services
  (e.g. Figma)** alongside our own authored designs (the claude-artifact path today).
- **The locking invariant (non-negotiable).** However a design is sourced, **once a story is created it must
  reference a LOCKED design** — ideally an **in-code** artifact — that becomes the story's immutable target.
  This is exactly RRFC INVARIANT A (the target is registry-anchored, content-hashed, and must pre-date the build
  lane); this decision is about the *productized* form of that registry, not whether to lock.

## The shape of the question (to prepare later)
- What is the canonical **stored form** of a locked target — an in-code committed artifact (HTML/tokens/spec) vs
  a rendered image vs both — such that the content-hash + perceptual-distance floor still hold?
- How does an **external source (Figma)** get **imported and frozen** into that in-code locked form (so the
  oracle is never a live external URL that can drift under us)?
- Where does the **iteration/versioning UI** live — a Plateau surface (relates to the design-studio product loop
  [#2676]) — and how do versions map to `target.registryId@vN` + `contentHash`?
- How do **interactions/prototypes** (beyond a static render) become checkable, if at all, or stay advisory?

## Not now
Deliberately **parked**. The launch RRFC uses the claude-artifact-as-target path; this decides the productized
successor. Prepare + rule when the gate is in use and the artifact path is the proven bottleneck. Should
eventually re-home under the UI-Fidelity Gate epic once that lands.
