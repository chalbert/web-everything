---
name: prep-amendments-least-verified-at-ratify
description: A prep-skeptic amendment is the least-verified part of a prepared item — the ratify-turn red-team must ground the amendments themselves against the live tree
metadata: 
  node_type: memory
  type: project
  originSessionId: 956cfc54-20f7-4861-ab59-fe1c8cda7efa
---

Ratifying #2089 (2026-07-02): the prep skeptic ADDED the generated-artifact leg as an amendment, but never
re-checked the new criterion's own premises — no consumption channel existed on any filed path (packages
unpublished, #907 contracts-only, MaaS parked), and the unpinned leg could self-deadlock against the very gate
it bootstrapped (Fork 2 gates new emit targets on the pilot that required one). Both holes were found only by a
fresh ratify-turn skeptic run against the live tree.

**Why:** amendments folded in at prep are written to satisfy the attack, not re-grounded like the original
draft was — they are the youngest, least-verified claims in the item.

**How to apply:** the ratify-turn red-team (skeptic sub-agent for high-leverage forks) should explicitly target
(1) each prep amendment's own supply chain / premises against the live tree, and (2) cross-element composition
(cycles, self-deadlock) that no single element's prep skeptic could see. Related: [[verify-ratified-citation-against-live-status]].
