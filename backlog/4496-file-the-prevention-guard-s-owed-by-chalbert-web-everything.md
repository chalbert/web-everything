---
bornAs: xv21yh3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4494-builder-open-items-limit-counts-only-the-builder-s-own-items.md"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2953's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4494-builder-open-items-limit-counts-only-the-builder-s-own-items.md:27` — Add a card-authoring/prepare-first checklist item that any 'attribute X to actor Y via store Z' design must name the concrete field in Z that discriminates Y from other writers, and require a test fixture with a non-Y writer record. Enforcing that would need a lens, not a deterministic gate.
2. `we:backlog/4494-builder-open-items-limit-counts-only-the-builder-s-own-items.md:32` — Add to the card a test-plan item and a stated decision for records unavailable or corrupt (fail closed, or fall back to the branch-name heuristic). Longer term, add a card-template lint or review-lens check that any cap or guard narrowed by a new data source states its failure-mode default.
3. `we:backlog/4494-builder-open-items-limit-counts-only-the-builder-s-own-items.md:2` — Extend the `check:standards` script to assert the presence of the `workItem` key in `backlog/*.md` frontmatter and reject alternatives like `kind`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2953@73d12a3ecb338987d84642f80b65091118fdbc8f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
