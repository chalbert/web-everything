---
kind: story
size: 5
status: open
dateOpened: "2026-06-27"
tags: []
---

# nav-list a11y vector corpus (disclosure-navigation conformance vectors)

The W3C APG Disclosure Navigation pattern only exists in-tree as the we:demos/reveal-nav-conformance.ts demo with inline checks — there is NO reusable nav block and NO nav/disclosure a11y vector suite (current a11y vectors in we:conformance-vectors/presentation-a11y.vectors.ts are deck/slide-specific). Author the nav/disclosure a11y conformance vectors (roving tabindex, aria-expanded disclosure, no role=menuitem, focus/keyboard) so the base block the composition rule (#1795) protects has a real contract to verify against. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.
