---
kind: story
size: 5
status: open
dateOpened: "2026-07-02"
tags: [annotation, rich-text, suggestion, collaborative-editing, aria-1.3, contract]
---

# Author the suggested-edit contract (propose→accept/reject) composed by annotation + Editor Engine

Ratified #2029: the suggestion accept/reject mutation lifecycle is its own composed suggested-edit contract — a propose→accept/reject state machine that annotation references as the suggestion motivation's body and the Editor Engine protocol references as the transaction to apply (record-only over read-only hosts). Author the type-only contract (target composes the #1471 RangeAnchor), wire both composition references, and note the ARIA 1.3 role=suggestion insertion+deletion wrap as the payload shape.

## Scope

- The contract follows the #1471 shape: type-only/compile-erased, published under `@webeverything/contracts`
  (see [we:backlog/1471-durable-range-anchor-contract-range-w3c-selector-serialize-r.md](1471-durable-range-anchor-contract-range-w3c-selector-serialize-r.md)
  → `we:range-anchor/contract.ts` for the precedent).
- Illustrative seam (from the ruling — refine, don't treat as final):
  `SuggestedEdit { state: 'proposed'|'accepted'|'rejected'; target: RangeAnchor; proposed: { insert?, delete? } }`;
  apply is the Editor Engine protocol's existing operation, present iff the host is editable, `record-only` otherwise.
- Composition wiring: [we:src/_data/intents/annotation.json](../src/_data/intents/annotation.json) references it as
  the `suggestion` motivation's body (and its `researchGaps` handoff question closes);
  [we:src/_data/intents/rich-text.json](../src/_data/intents/rich-text.json)'s Editor Engine protocol references it
  as the transaction to apply.
- **Not** the comment-thread product UI — same boundary as the annotation intent.

Ruling + prior art: [we:backlog/2029-suggestion-accept-reject-handoff-annotation-vs-rich-text-pla.md](2029-suggestion-accept-reject-handoff-annotation-vs-rich-text-pla.md),
[`/research/suggestion-accept-reject-ownership/`](/research/suggestion-accept-reject-ownership/).
