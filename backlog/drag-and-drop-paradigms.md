---
type: idea
status: open
dateOpened: '2026-06-02'
tags:
  - drag-and-drop
  - reorder
  - interaction
  - traits
  - intents
  - paradigms
  - accessibility
relatedProject: webtraits
---

# Codify drag-and-drop as composable intents & traits

Drag-and-drop is not one component but a composition of reusable interaction paradigms — capture it the way the droplist family was, then codify the pieces as intents and traits. Surfaced by the need to reorder the backlog itself: rather than build a one-off DnD, define the standard first. Decomposes into drag-source, drop-target, reorderable-list, drag-handle, keyboard-reorder (the accessible equivalent, non-optional), and a commit/persistence strategy — each surfacing as a trait (component/behavior/provider) and mapping to a native substrate.

<h3>Why it's here</h3><p>Reordering the backlog surfaced the need. Rather than build a one-off drag-and-drop, define the standard — the same move as the droplist, where a "dropdown" turned out to be a composition, not a component.</p><h3>Candidate paradigms &rarr; intents/traits</h3><ul><li><strong>drag-source</strong> — an element that can be picked up (behavior).</li><li><strong>drop-target / drop-zone</strong> — a region that accepts a payload, validating what it accepts (behavior + provider).</li><li><strong>reorderable-list</strong> — an ordered collection whose order is user-mutable (component + a provider for the order model).</li><li><strong>drag-handle</strong> — a scoped grab affordance vs. whole-element drag (behavior).</li><li><strong>keyboard-reorder</strong> — the accessible equivalent (roving tabindex + move up/down + live-region announce); part of the contract, not an add-on.</li><li><strong>commit / persistence strategy</strong> — where the new order is written (ephemeral, localStorage, or back to source) — a provider, mirroring the droplist's resolution model.</li></ul><h3>Native substrate</h3><ul><li>HTML5 Drag and Drop API (<code>draggable</code>, <code>dragstart/dragover/drop</code>) — ubiquitous but clunky and weak for touch/a11y.</li><li>Pointer Events — the real foundation for custom, touch-capable DnD.</li><li><code>Element.moveBefore()</code> (atomic move) — recent primitive that relocates a node <em>without</em> resetting its state (focus, animations, iframes, custom-element connected callbacks). Exactly what reordering interactive cards needs; pair it with the trait model.</li><li>Accessibility: <code>aria-grabbed</code>/<code>aria-dropeffect</code> are deprecated — the standard should mandate the keyboard-reorder + live-region pattern instead.</li></ul>
